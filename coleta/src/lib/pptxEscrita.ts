import PptxGenJS from 'pptxgenjs';
import { NIVEIS, obterCodigo, ORDEM_COLUNAS, ROTULOS_COLUNA, type ColunaIcam, type NivelIcam } from './codigos';
import type { DadosEvento } from './pptxLeitura';

/**
 * Geração do slide de classificação, no padrão do slide 13 do modelo.
 *
 * O que foi copiado do original, medido no arquivo enviado:
 *   - proporção 16:9 larga (33,87 cm x 19,05 cm);
 *   - quatro colunas de cartões, da esquerda para a direita, na sequência
 *     ICAM: organizacionais, condições, ações, defesas;
 *   - cartão com "CÓDIGO – Título - constatação", borda fina e canto reto;
 *   - vermelho para causa raiz, amarelo para fator contribuinte, branco para
 *     fato constatado;
 *   - caixa do evento na quinta coluna e legenda no rodapé dela.
 *
 * A altura do cartão acompanha o texto, e a coluna que estourar o slide gera
 * aviso em vez de sobrepor cartões — texto ilegível num slide de investigação
 * é pior do que um aviso pedindo para dividir em dois slides.
 */

export interface CartaoSlide {
  codigo: string;
  titulo: string;
  constatacao: string;
  nivel: NivelIcam;
}

export interface EntradaSlide {
  cartoes: CartaoSlide[];
  evento: DadosEvento;
  tituloInvestigacao?: string;
}

export interface ResultadoSlide {
  arquivo: Buffer;
  avisos: string[];
}

// Medidas em polegadas — a unidade do pptxgenjs.
const LARGURA = 13.333;
const ALTURA = 7.5;
const TOPO_CONTEUDO = 0.85;
const RODAPE = 0.25;
const LARGURA_COLUNA = 2.45;
const ESPACO_COLUNA = 0.12;
const MARGEM_ESQUERDA = 0.12;
const LARGURA_EVENTO = 2.5;

/** Altura estimada do cartão: ~34 caracteres por linha, 0,17" por linha. */
function alturaCartao(texto: string): number {
  const linhas = Math.max(2, Math.ceil(texto.length / 34));
  return Math.min(2.4, 0.28 + linhas * 0.17);
}

export async function gerarSlide(entrada: EntradaSlide): Promise<ResultadoSlide> {
  const avisos: string[] = [];
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'ICAM16x9', width: LARGURA, height: ALTURA });
  pptx.layout = 'ICAM16x9';

  // --- Distribuição em colunas e páginas -----------------------------------
  const porColuna = new Map<ColunaIcam, CartaoSlide[]>();
  for (const cartao of entrada.cartoes) {
    const coluna = obterCodigo(cartao.codigo)?.coluna ?? 'organizacionais';
    const lista = porColuna.get(coluna) ?? [];
    lista.push(cartao);
    porColuna.set(coluna, lista);
  }

  /**
   * Cartão que não cabe vai para o slide seguinte, nunca para o lixo.
   *
   * Perder achado de investigação porque a coluna encheu seria o pior tipo de
   * falha silenciosa: o slide sairia bonito e incompleto.
   */
  const paginas: Map<ColunaIcam, CartaoSlide[]>[] = [];
  const restantes = new Map(ORDEM_COLUNAS.map((c) => [c, [...(porColuna.get(c) ?? [])]]));

  while ([...restantes.values()].some((lista) => lista.length > 0)) {
    const pagina = new Map<ColunaIcam, CartaoSlide[]>();
    for (const coluna of ORDEM_COLUNAS) {
      const fila = restantes.get(coluna) ?? [];
      const cabe: CartaoSlide[] = [];
      let y = TOPO_CONTEUDO;

      while (fila.length > 0) {
        const proximo = fila[0]!;
        const h = alturaCartao(textoDoCartao(proximo));
        if (y + h > ALTURA - RODAPE) break;
        cabe.push(fila.shift()!);
        y += h + 0.08;
      }

      // Cartão sozinho maior que a coluna inteira travaria o laço.
      if (cabe.length === 0 && fila.length > 0) cabe.push(fila.shift()!);
      pagina.set(coluna, cabe);
    }
    paginas.push(pagina);
  }

  if (paginas.length === 0) paginas.push(new Map());
  if (paginas.length > 1) {
    avisos.push(
      `Os cartões não cabem em um slide só: foram distribuídos em ${paginas.length}, mantendo as colunas na mesma ordem.`,
    );
  }

  paginas.forEach((pagina, indice) => {
    montarPagina(pptx, entrada, pagina, indice + 1, paginas.length);
  });

  const dados = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return { arquivo: dados, avisos };
}

