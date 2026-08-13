import { z } from 'zod';
import { AGENTES, HIERARQUIA_CONTROLE, TIPOS_RELACAO_CAUSAL } from '../domain/enumeracoes';

/**
 * Contrato de saída obrigatório para toda resposta analítica de agente
 * (seção 6 do prompt mestre).
 *
 * Nenhuma saída entra no sistema sem passar por este esquema. Saída fora do
 * contrato é REJEITADA e registrada como erro — nunca "consertada" por
 * heurística, porque consertar é inventar.
 */

export const citacao = z.object({
  evidenciaId: z.string().min(1),
  localizador: z.string().min(1, 'Toda citação exige localizador (página, slide, célula, timestamp).'),
  trecho: z.string().optional(),
});
export type Citacao = z.infer<typeof citacao>;

export const referenciaEvidencia = z.object({
  tipo: z.enum(['evidencia', 'declaracao', 'fato', 'evento']),
  id: z.string().min(1),
  localizador: z.string().optional(),
  observacao: z.string().optional(),
});
export type ReferenciaEvidencia = z.infer<typeof referenciaEvidencia>;

export const respostaAnalitica = z.object({
  resposta: z.string().min(1),
  tipo: z.enum(['fato', 'declaracao', 'inferencia', 'hipotese', 'conflito', 'lacuna']),
  evidencias_favoraveis: z.array(referenciaEvidencia),
  evidencias_contrarias: z.array(referenciaEvidencia),
  citacoes: z.array(citacao),
  premissas: z.array(z.string()),
  confianca: z.enum(['baixa', 'media', 'alta']),
  limitacoes: z.array(z.string()),
  proximas_diligencias: z.array(z.string()),
  requer_validacao_humana: z.literal(true),
});
export type RespostaAnalitica = z.infer<typeof respostaAnalitica>;

/**
 * Alternativa de classificação ICAM. O classificador NUNCA devolve um rótulo
 * único: devolve alternativas ranqueadas com o motivo de não escolher as
 * próximas (seção 6).
 */
export const alternativaClassificacao = z.object({
  codigo: z.string().min(2),
  titulo: z.string(),
  coluna: z.enum([
    'defesas',
    'acoes',
    'condicoes_tarefa_ambiente',
    'fatores_humanos',
    'fatores_organizacionais',
  ]),
  posicao: z.number().int().min(1),
  evidencia: z.array(referenciaEvidencia),
  mecanismo: z.string().min(1, 'Mecanismo é obrigatório: semelhança textual não classifica.'),
  regraInclusaoAtendida: z.string(),
  motivoNaoEscolherProximos: z.string(),
  confianca: z.enum(['baixa', 'media', 'alta']),
  alertas: z.array(z.string()),
});
export type AlternativaClassificacao = z.infer<typeof alternativaClassificacao>;

export const respostaClassificador = respostaAnalitica.extend({
  tipo: z.literal('inferencia'),
  alternativas: z
    .array(alternativaClassificacao)
    .min(1, 'O classificador deve devolver ao menos uma alternativa ranqueada.'),
  classificacaoIncerta: z.boolean(),
  motivoIncerteza: z.string().nullable(),
});
export type RespostaClassificador = z.infer<typeof respostaClassificador>;

export const propostaConflito = z.object({
  titulo: z.string().min(1),
  tipo: z.enum([
    'relato_vs_telemetria',
    'procedimento_vs_manutencao',
    'parametro_documentado_vs_configurado',
    'data_vs_relogio',
    'checklist_vs_evidencia_tecnica',
    'registro_incompleto',
    'outro',
  ]),
  descricao: z.string().min(1),
  itens: z
    .array(
      z.object({
        rotulo: z.string(),
        valorRelatado: z.string(),
        referencia: referenciaEvidencia.nullable(),
        confiabilidadeFonte: z.enum(['baixa', 'media', 'alta', 'nao_avaliada']),
        justificativaConfiabilidade: z.string(),
      }),
    )
    .min(2, 'Um conflito exige ao menos duas versões preservadas.'),
  diligenciasRecomendadas: z.array(z.string()),
  /** O agente jamais escolhe a versão vencedora: isso é decisão humana. */
  versaoEscolhida: z.null(),
});
export type PropostaConflito = z.infer<typeof propostaConflito>;

export const propostaRecomendacao = z.object({
  classificacaoIds: z.array(z.string()).min(1, 'Recomendação exige vínculo com fator confirmado.'),
  mecanismoRiscoAlvo: z.string().min(1),
  acaoProposta: z.string().min(1),
  objetivo: z.string().min(1),
  resultadoEsperado: z.string(),
  hierarquiaControle: z.enum(HIERARQUIA_CONTROLE),
  justificativaHierarquia: z.string().min(1),
  alternativasSuperioresAvaliadas: z.string().nullable(),
  indicadorSugerido: z.object({
    nome: z.string(),
    metodoMedicao: z.string(),
    meta: z.string(),
  }),
  riscoResidualEsperado: z.string(),
  alertas: z.array(z.string()),
});
export type PropostaRecomendacao = z.infer<typeof propostaRecomendacao>;

