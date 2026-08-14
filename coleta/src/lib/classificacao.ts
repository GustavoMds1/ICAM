import { z } from 'zod';
import {
  catalogoParaPrompt,
  CODIGOS,
  NIVEIS_VALIDOS,
  normalizarCodigo,
  obterCodigo,
  type CodigoIcam,
  type NivelIcam,
} from './codigos';
import type { ItemColetado } from './pptxLeitura';

/**
 * Associação de códigos ICAM às constatações.
 *
 * Duas implementações atrás do mesmo contrato:
 *
 *   Gemini  — quando há GEMINI_API_KEY. Recebe o catálogo inteiro e devolve
 *             JSON validado. Código fora do catálogo é descartado, não
 *             "corrigido" por aproximação.
 *   local   — casamento por palavra do título e da definição do código. Sem
 *             chave, sem rede e sem custo. É mais pobre, e a interface diz
 *             isso na cara de quem usa em vez de fingir que é a mesma coisa.
 *
 * O nível (causa raiz, fator contribuinte, fato constatado) é sempre proposta.
 * Nada vai para o slide sem passar pela revisão.
 */

export interface Sugestao {
  itemId: string;
  codigo: string;
  titulo: string;
  nivel: NivelIcam;
  justificativa: string;
  confianca: 'baixa' | 'media' | 'alta';
  /** Códigos próximos que o classificador considerou e descartou. */
  alternativas: { codigo: string; titulo: string }[];
  origem: 'gemini' | 'local';
}

export interface ResultadoClassificacao {
  sugestoes: Sugestao[];
  origem: 'gemini' | 'local';
  modelo: string | null;
  avisos: string[];
}

export const MODELO_PADRAO_GEMINI = 'gemini-3.6-flash';

const respostaGemini = z.object({
  classificacoes: z.array(
    z.object({
      id: z.string(),
      codigo: z.string(),
      nivel: z.string(),
      justificativa: z.string().default(''),
      confianca: z.string().default('media'),
      alternativas: z.array(z.string()).default([]),
    }),
  ),
});

const INSTRUCAO = [
  'Você associa códigos da metodologia ICAM a constatações de uma investigação de incidente.',
  '',
  'REGRAS INEGOCIÁVEIS:',
  '1. Escolha SOMENTE códigos da lista fornecida. Não invente código, título nem sigla.',
  '2. Semelhança de palavras não classifica. O código escolhido precisa descrever o',
  '   mecanismo pelo qual aquilo contribuiu para o evento.',
  '3. Não atribua culpa a pessoa. Não infira fadiga, uso de substância, condição de saúde',
  '   ou problema pessoal a partir de comportamento, linguagem ou aparência.',
  '4. Nível: use "raiz" apenas para falha sistêmica da organização que, removida, teria',
  '   evitado o evento; "contribuinte" para o que aumentou a chance ou a gravidade;',
  '   "constatado" para fato verificado sem juízo causal. Na dúvida, use "constatado".',
  '5. Se nenhum código descrever bem a constatação, use o código genérico "Outro fator" do',
  '   grupo mais próximo e explique na justificativa.',
  '6. Responda SOMENTE com JSON válido, sem texto antes ou depois e sem cercas de código.',
].join('\n');

const FORMATO = `{
  "classificacoes": [
    {
      "id": "<id do item, exatamente como recebido>",
      "codigo": "<código do catálogo, ex.: HF21>",
      "nivel": "raiz | contribuinte | constatado",
      "justificativa": "<uma frase ligando a constatação ao código>",
      "confianca": "baixa | media | alta",
      "alternativas": ["<código descartado>", "<outro>"]
    }
  ]
}`;

export interface OpcoesClassificacao {
  chaveApi?: string;
  modelo?: string;
  /** Contexto do evento, para o modelo não classificar frases soltas. */
  contexto?: string;
  tempoLimiteMs?: number;
}

