import { carregarInvestigacao } from '@/servidor/carregar';
import { detectarDivergenciasDeRelogio, ROTULOS_PRECISAO } from '@/domain/tempo/normalizacao';
import type { PrecisaoTemporal } from '@/domain/enumeracoes';
import { Aviso, Cartao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaCronologia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);

  const divergencias = detectarDivergenciasDeRelogio(
    inv.fontesTemporais.map((f) => ({
      id: f.id, nome: f.nome, desvioSegundos: f.desvioSegundos, confiabilidade: f.confiabilidade,
    })),
  );
  const ordenados = [...inv.eventos].sort((a, b) =>
    (a.instanteNormalizado ?? '9999').localeCompare(b.instanteNormalizado ?? '9999'),
  );

  return (
    <div className="space-y-6">
      {divergencias.length > 0 && (
        <Aviso tom="alerta" titulo="Relógios de sistemas divergentes">
          <ul className="list-disc space-y-1 pl-5">
            {divergencias.map((d) => (
              <li key={`${d.fonteA}-${d.fonteB}`}>{d.descricao}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <Cartao
        titulo="Fontes temporais"
        descricao="O instante bruto nunca é sobrescrito: a correção de desvio é sempre um valor derivado."
      >
        <Tabela legenda="Fontes temporais" cabecalho={['Fonte', 'Desvio verificado', 'Confiabilidade']}>
          {inv.fontesTemporais.map((f) => (
            <tr key={f.id}>
              <td>{f.nome}</td>
              <td className="tabular-nums">
                {f.desvioSegundos === null ? <Selo tom="alerta">não verificado</Selo> : `${f.desvioSegundos > 0 ? '+' : ''}${f.desvioSegundos}s`}
              </td>
              <td>{f.confiabilidade === 'baixa' ? <Selo tom="alerta">baixa</Selo> : <Selo>{f.confiabilidade}</Selo>}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Cartao
        titulo="Linha do tempo"
        descricao="Inclui eventos anteriores relevantes: manutenção, alarmes, mudanças e decisões."
      >
        {ordenados.length === 0 ? (
          <EstadoVazio titulo="Sem eventos registrados" descricao="Registre eventos com fonte temporal identificada para montar a cronologia." />
        ) : (
          <ol className="space-y-3">
            {ordenados.map((e) => {
              const fonte = inv.fontesTemporais.find((f) => f.id === e.fonteTemporalId);
              return (
                <li key={e.id} className="rounded border border-borda p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-mono text-sm tabular-nums text-texto-sutil">
                      {e.instanteNormalizado ?? 'horário desconhecido'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Selo>{ROTULOS_PRECISAO[e.precisao as PrecisaoTemporal] ?? e.precisao}</Selo>
                      {fonte ? <Selo tom="marca">{fonte.nome}</Selo> : <Selo tom="erro">sem fonte temporal</Selo>}
                      {e.conflitoTemporal && <Selo tom="alerta">conflito temporal</Selo>}
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{e.titulo}</p>
                </li>
              );
            })}
          </ol>
        )}
      </Cartao>

      <Cartao titulo="Reconstrução do evento">
        <Aviso tom="ia" titulo="Isto é uma reconstrução, não um registro do que foi observado">
          A sequência apresentada é montada a partir das evidências listadas. Nenhum trecho inferido
          pode ser apresentado como fato: a natureza de cada item está declarada na linha do tempo e
          no livro de fatos.
        </Aviso>
      </Cartao>
    </div>
  );
}
