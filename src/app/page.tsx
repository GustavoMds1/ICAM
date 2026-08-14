import Link from 'next/link';
import { exigirAtor, obterRepositorioBanco } from '@/servidor/sessao';
import { reconciliarContagens, verificarQualidade } from '@/domain/qualidade/verificar';
import { conferirCatalogo } from '@/domain/taxonomia/catalogo';
import { ROTULOS_FASE, type FaseInvestigacao } from '@/domain/enumeracoes';
import { autorizar } from '@/seguranca/rbac';
import { Aviso, Cartao, EstadoVazio, Metrica, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaPortfolio() {
  const ator = await exigirAtor('/');
  const repo = await obterRepositorioBanco();
  const investigacoes = await repo.listarInvestigacoes(ator.organizacaoId);
  const catalogo = conferirCatalogo();
  const podeCriar = autorizar(ator, 'investigacao.criar', {
    organizacaoId: ator.organizacaoId,
  }).permitido;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Portfólio de investigações</h1>
          <p className="mt-1 text-sm text-texto-sutil">
            Acompanhamento de prazos, fase e bloqueios de qualidade por investigação.
          </p>
        </div>
        {podeCriar && (
          <Link href="/investigacoes/nova" className="botao-primario">
            Nova investigação
          </Link>
        )}
      </div>

      {!catalogo.conforme ? (
        <Aviso tom="erro" titulo="Catálogo ICAM inconsistente">
          O catálogo carregado não confere com a estrutura exigida.
        </Aviso>
      ) : (
        catalogo.semDefinicao > 0 && (
          <Aviso tom="alerta" titulo="Catálogo com definições pendentes de importação">
            Os {catalogo.total} códigos estão carregados com código, grupo e título conferidos, mas{' '}
            {catalogo.semDefinicao} ainda estão sem a definição integral, que depende do documento
            de origem. Nenhuma definição foi gerada automaticamente.{' '}
            <Link href="/catalogo" className="text-marca underline underline-offset-2">
              Ver catálogo
            </Link>
          </Aviso>
        )
      )}

      {investigacoes.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma investigação registrada"
          descricao={
            podeCriar
              ? 'Abra a primeira investigação pela notificação inicial. Com o relato do evento, a IA propõe cronologia, fatos, classificação ICAM, causas e recomendações — e você aprova item a item.'
              : 'Seu papel não permite abrir investigação. Procure um administrador se precisar deste acesso.'
          }
          acao={
            podeCriar ? (
              <Link href="/investigacoes/nova" className="botao-primario">
                Abrir a primeira investigação
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica rotulo="Investigações abertas" valor={investigacoes.length} />
            <Metrica
              rotulo="Fatores confirmados"
              valor={investigacoes.reduce((n, i) => n + reconciliarContagens(i).fatores, 0)}
            />
            <Metrica
              rotulo="Ações no plano"
              valor={investigacoes.reduce((n, i) => n + reconciliarContagens(i).recomendacoes, 0)}
            />
            <Metrica
              rotulo="Bloqueios de qualidade"
              valor={investigacoes.reduce((n, i) => n + verificarQualidade(i).bloqueios, 0)}
              detalhe="Impedem a publicação do relatório"
            />
          </dl>

          <Cartao
            titulo="Investigações"
            descricao="A coluna de qualidade reflete os verificadores automáticos da metodologia."
          >
            <Tabela
              legenda="Lista de investigações da organização"
              cabecalho={['Código', 'Título', 'Fase', 'Fatores', 'Ações', 'Qualidade']}
            >
              {investigacoes.map((inv) => {
                const contagens = reconciliarContagens(inv);
                const qualidade = verificarQualidade(inv);
                return (
                  <tr key={inv.investigacaoId}>
                    <td className="font-mono">
                      <Link
                        href={`/investigacoes/${inv.investigacaoId}`}
                        className="text-marca underline underline-offset-2 hover:text-marca-escuro"
                      >
                        {inv.codigo}
                      </Link>
                    </td>
                    <td className="max-w-md">{inv.titulo}</td>
                    <td>
                      <Selo tom="marca">
                        {ROTULOS_FASE[inv.fase as FaseInvestigacao] ?? inv.fase}
                      </Selo>
                    </td>
                    <td className="tabular-nums">{contagens.fatores}</td>
                    <td className="tabular-nums">{contagens.recomendacoes}</td>
                    <td>
                      {qualidade.bloqueios > 0 ? (
                        <Selo tom="erro">{qualidade.bloqueios} bloqueio(s)</Selo>
                      ) : qualidade.alertas > 0 ? (
                        <Selo tom="alerta">{qualidade.alertas} alerta(s)</Selo>
                      ) : (
                        <Selo tom="ok">Sem pendências</Selo>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          </Cartao>
        </>
      )}
    </div>
  );
}
