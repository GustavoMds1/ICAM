import JSZip from 'jszip';

/**
 * Leitura dos slides de Coleta de Dados.
 *
 * O arquivo .pptx é um zip de XML. Em vez de um analisador genérico de
 * OpenXML, este módulo lê exatamente o que o modelo de investigação usa:
 * caixas de texto posicionadas em colunas, uma por categoria PEEPO.
 *
 * A leitura é deliberadamente conservadora. Item que não puder ser atribuído a
 * uma categoria é devolvido como "nao_classificado" em vez de ser chutado para
 * a coluna mais provável — palpite silencioso aqui vira código ICAM errado no
 * slide final.
 */

export const CATEGORIAS_PEEPO = [
  'pessoas',
  'equipamento',
  'ambiente',
  'procedimentos',
  'organizacao',
] as const;
export type CategoriaPeepo = (typeof CATEGORIAS_PEEPO)[number];

export const ROTULOS_PEEPO: Record<CategoriaPeepo, string> = {
  pessoas: 'Pessoas',
  equipamento: 'Equipamento',
  ambiente: 'Ambiente',
  procedimentos: 'Procedimentos',
  organizacao: 'Organização',
};

/**
 * Os slides de coleta têm dois conteúdos diferentes com a mesma aparência:
 *
 *   evidencia    — o que precisa ser buscado ("Telemetria - Arley"). Tem dono
 *                  e é tarefa, não achado. Não vira código ICAM.
 *   constatacao  — o que a evidência mostrou ("O trecho não dispõe de
 *                  sinalização vertical"). É isso que o slide 13 classifica.
 *
 * A separação é palpite bem fundamentado, não certeza — por isso o tipo é
 * exibido na revisão e pode ser trocado com um clique.
 */
export type TipoItem = 'evidencia' | 'constatacao';

export interface ItemColetado {
  /** Ordem de leitura, usada como identificador estável na revisão. */
  id: string;
  categoria: CategoriaPeepo | 'nao_classificado';
  tipo: TipoItem;
  texto: string;
  /** Nome que aparece ao fim do item, quando há. */
  responsavel: string | null;
  slide: number;
}

export interface DadosEvento {
  oQueAconteceu: string | null;
  quemEnvolvido: string | null;
  ondeAconteceu: string | null;
  quandoAconteceu: string | null;
  consequenciaReal: string | null;
  consequenciaPotencial: string | null;
}

export interface LeituraPptx {
  itens: ItemColetado[];
  evento: DadosEvento;
  slidesLidos: number[];
  avisos: string[];
}

interface FormaSlide {
  x: number;
  y: number;
  paragrafos: string[];
}

const RE_SP = /<p:sp>[\s\S]*?<\/p:sp>/g;
const RE_OFF = /<a:off x="(-?\d+)" y="(-?\d+)"/;
const RE_PARAGRAFO = /<a:p>([\s\S]*?)<\/a:p>/g;
/**
 * Texto e quebra de linha na ordem em que aparecem.
 *
 * Quebra de linha dentro do parágrafo (o Shift+Enter do PowerPoint) separa
 * itens tanto quanto um parágrafo novo. Ler só as marcas de parágrafo faria a
 * coluna inteira virar um item só — e foi exatamente o que aconteceu no
 * primeiro teste com arquivo montado dessa forma.
 */
const RE_TEXTO_OU_QUEBRA = /<a:t>([\s\S]*?)<\/a:t>|<a:br\s*\/>/g;

