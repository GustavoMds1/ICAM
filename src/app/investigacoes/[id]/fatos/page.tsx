import { carregarInvestigacao } from '@/servidor/carregar';
import { exigirAtor } from '@/servidor/sessao';
import { autorizar } from '@/seguranca/rbac';
import { Cartao, Citacao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';
import { DecisaoFato } from '@/componentes/Decisoes';
import { TIPOS_ASSERCAO_NAO_FACTUAIS, type TipoAssercao } from '@/domain/enumeracoes';

export const dynamic = 'force-dynamic';

const ROTULOS_TIPO: Record<TipoAssercao, string> = {
  fato_confirmado: 'fato confirmado',
  medicao_ou_registro: 'medição ou registro',
  declaracao_entrevistado: 'declaração de entrevistado',
  informacao_terceiro: 'informação de terceiro',
  inferencia_analitica: 'inferência analítica',
  hipotese: 'hipótese',
  informacao_contestada: 'informação contestada',
  informacao_refutada: 'informação refutada',
  lacuna_informacao: 'lacuna de informação',
};

export default async function PaginaFatos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);
  const ator = await exigirAtor(`/investigacoes/${id}/fatos`);
  const evidenciaPorId = new Map(inv.evidencias.map((e) => [e.id, e]));

  const podeDecidir = autorizar(ator, 'fato.aprovar', {
    organizacaoId: inv.metadados.organizacaoId,
    investigacaoId: inv.investigacaoId,
    confidencialidade: inv.metadados.confidencialidade as 'interna',
  }).permitido;

  const pendentes = inv.fatos.filter((f) => !f.aprovadoPorHumano).length;

  return (
    <div className="space-y-6">
      <Cartao
        titulo="Livro de fatos"
        descricao="Cada registro é uma proposição atômica com tipo de asserção explícito e evidências dos dois lados."
        acao={
          pendentes > 0 ? (
            <Selo tom="alerta">{pendentes} aguardando decisão</Selo>
          ) : inv.fatos.length > 0 ? (
            <Selo tom="ok">todos decididos</Selo>
          ) : undefined
        }
      >
        {inv.fatos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum registro no livro de fatos"
            descricao="Gere o rascunho assistido na visão geral para extrair proposições do relato inicial. Toda proposição nasce como candidata e exige decisão humana."
          />
        ) : (
          <ul className="space-y-4">
            {inv.fatos.map((f) => {
              const favoraveis = f.vinculos.filter((v) => v.sentido === 'favoravel');
              const contrarias = f.vinculos.filter((v) => v.sentido === 'contraria');
              const naoFactual = TIPOS_ASSERCAO_NAO_FACTUAIS.includes(f.tipoAssercao);

              return (
                <li key={f.id} className="rounded border border-borda p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-mono text-sm font-semibold">{f.identificador}</p>
                    <div className="flex flex-wrap gap-1">
                      <Selo tom={naoFactual ? 'alerta' : 'marca'}>{ROTULOS_TIPO[f.tipoAssercao]}</Selo>
                      {f.estadoVerificacao === 'corroborado' ? <Selo tom="ok">corroborado</Selo>
                        : f.estadoVerificacao === 'contestado' ? <Selo tom="alerta">contestado</Selo>
                        : f.estadoVerificacao === 'refutado' ? <Selo tom="erro">refutado</Selo>
                        : <Selo>{f.estadoVerificacao.replace(/_/g, ' ')}</Selo>}
                      {f.origemIa && <Selo tom="ia">origem: IA</Selo>}
                      {f.aprovadoPorHumano ? <Selo tom="ok">decisão humana</Selo> : <Selo tom="erro">sem decisão humana</Selo>}
                    </div>
                  </div>

                  <p className="mt-3 max-w-prose text-sm">{f.proposicao}</p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="rotulo-campo">Evidências favoráveis ({favoraveis.length})</p>
                      <ul className="mt-1 space-y-1">
                        {favoraveis.length === 0 && <li className="text-xs text-erro">Nenhuma evidência favorável vinculada.</li>}
                        {favoraveis.map((v, n) => (
                          <li key={`${v.evidenciaId}-${n}`}>
                            <Citacao
                              evidencia={evidenciaPorId.get(v.evidenciaId ?? '')?.identificador ?? 'evidência desconhecida'}
                              localizador={v.localizador}
                            />
                            {v.trecho && <span className="ml-1 text-xs text-texto-fraco">“{v.trecho}”</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="rotulo-campo">Evidências contrárias ({contrarias.length})</p>
                      <ul className="mt-1 space-y-1">
                        {contrarias.length === 0 && <li className="text-xs text-texto-fraco">Nenhuma registrada.</li>}
                        {contrarias.map((v, n) => (
                          <li key={`${v.evidenciaId}-c${n}`}>
                            <Citacao
                              evidencia={evidenciaPorId.get(v.evidenciaId ?? '')?.identificador ?? 'evidência desconhecida'}
                              localizador={v.localizador}
                            />
                            {v.trecho && <span className="ml-1 text-xs text-texto-fraco">“{v.trecho}”</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <DecisaoFato
                    investigacaoId={inv.investigacaoId}
                    fatoId={f.id}
                    aprovado={f.aprovadoPorHumano}
                    podeDecidir={podeDecidir}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="Resumo por tipo de asserção" descricao="A separação impede que inferência seja apresentada como fato.">
        <Tabela legenda="Contagem por tipo" cabecalho={['Tipo de asserção', 'Registros', 'Pode sustentar conclusão sozinho']}>
          {(Object.keys(ROTULOS_TIPO) as TipoAssercao[]).map((t) => {
            const n = inv.fatos.filter((f) => f.tipoAssercao === t).length;
            if (n === 0) return null;
            const sustenta = t === 'fato_confirmado' || t === 'medicao_ou_registro';
            return (
              <tr key={t}>
                <td>{ROTULOS_TIPO[t]}</td>
                <td className="tabular-nums">{n}</td>
                <td>{sustenta ? <Selo tom="ok">sim</Selo> : <Selo tom="alerta">não</Selo>}</td>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>
    </div>
  );
}
