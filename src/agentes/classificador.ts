import { GRUPO_PARA_COLUNA } from '../domain/enumeracoes';
import { buscarCodigos, obterCodigo } from '../domain/taxonomia/catalogo';
import {
  respostaClassificador,
  type AlternativaClassificacao,
  type RespostaClassificador,
} from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';

/**
 * Agente 6 — Classificador ICAM.
 *
 * Regras do prompt mestre que este agente materializa:
 *   - devolve SEMPRE alternativas ranqueadas, nunca um rótulo único;
 *   - exige evidência e mecanismo: semelhança textual não classifica (3.10);
 *   - explica por que não escolheu os códigos próximos;
 *   - permite classificação incerta e nunca força um código (3.12);
 *   - marca códigos genéricos e sensíveis com alerta explícito.
 */

export interface EntradaClassificador {
  /** Texto do achado a classificar (descrição contextual). */
  descricao: string;
  /** Mecanismo declarado pelo investigador, se houver. */
  mecanismo: string | null;
  /** Referências de evidência já vinculadas ao achado. */
  evidencias: { tipo: 'evidencia' | 'declaracao' | 'fato' | 'evento'; id: string; localizador?: string }[];
  /** Restringe a busca a uma coluna, quando o investigador já decidiu. */
  colunaPreferida?: string | null;
  limite?: number;
}

const LIMIAR_CONFIANCA_ALTA = 6;
const LIMIAR_CONFIANCA_MEDIA = 3;

