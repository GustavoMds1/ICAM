import {
  chamarApi,
  conferirAutorizacao,
  extrairJson,
  montarConteudoUsuario,
  montarSistema,
  numeroOuNulo,
  textoOuNulo,
} from './http';
import type { PedidoAgente, PoliticaEnvio, ProvedorIa, RespostaProvedor } from './tipos';

/**
 * Adaptador para a API Gemini do Google.
 *
 * A chave vai no cabeçalho `x-goog-api-key`, nunca na URL: chave em query
 * string vaza em log de servidor, histórico e proxy.
 *
 * `responseMimeType: application/json` é o equivalente do modo JSON dos outros
 * provedores. A saída ainda passa pela validação Zod — nenhum provedor tem
 * permissão de devolver estrutura fora do contrato.
 */
export class ProvedorGemini implements ProvedorIa {
  readonly nome = 'gemini';
  readonly enviaDadosExternamente = true;

  constructor(
    private readonly chaveApi: string,
    private readonly modelo: string,
    private readonly politica: PoliticaEnvio,
  ) {}

  async executar(pedido: PedidoAgente): Promise<RespostaProvedor> {
    conferirAutorizacao(this.nome, this.politica, this.chaveApi, 'GEMINI_API_KEY');

    const modelo = encodeURIComponent(this.modelo);
    const resposta = await chamarApi({
      provedor: 'Gemini',
      url: `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      cabecalhos: { 'x-goog-api-key': this.chaveApi },
      corpo: {
        systemInstruction: { parts: [{ text: montarSistema(pedido) }] },
        contents: [{ role: 'user', parts: [{ text: montarConteudoUsuario(pedido) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: pedido.temperatura ?? 0,
          maxOutputTokens: pedido.maxTokens ?? 4096,
        },
      },
    });

    const candidatos = Array.isArray(resposta.candidates)
      ? (resposta.candidates as Record<string, unknown>[])
      : [];
    const conteudo = (candidatos[0]?.content ?? {}) as Record<string, unknown>;
    const partes = Array.isArray(conteudo.parts) ? (conteudo.parts as Record<string, unknown>[]) : [];
    const bruto = partes.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
    const uso = (resposta.usageMetadata ?? {}) as Record<string, unknown>;

    return {
      conteudo: extrairJson(bruto),
      modelo: textoOuNulo(resposta.modelVersion) ?? this.modelo,
      tokensEntrada: numeroOuNulo(uso.promptTokenCount),
      tokensSaida: numeroOuNulo(uso.candidatesTokenCount),
      bruto,
    };
  }
}
