import { GRUPO_PARA_COLUNA, type HierarquiaControle } from '../domain/enumeracoes';
import { obterCodigo } from '../domain/taxonomia/catalogo';
import { desafiarEscolha, perfilarPlano } from '../domain/recomendacoes/hierarquia';
import {
  respostaRecomendacoes,
  type PropostaRecomendacao,
  type RespostaRecomendacoes,
} from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';

/**
 * Agente 8 — Recomendações.
 *
 * Toda proposta nasce vinculada a um fator confirmado e ao mecanismo de risco
 * que pretende modificar. O agente sugere o nível de controle mais forte
 * plausível para o tipo de fator, desafia planos administrativos e exige
 * indicador de eficácia — mas nunca aprova nada sozinho.
 */

export interface FatorParaTratar {
  classificacaoId: string;
  identificador: string;
  codigo: string;
  descricaoContextual: string;
  mecanismo: string | null;
  natureza: string;
  estadoBarreira: string | null;
}

export interface EntradaRecomendacoes {
  fatores: FatorParaTratar[];
  /** Níveis já presentes no plano, para avaliar o equilíbrio. */
  hierarquiasExistentes?: HierarquiaControle[];
}

/**
 * Nível de controle mais forte tipicamente aplicável por coluna ICAM.
 * É uma SUGESTÃO de ponto de partida — o investigador decide e justifica.
 */
const NIVEL_SUGERIDO_POR_COLUNA: Record<string, HierarquiaControle> = {
  defesas: 'engenharia',
  condicoes_tarefa_ambiente: 'engenharia',
  acoes: 'engenharia',
  fatores_humanos: 'engenharia',
  fatores_organizacionais: 'administrativa',
};

