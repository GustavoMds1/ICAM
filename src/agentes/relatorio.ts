import { z } from 'zod';
import type { Dossie } from '../domain/dossie';
import { ROTULOS_COLUNA_ICAM, ROTULOS_HIERARQUIA, type ColunaIcam } from '../domain/enumeracoes';
import { reconciliarContagens, verificarQualidade } from '../domain/qualidade/verificar';
import { obterCodigo } from '../domain/taxonomia/catalogo';
import { respostaAnalitica } from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';

/**
 * Agente 9 — Compilador de relatório.
 *
 * Monta a estrutura completa da seção 4.10 a partir do que EXISTE no dossiê.
 * Não escreve conclusões novas, não preenche seção vazia com texto plausível e
 * identifica explicitamente as contribuições da IA. Seções sem dado aparecem
 * como "sem registro", que é informação — não lacuna a ser maquiada.
 */

export const secaoRelatorio = z.object({
  id: z.string(),
  titulo: z.string(),
  conteudo: z.string(),
  vazia: z.boolean(),
  itens: z.array(z.string()),
  citacoes: z.array(z.object({ evidenciaId: z.string(), localizador: z.string(), fatoId: z.string().nullable() })),
});
export type SecaoRelatorio = z.infer<typeof secaoRelatorio>;

export const respostaRelatorio = respostaAnalitica.extend({
  tipo: z.literal('inferencia'),
  secoes: z.array(secaoRelatorio),
  contagens: z.record(z.string(), z.union([z.number(), z.record(z.string(), z.number())])),
  bloqueiosParaPublicacao: z.array(z.string()),
  contribuicoesIa: z.array(z.string()),
});
export type RespostaRelatorio = z.infer<typeof respostaRelatorio>;

export interface EntradaRelatorio {
  dossie: Dossie;
  /** Exibe nomes reais somente quando explicitamente autorizado. */
  modoIdentificado?: boolean;
}

const ESTRUTURA: { id: string; titulo: string }[] = [
  { id: 'sumario_executivo', titulo: 'Sumário executivo' },
  { id: 'escopo', titulo: 'Escopo da investigação' },
  { id: 'equipe', titulo: 'Equipe e governança' },
  { id: 'metodologia', titulo: 'Metodologia' },
  { id: 'limitacoes', titulo: 'Limitações' },
  { id: 'notificacao', titulo: 'Notificação inicial' },
  { id: 'consequencias', titulo: 'Consequências reais e potenciais' },
  { id: 'acoes_imediatas', titulo: 'Ações imediatas' },
  { id: 'fontes', titulo: 'Fontes e evidências' },
  { id: 'peepo', titulo: 'Plano de coleta PEEPO' },
  { id: 'cronologia', titulo: 'Cronologia' },
  { id: 'reconstrucao', titulo: 'Reconstrução do evento' },
  { id: 'fatos', titulo: 'Livro de fatos' },
  { id: 'conflitos', titulo: 'Contradições e como foram tratadas' },
  { id: 'defesas', titulo: 'Defesas ausentes ou falhas' },
  { id: 'acoes', titulo: 'Ações individuais ou em equipe' },
  { id: 'condicoes', titulo: 'Condições da tarefa e do ambiente' },
  { id: 'fatores_humanos', titulo: 'Fatores humanos' },
  { id: 'organizacionais', titulo: 'Fatores organizacionais' },
  { id: 'mapa_causal', titulo: 'Mapa causal' },
  { id: 'conclusoes', titulo: 'Conclusões' },
  { id: 'recomendacoes', titulo: 'Recomendações e plano de ação' },
  { id: 'lacunas', titulo: 'Lacunas de informação' },
  { id: 'divergencias', titulo: 'Opiniões divergentes' },
  { id: 'aprovacoes', titulo: 'Aprovações' },
  { id: 'anexos', titulo: 'Anexos' },
];

const SEM_REGISTRO = 'Sem registro nesta investigação.';

