import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirAtor, obterRepositorioBanco } from '@/servidor/sessao';
import { autorizar } from '@/seguranca/rbac';
import { verificarQualidade } from '@/domain/qualidade/verificar';
import { ROTULOS_FASE, type FaseInvestigacao } from '@/domain/enumeracoes';
import { Selo } from '@/componentes/ui';

const ABAS = [
  { segmento: '', rotulo: 'Visão geral' },
  { segmento: 'cronologia', rotulo: 'Cronologia' },
  { segmento: 'evidencias', rotulo: 'Evidências' },
  { segmento: 'fatos', rotulo: 'Livro de fatos' },
  { segmento: 'conflitos', rotulo: 'Contradições' },
  { segmento: 'icam', rotulo: 'Gráfico ICAM' },
  { segmento: 'recomendacoes', rotulo: 'Plano de ação' },
  { segmento: 'qualidade', rotulo: 'Qualidade' },
  { segmento: 'relatorio', rotulo: 'Relatório' },
];

export default async function LayoutInvestigacao({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ator = await exigirAtor(`/investigacoes/${id}`);
  const repositorio = await obterRepositorioBanco();
  const investigacao = await repositorio.obterInvestigacao(ator.organizacaoId, id);

  // Recurso de outra organização é tratado como inexistente (não revela existência).
  if (!investigacao) notFound();

  const permissao = autorizar(ator, 'investigacao.ler', {
    organizacaoId: investigacao.metadados.organizacaoId,
    investigacaoId: investigacao.investigacaoId,
    confidencialidade: investigacao.metadados.confidencialidade as 'interna',
  });
  if (!permissao.permitido) notFound();

  const qualidade = verificarQualidade(investigacao);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-texto-sutil">{investigacao.codigo}</p>
          <h1 className="mt-1 max-w-3xl text-2xl font-semibold text-texto">{investigacao.titulo}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Selo tom="marca">
              {ROTULOS_FASE[investigacao.fase as FaseInvestigacao] ?? investigacao.fase}
            </Selo>
            <Selo>Confidencialidade: {investigacao.metadados.confidencialidade}</Selo>
            {qualidade.bloqueios > 0 ? (
              <Selo tom="erro">{qualidade.bloqueios} bloqueio(s) de qualidade</Selo>
            ) : (
              <Selo tom="ok">Sem bloqueios</Selo>
            )}
            <Selo tom="ia">Exibição pseudonimizada</Selo>
          </div>
        </div>
      </div>

      <nav aria-label="Seções da investigação" className="border-b border-borda">
        <ul className="flex flex-wrap gap-1">
          {ABAS.map((aba) => (
            <li key={aba.segmento || 'geral'}>
              <Link
                href={`/investigacoes/${id}${aba.segmento ? `/${aba.segmento}` : ''}`}
                className="inline-block rounded-t px-3 py-2 text-sm text-texto-sutil hover:bg-superficie-forte hover:text-texto"
              >
                {aba.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {children}
    </div>
  );
}
