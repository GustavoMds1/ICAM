import { carregarInvestigacao } from '@/servidor/carregar';
import { montarMapaCausal, conferirCoerenciaContrafactual, formularContrafactual } from '@/domain/causal/grafo';
import { obterCodigo } from '@/domain/taxonomia/catalogo';
import { RELACOES_NAO_CAUSAIS } from '@/domain/enumeracoes';
import { Aviso, Cartao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';
import { PainelClassificador } from '@/componentes/PainelClassificador';

export const dynamic = 'force-dynamic';

export default async function PaginaIcam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);
  const mapa = montarMapaCausal(inv);
  const fatorPorId = new Map(inv.classificacoes.map((c) => [c.id, c]));

  const avisosContrafactual = inv.classificacoes
    .filter((c) => c.estado === 'confirmado')
    .flatMap((c) => conferirCoerenciaContrafactual(c));

  return (
    <div className="space-y-6">
      {mapa.avisos.length > 0 && (
        <Aviso tom="alerta" titulo="Observações sobre o mapa causal">
          <ul className="list-disc space-y-1 pl-5">
            {mapa.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {avisosContrafactual.length > 0 && (
        <Aviso tom="alerta" titulo="Coerência entre contrafactual e natureza atribuída">
          <ul className="list-disc space-y-1 pl-5">
            {avisosContrafactual.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <Cartao
        titulo="Gráfico ICAM"
        descricao="As quatro colunas do método. Fatores humanos aparecem separados por exigirem evidência específica, mas integram a coluna de condições."
      >
        {inv.classificacoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum fator classificado"
            descricao="Use o painel abaixo para obter alternativas ranqueadas de código. Nenhuma sugestão é aplicada automaticamente."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            {mapa.colunas.map((coluna) => (
              <div key={coluna.coluna} className="rounded-lg border border-borda bg-superficie-sutil p-3">
                <h3 className="text-sm font-semibold">{coluna.rotulo}</h3>
                <p className="mt-0.5 text-xs text-texto-fraco">{coluna.fatores.length} fator(es)</p>

                <ul className="mt-3 space-y-2">
                  {coluna.fatores.length === 0 && (
                    <li className="rounded border border-dashed border-borda-forte p-3 text-xs text-texto-fraco">
                      Nenhum fator nesta coluna.
                    </li>
                  )}
                  {coluna.fatores.map((f) => (
                    <li key={f.id} className="rounded border border-borda bg-superficie p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-1">
                        <span className="font-mono text-xs font-semibold">{f.identificador}</span>
                        <span className="font-mono text-xs text-marca">{f.codigo}</span>
                      </div>
                      <p className="mt-1 text-xs text-texto-sutil">{obterCodigo(f.codigo)?.titulo}</p>
                      <p className="mt-2 text-xs">{f.descricaoContextual}</p>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {f.estado === 'confirmado' ? <Selo tom="ok">confirmado</Selo>
                          : f.estado === 'rejeitado' ? <Selo tom="erro">rejeitado</Selo>
                          : <Selo tom="alerta">{f.estado.replace(/_/g, ' ')}</Selo>}
                        {f.estadoBarreira && <Selo tom="marca">barreira: {f.estadoBarreira}</Selo>}
                        {f.natureza !== 'nao_definida' && <Selo>{f.natureza.replace(/_/g, ' ')}</Selo>}
                        {f.origemIa && <Selo tom="ia">IA: {f.decisaoHumana}</Selo>}
                      </div>

                      {!f.mecanismo && f.estado === 'confirmado' && (
                        <p className="mt-2 text-xs text-erro">Mecanismo causal não descrito.</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Cartao
        titulo="Ligações causais"
        descricao="Cada ligação é uma afirmação testável com grau de sustentação. Correlação declarada não vira causa."
      >
        {mapa.relacoes.length === 0 ? (
          <EstadoVazio titulo="Nenhuma ligação declarada" descricao="Relacione os fatores entre si com afirmações que possam ser testadas contra evidência." />
        ) : (
          <Tabela
            legenda="Ligações do mapa causal"
            cabecalho={['Origem', 'Tipo', 'Destino', 'Afirmação testável', 'Sustentação']}
          >
            {mapa.relacoes.map((r) => {
              const afirmaCausa = !RELACOES_NAO_CAUSAIS.includes(r.tipo);
              const fraca = r.grauSustentacao === 'nao_avaliado' || r.grauSustentacao === 'fraco';
              return (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{fatorPorId.get(r.origemId)?.identificador ?? r.origemId}</td>
                  <td className="text-xs">{r.tipo.replace(/_/g, ' ')}</td>
                  <td className="font-mono text-xs">{fatorPorId.get(r.destinoId)?.identificador ?? r.destinoId}</td>
                  <td className="max-w-md text-xs">{r.afirmacaoTestavel}</td>
                  <td>
                    {afirmaCausa && fraca ? (
                      <Selo tom="erro">{r.grauSustentacao.replace(/_/g, ' ')}</Selo>
                    ) : (
                      <Selo tom={r.grauSustentacao === 'forte' ? 'ok' : 'neutro'}>
                        {r.grauSustentacao.replace(/_/g, ' ')}
                      </Selo>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Cartao>

      <Cartao
        titulo="Teste contrafactual"
        descricao="Apoio analítico, não prova isolada. A resposta é sempre do investigador."
      >
        <ul className="space-y-3">
          {inv.classificacoes
            .filter((c) => c.estado === 'confirmado')
            .map((c) => {
              const cf = formularContrafactual(c);
              return (
                <li key={c.id} className="rounded border border-borda p-4">
                  <p className="font-mono text-xs font-semibold">{c.identificador}</p>
                  <p className="mt-1 text-sm">{cf.pergunta}</p>
                  <p className="mt-2 text-xs text-texto-fraco">{cf.avisoMetodologico}</p>
                  <p className="mt-2 text-xs">
                    <span className="rotulo-campo inline">Resposta registrada: </span>
                    {c.contrafactualResposta ? (
                      <Selo tom="marca">{c.contrafactualResposta.replace(/_/g, ' ')}</Selo>
                    ) : (
                      <Selo tom="alerta">não respondido</Selo>
                    )}
                  </p>
                </li>
              );
            })}
        </ul>
      </Cartao>

      <PainelClassificador investigacaoId={inv.investigacaoId} />
    </div>
  );
}
