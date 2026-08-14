import { ProvedorAnthropic } from './anthropic';
import { ProvedorGemini } from './gemini';
import { ProvedorOpenAi } from './openai';
import type { PoliticaEnvio, ProvedorIa } from './tipos';

export * from './tipos';
export { ProvedorAnthropic } from './anthropic';
export { ProvedorGemini } from './gemini';
export { ProvedorOpenAi } from './openai';
export { extrairJson } from './http';

/**
 * Seleção do provedor de IA.
 *
 * Quatro modos, um por vez, escolhidos em `PROVEDOR_IA`:
 *
 *   deterministico  heurísticas locais. Padrão. Nada sai do ambiente e não custa nada.
 *   anthropic       API da Anthropic       (ANTHROPIC_API_KEY)
 *   openai          API da OpenAI          (OPENAI_API_KEY)
 *   gemini          API do Google Gemini   (GEMINI_API_KEY)
 *
 * Trocar de fornecedor é trocar duas variáveis de ambiente. Nenhum agente
 * conhece o provedor concreto, e a política de envio externo, residência de
 * dados e não treinamento vale igual para os três.
 */

export const PROVEDORES_IA = ['deterministico', 'anthropic', 'openai', 'gemini'] as const;
export type NomeProvedor = (typeof PROVEDORES_IA)[number];

/**
 * Padrões de modelo por fornecedor.
 *
 * Nomes de modelo mudam com frequência — se o provedor recusar o padrão,
 * defina `MODELO_IA` com o nome atual. A recusa não derruba a investigação: o
 * agente cai para a heurística local e o erro fica registrado na trilha.
 */
export const MODELO_PADRAO: Record<Exclude<NomeProvedor, 'deterministico'>, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.2-chat-latest',
  gemini: 'gemini-3.6-flash',
};

const VARIAVEL_CHAVE: Record<Exclude<NomeProvedor, 'deterministico'>, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

const ROTULO: Record<NomeProvedor, string> = {
  deterministico: 'Determinístico (local)',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

export interface ConfiguracaoIa {
  provedor: NomeProvedor;
  modelo: string;
  chaveApi: string;
  /** Nome da variável de ambiente que guarda a chave do provedor escolhido. */
  variavelChave: string | null;
  rotulo: string;
  politica: PoliticaEnvio;
}

/** Ambiente aceito de forma frouxa para permitir configuração explícita em testes. */
export type Ambiente = Record<string, string | undefined>;

function normalizarProvedor(valor: string | undefined): NomeProvedor {
  const escolhido = (valor ?? '').trim().toLowerCase();
  return (PROVEDORES_IA as readonly string[]).includes(escolhido)
    ? (escolhido as NomeProvedor)
    : 'deterministico';
}

export function lerConfiguracaoIa(ambiente: Ambiente = process.env): ConfiguracaoIa {
  const provedor = normalizarProvedor(ambiente.PROVEDOR_IA);
  const politica: PoliticaEnvio = {
    envioExternoAutorizado: ambiente.IA_ENVIO_EXTERNO_AUTORIZADO === 'true',
    residenciaDados: ambiente.IA_RESIDENCIA_DADOS ?? 'nao_definida',
    politicaNaoTreinamento: ambiente.IA_POLITICA_NAO_TREINAMENTO ?? 'exigida',
  };

  if (provedor === 'deterministico') {
    return {
      provedor,
      modelo: 'heuristica-local',
      chaveApi: '',
      variavelChave: null,
      rotulo: ROTULO[provedor],
      politica,
    };
  }

  const variavelChave = VARIAVEL_CHAVE[provedor];
  return {
    provedor,
    modelo: ambiente.MODELO_IA?.trim() || MODELO_PADRAO[provedor],
    chaveApi: ambiente[variavelChave] ?? '',
    variavelChave,
    rotulo: ROTULO[provedor],
    politica,
  };
}

/**
 * Devolve o provedor configurado, ou `null` quando o modo é determinístico.
 *
 * `null` não é degradação: o modo determinístico é o padrão do produto e
 * executa heurísticas auditáveis, com a mesma rastreabilidade e sem enviar
 * nada para fora do ambiente.
 */
export function obterProvedor(config = lerConfiguracaoIa()): ProvedorIa | null {
  switch (config.provedor) {
    case 'anthropic':
      return new ProvedorAnthropic(config.chaveApi, config.modelo, config.politica);
    case 'openai':
      return new ProvedorOpenAi(config.chaveApi, config.modelo, config.politica);
    case 'gemini':
      return new ProvedorGemini(config.chaveApi, config.modelo, config.politica);
    default:
      return null;
  }
}

export interface AvisoConfiguracao {
  nivel: 'erro' | 'alerta' | 'informativo';
  mensagem: string;
}

/** Avisos de governança exibidos na interface de administração. */
export function avaliarConfiguracaoIa(config = lerConfiguracaoIa()): AvisoConfiguracao[] {
  const avisos: AvisoConfiguracao[] = [];

  if (config.provedor === 'deterministico') {
    avisos.push({
      nivel: 'informativo',
      mensagem:
        'Modo determinístico ativo: as sugestões vêm de heurísticas locais auditáveis e nenhum dado sai do ambiente.',
    });
    return avisos;
  }

  if (!config.politica.envioExternoAutorizado) {
    avisos.push({
      nivel: 'erro',
      mensagem:
        'Provedor externo selecionado sem autorização de envio. Nenhuma chamada será feita até que IA_ENVIO_EXTERNO_AUTORIZADO=true.',
    });
  }
  if (!config.chaveApi) {
    avisos.push({ nivel: 'erro', mensagem: `${config.variavelChave} não configurada.` });
  }
  if (config.politica.residenciaDados === 'nao_definida') {
    avisos.push({
      nivel: 'alerta',
      mensagem:
        'Residência de dados não definida. Registre a região de processamento antes de enviar conteúdo de investigação.',
    });
  }
  if (config.politica.politicaNaoTreinamento !== 'exigida') {
    avisos.push({
      nivel: 'alerta',
      mensagem: 'Política de não treinamento com dados do cliente não está marcada como exigida.',
    });
  }
  avisos.push({
    nivel: 'informativo',
    mensagem: `Provedor ${config.rotulo}, modelo ${config.modelo}. O conteúdo enviado sai do ambiente e fica sujeito à política do fornecedor.`,
  });
  return avisos;
}
