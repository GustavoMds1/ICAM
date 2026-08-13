import { agenteCausalidade } from './causalidade';
import { agenteClassificador } from './classificador';
import { agenteContradicoes } from './contradicoes';
import { agenteFatos } from './fatos';
import { agenteIngestao } from './ingestao';
import { agentePeepo } from './peepo';
import { agenteRecomendacoes } from './recomendacoes';
import { agenteRelatorio } from './relatorio';
import { agenteRevisor } from './revisor';
import { agenteTemporal } from './temporal';
import { ROTULOS_AGENTE, type NomeAgente } from '../domain/enumeracoes';

export * from './contratos';
export * from './nucleo';
export * from './provedor';

export { agenteIngestao } from './ingestao';
export { agenteTemporal } from './temporal';
export { agenteFatos } from './fatos';
export { agenteContradicoes } from './contradicoes';
export { agentePeepo } from './peepo';
export { agenteClassificador, bloqueiosParaConfirmar } from './classificador';
export { agenteCausalidade } from './causalidade';
export { agenteRecomendacoes } from './recomendacoes';
export { agenteRelatorio, renderizarMarkdown } from './relatorio';
export { agenteRevisor } from './revisor';

/**
 * Os dez agentes exigidos pela seção 6. Cada um é um passo auditável do fluxo,
 * com contrato de saída próprio — não uma resposta livre de modelo.
 */
export const AGENTES_REGISTRADOS = {
  ingestao: agenteIngestao,
  temporal: agenteTemporal,
  fatos: agenteFatos,
  contradicoes: agenteContradicoes,
  peepo: agentePeepo,
  classificador: agenteClassificador,
  causalidade: agenteCausalidade,
  recomendacoes: agenteRecomendacoes,
  relatorio: agenteRelatorio,
  revisor: agenteRevisor,
} as const;

export interface ResumoAgente {
  nome: NomeAgente;
  rotulo: string;
  instrucaoResumida: string;
}

export function listarAgentes(): ResumoAgente[] {
  return (Object.keys(AGENTES_REGISTRADOS) as NomeAgente[]).map((nome) => {
    const def = AGENTES_REGISTRADOS[nome];
    return {
      nome,
      rotulo: ROTULOS_AGENTE[nome],
      instrucaoResumida: def.instrucao.split('\n')[0] ?? '',
    };
  });
}
