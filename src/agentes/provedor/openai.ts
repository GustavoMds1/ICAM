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
 * Adaptador para a API de chat da OpenAI.
 *
 * Duas escolhas que parecem omissões e não são:
 *
 *   - `temperature` não é enviado. Vários modelos atuais recusam valor
 *     personalizado e devolvem 400. Quem garante consistência aqui é o
 *     `response_format: json_object` somado à validação Zod da saída, não o
 *     ajuste de temperatura.
 *   - `max_completion_tokens` no lugar de `max_tokens`, que foi substituído.
 */
export class ProvedorOpenAi implements ProvedorIa {
  readonly nome = 'openai';
  readonly enviaDadosExternamente = true;

  constructor(
    private readonly chaveApi: string,
    private readonly modelo: string,
    private readonly politica: PoliticaEnvio,
  ) {}

  async executar(pedido: PedidoAgente): Promise<RespostaProvedor> {
    conferirAutorizacao(this.nome, this.politica, this.chaveApi, 'OPENAI_API_KEY');

    const resposta = await chamarApi({
      provedor: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      cabecalhos: { authorization: `Bearer ${this.chaveApi}` },
      corpo: {
        model: this.modelo,
        messages: [
          { role: 'system', content: montarSistema(pedido) },
          { role: 'user', content: montarConteudoUsuario(pedido) },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: pedido.maxTokens ?? 4096,
      },
    });

    const escolhas = Array.isArray(resposta.choices) ? (resposta.choices as Record<string, unknown>[]) : [];
    const mensagem = (escolhas[0]?.message ?? {}) as Record<string, unknown>;
    const bruto = typeof mensagem.content === 'string' ? mensagem.content : '';
    const uso = (resposta.usage ?? {}) as Record<string, unknown>;

    return {
      conteudo: extrairJson(bruto),
      modelo: textoOuNulo(resposta.model),
      tokensEntrada: numeroOuNulo(uso.prompt_tokens),
      tokensSaida: numeroOuNulo(uso.completion_tokens),
      bruto,
    };
  }
}