export async function classificar(
  itens: ItemColetado[],
  opcoes: OpcoesClassificacao = {},
): Promise<ResultadoClassificacao> {
  const alvos = itens.filter((i) => i.tipo === 'constatacao');
  if (alvos.length === 0) {
    return { sugestoes: [], origem: 'local', modelo: null, avisos: ['Nenhuma constatação para classificar.'] };
  }

  const chave = opcoes.chaveApi ?? process.env.GEMINI_API_KEY ?? '';
  if (!chave) {
    return {
      sugestoes: alvos.map(classificarLocalmente),
      origem: 'local',
      modelo: null,
      avisos: [
        'GEMINI_API_KEY não configurada: a associação foi feita por semelhança de palavras, no próprio servidor. Confira cada código com atenção redobrada.',
      ],
    };
  }

  try {
    const resultado = await chamarGemini(alvos, chave, opcoes);
    return resultado;
  } catch (e) {
    // Falha do provedor não trava o trabalho: cai para o modo local e diz por quê.
    return {
      sugestoes: alvos.map(classificarLocalmente),
      origem: 'local',
      modelo: null,
      avisos: [
        `A chamada ao Gemini falhou (${e instanceof Error ? e.message : 'erro desconhecido'}). A associação abaixo veio do modo local.`,
      ],
    };
  }
}

async function chamarGemini(
  itens: ItemColetado[],
  chaveApi: string,
  opcoes: OpcoesClassificacao,
): Promise<ResultadoClassificacao> {
  const modelo = opcoes.modelo ?? process.env.MODELO_IA ?? MODELO_PADRAO_GEMINI;
  const limite = opcoes.tempoLimiteMs ?? 90_000;

  const tarefa = [
    opcoes.contexto ? `CONTEXTO DO EVENTO:\n${opcoes.contexto}\n` : '',
    'CATÁLOGO (codigo|coluna|título):',
    catalogoParaPrompt(),
    '',
    'CONSTATAÇÕES A CLASSIFICAR:',
    ...itens.map((i) => `${i.id} [${i.categoria}] ${i.texto}`),
  ].join('\n');

  const abortador = new AbortController();
  const relogio = setTimeout(() => abortador.abort(), limite);

  try {
    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': chaveApi },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${INSTRUCAO}\n\nFORMATO ESPERADO:\n${FORMATO}` }] },
          contents: [{ role: 'user', parts: [{ text: tarefa }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 8192 },
        }),
        signal: abortador.signal,
      },
    );

    if (!resposta.ok) {
      const detalhe = (await resposta.text().catch(() => '')).slice(0, 300);
      throw new Error(`HTTP ${resposta.status}${detalhe ? `: ${detalhe}` : ''}`);
    }

    const corpo = (await resposta.json()) as Record<string, unknown>;
    const candidatos = Array.isArray(corpo.candidates) ? (corpo.candidates as Record<string, unknown>[]) : [];
    const conteudo = (candidatos[0]?.content ?? {}) as Record<string, unknown>;
    const partes = Array.isArray(conteudo.parts) ? (conteudo.parts as Record<string, unknown>[]) : [];
    const bruto = partes.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');

    const analise = respostaGemini.safeParse(extrairJson(bruto));
    if (!analise.success) {
      throw new Error('a resposta não veio no formato combinado');
    }

    const avisos: string[] = [];
    const sugestoes: Sugestao[] = [];
    const porId = new Map(itens.map((i) => [i.id, i]));

    for (const c of analise.data.classificacoes) {
      const item = porId.get(c.id);
      if (!item) continue;

      const codigo = obterCodigo(c.codigo);
      if (!codigo) {
        // Código fora do catálogo é descarte, não aproximação: inventar sigla
        // é exatamente o erro que a metodologia não tolera.
        avisos.push(`O código "${c.codigo}" não existe no catálogo e foi descartado (item ${item.id}).`);
        sugestoes.push(classificarLocalmente(item));
        continue;
      }

      sugestoes.push({
        itemId: item.id,
        codigo: codigo.codigo,
        titulo: codigo.titulo,
        nivel: normalizarNivel(c.nivel),
        justificativa: c.justificativa.trim(),
        confianca: normalizarConfianca(c.confianca),
        alternativas: c.alternativas
          .map((a) => obterCodigo(a))
          .filter((a): a is CodigoIcam => a !== null)
          .slice(0, 3)
          .map((a) => ({ codigo: a.codigo, titulo: a.titulo })),
        origem: 'gemini',
      });
    }

    // Item que o modelo ignorou não pode sumir da revisão.
    for (const item of itens) {
      if (!sugestoes.some((s) => s.itemId === item.id)) {
        sugestoes.push(classificarLocalmente(item));
        avisos.push(`O modelo não classificou o item ${item.id}; foi usada a associação local.`);
      }
    }

    return { sugestoes, origem: 'gemini', modelo, avisos };
  } finally {
    clearTimeout(relogio);
  }
}

