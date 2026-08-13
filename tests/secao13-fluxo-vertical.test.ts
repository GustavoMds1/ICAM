import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarCasoAnonimizado, ORGANIZACAO_FIXTURE } from '@/fixtures/casoAnonimizado';
import { RepositorioArquivo } from '@/servidor/repositorio';
import { reconciliarContagens, verificarQualidade } from '@/domain/qualidade/verificar';
import { montarMapaCausal, formularContrafactual } from '@/domain/causal/grafo';
import { detectarDivergenciasDeRelogio } from '@/domain/tempo/normalizacao';
import { perfilarPlano } from '@/domain/recomendacoes/hierarquia';
import { colunaDoCodigo } from '@/domain/taxonomia/catalogo';
import {
  agenteClassificador,
  agenteContradicoes,
  agenteFatos,
  agenteRecomendacoes,
  agenteRelatorio,
  executarAgente,
} from '@/agentes';
import { definirRelogio, relogioFixo } from '@/domain/tempo/relogio';

/**
 * Regressão da seção 13 do prompt mestre.
 *
 * Cada teste corresponde a um dos 14 comportamentos exigidos. Os testes
 * validam COMPORTAMENTO, rastreabilidade e regras — não obrigam a análise a
 * reproduzir conclusões pré-programadas.
 */

beforeEach(() => {
  definirRelogio(relogioFixo('2026-03-20T12:00:00.000Z'));
});

