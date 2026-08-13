import { ProvedorAnthropic } from './anthropic';
import type { PoliticaEnvio, ProvedorIa } from './tipos';

export * from './tipos';
export { ProvedorAnthropic, extrairJson } from './anthropic';

export interface ConfiguracaoIa {
  provedor: 'deterministico' | 'anthropic';
  modelo: string;
  chaveApi: string;
  politica: PoliticaEnvio;
}

/** Ambiente aceito de forma frouxa para permitir configuração explícita em testes. */
export type Ambiente = Record<string, string | undefined>;

export function lerConfiguracaoIa(ambiente: Ambiente = process.env): ConfiguracaoIa {
  const provedor = ambiente.PROVEDOR_IA === 'anthropic' ? 'anthropic' : 'deterministico';
  return {
    provedor,
    modelo: ambiente.MODELO_IA ?? 'claude-sonnet-5',
    chaveApi: ambiente.ANTHROPIC_API_KEY ?? '',
    politica: {
      envioExternoAutorizado: ambiente.IA_ENVIO_EXTERNO_AUTORIZADO === 'true',
      residenciaDados: ambiente.IA_RESIDENCIA_DADOS ?? 'nao_definida',
      politicaNaoTreinamento: ambiente.IA_POLITICA_NAO_TREINAMENTO ?? 'exigida',
    },
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
  if (config.provedor === 'anthropic') {
    return new ProvedorAnthropic(config.chaveApi, config.modelo, config.politica);
  }
  return null;
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
    avisos.push({ nivel: 'erro', mensagem: 'ANTHROPIC_API_KEY não configurada.' });
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
  return avisos;
}
