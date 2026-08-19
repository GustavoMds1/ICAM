import { describe, expect, it, vi } from 'vitest';
import { ErroGemini, ErroSemChave, gerarJson, obterChave, type Buscador } from '@/lib/gemini';

/**
 * O que estes testes protegem é o comportamento diante de falha, que é onde a
 * integração realmente se prova. Sobrecarga do Gemini (HTTP 503) é comum em
 * horário de pico e não pode virar erro na cara de quem só quer classificar
 * quarenta itens.
 *
 * O `fetch` é injetado para simular as respostas do Google sem rede.
 */

const PEDIDO = {
  chaveApi: 'chave-de-teste',
  instrucao: 'instrução',
  formato: '{}',
  tarefa: 'tarefa',
  tempoLimiteMs: 5_000,
  // Sem espera entre tentativas: o teste verifica a lógica, não o relógio.
  esperasMs: [0, 0, 0, 0],
};

function respostaOk(texto = '{"ok":true}'): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function respostaErro(status: number, mensagem: string): Response {
  return new Response(JSON.stringify({ error: { code: status, message: mensagem } }), { status });
}

function listaDeModelos(...nomes: string[]): Response {
  return new Response(
    JSON.stringify({
      models: nomes.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Encaminha /models para a lista e o resto para as respostas programadas. */
function buscadorFalso(respostas: Response[], modelos: string[] = ['gemini-flash-latest']): Buscador {
  const fila = [...respostas];
  return vi.fn(async (url: RequestInfo | URL) => {
    const endereco = String(url);
    if (endereco.endsWith('/models')) return listaDeModelos(...modelos);
    return fila.shift() ?? respostaErro(500, 'fila vazia');
  }) as unknown as Buscador;
}

describe('chave', () => {
  it('ausente vira erro que diz onde configurar', () => {
    const anterior = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(() => obterChave()).toThrow(ErroSemChave);
      expect(() => obterChave()).toThrow(/Render/);
    } finally {
      if (anterior !== undefined) process.env.GEMINI_API_KEY = anterior;
    }
  });

  it('espaço em branco não conta como chave', () => {
    expect(() => obterChave('   ')).toThrow(ErroSemChave);
  });
});

describe('sobrecarga do modelo (o 503 do Google)', () => {
  it('insiste e passa quando a sobrecarga é momentânea', async () => {
    const buscar = buscadorFalso([
      respostaErro(503, 'This model is currently experiencing high demand.'),
      respostaOk(),
    ]);

    const r = await gerarJson({ ...PEDIDO, buscar });
    expect(r.texto).toBe('{"ok":true}');
  });

  it('troca de modelo quando o preferido continua sobrecarregado', async () => {
    const buscar = buscadorFalso(
      [
        respostaErro(503, 'high demand'),
        respostaErro(503, 'high demand'),
        respostaErro(503, 'high demand'),
        respostaErro(503, 'high demand'),
        respostaOk(),
      ],
      ['gemini-flash-latest', 'gemini-2.5-flash'],
    );

    const r = await gerarJson({ ...PEDIDO, buscar });
    expect(r.modelo).toBe('gemini-2.5-flash');
    expect(r.avisos.join(' ')).toContain('MODELO_IA');
  });

  it('quando tudo está sobrecarregado, explica que é temporário', async () => {
    const buscar = buscadorFalso(Array.from({ length: 12 }, () => respostaErro(503, 'high demand')), [
      'gemini-flash-latest',
    ]);

    await expect(gerarJson({ ...PEDIDO, buscar })).rejects.toThrow(
      /sobrecarregados|alguns minutos/,
    );
  });
});

describe('erros definitivos', () => {
  it('chave inválida não vira quatro tentativas', async () => {
    const respostas = [respostaErro(400, 'API key not valid')];
    const buscar = buscadorFalso(respostas);

    await expect(gerarJson({ ...PEDIDO, buscar })).rejects.toThrow(ErroGemini);
    // Uma chamada a /models e uma ao modelo: sem repetição inútil.
    expect((buscar as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('resposta vazia do modelo é erro, não JSON inventado', async () => {
    const vazia = new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY', content: {} }] }), {
      status: 200,
    });
    await expect(gerarJson({ ...PEDIDO, buscar: buscadorFalso([vazia]) })).rejects.toThrow(/SAFETY/);
  });
});
