import bruto from '../../../data/icam-taxonomy.pt-BR.json';
import {
  catalogoIcam,
  DISTRIBUICAO_ESPERADA,
  TOTAL_CODIGOS_ESPERADO,
  type CatalogoIcam,
  type CodigoCatalogo,
} from './esquema';
import { GRUPO_PARA_COLUNA, type ColunaIcam } from '../enumeracoes';

let cache: CatalogoIcam | null = null;

/** Carrega e valida o catálogo. Falha alto: catálogo inválido é erro de build. */
export function carregarCatalogo(): CatalogoIcam {
  if (cache) return cache;
  const resultado = catalogoIcam.safeParse(bruto);
  if (!resultado.success) {
    const detalhes = resultado.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Catálogo ICAM inválido:\n${detalhes.join('\n')}`);
  }
  cache = resultado.data;
  return cache;
}

export interface ConferenciaCatalogo {
  conforme: boolean;
  total: number;
  totalEsperado: number;
  porGrupo: { grupo: string; encontrado: number; esperado: number; conforme: boolean }[];
  duplicados: string[];
  semDefinicao: number;
  fontesPendentes: { arquivo: string; papel: string; status: string }[];
}

/**
 * Confere a integridade estrutural do catálogo (seção 17.2: "confirmação dos
 * 101 códigos por grupo") e reporta honestamente quantas definições ainda
 * dependem do DOCX de origem.
 */
export function conferirCatalogo(catalogo = carregarCatalogo()): ConferenciaCatalogo {
  const porGrupo = Object.entries(DISTRIBUICAO_ESPERADA).map(([grupo, esperado]) => {
    const encontrado = catalogo.codigos.filter((c) => c.grupo === grupo).length;
    return { grupo, encontrado, esperado, conforme: encontrado === esperado };
  });

  const vistos = new Map<string, number>();
  for (const c of catalogo.codigos) vistos.set(c.codigo, (vistos.get(c.codigo) ?? 0) + 1);
  const duplicados = [...vistos.entries()].filter(([, n]) => n > 1).map(([c]) => c);

  return {
    conforme:
      catalogo.codigos.length === TOTAL_CODIGOS_ESPERADO &&
      duplicados.length === 0 &&
      porGrupo.every((g) => g.conforme),
    total: catalogo.codigos.length,
    totalEsperado: TOTAL_CODIGOS_ESPERADO,
    porGrupo,
    duplicados,
    semDefinicao: catalogo.codigos.filter((c) => c.definicao === null).length,
    fontesPendentes: catalogo.fontesPendentes,
  };
}

export function listarCodigos(): CodigoCatalogo[] {
  return carregarCatalogo().codigos;
}

export function obterCodigo(codigo: string): CodigoCatalogo | undefined {
  return carregarCatalogo().codigos.find((c) => c.codigo === codigo.toUpperCase());
}

export function colunaDoCodigo(codigo: string): ColunaIcam | undefined {
  const c = obterCodigo(codigo);
  return c ? GRUPO_PARA_COLUNA[c.grupo] : undefined;
}

/** Códigos "Outro" — uso exige justificativa explícita (seção 12). */
export function ehCodigoGenerico(codigo: string): boolean {
  return obterCodigo(codigo)?.codigoGenerico === true;
}

/** Códigos que tocam dado sensível e exigem evidência robusta (seção 9). */
export function ehCodigoSensivel(codigo: string): boolean {
  return obterCodigo(codigo)?.dadoSensivel === true;
}

/**
 * Busca textual determinística sobre o catálogo. Retorna o código, o grupo e
 * o motivo do casamento — nunca decide sozinha a classificação.
 */
export interface AcertoBusca {
  codigo: CodigoCatalogo;
  pontuacao: number;
  termosCasados: string[];
}

export function buscarCodigos(consulta: string, limite = 20): AcertoBusca[] {
  const termos = normalizar(consulta)
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (termos.length === 0) return [];

  const acertos: AcertoBusca[] = [];
  for (const codigo of listarCodigos()) {
    const alvo = normalizar(
      [
        codigo.codigo,
        codigo.titulo,
        codigo.definicao ?? '',
        codigo.exemplos.join(' '),
        codigo.termosRelacionados.join(' '),
      ].join(' '),
    );
    const termosCasados = termos.filter((t) => alvo.includes(t));
    if (termosCasados.length === 0) continue;
    const pontuacaoTitulo = termos.filter((t) => normalizar(codigo.titulo).includes(t)).length * 2;
    acertos.push({
      codigo,
      pontuacao: termosCasados.length + pontuacaoTitulo,
      termosCasados,
    });
  }
  return acertos.sort((a, b) => b.pontuacao - a.pontuacao).slice(0, limite);
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