describe('seção 13 — comportamentos exigidos pelo caso de referência', () => {
  it('13.1 monta cronologia com eventos anteriores de manutenção e alarmes', () => {
    const d = criarCasoAnonimizado();
    const categorias = d.eventos.map((e) => e.titulo.toLowerCase());
    expect(categorias.some((t) => t.includes('manutenção'))).toBe(true);
    expect(categorias.some((t) => t.includes('alarme'))).toBe(true);

    const anteriores = d.eventos.filter(
      (e) => e.instanteNormalizado !== null && e.instanteNormalizado < '2026-03-12',
    );
    expect(anteriores.length).toBeGreaterThan(0);
  });

  it('13.2 organiza a coleta por PEEPO com responsável e prazo', () => {
    const d = criarCasoAnonimizado();
    const dimensoes = new Set(d.itensPeepo.map((i) => i.dimensao));
    expect(dimensoes.size).toBe(5);
    for (const i of d.itensPeepo) {
      expect(i.responsavel).toBeTruthy();
      expect(i.prazo).toBeTruthy();
      expect(i.perguntaInvestigativa.length).toBeGreaterThan(20);
    }
  });

  it('13.3 separa fatos, fatores contribuintes, causas sistêmicas e melhorias não causais', () => {
    const c = reconciliarContagens(criarCasoAnonimizado());
    expect(c.fatos).toBeGreaterThan(0);
    expect(c.fatoresContribuintes).toBeGreaterThan(0);
    expect(c.causasSistemicas).toBeGreaterThan(0);
    expect(c.oportunidadesNaoCausais).toBeGreaterThan(0);
  });

  it('13.4 preserva o conflito entre leitura relatada e registro técnico', () => {
    const d = criarCasoAnonimizado();
    const conflito = d.conflitos.find((c) => c.identificador === 'C-001');
    expect(conflito).toBeDefined();
    expect(conflito?.itens).toHaveLength(2);
    // Nenhuma fonte foi sobrescrita: as duas versões continuam registradas.
    expect(conflito?.resolucao).toBeNull();
    expect(conflito?.status).not.toBe('resolvido');

    const relato = d.fatos.find((f) => f.identificador === 'F-006');
    expect(relato?.estadoVerificacao).toBe('contestado');
    expect(relato?.vinculos.some((v) => v.sentido === 'contraria')).toBe(true);
  });

  it('13.5 monta matriz comparando limite, nota de manutenção, parâmetro e valor observado', () => {
    const d = criarCasoAnonimizado();
    const matriz = d.conflitos.find((c) => c.identificador === 'C-002');
    const rotulos = matriz?.itens.map((i) => i.rotulo.toLowerCase()) ?? [];

    expect(rotulos.some((r) => r.includes('procedimento'))).toBe(true);
    expect(rotulos.some((r) => r.includes('manutenção'))).toBe(true);
    expect(rotulos.some((r) => r.includes('configurado'))).toBe(true);
    expect(rotulos.some((r) => r.includes('observado'))).toBe(true);

    // O agente reconstrói a mesma matriz a partir dos dados, sem escolher vencedor.
    const r = agenteContradicoes.heuristica({
      grupos: [
        {
          tema: 'limite de gradiente',
          afirmacoes: (matriz?.itens ?? []).map((i, n) => ({
            id: `x${n}`,
            rotulo: i.rotulo,
            valorRelatado: i.valorRelatado,
            valorNumerico: Number.parseFloat(i.valorRelatado.replace(',', '.')),
            unidade: '%',
            fonteTipo: 'documento' as const,
            fonteId: null,
            confiabilidade: 'alta' as const,
          })),
        },
      ],
    });
    expect(r.conflitos[0]?.versaoEscolhida).toBeNull();
    expect(r.conflitos[0]?.itens).toHaveLength(4);
  });

  it('13.6 detecta relógios de sistemas com datas divergentes', () => {
    const d = criarCasoAnonimizado();
    const divergencias = detectarDivergenciasDeRelogio(
      d.fontesTemporais.map((f) => ({
        id: f.id, nome: f.nome, desvioSegundos: f.desvioSegundos, confiabilidade: f.confiabilidade,
      })),
    );
    expect(divergencias.length).toBeGreaterThan(0);
    expect(divergencias[0]?.descricao).toContain('não são diretamente comparáveis');

    // A fonte sem verificação de desvio é reportada como lacuna, não corrigida.
    expect(d.fontesTemporais.some((f) => f.desvioSegundos === null)).toBe(true);
  });

  it('13.7 identifica possível bypass de barreira de engenharia sem encerrar no executante', () => {
    const d = criarCasoAnonimizado();
    const barreira = d.classificacoes.find((c) => c.identificador === 'FT-001');

    expect(barreira?.coluna).toBe('defesas');
    expect(barreira?.estadoBarreira).toBe('falha');
    expect(barreira?.justificativaBarreira).toBeTruthy();

    // A análise não termina na ação individual: há fator organizacional confirmado.
    const organizacionais = d.classificacoes.filter(
      (c) => c.estado === 'confirmado' && c.coluna === 'fatores_organizacionais',
    );
    expect(organizacionais.length).toBeGreaterThan(0);
    expect(verificarQualidade(d).ocorrencias.map((o) => o.regra)).not.toContain(
      'ANALISE_ENCERRADA_NO_EXECUTANTE',
    );
  });

  it('13.8 liga recorrência de alarmes à aprendizagem organizacional apenas com evidência', () => {
    const d = criarCasoAnonimizado();
    const ol = d.classificacoes.find((c) => c.codigo === 'OL');
    expect(ol).toBeDefined();
    expect(ol?.sustentacoes.filter((s) => s.sentido === 'favoravel').length).toBeGreaterThan(0);

    // Sem o fato da recorrência, o fator perde sustentação e é bloqueado.
    const semEvidencia = criarCasoAnonimizado();
    const alvo = semEvidencia.classificacoes.find((c) => c.codigo === 'OL');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.sustentacoes = [];
    expect(verificarQualidade(semEvidencia).ocorrencias.map((o) => o.regra)).toContain(
      'ACHADO_SEM_EVIDENCIA',
    );
  });

  it('13.9 diferencia condição mecânica, ambiente, ação humana, defesa e fator organizacional', () => {
    const d = criarCasoAnonimizado();
    const confirmados = d.classificacoes.filter((c) => c.estado === 'confirmado');

    const colunas = new Set(confirmados.map((c) => c.coluna));
    expect(colunas.has('defesas')).toBe(true);
    expect(colunas.has('acoes')).toBe(true);
    expect(colunas.has('condicoes_tarefa_ambiente')).toBe(true);
    expect(colunas.has('fatores_organizacionais')).toBe(true);

    // A coluna declarada corresponde ao grupo do código no catálogo.
    for (const c of confirmados) {
      expect(colunaDoCodigo(c.codigo), `código ${c.codigo}`).toBe(c.coluna);
    }
  });

  it('13.10 gera ações ligadas aos fatores e classificadas pela hierarquia de controles', () => {
    const d = criarCasoAnonimizado();
    for (const r of d.recomendacoes) {
      expect(r.classificacaoIds.length).toBeGreaterThan(0);
      expect(['eliminacao', 'substituicao', 'engenharia', 'administrativa', 'epi']).toContain(
        r.hierarquiaControle,
      );
      expect(r.justificativaHierarquia.length).toBeGreaterThan(20);
    }

    const perfil = perfilarPlano(d.recomendacoes.map((r) => r.hierarquiaControle));
    expect(perfil.equilibrado).toBe(true);
  });

  it('13.11 questiona plano excessivamente administrativo', () => {
    const d = criarCasoAnonimizado();
    for (const r of d.recomendacoes) {
      r.hierarquiaControle = 'administrativa';
      r.alternativasSuperioresAvaliadas = null;
    }
    const regras = verificarQualidade(d).ocorrencias.map((o) => o.regra);
    expect(regras).toContain('EXCESSO_CONTROLES_FRACOS');

    const perfil = perfilarPlano(d.recomendacoes.map((r) => r.hierarquiaControle));
    expect(perfil.equilibrado).toBe(false);
    expect(perfil.observacao).toContain('eliminação');
  });

  it('13.12 reconcilia automaticamente as quantidades de fatos, fatores, causas e ações', () => {
    const d = criarCasoAnonimizado();
    const c = reconciliarContagens(d);

    d.relatorio = {
      id: 'rel-1', versao: 1, status: 'minuta', resumoExecutivo: 'Resumo.',
      contagensDeclaradas: {
        fatos: c.fatos, fatores: c.fatores, causasSistemicas: c.causasSistemicas, recomendacoes: c.recomendacoes,
      },
      citacoes: [],
    };
    expect(verificarQualidade(d).ocorrencias.map((o) => o.regra)).not.toContain('CONTAGEM_DIVERGENTE');

    d.relatorio.contagensDeclaradas = { ...d.relatorio.contagensDeclaradas, fatores: c.fatores + 1 };
    expect(verificarQualidade(d).ocorrencias.map((o) => o.regra)).toContain('CONTAGEM_DIVERGENTE');
  });

  it('13.13 exige métrica de eficácia e risco residual', () => {
    const d = criarCasoAnonimizado();
    for (const r of d.recomendacoes) {
      if (r.status === 'ja_tratada') continue;
      expect(r.indicadores.length).toBeGreaterThan(0);
      expect(r.indicadores[0]?.meta).toBeTruthy();
      expect(r.indicadores[0]?.metodoMedicao).toBeTruthy();
      expect(r.riscoResidual).toBeTruthy();
    }
  });

  it('13.14 gera relatório com citações rastreáveis', () => {
    const d = criarCasoAnonimizado();
    const evidencias = new Set(d.evidencias.map((e) => e.id));

    for (const f of d.fatos) {
      for (const v of f.vinculos) {
        if (!v.evidenciaId) continue;
        expect(evidencias.has(v.evidenciaId), `evidência ${v.evidenciaId}`).toBe(true);
        expect(v.localizador, `localizador de ${f.identificador}`).toBeTruthy();
        const ev = d.evidencias.find((e) => e.id === v.evidenciaId);
        expect(ev?.localizadoresValidos).toContain(v.localizador);
      }
    }

    const r = agenteRelatorio.heuristica({ dossie: d });
    expect(r.secoes.find((s) => s.id === 'fatos')?.itens.length).toBe(d.fatos.length);
  });
});

