import type { DossieClassificacao } from '../domain/dossie';
import { formularContrafactual } from '../domain/causal/grafo';
import { respostaCausalidade, type RespostaCausalidade } from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';

/**
 * Agente 7 — Análise de barreiras e causalidade.
 *
 * Propõe ligações do mapa causal como AFIRMAÇÕES TESTÁVEIS. Uma proposta sem
 * evidência declarada nasce como `correlacao_observada`, nunca como
 * `contribuiu_para` — a promoção a vínculo causal exige decisão humana com
 * evidência, e o verificador CORRELACAO_COMO_CAUSA bloqueia o atalho.
 */

export interface EntradaCausalidade {
  fatores: DossieClassificacao[];
  /** Ligações já declaradas, para não duplicar. */
  relacoesExistentes: { origemId: string; destinoId: string }[];
}

/**
 * Direção padrão da sequência ICAM: fatores organizacionais moldam condições,
 * condições moldam ações, ações e condições atravessam defesas.
 */
const ORDEM_COLUNA: Record<string, number> = {
  fatores_organizacionais: 1,
  condicoes_tarefa_ambiente: 2,
  fatores_humanos: 2,
  acoes: 3,
  defesas: 4,
};

export const agenteCausalidade: DefinicaoAgente<EntradaCausalidade, RespostaCausalidade> = {
  nome: 'causalidade',
  esquemaSaida: respostaCausalidade,

  instrucao: [
    'Você é o agente de análise de barreiras e causalidade de uma plataforma ICAM.',
    '',
    'Cada ligação proposta deve ser uma AFIRMAÇÃO TESTÁVEL, com evidência e grau de sustentação.',
    'Sem evidência declarada, use o tipo "correlacao_observada" — nunca "contribuiu_para".',
    'Correlação não é causalidade e ausência de prova não é prova de ausência.',
    'Para cada defesa, informe se estava ausente, falhou, é incerta ou não se aplica, e por quê.',
  ].join('\n'),

  formatoEsperado: [
    '{ "resposta": "...", "tipo": "inferencia",',
    '  "relacoes": [{"origemId":"...","destinoId":"...","tipo":"contribuiu_para",',
    '    "afirmacaoTestavel":"...","grauSustentacao":"moderado","evidenciasResumo":"..."}],',
    '  "barreirasAnalisadas": [{"classificacaoId":"...","estadoBarreira":"falha",',
    '    "justificativa":"...","contrafactual":"..."}],',
    '  "evidencias_favoraveis": [], "evidencias_contrarias": [], "citacoes": [],',
    '  "premissas": [], "confianca": "baixa", "limitacoes": [],',
    '  "proximas_diligencias": [], "requer_validacao_humana": true }',
  ].join('\n'),

  montarTarefa(e) {
    return `Proponha ligações causais testáveis entre ${e.fatores.length} fator(es) e analise as barreiras.`;
  },

  heuristica(entrada) {
    const existentes = new Set(
      entrada.relacoesExistentes.map((r) => `${r.origemId}->${r.destinoId}`),
    );
    const relacoes: RespostaCausalidade['relacoes'] = [];

    const ordenados = [...entrada.fatores].sort(
      (a, b) => (ORDEM_COLUNA[a.coluna] ?? 9) - (ORDEM_COLUNA[b.coluna] ?? 9),
    );

    for (const origem of ordenados) {
      for (const destino of ordenados) {
        if (origem.id === destino.id) continue;
        const oOrigem = ORDEM_COLUNA[origem.coluna] ?? 9;
        const oDestino = ORDEM_COLUNA[destino.coluna] ?? 9;
        if (oDestino !== oOrigem + 1) continue;
        if (existentes.has(`${origem.id}->${destino.id}`)) continue;

        const evidenciasOrigem = origem.sustentacoes.filter((s) => s.sentido === 'favoravel').length;
        const evidenciasDestino = destino.sustentacoes.filter((s) => s.sentido === 'favoravel').length;
        const temEvidenciaDosDoisLados = evidenciasOrigem > 0 && evidenciasDestino > 0;

        relacoes.push({
          origemId: origem.id,
          destinoId: destino.id,
          // Sem evidência dos dois lados, a proposta NÃO afirma causalidade.
          tipo: temEvidenciaDosDoisLados ? 'contribuiu_para' : 'correlacao_observada',
          afirmacaoTestavel:
            `Se ${resumir(origem.descricaoContextual)} não estivesse presente, ` +
            `${resumir(destino.descricaoContextual)} seria menos provável.`,
          grauSustentacao: temEvidenciaDosDoisLados ? 'fraco' : 'nao_avaliado',
          evidenciasResumo: temEvidenciaDosDoisLados
            ? `${origem.identificador}: ${evidenciasOrigem} evidência(s) favorável(is); ${destino.identificador}: ${evidenciasDestino}. ` +
              'A existência de evidência em cada ponta não demonstra o vínculo entre eles — é preciso evidência do próprio mecanismo.'
            : 'Sem evidência suficiente em uma das pontas. Proposta registrada como correlação observada, não como causa.',
        });
      }
    }

    const barreiras: RespostaCausalidade['barreirasAnalisadas'] = entrada.fatores
      .filter((f) => f.coluna === 'defesas')
      .map((f) => ({
        classificacaoId: f.id,
        estadoBarreira: (f.estadoBarreira ?? 'incerto') as 'ausente' | 'falha' | 'incerto' | 'nao_aplicavel',
        justificativa:
          f.justificativaBarreira ??
          'ESTADO NÃO JUSTIFICADO — registre por que a defesa estava ausente, falhou ou é incerta.',
        contrafactual: formularContrafactual(f).pergunta,
      }));

    const base = baseAnalitica(
      `${relacoes.length} ligação(ões) proposta(s) e ${barreiras.length} barreira(s) analisada(s). ` +
        `${relacoes.filter((r) => r.tipo === 'correlacao_observada').length} nasceram como correlação por falta de evidência.`,
      'inferencia',
    );

    return {
      ...base,
      tipo: 'inferencia' as const,
      relacoes,
      barreirasAnalisadas: barreiras,
      confianca: 'baixa' as const,
      premissas: [
        'A direção proposta segue a sequência típica do ICAM: organização → condições → ações → defesas.',
        'A sequência típica é um ponto de partida estrutural, não uma afirmação sobre este evento.',
      ],
      limitacoes: [
        'O agente não observa o mecanismo físico: nenhuma ligação é confirmada automaticamente.',
        'Ligações sem evidência do mecanismo permanecem como correlação até decisão humana.',
      ],
      proximas_diligencias: [
        'Para cada ligação, apontar a evidência que demonstra o mecanismo, não apenas a coexistência.',
        'Responder o teste contrafactual de cada fator e registrar a justificativa.',
        'Justificar o estado de cada barreira (ausente, falha, incerto, não aplicável).',
      ],
      requer_validacao_humana: true as const,
    };
  },
};

function resumir(texto: string, limite = 90): string {
  const t = texto.trim().replace(/\.$/, '');
  return t.length <= limite ? t : `${t.slice(0, limite - 1)}…`;
}