function normalizarNivel(valor: string): NivelIcam {
  const n = valor.toLowerCase().trim();
  const achado = NIVEIS_VALIDOS.find((x) => n.startsWith(x));
  return achado ?? 'constatado';
}

function normalizarConfianca(valor: string): 'baixa' | 'media' | 'alta' {
  const n = valor.toLowerCase().trim();
  return n === 'alta' || n === 'baixa' ? n : 'media';
}

export function extrairJson(texto: string): unknown {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio >= 0 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Classificador local
// ---------------------------------------------------------------------------

const IRRELEVANTES = new Set([
  'para','com','que','dos','das','uma','não','nao','por','como','este','esta','isso','pelo','pela',
  'foi','ser','são','sao','tem','tinha','está','esta','sobre','entre','após','apos','durante','onde',
  'quando','mais','menos','muito','pouco','todo','toda','cada','seus','suas','nos','nas','ele','ela',
  'the','and','of','no','na','do','da','de','em','um','os','as','ao','à','se','ou','é','e',
]);

function palavras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 3 && !IRRELEVANTES.has(p));
}

/**
 * Associação local por palavras em comum com título e definição do código.
 *
 * Não pretende substituir o modelo: pretende deixar o aplicativo utilizável e
 * testável sem chave, e dar um ponto de partida que a pessoa corrige.
 */
export function classificarLocalmente(item: ItemColetado): Sugestao {
  const alvo = new Set(palavras(item.texto));
  const notas = CODIGOS.map((c) => {
    const doTitulo = palavras(c.titulo).filter((p) => alvo.has(p)).length * 3;
    const daDefinicao = palavras(c.definicao).filter((p) => alvo.has(p)).length;
    return { codigo: c, nota: doTitulo + daDefinicao };
  })
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota);

  const melhor = notas[0]?.codigo ?? genericoDaCategoria(item);
  const alternativas = notas.slice(1, 4).map((x) => ({ codigo: x.codigo.codigo, titulo: x.codigo.titulo }));

  return {
    itemId: item.id,
    codigo: melhor.codigo,
    titulo: melhor.titulo,
    nivel: 'constatado',
    justificativa:
      notas.length > 0
        ? 'Associação local por termos em comum com o título e a definição do código. Confira o mecanismo antes de aceitar.'
        : 'Nenhum código teve termo em comum com a constatação. Escolha o código à mão.',
    confianca: 'baixa',
    alternativas,
    origem: 'local',
  };
}

/** Código genérico da coluna correspondente à categoria PEEPO do item. */
function genericoDaCategoria(item: ItemColetado): CodigoIcam {
  const preferida =
    item.categoria === 'pessoas'
      ? 'condicoes'
      : item.categoria === 'equipamento' || item.categoria === 'ambiente'
        ? 'condicoes'
        : item.categoria === 'procedimentos'
          ? 'defesas'
          : 'organizacionais';

  return (
    CODIGOS.find((c) => c.generico && c.coluna === preferida) ??
    CODIGOS.find((c) => c.generico) ??
    CODIGOS[0]!
  );
}

export function agruparPorColuna(sugestoes: Sugestao[]): Map<string, Sugestao[]> {
  const mapa = new Map<string, Sugestao[]>();
  for (const s of sugestoes) {
    const codigo = obterCodigo(s.codigo);
    const coluna = codigo?.coluna ?? 'organizacionais';
    const lista = mapa.get(coluna) ?? [];
    lista.push(s);
    mapa.set(coluna, lista);
  }
  return mapa;
}

export { normalizarCodigo };
