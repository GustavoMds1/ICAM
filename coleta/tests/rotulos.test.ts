import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ErroGemini, ErroSemChave } from '@/lib/gemini';
import { avisosSemFornecedor, semFornecedor, TERMOS_PROIBIDOS } from '@/lib/rotulos';

/**
 * Na tela existe "IA assistida" e nada mais.
 *
 * A regra é fácil de cumprir uma vez e fácil de furar depois: basta alguém
 * acrescentar uma mensagem de erro citando o serviço, ou um rótulo novo na
 * interface. Por isso ela é teste, não combinado.
 *
 * A divisão é por extensão, e vale a pena saber dela:
 *
 *   - `.tsx` é tela, e não pode citar o fornecedor em lugar nenhum;
 *   - `.ts` é servidor, e pode — lá o nome ajuda quem administra.
 */

function fonte(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), 'utf8');
}

describe('o fornecedor de IA não aparece para quem usa', () => {
  it('a mensagem de chave ausente perde o nome do fornecedor', () => {
    const naTela = semFornecedor(new ErroSemChave().message);
    for (const proibido of TERMOS_PROIBIDOS) {
      expect(naTela, `sobrou "${proibido}" em: ${naTela}`).not.toMatch(proibido);
    }
  });

  it('a mensagem de falha da chamada perde o nome do fornecedor', () => {
    const erro = new ErroGemini(
      'modelo gemini-2.5-flash indisponível; consulte https://aistudio.google.com/apikey',
    );
    const naTela = semFornecedor(erro.message);
    for (const proibido of TERMOS_PROIBIDOS) {
      expect(naTela, `sobrou "${proibido}" em: ${naTela}`).not.toMatch(proibido);
    }
  });

  it('a mensagem limpa continua dizendo alguma coisa', () => {
    // Apagar tudo também esconderia o nome. O texto precisa sobreviver.
    const naTela = semFornecedor(new ErroGemini('sobrecarga momentânea').message);
    expect(naTela).toContain('sobrecarga');
    expect(naTela.length).toBeGreaterThan(20);
  });

  it('os avisos também passam pelo filtro', () => {
    const limpos = avisosSemFornecedor([
      'Usei o modelo gemini-2.5-flash; fixe em MODELO_IA se quiser manter.',
      'Aviso sem nenhum nome de fornecedor.',
    ]);
    expect(limpos).toHaveLength(2);
    for (const aviso of limpos) {
      for (const proibido of TERMOS_PROIBIDOS) expect(aviso).not.toMatch(proibido);
    }
  });

  it('avisos ausentes viram lista vazia, não quebra', () => {
    expect(avisosSemFornecedor(undefined)).toEqual([]);
  });

  it('nenhum arquivo de tela cita o fornecedor', () => {
    for (const arquivo of ['src/app/page.tsx', 'src/app/layout.tsx']) {
      const texto = fonte(arquivo);
      for (const proibido of TERMOS_PROIBIDOS) {
        expect(texto, `${arquivo} cita ${proibido}`).not.toMatch(proibido);
      }
    }
  });

  it('o que o navegador envia tem nome neutro', () => {
    // O corpo da requisição aparece nas ferramentas do navegador. Se o campo
    // se chamasse "usarGemini", o nome estaria na tela por outra porta.
    const tela = fonte('src/app/page.tsx');
    expect(tela).toContain('usarIa');

    for (const rota of ['src/app/api/classificar/route.ts', 'src/app/api/acoes/route.ts']) {
      expect(fonte(rota), `${rota} precisa aceitar o campo neutro`).toContain('usarIa');
    }
  });
});

describe('a rota de estado não vaza a chave', () => {
  it('devolve se existe chave, nunca qual é', () => {
    const rota = fonte('src/app/api/estado/route.ts');

    // O valor da variável só pode ser comparado, nunca colocado na resposta.
    expect(rota).toContain('iaDisponivel');
    expect(rota).not.toMatch(/json\([^)]*process\.env\.GEMINI_API_KEY/s);
  });
});
