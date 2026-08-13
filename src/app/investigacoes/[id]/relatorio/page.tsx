import { carregarInvestigacao } from '@/servidor/carregar';
import { agenteRelatorio, renderizarMarkdown } from '@/agentes';
import { Aviso, Cartao, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaRelatorio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);
  const compilado = agenteRelatorio.heuristica({ dossie: inv });
  const markdown = renderizarMarkdown(compilado, `${inv.codigo} — ${inv.titulo}`);

  const aprovacoesObrigatorias = ['conclusoes', 'recomendacoes', 'publicacao_relatorio'];

  return (
    <div className="space-y-6">
      <Aviso tom="ia" titulo="Minuta gerada a partir dos registros">
        Nenhuma seção foi preenchida por geração livre. Seções sem dado aparecem como “sem
        registro”, o que é informação sobre a investigação, não texto a ser completado.
        O sumário executivo e as conclusões são esqueletos factuais e exigem redação e assinatura
        humanas.
      </Aviso>

      {compilado.bloqueiosParaPublicacao.length > 0 && (
        <Aviso tom="erro" titulo={`${compilado.bloqueiosParaPublicacao.length} bloqueio(s) impedem a publicação`}>
          <ul className="list-disc space-y-1 pl-5">
            {compilado.bloqueiosParaPublicacao.slice(0, 8).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <Cartao titulo="Aprovações obrigatórias" descricao="A publicação depende de decisão humana registrada em cada item.">
        <Tabela legenda="Aprovações" cabecalho={['Tipo', 'Decisão']}>
          {aprovacoesObrigatorias.map((tipo) => {
            const a = inv.aprovacoes.find((x) => x.tipo === tipo);
            return (
              <tr key={tipo}>
                <td>{tipo.replace(/_/g, ' ')}</td>
                <td>
                  {a?.decisao === 'aprovado' ? <Selo tom="ok">aprovado</Selo>
                    : a?.decisao === 'reprovado' ? <Selo tom="erro">reprovado</Selo>
                    : <Selo tom="alerta">pendente</Selo>}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>

      {compilado.contribuicoesIa.length > 0 && (
        <Cartao titulo="Contribuições de IA nesta versão" descricao="Exigência de transparência: o que a IA sugeriu e qual foi a decisão humana.">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {compilado.contribuicoesIa.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao titulo="Contagens reconciliadas" descricao="Os números do relatório são derivados dos registros, nunca digitados.">
        <Tabela legenda="Contagens" cabecalho={['Indicador', 'Valor']}>
          {Object.entries(compilado.contagens)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => (
              <tr key={k}>
                <td>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</td>
                <td className="tabular-nums">{String(v)}</td>
              </tr>
            ))}
        </Tabela>
      </Cartao>

      <Cartao titulo="Estrutura da minuta" descricao={`${compilado.secoes.length} seções; ${compilado.secoes.filter((s) => s.vazia).length} sem registro.`}>
        <ol className="space-y-4">
          {compilado.secoes.map((s) => (
            <li key={s.id} className="rounded border border-borda p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{s.titulo}</h3>
                {s.vazia ? <Selo tom="alerta">sem registro</Selo> : <Selo tom="ok">{s.itens.length || 1} item(ns)</Selo>}
              </div>
              {s.conteudo && <p className="mt-2 max-w-prose text-sm text-texto-sutil">{s.conteudo}</p>}
              {s.itens.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {s.itens.slice(0, 6).map((i, n) => (
                    <li key={`${s.id}-${n}`}>{i}</li>
                  ))}
                  {s.itens.length > 6 && (
                    <li className="text-texto-fraco">… e mais {s.itens.length - 6} item(ns).</li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </Cartao>

      <Cartao titulo="Exportação em Markdown" descricao="Base para as exportações em PDF, DOCX e JSON estruturado.">
        <pre className="max-h-96 overflow-auto rounded bg-superficie-forte p-4 text-xs">{markdown}</pre>
      </Cartao>
    </div>
  );
}
