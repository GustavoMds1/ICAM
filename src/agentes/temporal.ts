import { z } from 'zod';
import {
  detectarDivergenciasDeRelogio,
  normalizarEvento,
  ordenarCronologia,
  type EventoBruto,
  type FonteTemporalRef,
} from '../domain/tempo/normalizacao';
import { respostaAnalitica } from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';

/**
 * Agente 2 — Normalização temporal e de entidades.
 *
 * Aplica correção de desvio de relógio como valor DERIVADO, preservando o
 * instante bruto, e reporta divergências entre sistemas como achado da
 * investigação (seção 13.6), não como ruído a ser limpo.
 */

export const respostaTemporal = respostaAnalitica.extend({
  tipo: z.literal('inferencia'),
  eventos: z.array(
    z.object({
      id: z.string(),
      titulo: z.string(),
      instanteBruto: z.string().nullable(),
      instanteNormalizado: z.string().nullable(),
      correcaoAplicadaSegundos: z.number().nullable(),
      fonteNome: z.string().nullable(),
      precisao: z.string(),
      avisos: z.array(z.string()),
    }),
  ),
  divergenciasRelogio: z.array(
    z.object({ fonteA: z.string(), fonteB: z.string(), diferencaSegundos: z.number(), descricao: z.string() }),
  ),
});
export type RespostaTemporal = z.infer<typeof respostaTemporal>;

export interface EntradaTemporal {
  fontes: FonteTemporalRef[];
  eventos: EventoBruto[];
  limiteDivergenciaSegundos?: number;
}

export const agenteTemporal: DefinicaoAgente<EntradaTemporal, RespostaTemporal> = {
  nome: 'temporal',
  esquemaSaida: respostaTemporal,

  instrucao: [
    'Você é o agente de normalização temporal de uma plataforma de investigação ICAM.',
    'Nunca sobrescreva o instante bruto: a correção é sempre um valor derivado, com o motivo registrado.',
    'Relógios divergentes são achado de investigação e devem ser reportados.',
    'Horário aproximado, intervalo e desconhecido devem permanecer explícitos.',
  ].join('\n'),

  formatoEsperado:
    '{ "resposta": "...", "tipo": "inferencia", "eventos": [...], "divergenciasRelogio": [...], ... }',

  montarTarefa(e) {
    return `Normalize ${e.eventos.length} evento(s) a partir de ${e.fontes.length} fonte(s) temporal(is).`;
  },

  heuristica(entrada) {
    const normalizados = entrada.eventos.map((e) => normalizarEvento(e, entrada.fontes));
    const ordenados = ordenarCronologia(normalizados);
    const divergencias = detectarDivergenciasDeRelogio(
      entrada.fontes,
      entrada.limiteDivergenciaSegundos ?? 60,
    );

    const semVerificacao = entrada.fontes.filter((f) => f.desvioSegundos === null);

    const base = baseAnalitica(
      `${ordenados.length} evento(s) normalizado(s). ` +
        `${divergencias.length} divergência(s) de relógio detectada(s). ` +
        `${semVerificacao.length} fonte(s) sem verificação de desvio.`,
      'inferencia',
    );

    return {
      ...base,
      tipo: 'inferencia' as const,
      eventos: ordenados.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        instanteBruto: e.instanteBruto?.toISOString() ?? null,
        instanteNormalizado: e.instanteNormalizado?.toISOString() ?? null,
        correcaoAplicadaSegundos: e.correcaoAplicadaSegundos,
        fonteNome: e.fonteNome,
        precisao: e.precisao,
        avisos: e.avisos,
      })),
      divergenciasRelogio: divergencias,
      confianca: divergencias.length > 0 ? ('baixa' as const) : ('media' as const),
      premissas: [
        'A correção usa o desvio declarado de cada fonte temporal. Fonte sem desvio verificado não recebe correção.',
      ],
      limitacoes: [
        'Eventos sem instante não são posicionados por estimativa: ficam ao fim, ordenados por ordem relativa.',
        'A comparação entre fontes divergentes só é válida após verificação humana do desvio.',
      ],
      proximas_diligencias: [
        ...semVerificacao.map(
          (f) => `Verificar e registrar o desvio do relógio da fonte "${f.nome}" contra uma referência confiável.`,
        ),
        ...divergencias.map((d) => `Investigar a divergência entre "${d.fonteA}" e "${d.fonteB}".`),
      ],
      requer_validacao_humana: true as const,
    };
  },
};
