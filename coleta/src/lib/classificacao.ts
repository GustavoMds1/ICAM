import { z } from 'zod';
import {
  catalogoParaPrompt,
  CODIGOS,
  NIVEIS_VALIDOS,
  normalizarCodigo,
  obterCodigo,
  type CodigoIcam,
  type NivelIcam,
} from './codigos';
import { extrairJson, gerarJson, obterChave } from './gemini';
import type { ItemColetado } from './pptxLeitura';

/**
 * Associação de códigos ICAM às constatações, pela API do Gemini.
 *
 * O modo local por casamento de palavras continua no arquivo, mas só roda
 * quando pedido explicitamente (`permitirLocal`). Ele não é alternativa à IA:
 * é saída de emergência, e a interface diz isso.
 *
 * Nível e ação são sempre proposta. Nada vai para o slide sem revisão.
 */

export interface Sugestao {
  itemId: string;
  codigo: string;
  titulo: string;
  nivel: NivelIcam;
  /**
   * Opinião da IA sobre a necessidade de ação.
   *
   * Não é o que marca a caixa na tela — lá a caixa nasce marcada, e quem
   * decide tirar é a pessoa. Este campo serve para a interface avisar quando a
   * IA achou que não havia nada a corrigir.
   */
  exigeAcao: boolean;
  justificativa: string;
  confianca: 'baixa' | 'media' | 'alta';
  /** Códigos próximos que o classificador considerou e descartou. */
  alternativas: { codigo: string; titulo: string }[];
  origem: 'gemini' | 'local';
}

export interface ResultadoClassificacao {
  sugestoes: Sugestao[];
  origem: 'gemini' | 'local';
  modelo: string | null;
  avisos: string[];
}

const respostaGemini = z.object({
  classificacoes: z.array(
    z.object({
      id: z.string(),
      codigo: z.string(),
      nivel: z.string(),
      exigeAcao: z.boolean().default(true),
      justificativa: z.string().default(''),
      confianca: z.string().default('media'),
      alternativas: z.array(z.string()).default([]),
    }),
  ),
});

const INSTRUCAO = [
  'Você associa códigos da metodologia ICAM a constatações de uma investigação de incidente.',
  '',
  'REGRAS INEGOCIÁVEIS:',
  '1. Escolha SOMENTE códigos da lista fornecida. Não invente código, título nem sigla.',
  '2. Semelhança de palavras não classifica. O código escolhido precisa descrever o',
  '   mecanismo pelo qual aquilo contribuiu para o evento.',
  '3. Não atribua culpa a pessoa. Não infira fadiga, uso de substância, condição de saúde',
  '   ou problema pessoal a partir de comportamento, linguagem ou aparência.',
  '4. Nível: use "contribuinte" para o que aumentou a chance de o evento ocorrer ou a',
  '   sua gravidade; "constatado" para fato verificado sem juízo causal. Na dúvida,',
  '   use "constatado". NÃO existe nível de causa raiz nesta etapa: ela é decidida',
  '   depois, na análise causal com a equipe.',
  '5. exigeAcao: verdadeiro quando o achado pede ação corretiva ou preventiva de',
  '   alguém. Fator contribuinte quase sempre exige. Use falso apenas quando o achado',
  '   descreve algo conforme, sem nada a corrigir.',
  '6. Se nenhum código descrever bem a constatação, use o código genérico "Outro fator" do',
  '   grupo mais próximo e explique na justificativa.',
  '7. Responda SOMENTE com JSON válido, sem texto antes ou depois e sem cercas de código.',
].join('\n');

const FORMATO = `{
  "classificacoes": [
    {
      "id": "<id do item, exatamente como recebido>",
      "codigo": "<código do catálogo, ex.: HF21>",
      "nivel": "contribuinte | constatado",
      "exigeAcao": true,
      "justificativa": "<uma frase ligando a constatação ao código>",
      "confianca": "baixa | media | alta",
      "alternativas": ["<código descartado>", "<outro>"]
    }
  ]
}`;

export interface OpcoesClassificacao {
  chaveApi?: string;
  modelo?: string;
  /** Contexto do evento, para o modelo não classificar frases soltas. */
  contexto?: string;
  tempoLimiteMs?: number;
  /** Autoriza a associação local. Só quando a pessoa pedir, sabendo o que é. */
  permitirLocal?: boolean;
}

