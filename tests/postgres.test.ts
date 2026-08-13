import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, aplicarMigracoes, verificarSaude, type Banco } from '@/servidor/bd';
import { RepositorioPostgres } from '@/servidor/repositorioPostgres';
import { ServicoAutenticacao } from '@/servidor/autenticacao';
import { criarCasoAnonimizado, ORGANIZACAO_FIXTURE } from '@/fixtures/casoAnonimizado';
import { definirRelogio, relogioFixo, relogioSistema } from '@/domain/tempo/relogio';
import {
  avaliarSenha,
  custoEfetivo,
  gerarHashSenha,
  precisaRehash,
  verificarSenha,
} from '@/seguranca/senha';
import {
  avaliarBloqueio,
  lerValorCookie,
  montarValorCookie,
  obterSegredo,
  SegredoAusenteError,
} from '@/seguranca/sessaoAssinada';

/**
 * Estes testes rodam contra o PostgreSQL de verdade (PGlite é o próprio
 * PostgreSQL compilado para WebAssembly), e não contra uma simulação. As
 * migrações, os índices, o gatilho append-only e todas as consultas são
 * exercitados pelo mesmo motor que atende em produção.
 */

process.env.SENHA_CUSTO_N = '4096'; // custo reduzido: acelera a suíte fora de produção

let bd: Banco;
let repo: RepositorioPostgres;
let auth: ServicoAutenticacao;

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres-aleatorios';

// Uma única instância para toda a suíte: subir o motor é o passo caro.
// A limpeza entre testes usa TRUNCATE, que não dispara gatilhos de linha e
// portanto também limpa a tabela append-only de auditoria.
beforeAll(async () => {
  bd = await abrirBanco({ urlConexao: '' }); // string vazia => PGlite em memória
  await aplicarMigracoes(bd);
  repo = new RepositorioPostgres(bd);
  auth = new ServicoAutenticacao(bd);
});

afterAll(async () => {
  await bd.encerrar();
});

beforeEach(async () => {
  definirRelogio(relogioSistema);
  await bd.executar(
    `TRUNCATE investigacoes_versoes, execucoes_ia, auditoria, sessoes,
              tentativas_login, investigacoes, usuarios, organizacoes RESTART IDENTITY CASCADE`,
  );
  await bd.consultar('INSERT INTO organizacoes (id, nome) VALUES ($1,$2)', [
    ORGANIZACAO_FIXTURE,
    'Organização de demonstração',
  ]);
  await bd.consultar('INSERT INTO organizacoes (id, nome) VALUES ($1,$2)', [
    'org-rival',
    'Outra organização',
  ]);
});

describe('migrações em PostgreSQL', () => {
  it('aplica as migrações e é idempotente', async () => {
    const segunda = await aplicarMigracoes(bd);
    expect(segunda.aplicadas).toEqual([]);
    expect(segunda.jaAplicadas).toContain('001_inicial.sql');
  });

  it('responde à verificação de saúde', async () => {
    const saude = await verificarSaude(bd);
    expect(saude.ok).toBe(true);
  });

  it('cria as tabelas esperadas', async () => {
    const r = await bd.consultar<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tabelas = r.linhas.map((l) => l.table_name);
    for (const t of [
      'organizacoes', 'usuarios', 'sessoes', 'tentativas_login',
      'investigacoes', 'investigacoes_versoes', 'auditoria', 'execucoes_ia', 'migracoes',
    ]) {
      expect(tabelas, `tabela ${t}`).toContain(t);
    }
  });

  it('recusa papel de usuário fora do conjunto permitido', async () => {
    await expect(
      bd.consultar(
        `INSERT INTO usuarios (id, organizacao_id, nome, email, senha_hash, papel_global)
         VALUES ('u-x',$1,'X','x@x.com','h','papel_inventado')`,
        [ORGANIZACAO_FIXTURE],
      ),
    ).rejects.toThrow();
  });

  it('impede e-mail duplicado na mesma organização, ignorando caixa', async () => {
    const criar = (email: string) =>
      auth.criarUsuario({
        organizacaoId: ORGANIZACAO_FIXTURE,
        nome: 'Pessoa Teste',
        email,
        senha: 'bauxita rampa violeta 42',
        papelGlobal: 'investigador',
      });

    expect((await criar('pessoa@exemplo.com')).ok).toBe(true);
    const duplicado = await criar('PESSOA@exemplo.com');
    expect(duplicado.ok).toBe(false);
  });
});

