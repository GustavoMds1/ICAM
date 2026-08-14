/**
 * Conjuntos fechados do domínio.
 *
 * O schema Prisma guarda estes valores como texto para manter portabilidade
 * entre SQLite e PostgreSQL. A garantia de integridade vive aqui e é aplicada
 * por Zod em toda fronteira de escrita (`src/domain/esquemas.ts`).
 */

export const TIPOS_ASSERCAO = [
  'fato_confirmado',
  'medicao_ou_registro',
  'declaracao_entrevistado',
  'informacao_terceiro',
  'inferencia_analitica',
  'hipotese',
  'informacao_contestada',
  'informacao_refutada',
  'lacuna_informacao',
] as const;
export type TipoAssercao = (typeof TIPOS_ASSERCAO)[number];

/** Tipos que podem sustentar uma conclusão sem corroboração adicional. */
export const TIPOS_ASSERCAO_FACTUAIS: readonly TipoAssercao[] = [
  'fato_confirmado',
  'medicao_ou_registro',
];

/** Tipos que NUNCA podem ser apresentados como fato em relatório. */
export const TIPOS_ASSERCAO_NAO_FACTUAIS: readonly TipoAssercao[] = [
  'inferencia_analitica',
  'hipotese',
  'informacao_contestada',
  'informacao_refutada',
  'lacuna_informacao',
];

export const NIVEIS_CONFIANCA = ['baixa', 'media', 'alta', 'nao_avaliada'] as const;
export type NivelConfianca = (typeof NIVEIS_CONFIANCA)[number];

export const NIVEIS_SEVERIDADE = [
  'nao_classificada',
  'insignificante',
  'menor',
  'moderada',
  'maior',
  'catastrofica',
] as const;
export type NivelSeveridade = (typeof NIVEIS_SEVERIDADE)[number];

export const DIMENSOES_PEEPO = [
  'pessoas',
  'ambiente',
  'equipamentos',
  'procedimentos',
  'organizacao',
] as const;
export type DimensaoPeepo = (typeof DIMENSOES_PEEPO)[number];

export const ROTULOS_PEEPO: Record<DimensaoPeepo, string> = {
  pessoas: 'Pessoas',
  ambiente: 'Ambiente',
  equipamentos: 'Equipamentos',
  procedimentos: 'Procedimentos',
  organizacao: 'Organização',
};

export const COLUNAS_ICAM = [
  'defesas',
  'acoes',
  'condicoes_tarefa_ambiente',
  'fatores_humanos',
  'fatores_organizacionais',
] as const;
export type ColunaIcam = (typeof COLUNAS_ICAM)[number];

export const ROTULOS_COLUNA_ICAM: Record<ColunaIcam, string> = {
  defesas: 'Defesas ausentes ou falhas',
  acoes: 'Ações individuais ou em equipe',
  condicoes_tarefa_ambiente: 'Condições da tarefa e do ambiente',
  fatores_humanos: 'Fatores humanos',
  fatores_organizacionais: 'Fatores organizacionais',
};

/** Mapeia o grupo do catálogo para a coluna do gráfico ICAM. */
export const GRUPO_PARA_COLUNA: Record<string, ColunaIcam> = {
  defesas_ausentes_ou_falhas: 'defesas',
  acoes_individuais_ou_equipe: 'acoes',
  condicoes_tarefa_ambiente: 'condicoes_tarefa_ambiente',
  fatores_humanos: 'fatores_humanos',
  fatores_organizacionais: 'fatores_organizacionais',
};

export const ESTADOS_BARREIRA = ['ausente', 'falha', 'incerto', 'nao_aplicavel'] as const;
export type EstadoBarreira = (typeof ESTADOS_BARREIRA)[number];

export const ESTADOS_CLASSIFICACAO = [
  'candidato',
  'em_analise',
  'confirmado',
  'contestado',
  'rejeitado',
] as const;
export type EstadoClassificacao = (typeof ESTADOS_CLASSIFICACAO)[number];

export const NATUREZAS_FATOR = [
  'fato_constatado',
  'fator_contribuinte',
  'causa_sistemica',
  'oportunidade_melhoria_nao_causal',
  'nao_definida',
] as const;
export type NaturezaFator = (typeof NATUREZAS_FATOR)[number];

/** Naturezas que exigem tratamento por recomendação. */
export const NATUREZAS_QUE_EXIGEM_ACAO: readonly NaturezaFator[] = [
  'fator_contribuinte',
  'causa_sistemica',
];

export const HIERARQUIA_CONTROLE = [
  'eliminacao',
  'substituicao',
  'engenharia',
  'administrativa',
  'epi',
] as const;
export type HierarquiaControle = (typeof HIERARQUIA_CONTROLE)[number];

/** Força relativa do controle: maior é mais forte. Usado na seção 12. */
export const FORCA_CONTROLE: Record<HierarquiaControle, number> = {
  eliminacao: 5,
  substituicao: 4,
  engenharia: 3,
  administrativa: 2,
  epi: 1,
};

export const CONTROLES_FRACOS: readonly HierarquiaControle[] = ['administrativa', 'epi'];

export const ROTULOS_HIERARQUIA: Record<HierarquiaControle, string> = {
  eliminacao: 'Eliminação',
  substituicao: 'Substituição',
  engenharia: 'Engenharia',
  administrativa: 'Administrativa',
  epi: 'EPI',
};

