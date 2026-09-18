import { CODIGOS, obterCodigo, type CodigoIcam, type ColunaIcam } from './codigos';
import { lexicoValido, type RegraLexico } from './lexicoIcam';
import { bigramas, contar, indicaAusencia, normalizar, radicais } from './texto';
import type { CategoriaPeepo } from './pptxLeitura';

/**
 * Identificação local do código ICAM — sem rede, sem chave, sem custo.
 *
 * A pontuação soma quatro evidências independentes, e cada uma aparece na
 * explicação da sugestão:
 *
 *   1. **similaridade TF-IDF** entre a constatação e o texto do código. O IDF
 *      é calculado sobre os 101 códigos, então palavra que aparece em metade
 *      do catálogo ("procedimento", "trabalho") quase não pontua;
 *   2. **expressões de duas palavras** em comum, que discriminam muito mais
 *      que palavras soltas;
 *   3. **léxico do domínio**, que cobre o caso em que a constatação não repete
 *      nenhuma palavra do título — "interjornada menor que a prevista" para
 *      "padrões de turno ruins e horas extras";
 *   4. **coluna esperada pela categoria PEEPO** do item, como desempate.
 *
 * A confiança não é enfeite: sai da distância entre o primeiro e o segundo
 * colocado somada à força do sinal. "Alta" exige vantagem folgada E pelo menos
 * um sinal forte — sem isso, o resultado é "média" ou "baixa" e a tela pede
 * conferência. Vale repetir: nada disso decide nada. A tela existe para a
 * pessoa discordar.
 */

export type Confianca = 'baixa' | 'media' | 'alta';

export interface Avaliacao {
  codigo: CodigoIcam;
  pontuacao: number;
  /** Motivos legíveis, na ordem em que pesaram. */
  sinais: string[];
  /**
   * Houve evidência específica — léxico do domínio ou expressão inteira em
   * comum — e não apenas palavras soltas coincidindo.
   *
   * É o que separa "este código descreve isto" de "estes dois textos usam
   * algumas palavras parecidas", e sem isso a confiança não chega a alta.
   */
  forte: boolean;
  /**
   * Quantos radicais distintos do texto aparecem no documento do código.
   *
   * Uma palavra em comum é coincidência; duas já são indício. Serve de piso
   * para a confiança média, porque só a pontuação não distingue "casou bem
   * com um termo raro" de "casou de raspão com um termo qualquer".
   */
  termosCasados: number;
}

export interface ResultadoLocal {
  melhor: CodigoIcam;
  confianca: Confianca;
  /** Vantagem do primeiro sobre o segundo, de 0 a 1. */
  margem: number;
  explicacao: string;
  alternativas: Avaliacao[];
  ranking: Avaliacao[];
}

/**
 * Limiares calibrados contra o gabarito em `dados/gabarito-icam.json`.
 *
 * Mexer aqui sem rodar `tests/localIcam.test.ts` é adivinhação: o teste mede
 * acerto em primeiro lugar, acerto entre os três primeiros e — o que mais
 * importa — se "confiança alta" só aparece quando o código está certo.
 *
 * Histórico da calibragem, para quem vier depois:
 *
 *   1ª medição, com LIMIAR_ALTA=3.2: 8/17 em primeiro lugar, mas a confiança
 *   alta acertou só 6 de 9. Uma única regra de léxico de peso médio já
 *   somava 3,6 e bastava para "alta" — barato demais para uma palavra que
 *   significa "pode aceitar". Os limiares subiram para exigir evidência
 *   somada: regra forte mais semelhança, ou duas regras.
 *
 *   3ª medição: confiança alta em 3/3, mas o acerto parado em 8/17. O
 *   diagnóstico mostrou derrotas por 1% a 7% do código certo. `PESO_LEXICO`
 *   subiu de 3 para 5, e estes limiares acompanharam na mesma proporção —
 *   senão uma regra sozinha voltaria a bastar para "alta".
 */
const LIMIAR_ALTA = 8.5;
const LIMIAR_MEDIA = 4.5;
const MARGEM_ALTA = 0.35;
const MARGEM_MEDIA = 0.15;

const PESO_TITULO = 3;
const PESO_DEFINICAO = 1;
const PESO_TERMOS = 2;
const PESO_BIGRAMA = 2.5;

