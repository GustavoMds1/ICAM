import PptxGenJS from 'pptxgenjs';
import { NIVEIS, obterCodigo, ORDEM_COLUNAS, type ColunaIcam, type NivelIcam } from './codigos';
import type { AcaoProposta } from './acoes';
import type { DadosEvento } from './pptxLeitura';

/**
 * Geração das páginas no formato do modelo da investigação.
 *
 * Tudo aqui foi medido no arquivo enviado, não estimado:
 *
 *   cartão      retângulo arredondado, 2,544" de largura, borda pontilhada de
 *               0,75pt em cinza claro. Fato constatado é TRANSPARENTE — só a
 *               borda; fator contribuinte é amarelo FFFF00 sólido.
 *   texto       9pt, duas partes no mesmo parágrafo: "CÓDIGO – Título- " em
 *               negrito cinza-escuro e a constatação em cinza médio.
 *   colunas     x = 0,090" | 2,756" | 5,396" | 8,058", da esquerda para a
 *               direita na sequência ICAM.
 *   evento      caixa transparente à direita, 14pt, rótulos em negrito.
 *   legenda     abaixo da caixa do evento, amostra de cor + rótulo.
 *
 * O modelo não tem título nem cabeçalho de coluna neste slide, e aqui também
 * não tem: acrescentar enfeite que o original não usa é justamente o que faz o
 * slide parecer "de outro lugar" quando entra no meio da apresentação.
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
  acoes?: AcaoProposta[];
}

export interface ResultadoSlide {
  arquivo: Buffer;
  avisos: string[];
}

// Medidas em polegadas, convertidas dos EMU do arquivo original.
const LARGURA = 13.333;
const ALTURA = 7.5;

const COLUNA_X: Record<ColunaIcam, number> = {
  organizacionais: 0.0895,
  condicoes: 2.7561,
  acoes: 5.3958,
  defesas: 8.0582,
};
const LARGURA_CARTAO = 2.5445;
const TOPO = 0.7424;
const LIMITE_INFERIOR = 6.6;
const ESPACO_ENTRE_CARTOES = 0.06;

const EVENTO_X = 10.6862;
const EVENTO_Y = 0.7424;
const EVENTO_W = 2.4748;
const EVENTO_H = 5.4695;

const FONTE = 'Vale Sans';
const CINZA_TITULO = '404040';
const CINZA_TEXTO = '595959';
const CINZA_BORDA = 'A6A6A6';
const CINZA_EVENTO = '585858';

/**
 * Altura do cartão a partir do texto.
 *
 * Calibrado contra o original: 9pt em 2,54" de largura cabem ~46 caracteres por
 * linha, e cada linha ocupa 0,145" com o espaçamento de 112% do modelo.
 */
function alturaCartao(texto: string): number {
  const linhas = Math.max(2, Math.ceil(texto.length / 46));
  return Math.min(2.2, 0.26 + linhas * 0.145);
}

function textoDoCartao(cartao: CartaoSlide): { negrito: string; corpo: string } {
  return {
    negrito: `${cartao.codigo} – ${cartao.titulo}- `,
    corpo: cartao.constatacao,
  };
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

  const paginas: Map<ColunaIcam, CartaoSlide[]>[] = [];
  const restantes = new Map(ORDEM_COLUNAS.map((c) => [c, [...(porColuna.get(c) ?? [])]]));

  while ([...restantes.values()].some((lista) => lista.length > 0)) {
    const pagina = new Map<ColunaIcam, CartaoSlide[]>();
    for (const coluna of ORDEM_COLUNAS) {
      const fila = restantes.get(coluna) ?? [];
      const cabe: CartaoSlide[] = [];
      let y = TOPO;

      while (fila.length > 0) {
        const proximo = fila[0]!;
        const t = textoDoCartao(proximo);
        const h = alturaCartao(t.negrito + t.corpo);
        if (y + h > LIMITE_INFERIOR) break;
        cabe.push(fila.shift()!);
        y += h + ESPACO_ENTRE_CARTOES;
      }

      if (cabe.length === 0 && fila.length > 0) cabe.push(fila.shift()!);
      pagina.set(coluna, cabe);
    }
    paginas.push(pagina);
  }

  if (paginas.length === 0) paginas.push(new Map());
  if (paginas.length > 1) {
    avisos.push(
      `Os cartões não cabem em uma página só: foram distribuídos em ${paginas.length}, mantendo as colunas na mesma ordem.`,
    );
  }

  for (const pagina of paginas) montarClassificacao(pptx, entrada.evento, pagina);

  if (entrada.acoes && entrada.acoes.length > 0) {
    montarPlanoDeAcao(pptx, entrada.acoes, avisos);
  }

  const dados = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return { arquivo: dados, avisos };
}

