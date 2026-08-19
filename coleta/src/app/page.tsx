'use client';

import { useMemo, useState } from 'react';
import {
  CODIGOS,
  HIERARQUIAS,
  NIVEIS,
  obterCodigo,
  ORDEM_COLUNAS,
  ROTULOS_COLUNA,
  type NivelIcam,
} from '@/lib/codigos';
import { ROTULOS_PEEPO, type ItemColetado, type DadosEvento, type CategoriaPeepo } from '@/lib/pptxLeitura';
import type { Sugestao } from '@/lib/classificacao';
import type { AcaoProposta } from '@/lib/acoes';

/**
 * Cinco passos: importar, classificar, revisar, planejar ações, gerar.
 *
 * Três regras estão embutidas na interface, não no texto de ajuda:
 *
 *   - causa raiz não aparece como opção. Ela sai da análise causal com a
 *     equipe, depois. Ter o botão aqui convidaria a eleger causa raiz durante
 *     a digitação;
 *   - "exige ação" nasce marcado em todos os itens. Quem tira é a pessoa, item
 *     a item. Deixar a IA desmarcar sozinha faria achado sumir do slide sem
 *     ninguém perceber;
 *   - falha da IA aparece como erro com o que fazer. O modo local existe, mas
 *     só entra quando pedido no botão — nunca no lugar da análise, calado.
 */

interface Decisao {
  incluir: boolean;
  codigo: string;
  nivel: NivelIcam;
  exigeAcao: boolean;
}

const NIVEL_ESTILO: Record<NivelIcam, string> = {
  contribuinte: 'bg-contribuinte text-texto border-yellow-600',
  constatado: 'bg-white text-texto border-borda',
};

