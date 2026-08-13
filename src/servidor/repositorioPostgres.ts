import { randomUUID } from 'node:crypto';
import type { Banco } from './bd';
import type { InvestigacaoCompleta, Repositorio } from './repositorio';
import { agora } from '../domain/tempo/relogio';
import {
  prepararRegistro,
  verificarCadeia,
  type EntradaAuditoria,
  type RegistroAuditoriaCalculado,
  type VerificacaoCadeia,
} from '../seguranca/auditoria';
import type { RegistroExecucao } from '../agentes/contratos';

/**
 * Implementação da interface `Repositorio` sobre PostgreSQL.
 *
 * Garantias preservadas:
 *   - **isolamento** — `organizacao_id` entra em TODA cláusula WHERE. Não há
 *     caminho de leitura sem ele;
 *   - **exclusão lógica** — `excluido_em` filtra em vez de apagar;
 *   - **histórico imutável** — cada gravação também insere em
 *     `investigacoes_versoes`;
 *   - **auditoria append-only** — encadeada por hash e protegida por gatilho no
 *     próprio banco, que recusa UPDATE e DELETE.
 */

interface LinhaInvestigacao {
  id: string;
  organizacao_id: string;
  codigo: string;
  titulo: string;
  fase: string;
  dossie: unknown;
  metadados: unknown;
  versao: number;
}

interface LinhaAuditoria {
  id: string;
  organizacao_id: string;
  usuario_id: string | null;
  ator_tipo: string;
  acao: string;
  entidade_tipo: string;
  entidade_id: string;
  investigacao_id: string | null;
  antes_json: string | null;
  depois_json: string | null;
  origem_ip: string | null;
  agente_usuario: string | null;
  hash_anterior: string | null;
  hash_registro: string;
  ocorrido_em: Date | string;
}

function comoObjeto<T>(valor: unknown): T {
  return (typeof valor === 'string' ? JSON.parse(valor) : valor) as T;
}

function montarInvestigacao(linha: LinhaInvestigacao): InvestigacaoCompleta {
  const dossie = comoObjeto<Omit<InvestigacaoCompleta, 'metadados'>>(linha.dossie);
  return {
    ...dossie,
    investigacaoId: linha.id,
    codigo: linha.codigo,
    titulo: linha.titulo,
    fase: linha.fase,
    metadados: comoObjeto<InvestigacaoCompleta['metadados']>(linha.metadados),
  };
}

export class RepositorioPostgres implements Repositorio {
  constructor(private readonly bd: Banco) {}

  async listarInvestigacoes(organizacaoId: string): Promise<InvestigacaoCompleta[]> {
    const r = await this.bd.consultar<LinhaInvestigacao>(
      `SELECT id, organizacao_id, codigo, titulo, fase, dossie, metadados, versao
         FROM investigacoes
        WHERE organizacao_id = $1 AND excluido_em IS NULL
        ORDER BY criado_em DESC`,
      [organizacaoId],
    );
    return r.linhas.map(montarInvestigacao);
  }

  async obterInvestigacao(
    organizacaoId: string,
    id: string,
  ): Promise<InvestigacaoCompleta | null> {
    // Aceita id ou código legível, sempre restrito à organização do ator.
    const r = await this.bd.consultar<LinhaInvestigacao>(
      `SELECT id, organizacao_id, codigo, titulo, fase, dossie, metadados, versao
         FROM investigacoes
        WHERE organizacao_id = $1 AND (id = $2 OR codigo = $2) AND excluido_em IS NULL
        LIMIT 1`,
      [organizacaoId, id],
    );
    const linha = r.linhas[0];
    return linha ? montarInvestigacao(linha) : null;
  }

