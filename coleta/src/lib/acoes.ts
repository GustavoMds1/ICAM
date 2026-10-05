import { z } from 'zod';
import { HIERARQUIAS, obterCodigo, type Hierarquia } from './codigos';
import { geminiLigado } from './classificacao';
import { emLotes, explicarFormato, extrairJson, gerarJson, obterChave } from './gemini';

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
  /** Força o Gemini mesmo com ele em espera. */
  usarGemini?: boolean;
}

export async function proporAcoes(
  achados: AchadoParaTratar[],
  opcoes: OpcoesAcoes = {},
): Promise<ResultadoAcoes> {
  if (achados.length === 0) {
    return { acoes: [], origem: 'local', modelo: null, avisos: ['Nenhum achado exige ação.'] };
  }

  if (!geminiLigado(opcoes)) {
    return {
      acoes: achados.map((a) => acaoLocal(a, opcoes.hoje)),
      origem: 'local',
      modelo: 'rascunho local',
      avisos: [
        'Com o Gemini em espera, o que sai aqui é o esqueleto da ação — o verbo e a hierarquia vêm do tipo do achado, não de análise. Reescreva cada linha antes de apresentar.',
      ],
    };
  }

  // Sem chave, lança. Quem chama transforma em mensagem com o que fazer.
  const chave = obterChave(opcoes.chaveApi);

  const montarTarefa = (lote: typeof achados) =>
    [
      opcoes.contexto ? `CONTEXTO DO EVENTO:\n${opcoes.contexto}\n` : '',
      'ACHADOS QUE EXIGEM AÇÃO:',
      ...lote.map((a) => `${a.itemId} | ${a.codigo} – ${a.titulo} | ${a.constatacao}`),
    ].join('\n');

  // Mesmo motivo da classificação: ação redigida é texto longo, e cinquenta
  // delas numa resposta só estouram o teto de saída do modelo.
  const lotes = emLotes(achados);

  const respostas = await Promise.all(
    lotes.map((lote) =>
      gerarJson({
        chaveApi: chave,
        instrucao: INSTRUCAO,
        formato: FORMATO,
        tarefa: montarTarefa(lote),
        modelo: opcoes.modelo,
        tempoLimiteMs: opcoes.tempoLimiteMs,
      }),
    ),
  );

  const propostas: z.infer<typeof respostaAcoes>['acoes'] = [];
  const avisosBrutos: string[] = [];

  respostas.forEach((resposta, indice) => {
    const analise = respostaAcoes.safeParse(extrairJson(resposta.texto));
    if (!analise.success) {
      throw new Error(
        explicarFormato(analise.error.issues, resposta.texto, lotes[indice]?.length ?? 0),
      );
    }
    propostas.push(...analise.data.acoes);
    avisosBrutos.push(...resposta.avisos);
  });

  const avisos = [...new Set(avisosBrutos)];

  // Lotes podem cair em modelos diferentes, se um deles precisou de
  // alternativa por sobrecarga. Mostrar todos é mais honesto que escolher um.
  const modeloUsado = [...new Set(respostas.map((r) => r.modelo))].join(', ');
  const porId = new Map(achados.map((a) => [a.itemId, a]));
  const acoes: AcaoProposta[] = [];

  for (const proposta of propostas) {
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

  return { acoes, origem: 'gemini', modelo: modeloUsado, avisos };
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
 * Esqueleto da ação por tipo de achado.
 *
 * O verbo e o ponto de partida da hierarquia saem da coluna ICAM do código —
 * barreira que falhou pede restabelecer a barreira; fator organizacional pede
 * mexer no sistema de gestão. É orientação de forma, não análise, e o texto
 * diz isso a quem for editar.
 *
 * Não se tenta redigir a ação por casamento de palavras. Frase plausível e
 * vazia é pior do que campo à espera, porque parece pronta e passa.
 */
const MOLDE_POR_COLUNA: Record<string, { verbo: string; hierarquia: Hierarquia; nota: string }> = {
  defesas: {
    verbo: 'Restabelecer e verificar a barreira que falhou em',
    hierarquia: 'Engenharia',
    nota: 'Barreira ausente ou falha costuma pedir controle de engenharia. Só desça para administrativo se a barreira física for inviável, e registre por quê.',
  },
  acoes: {
    verbo: 'Tratar a condição que levou à decisão em',
    hierarquia: 'Engenharia',
    nota: 'Ação individual quase nunca se corrige com aviso. Procure o que tornou a decisão possível ou provável.',
  },
  condicoes: {
    verbo: 'Corrigir a condição de',
    hierarquia: 'Engenharia',
    nota: 'Condição de tarefa ou ambiente é o terreno natural da eliminação e da engenharia.',
  },
  organizacionais: {
    verbo: 'Revisar o processo de gestão de',
    hierarquia: 'Administrativo',
    nota: 'Fator organizacional se trata mudando o sistema de gestão; administrativo aqui é o nível certo, não o atalho.',
  },
};

function acaoLocal(achado: AchadoParaTratar, hoje?: Date): AcaoProposta {
  const coluna = obterCodigo(achado.codigo)?.coluna ?? 'organizacionais';
  const molde = MOLDE_POR_COLUNA[coluna] ?? MOLDE_POR_COLUNA.organizacionais!;

  return {
    itemId: achado.itemId,
    causaPadrao: `${achado.codigo} – ${achado.titulo} - ${achado.constatacao}`,
    acao: `${molde.verbo} ${achado.titulo.toLowerCase()} — descreva aqui a ação concreta e verificável`,
    hierarquia: molde.hierarquia,
    justificativa: `Esqueleto por tipo de achado, não análise. ${molde.nota}`,
    executante: '',
    matricula: '',
    prazo: emDias(60, hoje),
    origem: 'local',
  };
}
