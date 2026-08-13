import { DIMENSOES_PEEPO, ROTULOS_PEEPO, type DimensaoPeepo } from '../domain/enumeracoes';
import { respostaPeepo, type RespostaPeepo, type RespostaPergunta } from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';

/**
 * Agente 5 — Planejamento PEEPO e entrevistas.
 *
 * Cobre duas responsabilidades da seção 4.3 e 4.5:
 *   - apontar dimensões PEEPO sem cobertura e propor itens de coleta;
 *   - gerar perguntas abertas, neutras e não indutivas, sempre ancoradas em
 *     uma lacuna, hipótese ou conflito concreto.
 */

export interface EntradaPeepo {
  descricaoEvento: string;
  itensExistentes: { dimensao: DimensaoPeepo; status: string }[];
  lacunas: { id: string; descricao: string; criticidade: string }[];
  hipoteses: { id: string; enunciado: string; estado: string }[];
  conflitos: { id: string; titulo: string; status: string }[];
}

/** Perguntas estruturais por dimensão. São perguntas de COLETA, não de culpa. */
const PERGUNTAS_BASE: Record<DimensaoPeepo, { pergunta: string; evidencia: string }[]> = {
  pessoas: [
    {
      pergunta: 'Quem estava envolvido na tarefa, em que função, e qual era a expectativa de trabalho definida?',
      evidencia: 'Escala de turno, designação da tarefa, descrição de função, registro de treinamento.',
    },
    {
      pergunta: 'Qual era a jornada, o padrão de turno e o histórico de horas nos dias anteriores?',
      evidencia: 'Registro de ponto e escala. Acesso restrito: dado de jornada é sensível.',
    },
    {
      pergunta: 'Quais informações a equipe tinha no momento da decisão, e quais não tinha?',
      evidencia: 'Passagem de turno, comunicações, alarmes ativos, ordens em aberto.',
    },
  ],
  ambiente: [
    {
      pergunta: 'Quais eram as condições do local no momento do evento (piso, gradiente, visibilidade, tempo, iluminação, ruído)?',
      evidencia: 'Registro meteorológico, fotos do local, medições, levantamento topográfico.',
    },
    {
      pergunta: 'O local foi preservado após o evento e por quanto tempo?',
      evidencia: 'Registro de isolamento, fotos com horário, termo de liberação da área.',
    },
  ],
  equipamentos: [
    {
      pergunta: 'Qual era a condição do equipamento, e o que os registros de manutenção mostram nos períodos anterior e posterior?',
      evidencia: 'Ordens de manutenção, notas, histórico de falhas, inspeções, laudos.',
    },
    {
      pergunta: 'Quais parâmetros estavam configurados no sistema, e como se comparam ao valor especificado em projeto ou procedimento?',
      evidencia: 'Print de configuração, memória de parâmetros, especificação de projeto.',
    },
    {
      pergunta: 'Havia alarmes, bloqueios ou intertravamentos ativos, inibidos ou recorrentes?',
      evidencia: 'Log de alarmes, registro de bypass, histórico de eventos do controlador.',
    },
  ],
  procedimentos: [
    {
      pergunta: 'Qual procedimento se aplicava, em qual revisão, e ele estava disponível e adequado à tarefa real?',
      evidencia: 'Procedimento vigente com data de revisão, evidência de disponibilidade no local.',
    },
    {
      pergunta: 'Havia permissão de trabalho, análise de risco da tarefa ou equivalente, e o que registraram?',
      evidencia: 'PT, APR/AST, registro de análise pré-tarefa.',
    },
    {
      pergunta: 'Qual era a diferença entre o trabalho como imaginado e o trabalho como realizado normalmente?',
      evidencia: 'Observação de campo, entrevistas com outras equipes, práticas informais documentadas.',
    },
  ],
  organizacao: [
    {
      pergunta: 'Houve eventos, alarmes ou desvios semelhantes antes, e o que a organização fez com essa informação?',
      evidencia: 'Histórico de ocorrências, ações anteriores, registros de aprendizagem organizacional.',
    },
    {
      pergunta: 'Quais decisões de projeto, recursos, prioridades ou metas moldaram as condições locais da tarefa?',
      evidencia: 'Documentos de projeto, orçamento de manutenção, metas de produção, atas de decisão.',
    },
    {
      pergunta: 'Como a gestão de mudanças tratou alterações de equipamento, processo, pessoal ou contrato relacionadas?',
      evidencia: 'Registros de MOC, análises de mudança, comunicação às equipes.',
    },
  ],
};

