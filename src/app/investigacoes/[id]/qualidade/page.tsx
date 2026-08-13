import { carregarInvestigacao } from '@/servidor/carregar';
import { verificarQualidade } from '@/domain/qualidade/verificar';
import { REGRAS, REGRAS_POR_ID } from '@/domain/qualidade/regras';
import { Aviso, Cartao, Metrica, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaQualidade({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);
  const relatorio = verificarQualidade(inv);

  const porRegra = new Map<string, number>();
  for (const o of relatorio.ocorrencias) porRegra.set(o.regra, (porRegra.get(o.regra) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-4">
        <Metrica rotulo="Bloqueios" valor={relatorio.bloqueios} detalhe="Impedem a publicação" />
        <Metrica rotulo="Alertas" valor={relatorio.alertas} detalhe="Exigem justificativa" />
        <Metrica rotulo="Informativos" valor={relatorio.informativos} />
        <Metrica rotulo="Regras verificadas" valor={REGRAS.length} />
      </dl>

      {relatorio.podePublicar ? (
        <Aviso tom="ok" titulo="Nenhum bloqueio de qualidade">
          A publicação ainda depende das aprovações humanas obrigatórias.
        </Aviso>
      ) : (
        <Aviso tom="erro" titulo={`${relatorio.bloqueios} bloqueio(s) impedem a publicação`}>
          Cada bloqueio corresponde a um princípio metodológico. Corrija o registro ou justifique.
        </Aviso>
      )}

      <Cartao titulo="Ocorrências" descricao="Resultado dos verificadores automáticos sobre os registros atuais.">
        {relatorio.ocorrencias.length === 0 ? (
          <p className="text-sm text-texto-sutil">Nenhuma ocorrência.</p>
        ) : (
          <Tabela legenda="Ocorrências dos verificadores" cabecalho={['Severidade', 'Regra', 'Princípio', 'Entidade', 'Mensagem']}>
            {relatorio.ocorrencias.map((o, n) => (
              <tr key={`${o.regra}-${n}`}>
                <td>
                  {o.severidade === 'bloqueio' ? <Selo tom="erro">bloqueio</Selo>
                    : o.severidade === 'alerta' ? <Selo tom="alerta">alerta</Selo>
                    : <Selo>informativo</Selo>}
                </td>
                <td className="font-mono text-xs">{o.regra}</td>
                <td className="text-xs text-texto-fraco">{o.principio}</td>
                <td className="text-xs">{o.entidadeTipo ?? '—'}</td>
                <td className="max-w-xl text-sm">{o.mensagem}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Cartao titulo="Catálogo de regras" descricao="Todas as verificações executadas, com o princípio que cada uma protege.">
        <Tabela legenda="Regras de qualidade" cabecalho={['Regra', 'Severidade', 'Princípio', 'O que verifica', 'Ocorrências']}>
          {REGRAS.map((r) => (
            <tr key={r.id}>
              <td className="font-mono text-xs">{r.id}</td>
              <td>
                {r.severidade === 'bloqueio' ? <Selo tom="erro">bloqueio</Selo> : <Selo tom="alerta">{r.severidade}</Selo>}
              </td>
              <td className="text-xs text-texto-fraco">{r.principio}</td>
              <td className="max-w-lg text-xs">{REGRAS_POR_ID.get(r.id)?.descricao}</td>
              <td className="tabular-nums">{porRegra.get(r.id) ?? 0}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>
    </div>
  );
}
