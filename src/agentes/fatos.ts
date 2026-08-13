import { z } from 'zod';
import { respostaAnalitica } from './contratos';
import { baseAnalitica, type DefinicaoAgente } from './nucleo';

/**
 * Agente 3 — Fatos e citações.
 *
 * Converte trechos de evidência em proposições atômicas CANDIDATAS, cada uma
 * com citação obrigatória. Nada vira fato: tudo nasce como candidato e exige
 * decisão humana. O agente também classifica o tipo de asserção — a distinção
 * entre medição, declaração e inferência é o que sustenta todo o resto.
 */

export const fatoCandidato = z.object({
  proposicao: z.string().min(1),
  tipoAssercao: z.enum([
    'fato_confirmado',
    'medicao_ou_registro',
    'declaracao_entrevistado',
    'informacao_terceiro',
    'inferencia_analitica',
    'hipotese',
    'informacao_contestada',
    'informacao_refutada',
    'lacuna_informacao',
  ]),
  citacao: z.object({
    evidenciaId: z.string().min(1),
    localizador: z.string().min(1),
    trecho: z.string(),
  }),
  alertas: z.array(z.string()),
});
export type FatoCandidato = z.infer<typeof fatoCandidato>;

export const respostaFatos = respostaAnalitica.extend({
  tipo: z.literal('fato'),
  candidatos: z.array(fatoCandidato),
  trechosDescartados: z.array(z.object({ trecho: z.string(), motivo: z.string() })),
});
export type RespostaFatos = z.infer<typeof respostaFatos>;

export interface TrechoEvidencia {
  evidenciaId: string;
  categoriaEvidencia: string;
  localizador: string;
  texto: string;
}

export interface EntradaFatos {
  trechos: TrechoEvidencia[];
}

/** Marcadores linguísticos de inferência, opinião e incerteza. */
const MARCADORES = {
  inferencia: /\b(portanto|logo|conclu[íi]|indica que|sugere que|provavelmente|deve ter|teria|acredito|penso|imagino|aparentemente|possivelmente)\b/i,
  declaracao: /\b(relatou|declarou|informou|disse|afirmou|segundo o|conforme relato|de acordo com o operador)\b/i,
  terceiro: /\b(ouvi dizer|me contaram|comentaram|soube por|segundo terceiros)\b/i,
  medicao: /\b(\d+[.,]?\d*)\s*(km\/h|m\/s|kg|t|ton|bar|psi|°c|graus|%|mm|cm|m|min|h|s|rpm|v|a|kw)(?!\w)/i,
  registro: /\b(registr\w*|log|telemetria|ordem de manuten[çc][ãa]o|nota|checklist|leitura)\b/i,
  culpa: /\b(neglig|descuid|desaten|imprud|culpa|falha humana|erro humano)\b/i,
  juizo: /\b(inadequad|insuficiente|precário|ruim|excelente|correto|incorreto|deveria ter)\b/i,
};