/** Padrões que tornam a pergunta indutiva ou culpabilizadora. */
const PADROES_INDUTIVOS: { expressao: RegExp; alerta: string }[] = [
  {
    expressao: /\bpor\s+que\s+voc[êe]\s+(n[ãa]o\s+)?/i,
    alerta: 'Pergunta iniciada com "por que você" tende a soar acusatória. Prefira "o que aconteceu" ou "como foi".',
  },
  {
    expressao: /\bn[ãa]o\s+[ée]\s+verdade\s+que\b|\bvoc[êe]\s+(concorda|admite)\b/i,
    alerta: 'Pergunta indutiva: sugere a resposta esperada.',
  },
  {
    expressao: /\bdescuido|neglig[êe]ncia|falta\s+de\s+aten[çc][ãa]o|culpa\b/i,
    alerta: 'Termo culpabilizador na pergunta.',
  },
  {
    expressao: /^\s*(voc[êe]|o\s+senhor|a\s+senhora)\s+\w+\s*\?\s*$/i,
    alerta: 'Pergunta fechada (sim/não). Prefira pergunta aberta.',
  },
];

export function avaliarPergunta(pergunta: string): string | null {
  for (const p of PADROES_INDUTIVOS) {
    if (p.expressao.test(pergunta)) return p.alerta;
  }
  return null;
}

