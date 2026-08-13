/**
 * Pseudonimização e redação (seção 9).
 *
 * Regra padrão: relatórios executivos usam função ou identificador
 * pseudonimizado, nunca nome e matrícula. A exibição de dado identificável é
 * uma exceção autorizada e auditada, não o comportamento normal.
 */

export interface Identificavel {
  pseudonimo: string;
  funcao?: string | null;
  nome?: string | null;
  matricula?: string | null;
}

export type ModoExibicao = 'pseudonimizado' | 'identificado';

export function exibirEnvolvido(pessoa: Identificavel, modo: ModoExibicao): string {
  if (modo === 'identificado' && pessoa.nome) {
    return pessoa.matricula ? `${pessoa.nome} (${pessoa.matricula})` : pessoa.nome;
  }
  return pessoa.funcao ? `${pessoa.pseudonimo} — ${pessoa.funcao}` : pessoa.pseudonimo;
}

/** Padrões de dado pessoal que não devem vazar para texto livre de relatório. */
const PADROES_PII: { nome: string; expressao: RegExp; substituto: string }[] = [
  { nome: 'cpf', expressao: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, substituto: '[CPF REMOVIDO]' },
  { nome: 'cnpj', expressao: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, substituto: '[CNPJ REMOVIDO]' },
  { nome: 'email', expressao: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, substituto: '[E-MAIL REMOVIDO]' },
  {
    nome: 'telefone',
    expressao: /\b(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g,
    substituto: '[TELEFONE REMOVIDO]',
  },
  { nome: 'matricula', expressao: /\bmatr[ií]cula\s*:?\s*[\w-]{3,}/gi, substituto: 'matrícula [REMOVIDA]' },
];

export interface ResultadoRedacao {
  texto: string;
  ocorrencias: { padrao: string; quantidade: number }[];
  houveRedacao: boolean;
}

export function redigirPII(texto: string): ResultadoRedacao {
  let resultado = texto;
  const ocorrencias: { padrao: string; quantidade: number }[] = [];

  for (const p of PADROES_PII) {
    const achados = texto.match(p.expressao);
    if (achados && achados.length > 0) {
      ocorrencias.push({ padrao: p.nome, quantidade: achados.length });
      resultado = resultado.replace(p.expressao, p.substituto);
    }
  }

  return { texto: resultado, ocorrencias, houveRedacao: ocorrencias.length > 0 };
}

/**
 * Substitui nomes conhecidos pelo pseudônimo correspondente. Usado ao gerar o
 * relatório executivo a partir de textos redigidos durante a investigação.
 */
export function pseudonimizarTexto(texto: string, pessoas: readonly Identificavel[]): string {
  let resultado = texto;
  for (const p of pessoas) {
    if (p.nome && p.nome.trim().length >= 3) {
      resultado = resultado.replace(
        new RegExp(escaparRegex(p.nome), 'gi'),
        p.pseudonimo,
      );
    }
    if (p.matricula && p.matricula.trim().length >= 3) {
      resultado = resultado.replace(new RegExp(escaparRegex(p.matricula), 'g'), p.pseudonimo);
    }
  }
  return resultado;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Campos que exigem proteção reforçada. Usado pelo ABAC e pelo verificador
 * SENSIVEL_SEM_EVIDENCIA_ROBUSTA.
 */
export const CATEGORIAS_DADO_SENSIVEL = [
  'saude',
  'uso_alcool_drogas',
  'fator_psicologico',
  'problema_pessoal',
  'biometria',
  'filiacao_sindical',
  'processo_disciplinar',
] as const;
export type CategoriaDadoSensivel = (typeof CATEGORIAS_DADO_SENSIVEL)[number];

export const ROTULOS_DADO_SENSIVEL: Record<CategoriaDadoSensivel, string> = {
  saude: 'Dados de saúde',
  uso_alcool_drogas: 'Uso de álcool ou drogas',
  fator_psicologico: 'Fatores psicológicos',
  problema_pessoal: 'Problemas pessoais',
  biometria: 'Dados biométricos',
  filiacao_sindical: 'Filiação sindical',
  processo_disciplinar: 'Processo disciplinar',
};
