'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CODIGOS,
  HIERARQUIAS,
  NIVEIS,
  obterCodigo,
  ORDEM_COLUNAS,
  ROTULOS_COLUNA,
  type NivelIcam,
} from '@/lib/codigos';
import {
  ROTULOS_PEEPO,
  type ItemColetado,
  type DadosEvento,
  type CategoriaPeepo,
  type TipoItem,
} from '@/lib/pptxLeitura';
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

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Filtro da lista de códigos.
 *
 * O código já escolhido passa sempre, mesmo fora do filtro: se ele sumisse da
 * lista, o campo perderia o valor e trocaria a escolha da pessoa sozinho.
 */
function casaFiltro(
  codigo: (typeof CODIGOS)[number],
  filtro: string,
  selecionado: string,
): boolean {
  if (codigo.codigo === selecionado) return true;
  const busca = semAcento(filtro).trim();
  if (busca === '') return true;
  return semAcento(`${codigo.codigo} ${codigo.titulo}`).includes(busca);
}

export default function PaginaColeta() {
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; codigo?: string; passo?: 'codigos' | 'acoes' } | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const [itens, setItens] = useState<ItemColetado[]>([]);
  const [evento, setEvento] = useState<DadosEvento | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [origem, setOrigem] = useState<'ia' | 'local' | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const [acoes, setAcoes] = useState<AcaoProposta[]>([]);
  const [origemAcoes, setOrigemAcoes] = useState<'ia' | 'local' | null>(null);

  /**
   * Estado da IA assistida.
   *
   * `iaDisponivel` vem do servidor e responde "existe chave configurada?" —
   * nunca qual é. Sem essa consulta o botão prometeria algo que só falharia na
   * hora de usar, no meio de uma investigação.
   *
   * `usarIa` é escolha desta sessão e viaja em cada requisição. Não é variável
   * de ambiente: o navegador não muda o ambiente do servidor.
   */
  const [iaDisponivel, setIaDisponivel] = useState(false);
  const [usarIa, setUsarIa] = useState(false);

  /** Texto digitado para filtrar os 101 códigos, por item da revisão. */
  const [filtroCodigo, setFiltroCodigo] = useState<Record<string, string>>({});

  useEffect(() => {
    let ativo = true;
    void fetch('/api/estado')
      .then((r) => r.json())
      .then((e: { iaDisponivel?: boolean; iaPadrao?: boolean }) => {
        if (!ativo) return;
        setIaDisponivel(Boolean(e.iaDisponivel));
        setUsarIa(Boolean(e.iaPadrao));
      })
      // Falha ao consultar vira "indisponível": prometer menos e cumprir.
      .catch(() => {
        if (ativo) setIaDisponivel(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const constatacoes = useMemo(() => itens.filter((i) => i.tipo === 'constatacao'), [itens]);
  const evidencias = useMemo(() => itens.filter((i) => i.tipo === 'evidencia'), [itens]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);

  /**
   * Constatações que ainda não passaram pela comparação — em geral porque a
   * pessoa acabou de promover uma evidência. Precisam de aviso: sem código,
   * elas não aparecem no passo 3 e sumiriam do slide caladas.
   */
  const semCodigo = useMemo(
    () => constatacoes.filter((c) => !sugestoes.some((s) => s.itemId === c.id)),
    [constatacoes, sugestoes],
  );

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

  async function classificar() {
    setCarregando('Comparando com os 101 códigos…');
    setErro(null);

    try {
      const r = await fetch('/api/classificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itens, contexto, usarIa }),
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

  async function gerarAcoes() {
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
        body: JSON.stringify({ achados, contexto, usarIa }),
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

  /**
   * Promove uma evidência a constatação, ou devolve uma constatação à lista de
   * tarefas de coleta.
   *
   * Existe porque nenhuma regra automática acerta sempre, e quem sabe qual é
   * qual é quem investigou. Sem este botão, um achado lido como tarefa some do
   * slide sem ninguém perceber — erro de omissão, o mais difícil de notar numa
   * revisão. A separação automática é palpite; esta é a palavra final.
   */
  /** Marca ou desmarca a lista inteira de uma vez. Com 50 itens, faz diferença. */
  function marcarTodos(tipo: TipoItem) {
    setItens((atual) => atual.map((i) => ({ ...i, tipo })));
    if (tipo === 'evidencia') {
      setSugestoes([]);
      setAcoes([]);
      setDecisoes({});
    }
  }

  function alternarTipo(id: string, novoTipo: TipoItem) {
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, tipo: novoTipo } : i)));

    // Virou tarefa de coleta: sai da revisão na hora, levando junto a sugestão,
    // a decisão e a ação. Deixar rastro de um item que não é mais achado é
    // como se monta slide com o que ninguém aprovou.
    if (novoTipo === 'evidencia') {
      setSugestoes((atual) => atual.filter((s) => s.itemId !== id));
      setAcoes((atual) => atual.filter((a) => a.itemId !== id));
      setDecisoes((atual) => {
        const copia = { ...atual };
        delete copia[id];
        return copia;
      });
    }
  }

  return (
    <div className="space-y-8">
      {/*
        Liga e desliga a IA assistida para os passos 2 e 4.

        Fica no topo, fora dos passos, porque vale para o fluxo inteiro — e
        porque quem entra na tela precisa saber o que produziu o que vai ler,
        antes de ler. O botão só habilita quando o servidor confirma que há
        chave configurada: botão que promete e falha depois é pior que botão
        desabilitado com o motivo escrito ao lado.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-borda bg-white p-4">
        <div className="max-w-prose">
          <p className="text-sm font-semibold">
            IA assistida:{' '}
            <span className={usarIa ? 'text-green-700' : 'text-sutil'}>
              {usarIa ? 'ativada' : 'desativada'}
            </span>
          </p>
          <p className="mt-1 text-xs text-sutil">
            {!iaDisponivel
              ? 'Não está configurada neste servidor. A identificação local continua funcionando normalmente — ela é o modo padrão, não um plano B.'
              : usarIa
                ? 'Os códigos e os planos de ação são redigidos por IA. Nada vai para o slide sem a sua revisão.'
                : 'Identificação local: comparação feita neste servidor, sem rede e sem custo por uso. O plano de ação sai como esqueleto para você escrever.'}
          </p>
          {iaDisponivel && sugestoes.length > 0 && (
            <p className="mt-1 text-xs text-sutil">
              A troca vale a partir da próxima comparação. O que já está na tela continua sendo o
              que foi gerado antes.
            </p>
          )}
        </div>

        <button
          type="button"
          className="botao"
          onClick={() => setUsarIa((valor) => !valor)}
          disabled={!iaDisponivel || carregando !== null}
          aria-pressed={usarIa}
        >
          {usarIa ? 'Desativar IA' : 'Ativar IA'}
        </button>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border-l-4 border-red-600 bg-red-50 p-4 text-sm">
          <p>{erro.mensagem}</p>
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

      {/*
        Triagem: achado ou tarefa de coleta.

        Estava escondida numa lista só de leitura no fim da página, e a
        separação automática decidia sozinha. Com isso, um achado lido como
        tarefa sumia do slide sem ninguém ver — e numa investigação real de 50
        itens, apenas um passou.

        Agora a leitura automática só **pré-marca**, e a lista inteira fica à
        vista, entre importar e classificar, que é onde a decisão pertence.
      */}
      {itens.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-prose">
              <h2 className="text-base font-semibold">O que vai receber código</h2>
              <p className="mt-1 text-sm text-sutil">
                Já marquei o que me pareceu <strong>achado</strong>; o resto eu li como tarefa de
                coleta. Essa leitura erra, e errar aqui é grave — item desmarcado não recebe código
                e não vai para o slide. <strong>Confira a lista inteira antes de seguir.</strong>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="botao" onClick={() => marcarTodos('constatacao')}>
                Marcar todos
              </button>
              <button type="button" className="botao" onClick={() => marcarTodos('evidencia')}>
                Desmarcar todos
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm font-medium">
            {constatacoes.length} de {itens.length} marcados como achado
          </p>

          <ul className="mt-2 space-y-1">
            {itens.map((i) => {
              const marcado = i.tipo === 'constatacao';
              return (
                <li key={i.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${
                      marcado ? 'border-borda bg-white' : 'border-transparent text-sutil'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={marcado}
                      onChange={(e) =>
                        alternarTipo(i.id, e.target.checked ? 'constatacao' : 'evidencia')
                      }
                    />
                    <span>
                      <span className="text-xs">
                        [{ROTULOS_PEEPO[i.categoria as CategoriaPeepo] ?? i.categoria}]
                      </span>{' '}
                      {i.texto}
                      {i.responsavel && <span className="text-xs"> — {i.responsavel}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 2 — classificar */}
      {constatacoes.length > 0 && (
        <section className="cartao">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">2. Identificar os códigos ICAM</h2>
              <p className="mt-1 max-w-prose text-sm text-sutil">
                Cada constatação é comparada com os 101 códigos do catálogo. Vem o melhor, as
                alternativas próximas e a confiança da escolha.{' '}
                <strong>Causa raiz não é definida aqui</strong> — ela sai da análise causal, depois,
                com a equipe.
              </p>
            </div>
            <button
              type="button"
              className="botao-primario"
              onClick={() => void classificar()}
              disabled={carregando !== null}
            >
              {carregando ?? (sugestoes.length > 0 ? 'Comparar de novo' : 'Comparar com o catálogo')}
            </button>
          </div>

          {sugestoes.length > 0 && semCodigo.length > 0 && (
            <p className="mt-3 rounded border-l-4 border-yellow-500 bg-yellow-50 p-3 text-sm">
              {semCodigo.length} constatação(ões) ainda sem código — clique em{' '}
              <strong>Comparar de novo</strong> para incluí-la(s) na revisão.
            </p>
          )}

          {origem && (
            <p className="mt-3 text-xs text-sutil">
              {origem === 'ia'
                ? 'Sugestões redigidas pela IA assistida. Confira o mecanismo de cada código antes de aceitar.'
                : 'Identificação local: comparação por termo, expressão e léxico do domínio, tudo neste servidor. Confiança alta significa vantagem folgada sobre o segundo colocado — não dispensa a sua conferência.'}
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
                      <span
                        className={`selo ${
                          s.confianca === 'alta'
                            ? 'border-green-700 bg-green-50 text-green-800'
                            : s.confianca === 'media'
                              ? 'border-amber-600 bg-amber-50 text-amber-800'
                              : 'border-borda bg-zinc-100 text-sutil'
                        }`}
                      >
                        confiança {s.confianca}
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
                      {/*
                        Buscar entre 101 códigos numa lista suspensa é o que
                        mais custa tempo quando a sugestão erra. O filtro deixa
                        a lista do tamanho da dúvida.
                      */}
                      <input
                        type="search"
                        className="campo mb-1"
                        placeholder="Filtrar: sinalização, treinamento, DF19…"
                        value={filtroCodigo[s.itemId] ?? ''}
                        onChange={(e) =>
                          setFiltroCodigo((atual) => ({ ...atual, [s.itemId]: e.target.value }))
                        }
                        aria-label="Filtrar a lista de códigos"
                      />
                      <select
                        id={`codigo-${s.itemId}`}
                        value={decisao.codigo}
                        onChange={(e) => alterar(s.itemId, { codigo: e.target.value })}
                        className="campo"
                      >
                        {ORDEM_COLUNAS.map((coluna) => {
                          const visiveis = CODIGOS.filter(
                            (c) =>
                              c.coluna === coluna &&
                              casaFiltro(c, filtroCodigo[s.itemId] ?? '', decisao.codigo),
                          );
                          if (visiveis.length === 0) return null;
                          return (
                            <optgroup key={coluna} label={ROTULOS_COLUNA[coluna]}>
                              {visiveis.map((c) => (
                                <option key={c.codigo} value={c.codigo}>
                                  {c.codigo} – {c.titulo}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
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
                      <button
                        type="button"
                        className="botao"
                        onClick={() => alternarTipo(s.itemId, 'evidencia')}
                        title="Não é achado: devolver para a lista de tarefas de coleta"
                      >
                        Não é achado
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
                Uma linha para cada um dos {paraTratar.length} achados que exigem tratamento, com o
                ponto de partida da hierarquia de controle. Você escreve a ação e define quem
                responde.
              </p>
            </div>
            <button type="button" className="botao-primario" onClick={() => void gerarAcoes()} disabled={carregando !== null}>
              {acoes.length > 0 ? 'Montar de novo' : 'Montar o plano'}
            </button>
          </div>

          {origemAcoes === 'local' && (
            <p className="mt-3 text-xs text-sutil">
              Com a IA desativada, o que sai aqui é o esqueleto da ação — o verbo e a hierarquia
              vêm do tipo do achado, não de análise. <strong>Reescreva cada linha.</strong>
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

    </div>
  );
}
