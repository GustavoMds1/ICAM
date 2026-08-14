import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda da publicação.
 *
 * O primeiro deploy deste aplicativo falhou por um motivo bobo e caro: o
 * `package-lock.json` tinha sido gerado só no ambiente de teste e nunca
 * entrou no repositório. O Render roda `npm ci`, que exige o arquivo, e o
 * build morreu antes da primeira linha de código.
 *
 * Nenhum teste de unidade pegaria isso, porque o problema não está no código —
 * está no que foi enviado. Estes três testes olham para o que vai publicar.
 */

const RAIZ = process.cwd();

interface Pacote {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(join(RAIZ, caminho), 'utf8')) as T;
}

describe('o que o Render precisa encontrar no repositório', () => {
  it('o package-lock.json existe — sem ele "npm ci" nem começa', () => {
    expect(
      existsSync(join(RAIZ, 'package-lock.json')),
      'Rode "npm install" nesta pasta e faça commit do package-lock.json.',
    ).toBe(true);
  });

  it('o lockfile cobre todas as dependências declaradas', () => {
    const pacote = lerJson<Pacote>('package.json');
    const trava = lerJson<{ packages?: Record<string, unknown> }>('package-lock.json');
    const instalados = new Set(
      Object.keys(trava.packages ?? {})
        .filter((c) => c.startsWith('node_modules/'))
        .map((c) => c.replace(/^node_modules\//, '')),
    );

    const declarados = [
      ...Object.keys(pacote.dependencies ?? {}),
      ...Object.keys(pacote.devDependencies ?? {}),
    ];
    const faltando = declarados.filter((d) => !instalados.has(d));

    expect(faltando, `Dependências fora do lockfile: ${faltando.join(', ')}. Rode "npm install".`).toEqual(
      [],
    );
  });

  /**
   * O segundo deploy falhou aqui: o lockfile existia, mas tinha sido gerado
   * com `npm install --package-lock-only`, que resolve só as dependências
   * opcionais da plataforma de quem gerou. O npm do servidor cobra as outras
   * ("Missing: @img/sharp-darwin-arm64 from lock file") e recusa o `npm ci`.
   *
   * Um lockfile completo traz as variantes de todos os sistemas, marcadas com
   * o campo `os`. Poucas dessas entradas significa lockfile podado.
   */
  it('o lockfile foi gerado completo, com as variantes de todos os sistemas', () => {
    const trava = lerJson<{ packages?: Record<string, { os?: string[] }> }>('package-lock.json');
    const pacotes = Object.entries(trava.packages ?? {});
    const comRestricaoDeSo = pacotes.filter(([, v]) => Array.isArray(v?.os));

    expect(
      comRestricaoDeSo.length,
      'O lockfile parece podado. Apague-o, rode "npm install" (sem --package-lock-only) e faça commit do arquivo novo.',
    ).toBeGreaterThan(50);

    for (const sistema of ['darwin', 'win32']) {
      expect(
        comRestricaoDeSo.some(([, v]) => v.os?.includes(sistema)),
        `Nenhum pacote para "${sistema}" no lockfile: ele foi gerado só para a plataforma de quem rodou.`,
      ).toBe(true);
    }
  });

  it('os comandos que o render.yaml chama existem', () => {
    const pacote = lerJson<Pacote>('package.json');
    for (const comando of ['build', 'start']) {
      expect(pacote.scripts?.[comando], `Falta o script "${comando}" no package.json.`).toBeTruthy();
    }
  });

  it('o catálogo de códigos vai junto, e completo', () => {
    const catalogo = lerJson<{ codigos: unknown[] }>('dados/codigos-icam.json');
    expect(catalogo.codigos).toHaveLength(101);
  });
});
