import { randomUUID } from 'node:crypto';
import type { Banco } from './bd';
import { agora } from '../domain/tempo/relogio';
import type { PapelGlobal } from '../domain/enumeracoes';
import type { Ator } from '../seguranca/rbac';
import { avaliarSenha, gerarHashSenha, precisaRehash, verificarSenha } from '../seguranca/senha';
import {
  avaliarBloqueio,
  DURACAO_SESSAO_MS,
  gerarIdSessao,
  RENOVAR_APOS_MS,
  type EstadoBloqueio,
} from '../seguranca/sessaoAssinada';

/**
 * Serviço de autenticação.
 *
 * Decisões que valem registrar:
 *   - a resposta de falha é sempre a mesma, independentemente de o usuário
 *     existir ou não, e o hash é verificado mesmo para usuário inexistente,
 *     para não vazar quais e-mails estão cadastrados pelo tempo de resposta;
 *   - toda tentativa, com sucesso ou não, entra em `tentativas_login`;
 *   - a sessão vive no banco, o que permite revogação imediata.
 */

export interface UsuarioAutenticado {
  id: string;
  organizacaoId: string;
  nome: string;
  email: string;
  papelGlobal: PapelGlobal;
  podeVerCamposSensiveis: boolean;
  deveTrocarSenha: boolean;
}

export type ResultadoLogin =
  | { ok: true; usuario: UsuarioAutenticado; idSessao: string }
  | { ok: false; motivo: string; bloqueio?: EstadoBloqueio };

/** Hash descartável, usado para igualar o tempo de resposta de e-mail inexistente. */
const HASH_FICTICIO =
  'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

const MENSAGEM_FALHA = 'E-mail ou senha inválidos.';

interface LinhaUsuario {
  id: string;
  organizacao_id: string;
  nome: string;
  email: string;
  senha_hash: string;
  papel_global: string;
  pode_ver_campos_sensiveis: boolean;
  ativo: boolean;
  deve_trocar_senha: boolean;
}

export class ServicoAutenticacao {
  constructor(private readonly bd: Banco) {}

  async autenticar(
    email: string,
    senha: string,
    contexto: { origemIp?: string | null; agenteUsuario?: string | null } = {},
  ): Promise<ResultadoLogin> {
    const emailNormalizado = email.trim().toLowerCase();
    const instante = agora();

    // 1. Limite de tentativas, antes de qualquer verificação de senha.
    const falhas = await this.bd.consultar<{ ocorrido_em: Date | string }>(
      `SELECT ocorrido_em FROM tentativas_login
        WHERE lower(email) = $1 AND sucesso = FALSE
        ORDER BY ocorrido_em DESC LIMIT 50`,
      [emailNormalizado],
    );
    const bloqueio = avaliarBloqueio(
      falhas.linhas.map((f) => new Date(f.ocorrido_em)),
      instante,
    );
    if (bloqueio.bloqueado) {
      await this.registrarTentativa(emailNormalizado, false, 'bloqueado', contexto);
      return {
        ok: false,
        motivo:
          'Muitas tentativas sem sucesso. Aguarde alguns minutos antes de tentar novamente.',
        bloqueio,
      };
    }

    // 2. Busca do usuário.
    const r = await this.bd.consultar<LinhaUsuario>(
      `SELECT id, organizacao_id, nome, email, senha_hash, papel_global,
              pode_ver_campos_sensiveis, ativo, deve_trocar_senha
         FROM usuarios
        WHERE lower(email) = $1 AND excluido_em IS NULL
        LIMIT 1`,
      [emailNormalizado],
    );
    const usuario = r.linhas[0];

    // 3. Verificação em tempo comparável, mesmo sem usuário.
    const senhaConfere = await verificarSenha(senha, usuario?.senha_hash ?? HASH_FICTICIO);

    if (!usuario || !senhaConfere) {
      await this.registrarTentativa(
        emailNormalizado,
        false,
        usuario ? 'senha_incorreta' : 'usuario_inexistente',
        contexto,
      );
      return { ok: false, motivo: MENSAGEM_FALHA };
    }

    if (!usuario.ativo) {
      await this.registrarTentativa(emailNormalizado, false, 'usuario_inativo', contexto);
      return { ok: false, motivo: 'Esta conta está desativada. Procure o administrador.' };
    }

    // 4. Atualiza o custo do hash se a política tiver endurecido desde o cadastro.
    if (precisaRehash(usuario.senha_hash)) {
      const novoHash = await gerarHashSenha(senha);
      await this.bd.consultar('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [
        novoHash,
        usuario.id,
      ]);
    }

