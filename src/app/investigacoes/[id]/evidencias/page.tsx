import { carregarInvestigacao } from '@/servidor/carregar';
import { Cartao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaEvidencias({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);

  const usos = new Map<string, number>();
  for (const f of inv.fatos) {
    for (const v of f.vinculos) {
      if (v.evidenciaId) usos.set(v.evidenciaId, (usos.get(v.evidenciaId) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <Cartao
        titulo="Biblioteca de evidências"
        descricao="O arquivo original é preservado. OCR, transcrição, tradução e extração são derivados versionados."
      >
        {inv.evidencias.length === 0 ? (
          <EstadoVazio titulo="Nenhuma evidência importada" descricao="Importe documentos, telemetria, registros e mídias. Cada item recebe hash, cadeia de custódia e nível de confidencialidade." />
        ) : (
          <Tabela
            legenda="Evidências da investigação"
            cabecalho={['ID', 'Título', 'Categoria', 'Autenticidade', 'Confidencialidade', 'Hash', 'Usos em fatos']}
          >
            {inv.evidencias.map((e) => (
              <tr key={e.id}>
                <td className="font-mono font-semibold">{e.identificador}</td>
                <td className="max-w-sm">{e.titulo}</td>
                <td className="text-xs">{e.categoria.replace(/_/g, ' ')}</td>
                <td>
                  {e.autenticidadeAvaliada === 'confirmada' ? <Selo tom="ok">confirmada</Selo>
                    : e.autenticidadeAvaliada === 'duvidosa' ? <Selo tom="alerta">duvidosa</Selo>
                    : <Selo>{e.autenticidadeAvaliada.replace(/_/g, ' ')}</Selo>}
                </td>
                <td>
                  {e.confidencialidade === 'restrita' || e.confidencialidade === 'confidencial'
                    ? <Selo tom="erro">{e.confidencialidade}</Selo>
                    : <Selo>{e.confidencialidade}</Selo>}
                </td>
                <td className="font-mono text-xs text-texto-fraco">{e.hashOriginal?.slice(0, 12) ?? '—'}…</td>
                <td className="tabular-nums">{usos.get(e.id) ?? 0}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Cartao titulo="Localizadores válidos" descricao="Toda citação deve apontar um destes localizadores. Citação sem localizador é bloqueada.">
        <ul className="space-y-2 text-sm">
          {inv.evidencias.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono font-semibold">{e.identificador}</span>
              <span className="text-texto-fraco">·</span>
              {e.localizadoresValidos.map((l) => (
                <span key={l} className="rounded bg-superficie-forte px-2 py-0.5 font-mono text-xs">{l}</span>
              ))}
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}