export const TIPOS_RELACAO_CAUSAL = [
  'contribuiu_para',
  'permitiu',
  'ampliou',
  'precedeu_sem_causar',
  'correlacao_observada',
] as const;
export type TipoRelacaoCausal = (typeof TIPOS_RELACAO_CAUSAL)[number];

/** Relações que NÃO afirmam causalidade — protege contra correlação = causa. */
export const RELACOES_NAO_CAUSAIS: readonly TipoRelacaoCausal[] = [
  'precedeu_sem_causar',
  'correlacao_observada',
];

export const PRECISOES_TEMPORAIS = ['exato', 'aproximado', 'intervalo', 'desconhecido'] as const;
export type PrecisaoTemporal = (typeof PRECISOES_TEMPORAIS)[number];

export const FASES_INVESTIGACAO = [
  'notificacao',
  'governanca',
  'coleta',
  'analise',
  'recomendacoes',
  'revisao',
  'aprovacao',
  'publicado',
  'verificacao_eficacia',
  'encerrada',
] as const;
export type FaseInvestigacao = (typeof FASES_INVESTIGACAO)[number];

export const ROTULOS_FASE: Record<FaseInvestigacao, string> = {
  notificacao: 'Notificação e triagem',
  governanca: 'Governança da investigação',
  coleta: 'Coleta PEEPO e evidências',
  analise: 'Análise causal ICAM',
  recomendacoes: 'Recomendações e plano de ação',
  revisao: 'Revisão',
  aprovacao: 'Aprovação',
  publicado: 'Relatório publicado',
  verificacao_eficacia: 'Verificação de eficácia',
  encerrada: 'Encerrada',
};

export const NIVEIS_CONFIDENCIALIDADE = [
  'publica',
  'interna',
  'restrita',
  'confidencial',
] as const;
export type NivelConfidencialidade = (typeof NIVEIS_CONFIDENCIALIDADE)[number];

export const ROTULOS_CONFIDENCIALIDADE: Record<NivelConfidencialidade, string> = {
  publica: 'Pública',
  interna: 'Interna',
  restrita: 'Restrita — só a equipe da investigação',
  confidencial: 'Confidencial — só a equipe, com registro de acesso',
};

/**
 * Profundidade da investigação, definida na triagem.
 *
 * `nao_definido` é o estado honesto na abertura: o nível costuma ser decidido
 * depois da primeira avaliação de severidade, e forçar a escolha na
 * notificação inicial produz classificação de fachada.
 */
export const NIVEIS_INVESTIGACAO = ['nao_definido', 'simplificado', 'completo'] as const;
export type NivelInvestigacao = (typeof NIVEIS_INVESTIGACAO)[number];

export const ROTULOS_NIVEL_INVESTIGACAO: Record<NivelInvestigacao, string> = {
  nao_definido: 'A definir na triagem',
  simplificado: 'Simplificado',
  completo: 'Completo',
};

export const ROTULOS_SEVERIDADE: Record<NivelSeveridade, string> = {
  nao_classificada: 'Não classificada',
  insignificante: 'Insignificante',
  menor: 'Menor',
  moderada: 'Moderada',
  maior: 'Maior',
  catastrofica: 'Catastrófica',
};

export const ROTULOS_PRECISAO_TEMPORAL: Record<PrecisaoTemporal, string> = {
  exato: 'Exato',
  aproximado: 'Aproximado',
  intervalo: 'Intervalo',
  desconhecido: 'Desconhecido',
};

export const PAPEIS_GLOBAIS = [
  'administrador',
  'gestor',
  'investigador',
  'revisor',
  'aprovador',
  'leitor',
] as const;
export type PapelGlobal = (typeof PAPEIS_GLOBAIS)[number];

export const AGENTES = [
  'ingestao',
  'temporal',
  'fatos',
  'contradicoes',
  'peepo',
  'classificador',
  'causalidade',
  'recomendacoes',
  'relatorio',
  'revisor',
] as const;
export type NomeAgente = (typeof AGENTES)[number];

export const ROTULOS_AGENTE: Record<NomeAgente, string> = {
  ingestao: 'Ingestão e extração',
  temporal: 'Normalização temporal e de entidades',
  fatos: 'Fatos e citações',
  contradicoes: 'Contradições e lacunas',
  peepo: 'Planejamento PEEPO e entrevistas',
  classificador: 'Classificador ICAM',
  causalidade: 'Análise de barreiras e causalidade',
  recomendacoes: 'Recomendações',
  relatorio: 'Compilador de relatório',
  revisor: 'Revisor de qualidade, segurança e não culpabilização',
};

export const DECISOES_HUMANAS = ['pendente', 'aceita', 'editada', 'rejeitada'] as const;
export type DecisaoHumana = (typeof DECISOES_HUMANAS)[number];

export const SENTIDOS_EVIDENCIA = ['favoravel', 'contraria', 'contextual'] as const;
export type SentidoEvidencia = (typeof SENTIDOS_EVIDENCIA)[number];

export const SEVERIDADES_VERIFICACAO = ['bloqueio', 'alerta', 'informativo'] as const;
export type SeveridadeVerificacao = (typeof SEVERIDADES_VERIFICACAO)[number];
