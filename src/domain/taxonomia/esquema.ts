import { z } from 'zod';

/**
 * Esquema do catálogo ICAM versionado (`data/icam-taxonomy.pt-BR.json`).
 *
 * Regra inegociável (princípio 3.1): `definicao` pode ser `null`. Uma definição
 * ausente é um estado legítimo e explícito — nunca deve ser preenchida por
 * geração de modelo. O importador `scripts/importar-taxonomia-docx.ts` é o
 * único caminho autorizado para preencher definições, e ele exige proveniência.
 */

export const proveniencia = z.object({
  arquivo: z.string(),
  hashSha256: z.string(),
  metodoExtracao: z.string(),
  extraidoEm: z.string(),
  localizacao: z.string(),
  trecho: z.string().optional(),
  confianca: z.enum(['baixa', 'media', 'alta']),
  escopo: z.string().optional(),
  observacao: z.string().optional(),
});
export type Proveniencia = z.infer<typeof proveniencia>;

export const codigoCatalogo = z.object({
  codigo: z.string().min(2),
  grupo: z.enum([
    'defesas_ausentes_ou_falhas',
    'acoes_individuais_ou_equipe',
    'condicoes_tarefa_ambiente',
    'fatores_humanos',
    'fatores_organizacionais',
  ]),
  subgrupo: z.string().optional(),
  titulo: z.string().min(1),
  definicao: z.string().nullable(),
  /**
   * PENDENTE_EXTRACAO_DOCX — a fonte ainda não foi importada.
   * IMPORTADA            — definição extraída da fonte, aguardando conferência.
   * SEM_DEFINICAO_NA_FONTE — o código existe no documento, mas o documento não
   *   fornece definição além do rótulo. É um fato sobre a fonte, não uma falha
   *   de extração, e não autoriza preencher a definição por outros meios.
   * CONFERIDA            — definição conferida por pessoa contra as imagens.
   */
  definicaoStatus: z.enum([
    'PENDENTE_EXTRACAO_DOCX',
    'IMPORTADA',
    'SEM_DEFINICAO_NA_FONTE',
    'CONFERIDA',
  ]),
  exemplos: z.array(z.string()),
  termosRelacionados: z.array(z.string()),
  regrasInclusao: z.array(z.string()),
  regrasExclusao: z.array(z.string()),
  codigoGenerico: z.boolean().optional().default(false),
  exigeEstadoBarreira: z.boolean().optional().default(false),
  estadosBarreiraPermitidos: z.array(z.string()).optional(),
  exigeReconstrucaoDeContexto: z.boolean().optional().default(false),
  exigeDistincaoErroViolacao: z.boolean().optional().default(false),
  dadoSensivel: z.boolean().optional().default(false),
  nivelEvidenciaMinimo: z.enum(['suficiente', 'robusta']).optional().default('suficiente'),
  fonte: proveniencia,
  requerConferenciaHumana: z.boolean(),
});
export type CodigoCatalogo = z.infer<typeof codigoCatalogo>;

export const grupoCatalogo = z.object({
  id: z.string(),
  ordem: z.number().int(),
  coluna: z.number().int().min(1).max(4),
  titulo: z.string(),
  prefixo: z.string(),
  total: z.number().int(),
  subgrupos: z.array(z.object({ id: z.string(), titulo: z.string() })),
  regras: z.array(z.string()),
});
export type GrupoCatalogo = z.infer<typeof grupoCatalogo>;

export const catalogoIcam = z
  .object({
    schemaVersao: z.string(),
    id: z.string(),
    idioma: z.literal('pt-BR'),
    versao: z.string(),
    geradoEm: z.string(),
    totalCodigos: z.number().int(),
    estadoDefinicoes: z.enum(['INCOMPLETO', 'PARCIAL', 'COMPLETO']),
    avisoProveniencia: z.string(),
    fontesPendentes: z.array(
      z.object({ arquivo: z.string(), papel: z.string(), status: z.string() }),
    ),
    grupos: z.array(grupoCatalogo),
    codigos: z.array(codigoCatalogo),
  })
  .superRefine((cat, ctx) => {
    if (cat.codigos.length !== cat.totalCodigos) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `totalCodigos (${cat.totalCodigos}) não confere com a quantidade de códigos (${cat.codigos.length}).`,
      });
    }
    const vistos = new Set<string>();
    for (const c of cat.codigos) {
      if (vistos.has(c.codigo)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Código duplicado: ${c.codigo}.` });
      }
      vistos.add(c.codigo);
    }
    for (const g of cat.grupos) {
      const qtd = cat.codigos.filter((c) => c.grupo === g.id).length;
      if (qtd !== g.total) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Grupo ${g.id}: esperado ${g.total} códigos, encontrado ${qtd}.`,
        });
      }
    }
  });

export type CatalogoIcam = z.infer<typeof catalogoIcam>;

/** Quantidade total exigida pela seção 5 do prompt mestre. */
export const TOTAL_CODIGOS_ESPERADO = 101;

/** Distribuição exigida por grupo. */
export const DISTRIBUICAO_ESPERADA: Record<string, number> = {
  defesas_ausentes_ou_falhas: 21,
  acoes_individuais_ou_equipe: 14,
  condicoes_tarefa_ambiente: 24,
  fatores_humanos: 26,
  fatores_organizacionais: 16,
};
