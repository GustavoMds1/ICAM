import type { NomeAgente } from '../../domain/enumeracoes';

/**
 * Camada de abstração de provedores de IA (seção 10).
 *
 * Nenhum agente conhece o provedor concreto. Isso permite:
 *   - rodar o produto inteiro sem chave de API (provedor determinístico);
 *   - trocar de fornecedor sem tocar em lógica de investigação;
 *   - aplicar política de residência de dados e não treinamento por
 *     configuração, e bloquear envio externo quando não autorizado.
 */

export interface BlocoDados {
  /** Rótulo da fonte, sempre visível para rastreabilidade. */
  rotulo: string;
  /** Conteúdo já neutralizado contra prompt injection. */
  conteudo: string;
}

export interface PedidoAgente {
  agente: NomeAgente;
  /** Instrução do sistema — a única fonte legítima de comportamento. */
  instrucao: string;
  /** Tarefa concreta a executar. */
  tarefa: string;
  /** Dados de evidência, tratados como dado, nunca como instrução. */
  dados: BlocoDados[];
  /** Esquema esperado, descrito em texto para o modelo. */
  formatoEsperado: string;
  temperatura?: number;
  maxTokens?: number;
}

export interface RespostaProvedor {
  conteudo: unknown;
  modelo: string | null;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  bruto: string | null;
}

export interface PoliticaEnvio {
  envioExternoAutorizado: boolean;
  residenciaDados: string;
  politicaNaoTreinamento: string;
}

export interface ProvedorIa {
  readonly nome: string;
  readonly enviaDadosExternamente: boolean;
  executar(pedido: PedidoAgente): Promise<RespostaProvedor>;
}

export class ErroEnvioNaoAutorizado extends Error {
  constructor(nomeProvedor: string) {
    super(
      `O provedor "${nomeProvedor}" envia dados para fora do ambiente e IA_ENVIO_EXTERNO_AUTORIZADO não está habilitado. ` +
        'Nenhum conteúdo de investigação foi transmitido.',
    );
    this.name = 'ErroEnvioNaoAutorizado';
  }
}

export class ErroSaidaInvalida extends Error {
  constructor(
    readonly agente: string,
    readonly problemas: string[],
  ) {
    super(
      `A saída do agente "${agente}" não atende ao contrato e foi descartada:\n${problemas.map((p) => `- ${p}`).join('\n')}`,
    );
    this.name = 'ErroSaidaInvalida';
  }
}
