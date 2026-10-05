import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Protege a versão de arquivo único.
 *
 * Ela funciona porque `navegador/rotasLocais.ts` atende, dentro do navegador,
 * as mesmas rotas que a tela chama. O risco é conhecido: alguém acrescenta uma
 * rota nova na tela, o servidor continua funcionando, e a versão local passa a
 * falhar — no meio de uma investigação, que é o pior momento possível.
 *
 * Isto não roda o empacotamento (não dá para abrir um navegador aqui). Verifica
 * a única coisa que quebra em silêncio: a correspondência entre o que a tela
 * pede e o que a versão local sabe responder.
 */

function fonte(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), 'utf8');
}

describe('versão de arquivo único', () => {
  const tela = fonte('src/app/page.tsx');
  const local = fonte('navegador/rotasLocais.ts');

  const rotasChamadas = [...tela.matchAll(/fetch\('(\/api\/[a-z]+)'/g)].map((m) => m[1]!);

  it('a varredura encontrou as rotas da tela', () => {
    // Sem esta guarda, uma mudança no formato da chamada faria a regra abaixo
    // passar sem verificar nada — teste vazio que parece teste.
    expect(rotasChamadas.length).toBeGreaterThanOrEqual(4);
  });

  it('toda rota que a tela chama é atendida na versão local', () => {
    const semAtendimento = [...new Set(rotasChamadas)].filter((r) => !local.includes(r));
    expect(
      semAtendimento,
      `A versão de navegador não atende: ${semAtendimento.join(', ')}. ` +
        'Acrescente o tratamento em navegador/rotasLocais.ts.',
    ).toEqual([]);
  });

  it('a versão local não promete IA externa', () => {
    // Chave dentro de arquivo que roda na máquina de quem usa é chave
    // publicada. A tela precisa receber "indisponível" e desabilitar o botão.
    expect(local).toContain('iaDisponivel: false');
    expect(local).toContain('usarGemini: false');
  });

  it('o gerador de slide funciona nos dois ambientes', () => {
    const escrita = fonte('src/lib/pptxEscrita.ts');
    // `nodebuffer` sozinho quebraria no navegador na última etapa da geração.
    expect(escrita).toContain('arraybuffer');
    expect(escrita).toContain('Uint8Array');
  });

  /**
   * O `zod` está preso numa versão exata porque as 3.25.x reorganizaram o
   * pacote em subpastas que o empacotador não consegue seguir — e a falha
   * aparece só na geração do arquivo único, não no servidor nem nos testes.
   *
   * Quem trocar por `^` vai quebrar a versão de navegador sem perceber, então
   * a trava fica aqui, com o motivo junto.
   */
  it('o zod continua preso numa versão exata', () => {
    const pacote = JSON.parse(fonte('package.json')) as {
      dependencies: Record<string, string>;
    };
    const versao = pacote.dependencies.zod ?? '';
    expect(
      versao,
      'zod precisa de versão exata (sem ^ ou ~): as 3.25.x quebram o empacotamento do navegador.',
    ).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('o modelo tem os dois pontos de injeção e a raiz da tela', () => {
    const modelo = fonte('navegador/modelo.html');
    expect(modelo).toContain('/*ESTILOS*/');
    expect(modelo).toContain('/*PROGRAMA*/');
    expect(modelo).toContain('id="raiz"');
  });
});