    // 5. Cria a sessão.
    const idSessao = gerarIdSessao();
    await this.bd.consultar(
      `INSERT INTO sessoes (id, usuario_id, organizacao_id, expira_em, origem_ip, agente_usuario)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        idSessao,
        usuario.id,
        usuario.organizacao_id,
        new Date(instante.getTime() + DURACAO_SESSAO_MS).toISOString(),
        contexto.origemIp ?? null,
        contexto.agenteUsuario ?? null,
      ],
    );

    await this.bd.consultar('UPDATE usuarios SET ultimo_acesso_em = $1 WHERE id = $2', [
      instante.toISOString(),
      usuario.id,
    ]);
    await this.registrarTentativa(emailNormalizado, true, null, contexto);

    return { ok: true, usuario: converterUsuario(usuario), idSessao };
  }

  /** Resolve a sessão do cookie em um usuário. Devolve `null` se inválida ou expirada. */
  async resolverSessao(idSessao: string): Promise<UsuarioAutenticado | null> {
    const instante = agora();

    const r = await this.bd.consultar<LinhaUsuario & { ultima_atividade: Date | string }>(
      `SELECT u.id, u.organizacao_id, u.nome, u.email, u.senha_hash, u.papel_global,
              u.pode_ver_campos_sensiveis, u.ativo, u.deve_trocar_senha, s.ultima_atividade
         FROM sessoes s
         JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.id = $1
          AND s.encerrada_em IS NULL
          AND s.expira_em > $2
          AND u.ativo = TRUE
          AND u.excluido_em IS NULL
        LIMIT 1`,
      [idSessao, instante.toISOString()],
    );

    const linha = r.linhas[0];
    if (!linha) return null;

    // Renova a atividade de forma esparsa, para não gravar a cada requisição.
    const ultima = new Date(linha.ultima_atividade).getTime();
    if (instante.getTime() - ultima > RENOVAR_APOS_MS) {
      await this.bd.consultar(
        'UPDATE sessoes SET ultima_atividade = $1, expira_em = $2 WHERE id = $3',
        [
          instante.toISOString(),
          new Date(instante.getTime() + DURACAO_SESSAO_MS).toISOString(),
          idSessao,
        ],
      );
    }

    return converterUsuario(linha);
  }

  async encerrarSessao(idSessao: string, motivo = 'logout'): Promise<void> {
    await this.bd.consultar(
      'UPDATE sessoes SET encerrada_em = $1, motivo_encerramento = $2 WHERE id = $3 AND encerrada_em IS NULL',
      [agora().toISOString(), motivo, idSessao],
    );
  }

  /** Revoga todas as sessões de um usuário — usado ao trocar senha ou desativar conta. */
  async encerrarSessoesDoUsuario(usuarioId: string, motivo: string): Promise<number> {
    const r = await this.bd.consultar(
      'UPDATE sessoes SET encerrada_em = $1, motivo_encerramento = $2 WHERE usuario_id = $3 AND encerrada_em IS NULL',
      [agora().toISOString(), motivo, usuarioId],
    );
    return r.contagem;
  }

  async trocarSenha(
    usuarioId: string,
    senhaAtual: string,
    senhaNova: string,
  ): Promise<{ ok: true } | { ok: false; problemas: string[] }> {
    const r = await this.bd.consultar<LinhaUsuario>(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE id = $1 AND excluido_em IS NULL',
      [usuarioId],
    );
    const usuario = r.linhas[0];
    if (!usuario) return { ok: false, problemas: ['Usuário não encontrado.'] };

    if (!(await verificarSenha(senhaAtual, usuario.senha_hash))) {
      return { ok: false, problemas: ['A senha atual está incorreta.'] };
    }

    const avaliacao = avaliarSenha(senhaNova, [usuario.nome, usuario.email]);
    if (!avaliacao.aceitavel) return { ok: false, problemas: avaliacao.problemas };

    await this.bd.consultar(
      `UPDATE usuarios
          SET senha_hash = $1, deve_trocar_senha = FALSE, senha_alterada_em = $2
        WHERE id = $3`,
      [await gerarHashSenha(senhaNova), agora().toISOString(), usuarioId],
    );

    // Trocar a senha invalida as demais sessões.
    await this.encerrarSessoesDoUsuario(usuarioId, 'senha_alterada');
    return { ok: true };
  }

  async criarUsuario(dados: {
    organizacaoId: string;
    nome: string;
    email: string;
    senha: string;
    papelGlobal: PapelGlobal;
    podeVerCamposSensiveis?: boolean;
  }): Promise<{ ok: true; id: string } | { ok: false; problemas: string[] }> {
    const avaliacao = avaliarSenha(dados.senha, [dados.nome, dados.email]);
    if (!avaliacao.aceitavel) return { ok: false, problemas: avaliacao.problemas };

    const existente = await this.bd.consultar(
      'SELECT id FROM usuarios WHERE organizacao_id = $1 AND lower(email) = $2 AND excluido_em IS NULL',
      [dados.organizacaoId, dados.email.trim().toLowerCase()],
    );
    if (existente.linhas.length > 0) {
      return { ok: false, problemas: ['Já existe um usuário com este e-mail nesta organização.'] };
    }

    const id = randomUUID();
    await this.bd.consultar(
      `INSERT INTO usuarios
         (id, organizacao_id, nome, email, senha_hash, papel_global, pode_ver_campos_sensiveis)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        dados.organizacaoId,
        dados.nome,
        dados.email.trim().toLowerCase(),
        await gerarHashSenha(dados.senha),
        dados.papelGlobal,
        dados.podeVerCamposSensiveis ?? false,
      ],
    );
    return { ok: true, id };
  }

  /**
   * Monta o `Ator` do RBAC/ABAC. As investigações da equipe vêm do dossiê —
   * um usuário só tem vínculo com aquelas em que foi designado.
   */
  async montarAtor(usuario: UsuarioAutenticado): Promise<Ator> {
    const r = await this.bd.consultar<{ id: string }>(
      `SELECT id FROM investigacoes
        WHERE organizacao_id = $1
          AND excluido_em IS NULL
          AND metadados -> 'equipe' @> $2::jsonb`,
      [usuario.organizacaoId, JSON.stringify([{ usuarioId: usuario.id }])],
    );

    return {
      usuarioId: usuario.id,
      organizacaoId: usuario.organizacaoId,
      papelGlobal: usuario.papelGlobal,
      investigacoesDaEquipe: r.linhas.map((l) => l.id),
      podeVerCamposSensiveis: usuario.podeVerCamposSensiveis,
    };
  }

  private async registrarTentativa(
    email: string,
    sucesso: boolean,
    motivo: string | null,
    contexto: { origemIp?: string | null },
  ): Promise<void> {
    await this.bd.consultar(
      'INSERT INTO tentativas_login (email, origem_ip, sucesso, motivo, ocorrido_em) VALUES ($1,$2,$3,$4,$5)',
      [email, contexto.origemIp ?? null, sucesso, motivo, agora().toISOString()],
    );
  }
}

function converterUsuario(l: LinhaUsuario): UsuarioAutenticado {
  return {
    id: l.id,
    organizacaoId: l.organizacao_id,
    nome: l.nome,
    email: l.email,
    papelGlobal: l.papel_global as PapelGlobal,
    podeVerCamposSensiveis: Boolean(l.pode_ver_campos_sensiveis),
    deveTrocarSenha: Boolean(l.deve_trocar_senha),
  };
}
