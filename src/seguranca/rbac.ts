import type { NivelConfidencialidade, PapelGlobal } from '../domain/enumeracoes';

/**
 * Autorização em duas camadas (seção 9):
 *   RBAC — o que o papel pode fazer;
 *   ABAC — sob quais atributos (organização, investigação, confidencialidade,
 *          campo sensível) a ação é permitida.
 *
 * Isolamento entre organizações é verificado ANTES de qualquer permissão: um
 * usuário nunca alcança dados de outra organização, mesmo sendo administrador.
 */

export const ACOES = [
  'investigacao.ler',
  'investigacao.criar',
  'investigacao.editar',
  'investigacao.encerrar',
  'evidencia.ler',
  'evidencia.criar',
  'evidencia.baixar',
  'evidencia.excluir',
  'fato.ler',
  'fato.criar',
  'fato.aprovar',
  'classificacao.ler',
  'classificacao.criar',
  'classificacao.confirmar',
  'recomendacao.ler',
  'recomendacao.criar',
  'recomendacao.aprovar',
  'relatorio.ler',
  'relatorio.gerar',
  'relatorio.publicar',
  'ia.executar',
  'auditoria.ler',
  'admin.gerenciar_usuarios',
  'campo_sensivel.ler',
] as const;
export type Acao = (typeof ACOES)[number];

const PERMISSOES: Record<PapelGlobal, readonly Acao[]> = {
  administrador: [...ACOES],
  gestor: [
    'investigacao.ler',
    'investigacao.criar',
    'investigacao.editar',
    'investigacao.encerrar',
    'evidencia.ler',
    'fato.ler',
    'classificacao.ler',
    'recomendacao.ler',
    'recomendacao.aprovar',
    'relatorio.ler',
    'relatorio.publicar',
    'auditoria.ler',
  ],
  investigador: [
    'investigacao.ler',
    'investigacao.criar',
    'investigacao.editar',
    'evidencia.ler',
    'evidencia.criar',
    'evidencia.baixar',
    'fato.ler',
    'fato.criar',
    'classificacao.ler',
    'classificacao.criar',
    'classificacao.confirmar',
    'recomendacao.ler',
    'recomendacao.criar',
    'relatorio.ler',
    'relatorio.gerar',
    'ia.executar',
  ],
  revisor: [
    'investigacao.ler',
    'evidencia.ler',
    'fato.ler',
    'fato.aprovar',
    'classificacao.ler',
    'recomendacao.ler',
    'relatorio.ler',
  ],
  aprovador: [
    'investigacao.ler',
    'evidencia.ler',
    'fato.ler',
    'classificacao.ler',
    'recomendacao.ler',
    'recomendacao.aprovar',
    'relatorio.ler',
    'relatorio.publicar',
  ],
  leitor: ['investigacao.ler', 'fato.ler', 'classificacao.ler', 'recomendacao.ler', 'relatorio.ler'],
};

export interface Ator {
  usuarioId: string;
  organizacaoId: string;
  papelGlobal: PapelGlobal;
  /** Investigações em que o usuário é membro da equipe. */
  investigacoesDaEquipe: readonly string[];
  /** Autorização explícita para ver nome, matrícula e dados de saúde. */
  podeVerCamposSensiveis: boolean;
}

export interface Recurso {
  organizacaoId: string;
  investigacaoId?: string;
  confidencialidade?: NivelConfidencialidade;
  contemDadoSensivel?: boolean;
}

export type ResultadoAutorizacao =
  | { permitido: true }
  | { permitido: false; motivo: string; codigo: string };

const NEGADO = (codigo: string, motivo: string): ResultadoAutorizacao => ({
  permitido: false,
  codigo,
  motivo,
});

export function autorizar(ator: Ator, acao: Acao, recurso: Recurso): ResultadoAutorizacao {
  // 1. Isolamento entre organizações — sempre primeiro, sem exceção de papel.
  if (ator.organizacaoId !== recurso.organizacaoId) {
    return NEGADO(
      'ISOLAMENTO_ORGANIZACAO',
      'O recurso pertence a outra organização. O acesso entre organizações é bloqueado por padrão.',
    );
  }

  // 2. RBAC.
  if (!PERMISSOES[ator.papelGlobal].includes(acao)) {
    return NEGADO(
      'PAPEL_SEM_PERMISSAO',
      `O papel "${ator.papelGlobal}" não tem permissão para "${acao}".`,
    );
  }

  // 3. ABAC — vínculo com a investigação.
  const exigeVinculo =
    recurso.confidencialidade === 'restrita' || recurso.confidencialidade === 'confidencial';
  if (
    exigeVinculo &&
    recurso.investigacaoId &&
    ator.papelGlobal !== 'administrador' &&
    !ator.investigacoesDaEquipe.includes(recurso.investigacaoId)
  ) {
    return NEGADO(
      'SEM_VINCULO_INVESTIGACAO',
      'Recurso restrito: apenas membros designados da equipe desta investigação têm acesso.',
    );
  }

  // 4. ABAC — campo sensível.
  if (recurso.contemDadoSensivel && !ator.podeVerCamposSensiveis) {
    return NEGADO(
      'CAMPO_SENSIVEL',
      'O recurso contém dado pessoal sensível (saúde, substâncias, vida pessoal, biometria, disciplina). ' +
        'É necessária autorização específica registrada.',
    );
  }

  return { permitido: true };
}

export function podeOuFalha(ator: Ator, acao: Acao, recurso: Recurso): void {
  const r = autorizar(ator, acao, recurso);
  if (!r.permitido) {
    const erro = new Error(r.motivo) as Error & { codigo: string; status: number };
    erro.codigo = r.codigo;
    erro.status = r.codigo === 'ISOLAMENTO_ORGANIZACAO' ? 404 : 403;
    throw erro;
  }
}

export function acoesDoPapel(papel: PapelGlobal): readonly Acao[] {
  return PERMISSOES[papel];
}
