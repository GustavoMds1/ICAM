import { notFound } from 'next/navigation';
import type { InvestigacaoCompleta } from './repositorio';
import { exigirAtor, obterRepositorioBanco } from './sessao';
import { autorizar, type Acao } from '../seguranca/rbac';

/**
 * Carregamento autorizado de investigação para as páginas do servidor.
 *
 * Concentra a checagem em um único ponto: autenticação, isolamento por
 * organização, vínculo com a equipe e permissão do papel. Recurso não
 * autorizado por isolamento é tratado como inexistente, para não revelar que
 * ele existe.
 */
export async function carregarInvestigacao(
  id: string,
  acao: Acao = 'investigacao.ler',
): Promise<InvestigacaoCompleta> {
  const ator = await exigirAtor(`/investigacoes/${id}`);
  const repositorio = await obterRepositorioBanco();
  const investigacao = await repositorio.obterInvestigacao(ator.organizacaoId, id);
  if (!investigacao) notFound();

  const permissao = autorizar(ator, acao, {
    organizacaoId: investigacao.metadados.organizacaoId,
    investigacaoId: investigacao.investigacaoId,
    confidencialidade: investigacao.metadados.confidencialidade as 'interna',
  });
  if (!permissao.permitido) notFound();

  return investigacao;
}
