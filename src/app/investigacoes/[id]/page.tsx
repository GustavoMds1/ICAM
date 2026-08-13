import { carregarInvestigacao } from '@/servidor/carregar';
import { reconciliarContagens, verificarQualidade } from '@/domain/qualidade/verificar';
import { ROTULOS_PEEPO, type DimensaoPeepo, DIMENSOES_PEEPO } from '@/domain/enumeracoes';
import { Aviso, Cartao, CampoLeitura, ListaDefinicoes, Metrica, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaVisaoGeral({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await carregarInvestigacao(id);
  const m = inv.metadados;
  const contagens = reconciliarContagens(inv);
  const qualidade = verificarQualidade(inv);

  return (
    <div className="space-y-6">
      {qualidade.bloqueios > 0 && (
        <Aviso tom="erro" titulo={`${qualidade.bloqueios} bloqueio(s) impedem a publicação`}>
          Consulte a aba Qualidade para o detalhamento por regra metodológica.
        </Aviso>
      )}

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metrica rotulo="Evidências" valor={contagens.evidencias} />
        <Metrica rotulo="Fatos corroborados" valor={contagens.fatos} detalhe={`${contagens.fatosTotais} registros no total`} />
        <Metrica rotulo="Fatores confirmados" valor={contagens.fatores} detalhe={`${contagens.causasSistemicas} causa(s) sistêmica(s)`} />
        <Metrica rotulo="Ações no plano" valor={contagens.recomendacoes} />
        <Metrica rotulo="Pendências" valor={contagens.conflitosAbertos + contagens.lacunasAbertas} detalhe={`${contagens.conflitosAbertos} contradição(ões), ${contagens.lacunasAbertas} lacuna(s)`} />
      </dl>

      <Cartao titulo="Notificação inicial" descricao="Registro da triagem que abriu a investigação.">
        <p className="mb-4 max-w-prose text-sm text-texto">{m.descricaoInicial}</p>
        <ListaDefinicoes>
          <CampoLeitura rotulo="Ocorrido em">
            {m.ocorridoEm ?? 'não informado'}{' '}
            <span className="text-texto-fraco">({m.precisaoOcorrencia})</span>
          </CampoLeitura>
          <CampoLeitura rotulo="Local">{m.local ?? 'não informado'}</CampoLeitura>
          <CampoLeitura rotulo="Atividade">{m.atividade ?? 'não informada'}</CampoLeitura>
          <CampoLeitura rotulo="Severidade real">{m.severidadeReal}</CampoLeitura>
          <CampoLeitura rotulo="Severidade potencial">
            <Selo tom="alerta">{m.severidadePotencial}</Selo>
          </CampoLeitura>
          <CampoLeitura rotulo="Nível de investigação">{m.nivelInvestigacao}</CampoLeitura>
          <CampoLeitura rotulo="Local preservado">{m.localPreservado ? 'sim' : 'não'}</CampoLeitura>
        </ListaDefinicoes>
        {m.acoesImediatas && (
          <div className="mt-4 border-t border-borda pt-4">
            <p className="rotulo-campo">Ações imediatas</p>
            <p className="mt-1 max-w-prose text-sm">{m.acoesImediatas}</p>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Consequências reais e potenciais">
        <Tabela legenda="Consequências" cabecalho={['Dimensão', 'Tipo', 'Nível', 'Descrição']}>
          {m.consequencias.map((c, i) => (
            <tr key={`${c.dimensao}-${i}`}>
              <td>{c.dimensao.replace(/_/g, ' ')}</td>
              <td>{c.tipo}</td>
              <td>{c.tipo === 'potencial' ? <Selo tom="alerta">{c.nivel}</Selo> : <Selo>{c.nivel}</Selo>}</td>
              <td className="max-w-lg">{c.descricao}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Cartao titulo="Equipe e governança" descricao="Conflitos de interesse declarados ficam visíveis para toda a equipe.">
        <Tabela legenda="Equipe" cabecalho={['Papel', 'Membro', 'Conflito de interesse']}>
          {m.equipe.map((e) => (
            <tr key={`${e.usuarioId}-${e.papel}`}>
              <td>{e.papel.replace(/_/g, ' ')}</td>
              <td>{e.nome}</td>
              <td>{e.conflitoInteresse ? <Selo tom="alerta">Declarado</Selo> : <Selo tom="ok">Sem declaração</Selo>}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Cartao titulo="Envolvidos" descricao="Exibição pseudonimizada por padrão. Nome e matrícula exigem autorização específica.">
        <Tabela legenda="Envolvidos" cabecalho={['Identificação', 'Tipo', 'Função']}>
          {m.envolvidos.map((e) => (
            <tr key={e.id}>
              <td className="font-medium">{e.pseudonimo}</td>
              <td>{e.tipo}</td>
              <td>{e.funcao ?? '—'}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Cartao titulo="Cobertura do plano PEEPO" descricao="Itens de coleta por dimensão, com responsável e prazo.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DIMENSOES_PEEPO.map((dim: DimensaoPeepo) => {
            const itens = inv.itensPeepo.filter((i) => i.dimensao === dim);
            const coletados = itens.filter((i) => i.status === 'coletado').length;
            const completo = itens.length > 0 && coletados === itens.length;
            return (
              <div key={dim} className="rounded border border-borda p-3">
                <p className="text-sm font-medium">{ROTULOS_PEEPO[dim]}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {coletados}
                  <span className="text-base font-normal text-texto-fraco">/{itens.length}</span>
                </p>
                <div className="mt-2">
                  {itens.length === 0 ? (
                    <Selo tom="erro">Sem plano</Selo>
                  ) : completo ? (
                    <Selo tom="ok">Coletado</Selo>
                  ) : coletados === 0 ? (
                    <Selo tom="erro">Não coberto</Selo>
                  ) : (
                    <Selo tom="alerta">Parcial</Selo>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <Tabela legenda="Itens do plano PEEPO" cabecalho={['Dimensão', 'Pergunta investigativa', 'Responsável', 'Prazo', 'Status']}>
            {inv.itensPeepo.map((i) => (
              <tr key={i.id}>
                <td>{ROTULOS_PEEPO[i.dimensao]}</td>
                <td className="max-w-lg">{i.perguntaInvestigativa}</td>
                <td>{i.responsavel ?? '—'}</td>
                <td className="tabular-nums">{i.prazo ?? '—'}</td>
                <td>
                  {i.status === 'coletado' ? <Selo tom="ok">coletado</Selo>
                    : i.status === 'indisponivel' ? <Selo tom="erro">indisponível</Selo>
                    : <Selo tom="alerta">{i.status.replace(/_/g, ' ')}</Selo>}
                </td>
              </tr>
            ))}
          </Tabela>
        </div>
      </Cartao>

      <Cartao titulo="Lacunas de informação" descricao="Ausência de registro é lacuna declarada, nunca prova de ausência.">
        <Tabela legenda="Lacunas" cabecalho={['ID', 'Descrição', 'Criticidade', 'Status']}>
          {inv.lacunas.map((l) => (
            <tr key={l.id}>
              <td className="font-mono">{l.identificador}</td>
              <td className="max-w-xl">{l.descricao}</td>
              <td>{l.criticidade === 'critica' || l.criticidade === 'alta' ? <Selo tom="erro">{l.criticidade}</Selo> : <Selo>{l.criticidade}</Selo>}</td>
              <td>{l.status}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>
    </div>
  );
}
