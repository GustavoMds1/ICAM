import type { SeveridadeVerificacao } from '../enumeracoes';

/**
 * Catálogo dos verificadores automáticos exigidos pela seção 12 do prompt
 * mestre. Cada regra é identificável, tem severidade declarada e aponta para
 * o princípio metodológico que protege.
 *
 * Severidade:
 *   bloqueio    -> impede publicação do relatório;
 *   alerta      -> exige justificativa registrada;
 *   informativo -> orienta o investigador, não bloqueia.
 */

export interface DefinicaoRegra {
  id: string;
  titulo: string;
  severidade: SeveridadeVerificacao;
  principio: string;
  descricao: string;
}

export const REGRAS: readonly DefinicaoRegra[] = [
  {
    id: 'ACHADO_SEM_EVIDENCIA',
    titulo: 'Achado sem evidência',
    severidade: 'bloqueio',
    principio: '3.3',
    descricao: 'Fator confirmado sem nenhuma evidência favorável vinculada.',
  },
  {
    id: 'CITACAO_NAO_SUSTENTA',
    titulo: 'Citação que não sustenta a afirmação',
    severidade: 'bloqueio',
    principio: '3.4',
    descricao:
      'Citação aponta para evidência inexistente, sem localizador ou sem vínculo com o fato citado.',
  },
  {
    id: 'FATOR_SEM_MECANISMO',
    titulo: 'Fator ICAM sem mecanismo causal',
    severidade: 'bloqueio',
    principio: '4.8',
    descricao:
      'Fator confirmado sem descrição do mecanismo pelo qual contribuiu para o evento.',
  },
  {
    id: 'CODIGO_OUTRO_SEM_JUSTIFICATIVA',
    titulo: 'Código "Outro" sem justificativa',
    severidade: 'bloqueio',
    principio: '5.1/5.2',
    descricao: 'Uso de código genérico (DF21, IT14, TE24, HF26) sem justificativa registrada.',
  },
  {
    id: 'CONCLUSAO_SO_COM_RELATO',
    titulo: 'Conclusão baseada somente em relato não corroborado',
    severidade: 'alerta',
    principio: '3.2',
    descricao:
      'Fator confirmado sustentado apenas por declarações, sem medição, registro ou documento.',
  },
  {
    id: 'FATO_INFERENCIA_CONFUNDIDOS',
    titulo: 'Confusão entre fato e inferência',
    severidade: 'bloqueio',
    principio: '3.2',
    descricao:
      'Registro marcado como fato confirmado mas cujo tipo de asserção é inferência, hipótese ou informação contestada.',
  },
  {
    id: 'SENSIVEL_SEM_EVIDENCIA_ROBUSTA',
    titulo: 'Classificação humana sensível sem evidência adequada',
    severidade: 'bloqueio',
    principio: '5.4/9',
    descricao:
      'Código de fator humano sensível (fadiga, álcool/drogas, saúde, problemas pessoais) sem evidência robusta e corroborada.',
  },
  {
    id: 'RECOMENDACAO_SEM_FATOR',
    titulo: 'Recomendação sem vínculo com fator',
    severidade: 'bloqueio',
    principio: '4.9',
    descricao: 'Recomendação que não trata nenhum fator confirmado.',
  },
  {
    id: 'FATOR_SEM_ACAO',
    titulo: 'Fator sem ação ou justificativa',
    severidade: 'bloqueio',
    principio: '4.9',
    descricao:
      'Fator contribuinte ou causa sistêmica confirmada sem recomendação vinculada e sem justificativa de não tratamento.',
  },
  {
    id: 'ACAO_JA_TRATADA_SEM_VINCULO',
    titulo: 'Ação duplicada ou "já tratada" sem vínculo',
    severidade: 'bloqueio',
    principio: '4.9',
    descricao:
      'Recomendação marcada como já tratada por outra ação sem apontar qual, ou ação duplicada.',
  },
  {
    id: 'ACAO_SEM_RESPONSAVEL_PRAZO_EFICACIA',
    titulo: 'Ação sem responsável, prazo ou critério de eficácia',
    severidade: 'bloqueio',
    principio: '4.9',
    descricao: 'Recomendação sem responsável, sem prazo ou sem indicador de eficácia com meta.',
  },
  {
    id: 'EXCESSO_CONTROLES_FRACOS',
    titulo: 'Excesso de ações administrativas sem análise de controles mais fortes',
    severidade: 'alerta',
    principio: '4.9',
    descricao:
      'Predominância de controles administrativos/EPI sem registro de avaliação de eliminação, substituição ou engenharia.',
  },
  {
    id: 'ACAO_VAGA',
    titulo: 'Ação vaga sem mudança sistêmica verificável',
    severidade: 'alerta',
    principio: '4.9',
    descricao:
      'Ação descrita apenas como "reforçar", "orientar", "conscientizar", "ter mais atenção" ou "treinar" sem mudança verificável.',
  },
  {
    id: 'CONTAGEM_DIVERGENTE',
    titulo: 'Contagem divergente entre resumo e registros',
    severidade: 'bloqueio',
    principio: '12',
    descricao: 'Números declarados no relatório não conferem com os registros da investigação.',
  },
  {
    id: 'TEMPO_INCONSISTENTE',
    titulo: 'Datas e fusos inconsistentes',
    severidade: 'alerta',
    principio: '4.6',
    descricao: 'Evento com instante registrado sem fonte temporal ou com conflito não tratado.',
  },
  {
    id: 'EVIDENCIA_DUPLICADA',
    titulo: 'Duplicidade de evidência',
    severidade: 'alerta',
    principio: '4.4',
    descricao: 'Mais de uma evidência com o mesmo hash de conteúdo.',
  },
  {
    id: 'RELOGIO_DIVERGENTE',
    titulo: 'Relógio de sistema divergente',
    severidade: 'alerta',
    principio: '4.6',
    descricao: 'Fontes temporais com desvios incompatíveis entre si.',
  },
  {
    id: 'LACUNA_CRITICA_ABERTA',
    titulo: 'Lacuna crítica não resolvida',
    severidade: 'bloqueio',
    principio: '3.9',
    descricao: 'Lacuna de criticidade alta ou crítica ainda aberta na fase de publicação.',
  },
  {
    id: 'OPINIAO_DIVERGENTE_OMITIDA',
    titulo: 'Opinião divergente omitida',
    severidade: 'bloqueio',
    principio: '4.10',
    descricao: 'Existe opinião divergente registrada que não aparece no relatório.',
  },
  {
    id: 'LINGUAGEM_CULPABILIZADORA',
    titulo: 'Linguagem culpabilizadora',
    severidade: 'alerta',
    principio: '3.8',
    descricao:
      'Texto com termos que atribuem culpa ou encerram a análise no executante ("negligência", "descuido", "não seguiu o procedimento", "falta de atenção").',
  },
  {
    id: 'PUBLICACAO_SEM_APROVACAO',
    titulo: 'Publicação sem aprovações obrigatórias',
    severidade: 'bloqueio',
    principio: '3.15',
    descricao: 'Relatório publicado ou em publicação sem as aprovações humanas exigidas.',
  },
  {
    id: 'ANALISE_ENCERRADA_NO_EXECUTANTE',
    titulo: 'Análise encerrada na ação individual',
    severidade: 'bloqueio',
    principio: '3.7',
    descricao:
      'Existem fatores confirmados na coluna de ações individuais sem nenhum fator confirmado em condições da tarefa, defesas ou organização.',
  },
  {
    id: 'CORRELACAO_COMO_CAUSA',
    titulo: 'Correlação apresentada como causalidade',
    severidade: 'bloqueio',
    principio: '3.5',
    descricao:
      'Relação causal do tipo "contribuiu para" / "permitiu" / "ampliou" com grau de sustentação não avaliado ou fraco.',
  },
  {
    id: 'SUGESTAO_IA_SEM_DECISAO_HUMANA',
    titulo: 'Sugestão de IA sem decisão humana',
    severidade: 'bloqueio',
    principio: '3.15',
    descricao:
      'Fator ou fato originado de IA presente em relatório sem aceite, edição ou rejeição registrada por pessoa.',
  },
  {
    id: 'CONFLITO_RESOLVIDO_SEM_JUSTIFICATIVA',
    titulo: 'Conflito resolvido sem justificativa',
    severidade: 'bloqueio',
    principio: '4.7',
    descricao:
      'Contradição marcada como resolvida sem registro de qual versão prevaleceu e por quê.',
  },
  {
    id: 'PEEPO_DIMENSAO_NAO_COBERTA',
    titulo: 'Dimensão PEEPO sem cobertura',
    severidade: 'alerta',
    principio: '4.3',
    descricao: 'Dimensão do plano PEEPO sem nenhum item de coleta concluído.',
  },
];

export const REGRAS_POR_ID: ReadonlyMap<string, DefinicaoRegra> = new Map(
  REGRAS.map((r) => [r.id, r]),
);

/** Termos que sinalizam linguagem culpabilizadora ou análise encerrada cedo. */
export const TERMOS_CULPABILIZADORES: readonly string[] = [
  'negligencia',
  'negligente',
  'imprudencia',
  'imprudente',
  'impericia',
  'descuido',
  'desatencao',
  'falta de atencao',
  'nao prestou atencao',
  'nao seguiu o procedimento',
  'descumpriu o procedimento',
  'complacencia do operador',
  'culpa',
  'culpado',
  'responsavel pelo acidente',
  'erro humano',
  'falha humana',
  'displicencia',
  'irresponsabilidade',
];

/** Verbos de ação vaga que não produzem mudança sistêmica verificável. */
export const TERMOS_ACAO_VAGA: readonly string[] = [
  'reforcar',
  'reforco',
  'orientar',
  'orientacao',
  'conscientizar',
  'conscientizacao',
  'sensibilizar',
  'ter mais atencao',
  'redobrar a atencao',
  'alertar',
  'divulgar',
  'relembrar',
  'reciclagem',
  'dds',
];