  async salvarInvestigacao(investigacao: InvestigacaoCompleta): Promise<InvestigacaoCompleta> {
    const { metadados, ...dossie } = investigacao;
    const instante = agora();

    return this.bd.transacao(async (tx) => {
      const atual = await tx.consultar<{ versao: number }>(
        'SELECT versao FROM investigacoes WHERE id = $1 AND organizacao_id = $2',
        [investigacao.investigacaoId, metadados.organizacaoId],
      );
      const versao = (atual.linhas[0]?.versao ?? 0) + 1;
      const metadadosAtualizados = {
        ...metadados,
        versao,
        atualizadoEm: instante.toISOString(),
      };

      await tx.consultar(
        `INSERT INTO investigacoes
           (id, organizacao_id, codigo, titulo, fase, status, confidencialidade,
            severidade_real, severidade_potencial, ocorrido_em, dossie, metadados,
            versao, criado_em, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           codigo = EXCLUDED.codigo,
           titulo = EXCLUDED.titulo,
           fase = EXCLUDED.fase,
           status = EXCLUDED.status,
           confidencialidade = EXCLUDED.confidencialidade,
           severidade_real = EXCLUDED.severidade_real,
           severidade_potencial = EXCLUDED.severidade_potencial,
           ocorrido_em = EXCLUDED.ocorrido_em,
           dossie = EXCLUDED.dossie,
           metadados = EXCLUDED.metadados,
           versao = EXCLUDED.versao,
           atualizado_em = EXCLUDED.atualizado_em`,
        [
          investigacao.investigacaoId,
          metadados.organizacaoId,
          investigacao.codigo,
          investigacao.titulo,
          investigacao.fase,
          'aberta',
          metadados.confidencialidade,
          metadados.severidadeReal,
          metadados.severidadePotencial,
          metadados.ocorridoEm,
          JSON.stringify(dossie),
          JSON.stringify(metadadosAtualizados),
          versao,
          metadados.criadoEm,
          instante.toISOString(),
        ],
      );

      // Histórico imutável: a versão anterior continua recuperável.
      await tx.consultar(
        `INSERT INTO investigacoes_versoes
           (investigacao_id, versao, organizacao_id, dossie, metadados, gravado_em)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (investigacao_id, versao) DO NOTHING`,
        [
          investigacao.investigacaoId,
          versao,
          metadados.organizacaoId,
          JSON.stringify(dossie),
          JSON.stringify(metadadosAtualizados),
          instante.toISOString(),
        ],
      );

      return { ...investigacao, metadados: metadadosAtualizados };
    });
  }

