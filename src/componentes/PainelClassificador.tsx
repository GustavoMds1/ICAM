'use client';

import { useState } from 'react';
import type { RespostaClassificador } from '@/agentes/contratos';
import { Aviso, Cartao, Selo } from './ui';

type Decisao = 'aceita' | 'editada' | 'rejeitada';

/**
 * Painel de sugestão do classificador ICAM.
 *
 * Materializa a exigência da seção 11: toda sugestão de IA tem ações de
 * aceitar, editar, rejeitar, justificar e ver fontes — e nenhuma sugestão vira
 * classificação sem que a decisão humana seja registrada.
 */
export function PainelClassificador({ investigacaoId }: { investigacaoId: string }) {
  const [descricao, setDescricao] = useState('');
  const [mecanismo, setMecanismo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RespostaClassificador | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, { decisao: Decisao; justificativa: string }>>({});

  async function solicitar(evento: React.FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);
    setResultado(null);
    setDecisoes({});

    try {
      const resposta = await fetch('/api/agentes/classificador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investigacaoId, descricao, mecanismo: mecanismo || null }),
      });
      const corpo = (await resposta.json()) as { erro?: string } & RespostaClassificador;
      if (!resposta.ok) {
        setErro(corpo.erro ?? 'Falha ao consultar o classificador.');
        return;
      }
      setResultado(corpo);
    } catch {
      setErro('Não foi possível contatar o serviço do classificador.');
    } finally {
      setCarregando(false);
    }
  }

  function registrar(codigo: string, decisao: Decisao) {
    setDecisoes((atual) => ({
      ...atual,
      [codigo]: { decisao, justificativa: atual[codigo]?.justificativa ?? '' },
    }));
  }

  return (
    <Cartao
      titulo="Classificador ICAM (copiloto)"
      descricao="Devolve alternativas ranqueadas com evidência, mecanismo e motivo para não escolher os códigos próximos. Nenhuma alternativa é aplicada automaticamente."
    >
      <form onSubmit={solicitar} className="space-y-4">
        <div>
          <label htmlFor="descricao" className="rotulo-campo">
            Descrição do achado no contexto da investigação
          </label>
          <textarea
            id="descricao"
            required
            minLength={15}
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
            placeholder="ex.: A via de acesso apresentava gradiente acima do limite estabelecido pelo procedimento vigente."
          />
        </div>

        <div>
          <label htmlFor="mecanismo" className="rotulo-campo">
            Mecanismo pelo qual contribuiu para o evento
          </label>
          <textarea
            id="mecanismo"
            rows={2}
            value={mecanismo}
            onChange={(e) => setMecanismo(e.target.value)}
            className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
            placeholder="Sem o mecanismo descrito, a classificação permanece incerta e não pode ser confirmada."
          />
          <p className="mt-1 text-xs text-texto-fraco">
            Semelhança textual não classifica: a confirmação exige evidência e mecanismo.
          </p>
        </div>

        <button type="submit" className="botao-primario" disabled={carregando || descricao.trim().length < 15}>
          {carregando ? 'Consultando…' : 'Solicitar alternativas'}
        </button>
      </form>

      <div aria-live="polite" className="mt-6 space-y-4">
        {erro && <Aviso tom="erro" titulo="Falha na consulta">{erro}</Aviso>}

        {resultado && (
          <>
            <Aviso tom="ia" titulo="Sugestão de IA — requer validação humana">
              <p>{resultado.resposta}</p>
              {resultado.classificacaoIncerta && resultado.motivoIncerteza && (
                <p className="mt-2">
                  <strong>Classificação incerta:</strong> {resultado.motivoIncerteza}
                </p>
              )}
              {resultado.limitacoes.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {resultado.limitacoes.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </Aviso>

            {resultado.alternativas.length === 0 ? (
              <p className="text-sm text-texto-sutil">
                Nenhuma alternativa com aderência suficiente. Registre a classificação como incerta
                e descreva o achado — não force um código.
              </p>
            ) : (
              <ul className="space-y-3">
                {resultado.alternativas.map((a) => {
                  const decidida = decisoes[a.codigo];
                  return (
                    <li key={a.codigo} className="rounded border border-borda p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">
                          <span className="text-texto-fraco">#{a.posicao}</span>{' '}
                          <span className="font-mono text-marca">{a.codigo}</span> — {a.titulo}
                        </p>
                        <Selo tom={a.confianca === 'alta' ? 'ok' : a.confianca === 'media' ? 'alerta' : 'erro'}>
                          confiança {a.confianca}
                        </Selo>
                      </div>

                      <dl className="mt-3 space-y-2 text-xs">
                        <div>
                          <dt className="rotulo-campo">Mecanismo</dt>
                          <dd>{a.mecanismo}</dd>
                        </div>
                        <div>
                          <dt className="rotulo-campo">Regra de inclusão atendida</dt>
                          <dd>{a.regraInclusaoAtendida}</dd>
                        </div>
                        <div>
                          <dt className="rotulo-campo">Por que não escolher os próximos</dt>
                          <dd>{a.motivoNaoEscolherProximos}</dd>
                        </div>
                        <div>
                          <dt className="rotulo-campo">Evidências vinculadas</dt>
                          <dd>
                            {a.evidencia.length === 0
                              ? 'Nenhuma — vincule evidência antes de confirmar.'
                              : a.evidencia.map((e) => `${e.id}${e.localizador ? ` (${e.localizador})` : ''}`).join(', ')}
                          </dd>
                        </div>
                      </dl>

                      {a.alertas.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-alerta">
                          {a.alertas.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button type="button" className="botao" onClick={() => registrar(a.codigo, 'aceita')}>
                          Aceitar
                        </button>
                        <button type="button" className="botao" onClick={() => registrar(a.codigo, 'editada')}>
                          Editar antes de aplicar
                        </button>
                        <button type="button" className="botao" onClick={() => registrar(a.codigo, 'rejeitada')}>
                          Rejeitar
                        </button>
                        {decidida && <Selo tom="marca">decisão: {decidida.decisao}</Selo>}
                      </div>

                      {decidida && (
                        <div className="mt-3">
                          <label htmlFor={`just-${a.codigo}`} className="rotulo-campo">
                            Justificativa da decisão (obrigatória para registrar)
                          </label>
                          <input
                            id={`just-${a.codigo}`}
                            type="text"
                            value={decidida.justificativa}
                            onChange={(e) =>
                              setDecisoes((atual) => ({
                                ...atual,
                                [a.codigo]: { decisao: decidida.decisao, justificativa: e.target.value },
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
                            placeholder="ex.: código confirmado com base em EV-007 seção A-A e EV-003 item 7.3."
                          />
                          <p className="mt-1 text-xs text-texto-fraco">
                            A gravação da classificação a partir desta decisão é o próximo incremento
                            do fluxo. Hoje a decisão é registrada nesta tela e o fator é criado na
                            aba do gráfico ICAM.
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {resultado.proximas_diligencias.length > 0 && (
              <div className="rounded border border-borda p-4">
                <p className="rotulo-campo">Próximas diligências sugeridas</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-texto-sutil">
                  {resultado.proximas_diligencias.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Cartao>
  );
}