describe('trilha de auditoria no banco', () => {
  it('encadeia os registros e mantém a cadeia íntegra', async () => {
    for (const acao of ['criar', 'atualizar', 'aprovar']) {
      await repo.registrarAuditoria({
        organizacaoId: ORGANIZACAO_FIXTURE,
        usuarioId: 'u-1',
        atorTipo: 'humano',
        acao,
        entidadeTipo: 'investigacao',
        entidadeId: 'inv-1',
      });
    }
    const v = await repo.verificarIntegridadeAuditoria(ORGANIZACAO_FIXTURE);
    expect(v.integra).toBe(true);
    expect(v.totalRegistros).toBe(3);
  });

  it('o banco recusa UPDATE na auditoria', async () => {
    await repo.registrarAuditoria({
      organizacaoId: ORGANIZACAO_FIXTURE, usuarioId: 'u-1', atorTipo: 'humano',
      acao: 'criar', entidadeTipo: 'fato', entidadeId: 'f-1',
    });
    await expect(bd.consultar(`UPDATE auditoria SET acao = 'adulterado'`)).rejects.toThrow(
      /append-only/i,
    );
  });

  it('o banco recusa DELETE na auditoria', async () => {
    await repo.registrarAuditoria({
      organizacaoId: ORGANIZACAO_FIXTURE, usuarioId: 'u-1', atorTipo: 'humano',
      acao: 'criar', entidadeTipo: 'fato', entidadeId: 'f-1',
    });
    await expect(bd.consultar('DELETE FROM auditoria')).rejects.toThrow(/append-only/i);
  });

  it('a auditoria de uma organização não aparece para outra', async () => {
    await repo.registrarAuditoria({
      organizacaoId: ORGANIZACAO_FIXTURE, usuarioId: 'u-1', atorTipo: 'humano',
      acao: 'criar', entidadeTipo: 'fato', entidadeId: 'f-1',
    });
    expect(await repo.listarAuditoria('org-rival')).toEqual([]);
  });

  it('cadeias de organizações diferentes são independentes', async () => {
    await repo.registrarAuditoria({
      organizacaoId: ORGANIZACAO_FIXTURE, usuarioId: 'u', atorTipo: 'humano',
      acao: 'a', entidadeTipo: 't', entidadeId: '1',
    });
    await repo.registrarAuditoria({
      organizacaoId: 'org-rival', usuarioId: 'u', atorTipo: 'humano',
      acao: 'a', entidadeTipo: 't', entidadeId: '1',
    });

    const primeira = await repo.listarAuditoria('org-rival');
    expect(primeira[0]?.hashAnterior).toBeNull();
    expect((await repo.verificarIntegridadeAuditoria('org-rival')).integra).toBe(true);
  });
});