  async registrarAuditoria(entrada: EntradaAuditoria): Promise<RegistroAuditoriaCalculado> {
    return this.bd.transacao(async (tx) => {
      // Bloqueia a linha da organização para serializar o encadeamento.
      const ultimo = await tx.consultar<{ hash_registro: string }>(
        `SELECT hash_registro FROM auditoria
          WHERE organizacao_id = $1
          ORDER BY sequencia DESC LIMIT 1`,
        [entrada.organizacaoId],
      );

      const registro = prepararRegistro(entrada, ultimo.linhas[0]?.hash_registro ?? null);

      await tx.consultar(
        `INSERT INTO auditoria
           (id, organizacao_id, usuario_id, ator_tipo, acao, entidade_tipo, entidade_id,
            investigacao_id, antes_json, depois_json, origem_ip, agente_usuario,
            hash_anterior, hash_registro, ocorrido_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          randomUUID(),
          registro.organizacaoId,
          registro.usuarioId,
          registro.atorTipo,
          registro.acao,
          registro.entidadeTipo,
          registro.entidadeId,
          registro.investigacaoId ?? null,
          registro.antesJson,
          registro.depoisJson,
          registro.origemIp ?? null,
          registro.agenteUsuario ?? null,
          registro.hashAnterior,
          registro.hashRegistro,
          registro.ocorridoEm.toISOString(),
        ],
      );

      return registro;
    });
  }

  async listarAuditoria(
    organizacaoId: string,
    limite = 100,
  ): Promise<(RegistroAuditoriaCalculado & { id: string })[]> {
    const r = await this.bd.consultar<LinhaAuditoria>(
      `SELECT * FROM auditoria
        WHERE organizacao_id = $1
        ORDER BY sequencia DESC
        LIMIT $2`,
      [organizacaoId, limite],
    );
    return r.linhas.map(converterAuditoria);
  }

  async verificarIntegridadeAuditoria(organizacaoId: string): Promise<VerificacaoCadeia> {
    const r = await this.bd.consultar<LinhaAuditoria>(
      `SELECT * FROM auditoria
        WHERE organizacao_id = $1
        ORDER BY sequencia ASC`,
      [organizacaoId],
    );
    return verificarCadeia(r.linhas.map(converterAuditoria));
  }

  async registrarExecucaoIa(investigacaoId: string, registro: RegistroExecucao): Promise<void> {
    const org = await this.bd.consultar<{ organizacao_id: string }>(
      'SELECT organizacao_id FROM investigacoes WHERE id = $1',
      [investigacaoId],
    );
    const organizacaoId = org.linhas[0]?.organizacao_id;
    if (!organizacaoId) {
      throw new Error(`Investigação ${investigacaoId} não encontrada para registrar execução de IA.`);
    }

    await this.bd.consultar(
      `INSERT INTO execucoes_ia
         (id, organizacao_id, investigacao_id, agente, provedor, modelo, parametros_json,
          entrada_hash, entrada_resumo, saida_json, citacoes_validadas, sinalizacoes_json,
          duracao_ms, erro, executado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        randomUUID(),
        organizacaoId,
        investigacaoId,
        registro.agente,
        registro.provedor,
        registro.modelo,
        JSON.stringify(registro.parametros),
        registro.entradaHash,
        registro.entradaResumo,
        JSON.stringify(registro.saida),
        registro.citacoesValidadas,
        JSON.stringify(registro.sinalizacoes),
        registro.duracaoMs,
        registro.erro,
        agora().toISOString(),
      ],
    );
  }

  async listarExecucoesIa(
    investigacaoId: string,
  ): Promise<(RegistroExecucao & { id: string; executadoEm: string })[]> {
    const r = await this.bd.consultar<Record<string, unknown>>(
      `SELECT * FROM execucoes_ia WHERE investigacao_id = $1 ORDER BY executado_em DESC`,
      [investigacaoId],
    );

    return r.linhas.map((l) => ({
      id: String(l.id),
      executadoEm: new Date(l.executado_em as string).toISOString(),
      agente: l.agente as RegistroExecucao['agente'],
      provedor: String(l.provedor),
      modelo: (l.modelo as string | null) ?? null,
      parametros: comoObjeto<Record<string, unknown>>(l.parametros_json ?? '{}'),
      entradaHash: String(l.entrada_hash),
      entradaResumo: String(l.entrada_resumo ?? ''),
      saida: comoObjeto<unknown>(l.saida_json ?? 'null'),
      citacoesValidadas: Boolean(l.citacoes_validadas),
      sinalizacoes: comoObjeto<string[]>(l.sinalizacoes_json ?? '[]'),
      duracaoMs: (l.duracao_ms as number | null) ?? 0,
      erro: (l.erro as string | null) ?? null,
    }));
  }
}

function converterAuditoria(l: LinhaAuditoria): RegistroAuditoriaCalculado & { id: string } {
  return {
    id: l.id,
    organizacaoId: l.organizacao_id,
    usuarioId: l.usuario_id,
    atorTipo: l.ator_tipo as 'humano' | 'ia' | 'sistema',
    acao: l.acao,
    entidadeTipo: l.entidade_tipo,
    entidadeId: l.entidade_id,
    investigacaoId: l.investigacao_id,
    origemIp: l.origem_ip,
    agenteUsuario: l.agente_usuario,
    antesJson: l.antes_json,
    depoisJson: l.depois_json,
    antes: l.antes_json ? JSON.parse(l.antes_json) : undefined,
    depois: l.depois_json ? JSON.parse(l.depois_json) : undefined,
    hashAnterior: l.hash_anterior,
    hashRegistro: l.hash_registro,
    ocorridoEm: new Date(l.ocorrido_em),
  };
}