function montarClassificacao(
  pptx: PptxGenJS,
  evento: DadosEvento,
  pagina: Map<ColunaIcam, CartaoSlide[]>,
): void {
  const slide = pptx.addSlide();

  for (const coluna of ORDEM_COLUNAS) {
    const x = COLUNA_X[coluna];
    let y = TOPO;

    for (const cartao of pagina.get(coluna) ?? []) {
      const { negrito, corpo } = textoDoCartao(cartao);
      const h = alturaCartao(negrito + corpo);
      const preenchimento = NIVEIS[cartao.nivel].cor;

      slide.addText(
        [
          { text: negrito, options: { bold: true, color: CINZA_TITULO, fontSize: 9, fontFace: FONTE } },
          { text: corpo, options: { color: CINZA_TEXTO, fontSize: 9, fontFace: FONTE } },
        ],
        {
          shape: 'roundRect',
          rectRadius: 0.06,
          x,
          y,
          w: LARGURA_CARTAO,
          h,
          // Transparente é o padrão do fato constatado no modelo; só o fator
          // contribuinte recebe preenchimento.
          ...(preenchimento ? { fill: { color: preenchimento } } : {}),
          line: { color: CINZA_BORDA, width: 0.75, dashType: 'sysDot' },
          valign: 'middle',
          align: 'left',
          margin: 3,
          lineSpacingMultiple: 1.12,
          wrap: true,
        },
      );

      y += h + ESPACO_ENTRE_CARTOES;
    }
  }

  // --- Caixa do evento -----------------------------------------------------
  const campos: [string, string | null][] = [
    ['O que aconteceu?', evento.oQueAconteceu],
    ['Quem estava envolvido?', evento.quemEnvolvido],
    ['Onde aconteceu?', evento.ondeAconteceu],
    ['Quando aconteceu?', evento.quandoAconteceu],
    ['Consequência real:', evento.consequenciaReal],
    ['Consequência potencial:', evento.consequenciaPotencial],
  ];

  const corpoEvento = campos.flatMap(([rotulo, valor]) => [
    { text: `${rotulo}\n`, options: { bold: true, fontSize: 11, color: CINZA_EVENTO, fontFace: FONTE } },
    { text: `${valor ?? 'não informado'}\n`, options: { fontSize: 11, color: CINZA_EVENTO, fontFace: FONTE } },
  ]);

  slide.addText(corpoEvento, {
    x: EVENTO_X,
    y: EVENTO_Y,
    w: EVENTO_W,
    h: EVENTO_H,
    valign: 'top',
    margin: 5,
    wrap: true,
  });

  // --- Legenda -------------------------------------------------------------
  slide.addText('LEGENDA', {
    shape: 'roundRect',
    rectRadius: 0.04,
    x: 11.2913,
    y: 5.7487,
    w: 1.2485,
    h: 0.269,
    fontSize: 10,
    bold: true,
    color: '181818',
    fontFace: FONTE,
    align: 'center',
    valign: 'middle',
    line: { color: 'FFFFFF', width: 0.75 },
  });

  (['contribuinte', 'constatado'] as NivelIcam[]).forEach((nivel, i) => {
    const y = 6.1028 + i * 0.385;
    const cor = NIVEIS[nivel].cor;

    slide.addShape('roundRect', {
      x: 10.7574,
      y,
      w: 0.4152,
      h: 0.1667,
      rectRadius: 0.03,
      ...(cor ? { fill: { color: cor } } : {}),
      line: { color: CINZA_BORDA, width: 0.75, dashType: 'sysDot' },
    });

    slide.addText(NIVEIS[nivel].rotulo, {
      x: 11.3567,
      y: y - 0.08,
      w: 1.8626,
      h: 0.3213,
      fontSize: 10,
      bold: true,
      color: '181818',
      fontFace: FONTE,
      valign: 'middle',
    });
  });
}

/**
 * Plano de recomendações, na tabela de seis colunas do modelo.
 *
 * As larguras vêm do arquivo original, convertidas de EMU. A tabela quebra
 * sozinha entre slides quando passa da página: `autoPage` do pptxgenjs.
 */
function montarPlanoDeAcao(pptx: PptxGenJS, acoes: AcaoProposta[], avisos: string[]): void {
  const slide = pptx.addSlide();

  slide.addText('Plano de Recomendações', {
    x: 0.5632,
    y: 0.18,
    w: 6,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: '181818',
    fontFace: FONTE,
  });

  const semDono = acoes.filter((a) => !a.executante.trim()).length;
  if (semDono > 0) {
    avisos.push(
      `${semDono} ação(ões) foram para o slide sem executante. Ação sem dono e sem prazo não é plano — preencha antes de apresentar.`,
    );
  }

  const cabecalho = ['Causa Padrão', 'Descrição da Ação', 'Hierarquia de Controle', 'Executante', 'Matrícula', 'Prazo'];
  const linhas = acoes.map((a) => [
    a.causaPadrao,
    a.acao,
    a.hierarquia,
    a.executante || '—',
    a.matricula || '—',
    a.prazo || '—',
  ]);

  slide.addTable(
    [
      cabecalho.map((t) => ({
        text: t,
        options: { bold: true, color: 'FFFFFF', fill: { color: CINZA_EVENTO }, fontSize: 9, fontFace: FONTE },
      })),
      ...linhas.map((linha) =>
        linha.map((t) => ({ text: t, options: { fontSize: 8, color: CINZA_TEXTO, fontFace: FONTE } })),
      ),
    ],
    {
      x: 0.0119,
      y: 0.7962,
      w: 13.31,
      colW: [4.5, 3.6, 1.3, 1.4, 1.0, 1.51],
      border: { type: 'solid', color: 'D9D9D9', pt: 0.5 },
      valign: 'top',
      autoPage: true,
      autoPageRepeatHeader: true,
      autoPageSlideStartY: 0.7962,
    },
  );
}