/**
 * Quanto vale uma regra do léxico, multiplicada pelo peso da própria regra.
 *
 * Subiu de 3 para 5 depois da terceira medição, que mostrou o problema com
 * clareza: os oito acertos vinham TODOS do léxico, e três dos erros eram
 * derrotas por 1%, 5% e 7% — o código certo tinha a regra curada e perdia
 * para um código qualquer que só tinha palavras em comum.
 *
 * Uma regra do léxico é uma afirmação deliberada sobre o domínio, escrita e
 * revisável. Semelhança de palavras é coincidência estatística. Deixar a
 * segunda superar a primeira era a inversão que segurava o acerto em 47%.
 */
const PESO_LEXICO = 5;
const PESO_COLUNA_ESPERADA = 1.15;
const PENALIDADE_GENERICO = 0.35;

/** Coluna que a categoria PEEPO sugere. Desempate, nunca decisão. */
const COLUNA_POR_CATEGORIA: Record<CategoriaPeepo, ColunaIcam | null> = {
  pessoas: null,
  equipamento: null,
  ambiente: 'condicoes',
  procedimentos: 'defesas',
  organizacao: 'organizacionais',
};

interface DocumentoCodigo {
  codigo: CodigoIcam;
  /** Radical → peso acumulado no documento. */
  termos: Map<string, number>;
  bigramas: Set<string>;
  /** Radicais das regras de exclusão do código. */
  exclusoes: Set<string>;
}

interface Indice {
  documentos: DocumentoCodigo[];
  idf: Map<string, number>;
  lexico: RegraLexico[];
}

let indiceEmCache: Indice | null = null;

function construirIndice(): Indice {
  const documentos: DocumentoCodigo[] = CODIGOS.map((codigo) => {
    const termos = new Map<string, number>();

    for (const [texto, peso] of [
      [codigo.titulo, PESO_TITULO],
      [codigo.definicao, PESO_DEFINICAO],
      // Só existe depois de `scripts/enriquecer-catalogo.mjs`; ausente, o peso
      // simplesmente não entra.
      [codigo.termos ?? '', PESO_TERMOS],
    ] as [string, number][]) {
      for (const [radical, vezes] of contar(radicais(texto))) {
        termos.set(radical, (termos.get(radical) ?? 0) + vezes * peso);
      }
    }

    return {
      codigo,
      termos,
      bigramas: new Set([
        ...bigramas(codigo.titulo),
        ...bigramas(codigo.definicao),
        ...bigramas(codigo.termos ?? ''),
      ]),
      exclusoes: new Set(radicais(codigo.exclusoes ?? '')),
    };
  });

  // IDF clássico: termo presente em muitos códigos não ajuda a escolher entre eles.
  const ocorrencias = new Map<string, number>();
  for (const doc of documentos) {
    for (const termo of doc.termos.keys()) {
      ocorrencias.set(termo, (ocorrencias.get(termo) ?? 0) + 1);
    }
  }

  const total = documentos.length;
  const idf = new Map<string, number>();
  for (const [termo, vezes] of ocorrencias) {
    idf.set(termo, Math.log((total + 1) / (vezes + 0.5)));
  }

  return {
    documentos,
    idf,
    lexico: lexicoValido((codigo) => obterCodigo(codigo) !== null),
  };
}

function indice(): Indice {
  indiceEmCache ??= construirIndice();
  return indiceEmCache;
}

/** Só para teste: força a reconstrução após mexer no catálogo. */
export function limparIndice(): void {
  indiceEmCache = null;
}

