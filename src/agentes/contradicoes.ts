import { z } from 'zod';
import { propostaConflito, respostaAnalitica, type PropostaConflito } from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';
import { normalizar } from '../domain/taxonomia/catalogo';

/**
 * Agente 4 — Contradições e lacunas.
 *
 * Preserva versões conflitantes (seção 4.7). Avalia confiabilidade das fontes
 * e recomenda diligências, mas NUNCA escolhe a versão vencedora nem sobrescreve
 * uma fonte com outra: `versaoEscolhida` é sempre `null` por contrato.
 */

export interface AfirmacaoComparavel {
  id: string;
  rotulo: string;
  /** Texto original, preservado como está. */
  valorRelatado: string;
  /** Valor numérico quando aplicável — permite comparar limite vs. observado. */
  valorNumerico: number | null;
  unidade: string | null;
  fonteTipo: 'telemetria' | 'documento' | 'procedimento' | 'declaracao' | 'checklist' | 'sistema' | 'outro';
  fonteId: string | null;
  confiabilidade: 'baixa' | 'media' | 'alta' | 'nao_avaliada';
}

export interface EntradaContradicoes {
  grupos: { tema: string; afirmacoes: AfirmacaoComparavel[] }[];
  toleranciaRelativa?: number;
}

export const respostaContradicoes = respostaAnalitica.extend({
  tipo: z.literal('conflito'),
  conflitos: z.array(propostaConflito),
  lacunas: z.array(
    z.object({
      descricao: z.string(),
      criticidade: z.enum(['baixa', 'media', 'alta', 'critica']),
      dimensaoPeepo: z.string().nullable(),
    }),
  ),
});
export type RespostaContradicoes = z.infer<typeof respostaContradicoes>;

/** Confiabilidade relativa por tipo de fonte, usada apenas para ORDENAR diligências. */
const PESO_FONTE: Record<AfirmacaoComparavel['fonteTipo'], number> = {
  telemetria: 5,
  sistema: 4,
  documento: 4,
  procedimento: 4,
  checklist: 2,
  declaracao: 2,
  outro: 1,
};

const TIPO_CONFLITO: Record<string, PropostaConflito['tipo']> = {
  'declaracao|telemetria': 'relato_vs_telemetria',
  'declaracao|sistema': 'relato_vs_telemetria',
  'procedimento|documento': 'procedimento_vs_manutencao',
  'procedimento|sistema': 'parametro_documentado_vs_configurado',
  'documento|sistema': 'parametro_documentado_vs_configurado',
  'checklist|telemetria': 'checklist_vs_evidencia_tecnica',
  'checklist|documento': 'checklist_vs_evidencia_tecnica',
};