export const agenteRelatorio: DefinicaoAgente<EntradaRelatorio, RespostaRelatorio> = {
  nome: 'relatorio',
  esquemaSaida: respostaRelatorio,

  instrucao: [
    'Você é o agente compilador de relatório de uma plataforma de investigação ICAM.',
    'Monte cada seção EXCLUSIVAMENTE a partir dos registros existentes no dossiê.',
    'Seção sem dado deve dizer que não há registro. Nunca preencha com texto plausível.',
    'Use função ou pseudônimo, não nome e matrícula. Identifique o que veio de IA.',
  ].join('\n'),

  formatoEsperado:
    '{ "resposta": "...", "tipo": "inferencia", "secoes": [...], "contagens": {...}, "bloqueiosParaPublicacao": [...], "contribuicoesIa": [...], ... }',

  montarTarefa(e) {
    return `Compile o relatório da investigação ${e.dossie.codigo} (${e.dossie.titulo}).`;
  },

  heuristica(entrada) {
    const d = entrada.dossie;
    const contagens = reconciliarContagens(d);
    const qualidade = verificarQualidade(d);
    const confirmados = d.classificacoes.filter((c) => c.estado === 'confirmado');

    const porColuna = (coluna: ColunaIcam) =>
      confirmados
        .filter((c) => c.coluna === coluna)
        .map(
          (c) =>
            `${c.identificador} — ${c.codigo} ${obterCodigo(c.codigo)?.titulo ?? ''}: ${c.descricaoContextual}` +
            (c.estadoBarreira ? ` [barreira: ${c.estadoBarreira}]` : '') +
            (c.mecanismo ? ` Mecanismo: ${c.mecanismo}` : ' Mecanismo: NÃO INFORMADO.'),
        );

    const conteudoPorSecao: Record<string, { itens: string[]; conteudo?: string }> = {
      sumario_executivo: {
        itens: [],
        conteudo:
          `Investigação ${d.codigo} — ${d.titulo}. Fase atual: ${d.fase}. ` +
          `${contagens.fatores} fator(es) confirmado(s), ${contagens.causasSistemicas} causa(s) sistêmica(s), ` +
          `${contagens.recomendacoes} ação(ões) no plano, ${contagens.lacunasAbertas} lacuna(s) aberta(s). ` +
          'Este texto é um esqueleto factual gerado a partir dos registros; a análise executiva deve ser escrita e assinada por pessoa.',
      },
      escopo: { itens: [] },
      equipe: { itens: [] },
      metodologia: {
        itens: [],
        conteudo:
          'Investigação conduzida segundo o método ICAM: coleta estruturada em PEEPO, cronologia com fontes temporais identificadas, ' +
          'livro de fatos com tipo de asserção explícito, matriz de contradições com versões preservadas, classificação nas quatro colunas ' +
          'do gráfico ICAM com evidência e mecanismo, mapa causal com afirmações testáveis e plano de ação classificado pela hierarquia de controles.',
      },
      limitacoes: {
        itens: [
          ...d.lacunas.filter((l) => l.status !== 'fechada').map((l) => `${l.identificador} (${l.criticidade}): ${l.descricao}`),
          ...(qualidade.bloqueios > 0
            ? [`Há ${qualidade.bloqueios} bloqueio(s) de qualidade em aberto nesta versão.`]
            : []),
        ],
      },
      fontes: {
        itens: d.evidencias.map(
          (e) => `${e.identificador} — ${e.titulo} (${e.categoria}); autenticidade: ${e.autenticidadeAvaliada}`,
        ),
      },
      peepo: {
        itens: (['pessoas', 'ambiente', 'equipamentos', 'procedimentos', 'organizacao'] as const).map((dim) => {
          const itens = d.itensPeepo.filter((i) => i.dimensao === dim);
          const coletados = itens.filter((i) => i.status === 'coletado').length;
          return `${dim}: ${coletados}/${itens.length} item(ns) coletado(s)`;
        }),
      },
      cronologia: {
        itens: d.eventos.map(
          (e) =>
            `${e.instanteNormalizado ?? 'horário desconhecido'} (${e.precisao}) — ${e.titulo}` +
            (e.conflitoTemporal ? ' [conflito temporal registrado]' : ''),
        ),
      },
      reconstrucao: {
        itens: [],
        conteudo:
          d.eventos.length > 0
            ? 'RECONSTRUÇÃO: a sequência apresentada é uma reconstrução baseada nas evidências listadas. ' +
              'Trechos inferidos não constituem fato e estão identificados na cronologia pelo tipo de asserção.'
            : SEM_REGISTRO,
      },
      fatos: {
        itens: d.fatos.map(
          (f) => `${f.identificador} [${f.tipoAssercao}/${f.estadoVerificacao}] ${f.proposicao}`,
        ),
      },
      conflitos: {
        itens: d.conflitos.map(
          (c) =>
            `${c.identificador} — ${c.titulo} (${c.status}). Versões: ${c.itens.map((i) => `${i.rotulo}="${i.valorRelatado}"`).join(' | ')}` +
            (c.justificativaResolucao ? ` Resolução: ${c.justificativaResolucao}` : ''),
        ),
      },
      defesas: { itens: porColuna('defesas') },
      acoes: { itens: porColuna('acoes') },
      condicoes: { itens: porColuna('condicoes_tarefa_ambiente') },
      fatores_humanos: { itens: porColuna('fatores_humanos') },
      organizacionais: { itens: porColuna('fatores_organizacionais') },
      mapa_causal: {
        itens: d.relacoesCausais.map(
          (r) => `${r.tipo} [${r.grauSustentacao}]: ${r.afirmacaoTestavel}`,
        ),
      },
      conclusoes: {
        itens: confirmados
          .filter((c) => c.natureza === 'causa_sistemica' || c.natureza === 'fator_contribuinte')
          .map((c) => `${c.identificador} (${c.natureza.replace(/_/g, ' ')}): ${c.descricaoContextual}`),
      },
      recomendacoes: {
        itens: d.recomendacoes.map(
          (r) =>
            `${r.identificador} [${ROTULOS_HIERARQUIA[r.hierarquiaControle]}] ${r.acaoProposta} — ` +
            `responsável: ${r.responsavel ?? 'NÃO DEFINIDO'}; prazo: ${r.prazo ?? 'NÃO DEFINIDO'}; ` +
            `eficácia: ${r.indicadores[0]?.meta ?? 'NÃO DEFINIDA'}; risco residual: ${r.riscoResidual ?? 'NÃO DEFINIDO'}`,
        ),
      },
      lacunas: {
        itens: d.lacunas.map((l) => `${l.identificador} (${l.criticidade}, ${l.status}): ${l.descricao}`),
      },
      divergencias: {
        itens: d.comentarios.filter((c) => c.tipo === 'opiniao_divergente').map((c) => c.texto),
      },
      aprovacoes: {
        itens: d.aprovacoes.map((a) => `${a.tipo}: ${a.decisao}`),
      },
      anexos: {
        itens: d.evidencias.map((e) => `${e.identificador} — ${e.titulo}`),
      },
      notificacao: { itens: [] },
      consequencias: { itens: [] },
      acoes_imediatas: { itens: [] },
    };

    const secoes: SecaoRelatorio[] = ESTRUTURA.map(({ id, titulo }) => {
      const bloco = conteudoPorSecao[id] ?? { itens: [] };
      const itens = bloco.itens;
      const vazia = itens.length === 0 && !bloco.conteudo;
      return {
        id,
        titulo,
        conteudo: bloco.conteudo ?? (vazia ? SEM_REGISTRO : ''),
        vazia,
        itens,
        citacoes: id === 'fontes' || id === 'anexos'
          ? d.evidencias.map((e) => ({ evidenciaId: e.id, localizador: e.identificador, fatoId: null }))
          : [],
      };
    });

    const contribuicoesIa = [
      ...d.fatos.filter((f) => f.origemIa).map((f) => `Fato ${f.identificador} teve origem em sugestão de IA.`),
      ...d.classificacoes
        .filter((c) => c.origemIa)
        .map(
          (c) =>
            `Fator ${c.identificador} (${c.codigo}) teve origem em sugestão de IA; decisão humana: ${c.decisaoHumana}.`,
        ),
    ];

    const base = baseAnalitica(
      `Relatório compilado com ${secoes.length} seções (${secoes.filter((s) => s.vazia).length} sem registro). ` +
        `${qualidade.bloqueios} bloqueio(s) impedem a publicação.`,
      'inferencia',
    );

    return {
      ...base,
      tipo: 'inferencia' as const,
      secoes,
      contagens: contagens as unknown as Record<string, number | Record<string, number>>,
      bloqueiosParaPublicacao: qualidade.ocorrencias
        .filter((o) => o.severidade === 'bloqueio')
        .map((o) => `${o.regra}: ${o.mensagem}`),
      contribuicoesIa,
      confianca: 'media' as const,
      premissas: [
        'Todo conteúdo vem dos registros da investigação; nenhuma seção foi preenchida por geração livre.',
        entrada.modoIdentificado
          ? 'Modo identificado autorizado: nomes reais podem aparecer.'
          : 'Modo pseudonimizado: envolvidos são referidos por função ou pseudônimo.',
      ],
      limitacoes: [
        'O sumário executivo e as conclusões são esqueletos factuais e exigem redação e assinatura humanas.',
        'Seções marcadas como "sem registro" indicam ausência de dado, não ausência do fenômeno.',
      ],
      proximas_diligencias: qualidade.ocorrencias
        .filter((o) => o.severidade === 'bloqueio')
        .map((o) => o.mensagem)
        .slice(0, 10),
      requer_validacao_humana: true as const,
    };
  },
};

/** Renderiza o relatório compilado como Markdown, para exportação. */
export function renderizarMarkdown(resposta: RespostaRelatorio, titulo: string): string {
  const linhas: string[] = [`# ${titulo}`, ''];
  if (resposta.contribuicoesIa.length > 0) {
    linhas.push(
      '> **Contribuições de IA nesta versão:**',
      ...resposta.contribuicoesIa.map((c) => `> - ${c}`),
      '',
    );
  }
  for (const s of resposta.secoes) {
    linhas.push(`## ${s.titulo}`, '');
    if (s.conteudo) linhas.push(s.conteudo, '');
    for (const item of s.itens) linhas.push(`- ${item}`);
    if (s.itens.length > 0) linhas.push('');
  }
  if (resposta.bloqueiosParaPublicacao.length > 0) {
    linhas.push(
      '## Bloqueios de qualidade em aberto',
      '',
      ...resposta.bloqueiosParaPublicacao.map((b) => `- ${b}`),
      '',
    );
  }
  return linhas.join('\n');
}

export const ROTULOS_COLUNA = ROTULOS_COLUNA_ICAM;