export function identificarCodigo(texto: string, categoria?: CategoriaPeepo): ResultadoLocal {
  const { documentos, idf, lexico } = indice();
  const normalizado = normalizar(texto);
  const radicaisDoTexto = new Set(radicais(texto));
  const bigramasDoTexto = new Set(bigramas(texto));
  const ausencia = indicaAusencia(texto);
  const colunaEsperada = categoria ? COLUNA_POR_CATEGORIA[categoria] : null;

  // O léxico é avaliado uma vez, não por código.
  const acertosLexico = lexico.filter((r) => r.padrao.test(normalizado) || r.padrao.test(texto.toLowerCase()));

  const ranking: Avaliacao[] = documentos
    .map((doc) => {
      const sinais: string[] = [];
      let forte = false;

      // Pontuação por semelhança e pontuação por léxico são somadas no fim,
      // mas contadas separado: só a primeira sofre a penalidade de código
      // genérico. Quando o léxico aponta "sinalização vertical → TE24", ele
      // está dizendo que o código genérico é a resposta certa, e penalizar
      // isso apagaria justamente a evidência mais específica que existe.
      let base = 0;
      let lexico = 0;

      // 1. Similaridade TF-IDF.
      let similaridade = 0;
      let termosCasados = 0;
      for (const radicalDoTexto of radicaisDoTexto) {
        const peso = doc.termos.get(radicalDoTexto);
        if (!peso) continue;
        termosCasados += 1;
        similaridade += peso * (idf.get(radicalDoTexto) ?? 0);
      }
      // Raiz quadrada achata a vantagem de definição longa sobre título curto.
      similaridade = Math.sqrt(similaridade);
      if (similaridade > 0) {
        base += similaridade;
        sinais.push('termos em comum com o título ou a definição');
      }

      // 2. Expressões de duas palavras.
      let paresEmComum = 0;
      for (const par of bigramasDoTexto) if (doc.bigramas.has(par)) paresEmComum += 1;
      if (paresEmComum > 0) {
        base += paresEmComum * PESO_BIGRAMA;
        sinais.push(`${paresEmComum} expressão(ões) idêntica(s) no texto do código`);
        forte = true;
      }

      // 3. Léxico do domínio.
      for (const regra of acertosLexico) {
        if (regra.codigo !== doc.codigo.codigo) continue;
        lexico += PESO_LEXICO * (regra.peso ?? 1);
        sinais.unshift(regra.motivo);
        forte = true;
      }

      let fator = 1;

      // 4. Coluna esperada pela categoria PEEPO.
      if (colunaEsperada && doc.codigo.coluna === colunaEsperada && base + lexico > 0) {
        fator *= PESO_COLUNA_ESPERADA;
        sinais.push('coluna coerente com a categoria do item');
      }

      // Achado de ausência puxa para barreira que faltou.
      if (ausencia && doc.codigo.coluna === 'defesas' && base + lexico > 0) {
        fator *= 1.1;
        sinais.push('o achado descreve algo que faltou');
      }

      // Regra de exclusão do próprio código: o catálogo diz quando ele NÃO se
      // aplica, e essa informação vale tanto quanto a de quando se aplica.
      if (doc.exclusoes.size > 0 && base + lexico > 0) {
        let batidas = 0;
        for (const r of radicaisDoTexto) if (doc.exclusoes.has(r)) batidas += 1;
        if (batidas >= 2) {
          fator *= 0.6;
          sinais.push('o texto toca a regra de exclusão deste código');
        }
      }

      // "Outro fator" é último recurso quando a evidência é só semelhança.
      const pontuacao = fator * (lexico + base * (doc.codigo.generico ? PENALIDADE_GENERICO : 1));

      return { codigo: doc.codigo, pontuacao, sinais, forte, termosCasados };
    })
    .sort((a, b) => b.pontuacao - a.pontuacao);

  const primeiro = ranking[0]!;
  const segundo = ranking[1];
  const margem =
    primeiro.pontuacao > 0 && segundo
      ? (primeiro.pontuacao - segundo.pontuacao) / primeiro.pontuacao
      : 0;

  // Evidência mínima para sair de "baixa": ou um sinal específico, ou pelo
  // menos dois termos distintos em comum. Com um termo só, pontuação alta
  // significa apenas que a palavra era rara — não que o código descreve o
  // achado. Foi o que fazia "o céu estava azul e a banda tocou uma valsa"
  // receber confiança média.
  const temEvidencia = primeiro.forte || primeiro.termosCasados >= 2;

  let confianca: Confianca = 'baixa';
  if (primeiro.pontuacao >= LIMIAR_ALTA && margem >= MARGEM_ALTA && primeiro.forte) {
    confianca = 'alta';
  } else if (primeiro.pontuacao >= LIMIAR_MEDIA && margem >= MARGEM_MEDIA && temEvidencia) {
    confianca = 'media';
  }

  return {
    melhor: primeiro.codigo,
    confianca,
    margem,
    explicacao: montarExplicacao(primeiro, margem, confianca),
    alternativas: ranking.slice(1, 4).filter((a) => a.pontuacao > 0),
    ranking,
  };
}

function montarExplicacao(avaliacao: Avaliacao, margem: number, confianca: Confianca): string {
  if (avaliacao.pontuacao <= 0) {
    return 'Nenhum termo da constatação casou com o catálogo. Escolha o código à mão.';
  }

  const motivos = avaliacao.sinais.slice(0, 2).join('; ');
  const vantagem = `${Math.round(margem * 100)}% à frente do segundo colocado`;

  if (confianca === 'alta') {
    return `${motivos}. ${vantagem}. Confira o mecanismo antes de aceitar.`;
  }
  if (confianca === 'media') {
    return `${motivos}. ${vantagem} — vale comparar com as alternativas abaixo.`;
  }
  return `Sinal fraco: ${motivos}. Compare com as alternativas antes de decidir.`;
}
