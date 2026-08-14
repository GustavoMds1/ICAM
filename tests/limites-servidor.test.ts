import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda da fronteira servidor/cliente.
 *
 * O Next.js exige que um módulo `'use server'` exporte SOMENTE funções
 * assíncronas. Constante exportada de lá não vira valor no cliente: vira
 * `undefined`, e o componente quebra na primeira propriedade que ler.
 *
 * Esse erro passou por build, lint e 224 testes sem ser notado, e só apareceu
 * como "server-side exception" em produção. O teste abaixo é barato e fecha
 * essa porta: lê o código-fonte das ações e reprova qualquer export que não
 * seja `export async function` ou apenas tipo.
 */

const DIRETORIO_ACOES = join(process.cwd(), 'src', 'app', 'acoes');

function arquivosDeAcao(): string[] {
  return readdirSync(DIRETORIO_ACOES)
    .filter((nome) => nome.endsWith('.ts'))
    .map((nome) => join(DIRETORIO_ACOES, nome));
}

/** Exports de valor (não-tipo) declarados no arquivo. */
function exportsDeValor(codigo: string): { declaracao: string; assincrono: boolean }[] {
  const achados: { declaracao: string; assincrono: boolean }[] = [];
  const padrao = /^export\s+(?!type\b|interface\b)(.+)$/gm;

  for (const linha of codigo.matchAll(padrao)) {
    const declaracao = linha[1]?.trim() ?? '';
    // `export { X, type Y } from` e `export const` contam; `export async function` é o permitido.
    achados.push({
      declaracao,
      assincrono: declaracao.startsWith('async function'),
    });
  }
  return achados;
}

describe('fronteira dos módulos "use server"', () => {
  const arquivos = arquivosDeAcao();

  it('existe pelo menos um arquivo de ação para verificar', () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it.each(arquivos)('%s exporta apenas funções assíncronas quando é "use server"', (caminho) => {
    const codigo = readFileSync(caminho, 'utf8');
    const usaServidor = /^\s*['"]use server['"]/m.test(codigo);
    if (!usaServidor) return;

    const proibidos = exportsDeValor(codigo)
      .filter((e) => !e.assincrono)
      .map((e) => e.declaracao);

    expect(
      proibidos,
      `Em um arquivo "use server" só é permitido "export async function". ` +
        `Mova constantes e reexportações para um módulo comum, como src/app/acoes/estados.ts. ` +
        `Encontrado: ${proibidos.join(' | ')}`,
    ).toEqual([]);
  });

  it('os estados iniciais dos formulários ficam fora do "use server"', () => {
    const estados = readFileSync(join(DIRETORIO_ACOES, 'estados.ts'), 'utf8');
    expect(/^\s*['"]use server['"]/m.test(estados)).toBe(false);
    expect(estados).toContain('RASCUNHO_INICIAL');
    expect(estados).toContain('DECISAO_INICIAL');
    expect(estados).toContain('INVESTIGACAO_INICIAL');
  });
});