export const agentePeepo: DefinicaoAgente<EntradaPeepo, RespostaPeepo> = {
  nome: 'peepo',
  esquemaSaida: respostaPeepo,

  instrucao: [
    'Você é o agente de planejamento PEEPO e entrevistas de uma plataforma ICAM.',
    'PEEPO = Pessoas, Ambiente, Equipamentos, Procedimentos, Organização.',
    '',
    'Gere itens de coleta e perguntas de entrevista que sejam:',
    '- abertas, neutras e não indutivas;',
    '- ancoradas em uma lacuna, hipótese ou conflito concreto;',
    '- voltadas a entender condições e sistema, nunca a atribuir culpa.',
    'Distinga sempre memória, percepção e inferência do entrevistado.',
  ].join('\n'),

  formatoEsperado: [
    '{ "resposta": "...", "tipo": "hipotese",',
    '  "itens": [{"dimensao":"equipamentos","perguntaInvestigativa":"...","evidenciaEsperada":"...",',
    '    "prioridade":"alta","vinculo":{"tipo":"lacuna","id":"..."}}],',
    '  "perguntasEntrevista": [{"pergunta":"...","objetivo":"...","origem":"lacuna",',
    '    "origemId":"...","alertaIndutiva":null}],',
    '  "coberturaPorDimensao": {"pessoas":0.5},',
    '  "evidencias_favoraveis": [], "evidencias_contrarias": [], "citacoes": [],',
    '  "premissas": [], "confianca": "media", "limitacoes": [],',
    '  "proximas_diligencias": [], "requer_validacao_humana": true }',
  ].join('\n'),

  montarTarefa(e) {
    return [
      `Evento: ${e.descricaoEvento}`,
      `Itens de coleta existentes: ${e.itensExistentes.length}`,
      `Lacunas abertas: ${e.lacunas.length}; hipóteses: ${e.hipoteses.length}; conflitos: ${e.conflitos.length}`,
      'Proponha itens PEEPO para as dimensões descobertas e perguntas de entrevista neutras.',
    ].join('\n');
  },

  heuristica(entrada) {
    const cobertura: Record<string, number> = {};
    const itens: RespostaPeepo['itens'] = [];

    for (const dim of DIMENSOES_PEEPO) {
      const daDimensao = entrada.itensExistentes.filter((i) => i.dimensao === dim);
      const coletados = daDimensao.filter((i) => i.status === 'coletado').length;
      cobertura[dim] = daDimensao.length === 0 ? 0 : coletados / daDimensao.length;

      if (coletados > 0) continue;

      const base = PERGUNTAS_BASE[dim];
      for (const p of base) {
        itens.push({
          dimensao: dim,
          perguntaInvestigativa: p.pergunta,
          evidenciaEsperada: p.evidencia,
          prioridade: daDimensao.length === 0 ? 'alta' : 'media',
          vinculo: { tipo: 'nenhum', id: null },
        });
      }
    }

    // Itens derivados de lacunas e conflitos concretos.
    for (const l of entrada.lacunas) {
      itens.push({
        dimensao: inferirDimensao(l.descricao),
        perguntaInvestigativa: `Que evidência resolveria a lacuna: ${l.descricao}?`,
        evidenciaEsperada: 'A definir conforme a fonte disponível.',
        prioridade: l.criticidade === 'critica' ? 'critica' : l.criticidade === 'alta' ? 'alta' : 'media',
        vinculo: { tipo: 'lacuna', id: l.id },
      });
    }

    const perguntas: RespostaPergunta[] = [];
    for (const h of entrada.hipoteses.filter((x) => x.estado === 'aberta')) {
      const pergunta = `Descreva, com o máximo de detalhe possível, o que você observou em relação a: ${h.enunciado}`;
      perguntas.push({
        pergunta,
        objetivo: 'Obter relato factual que sustente ou enfraqueça a hipótese, sem antecipá-la ao entrevistado.',
        origem: 'hipotese',
        origemId: h.id,
        alertaIndutiva: avaliarPergunta(pergunta),
      });
    }
    for (const c of entrada.conflitos.filter((x) => x.status !== 'resolvido')) {
      const pergunta = `Conte como foi, do início ao fim, a parte da tarefa relacionada a: ${c.titulo}`;
      perguntas.push({
        pergunta,
        objetivo:
          'Coletar a versão do entrevistado sem confrontá-lo com a outra fonte, preservando as duas versões.',
        origem: 'conflito',
        origemId: c.id,
        alertaIndutiva: avaliarPergunta(pergunta),
      });
    }
    perguntas.push(
      {
        pergunta: 'O que aconteceu, na ordem em que você percebeu?',
        objetivo: 'Estabelecer a sequência conforme a memória do entrevistado.',
        origem: 'exploratoria',
        origemId: null,
        alertaIndutiva: null,
      },
      {
        pergunta: 'O que você viu diretamente, o que você deduziu depois e o que soube por outra pessoa?',
        objetivo: 'Separar memória, inferência e informação de terceiro.',
        origem: 'exploratoria',
        origemId: null,
        alertaIndutiva: null,
      },
      {
        pergunta: 'Nas vezes em que essa tarefa transcorre normalmente, como ela costuma acontecer?',
        objetivo: 'Compreender o trabalho como realizado, e não apenas como prescrito.',
        origem: 'exploratoria',
        origemId: null,
        alertaIndutiva: null,
      },
      {
        pergunta: 'O que teria tornado essa situação mais fácil ou mais segura para quem executa?',
        objetivo: 'Identificar condições e defesas ausentes sem induzir autoculpabilização.',
        origem: 'exploratoria',
        origemId: null,
        alertaIndutiva: null,
      },
    );

    const descobertas = DIMENSOES_PEEPO.filter((d) => (cobertura[d] ?? 0) === 0);
    const base = baseAnalitica(
      descobertas.length > 0
        ? `Dimensões PEEPO sem coleta concluída: ${descobertas.map((d) => ROTULOS_PEEPO[d]).join(', ')}. ${itens.length} item(ns) de coleta proposto(s).`
        : `Todas as dimensões PEEPO têm ao menos um item coletado. ${itens.length} item(ns) adicional(is) proposto(s).`,
      'hipotese',
    );

    return {
      ...base,
      tipo: 'hipotese' as const,
      itens,
      perguntasEntrevista: perguntas,
      coberturaPorDimensao: cobertura,
      confianca: 'media' as const,
      premissas: ['A cobertura é calculada apenas sobre os itens já registrados no plano.'],
      limitacoes: [
        'As perguntas são um ponto de partida estrutural e não substituem o roteiro do facilitador.',
        'Itens propostos não são criados automaticamente: exigem aceite do investigador.',
      ],
      proximas_diligencias: descobertas.map(
        (d) => `Planejar e executar a coleta da dimensão "${ROTULOS_PEEPO[d]}".`,
      ),
      requer_validacao_humana: true as const,
    };
  },
};

function inferirDimensao(texto: string): DimensaoPeepo {
  const t = texto.toLowerCase();
  if (/equipament|m[áa]quina|ve[íi]culo|caminh|sensor|alarme|par[âa]metro|manuten/.test(t)) {
    return 'equipamentos';
  }
  if (/procedimento|permiss|apr|ast|instru[çc]|checklist|norma/.test(t)) return 'procedimentos';
  if (/clima|piso|ilumina|ru[íi]do|visibilidade|terreno|rampa|acesso|tempo/.test(t)) return 'ambiente';
  if (/gest[ãa]o|decis|recurso|meta|treinamento corporativo|contrato|governan/.test(t)) {
    return 'organizacao';
  }
  return 'pessoas';
}