export const respostaRecomendacoes = respostaAnalitica.extend({
  tipo: z.literal('inferencia'),
  propostas: z.array(propostaRecomendacao),
  perfilPlano: z.object({
    proporcaoControlesFracos: z.number(),
    desafio: z.string().nullable(),
  }),
});
export type RespostaRecomendacoes = z.infer<typeof respostaRecomendacoes>;

export const respostaPergunta = z.object({
  pergunta: z.string().min(1),
  objetivo: z.string(),
  origem: z.enum(['lacuna', 'hipotese', 'conflito', 'peepo', 'exploratoria']),
  origemId: z.string().nullable(),
  alertaIndutiva: z.string().nullable(),
});
export type RespostaPergunta = z.infer<typeof respostaPergunta>;

export const respostaPeepo = respostaAnalitica.extend({
  tipo: z.literal('hipotese'),
  itens: z.array(
    z.object({
      dimensao: z.enum(['pessoas', 'ambiente', 'equipamentos', 'procedimentos', 'organizacao']),
      perguntaInvestigativa: z.string().min(1),
      evidenciaEsperada: z.string().min(1),
      prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
      vinculo: z.object({ tipo: z.enum(['hipotese', 'lacuna', 'nenhum']), id: z.string().nullable() }),
    }),
  ),
  perguntasEntrevista: z.array(respostaPergunta),
  coberturaPorDimensao: z.record(z.string(), z.number()),
});
export type RespostaPeepo = z.infer<typeof respostaPeepo>;

export const respostaCausalidade = respostaAnalitica.extend({
  tipo: z.literal('inferencia'),
  relacoes: z.array(
    z.object({
      origemId: z.string(),
      destinoId: z.string(),
      tipo: z.enum(TIPOS_RELACAO_CAUSAL),
      afirmacaoTestavel: z.string().min(1),
      grauSustentacao: z.enum(['nao_avaliado', 'fraco', 'moderado', 'forte']),
      evidenciasResumo: z.string(),
    }),
  ),
  barreirasAnalisadas: z.array(
    z.object({
      classificacaoId: z.string(),
      estadoBarreira: z.enum(['ausente', 'falha', 'incerto', 'nao_aplicavel']),
      justificativa: z.string(),
      contrafactual: z.string(),
    }),
  ),
});
export type RespostaCausalidade = z.infer<typeof respostaCausalidade>;

export const respostaRevisor = z.object({
  aprovadoParaRevisaoHumana: z.boolean(),
  bloqueios: z.array(
    z.object({ regra: z.string(), mensagem: z.string(), entidadeId: z.string().nullable() }),
  ),
  alertas: z.array(
    z.object({ regra: z.string(), mensagem: z.string(), entidadeId: z.string().nullable() }),
  ),
  linguagemCulpabilizadora: z.array(z.object({ trecho: z.string(), sugestao: z.string() })),
  dadosSensiveisDetectados: z.array(z.string()),
  observacoes: z.array(z.string()),
});
export type RespostaRevisor = z.infer<typeof respostaRevisor>;

// ---------------------------------------------------------------------------
// Registro de execução
// ---------------------------------------------------------------------------

export const nomeAgente = z.enum(AGENTES);

export interface RegistroExecucao {
  agente: (typeof AGENTES)[number];
  provedor: string;
  modelo: string | null;
  parametros: Record<string, unknown>;
  entradaHash: string;
  entradaResumo: string;
  saida: unknown;
  citacoesValidadas: boolean;
  sinalizacoes: string[];
  duracaoMs: number;
  erro: string | null;
}

/**
 * Valida a saída de um agente contra o contrato. Retorna erro estruturado em
 * vez de lançar, para que a falha possa ser auditada e mostrada ao usuário.
 */
export function validarSaida<T extends z.ZodTypeAny>(
  esquema: T,
  dados: unknown,
): { ok: true; dados: z.infer<T> } | { ok: false; erros: string[] } {
  const r = esquema.safeParse(dados);
  if (r.success) return { ok: true, dados: r.data };
  return {
    ok: false,
    erros: r.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`),
  };
}

/**
 * Valida que toda citação aponta para evidência existente com localizador.
 * Impede a classe de erro mais grave do produto: citação inexistente.
 */
export function validarCitacoes(
  citacoes: readonly Citacao[],
  evidenciasExistentes: ReadonlySet<string>,
): { validas: boolean; problemas: string[] } {
  const problemas: string[] = [];
  for (const c of citacoes) {
    if (!evidenciasExistentes.has(c.evidenciaId)) {
      problemas.push(`Citação aponta para evidência inexistente: ${c.evidenciaId}.`);
    }
    if (!c.localizador?.trim()) {
      problemas.push(`Citação da evidência ${c.evidenciaId} está sem localizador.`);
    }
  }
  return { validas: problemas.length === 0, problemas };
}
