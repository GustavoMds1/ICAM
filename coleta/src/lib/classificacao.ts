import { z } from 'zod';
import {
  catalogoParaPrompt,
  NIVEIS_VALIDOS,
  normalizarCodigo,
  obterCodigo,
  type CodigoIcam,
  type NivelIcam,
} from './codigos';
import { extrairJson, gerarJson, obterChave } from './gemini';
import { identificarCodigo } from './localIcam';
import type { ItemColetado } from './pptxLeitura';

/**
 * Associação de códigos ICAM às constatações.
 *
 * O caminho padrão é a **identificação local** (`localIcam.ts`): comparação
 * contra os 101 códigos dentro do próprio servidor, sem rede, sem chave e sem
 * custo por uso. Nenhum conteúdo de investigação sai daqui.
 *
 * A integração com o Gemini continua inteira, em espera, e volta com
 * `USAR_GEMINI=true` no ambiente.
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
  /** Força o Gemini mesmo com ele em espera. */
  usarGemini?: boolean;
}

/**
 * O Gemini está em espera.
 *
 * O caminho padrão é a identificação local. O código do Gemini continua
 * inteiro e volta ligando `USAR_GEMINI=true` no ambiente — nada foi apagado,
 * só desligado.
 */
export function geminiLigado(opcoes: { usarGemini?: boolean } = {}): boolean {
  if (opcoes.usarGemini !== undefined) return opcoes.usarGemini;
  return process.env.USAR_GEMINI === 'true';
}

export async function classificar(
  itens: ItemColetado[],
  opcoes: OpcoesClassificacao = {},
): Promise<ResultadoClassificacao> {
  const alvos = itens.filter((i) => i.tipo === 'constatacao');
  if (alvos.length === 0) {
    return { sugestoes: [], origem: 'local', modelo: null, avisos: ['Nenhuma constatação para classificar.'] };
  }

  if (!geminiLigado(opcoes)) {
    const sugestoes = alvos.map(classificarLocalmente);
    const altas = sugestoes.filter((s) => s.confianca === 'alta').length;
    return {
      sugestoes,
      origem: 'local',
      modelo: 'identificação local',
      avisos:
        altas === sugestoes.length
          ? []
          : [
              `${sugestoes.length - altas} de ${sugestoes.length} constatações ficaram sem confiança alta. Compare com as alternativas de cada uma antes de aceitar.`,
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
// Identificação local — o caminho padrão enquanto o Gemini está em espera
// ---------------------------------------------------------------------------

/**
 * Compara a constatação com os 101 códigos e devolve o melhor, com a
 * confiança que o método consegue sustentar.
 *
 * O trabalho pesado está em `localIcam.ts`; aqui só se traduz o resultado para
 * o contrato da tela.
 */
export function classificarLocalmente(item: ItemColetado): Sugestao {
  const categoria = item.categoria === 'nao_classificado' ? undefined : item.categoria;
  const r = identificarCodigo(item.texto, categoria);

  return {
    itemId: item.id,
    codigo: r.melhor.codigo,
    titulo: r.melhor.titulo,
    // Fator contribuinte é juízo causal e sai da análise humana, não daqui.
    nivel: 'constatado',
    // A caixa nasce marcada na tela; quem tira é a pessoa.
    exigeAcao: true,
    justificativa: r.explicacao,
    confianca: r.confianca,
    alternativas: r.alternativas.map((a) => ({ codigo: a.codigo.codigo, titulo: a.codigo.titulo })),
    origem: 'local',
  };
}

export { extrairJson, normalizarCodigo };
