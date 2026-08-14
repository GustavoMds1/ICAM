'use client';

import { useMemo, useState } from 'react';
import { CODIGOS, NIVEIS, obterCodigo, ORDEM_COLUNAS, ROTULOS_COLUNA, type NivelIcam } from '@/lib/codigos';
import { ROTULOS_PEEPO, type ItemColetado, type DadosEvento, type CategoriaPeepo } from '@/lib/pptxLeitura';
import type { Sugestao } from '@/lib/classificacao';

/**
 * Fluxo em três passos: importar, revisar, gerar.
 *
 * A revisão é o coração da ferramenta. Por isso ela mostra, em cada linha, de
 * onde veio a sugestão (modelo ou associação local) e qual a confiança — sem
 * isso a pessoa aceita tudo no automático, que é o oposto do que a metodologia
 * pede.
 */

interface Decisao {
  incluir: boolean;
  codigo: string;
  nivel: NivelIcam;
}

const NIVEL_ESTILO: Record<NivelIcam, string> = {
  raiz: 'bg-raiz text-white border-red-700',
  contribuinte: 'bg-contribuinte text-texto border-yellow-600',
  constatado: 'bg-white text-texto border-borda',
};

export default function PaginaColeta() {
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const [itens, setItens] = useState<ItemColetado[]>([]);
  const [evento, setEvento] = useState<DadosEvento | null>(null);
  const [titulo, setTitulo] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [origem, setOrigem] = useState<'gemini' | 'local' | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});

  const constatacoes = useMemo(() => itens.filter((i) => i.tipo === 'constatacao'), [itens]);
  const evidencias = useMemo(() => itens.filter((i) => i.tipo === 'evidencia'), [itens]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);

  const aprovados = useMemo(
    () => sugestoes.filter((s) => decisoes[s.itemId]?.incluir !== false),
    [sugestoes, decisoes],
  );

  async function importar(arquivo: File) {
    setCarregando('Lendo o PowerPoint…');
    setErro(null);
    setAvisos([]);
    setSugestoes([]);
    setDecisoes({});

    try {
      const dados = new FormData();
      dados.append('arquivo', arquivo);
      const r = await fetch('/api/importar', { method: 'POST', body: dados });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro ?? 'falha ao importar');

      setItens(corpo.itens);
      setEvento(corpo.evento);
      setAvisos(corpo.avisos ?? []);
      setTitulo(arquivo.name.replace(/\.pptx$/i, ''));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível importar o arquivo.');
    } finally {
      setCarregando(null);
    }
  }

  async function classificar() {
    setCarregando('Associando os códigos ICAM…');
    setErro(null);

    try {
      const contexto = evento
        ? [evento.oQueAconteceu, evento.ondeAconteceu, evento.quandoAconteceu].filter(Boolean).join(' | ')
        : undefined;
      const r = await fetch('/api/classificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itens, contexto }),
      });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro ?? 'falha ao classificar');

      setSugestoes(corpo.sugestoes);
      setOrigem(corpo.origem);
      setAvisos(corpo.avisos ?? []);
      setDecisoes(
        Object.fromEntries(
          (corpo.sugestoes as Sugestao[]).map((s) => [
            s.itemId,
            { incluir: true, codigo: s.codigo, nivel: s.nivel },
          ]),
        ),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível classificar.');
    } finally {
      setCarregando(null);
    }
  }

  async function gerar() {
    setCarregando('Montando o slide…');
    setErro(null);

    try {
      const cartoes = aprovados.map((s) => {
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
        body: JSON.stringify({ cartoes, evento, tituloInvestigacao: titulo }),
      });
      if (!r.ok) throw new Error((await r.json()).erro ?? 'falha ao gerar');

      const avisosCabecalho = r.headers.get('x-avisos');
      if (avisosCabecalho) setAvisos(JSON.parse(decodeURIComponent(avisosCabecalho)));

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `classificacao-icam-${titulo || 'investigacao'}.pptx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o slide.');
    } finally {
      setCarregando(null);
    }
  }

  function alterar(itemId: string, mudanca: Partial<Decisao>) {
    setDecisoes((atual) => ({
      ...atual,
      [itemId]: { ...(atual[itemId] ?? { incluir: true, codigo: '', nivel: 'constatado' }), ...mudanca },
    }));
  }

  return (
    <div className="space-y-8">
      {erro && (
        <div role="alert" className="rounded-md border-l-4 border-red-600 bg-red-50 p-4 text-sm">
          {erro}
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

      {/* Passo 1 — importar */}
      <section className="cartao">
        <h2 className="text-base font-semibold">1. Importar a investigação</h2>
        <p className="mt-1 max-w-prose text-sm text-sutil">
          Envie o .pptx da investigação. São lidos os slides com o título &quot;Coleta de Dados&quot;,
          separando por PEEPO — Pessoas, Equipamento, Ambiente, Procedimentos e Organização — junto com a
          caixa do evento.
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

        {itens.length > 0 && (
          <div className="mt-4">
            <label className="rotulo" htmlFor="titulo">
              Título que aparece no slide
            </label>
            <input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="campo sm:max-w-lg"
            />
          </div>
        )}
      </section>

      {/* Passo 2 — classificar */}
      {constatacoes.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">2. Associar os códigos ICAM</h2>
              <p className="mt-1 max-w-prose text-sm text-sutil">
                A IA propõe um código e um nível para cada constatação. Tudo entra como proposta: o slide
                só usa o que você mantiver.
              </p>
            </div>
            <button
              type="button"
              className="botao-primario"
              onClick={() => void classificar()}
              disabled={carregando !== null}
            >
              {carregando ?? (sugestoes.length > 0 ? 'Classificar de novo' : 'Associar códigos com IA')}
            </button>
          </div>

          {origem && (
            <p className="mt-3 text-xs text-sutil">
              {origem === 'gemini'
                ? 'Sugestões vindas do Gemini. Confira o mecanismo de cada código antes de aceitar.'
                : 'Sem chave do Gemini configurada: as sugestões vieram da associação local por palavras, que é fraca. Trate cada linha como ponto de partida.'}
            </p>
          )}
        </section>
      )}

      {/* Passo 3 — revisar */}
      {sugestoes.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">3. Revisar item a item</h2>
              <p className="mt-1 text-sm text-sutil">
                {aprovados.length} de {sugestoes.length} cartões vão para o slide.
              </p>
            </div>
            <button type="button" className="botao-primario" onClick={() => void gerar()} disabled={carregando !== null || aprovados.length === 0}>
              Gerar slide (.pptx)
            </button>
          </div>

          <ul className="mt-5 space-y-4">
            {sugestoes.map((s) => {
              const item = itemPorId.get(s.itemId);
              const decisao = decisoes[s.itemId] ?? { incluir: true, codigo: s.codigo, nivel: s.nivel };
              const codigo = obterCodigo(decisao.codigo);

              return (
                <li
                  key={s.itemId}
                  className={`rounded border p-4 ${decisao.incluir ? 'border-borda' : 'border-dashed border-borda opacity-50'}`}
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

                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
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
                        <p className="mt-1 text-xs text-sutil">
                          Coluna: {ROTULOS_COLUNA[codigo.coluna]}
                          {codigo.generico && ' · código genérico, justifique no slide'}
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="rotulo">Nível</span>
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

                    <div className="flex items-end">
                      <button
                        type="button"
                        className="botao"
                        onClick={() => alterar(s.itemId, { incluir: !decisao.incluir })}
                      >
                        {decisao.incluir ? 'Tirar do slide' : 'Devolver ao slide'}
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

      {/* Evidências de coleta, só para conferência */}
      {evidencias.length > 0 && (
        <section className="cartao">
          <h2 className="text-base font-semibold">Evidências de coleta ({evidencias.length})</h2>
          <p className="mt-1 max-w-prose text-sm text-sutil">
            Itens lidos como tarefa de coleta, não como achado — por isso não recebem código. Se algum
            aqui for uma constatação, ele precisa estar escrito como frase no PowerPoint.
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
