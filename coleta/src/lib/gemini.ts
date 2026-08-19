/**
 * Chamada ao Gemini, compartilhada pela classificação e pelo plano de ação.
 *
 * A chave vem de `GEMINI_API_KEY` no ambiente do servidor — no Render, em
 * Environment do serviço `icam-coleta`. Nunca chega ao navegador.
 *
 * Quatro decisões que evitam armadilhas conhecidas:
 *
 *   - **falta de chave é erro, não degradação.** Cair calado para o casamento
 *     de palavras devolveria algo com cara de análise, e alguém montaria um
 *     slide de investigação achando que a IA classificou.
 *   - **sobrecarga do modelo se resolve sozinha.** 503 e 429 do Google são
 *     temporários e comuns em horário de pico. O módulo espera e tenta de novo,
 *     em vez de jogar o erro na cara de quem só quer classificar 40 itens.
 *   - **modelo ocupado demais vira troca de modelo.** Se insistir não resolve,
 *     pergunta à API quais existem na conta e tenta outro, avisando qual usou.
 *   - **nome de modelo errado se conserta igual.** Nomes mudam com frequência.
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

/** Status que valem nova tentativa: são todos temporários do lado do Google. */
const TRANSITORIOS = new Set([429, 500, 502, 503, 504]);

/**
 * Espera antes de cada tentativa, em milissegundos. A primeira é imediata.
 *
 * Crescente de propósito: se o modelo está congestionado, voltar em 200ms só
 * aumenta o congestionamento.
 *
 * Três tentativas, oito segundos de espera somados. Como são até três modelos,
 * o pior caso fica em torno de meio minuto — passar disso, com a tela parada,
 * parece travamento para quem está do outro lado.
 */
export const ESPERAS_PADRAO = [0, 2_000, 6_000];

export function obterChave(chaveExplicita?: string): string {
  const chave = chaveExplicita ?? process.env.GEMINI_API_KEY ?? '';
  if (!chave.trim()) throw new ErroSemChave();
  return chave.trim();
}

const RAIZ = 'https://generativelanguage.googleapis.com/v1beta';

export type Buscador = typeof fetch;

interface RespostaGeracao {
  texto: string;
  modelo: string;
  avisos: string[];
}

