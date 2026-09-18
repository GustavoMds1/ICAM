import { describe, expect, it } from 'vitest';
import { classificar, classificarLocalmente, extrairJson } from '@/lib/classificacao';
import { proporAcoes } from '@/lib/acoes';
import { CODIGOS, NIVEIS, obterCodigo, ORDEM_COLUNAS, normalizarCodigo } from '@/lib/codigos';
import { gerarSlide } from '@/lib/pptxEscrita';
import type { ItemColetado } from '@/lib/pptxLeitura';

const EVENTO = {
  oQueAconteceu: 'Colisão traseira durante ultrapassagem',
  quemEnvolvido: 'Operador de caminhão',
  ondeAconteceu: 'Rodovia de acesso',
  quandoAconteceu: '15/03/26',
  consequenciaReal: 'Leve',
  consequenciaPotencial: 'Crítica',
};

function item(id: string, texto: string, tipo: ItemColetado['tipo'] = 'constatacao'): ItemColetado {
  return { id, categoria: 'pessoas', tipo, texto, responsavel: null, slide: 9 };
}

describe('catálogo', () => {
  it('tem os 101 códigos e todos caem em uma coluna do slide', () => {
    expect(CODIGOS).toHaveLength(101);
    for (const c of CODIGOS) expect(ORDEM_COLUNAS).toContain(c.coluna);
  });

  it('reconhece o código escrito de várias formas', () => {
    expect(normalizarCodigo('HF 21')).toBe('HF21');
    expect(obterCodigo('hf-21')?.codigo).toBe('HF21');
    expect(obterCodigo('XX99')).toBeNull();
  });

  it('só existem os dois níveis desta etapa, com as cores do modelo', () => {
    // Causa raiz sai da análise causal, depois. Oferecer aqui convidaria a
    // eleger causa raiz durante a digitação da coleta.
    expect(Object.keys(NIVEIS).sort()).toEqual(['constatado', 'contribuinte']);
    expect(NIVEIS.contribuinte.cor).toBe('FFFF00');
    // Fato constatado é cartão transparente no original, não branco pintado.
    expect(NIVEIS.constatado.cor).toBeNull();
  });
});

describe('Gemini em espera', () => {
  it('o caminho padrão é a identificação local, sem exigir chave', async () => {
    const r = await classificar([
      item('a', 'O trecho não dispõe de sinalização vertical regulamentadora'),
      item('b', 'Telemetria do veículo', 'evidencia'),
    ]);

    expect(r.sugestoes.map((s) => s.itemId)).toEqual(['a']);
    expect(r.origem).toBe('local');
  });

  it('o plano de ação também sai sem chave', async () => {
    const r = await proporAcoes([{ itemId: 'a', codigo: 'HF21', titulo: 'x', constatacao: 'y' }]);
    expect(r.origem).toBe('local');
    expect(r.acoes).toHaveLength(1);
  });

  it('o Gemini volta pela variável de ambiente, sem mexer no código', async () => {
    // Com ele ligado e sem chave, o erro reaparece — prova de que a
    // integração continua inteira, apenas desligada.
    await expect(
      classificar([item('a', 'O trecho não dispõe de sinalização vertical')], { usarGemini: true }),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('devolve sempre um código que existe no catálogo', () => {
    const s = classificarLocalmente(item('a', 'texto sem relação alguma com o catálogo zzz'));
    expect(obterCodigo(s.codigo)).not.toBeNull();
  });

  it('não propõe fator contribuinte por conta própria, mas marca a caixa de ação', () => {
    const s = classificarLocalmente(item('a', 'Falha sistêmica de gestão de manutenção da frota'));
    // Fator contribuinte é juízo causal e sai da análise humana.
    expect(s.nivel).toBe('constatado');
    // A caixa nasce marcada; quem tira é a pessoa.
    expect(s.exigeAcao).toBe(true);
  });

  it('a confiança acompanha a força do sinal, não é fixa', () => {
    const forte = classificarLocalmente(
      item('a', 'Não foi realizado simulado de ocorrência de emergência com o ônibus.'),
    );
    const fraco = classificarLocalmente(item('b', 'O céu estava azul e a banda tocou uma valsa.'));
    expect(fraco.confianca).toBe('baixa');
    expect(['media', 'alta']).toContain(forte.confianca);
  });

  it('lista vazia não quebra nem exige chave', async () => {
    const r = await classificar([]);
    expect(r.sugestoes).toEqual([]);
  });
});

describe('extração de JSON da resposta do modelo', () => {
  it('aceita JSON puro e JSON entre cercas de código', () => {
    expect(extrairJson('{"a":1}')).toEqual({ a: 1 });
    expect(extrairJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extrairJson('texto antes {"a":1} texto depois')).toEqual({ a: 1 });
  });

  it('devolve nulo quando não há JSON, em vez de adivinhar', () => {
    expect(extrairJson('sem json aqui')).toBeNull();
  });
});

describe('geração do slide', () => {
  const cartao = (codigo: string, nivel: 'contribuinte' | 'constatado') => ({
    codigo,
    titulo: obterCodigo(codigo)!.titulo,
    constatacao: 'Constatação de teste com tamanho suficiente para ocupar duas linhas do cartão.',
    nivel,
  });

  it('gera um único slide quando os cartões cabem', async () => {
    const r = await gerarSlide({
      cartoes: [cartao('MS', 'contribuinte'), cartao('HF21', 'constatado'), cartao('DF03', 'constatado')],
      evento: EVENTO,
    });

    expect(r.arquivo.length).toBeGreaterThan(10_000);
    expect(r.avisos).toEqual([]);
  });

  it('distribui em vários slides em vez de descartar cartão', async () => {
    const muitos = Array.from({ length: 40 }, () => cartao('HF21', 'constatado'));
    const r = await gerarSlide({ cartoes: muitos, evento: EVENTO });

    expect(r.avisos.join(' ')).toContain('distribuídos em');
    expect(r.arquivo.length).toBeGreaterThan(10_000);
  });

  it('cartão gigante sozinho não trava a paginação', async () => {
    const gigante = {
      codigo: 'MS',
      titulo: obterCodigo('MS')!.titulo,
      constatacao: 'x'.repeat(4000),
      nivel: 'constatado' as const,
    };
    const r = await gerarSlide({ cartoes: [gigante], evento: EVENTO });
    expect(r.arquivo.length).toBeGreaterThan(10_000);
  });

  it('evento sem dados vira "não informado", não campo em branco', async () => {
    const r = await gerarSlide({
      cartoes: [cartao('MS', 'constatado')],
      evento: {
        oQueAconteceu: null,
        quemEnvolvido: null,
        ondeAconteceu: null,
        quandoAconteceu: null,
        consequenciaReal: null,
        consequenciaPotencial: null,
      },
    });
    expect(r.arquivo.length).toBeGreaterThan(10_000);
  });
});
