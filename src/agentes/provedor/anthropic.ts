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

/** Reexportado por compatibilidade: já era importado a partir daqui. */
export { extrairJson };

/**
 * Adaptador para a API de mensagens da Anthropic.
 *
 * Fala HTTP direto, sem SDK: o produto roda inteiro sem instalar pacote de
 * fornecedor nenhum. Nada é transmitido enquanto o envio externo não estiver
 * explicitamente autorizado na configuração.
 */
export class ProvedorAnthropic implements ProvedorIa {
  readonly nome = 'anthropic';
  readonly enviaDadosExternamente = true;

  constructor(
    private readonly chaveApi: string,
    private readonly modelo: string,
    private readonly politica: PoliticaEnvio,
  ) {}

  async executar(pedido: PedidoAgente): Promise<RespostaProvedor> {
    conferirAutorizacao(this.nome, this.politica, this.chaveApi, 'ANTHROPIC_API_KEY');

    const resposta = await chamarApi({
      provedor: 'Anthropic',
      url: 'https://api.anthropic.com/v1/messages',
      cabecalhos: {
        'x-api-key': this.chaveApi,
        'anthropic-version': '2023-06-01',
      },
      corpo: {
        model: this.modelo,
        max_tokens: pedido.maxTokens ?? 4096,
        temperature: pedido.temperatura ?? 0,
        system: montarSistema(pedido),
        messages: [{ role: 'user', content: montarConteudoUsuario(pedido) }],
      },
    });

    const blocos = Array.isArray(resposta.content) ? (resposta.content as Record<string, unknown>[]) : [];
    const texto = blocos.find((b) => b.type === 'text');
    const bruto = typeof texto?.text === 'string' ? texto.text : '';
    const uso = (resposta.usage ?? {}) as Record<string, unknown>;

    return {
      conteudo: extrairJson(bruto),
      modelo: textoOuNulo(resposta.model),
      tokensEntrada: numeroOuNulo(uso.input_tokens),
      tokensSaida: numeroOuNulo(uso.output_tokens),
      bruto,
    };
  }
}