describe('fluxo vertical de ponta a ponta — seção 15, fase 3', () => {
  let dir: string;
  let repo: RepositorioArquivo;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'icam-fv-'));
    repo = new RepositorioArquivo(join(dir, 'banco.json'));
  });

  it('criar investigação → importar evidência → extrair fato com citação → classificar → revisar → criar ação → gerar trecho de relatório', async () => {
    // 1. Criar investigação.
    const inv = criarCasoAnonimizado();
    inv.fatos = [];
    inv.classificacoes = [];
    inv.recomendacoes = [];
    inv.relacoesCausais = [];
    await repo.salvarInvestigacao(inv);
    await repo.registrarAuditoria({
      organizacaoId: ORGANIZACAO_FIXTURE, usuarioId: 'u-lider', atorTipo: 'humano',
      acao: 'criar', entidadeTipo: 'investigacao', entidadeId: inv.investigacaoId,
    });

    const salva = await repo.obterInvestigacao(ORGANIZACAO_FIXTURE, inv.investigacaoId);
    expect(salva).not.toBeNull();

    // 2. Importar evidência (já presente no fixture) e extrair fato com citação.
    const evidencia = inv.evidencias[6]; // EV-007, levantamento topográfico
    if (!evidencia) throw new Error('fixture inconsistente');

    const extracao = await executarAgente(
      agenteFatos,
      {
        agente: 'fatos', investigacaoId: inv.investigacaoId,
        dados: {
          trechos: [
            {
              evidenciaId: evidencia.id, categoriaEvidencia: evidencia.categoria,
              localizador: 'seção A-A',
              texto: 'O levantamento registrou gradiente de 11,4 % na seção onde ocorreu o tombamento.',
            },
          ],
        },
      },
      null,
    );
    await repo.registrarExecucaoIa(inv.investigacaoId, extracao.registro);

    const candidato = extracao.saida.candidatos[0];
    expect(candidato).toBeDefined();
    expect(candidato?.citacao.evidenciaId).toBe(evidencia.id);
    expect(candidato?.citacao.localizador).toBe('seção A-A');
    expect(extracao.saida.requer_validacao_humana).toBe(true);

    // Decisão humana: aceitar o candidato como fato corroborado.
    inv.fatos = [
      {
        id: 'f-novo', identificador: 'F-001',
        proposicao: candidato?.proposicao ?? '',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'corroborado', confianca: 'alta',
        aprovadoPorHumano: true, origemIa: true,
        vinculos: [
          { evidenciaId: evidencia.id, declaracaoId: null, sentido: 'favoravel', localizador: 'seção A-A', trecho: candidato?.citacao.trecho ?? null, peso: 'forte' },
        ],
      },
    ];

    // 3. Classificar candidato ICAM.
    const classificacao = await executarAgente(
      agenteClassificador,
      {
        agente: 'classificador', investigacaoId: inv.investigacaoId,
        dados: {
          descricao: 'Condições e gradiente da superfície da via acima do limite do procedimento.',
          mecanismo: 'O gradiente acima do especificado reduz a margem de estabilidade lateral do equipamento carregado.',
          evidencias: [{ tipo: 'evidencia', id: evidencia.id, localizador: 'seção A-A' }],
        },
      },
      null,
    );
    await repo.registrarExecucaoIa(inv.investigacaoId, classificacao.registro);

    expect(classificacao.saida.alternativas.length).toBeGreaterThan(0);
    const escolhida = classificacao.saida.alternativas.find((a) => a.codigo === 'TE22')
      ?? classificacao.saida.alternativas[0];
    if (!escolhida) throw new Error('classificador não devolveu alternativa');

    // 4. Revisar: decisão humana explícita.
    inv.classificacoes = [
      {
        id: 'cl-novo', identificador: 'FT-001', codigo: escolhida.codigo, coluna: escolhida.coluna,
        descricaoContextual: 'A via apresentava gradiente acima do limite estabelecido pelo procedimento vigente.',
        mecanismo: 'O gradiente acima do especificado reduz a margem de estabilidade lateral do equipamento carregado.',
        estado: 'confirmado', natureza: 'causa_sistemica', confianca: 'alta',
        estadoBarreira: null, justificativaBarreira: null,
        contrafactualResposta: 'evento_improvavel',
        origemIa: true, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [{ fatoId: 'f-novo', sentido: 'favoravel', peso: 'forte' }],
        codigosSecundarios: [],
      },
    ];

    const contrafactual = formularContrafactual(inv.classificacoes[0]!);
    expect(contrafactual.pergunta).toContain('não existisse');
    expect(contrafactual.avisoMetodologico).toContain('não prova causalidade sozinha');

    // 5. Criar ação vinculada ao fator.
    const recomendacao = await executarAgente(
      agenteRecomendacoes,
      {
        agente: 'recomendacoes', investigacaoId: inv.investigacaoId,
        dados: {
          fatores: inv.classificacoes.map((c) => ({
            classificacaoId: c.id, identificador: c.identificador, codigo: c.codigo,
            descricaoContextual: c.descricaoContextual, mecanismo: c.mecanismo,
            natureza: c.natureza, estadoBarreira: c.estadoBarreira,
          })),
        },
      },
      null,
    );
    await repo.registrarExecucaoIa(inv.investigacaoId, recomendacao.registro);
    expect(recomendacao.saida.propostas[0]?.classificacaoIds).toContain('cl-novo');

    inv.recomendacoes = [
      {
        id: 'r-novo', identificador: 'R-001',
        acaoProposta: 'Reperfilar a via para o gradiente máximo especificado e incluir a seção na verificação topográfica quinzenal.',
        objetivo: 'Eliminar a condição de via fora de especificação.',
        hierarquiaControle: 'engenharia',
        justificativaHierarquia: 'Atua sobre a condição física, sem depender de comportamento humano.',
        alternativasSuperioresAvaliadas: 'Eliminação do ponto avaliada e descartada por inviabilidade de layout.',
        responsavel: 'Engenharia de mina', prazo: '2026-05-30',
        riscoResidual: 'Deriva do gradiente entre verificações, mitigada pelo ciclo quinzenal.',
        status: 'proposta', jaTratadaPorId: null,
        classificacaoIds: ['cl-novo'],
        indicadores: [
          { id: 'i-novo', nome: 'Gradiente medido', meta: '≤ 8,0%', metodoMedicao: 'Levantamento topográfico quinzenal', linhaBase: '11,4%', dataVerificacao: '2026-07-30' },
        ],
      },
    ];

    await repo.salvarInvestigacao(inv);

    // 6. Gerar trecho de relatório com citação rastreável.
    const relatorio = await executarAgente(
      agenteRelatorio,
      { agente: 'relatorio', investigacaoId: inv.investigacaoId, dados: { dossie: inv } },
      null,
    );
    await repo.registrarExecucaoIa(inv.investigacaoId, relatorio.registro);

    const secaoFatos = relatorio.saida.secoes.find((s) => s.id === 'fatos');
    expect(secaoFatos?.itens[0]).toContain('F-001');
    expect(relatorio.saida.contribuicoesIa.length).toBeGreaterThan(0);

    // 7. Verificações finais do fluxo.
    const qualidade = verificarQualidade(inv);
    const regras = qualidade.ocorrencias.map((o) => o.regra);
    expect(regras).not.toContain('ACHADO_SEM_EVIDENCIA');
    expect(regras).not.toContain('FATOR_SEM_MECANISMO');
    expect(regras).not.toContain('RECOMENDACAO_SEM_FATOR');
    expect(regras).not.toContain('SUGESTAO_IA_SEM_DECISAO_HUMANA');

    const execucoes = await repo.listarExecucoesIa(inv.investigacaoId);
    expect(execucoes).toHaveLength(4);
    expect(execucoes.every((e) => e.provedor === 'deterministico')).toBe(true);
    expect(execucoes.every((e) => /^[a-f0-9]{64}$/.test(e.entradaHash))).toBe(true);

    const auditoria = await repo.verificarIntegridadeAuditoria(ORGANIZACAO_FIXTURE);
    expect(auditoria.integra).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });
});

