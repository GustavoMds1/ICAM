import catalogo from '../../dados/codigos-icam.json';

/**
 * Catálogo ICAM e o mapa para as colunas do slide 13.
 *
 * Os 101 códigos vêm do documento de origem da metodologia, derivados do
 * catálogo do aplicativo de investigação. Nenhum código é inventado aqui: se a
 * IA devolver um código fora desta lista, a sugestão é descartada.
 */

export type ColunaIcam = 'organizacionais' | 'condicoes' | 'acoes' | 'defesas';

export interface CodigoIcam {
  codigo: string;
  titulo: string;
  grupo: string;
  coluna: ColunaIcam;
  generico: boolean;
  definicao: string;
}

export const CODIGOS = (catalogo as { codigos: CodigoIcam[] }).codigos;

export const ROTULOS_COLUNA: Record<ColunaIcam, string> = {
  organizacionais: 'Fatores Organizacionais',
  condicoes: 'Atividade e Condições Ambientais',
  acoes: 'Ações Individuais e de Equipe',
  defesas: 'Defesas Ausentes ou Falhas',
};

/** Ordem das colunas no slide, da esquerda para a direita. */
export const ORDEM_COLUNAS: ColunaIcam[] = ['organizacionais', 'condicoes', 'acoes', 'defesas'];

/**
 * Níveis atribuídos nesta etapa, com o preenchimento medido no slide original.
 *
 * São só dois. **Causa raiz não se define aqui**: ela sai da análise causal,
 * depois, com a equipe reunida. Oferecer o rótulo neste ponto convidaria a
 * eleger causa raiz durante a digitação da coleta, que é exatamente como se
 * fecha investigação no primeiro suspeito.
 *
 * No modelo, fator contribuinte é preenchimento amarelo sólido e fato
 * constatado é cartão transparente — só a borda pontilhada.
 */
export const NIVEIS = {
  constatado: { rotulo: 'Fatos Constatados', cor: null, textoEscuro: true },
  contribuinte: { rotulo: 'Fatores contribuintes', cor: 'FFFF00', textoEscuro: true },
} as const;

export type NivelIcam = keyof typeof NIVEIS;
export const NIVEIS_VALIDOS = Object.keys(NIVEIS) as NivelIcam[];

/**
 * Hierarquia de controle, na ordem de força. É a coluna "Hierarquia de
 * Controle" do plano de recomendações do modelo.
 */
export const HIERARQUIAS = [
  'Eliminação',
  'Substituição',
  'Engenharia',
  'Administrativo',
  'EPI',
] as const;
export type Hierarquia = (typeof HIERARQUIAS)[number];

const PORCODIGO = new Map(CODIGOS.map((c) => [normalizarCodigo(c.codigo), c]));

/** Aceita "HF 21", "hf21" e "HF-21" como o mesmo código. */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function obterCodigo(codigo: string): CodigoIcam | null {
  return PORCODIGO.get(normalizarCodigo(codigo)) ?? null;
}

/** Lista compacta enviada ao modelo: só o que ele precisa para escolher. */
export function catalogoParaPrompt(): string {
  return CODIGOS.map((c) => `${c.codigo}|${c.coluna}|${c.titulo}`).join('\n');
}

/** Rótulo do cartão no slide: "HF21 – Padrões de turno ruins e horas extras". */
export function rotuloCartao(codigo: CodigoIcam): string {
  return `${codigo.codigo} – ${codigo.titulo}`;
}