function dormir(ms: number, sinal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    sinal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new Error('AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * Modelos disponíveis na conta, do mais leve para o mais pesado.
 *
 * "flash" primeiro: é suficiente para classificar contra um catálogo fechado e
 * custa uma fração do modelo maior — e costuma ser o menos disputado.
 */
async function listarModelos(chaveApi: string, sinal: AbortSignal, buscar: Buscador): Promise<string[]> {
  try {
    const resposta = await buscar(`${RAIZ}/models`, {
      headers: { 'x-goog-api-key': chaveApi },
      signal: sinal,
    });
    if (!resposta.ok) return [];

    const corpo = (await resposta.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    const nomes = (corpo.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter((n) => n.length > 0 && !n.includes('embedding') && !n.includes('vision'));

    return [...nomes.filter((n) => n.includes('flash')), ...nomes.filter((n) => !n.includes('flash'))];
  } catch {
    return [];
  }
}

export interface PedidoGemini {
  chaveApi: string;
  instrucao: string;
  formato: string;
  tarefa: string;
  modelo?: string;
  tempoLimiteMs?: number;
  /** Injetável para teste; em produção é o `fetch` do runtime. */
  buscar?: Buscador;
  /** Injetável para teste; em produção é `ESPERAS_PADRAO`. */
  esperasMs?: number[];
}

export async function gerarJson(pedido: PedidoGemini): Promise<RespostaGeracao> {
  const limite = pedido.tempoLimiteMs ?? 120_000;
  const buscar = pedido.buscar ?? fetch;
  const abortador = new AbortController();
  const relogio = setTimeout(() => abortador.abort(), limite);
  const avisos: string[] = [];

  try {
    const preferido = pedido.modelo ?? process.env.MODELO_IA?.trim() ?? MODELO_PADRAO;
    const tentados: string[] = [];
    let ultimoMotivo = 'sem resposta';
    let sobrecarregado = false;

    // Primeiro o modelo preferido. Se ele não existir ou estiver ocupado
    // demais, os outros da conta entram na fila.
    for (const modelo of await comAlternativas(preferido, pedido, abortador.signal, buscar)) {
      tentados.push(modelo);
      const { resposta, motivo } = await chamarComRepeticao(modelo, pedido, abortador.signal, buscar);

      if (resposta?.ok) {
        if (tentados.length > 1) {
          avisos.push(
            `O modelo "${preferido}" não respondeu (${ultimoMotivo}). Foi usado "${modelo}". Para fixar essa escolha, defina MODELO_IA no Render.`,
          );
        }
        return { ...(await extrairTexto(resposta)), modelo, avisos };
      }

      ultimoMotivo = motivo;
      if (resposta && TRANSITORIOS.has(resposta.status)) sobrecarregado = true;
    }

    throw new ErroGemini(
      sobrecarregado
        ? `os modelos do Gemini estão sobrecarregados agora (tentei ${tentados.length}: ${tentados.join(', ')}). Isso costuma passar em alguns minutos — tente de novo, ou siga sem IA no modo local.`
        : ultimoMotivo,
    );
  } catch (e) {
    if (e instanceof ErroGemini) throw e;
    if (e instanceof Error && (e.name === 'AbortError' || e.message === 'AbortError')) {
      throw new ErroGemini(`sem resposta em ${limite / 1000}s`);
    }
    throw new ErroGemini(e instanceof Error ? e.message : 'erro desconhecido');
  } finally {
    clearTimeout(relogio);
  }
}

/** Modelo preferido, seguido de até dois alternativos da própria conta. */
async function comAlternativas(
  preferido: string,
  pedido: PedidoGemini,
  sinal: AbortSignal,
  buscar: Buscador,
): Promise<string[]> {
  const disponiveis = await listarModelos(pedido.chaveApi, sinal, buscar);
  const outros = disponiveis.filter((m) => m !== preferido).slice(0, 2);
  return [preferido, ...outros];
}

/**
 * Uma tentativa por espera de `ESPERAS`, enquanto o erro for temporário.
 *
 * Erro definitivo — chave inválida, requisição malformada, modelo inexistente —
 * sai na primeira: insistir só faria a pessoa esperar por nada.
 */
async function chamarComRepeticao(
  modelo: string,
  pedido: PedidoGemini,
  sinal: AbortSignal,
  buscar: Buscador,
): Promise<{ resposta: Response | null; motivo: string }> {
  let ultima: Response | null = null;
  let motivo = 'sem resposta';

  for (const espera of pedido.esperasMs ?? ESPERAS_PADRAO) {
    await dormir(espera, sinal);

    try {
      ultima = await chamar(modelo, pedido, sinal, buscar);
    } catch (e) {
      if (e instanceof Error && (e.name === 'AbortError' || e.message === 'AbortError')) throw e;
      motivo = e instanceof Error ? e.message : 'erro de rede';
      continue;
    }

    if (ultima.ok) return { resposta: ultima, motivo };

    const detalhe = (await ultima.clone().text().catch(() => '')).slice(0, 200);
    motivo = `HTTP ${ultima.status}${detalhe ? ` — ${detalhe}` : ''}`;

    if (!TRANSITORIOS.has(ultima.status)) break;
  }

  return { resposta: ultima, motivo };
}

async function extrairTexto(resposta: Response): Promise<{ texto: string }> {
  const corpo = (await resposta.json()) as Record<string, unknown>;
  const candidatos = Array.isArray(corpo.candidates) ? (corpo.candidates as Record<string, unknown>[]) : [];
  const conteudo = (candidatos[0]?.content ?? {}) as Record<string, unknown>;
  const partes = Array.isArray(conteudo.parts) ? (conteudo.parts as Record<string, unknown>[]) : [];
  const texto = partes.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');

  if (!texto.trim()) {
    const motivo = typeof candidatos[0]?.finishReason === 'string' ? candidatos[0].finishReason : 'resposta vazia';
    throw new ErroGemini(String(motivo));
  }
  return { texto };
}

function chamar(modelo: string, pedido: PedidoGemini, sinal: AbortSignal, buscar: Buscador): Promise<Response> {
  return buscar(`${RAIZ}/models/${encodeURIComponent(modelo)}:generateContent`, {
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
