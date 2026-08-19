import { z } from 'zod';
import { HIERARQUIAS, type Hierarquia } from './codigos';
import { extrairJson, gerarJson, obterChave } from './gemini';

/**
 * Proposta de ações para os achados que exigem tratamento.
 *
 * A IA redige um ponto de partida; quem responde pela ação é sempre pessoa. Por
 * isso executante, matrícula e prazo saem em branco ou como sugestão editável:
 * ação sem dono e sem data não é plano, é intenção.
 *
 * A hierarquia de controle vem junto de propósito. Sem ela, plano de ação vira
 * lista de treinamentos e avisos — os dois controles mais fracos e os mais
 * fáceis de escrever.
 */

export interface AchadoParaTratar {
  itemId: string;
  codigo: string;
  titulo: string;
  constatacao: string;
}

export interface AcaoProposta {
  itemId: string;
  causaPadrao: string;
  acao: string;
  hierarquia: Hierarquia;
  justificativa: string;
  executante: string;
  matricula: string;
  prazo: string;
  origem: 'gemini' | 'local';
}

export interface ResultadoAcoes {
  acoes: AcaoProposta[];
  origem: 'gemini' | 'local';
  modelo: string | null;
  avisos: string[];
}

const respostaAcoes = z.object({
  acoes: z.array(
    z.object({
      id: z.string(),
      acao: z.string().min(1),
      hierarquia: z.string(),
      justificativa: z.string().default(''),
      prazoDias: z.number().int().positive().max(365).default(60),
    }),
  ),
});

const INSTRUCAO = [
  'Você propõe ações corretivas para achados de uma investigação de incidente conduzida',
  'pela metodologia ICAM.',
  '',
  'REGRAS INEGOCIÁVEIS:',
  '1. Uma ação por achado, começando por verbo no infinitivo, concreta e verificável.',
  '   "Instalar sinalização vertical de proibição de ultrapassagem no trecho X" serve.',
  '   "Conscientizar a equipe" não serve: não é verificável nem tem fim.',
  '2. A ação precisa atacar o mecanismo do achado, não a pessoa envolvida. Nada de',
  '   advertência, punição ou "reforçar atenção".',
  '3. Prefira o controle mais forte que resolva: eliminação, substituição e engenharia',
  '   antes de administrativo e EPI. Só use administrativo ou EPI quando os de cima',
  '   forem inviáveis, e diga na justificativa por quê.',
  '4. Não invente nome de pessoa, matrícula, área, sistema ou documento.',
  '5. prazoDias: prazo realista em dias corridos a partir de hoje.',
  '6. Responda SOMENTE com JSON válido, sem texto antes ou depois e sem cercas de código.',
].join('\n');

const FORMATO = `{
  "acoes": [
    {
      "id": "<id do achado, exatamente como recebido>",
      "acao": "<ação começando por verbo no infinitivo>",
      "hierarquia": "Eliminação | Substituição | Engenharia | Administrativo | EPI",
      "justificativa": "<por que este nível de controle, e não um mais forte>",
      "prazoDias": 60
    }
  ]
}`;

export interface OpcoesAcoes {
  chaveApi?: string;
  modelo?: string;
  contexto?: string;
  tempoLimiteMs?: number;
  /** Data base do prazo. Explícita para o teste não depender do relógio. */
  hoje?: Date;
  /** Autoriza o rascunho local. Só quando a pessoa pedir, sabendo o que é. */
  permitirLocal?: boolean;
}

export async function proporAcoes(
  achados: AchadoParaTratar[],
  opcoes: OpcoesAcoes = {},
): Promise<ResultadoAcoes> {
  if (achados.length === 0) {
    return { acoes: [], origem: 'local', modelo: null, avisos: ['Nenhum achado exige ação.'] };
  }

  if (opcoes.permitirLocal && !(opcoes.chaveApi ?? process.env.GEMINI_API_KEY)) {
    return {
      acoes: achados.map((a) => acaoLocal(a, opcoes.hoje)),
      origem: 'local',
      modelo: null,
      avisos: [
        'Modo local, a pedido: o que sai é a estrutura da ação, não a ação. Reescreva cada linha.',
      ],
    };
  }

  // Sem chave, lança. Quem chama transforma em mensagem com o que fazer.
  const chave = obterChave(opcoes.chaveApi);

  const tarefa = [
    opcoes.contexto ? `CONTEXTO DO EVENTO:\n${opcoes.contexto}\n` : '',
    'ACHADOS QUE EXIGEM AÇÃO:',
    ...achados.map((a) => `${a.itemId} | ${a.codigo} – ${a.titulo} | ${a.constatacao}`),
  ].join('\n');

  const resposta = await gerarJson({
    chaveApi: chave,
    instrucao: INSTRUCAO,
    formato: FORMATO,
    tarefa,
    modelo: opcoes.modelo,
    tempoLimiteMs: opcoes.tempoLimiteMs,
  });

  const analise = respostaAcoes.safeParse(extrairJson(resposta.texto));
  if (!analise.success) {
    throw new Error('O Gemini respondeu fora do formato combinado. Tente de novo.');
  }

  const avisos = [...resposta.avisos];
  const porId = new Map(achados.map((a) => [a.itemId, a]));
  const acoes: AcaoProposta[] = [];

  for (const proposta of analise.data.acoes) {
    const achado = porId.get(proposta.id);
    if (!achado) continue;
    acoes.push({
      itemId: achado.itemId,
      causaPadrao: `${achado.codigo} – ${achado.titulo} - ${achado.constatacao}`,
      acao: proposta.acao.trim(),
      hierarquia: normalizarHierarquia(proposta.hierarquia),
      justificativa: proposta.justificativa.trim(),
      executante: '',
      matricula: '',
      prazo: emDias(proposta.prazoDias, opcoes.hoje),
      origem: 'gemini',
    });
  }

  for (const achado of achados) {
    if (!acoes.some((a) => a.itemId === achado.itemId)) {
      acoes.push(acaoLocal(achado, opcoes.hoje));
      avisos.push(`O modelo não propôs ação para ${achado.codigo}; ficou o rascunho local.`);
    }
  }

  return { acoes, origem: 'gemini', modelo: resposta.modelo, avisos };
}

function normalizarHierarquia(valor: string): Hierarquia {
  const n = valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  const achado = HIERARQUIAS.find(
    (h) =>
      h
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase() === n,
  );
  // Sem correspondência, cai no controle mais fraco de propósito: assim o
  // exagero aparece na revisão em vez de passar como engenharia.
  return achado ?? 'Administrativo';
}

export function emDias(dias: number, hoje = new Date()): string {
  const data = new Date(hoje);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

/**
 * Rascunho local: estrutura, não análise.
 *
 * Não tenta escrever a ação — escreve o que precisa ser decidido. Frase
 * plausível gerada por casamento de palavras seria pior do que campo em
 * branco, porque parece pronta.
 */
function acaoLocal(achado: AchadoParaTratar, hoje?: Date): AcaoProposta {
  return {
    itemId: achado.itemId,
    causaPadrao: `${achado.codigo} – ${achado.titulo} - ${achado.constatacao}`,
    acao: `Definir a ação que corrige: ${achado.titulo.toLowerCase()}`,
    hierarquia: 'Administrativo',
    justificativa: 'Rascunho sem análise. Avalie se um controle de engenharia resolve antes de manter administrativo.',
    executante: '',
    matricula: '',
    prazo: emDias(60, hoje),
    origem: 'local',
  };
}