describe('mapa causal', () => {
  it('organiza as quatro colunas e alerta sobre fatores órfãos', () => {
    const d = criarCasoAnonimizado();
    const mapa = montarMapaCausal(d);

    expect(mapa.colunas).toHaveLength(5); // 4 colunas do gráfico, com fatores humanos separados
    expect(mapa.ciclos).toEqual([]);
    expect(mapa.relacoes.length).toBeGreaterThan(0);
  });

  it('detecta ciclo causal e avisa', () => {
    const d = criarCasoAnonimizado();
    d.relacoesCausais.push({
      id: 'rc-ciclo', origemId: 'cl-1', destinoId: 'cl-5',
      tipo: 'contribuiu_para', afirmacaoTestavel: 'Ciclo artificial para teste.', grauSustentacao: 'moderado',
    });
    const mapa = montarMapaCausal(d);
    expect(mapa.ciclos.length).toBeGreaterThan(0);
    expect(mapa.avisos.some((a) => a.includes('ciclo'))).toBe(true);
  });

  it('avisa quando não há fator organizacional', () => {
    const d = criarCasoAnonimizado();
    d.classificacoes = d.classificacoes.filter((c) => c.coluna !== 'fatores_organizacionais');
    expect(montarMapaCausal(d).avisos.some((a) => a.includes('organizacional'))).toBe(true);
  });
});