export const agenteClassificador: DefinicaoAgente<EntradaClassificador, RespostaClassificador> = {
  nome: 'classificador',
  esquemaSaida: respostaClassificador,

  instrucao: [
    'Você é o agente classificador ICAM de uma plataforma de investigação de incidentes.',
    'Sua função é PROPOR alternativas de código, ranqueadas, para um achado descrito pelo investigador.',
    '',
    'Você NUNCA:',
    '- escolhe um único código como se fosse decisão final;',
    '- classifica com base em semelhança textual entre a descrição e o título do código;',
    '- atribui culpa ou encerra a análise no executante;',
    '- infere fadiga, uso de substâncias, condição de saúde ou problema pessoal a partir de',
    '  comportamento, linguagem ou aparência;',
    '- inventa evidência para sustentar um código.',
    '',
    'Você SEMPRE:',
    '- exige evidência e mecanismo para cada alternativa;',
    '- explica por que não escolheu os códigos próximos;',
    '- marca classificacaoIncerta=true quando a evidência não sustenta nenhuma alternativa;',
    '- prefere código específico a código genérico ("Outro").',
  ].join('\n'),

  formatoEsperado: [
    '{',
    '  "resposta": "texto curto explicando a proposta",',
    '  "tipo": "inferencia",',
    '  "alternativas": [{',
    '    "codigo": "DF08", "titulo": "...", "coluna": "defesas", "posicao": 1,',
    '    "evidencia": [{"tipo":"evidencia","id":"...","localizador":"p. 3"}],',
    '    "mecanismo": "como este fator contribuiu para o evento",',
    '    "regraInclusaoAtendida": "...", "motivoNaoEscolherProximos": "...",',
    '    "confianca": "baixa|media|alta", "alertas": []',
    '  }],',
    '  "classificacaoIncerta": false, "motivoIncerteza": null,',
    '  "evidencias_favoraveis": [], "evidencias_contrarias": [], "citacoes": [],',
    '  "premissas": [], "confianca": "baixa|media|alta", "limitacoes": [],',
    '  "proximas_diligencias": [], "requer_validacao_humana": true',
    '}',
  ].join('\n'),

  montarTarefa(e) {
    return [
      'Proponha alternativas de código ICAM para o achado abaixo.',
      `Descrição: ${e.descricao}`,
      `Mecanismo declarado: ${e.mecanismo ?? '(não informado)'}`,
      `Evidências vinculadas: ${e.evidencias.length}`,
      e.colunaPreferida ? `Coluna indicada pelo investigador: ${e.colunaPreferida}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },

  heuristica(entrada) {
    const limite = entrada.limite ?? 5;
    const acertos = buscarCodigos(
      `${entrada.descricao} ${entrada.mecanismo ?? ''}`,
      limite * 3,
    ).filter((a) =>
      entrada.colunaPreferida
        ? GRUPO_PARA_COLUNA[a.codigo.grupo] === entrada.colunaPreferida
        : true,
    );

    const semEvidencia = entrada.evidencias.length === 0;
    const semMecanismo = !entrada.mecanismo || entrada.mecanismo.trim().length < 15;

    const alternativas: AlternativaClassificacao[] = [];
    const selecionados = acertos.slice(0, limite);

    for (let i = 0; i < selecionados.length; i += 1) {
      const acerto = selecionados[i];
      if (!acerto) continue;
      const proximos = selecionados
        .slice(i + 1, i + 3)
        .map((p) => `${p.codigo.codigo} (${p.codigo.titulo})`);

      const alertas: string[] = [];
      if (acerto.codigo.codigoGenerico) {
        alertas.push(
          'Código genérico. Só use se nenhum código específico do grupo se aplicar, e registre a justificativa.',
        );
      }
      if (acerto.codigo.dadoSensivel) {
        alertas.push(
          'Código sensível: exige evidência objetiva e robusta. Não pode ser inferido de comportamento, linguagem ou aparência.',
        );
      }
      if (acerto.codigo.definicao === null) {
        alertas.push(
          'A definição integral deste código ainda não foi importada do documento de origem. Confira o sentido técnico antes de confirmar.',
        );
      }
      if (GRUPO_PARA_COLUNA[acerto.codigo.grupo] === 'acoes') {
        alertas.push(
          'Coluna de ações individuais: reconstrua objetivo, informação disponível, condições e expectativa de trabalho, e distinga erro de violação antes de confirmar.',
        );
      }
      alertas.push(
        'Correspondência obtida por termos do catálogo. Semelhança textual não classifica: confirme evidência e mecanismo.',
      );

      const coluna = GRUPO_PARA_COLUNA[acerto.codigo.grupo];
      if (!coluna) continue;

      alternativas.push({
        codigo: acerto.codigo.codigo,
        titulo: acerto.codigo.titulo,
        coluna,
        posicao: i + 1,
        evidencia: entrada.evidencias.map((ev) => ({
          tipo: ev.tipo,
          id: ev.id,
          ...(ev.localizador ? { localizador: ev.localizador } : {}),
        })),
        mecanismo:
          entrada.mecanismo?.trim() ||
          'MECANISMO NÃO INFORMADO — descreva como este fator contribuiu para o evento antes de confirmar.',
        regraInclusaoAtendida:
          acerto.codigo.regrasInclusao[0] ??
          `Termos do catálogo presentes na descrição: ${acerto.termosCasados.join(', ')}.`,
        motivoNaoEscolherProximos:
          proximos.length > 0
            ? `Alternativas próximas: ${proximos.join('; ')}. Foram posicionadas abaixo por menor aderência textual ao catálogo — a decisão final depende de evidência e mecanismo, não do ranqueamento.`
            : 'Não há alternativa próxima no catálogo com aderência comparável.',
        confianca:
          semEvidencia || semMecanismo
            ? 'baixa'
            : acerto.pontuacao >= LIMIAR_CONFIANCA_ALTA
              ? 'alta'
              : acerto.pontuacao >= LIMIAR_CONFIANCA_MEDIA
                ? 'media'
                : 'baixa',
        alertas,
      });
    }

    const incerta = alternativas.length === 0 || semEvidencia || semMecanismo;
    const motivos: string[] = [];
    if (alternativas.length === 0) {
      motivos.push('Nenhum código do catálogo apresentou aderência suficiente à descrição.');
    }
    if (semEvidencia) motivos.push('Nenhuma evidência foi vinculada ao achado.');
    if (semMecanismo) {
      motivos.push('O mecanismo pelo qual o fator contribuiu para o evento não foi descrito.');
    }

    const base = baseAnalitica(
      alternativas.length > 0
        ? `${alternativas.length} alternativa(s) de código ICAM proposta(s) para revisão humana. Nenhuma foi aplicada.`
        : 'Não foi possível propor código: a descrição não apresenta aderência suficiente ao catálogo.',
      'inferencia',
    );

    return {
      ...base,
      tipo: 'inferencia' as const,
      alternativas,
      classificacaoIncerta: incerta,
      motivoIncerteza: motivos.length > 0 ? motivos.join(' ') : null,
      confianca: incerta ? ('baixa' as const) : ('media' as const),
      premissas: [
        'A proposta usa apenas o texto informado e o catálogo ICAM carregado.',
        'O catálogo está com definições pendentes de importação do documento de origem, o que limita a checagem de regras de inclusão.',
      ],
      limitacoes: [
        'Correspondência determinística por termos, sem leitura semântica das evidências.',
        'Nenhuma alternativa é aplicada automaticamente: a classificação exige decisão humana registrada.',
      ],
      proximas_diligencias: [
        ...(semEvidencia ? ['Vincular ao menos uma evidência favorável ao achado.'] : []),
        ...(semMecanismo ? ['Descrever o mecanismo causal do fator.'] : []),
        'Conferir a definição integral do código escolhido no catálogo antes de confirmar.',
      ],
      requer_validacao_humana: true as const,
    };
  },
};

/**
 * Confere se um código proposto pode ser confirmado. Usado pela API antes de
 * gravar uma classificação com estado "confirmado".
 */
export interface BloqueioConfirmacao {
  motivo: string;
  regra: string;
}

export function bloqueiosParaConfirmar(params: {
  codigo: string;
  mecanismo: string | null;
  quantidadeEvidenciasFavoraveis: number;
  temFonteObjetiva: boolean;
  justificativaGenerico: string | null;
}): BloqueioConfirmacao[] {
  const bloqueios: BloqueioConfirmacao[] = [];
  const cat = obterCodigo(params.codigo);

  if (!cat) {
    bloqueios.push({ regra: 'CODIGO_INEXISTENTE', motivo: `Código ${params.codigo} não existe no catálogo.` });
    return bloqueios;
  }
  if (params.quantidadeEvidenciasFavoraveis === 0) {
    bloqueios.push({
      regra: 'ACHADO_SEM_EVIDENCIA',
      motivo: 'Não é possível confirmar um fator sem nenhuma evidência favorável vinculada.',
    });
  }
  if (!params.mecanismo || params.mecanismo.trim().length < 15) {
    bloqueios.push({
      regra: 'FATOR_SEM_MECANISMO',
      motivo: 'Descreva o mecanismo pelo qual o fator contribuiu para o evento.',
    });
  }
  if (cat.codigoGenerico && !params.justificativaGenerico?.trim()) {
    bloqueios.push({
      regra: 'CODIGO_OUTRO_SEM_JUSTIFICATIVA',
      motivo: `O código ${cat.codigo} é genérico. Justifique por que nenhum código específico do grupo se aplica.`,
    });
  }
  if (cat.dadoSensivel && !params.temFonteObjetiva) {
    bloqueios.push({
      regra: 'SENSIVEL_SEM_EVIDENCIA_ROBUSTA',
      motivo: `O código ${cat.codigo} envolve dado sensível e exige evidência objetiva (medição, registro ou documento), não apenas relato.`,
    });
  }
  return bloqueios;
}