export const agenteRecomendacoes: DefinicaoAgente<EntradaRecomendacoes, RespostaRecomendacoes> = {
  nome: 'recomendacoes',
  esquemaSaida: respostaRecomendacoes,

  instrucao: [
    'Você é o agente de recomendações de uma plataforma de investigação ICAM.',
    '',
    'Cada proposta deve:',
    '- estar vinculada a pelo menos um fator confirmado e ao mecanismo de risco que modifica;',
    '- declarar a hierarquia de controle e justificá-la;',
    '- trazer indicador de eficácia com método e meta, e risco residual esperado.',
    '',
    'Você desafia ações vagas ("reforçar", "orientar", "conscientizar", "treinar") quando não há',
    'mudança sistêmica verificável, e não aceita que um fator de engenharia, manutenção, design ou',
    'governança seja tratado apenas com treinamento.',
    'Você não aprova nada: toda proposta vai para decisão humana.',
  ].join('\n'),

  formatoEsperado: [
    '{ "resposta": "...", "tipo": "inferencia",',
    '  "propostas": [{ "classificacaoIds": ["..."], "mecanismoRiscoAlvo": "...",',
    '    "acaoProposta": "...", "objetivo": "...", "resultadoEsperado": "...",',
    '    "hierarquiaControle": "engenharia", "justificativaHierarquia": "...",',
    '    "alternativasSuperioresAvaliadas": null,',
    '    "indicadorSugerido": {"nome":"...","metodoMedicao":"...","meta":"..."},',
    '    "riscoResidualEsperado": "...", "alertas": [] }],',
    '  "perfilPlano": {"proporcaoControlesFracos": 0.0, "desafio": null},',
    '  "evidencias_favoraveis": [], "evidencias_contrarias": [], "citacoes": [],',
    '  "premissas": [], "confianca": "media", "limitacoes": [],',
    '  "proximas_diligencias": [], "requer_validacao_humana": true }',
  ].join('\n'),

  montarTarefa(e) {
    return [
      'Proponha ações para os fatores confirmados abaixo.',
      ...e.fatores.map(
        (f) =>
          `${f.identificador} [${f.codigo}] ${f.descricaoContextual} — mecanismo: ${f.mecanismo ?? '(não informado)'}`,
      ),
    ].join('\n');
  },

  heuristica(entrada) {
    const propostas: PropostaRecomendacao[] = [];

    for (const fator of entrada.fatores) {
      const cat = obterCodigo(fator.codigo);
      const coluna = cat ? GRUPO_PARA_COLUNA[cat.grupo] : undefined;
      const nivel = (coluna && NIVEL_SUGERIDO_POR_COLUNA[coluna]) ?? 'administrativa';

      const alertas: string[] = [
        'Proposta gerada como ponto de partida a partir do fator e da coluna ICAM. O conteúdo técnico da ação deve ser definido por quem conhece o processo.',
      ];
      if (coluna === 'acoes' || coluna === 'fatores_humanos') {
        alertas.push(
          'Fator na coluna de ação individual ou fator humano: trate a condição que tornou o desvio possível, não apenas a pessoa. Verifique defesas, condições da tarefa e governança.',
        );
      }
      if (fator.estadoBarreira === 'ausente') {
        alertas.push(
          'A barreira está ausente: avalie implantação física ou de projeto antes de recorrer a controle administrativo.',
        );
      }
      if (fator.estadoBarreira === 'falha') {
        alertas.push(
          'A barreira existe mas falhou: investigue confiabilidade, manutenção, teste periódico e possibilidade de bypass.',
        );
      }

      propostas.push({
        classificacaoIds: [fator.classificacaoId],
        mecanismoRiscoAlvo:
          fator.mecanismo?.trim() ||
          'MECANISMO NÃO INFORMADO — descreva o mecanismo de risco que a ação deve modificar.',
        acaoProposta: `[RASCUNHO] Ação para tratar ${fator.identificador} (${fator.codigo}): ${resumir(fator.descricaoContextual)}`,
        objetivo: `Eliminar ou reduzir o mecanismo de risco associado a ${fator.identificador}.`,
        resultadoEsperado:
          'Condição verificável após a implementação, medida pelo indicador definido abaixo.',
        hierarquiaControle: nivel,
        justificativaHierarquia:
          `Nível sugerido a partir da coluna ICAM "${coluna ?? 'não identificada'}". ` +
          'A escolha final deve ser justificada pelo investigador com base na viabilidade técnica e na energia do perigo.',
        alternativasSuperioresAvaliadas: null,
        indicadorSugerido: {
          nome: `Verificação de eficácia — ${fator.identificador}`,
          metodoMedicao:
            'DEFINIR: como o resultado será medido (auditoria de campo, registro de sistema, teste funcional, inspeção).',
          meta: 'DEFINIR: valor ou condição que caracteriza eficácia.',
        },
        riscoResidualEsperado:
          'DEFINIR: risco que permanece após a implementação e como será monitorado.',
        alertas,
      });
    }

    const niveis = [
      ...(entrada.hierarquiasExistentes ?? []),
      ...propostas.map((p) => p.hierarquiaControle),
    ];
    const perfil = perfilarPlano(niveis);
    const desafios = propostas
      .map((p) => desafiarEscolha(p.hierarquiaControle, p.alternativasSuperioresAvaliadas))
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const base = baseAnalitica(
      propostas.length > 0
        ? `${propostas.length} rascunho(s) de ação vinculado(s) a fatores. Nenhum foi criado ou aprovado automaticamente.`
        : 'Nenhum fator confirmado foi informado; não há ação a propor.',
      'inferencia',
    );

    return {
      ...base,
      tipo: 'inferencia' as const,
      propostas,
      perfilPlano: {
        proporcaoControlesFracos: perfil.proporcaoFraca,
        desafio: perfil.equilibrado
          ? desafios.length > 0
            ? desafios[0]?.mensagem ?? null
            : null
          : perfil.observacao,
      },
      confianca: 'baixa' as const,
      premissas: [
        'A ação técnica não pode ser derivada do catálogo: apenas o ponto de partida e as exigências formais foram gerados.',
      ],
      limitacoes: [
        'Os textos marcados como [RASCUNHO] e DEFINIR precisam ser preenchidos por quem conhece o processo.',
        'Indicador, meta e risco residual não são inferidos: exigir preenchimento é intencional.',
      ],
      proximas_diligencias: [
        'Definir a ação técnica concreta para cada fator.',
        'Avaliar explicitamente eliminação, substituição e engenharia antes de aceitar controle administrativo.',
        'Atribuir responsável, prazo e critério de eficácia a cada ação.',
      ],
      requer_validacao_humana: true as const,
    };
  },
};

function resumir(texto: string, limite = 120): string {
  const t = texto.trim();
  return t.length <= limite ? t : `${t.slice(0, limite - 1)}…`;
}
