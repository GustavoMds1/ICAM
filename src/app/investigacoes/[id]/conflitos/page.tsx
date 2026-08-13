import { carregarInvestigacao } from '@/servidor/carregar';
import { Aviso, Cartao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaConflitos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);
  const fatoPorId = new Map(inv.fatos.map((f) => [f.id, f]));

  return (
    <div className="space-y-6">
      <Aviso tom="ia" titulo="As versões conflitantes são preservadas">
        Nenhuma fonte sobrescreve outra. A resolução exige decisão humana com justificativa
        registrada de qual versão prevaleceu e por quê.
      </Aviso>

      {inv.conflitos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma contradição registrada"
          descricao="Compare relato e telemetria, procedimento e nota de manutenção, parâmetro documentado e configurado, checklist e evidência técnica posterior."
        />
      ) : (
        inv.conflitos.map((c) => (
          <Cartao
            key={c.id}
            titulo={`${c.identificador} — ${c.titulo}`}
            acao={
              c.status === 'resolvido' ? <Selo tom="ok">resolvido</Selo>
                : c.status === 'irresolvivel' ? <Selo tom="erro">irresolvível</Selo>
                : <Selo tom="alerta">{c.status.replace(/_/g, ' ')}</Selo>
            }
          >
            <Tabela legenda={`Versões do conflito ${c.identificador}`} cabecalho={['Fonte / rótulo', 'Valor registrado', 'Fato vinculado']}>
              {c.itens.map((i, n) => (
                <tr key={`${i.rotulo}-${n}`}>
                  <td className="font-medium">{i.rotulo}</td>
                  <td className="font-mono">{i.valorRelatado}</td>
                  <td className="font-mono text-xs">
                    {i.fatoId ? (fatoPorId.get(i.fatoId)?.identificador ?? i.fatoId) : '—'}
                  </td>
                </tr>
              ))}
            </Tabela>

            {c.status === 'resolvido' && !c.justificativaResolucao && (
              <div className="mt-4">
                <Aviso tom="erro" titulo="Resolução sem justificativa">
                  Registre qual versão prevaleceu e com base em qual evidência.
                </Aviso>
              </div>
            )}
            {c.justificativaResolucao && (
              <p className="mt-4 text-sm text-texto-sutil">
                <span className="font-medium text-texto">Justificativa: </span>
                {c.justificativaResolucao}
              </p>
            )}
          </Cartao>
        ))
      )}
    </div>
  );
}