describe('investigações no banco', () => {
  it('grava, lê e versiona', async () => {
    const caso = criarCasoAnonimizado();
    const salva = await repo.salvarInvestigacao(caso);
    expect(salva.metadados.versao).toBe(1);

    const lida = await repo.obterInvestigacao(ORGANIZACAO_FIXTURE, caso.investigacaoId);
    expect(lida?.titulo).toBe(caso.titulo);
    expect(lida?.fatos).toHaveLength(caso.fatos.length);
    expect(lida?.classificacoes).toHaveLength(caso.classificacoes.length);

    const segunda = await repo.salvarInvestigacao(salva);
    expect(segunda.metadados.versao).toBe(2);

    const versoes = await bd.consultar<{ versao: number }>(
      'SELECT versao FROM investigacoes_versoes WHERE investigacao_id = $1 ORDER BY versao',
      [caso.investigacaoId],
    );
    expect(versoes.linhas.map((v) => v.versao)).toEqual([1, 2]);
  });

  it('preserva a estrutura completa do dossiê no JSONB', async () => {
    const caso = criarCasoAnonimizado();
    await repo.salvarInvestigacao(caso);
    const lida = await repo.obterInvestigacao(ORGANIZACAO_FIXTURE, caso.investigacaoId);

    expect(lida?.conflitos[0]?.itens).toHaveLength(2);
    expect(lida?.evidencias[0]?.localizadoresValidos.length).toBeGreaterThan(0);
    expect(lida?.recomendacoes[0]?.indicadores[0]?.meta).toBeTruthy();
    expect(lida?.fontesTemporais.some((f) => f.desvioSegundos === null)).toBe(true);
  });

  it('não devolve investigação de outra organização', async () => {
    await repo.salvarInvestigacao(criarCasoAnonimizado());
    expect(await repo.obterInvestigacao('org-rival', 'inv-2026-0001')).toBeNull();
    expect(await repo.listarInvestigacoes('org-rival')).toEqual([]);
  });

  it('localiza por código legível, respeitando o isolamento', async () => {
    await repo.salvarInvestigacao(criarCasoAnonimizado());
    expect(await repo.obterInvestigacao(ORGANIZACAO_FIXTURE, 'INV-2026-0001')).not.toBeNull();
    expect(await repo.obterInvestigacao('org-rival', 'INV-2026-0001')).toBeNull();
  });

  it('exclusão lógica remove da listagem sem apagar o registro', async () => {
    const caso = criarCasoAnonimizado();
    await repo.salvarInvestigacao(caso);
    await bd.consultar('UPDATE investigacoes SET excluido_em = now() WHERE id = $1', [
      caso.investigacaoId,
    ]);

    expect(await repo.listarInvestigacoes(ORGANIZACAO_FIXTURE)).toEqual([]);
    const bruto = await bd.consultar('SELECT id FROM investigacoes WHERE id = $1', [
      caso.investigacaoId,
    ]);
    expect(bruto.linhas).toHaveLength(1);
  });

  it('registra e lista execuções de IA', async () => {
    const caso = criarCasoAnonimizado();
    await repo.salvarInvestigacao(caso);
    await repo.registrarExecucaoIa(caso.investigacaoId, {
      agente: 'classificador', provedor: 'deterministico', modelo: null,
      parametros: { temperatura: 0 }, entradaHash: 'a'.repeat(64),
      entradaResumo: 'teste', saida: { alternativas: [] },
      citacoesValidadas: false, sinalizacoes: [], duracaoMs: 12, erro: null,
    });

    const execucoes = await repo.listarExecucoesIa(caso.investigacaoId);
    expect(execucoes).toHaveLength(1);
    expect(execucoes[0]?.provedor).toBe('deterministico');
    expect(execucoes[0]?.parametros).toEqual({ temperatura: 0 });
  });
});

describe('senhas', () => {
  it('gera hash verificável e diferente a cada vez', async () => {
    const senha = 'uma-senha-suficientemente-longa-2026';
    const h1 = await gerarHashSenha(senha);
    const h2 = await gerarHashSenha(senha);

    expect(h1).not.toBe(h2); // sal aleatório
    expect(h1.startsWith(`scrypt$${custoEfetivo()}$8$1$`)).toBe(true);
    expect(await verificarSenha(senha, h1)).toBe(true);
    expect(await verificarSenha('senha-errada-mas-longa-2026', h1)).toBe(false);
  });

  it('não lança para hash malformado', async () => {
    for (const invalido of ['', 'lixo', 'scrypt$x$y$z$a$b', 'bcrypt$1$2$3$4$5']) {
      expect(await verificarSenha('qualquer', invalido)).toBe(false);
    }
  });

  it('em produção o custo reduzido é ignorado', () => {
    expect(custoEfetivo({ NODE_ENV: 'production', SENHA_CUSTO_N: '1024' })).toBe(65536);
    expect(custoEfetivo({ SENHA_CUSTO_N: '4096' })).toBe(4096);
    expect(custoEfetivo({ SENHA_CUSTO_N: '8' })).toBe(65536); // valor absurdo é ignorado
  });

  it('detecta hash com custo abaixo da política atual', async () => {
    expect(precisaRehash(await gerarHashSenha('senha-de-teste-longa-2026'))).toBe(false);
    expect(precisaRehash('scrypt$1024$8$1$c2Fs$aGFzaA==')).toBe(true);
  });

  it('aplica a política de senha', () => {
    expect(avaliarSenha('curta').aceitavel).toBe(false);
    expect(avaliarSenha('senha123').aceitavel).toBe(false);
    expect(avaliarSenha('aaaaaaaaaaaaaaaa').aceitavel).toBe(false);
    expect(avaliarSenha('joao.silva-senha-longa', ['joao.silva@x.com']).aceitavel).toBe(false);
    expect(avaliarSenha('rampa azul cavalo bateria').aceitavel).toBe(true);
  });
});

