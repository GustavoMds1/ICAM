/**
 * Chamada ao Gemini, compartilhada pela classificação e pelo plano de ação.
 *
 * A chave vem de `GEMINI_API_KEY` no ambiente do servidor — no Render, em
 * Environment do serviço `icam-coleta`. Nunca chega ao navegador.
 *
 * Duas decisões que evitam armadilhas conhecidas:
 *
 *   - **falta de chave é erro, não degradação.** Antes, o aplicativo caía em
 *     silêncio para o casamento de palavras local e devolvia algo parecido com
 *     análise. Alguém montaria um slide de investigação achando que a IA
 *     classificou. Agora a falta de chave para o passo e diz o que fazer.
 *   - **nome de modelo errado se conserta sozinho.** Nomes de modelo do Google
 *     mudam com frequência. Se o configurado não existir, o módulo pergunta à
 *     própria API quais existem e usa o primeiro que serve, informando qual foi.
 */

export class ErroSemChave extends Error {
  readonly codigo = 'SEM_CHAVE';
  constructor() {
    super(
      'GEMINI_API_KEY não está configurada no servidor. No Render: serviço icam-coleta → Environment → GEMINI_API_KEY. A chave é obtida em https://aistudio.google.com/apikey.',
    );
    this.name = 'ErroSemChave';
  }
}

export class ErroGemini extends Error {
  readonly codigo = 'FALHA_GEMINI';
  constructor(motivo: string) {
    super(`A chamada ao Gemini falhou: ${motivo}`);
    this.name = 'ErroGemini';
  }
}

export const MODELO_PADRAO = 'gemini-flash-latest';

export function obterChave(chaveExplicita?: string): string {
  const chave = chaveExplicita ?? process.env.GEMINI_API_KEY ?? '';
  if (!chave.trim()) throw new ErroSemChave();
  return chave.trim();
}

const RAIZ = 'https://generativelanguage.googleapis.com/v1beta';

interface RespostaGeracao {
  texto: string;
  modelo: string;
  avisos: string[];
}

/**
 * Pergunta à API quais modelos existem e devolve o mais adequado.
 *
 * Preferência por "flash": é o suficiente para classificar contra um catálogo
 * fechado e custa uma fração do modelo maior.
 */
async function descobrirModelo(chaveApi: string, sinal: AbortSignal): Promise<string | null> {
  const resposta = await fetch(`${RAIZ}/models`, {
    headers: { 'x-goog-api-key': chaveApi },
    signal: sinal,
  });
  if (!resposta.ok) return null;

  const corpo = (await resposta.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  const disponiveis = (corpo.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((n) => n.length > 0 && !n.includes('embedding') && !n.includes('vision'));

  return disponiveis.find((n) => n.includes('flash')) ?? disponiveis[0] ?? null;
}

export interface PedidoGemini {
  chaveApi: string;
  instrucao: string;
  formato: string;
  tarefa: string;
  modelo?: string;
  tempoLimiteMs?: number;
}

export async function gerarJson(pedido: PedidoGemini): Promise<RespostaGeracao> {
  const limite = pedido.tempoLimiteMs ?? 90_000;
  const abortador = new AbortController();
  const relogio = setTimeout(() => abortador.abort(), limite);
  const avisos: string[] = [];

  try {
    let modelo = pedido.modelo ?? process.env.MODELO_IA?.trim() ?? MODELO_PADRAO;
    let resposta = await chamar(modelo, pedido, abortador.signal);

    // 404 quase sempre é nome de modelo que não existe mais.
    if (resposta.status === 404) {
      const alternativo = await descobrirModelo(pedido.chaveApi, abortador.signal);
      if (alternativo && alternativo !== modelo) {
        avisos.push(
          `O modelo "${modelo}" não existe nesta conta. Foi usado "${alternativo}". Defina MODELO_IA no Render para fixar essa escolha.`,
        );
        modelo = alternativo;
        resposta = await chamar(modelo, pedido, abortador.signal);
      }
    }

    if (!resposta.ok) {
      const detalhe = (await resposta.text().catch(() => '')).slice(0, 300);
      throw new ErroGemini(`HTTP ${resposta.status}${detalhe ? ` — ${detalhe}` : ''}`);
    }

    const corpo = (await resposta.json()) as Record<string, unknown>;
    const candidatos = Array.isArray(corpo.candidates) ? (corpo.candidates as Record<string, unknown>[]) : [];
    const conteudo = (candidatos[0]?.content ?? {}) as Record<string, unknown>;
    const partes = Array.isArray(conteudo.parts) ? (conteudo.parts as Record<string, unknown>[]) : [];
    const texto = partes.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');

    if (!texto.trim()) {
      const motivo = typeof candidatos[0]?.finishReason === 'string' ? candidatos[0].finishReason : 'resposta vazia';
      throw new ErroGemini(String(motivo));
    }

    return { texto, modelo, avisos };
  } catch (e) {
    if (e instanceof ErroGemini) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ErroGemini(`sem resposta em ${limite / 1000}s`);
    }
    throw new ErroGemini(e instanceof Error ? e.message : 'erro desconhecido');
  } finally {
    clearTimeout(relogio);
  }
}

function chamar(modelo: string, pedido: PedidoGemini, sinal: AbortSignal): Promise<Response> {
  return fetch(`${RAIZ}/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': pedido.chaveApi },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${pedido.instrucao}\n\nFORMATO ESPERADO:\n${pedido.formato}` }] },
      contents: [{ role: 'user', parts: [{ text: pedido.tarefa }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 8192 },
    }),
    signal: sinal,
  });
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