export default function PaginaColeta() {
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; codigo?: string; passo?: 'codigos' | 'acoes' } | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const [itens, setItens] = useState<ItemColetado[]>([]);
  const [evento, setEvento] = useState<DadosEvento | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [origem, setOrigem] = useState<'gemini' | 'local' | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const [acoes, setAcoes] = useState<AcaoProposta[]>([]);
  const [origemAcoes, setOrigemAcoes] = useState<'gemini' | 'local' | null>(null);

  const constatacoes = useMemo(() => itens.filter((i) => i.tipo === 'constatacao'), [itens]);
  const evidencias = useMemo(() => itens.filter((i) => i.tipo === 'evidencia'), [itens]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);

  const noSlide = useMemo(
    () => sugestoes.filter((s) => decisoes[s.itemId]?.incluir),
    [sugestoes, decisoes],
  );
  const paraTratar = useMemo(
    () => noSlide.filter((s) => decisoes[s.itemId]?.exigeAcao),
    [noSlide, decisoes],
  );

  const contexto = evento
    ? [evento.oQueAconteceu, evento.ondeAconteceu, evento.quandoAconteceu].filter(Boolean).join(' | ')
    : undefined;

  async function importar(arquivo: File) {
    setCarregando('Lendo o PowerPoint…');
    setErro(null);
    setAvisos([]);
    setSugestoes([]);
    setDecisoes({});
    setAcoes([]);

    try {
      const dados = new FormData();
      dados.append('arquivo', arquivo);
      const r = await fetch('/api/importar', { method: 'POST', body: dados });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro ?? 'falha ao importar');

      setItens(corpo.itens);
      setEvento(corpo.evento);
      setAvisos(corpo.avisos ?? []);
    } catch (e) {
      setErro({ mensagem: e instanceof Error ? e.message : 'Não foi possível importar o arquivo.' });
    } finally {
      setCarregando(null);
    }
  }

  async function classificar(permitirLocal = false) {
    setCarregando('Associando os códigos ICAM…');
    setErro(null);

    try {
      const r = await fetch('/api/classificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itens, contexto, permitirLocal }),
      });
      const corpo = await r.json();
      if (!r.ok) {
        setErro({ mensagem: corpo.erro ?? 'falha ao classificar', codigo: corpo.codigo, passo: 'codigos' });
        return;
      }

      setSugestoes(corpo.sugestoes);
      setOrigem(corpo.origem);
      setAvisos(corpo.avisos ?? []);
      setAcoes([]);
      setDecisoes(
        Object.fromEntries(
          (corpo.sugestoes as Sugestao[]).map((s) => [
            s.itemId,
            {
              // A caixa "exige ação" nasce marcada para todo mundo: quem tira
              // é a pessoa, item a item. Deixar a IA desmarcar sozinha faria
              // achado sumir do slide sem ninguém perceber.
              incluir: true,
              codigo: s.codigo,
              nivel: s.nivel,
              exigeAcao: true,
            },
          ]),
        ),
      );
    } catch (e) {
      setErro({ mensagem: e instanceof Error ? e.message : 'Não foi possível classificar.', passo: 'codigos' });
    } finally {
      setCarregando(null);
    }
  }

  async function gerarAcoes(permitirLocal = false) {
    setCarregando('Propondo as ações…');
    setErro(null);

    try {
      const achados = paraTratar.map((s) => {
        const codigo = obterCodigo(decisoes[s.itemId]?.codigo ?? s.codigo);
        return {
          itemId: s.itemId,
          codigo: codigo?.codigo ?? s.codigo,
          titulo: codigo?.titulo ?? s.titulo,
          constatacao: itemPorId.get(s.itemId)?.texto ?? '',
        };
      });

      const r = await fetch('/api/acoes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ achados, contexto, permitirLocal }),
      });
      const corpo = await r.json();
      if (!r.ok) {
        setErro({ mensagem: corpo.erro ?? 'falha ao propor ações', codigo: corpo.codigo, passo: 'acoes' });
        return;
      }

      setAcoes(corpo.acoes);
      setOrigemAcoes(corpo.origem);
      setAvisos(corpo.avisos ?? []);
    } catch (e) {
      setErro({ mensagem: e instanceof Error ? e.message : 'Não foi possível propor as ações.', passo: 'acoes' });
    } finally {
      setCarregando(null);
    }
  }

  async function gerar() {
    setCarregando('Montando o arquivo…');
    setErro(null);

    try {
      const cartoes = noSlide.map((s) => {
        const decisao = decisoes[s.itemId];
        const codigo = obterCodigo(decisao?.codigo ?? s.codigo);
        return {
          codigo: codigo?.codigo ?? s.codigo,
          titulo: codigo?.titulo ?? s.titulo,
          nivel: decisao?.nivel ?? s.nivel,
          constatacao: itemPorId.get(s.itemId)?.texto ?? '',
        };
      });

      const r = await fetch('/api/slide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cartoes, evento, acoes: acoes.length > 0 ? acoes : undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).erro ?? 'falha ao gerar');

      const cabecalho = r.headers.get('x-avisos');
      if (cabecalho) setAvisos(JSON.parse(decodeURIComponent(cabecalho)));

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'classificacao-icam.pptx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro({ mensagem: e instanceof Error ? e.message : 'Não foi possível gerar o arquivo.' });
    } finally {
      setCarregando(null);
    }
  }

  function alterar(itemId: string, mudanca: Partial<Decisao>) {
    setDecisoes((atual) => {
      const anterior = atual[itemId] ?? {
        incluir: true,
        codigo: '',
        nivel: 'constatado' as NivelIcam,
        exigeAcao: false,
      };
      const novo = { ...anterior, ...mudanca };
      // Marcar que exige ação recoloca o item no slide: o que vai virar ação
      // precisa aparecer na classificação que a sustenta.
      if (mudanca.exigeAcao === true) novo.incluir = true;
      if (mudanca.nivel === 'contribuinte') novo.incluir = true;
      return { ...atual, [itemId]: novo };
    });
  }

  function alterarAcao(itemId: string, mudanca: Partial<AcaoProposta>) {
    setAcoes((atual) => atual.map((a) => (a.itemId === itemId ? { ...a, ...mudanca } : a)));
  }

  return (
    <div className="space-y-8">
      {erro && (
        <div role="alert" className="rounded-md border-l-4 border-red-600 bg-red-50 p-4 text-sm">
          <p>{erro.mensagem}</p>
          {(erro.codigo === 'SEM_CHAVE' || erro.codigo === 'FALHA_GEMINI') && erro.passo && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="botao"
                onClick={() =>
                  void (erro.passo === 'codigos' ? classificar(true) : gerarAcoes(true))
                }
                disabled={carregando !== null}
              >
                Seguir sem IA, no modo local
              </button>
              <span className="text-xs text-sutil">
                O modo local associa por semelhança de palavras. Serve para não travar o trabalho,
                não para substituir a análise.
              </span>
            </div>
          )}
        </div>
      )}

      {avisos.length > 0 && (
        <div role="status" className="rounded-md border-l-4 border-yellow-500 bg-yellow-50 p-4 text-sm">
          <ul className="list-disc space-y-1 pl-5">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1 — importar */}
      <section className="cartao">
        <h2 className="text-base font-semibold">1. Importar a investigação</h2>
        <p className="mt-1 max-w-prose text-sm text-sutil">
          Envie o .pptx da investigação. São lidos os slides com o título &quot;Coleta de Dados&quot;,
          separando por PEEPO, junto com a caixa do evento.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="botao cursor-pointer">
            Escolher arquivo .pptx
            <input
              type="file"
              accept=".pptx"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void importar(arquivo);
              }}
            />
          </label>
          {itens.length > 0 && (
            <span className="text-sm text-sutil">
              {constatacoes.length} constatação(ões) e {evidencias.length} evidência(s) de coleta
            </span>
          )}
        </div>
      </section>

      {/* 2 — classificar */}
      {constatacoes.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">2. Associar os códigos ICAM</h2>
              <p className="mt-1 max-w-prose text-sm text-sutil">
                A IA propõe o código, se é fato constatado ou fator contribuinte, e se aquilo exige
                ação. <strong>Causa raiz não é definida aqui</strong> — ela sai da análise causal,
                depois, com a equipe.
              </p>
            </div>
            <button
              type="button"
              className="botao-primario"
              onClick={() => void classificar(false)}
              disabled={carregando !== null}
            >
              {carregando ?? (sugestoes.length > 0 ? 'Classificar de novo' : 'Associar códigos com IA')}
            </button>
          </div>

          {carregando !== null && (
            <p className="mt-3 text-xs text-sutil">
              Se o modelo estiver congestionado, o aplicativo espera e tenta de novo sozinho. Pode levar
              até meio minuto.
            </p>
          )}

          {origem && (
            <p className="mt-3 text-xs text-sutil">
              {origem === 'gemini'
                ? 'Sugestões vindas do Gemini. Confira o mecanismo de cada código antes de aceitar.'
                : 'Sem chave do Gemini: as sugestões vieram da associação local por palavras, que é fraca. Trate cada linha como ponto de partida.'}
            </p>
          )}
        </section>
      )}

      {/* 3 — revisar */}
      {sugestoes.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">3. Revisar item a item</h2>
              <p className="mt-1 text-sm text-sutil">
                {noSlide.length} de {sugestoes.length} vão para o slide · {paraTratar.length} exigem ação.
                Todos entram marcados: desmarque o que for só fato, sem nada a corrigir.
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-4">
            {sugestoes.map((s) => {
              const item = itemPorId.get(s.itemId);
              const decisao = decisoes[s.itemId] ?? {
                incluir: true,
                codigo: s.codigo,
                nivel: s.nivel,
                exigeAcao: s.exigeAcao,
              };
              const codigo = obterCodigo(decisao.codigo);

              return (
                <li
                  key={s.itemId}
                  className={`rounded border p-4 ${decisao.incluir ? 'border-borda' : 'border-dashed border-borda opacity-60'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="max-w-3xl text-sm">{item?.texto}</p>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      {item && (
                        <span className="selo border-borda bg-zinc-100 text-sutil">
                          {ROTULOS_PEEPO[item.categoria as CategoriaPeepo] ?? item.categoria}
                        </span>
                      )}
                      <span className="selo border-borda bg-zinc-100 text-sutil">
                        {s.origem === 'gemini' ? 'IA' : 'local'} · confiança {s.confianca}
                      </span>
                    </div>
                  </div>

                  {s.justificativa && <p className="mt-2 text-xs text-sutil">{s.justificativa}</p>}
                  {!s.exigeAcao && decisao.exigeAcao && (
                    <p className="mt-1 text-xs text-amber-700">
                      A IA considerou que este item não exige ação. Se concordar, desmarque a caixa.
                    </p>
                  )}

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                    <div>
                      <label className="rotulo" htmlFor={`codigo-${s.itemId}`}>
                        Código ICAM
                      </label>
                      <select
                        id={`codigo-${s.itemId}`}
                        value={decisao.codigo}
                        onChange={(e) => alterar(s.itemId, { codigo: e.target.value })}
                        className="campo"
                      >
                        {ORDEM_COLUNAS.map((coluna) => (
                          <optgroup key={coluna} label={ROTULOS_COLUNA[coluna]}>
                            {CODIGOS.filter((c) => c.coluna === coluna).map((c) => (
                              <option key={c.codigo} value={c.codigo}>
                                {c.codigo} – {c.titulo}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {codigo && (
                        <p className="mt-1 text-xs text-sutil">Coluna: {ROTULOS_COLUNA[codigo.coluna]}</p>
                      )}
                    </div>

                    <div>
                      <span className="rotulo">Classificação</span>
                      <div className="mt-1 flex gap-1">
                        {(Object.keys(NIVEIS) as NivelIcam[]).map((nivel) => (
                          <button
                            key={nivel}
                            type="button"
                            onClick={() => alterar(s.itemId, { nivel })}
                            className={`selo cursor-pointer ${NIVEL_ESTILO[nivel]} ${
                              decisao.nivel === nivel ? 'ring-2 ring-zinc-900' : 'opacity-60'
                            }`}
                          >
                            {NIVEIS[nivel].rotulo}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={decisao.exigeAcao}
                          onChange={(e) => alterar(s.itemId, { exigeAcao: e.target.checked })}
                        />
                        Exige ação
                      </label>
                      <button
                        type="button"
                        className="botao"
                        onClick={() => alterar(s.itemId, { incluir: !decisao.incluir })}
                      >
                        {decisao.incluir ? 'Tirar do slide' : 'Pôr no slide'}
                      </button>
                    </div>
                  </div>

                  {s.alternativas.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-sutil">
                        Outros códigos considerados ({s.alternativas.length})
                      </summary>
                      <ul className="mt-1 space-y-1 pl-4 text-xs text-sutil">
                        {s.alternativas.map((a) => (
                          <li key={a.codigo}>
                            <button
                              type="button"
                              className="underline underline-offset-2"
                              onClick={() => alterar(s.itemId, { codigo: a.codigo })}
                            >
                              {a.codigo} – {a.titulo}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 4 — ações */}
      {paraTratar.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">4. Plano de ação</h2>
              <p className="mt-1 max-w-prose text-sm text-sutil">
                Uma ação para cada um dos {paraTratar.length} achados que exigem tratamento. A IA
                escreve o rascunho e escolhe a hierarquia de controle; você ajusta e define quem
                responde.
              </p>
            </div>
            <button type="button" className="botao-primario" onClick={() => void gerarAcoes(false)} disabled={carregando !== null}>
              {acoes.length > 0 ? 'Propor de novo' : 'Propor ações com IA'}
            </button>
          </div>

          {origemAcoes === 'local' && (
            <p className="mt-3 text-xs text-sutil">
              Sem chave do Gemini, o que sai é a estrutura da ação, não a ação. Reescreva cada linha.
            </p>
          )}

          {acoes.length > 0 && (
            <ul className="mt-5 space-y-4">
              {acoes.map((a) => (
                <li key={a.itemId} className="rounded border border-borda p-4">
                  <p className="text-xs text-sutil">{a.causaPadrao}</p>

                  <div className="mt-3">
                    <label className="rotulo" htmlFor={`acao-${a.itemId}`}>
                      Descrição da ação
                    </label>
                    <textarea
                      id={`acao-${a.itemId}`}
                      value={a.acao}
                      rows={2}
                      onChange={(e) => alterarAcao(a.itemId, { acao: e.target.value })}
                      className="campo"
                    />
                  </div>

                  {a.justificativa && <p className="mt-1 text-xs text-sutil">{a.justificativa}</p>}

                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="rotulo" htmlFor={`hier-${a.itemId}`}>
                        Hierarquia de controle
                      </label>
                      <select
                        id={`hier-${a.itemId}`}
                        value={a.hierarquia}
                        onChange={(e) => alterarAcao(a.itemId, { hierarquia: e.target.value as AcaoProposta['hierarquia'] })}
                        className="campo"
                      >
                        {HIERARQUIAS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="rotulo" htmlFor={`exec-${a.itemId}`}>
                        Executante
                      </label>
                      <input
                        id={`exec-${a.itemId}`}
                        value={a.executante}
                        onChange={(e) => alterarAcao(a.itemId, { executante: e.target.value })}
                        className="campo"
                      />
                    </div>
                    <div>
                      <label className="rotulo" htmlFor={`mat-${a.itemId}`}>
                        Matrícula
                      </label>
                      <input
                        id={`mat-${a.itemId}`}
                        value={a.matricula}
                        onChange={(e) => alterarAcao(a.itemId, { matricula: e.target.value })}
                        className="campo"
                      />
                    </div>
                    <div>
                      <label className="rotulo" htmlFor={`prazo-${a.itemId}`}>
                        Prazo
                      </label>
                      <input
                        id={`prazo-${a.itemId}`}
                        type="date"
                        value={a.prazo}
                        onChange={(e) => alterarAcao(a.itemId, { prazo: e.target.value })}
                        className="campo"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 5 — gerar */}
      {noSlide.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">5. Gerar o PowerPoint</h2>
              <p className="mt-1 text-sm text-sutil">
                {noSlide.length} cartão(ões) na classificação
                {acoes.length > 0 ? ` e ${acoes.length} ação(ões) no plano` : ', sem plano de ação'}.
              </p>
            </div>
            <button type="button" className="botao-primario" onClick={() => void gerar()} disabled={carregando !== null}>
              Baixar .pptx
            </button>
          </div>
        </section>
      )}

      {/* Evidências de coleta */}
      {evidencias.length > 0 && (
        <section className="cartao">
          <h2 className="text-base font-semibold">Evidências de coleta ({evidencias.length})</h2>
          <p className="mt-1 max-w-prose text-sm text-sutil">
            Itens lidos como tarefa de coleta, não como achado — por isso não recebem código.
          </p>
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {evidencias.map((e) => (
              <li key={e.id} className="text-sutil">
                <span className="text-xs">[{ROTULOS_PEEPO[e.categoria as CategoriaPeepo] ?? e.categoria}]</span>{' '}
                {e.texto}
                {e.responsavel && <span className="text-xs"> — {e.responsavel}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