export async function classificar(
  itens: ItemColetado[],
  opcoes: OpcoesClassificacao = {},
): Promise<ResultadoClassificacao> {
  const alvos = itens.filter((i) => i.tipo === 'constatacao');
  if (alvos.length === 0) {
    return { sugestoes: [], origem: 'local', modelo: null, avisos: ['Nenhuma constatação para classificar.'] };
  }

  if (opcoes.permitirLocal && !(opcoes.chaveApi ?? process.env.GEMINI_API_KEY)) {
    return {
      sugestoes: alvos.map(classificarLocalmente),
      origem: 'local',
      modelo: null,
      avisos: [
        'Modo local, a pedido: a associação veio de semelhança de palavras, não de análise. Confira cada código antes de usar.',
      ],
    };
  }

  // Sem chave, lança. Quem chama transforma em mensagem com o que fazer.
  const chave = obterChave(opcoes.chaveApi);

  const tarefa = [
    opcoes.contexto ? `CONTEXTO DO EVENTO:\n${opcoes.contexto}\n` : '',
    'CATÁLOGO (codigo|coluna|título):',
    catalogoParaPrompt(),
    '',
    'CONSTATAÇÕES A CLASSIFICAR:',
    ...alvos.map((i) => `${i.id} [${i.categoria}] ${i.texto}`),
  ].join('\n');

  const resposta = await gerarJson({
    chaveApi: chave,
    instrucao: INSTRUCAO,
    formato: FORMATO,
    tarefa,
    modelo: opcoes.modelo,
    tempoLimiteMs: opcoes.tempoLimiteMs,
  });

  const analise = respostaGemini.safeParse(extrairJson(resposta.texto));
  if (!analise.success) {
    throw new Error('O Gemini respondeu fora do formato combinado. Tente de novo.');
  }

  const avisos = [...resposta.avisos];
  const sugestoes: Sugestao[] = [];
  const porId = new Map(alvos.map((i) => [i.id, i]));

  for (const c of analise.data.classificacoes) {
    const item = porId.get(c.id);
    if (!item) continue;

    const codigo = obterCodigo(c.codigo);
    if (!codigo) {
      // Código fora do catálogo é descarte, não aproximação: inventar sigla é
      // exatamente o erro que a metodologia não tolera.
      avisos.push(`O código "${c.codigo}" não existe no catálogo e foi descartado (item ${item.id}).`);
      sugestoes.push(classificarLocalmente(item));
      continue;
    }

    const nivel = normalizarNivel(c.nivel);
    sugestoes.push({
      itemId: item.id,
      codigo: codigo.codigo,
      titulo: codigo.titulo,
      nivel,
      // Fator contribuinte sem ação é contradição: se contribuiu, há o que tratar.
      exigeAcao: c.exigeAcao || nivel === 'contribuinte',
      justificativa: c.justificativa.trim(),
      confianca: normalizarConfianca(c.confianca),
      alternativas: c.alternativas
        .map((a) => obterCodigo(a))
        .filter((a): a is CodigoIcam => a !== null)
        .slice(0, 3)
        .map((a) => ({ codigo: a.codigo, titulo: a.titulo })),
      origem: 'gemini',
    });
  }

  // Item que o modelo ignorou não pode sumir da revisão.
  for (const item of alvos) {
    if (!sugestoes.some((s) => s.itemId === item.id)) {
      sugestoes.push(classificarLocalmente(item));
      avisos.push(`O modelo não classificou o item ${item.id}; foi usada a associação local.`);
    }
  }

  return { sugestoes, origem: 'gemini', modelo: resposta.modelo, avisos };
}

function normalizarNivel(valor: string): NivelIcam {
  const n = valor.toLowerCase().trim();
  const achado = NIVEIS_VALIDOS.find((x) => n.startsWith(x));
  return achado ?? 'constatado';
}

function normalizarConfianca(valor: string): 'baixa' | 'media' | 'alta' {
  const n = valor.toLowerCase().trim();
  return n === 'alta' || n === 'baixa' ? n : 'media';
}

// ---------------------------------------------------------------------------
// Associação local — saída de emergência, não alternativa
// ---------------------------------------------------------------------------

const IRRELEVANTES = new Set([
  'para','com','que','dos','das','uma','não','nao','por','como','este','esta','isso','pelo','pela',
  'foi','ser','são','sao','tem','tinha','está','esta','sobre','entre','após','apos','durante','onde',
  'quando','mais','menos','muito','pouco','todo','toda','cada','seus','suas','nos','nas','ele','ela',
  'the','and','of','no','na','do','da','de','em','um','os','as','ao','à','se','ou','é','e',
]);

function palavras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 3 && !IRRELEVANTES.has(p));
}

export function classificarLocalmente(item: ItemColetado): Sugestao {
  const alvo = new Set(palavras(item.texto));
  const notas = CODIGOS.map((c) => {
    const doTitulo = palavras(c.titulo).filter((p) => alvo.has(p)).length * 3;
    const daDefinicao = palavras(c.definicao).filter((p) => alvo.has(p)).length;
    return { codigo: c, nota: doTitulo + daDefinicao };
  })
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota);

  const melhor = notas[0]?.codigo ?? genericoDaCategoria(item);

  return {
    itemId: item.id,
    codigo: melhor.codigo,
    titulo: melhor.titulo,
    nivel: 'constatado',
    // A caixa nasce marcada na tela; quem tira é a pessoa.
    exigeAcao: true,
    justificativa:
      notas.length > 0
        ? 'Associação local por termos em comum com o título e a definição do código. Confira o mecanismo antes de aceitar.'
        : 'Nenhum código teve termo em comum com a constatação. Escolha o código à mão.',
    confianca: 'baixa',
    alternativas: notas.slice(1, 4).map((x) => ({ codigo: x.codigo.codigo, titulo: x.codigo.titulo })),
    origem: 'local',
  };
}

/** Código genérico da coluna correspondente à categoria PEEPO do item. */
function genericoDaCategoria(item: ItemColetado): CodigoIcam {
  const preferida =
    item.categoria === 'procedimentos'
      ? 'defesas'
      : item.categoria === 'organizacao'
        ? 'organizacionais'
        : 'condicoes';

  return (
    CODIGOS.find((c) => c.generico && c.coluna === preferida) ??
    CODIGOS.find((c) => c.generico) ??
    CODIGOS[0]!
  );
}

export { extrairJson, normalizarCodigo };
