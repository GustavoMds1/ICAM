import type {
  ColunaIcam,
  DecisaoHumana,
  DimensaoPeepo,
  EstadoBarreira,
  EstadoClassificacao,
  HierarquiaControle,
  NaturezaFator,
  NivelConfianca,
  PrecisaoTemporal,
  SentidoEvidencia,
  TipoAssercao,
  TipoRelacaoCausal,
} from './enumeracoes';

/**
 * Retrato serializável de uma investigação.
 *
 * Os verificadores de qualidade, o mapa causal e os agentes operam sobre este
 * tipo — nunca sobre o cliente Prisma. Isso mantém as regras puras, testáveis
 * sem banco e reaproveitáveis tanto no servidor quanto em scripts.
 */

export interface DossieEvidencia {
  id: string;
  identificador: string;
  titulo: string;
  categoria: string;
  hashOriginal: string | null;
  confidencialidade: string;
  contemDadoSensivel: boolean;
  autenticidadeAvaliada: string;
  localizadoresValidos: string[];
}

export interface DossieVinculo {
  evidenciaId: string | null;
  declaracaoId: string | null;
  sentido: SentidoEvidencia;
  localizador: string | null;
  trecho: string | null;
  peso: 'fraco' | 'medio' | 'forte';
}

export interface DossieFato {
  id: string;
  identificador: string;
  proposicao: string;
  tipoAssercao: TipoAssercao;
  estadoVerificacao:
    | 'nao_verificado'
    | 'corroborado'
    | 'contestado'
    | 'refutado'
    | 'indeterminado';
  confianca: NivelConfianca;
  aprovadoPorHumano: boolean;
  origemIa: boolean;
  vinculos: DossieVinculo[];
}

export interface DossieDeclaracaoUnica {
  fatoId: string;
  quantidadeFontesIndependentes: number;
}

export interface DossieSustentacao {
  fatoId: string;
  sentido: 'favoravel' | 'contraria';
  peso: 'fraco' | 'medio' | 'forte';
}

export interface DossieClassificacao {
  id: string;
  identificador: string;
  codigo: string;
  coluna: ColunaIcam;
  descricaoContextual: string;
  mecanismo: string | null;
  estado: EstadoClassificacao;
  natureza: NaturezaFator;
  confianca: NivelConfianca;
  estadoBarreira: EstadoBarreira | null;
  justificativaBarreira: string | null;
  contrafactualResposta: 'evento_ainda_plausivel' | 'evento_improvavel' | 'indeterminado' | null;
  origemIa: boolean;
  decisaoHumana: DecisaoHumana;
  justificativaGenerico: string | null;
  sustentacoes: DossieSustentacao[];
  codigosSecundarios: { codigo: string; justificativa: string }[];
}

export interface DossieRelacaoCausal {
  id: string;
  origemId: string;
  destinoId: string;
  tipo: TipoRelacaoCausal;
  afirmacaoTestavel: string;
  grauSustentacao: 'nao_avaliado' | 'fraco' | 'moderado' | 'forte';
}

export interface DossieIndicador {
  id: string;
  nome: string;
  meta: string;
  metodoMedicao: string;
  linhaBase: string | null;
  dataVerificacao: string | null;
}

export interface DossieRecomendacao {
  id: string;
  identificador: string;
  acaoProposta: string;
  objetivo: string;
  hierarquiaControle: HierarquiaControle;
  justificativaHierarquia: string;
  alternativasSuperioresAvaliadas: string | null;
  responsavel: string | null;
  prazo: string | null;
  riscoResidual: string | null;
  status: string;
  jaTratadaPorId: string | null;
  classificacaoIds: string[];
  indicadores: DossieIndicador[];
}

export interface DossieItemPeepo {
  id: string;
  dimensao: DimensaoPeepo;
  perguntaInvestigativa: string;
  status: string;
  responsavel: string | null;
  prazo: string | null;
}

export interface DossieEvento {
  id: string;
  titulo: string;
  instanteNormalizado: string | null;
  precisao: PrecisaoTemporal;
  fonteTemporalId: string | null;
  conflitoTemporal: boolean;
}

export interface DossieFonteTemporal {
  id: string;
  nome: string;
  desvioSegundos: number | null;
  confiabilidade: NivelConfianca;
}

export interface DossieConflito {
  id: string;
  identificador: string;
  titulo: string;
  status: 'aberto' | 'em_diligencia' | 'resolvido' | 'irresolvivel';
  resolucao: string | null;
  justificativaResolucao: string | null;
  itens: { rotulo: string; valorRelatado: string; fatoId: string | null }[];
}

export interface DossieLacuna {
  id: string;
  identificador: string;
  descricao: string;
  criticidade: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'aberta' | 'em_diligencia' | 'fechada' | 'irresolvivel';
}

export interface DossieComentario {
  id: string;
  tipo: 'comentario' | 'objecao' | 'opiniao_divergente';
  texto: string;
  resolvido: boolean;
}

export interface DossieAprovacao {
  tipo: string;
  decisao: 'aprovado' | 'reprovado' | 'pendente';
}

export interface DossieRelatorio {
  id: string;
  versao: number;
  status: string;
  resumoExecutivo: string | null;
  contagensDeclaradas: {
    fatos?: number;
    fatores?: number;
    causasSistemicas?: number;
    recomendacoes?: number;
  } | null;
  citacoes: { evidenciaId: string; localizador: string; fatoId: string | null }[];
}

export interface Dossie {
  investigacaoId: string;
  codigo: string;
  titulo: string;
  fase: string;
  evidencias: DossieEvidencia[];
  fatos: DossieFato[];
  classificacoes: DossieClassificacao[];
  relacoesCausais: DossieRelacaoCausal[];
  recomendacoes: DossieRecomendacao[];
  itensPeepo: DossieItemPeepo[];
  eventos: DossieEvento[];
  fontesTemporais: DossieFonteTemporal[];
  conflitos: DossieConflito[];
  lacunas: DossieLacuna[];
  comentarios: DossieComentario[];
  aprovacoes: DossieAprovacao[];
  relatorio: DossieRelatorio | null;
}

export function dossieVazio(investigacaoId: string): Dossie {
  return {
    investigacaoId,
    codigo: '',
    titulo: '',
    fase: 'notificacao',
    evidencias: [],
    fatos: [],
    classificacoes: [],
    relacoesCausais: [],
    recomendacoes: [],
    itensPeepo: [],
    eventos: [],
    fontesTemporais: [],
    conflitos: [],
    lacunas: [],
    comentarios: [],
    aprovacoes: [],
    relatorio: null,
  };
}
