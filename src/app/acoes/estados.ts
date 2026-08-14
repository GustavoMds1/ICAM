import type { ResumoRascunho } from '@/servidor/rascunho';

/**
 * Tipos e estados iniciais dos formulários.
 *
 * Este arquivo existe por uma regra do Next.js que não perdoa: um módulo
 * marcado com `'use server'` só pode exportar funções assíncronas. Constante
 * exportada de lá não chega ao cliente — chega `undefined`, e o componente
 * quebra ao ler a primeira propriedade dela.
 *
 * O erro atravessa build, lint e teste unitário sem reclamar, e só aparece em
 * execução. Por isso os estados iniciais moram aqui, fora do `'use server'`, e
 * há um teste em `tests/limites-servidor.test.ts` que reprova qualquer export
 * não assíncrono nos arquivos de ação.
 */

export interface EstadoInvestigacao {
  erro: string | null;
  problemas?: string[];
}

export const INVESTIGACAO_INICIAL: EstadoInvestigacao = { erro: null };

export interface EstadoRascunho extends EstadoInvestigacao {
  resumo: ResumoRascunho | null;
  avisos: string[];
}

export const RASCUNHO_INICIAL: EstadoRascunho = { erro: null, resumo: null, avisos: [] };

export interface EstadoDecisao {
  erro: string | null;
  bloqueios?: string[];
  mensagem?: string | null;
}

export const DECISAO_INICIAL: EstadoDecisao = { erro: null, mensagem: null };