describe('sessão assinada', () => {
  it('assina e lê de volta', () => {
    const valor = montarValorCookie('id-de-sessao', SEGREDO);
    expect(lerValorCookie(valor, SEGREDO)).toBe('id-de-sessao');
  });

  it('recusa assinatura adulterada ou de outro segredo', () => {
    const valor = montarValorCookie('id-de-sessao', SEGREDO);
    expect(lerValorCookie(valor, 'outro-segredo-com-mais-de-32-caracteres!!')).toBeNull();
    expect(lerValorCookie(`${valor}x`, SEGREDO)).toBeNull();
    expect(lerValorCookie('id-sem-assinatura', SEGREDO)).toBeNull();
    expect(lerValorCookie(undefined, SEGREDO)).toBeNull();
  });

  it('exige segredo forte e recusa o valor de exemplo em produção', () => {
    expect(() => obterSegredo({ SESSAO_SEGREDO: 'curto' })).toThrow(SegredoAusenteError);
    expect(() =>
      obterSegredo({
        NODE_ENV: 'production',
        SESSAO_SEGREDO: 'troque-este-valor-em-producao-com-32-bytes-aleatorios',
      }),
    ).toThrow(SegredoAusenteError);
    expect(obterSegredo({ SESSAO_SEGREDO: SEGREDO })).toBe(SEGREDO);
  });

  it('bloqueia após o limite de tentativas e libera depois da janela', () => {
    const base = new Date('2026-03-20T12:00:00Z');
    const falhas = Array.from({ length: 5 }, (_, i) => new Date(base.getTime() + i * 1000));

    const durante = avaliarBloqueio(falhas, new Date(base.getTime() + 60_000));
    expect(durante.bloqueado).toBe(true);
    expect(durante.liberaEm).not.toBeNull();

    const depois = avaliarBloqueio(falhas, new Date(base.getTime() + 16 * 60_000));
    expect(depois.bloqueado).toBe(false);
  });
});

