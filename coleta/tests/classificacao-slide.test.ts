import { describe, expect, it } from 'vitest';
import { classificar, classificarLocalmente, extrairJson } from '@/lib/classificacao';
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

  it('as cores são exatamente as do modelo enviado', () => {
    expect(NIVEIS.raiz.cor).toBe('FF0000');
    expect(NIVEIS.contribuinte.cor).toBe('FFFF00');
    expect(NIVEIS.constatado.cor).toBe('FFFFFF');
  });
});

describe('classificação sem chave de API', () => {
  it('só classifica constatação, nunca tarefa de coleta', async () => {
    const r = await classificar([
      item('a', 'O trecho não dispõe de sinalização vertical regulamentadora'),
      item('b', 'Telemetria do veículo', 'evidencia'),
    ]);

    expect(r.sugestoes.map((s) => s.itemId)).toEqual(['a']);
    expect(r.origem).toBe('local');
    expect(r.avisos.join(' ')).toContain('GEMINI_API_KEY');
  });

  it('devolve sempre um código que existe no catálogo', () => {
    const s = classificarLocalmente(item('a', 'texto sem relação alguma com o catálogo zzz'));
    expect(obterCodigo(s.codigo)).not.toBeNull();
  });

  it('nunca propõe causa raiz por conta própria', () => {
    const s = classificarLocalmente(item('a', 'Falha sistêmica de gestão de manutenção da frota'));
    expect(s.nivel).toBe('constatado');
    expect(s.confianca).toBe('baixa');
  });

  it('lista vazia não quebra', async () => {
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
  const cartao = (codigo: string, nivel: 'raiz' | 'contribuinte' | 'constatado') => ({
    codigo,
    titulo: obterCodigo(codigo)!.titulo,
    constatacao: 'Constatação de teste com tamanho suficiente para ocupar duas linhas do cartão.',
    nivel,
  });

  it('gera um único slide quando os cartões cabem', async () => {
    const r = await gerarSlide({
      cartoes: [cartao('MS', 'raiz'), cartao('HF21', 'contribuinte'), cartao('DF03', 'constatado')],
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
