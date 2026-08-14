import { carregarInvestigacao } from '@/servidor/carregar';
import { perfilarPlano, desafiarEscolha } from '@/domain/recomendacoes/hierarquia';
import { ROTULOS_HIERARQUIA as R } from '@/domain/enumeracoes';
import { verificarQualidade } from '@/domain/qualidade/verificar';
import { Aviso, Cartao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';
import { DecisaoRecomendacao } from '@/componentes/Decisoes';
import { exigirAtor } from '@/servidor/sessao';
import { autorizar } from '@/seguranca/rbac';

export const dynamic = 'force-dynamic';

export default async function PaginaRecomendacoes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);
  const ator = await exigirAtor(`/investigacoes/${id}/recomendacoes`);
  const fatorPorId = new Map(inv.classificacoes.map((c) => [c.id, c]));
  const podeDecidir = autorizar(ator, 'recomendacao.aprovar', {
    organizacaoId: inv.metadados.organizacaoId,
    investigacaoId: inv.investigacaoId,
    confidencialidade: inv.metadados.confidencialidade as 'interna',
  }).permitido;
  const ativas = inv.recomendacoes.filter((x) => x.status !== 'cancelada');
  const perfil = perfilarPlano(ativas.map((x) => x.hierarquiaControle));

  const semTratamento = inv.classificacoes.filter(
    (c) =>
      c.estado === 'confirmado' &&
      (c.natureza === 'fator_contribuinte' || c.natureza === 'causa_sistemica') &&
      !inv.recomendacoes.some((r) => r.classificacaoIds.includes(c.id)),
  );

  const ocorrencias = verificarQualidade(inv).ocorrencias.filter((o) => o.entidadeTipo === 'recomendacao');

  return (
    <div className="space-y-6">
      <Cartao titulo="Perfil do plano de ação" descricao="Distribuição das ações pela hierarquia de controles.">
        <div className="grid gap-3 sm:grid-cols-5">
          {(Object.keys(perfil.porNivel) as (keyof typeof perfil.porNivel)[]).map((nivel) => (
            <div key={nivel} className="rounded border border-borda p-3">
              <p className="text-xs text-texto-sutil">{R[nivel]}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{perfil.porNivel[nivel]}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          {perfil.equilibrado ? (
            <Aviso tom="ok" titulo="Plano com controles de projeto">{perfil.observacao}</Aviso>
          ) : (
            <Aviso tom="alerta" titulo="Plano predominantemente administrativo">{perfil.observacao}</Aviso>
          )}
        </div>
      </Cartao>

      {semTratamento.length > 0 && (
        <Aviso tom="erro" titulo={`${semTratamento.length} fator(es) confirmado(s) sem ação vinculada`}>
          <ul className="list-disc pl-5">
            {semTratamento.map((c) => (
              <li key={c.id}>
                <span className="font-mono">{c.identificador}</span> ({c.codigo}) — {c.natureza.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      {ativas.length === 0 ? (
        <EstadoVazio
          titulo="Plano de ação vazio"
          descricao="Toda recomendação deve estar vinculada a um fator confirmado e ao mecanismo de risco que pretende modificar."
        />
      ) : (
        ativas.map((r) => {
          const desafio = desafiarEscolha(r.hierarquiaControle, r.alternativasSuperioresAvaliadas);
          const problemas = ocorrencias.filter((o) => o.entidadeId === r.id);
          return (
            <Cartao
              key={r.id}
              titulo={`${r.identificador} — ${R[r.hierarquiaControle]}`}
              acao={<Selo tom={r.status === 'aprovada' ? 'ok' : 'alerta'}>{r.status.replace(/_/g, ' ')}</Selo>}
            >
              <p className="max-w-prose text-sm">{r.acaoProposta}</p>

              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="rotulo-campo">Fatores tratados</dt>
                  <dd className="text-sm">
                    {r.classificacaoIds.length === 0 ? (
                      <span className="text-erro">Nenhum — vínculo obrigatório.</span>
                    ) : (
                      r.classificacaoIds.map((cid) => fatorPorId.get(cid)?.identificador ?? cid).join(', ')
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="rotulo-campo">Responsável e prazo</dt>
                  <dd className="text-sm">
                    {r.responsavel ?? <span className="text-erro">sem responsável</span>} ·{' '}
                    {r.prazo ?? <span className="text-erro">sem prazo</span>}
                  </dd>
                </div>
                <div>
                  <dt className="rotulo-campo">Justificativa da hierarquia</dt>
                  <dd className="text-sm">{r.justificativaHierarquia}</dd>
                </div>
                <div>
                  <dt className="rotulo-campo">Alternativas superiores avaliadas</dt>
                  <dd className="text-sm">
                    {r.alternativasSuperioresAvaliadas ?? <span className="text-alerta">não registradas</span>}
                  </dd>
                </div>
                <div>
                  <dt className="rotulo-campo">Risco residual</dt>
                  <dd className="text-sm">{r.riscoResidual ?? <span className="text-erro">não declarado</span>}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="rotulo-campo">Indicadores de eficácia</p>
                {r.indicadores.length === 0 ? (
                  <p className="text-sm text-erro">Nenhum indicador com meta e método definidos.</p>
                ) : (
                  <Tabela legenda={`Indicadores de ${r.identificador}`} cabecalho={['Indicador', 'Linha de base', 'Meta', 'Método', 'Verificação']}>
                    {r.indicadores.map((i) => (
                      <tr key={i.id}>
                        <td>{i.nome}</td>
                        <td>{i.linhaBase ?? '—'}</td>
                        <td className="font-medium">{i.meta}</td>
                        <td className="max-w-sm text-xs">{i.metodoMedicao}</td>
                        <td className="tabular-nums">{i.dataVerificacao ?? '—'}</td>
                      </tr>
                    ))}
                  </Tabela>
                )}
              </div>

              {desafio && (
                <div className="mt-4">
                  <Aviso tom="alerta" titulo="Controle fraco sem avaliação de alternativas superiores">
                    <p>{desafio.mensagem}</p>
                    <ul className="mt-2 list-disc pl-5">
                      {desafio.perguntasObrigatorias.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </Aviso>
                </div>
              )}

              {problemas.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {problemas.map((p, n) => (
                    <li key={`${p.regra}-${n}`} className="text-sm">
                      <Selo tom={p.severidade === 'bloqueio' ? 'erro' : 'alerta'}>{p.severidade}</Selo>{' '}
                      <span className="text-texto-sutil">{p.mensagem}</span>
                    </li>
                  ))}
                </ul>
              )}

              <DecisaoRecomendacao
                investigacaoId={inv.investigacaoId}
                recomendacaoId={r.id}
                responsavel={r.responsavel}
                prazo={r.prazo}
                decidida={r.status !== 'proposta'}
                podeDecidir={podeDecidir}
              />
            </Cartao>
          );
        })
      )}
    </div>
  );
}