function textoDoCartao(cartao: CartaoSlide): string {
  return `${cartao.codigo} – ${cartao.titulo} - ${cartao.constatacao}`;
}

function montarPagina(
  pptx: PptxGenJS,
  entrada: EntradaSlide,
  pagina: Map<ColunaIcam, CartaoSlide[]>,
  numero: number,
  total: number,
): void {
  const slide = pptx.addSlide();

  slide.addText('Metodologia de Investigação ICAM', {
    x: 0.3,
    y: 0.18,
    w: 6,
    h: 0.35,
    fontSize: 14,
    bold: true,
    color: '181818',
  });

  if (entrada.tituloInvestigacao) {
    slide.addText(
      total > 1 ? `${entrada.tituloInvestigacao} (${numero} de ${total})` : entrada.tituloInvestigacao,
      { x: 0.3, y: 0.5, w: 8, h: 0.3, fontSize: 10, color: '585858' },
    );
  }

  ORDEM_COLUNAS.forEach((coluna, indice) => {
    const x = MARGEM_ESQUERDA + indice * (LARGURA_COLUNA + ESPACO_COLUNA);

    slide.addText(ROTULOS_COLUNA[coluna], {
      x,
      y: TOPO_CONTEUDO - 0.4,
      w: LARGURA_COLUNA,
      h: 0.3,
      fontSize: 9,
      bold: true,
      color: '585858',
      align: 'center',
    });

    let y = TOPO_CONTEUDO;
    for (const cartao of pagina.get(coluna) ?? []) {
      const texto = textoDoCartao(cartao);
      const h = alturaCartao(texto);
      const nivel = NIVEIS[cartao.nivel];

      slide.addText(texto, {
        x,
        y,
        w: LARGURA_COLUNA,
        h,
        fontSize: 8,
        color: nivel.textoEscuro ? '181818' : 'FFFFFF',
        fill: { color: nivel.cor },
        line: { color: '404040', width: 0.75 },
        valign: 'top',
        margin: 4,
        wrap: true,
      });

      y += h + 0.08;
    }
  });

  // --- Caixa do evento -----------------------------------------------------
  const xEvento = LARGURA - LARGURA_EVENTO - 0.15;
  const camposEvento: [string, string | null][] = [
    ['O que aconteceu?', entrada.evento.oQueAconteceu],
    ['Quem estava envolvido?', entrada.evento.quemEnvolvido],
    ['Onde aconteceu?', entrada.evento.ondeAconteceu],
    ['Quando aconteceu?', entrada.evento.quandoAconteceu],
    ['Consequência real', entrada.evento.consequenciaReal],
    ['Consequência potencial', entrada.evento.consequenciaPotencial],
  ];

  const textoEvento = camposEvento.flatMap(([rotulo, valor]) => [
    { text: `${rotulo}\n`, options: { bold: true, fontSize: 8, color: 'FFFFFF' } },
    { text: `${valor ?? 'não informado'}\n\n`, options: { fontSize: 8, color: 'FFFFFF' } },
  ]);

  slide.addText(textoEvento, {
    x: xEvento,
    y: TOPO_CONTEUDO - 0.4,
    w: LARGURA_EVENTO,
    h: 5.2,
    fill: { color: '585858' },
    valign: 'top',
    margin: 6,
    wrap: true,
  });

  // --- Legenda -------------------------------------------------------------
  slide.addText('LEGENDA', {
    x: xEvento,
    y: 5.95,
    w: LARGURA_EVENTO,
    h: 0.22,
    fontSize: 9,
    bold: true,
    color: '181818',
  });

  (['raiz', 'contribuinte', 'constatado'] as NivelIcam[]).forEach((nivel, i) => {
    const y = 6.25 + i * 0.32;
    slide.addShape('rect', {
      x: xEvento,
      y,
      w: 0.28,
      h: 0.22,
      fill: { color: NIVEIS[nivel].cor },
      line: { color: '404040', width: 0.75 },
    });
    slide.addText(NIVEIS[nivel].rotulo, {
      x: xEvento + 0.34,
      y,
      w: LARGURA_EVENTO - 0.34,
      h: 0.22,
      fontSize: 9,
      color: '181818',
      valign: 'middle',
    });
  });
}