export const agenteFatos: DefinicaoAgente<EntradaFatos, RespostaFatos> = {
  nome: 'fatos',
  esquemaSaida: respostaFatos,

  instrucao: [
    'Você é o agente de fatos e citações de uma plataforma de investigação ICAM.',
    '',
    'Transforme cada trecho de evidência em proposições ATÔMICAS e verificáveis.',
    'Uma proposição atômica afirma uma única coisa, sem juízo de valor e sem conclusão.',
    '',
    'Classifique o tipo de asserção com rigor: medição/registro, declaração de entrevistado,',
    'informação de terceiro, inferência, hipótese ou lacuna. Nunca marque como fato aquilo',
    'que é inferência ou relato isolado.',
    'Toda proposição deve trazer citação com id de evidência e localizador reais.',
    'Se um trecho não permitir proposição verificável, descarte-o e explique o motivo.',
  ].join('\n'),

  formatoEsperado: [
    '{ "resposta": "...", "tipo": "fato",',
    '  "candidatos": [{"proposicao":"...","tipoAssercao":"medicao_ou_registro",',
    '    "citacao":{"evidenciaId":"...","localizador":"p. 4","trecho":"..."},"alertas":[]}],',
    '  "trechosDescartados": [{"trecho":"...","motivo":"..."}],',
    '  "evidencias_favoraveis": [], "evidencias_contrarias": [], "citacoes": [],',
    '  "premissas": [], "confianca": "media", "limitacoes": [],',
    '  "proximas_diligencias": [], "requer_validacao_humana": true }',
  ].join('\n'),

  montarTarefa(e) {
    return `Extraia proposições atômicas candidatas de ${e.trechos.length} trecho(s) de evidência.`;
  },

  heuristica(entrada) {
    const candidatos: FatoCandidato[] = [];
    const descartados: { trecho: string; motivo: string }[] = [];

    for (const t of entrada.trechos) {
      for (const sentenca of dividirSentencas(t.texto)) {
        if (sentenca.length < 15) {
          descartados.push({ trecho: sentenca, motivo: 'Trecho curto demais para formar proposição verificável.' });
          continue;
        }

        const alertas: string[] = [];
        let tipo: FatoCandidato['tipoAssercao'];

        if (MARCADORES.terceiro.test(sentenca)) {
          tipo = 'informacao_terceiro';
        } else if (MARCADORES.inferencia.test(sentenca)) {
          tipo = 'inferencia_analitica';
          alertas.push('Marcadores de inferência detectados. Não pode ser apresentado como fato.');
        } else if (MARCADORES.declaracao.test(sentenca)) {
          tipo = 'declaracao_entrevistado';
          alertas.push('Declaração isolada não corrobora conclusão. Busque medição, registro ou documento.');
        } else if (MARCADORES.medicao.test(sentenca) || MARCADORES.registro.test(sentenca)) {
          tipo = 'medicao_ou_registro';
        } else {
          tipo = 'declaracao_entrevistado';
          alertas.push(
            'Tipo de asserção não determinado pelo texto. Confirme a natureza antes de usar como base de conclusão.',
          );
        }

        if (MARCADORES.culpa.test(sentenca)) {
          alertas.push('Linguagem culpabilizadora no trecho de origem. Reescreva a proposição em termos descritivos.');
        }
        if (MARCADORES.juizo.test(sentenca)) {
          alertas.push('Juízo de valor detectado. Uma proposição atômica descreve, não avalia.');
        }
        if (/\be\b.*\be\b|\bal[ée]m disso\b|;/.test(sentenca) && sentenca.length > 160) {
          alertas.push('Possível proposição composta. Considere dividir em proposições atômicas.');
        }

        candidatos.push({
          proposicao: sentenca.trim(),
          tipoAssercao: tipo,
          citacao: { evidenciaId: t.evidenciaId, localizador: t.localizador, trecho: sentenca.trim() },
          alertas,
        });
      }
    }

    const base = baseAnalitica(
      `${candidatos.length} proposição(ões) candidata(s) extraída(s) com citação. Nenhuma foi registrada como fato.`,
      'fato',
    );

    return {
      ...base,
      tipo: 'fato' as const,
      candidatos,
      trechosDescartados: descartados,
      citacoes: candidatos.map((c) => c.citacao),
      confianca: 'baixa' as const,
      premissas: [
        'A extração é textual: cada proposição reproduz o trecho de origem, sem reescrita interpretativa.',
      ],
      limitacoes: [
        'A classificação do tipo de asserção usa marcadores linguísticos e precisa de confirmação humana.',
        'Proposições compostas podem exigir divisão manual.',
      ],
      proximas_diligencias: [
        'Revisar cada candidato, ajustar a proposição e confirmar o tipo de asserção.',
        'Vincular evidências contrárias quando existirem.',
      ],
      requer_validacao_humana: true as const,
    };
  },
};

export function dividirSentencas(texto: string): string[] {
  return texto
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
