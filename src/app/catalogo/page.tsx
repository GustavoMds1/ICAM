import { buscarCodigos, carregarCatalogo, conferirCatalogo } from '@/domain/taxonomia/catalogo';
import { GRUPO_PARA_COLUNA, ROTULOS_COLUNA_ICAM } from '@/domain/enumeracoes';
import { Aviso, Cartao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grupo?: string }>;
}) {
  const { q = '', grupo = '' } = await searchParams;
  const catalogo = carregarCatalogo();
  const conferencia = conferirCatalogo(catalogo);

  const base = q.trim().length >= 3 ? buscarCodigos(q, 101).map((a) => a.codigo) : catalogo.codigos;
  const resultados = grupo ? base.filter((c) => c.grupo === grupo) : base;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Catálogo ICAM</h1>
        <p className="mt-1 text-sm text-texto-sutil">
          {conferencia.total} códigos versionados em {catalogo.versao}. A busca é textual sobre
          código, título, definição e exemplos — encontrar um código não classifica um achado.
        </p>
      </div>

      {conferencia.semDefinicao > 0 && (
        <Aviso tom="alerta" titulo="Definições integrais pendentes de importação">
          {conferencia.semDefinicao} de {conferencia.total} códigos estão sem a definição integral.
          Elas dependem das fontes abaixo e não foram geradas automaticamente, conforme o princípio
          de não inventar conteúdo.
          <ul className="mt-2 list-disc pl-5">
            {conferencia.fontesPendentes.map((f) => (
              <li key={f.arquivo}>
                <span className="font-mono">{f.arquivo}</span> — {f.papel}: {f.status}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Para carregar: <span className="font-mono">npm run taxonomia:importar-docx -- caminho/do/arquivo.docx</span>
          </p>
        </Aviso>
      )}

      <Cartao titulo="Buscar no catálogo">
        <form className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-64 flex-1">
            <label htmlFor="q" className="rotulo-campo">
              Termo de busca
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="ex.: gradiente, alarme, fadiga, manutenção"
              className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-texto-fraco">Mínimo de 3 caracteres.</p>
          </div>

          <div>
            <label htmlFor="grupo" className="rotulo-campo">
              Grupo
            </label>
            <select
              id="grupo"
              name="grupo"
              defaultValue={grupo}
              className="mt-1 rounded-md border border-borda-forte px-3 py-2 text-sm"
            >
              <option value="">Todos os grupos</option>
              {catalogo.grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.titulo} ({g.total})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="botao-primario">
            Buscar
          </button>
        </form>
      </Cartao>

      <Cartao
        titulo={`${resultados.length} código(s)`}
        descricao="Códigos genéricos e sensíveis são sinalizados: usá-los exige justificativa ou evidência robusta."
      >
        {resultados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum código corresponde à busca"
            descricao="Refine o termo ou remova o filtro de grupo. Não force um código: se nenhum se aplica, registre a classificação como incerta e descreva o achado."
          />
        ) : (
          <Tabela
            legenda="Códigos do catálogo ICAM"
            cabecalho={['Código', 'Título', 'Coluna do gráfico', 'Definição', 'Sinalizações']}
          >
            {resultados.map((c) => (
              <tr key={c.codigo}>
                <td className="font-mono font-semibold">{c.codigo}</td>
                <td className="max-w-sm">{c.titulo}</td>
                <td className="text-xs text-texto-sutil">
                  {ROTULOS_COLUNA_ICAM[GRUPO_PARA_COLUNA[c.grupo] ?? 'defesas']}
                </td>
                <td className="max-w-md text-xs">
                  {c.definicao ?? (
                    <span className="text-alerta">
                      Pendente de importação do documento de origem
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {c.codigoGenerico && <Selo tom="alerta">Genérico</Selo>}
                    {c.dadoSensivel && <Selo tom="erro">Sensível</Selo>}
                    {c.exigeEstadoBarreira && <Selo tom="marca">Estado da barreira</Selo>}
                    {c.requerConferenciaHumana && <Selo>Conferir</Selo>}
                  </div>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Cartao titulo="Regras por grupo" descricao="Restrições metodológicas aplicadas na classificação.">
        <div className="space-y-4">
          {catalogo.grupos.map((g) => (
            <div key={g.id} className="rounded border border-borda p-4">
              <h3 className="text-sm font-semibold">
                {g.titulo} <span className="font-normal text-texto-fraco">({g.total} códigos)</span>
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-texto-sutil">
                {g.regras.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Cartao>
    </div>
  );
}