export const agenteContradicoes: DefinicaoAgente<EntradaContradicoes, RespostaContradicoes> = {
  nome: 'contradicoes',
  esquemaSaida: respostaContradicoes,

  instrucao: [
    'Você é o agente de contradições e lacunas de uma plataforma de investigação ICAM.',
    'Sua função é DETECTAR divergências entre fontes e preservá-las lado a lado.',
    '',
    'Você NUNCA escolhe qual versão é a verdadeira, nem descarta uma fonte em favor de outra.',
    'Você avalia a confiabilidade de cada fonte, explica o critério e propõe diligências.',
    'Ausência de registro é lacuna, não prova de que o evento não ocorreu.',
  ].join('\n'),

  formatoEsperado: [
    '{ "resposta": "...", "tipo": "conflito",',
    '  "conflitos": [{ "titulo": "...", "tipo": "...", "descricao": "...",',
    '    "itens": [{"rotulo":"...","valorRelatado":"...","referencia":null,',
    '      "confiabilidadeFonte":"alta","justificativaConfiabilidade":"..."}],',
    '    "diligenciasRecomendadas": ["..."], "versaoEscolhida": null }],',
    '  "lacunas": [{"descricao":"...","criticidade":"alta","dimensaoPeepo":null}],',
    '  "evidencias_favoraveis": [], "evidencias_contrarias": [], "citacoes": [],',
    '  "premissas": [], "confianca": "media", "limitacoes": [],',
    '  "proximas_diligencias": [], "requer_validacao_humana": true }',
  ].join('\n'),

  montarTarefa(e) {
    return [
      'Compare as afirmações abaixo, agrupadas por tema, e identifique contradições.',
      ...e.grupos.map(
        (g) =>
          `Tema "${g.tema}": ${g.afirmacoes.map((a) => `[${a.rotulo}=${a.valorRelatado} | fonte ${a.fonteTipo}]`).join(' vs ')}`,
      ),
    ].join('\n');
  },

  heuristica(entrada) {
    const tolerancia = entrada.toleranciaRelativa ?? 0.02;
    const conflitos: PropostaConflito[] = [];
    const lacunas: RespostaContradicoes['lacunas'] = [];

    for (const grupo of entrada.grupos) {
      const afirmacoes = grupo.afirmacoes;

      if (afirmacoes.length < 2) {
        lacunas.push({
          descricao: `O tema "${grupo.tema}" tem apenas uma fonte (${afirmacoes[0]?.fonteTipo ?? 'nenhuma'}). Não há corroboração independente.`,
          criticidade: 'media',
          dimensaoPeepo: null,
        });
        continue;
      }

      const divergentes = detectarDivergencia(afirmacoes, tolerancia);
      if (!divergentes) continue;

      const tipos = [...new Set(afirmacoes.map((a) => a.fonteTipo))].sort();
      const chave = tipos.slice(0, 2).join('|');
      const tipo = TIPO_CONFLITO[chave] ?? 'outro';

      conflitos.push({
        titulo: `Divergência em "${grupo.tema}"`,
        tipo,
        descricao:
          `As fontes divergem sobre "${grupo.tema}": ` +
          afirmacoes.map((a) => `${a.rotulo} indica "${a.valorRelatado}"`).join('; ') +
          '. As duas versões são preservadas até que uma diligência esclareça a divergência.',
        itens: afirmacoes.map((a) => ({
          rotulo: a.rotulo,
          valorRelatado: a.valorRelatado,
          referencia: a.fonteId
            ? {
                tipo: a.fonteTipo === 'declaracao' ? ('declaracao' as const) : ('evidencia' as const),
                id: a.fonteId,
              }
            : null,
          confiabilidadeFonte: a.confiabilidade,
          justificativaConfiabilidade:
            `Fonte do tipo "${a.fonteTipo}" (peso relativo ${PESO_FONTE[a.fonteTipo]}/5). ` +
            'O peso ordena a diligência; não decide qual versão prevalece.',
        })),
        diligenciasRecomendadas: montarDiligencias(afirmacoes, grupo.tema),
        versaoEscolhida: null,
      });
    }

    const base = baseAnalitica(
      conflitos.length > 0
        ? `${conflitos.length} contradição(ões) detectada(s) e preservada(s) para análise humana.`
        : 'Nenhuma contradição detectada entre as fontes comparadas.',
      'conflito',
    );

    return {
      ...base,
      tipo: 'conflito' as const,
      conflitos,
      lacunas,
      confianca: 'media' as const,
      premissas: [
        'A comparação usa os valores fornecidos, sem reinterpretar unidades ou contexto.',
        `Divergência numérica considerada relevante acima de ${(tolerancia * 100).toFixed(1)}%.`,
      ],
      limitacoes: [
        'Comparação determinística: não interpreta sinônimos técnicos nem equivalências de unidade.',
        'Nenhuma versão foi escolhida; a resolução exige decisão humana justificada.',
      ],
      proximas_diligencias: conflitos.flatMap((c) => c.diligenciasRecomendadas),
      requer_validacao_humana: true as const,
    };
  },
};

function detectarDivergencia(
  afirmacoes: readonly AfirmacaoComparavel[],
  tolerancia: number,
): boolean {
  const numericas = afirmacoes.filter((a) => a.valorNumerico !== null);
  if (numericas.length >= 2) {
    const valores = numericas.map((a) => a.valorNumerico as number);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const base = Math.abs(max) > 0 ? Math.abs(max) : 1;
    return (max - min) / base > tolerancia;
  }
  const textos = new Set(afirmacoes.map((a) => normalizar(a.valorRelatado)));
  return textos.size > 1;
}

function montarDiligencias(
  afirmacoes: readonly AfirmacaoComparavel[],
  tema: string,
): string[] {
  const diligencias = [
    `Recuperar o registro primário de "${tema}" em cada fonte, com data, hora e responsável.`,
  ];
  if (afirmacoes.some((a) => a.fonteTipo === 'telemetria' || a.fonteTipo === 'sistema')) {
    diligencias.push(
      'Verificar o acerto do relógio e a configuração de parâmetros do sistema no período do evento.',
    );
  }
  if (afirmacoes.some((a) => a.fonteTipo === 'declaracao')) {
    diligencias.push(
      'Reentrevistar sobre este ponto específico, sem confrontar diretamente com a outra fonte, distinguindo memória, percepção e inferência.',
    );
  }
  if (afirmacoes.some((a) => a.fonteTipo === 'checklist')) {
    diligencias.push(
      'Confrontar o preenchimento do checklist com o momento e as condições reais da verificação.',
    );
  }
  diligencias.push(
    'Registrar como lacuna caso a divergência não possa ser resolvida com as evidências disponíveis.',
  );
  return diligencias;
}