describe('autenticação ponta a ponta', () => {
  const CREDENCIAL = { email: 'investigador@exemplo.com', senha: 'rampa azul cavalo bateria' };

  beforeEach(async () => {
    await auth.criarUsuario({
      organizacaoId: ORGANIZACAO_FIXTURE,
      nome: 'Investigador de Teste',
      email: CREDENCIAL.email,
      senha: CREDENCIAL.senha,
      papelGlobal: 'investigador',
    });
  });

  it('autentica com credencial correta e cria sessão resolvível', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const usuario = await auth.resolverSessao(login.idSessao);
    expect(usuario?.email).toBe(CREDENCIAL.email);
    expect(usuario?.papelGlobal).toBe('investigador');
  });

  it('recusa senha errada com a mesma mensagem de usuário inexistente', async () => {
    const a = await auth.autenticar(CREDENCIAL.email, 'senha-errada-porem-longa');
    const b = await auth.autenticar('ninguem@exemplo.com', 'senha-errada-porem-longa');

    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok && !b.ok) expect(a.motivo).toBe(b.motivo);
  });

  it('aceita e-mail em qualquer caixa', async () => {
    expect((await auth.autenticar('INVESTIGADOR@Exemplo.COM', CREDENCIAL.senha)).ok).toBe(true);
  });

  it('bloqueia após cinco falhas seguidas', async () => {
    for (let i = 0; i < 5; i += 1) {
      await auth.autenticar(CREDENCIAL.email, 'errada-mas-longa-o-bastante');
    }
    const bloqueada = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    expect(bloqueada.ok).toBe(false);
    if (!bloqueada.ok) expect(bloqueada.motivo).toMatch(/muitas tentativas/i);
  });

  it('registra toda tentativa, com sucesso ou falha', async () => {
    await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    await auth.autenticar(CREDENCIAL.email, 'errada-mas-longa-o-bastante');

    const r = await bd.consultar<{ sucesso: boolean }>('SELECT sucesso FROM tentativas_login');
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas.filter((l) => l.sucesso)).toHaveLength(1);
  });

  it('encerra a sessão no logout', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    if (!login.ok) throw new Error('login falhou');

    await auth.encerrarSessao(login.idSessao);
    expect(await auth.resolverSessao(login.idSessao)).toBeNull();
  });

  it('recusa sessão expirada', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    if (!login.ok) throw new Error('login falhou');

    await bd.consultar(`UPDATE sessoes SET expira_em = now() - interval '1 hour' WHERE id = $1`, [
      login.idSessao,
    ]);
    expect(await auth.resolverSessao(login.idSessao)).toBeNull();
  });

  it('desativar o usuário invalida a sessão em curso', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    if (!login.ok) throw new Error('login falhou');

    await bd.consultar('UPDATE usuarios SET ativo = FALSE WHERE email = $1', [CREDENCIAL.email]);
    expect(await auth.resolverSessao(login.idSessao)).toBeNull();
  });

  it('trocar a senha invalida as sessões existentes', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    if (!login.ok) throw new Error('login falhou');

    const troca = await auth.trocarSenha(login.usuario.id, CREDENCIAL.senha, 'nova frase secreta seguranca');
    expect(troca.ok).toBe(true);

    expect(await auth.resolverSessao(login.idSessao)).toBeNull();
    expect((await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha)).ok).toBe(false);
    expect((await auth.autenticar(CREDENCIAL.email, 'nova frase secreta seguranca')).ok).toBe(true);
  });

  it('recusa senha nova fraca na troca', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    if (!login.ok) throw new Error('login falhou');

    const troca = await auth.trocarSenha(login.usuario.id, CREDENCIAL.senha, 'senha123');
    expect(troca.ok).toBe(false);
  });

  it('monta o ator com as investigações em que o usuário é da equipe', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    if (!login.ok) throw new Error('login falhou');

    const caso = criarCasoAnonimizado();
    caso.metadados.equipe = [
      { usuarioId: login.usuario.id, nome: 'Investigador de Teste', papel: 'lider', conflitoInteresse: false },
    ];
    await repo.salvarInvestigacao(caso);

    const ator = await auth.montarAtor(login.usuario);
    expect(ator.investigacoesDaEquipe).toContain(caso.investigacaoId);
    expect(ator.organizacaoId).toBe(ORGANIZACAO_FIXTURE);
    expect(ator.podeVerCamposSensiveis).toBe(false);
  });

  it('o ator não recebe investigação em que não é da equipe', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    if (!login.ok) throw new Error('login falhou');

    await repo.salvarInvestigacao(criarCasoAnonimizado()); // equipe do fixture, não este usuário
    const ator = await auth.montarAtor(login.usuario);
    expect(ator.investigacoesDaEquipe).toEqual([]);
  });

  it('usuário criado começa obrigado a trocar a senha', async () => {
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    expect(login.ok).toBe(true);
    if (login.ok) expect(login.usuario.deveTrocarSenha).toBe(true);
  });

  it('relógio fixo não interfere na expiração de sessão', async () => {
    definirRelogio(relogioFixo('2026-03-20T12:00:00.000Z'));
    const login = await auth.autenticar(CREDENCIAL.email, CREDENCIAL.senha);
    expect(login.ok).toBe(true);
    if (login.ok) expect(await auth.resolverSessao(login.idSessao)).not.toBeNull();
  });
});

describe('adaptador do banco', () => {
  it('contagem reflete linhas afetadas em UPDATE e DELETE', async () => {
    await auth.criarUsuario({
      organizacaoId: ORGANIZACAO_FIXTURE, nome: 'Alguem', email: 'a@b.com',
      senha: 'bauxita rampa violeta 42', papelGlobal: 'leitor',
    });

    const atualizadas = await bd.consultar('UPDATE usuarios SET deve_trocar_senha = FALSE');
    expect(atualizadas.contagem).toBe(1);

    const removidas = await bd.consultar('DELETE FROM tentativas_login');
    expect(removidas.contagem).toBeGreaterThanOrEqual(0);
  });

  it('encerrarSessoesDoUsuario informa quantas sessões foram revogadas', async () => {
    await auth.criarUsuario({
      organizacaoId: ORGANIZACAO_FIXTURE, nome: 'Pessoa Dois', email: 'dois@exemplo.com',
      senha: 'bauxita rampa violeta 42', papelGlobal: 'investigador',
    });
    const a = await auth.autenticar('dois@exemplo.com', 'bauxita rampa violeta 42');
    const b = await auth.autenticar('dois@exemplo.com', 'bauxita rampa violeta 42');
    if (!a.ok || !b.ok) throw new Error('login falhou');

    const revogadas = await auth.encerrarSessoesDoUsuario(a.usuario.id, 'teste');
    expect(revogadas).toBe(2);
    expect(await auth.resolverSessao(a.idSessao)).toBeNull();
    expect(await auth.resolverSessao(b.idSessao)).toBeNull();
  });
});