function desescapar(xml: string): string {
  return xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Extrai as formas de um slide com posição e parágrafos já em texto puro. */
export function lerFormas(xml: string): FormaSlide[] {
  const formas: FormaSlide[] = [];

  for (const bloco of xml.match(RE_SP) ?? []) {
    const posicao = RE_OFF.exec(bloco);
    const paragrafos: string[] = [];

    for (const p of bloco.matchAll(RE_PARAGRAFO)) {
      const partes: string[] = [];
      for (const t of (p[1] ?? '').matchAll(RE_TEXTO_OU_QUEBRA)) {
        partes.push(t[1] === undefined ? '\n' : desescapar(t[1]));
      }
      // Cada linha vira um item próprio, venha de parágrafo ou de quebra.
      for (const linha of partes.join('').split(/\r?\n/)) paragrafos.push(linha.trim());
    }

    if (paragrafos.some((p) => p.length > 0)) {
      formas.push({
        x: posicao ? Number(posicao[1]) : 0,
        y: posicao ? Number(posicao[2]) : 0,
        paragrafos,
      });
    }
  }

  return formas;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function reconhecerCategoria(texto: string): CategoriaPeepo | null {
  const n = normalizar(texto);
  if (n.startsWith('pessoa')) return 'pessoas';
  if (n.startsWith('equipamento')) return 'equipamento';
  if (n.startsWith('ambiente')) return 'ambiente';
  if (n.startsWith('procedimento')) return 'procedimentos';
  if (n.startsWith('organizacao') || n.startsWith('organizacional')) return 'organizacao';
  return null;
}

/** Cabeçalhos do modelo que não são conteúdo coletado. */
function ehCabecalho(texto: string): boolean {
  const n = normalizar(texto);
  return (
    n.startsWith('coleta de evidencia') ||
    n.startsWith('coleta de dados') ||
    n.startsWith('metodologia de investigacao') ||
    n.startsWith('peepo')
  );
}

/**
 * Separa o responsável do fim do item.
 *
 * O modelo escreve "texto do item - Nome Sobrenome JSL". Só é tratado como
 * responsável o trecho curto, sem pontuação de frase, ao fim da linha — assim
 * um item que legitimamente termina com hífen não perde conteúdo.
 */
export function separarResponsavel(texto: string): { texto: string; responsavel: string | null } {
  const limpo = texto.replace(/^[\s.·•-]+/, '').trim();
  const corte = /^(.*?)[\s]*[-–][\s]*([A-ZÀ-Ú][^-–.;:]{2,40})$/u.exec(limpo);
  if (!corte) return { texto: limpo, responsavel: null };

  const corpo = (corte[1] ?? '').trim();
  const nome = (corte[2] ?? '').trim();
  // Um item precisa sobrar depois do corte; nome com número quase sempre é
  // continuação da frase, não pessoa.
  if (corpo.length < 15 || /\d/.test(nome)) return { texto: limpo, responsavel: null };
  return { texto: corpo, responsavel: nome };
}

const CAMPOS_EVENTO: { chave: keyof DadosEvento; rotulo: RegExp }[] = [
  { chave: 'oQueAconteceu', rotulo: /^o que aconteceu/ },
  { chave: 'quemEnvolvido', rotulo: /^quem estava envolvido/ },
  { chave: 'ondeAconteceu', rotulo: /^onde aconteceu/ },
  { chave: 'quandoAconteceu', rotulo: /^quando aconteceu/ },
  { chave: 'consequenciaReal', rotulo: /^consequencia real/ },
  { chave: 'consequenciaPotencial', rotulo: /^consequencia potencial/ },
];

/**
 * Lê a caixa "O que aconteceu / Quem / Onde / Quando / Consequências".
 *
 * Aceita tanto rótulo e valor em parágrafos separados quanto na mesma linha
 * depois de dois-pontos, porque o modelo usa as duas formas.
 */
export function lerEvento(formas: FormaSlide[]): DadosEvento {
  const evento: DadosEvento = {
    oQueAconteceu: null,
    quemEnvolvido: null,
    ondeAconteceu: null,
    quandoAconteceu: null,
    consequenciaReal: null,
    consequenciaPotencial: null,
  };

  for (const forma of formas) {
    const paragrafos = forma.paragrafos.filter((p) => p.length > 0);
    for (let i = 0; i < paragrafos.length; i += 1) {
      const linha = paragrafos[i] ?? '';
      const n = normalizar(linha);
      const campo = CAMPOS_EVENTO.find((c) => c.rotulo.test(n));
      if (!campo || evento[campo.chave]) continue;

      const aposDoisPontos = linha.split(':').slice(1).join(':').trim();
      evento[campo.chave] = aposDoisPontos.length > 0 ? aposDoisPontos : (paragrafos[i + 1] ?? null);
    }
  }

  return evento;
}

export async function lerPptx(arquivo: ArrayBuffer | Uint8Array): Promise<LeituraPptx> {
  const zip = await JSZip.loadAsync(arquivo);
  const nomes = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => numeroDoSlide(a) - numeroDoSlide(b));

  if (nomes.length === 0) {
    return {
      itens: [],
      evento: lerEvento([]),
      slidesLidos: [],
      avisos: ['O arquivo não parece ser um PowerPoint com slides (.pptx).'],
    };
  }

  const itens: ItemColetado[] = [];
  const slidesLidos: number[] = [];
  const avisos: string[] = [];
  const todasAsFormas: FormaSlide[] = [];
  const vistos = new Set<string>();

  for (const nome of nomes) {
    const numero = numeroDoSlide(nome);
    const xml = await zip.files[nome]!.async('string');
    const formas = lerFormas(xml);
    todasAsFormas.push(...formas);

    const ehColeta = formas.some((f) => f.paragrafos.some((p) => normalizar(p) === 'coleta de dados'));
    if (!ehColeta) continue;
    slidesLidos.push(numero);

    // As colunas ficam lado a lado; ordenar por x preserva a ordem visual.
    for (const forma of [...formas].sort((a, b) => a.x - b.x)) {
      const paragrafos = forma.paragrafos.filter((p) => p.length > 0);
      if (paragrafos.length === 0) continue;

      const categoria = reconhecerCategoria(paragrafos[0] ?? '');
      if (!categoria) continue;

      for (const bruto of paragrafos.slice(1)) {
        if (ehCabecalho(bruto)) continue;
        const marcadoComoAchado = /^[\s]*[.·•]/.test(bruto);
        const { texto, responsavel } = separarResponsavel(bruto);
        if (texto.length < 8) continue;

        // Ter dono é o sinal mais forte de que a linha é tarefa de coleta, e
        // não achado: ninguém atribui um fato a alguém. Entre os itens sem
        // dono, vale o ponto que o modelo usa para marcar achado, ou o
        // tamanho — pedido de coleta é curto, constatação é frase.
        const tipo: TipoItem =
          responsavel === null && (marcadoComoAchado || texto.length > 60)
            ? 'constatacao'
            : 'evidencia';

        // O mesmo item aparece repetido entre os slides de coleta; a segunda
        // ocorrência não é informação nova.
        const chave = `${categoria}|${normalizar(texto)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);

        itens.push({
          id: `item-${itens.length + 1}`,
          categoria,
          tipo,
          texto,
          responsavel,
          slide: numero,
        });
      }
    }
  }

  if (slidesLidos.length === 0) {
    avisos.push(
      'Nenhum slide com o título "Coleta de Dados" foi encontrado. Confira se o arquivo é a apresentação da investigação.',
    );
  }

  return { itens, evento: lerEvento(todasAsFormas), slidesLidos, avisos };
}

function numeroDoSlide(nome: string): number {
  return Number(/slide(\d+)\.xml$/.exec(nome)?.[1] ?? 0);
}
