/**
 * Tira o nome do fornecedor de IA de tudo que chega ao navegador.
 *
 * Na tela existe "IA assistida" e nada mais: quem usa o aplicativo não precisa
 * saber de qual empresa vem o modelo, e o nome do fornecedor numa mensagem de
 * erro só serve para confundir quem está no meio de uma investigação.
 *
 * O texto detalhado NÃO se perde — ele continua inteiro no log do servidor,
 * que é onde ajuda. Esta função age só na fronteira da resposta HTTP.
 *
 * A ordem das regras importa: `GEMINI_API_KEY` precisa ser trocada antes da
 * regra genérica, senão esta última consome o `_API_KEY` junto e a mensagem
 * perde o sentido.
 */
const SUBSTITUICOES: [RegExp, string][] = [
  [/GEMINI_API_KEY/g, 'a chave da IA'],
  [/\bUSAR_GEMINI\b/g, 'a opção de IA'],
  [/\bMODELO_IA\b/g, 'o modelo da IA'],
  [/https?:\/\/\S*(?:google|aistudio|googleapis)\S*/gi, 'a documentação do provedor'],
  [/\bgemini[\w.-]*/gi, 'o modelo de IA'],
  [/\bgoogle\b/gi, 'o provedor'],
];

export function semFornecedor(texto: string): string {
  let saida = texto;
  for (const [padrao, troca] of SUBSTITUICOES) saida = saida.replace(padrao, troca);
  return saida.replace(/[ \t]{2,}/g, ' ').trim();
}

/** Mesma limpeza para a lista de avisos que a tela mostra. */
export function avisosSemFornecedor(avisos: string[] | undefined): string[] {
  return (avisos ?? []).map(semFornecedor);
}

/**
 * Termos que nunca podem aparecer numa resposta ao navegador. Usado pelo teste
 * que varre as respostas das rotas — regra escrita uma vez, verificada sempre.
 */
export const TERMOS_PROIBIDOS = [/gemini/i, /google/i, /aistudio/i];
