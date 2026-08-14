import PptxGenJS from 'pptxgenjs';
import { describe, expect, it } from 'vitest';
import { lerEvento, lerFormas, lerPptx, separarResponsavel } from '@/lib/pptxLeitura';

/**
 * O teste monta um PowerPoint com a mesma estrutura do modelo de investigação
 * e o lê de volta. Assim a verificação não depende de nenhum arquivo real —
 * apresentação de investigação tem nome de pessoa e não entra no repositório.
 */

async function pptxDeTeste(): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText('Metodologia de Investigação ICAM', { x: 0.3, y: 0.2, w: 5, h: 0.4 });
  slide.addText('Coleta de Dados', { x: 0.3, y: 0.7, w: 3, h: 0.4 });

  slide.addText(
    [
      { text: 'Pessoas\n' },
      { text: 'Coleta de Evidências de pessoas\n' },
      { text: 'Relato do operador - Adalberto JSL\n' },
      { text: '.No relato o motorista trouxe que tentou ultrapassar o equipamento, porém o caminhão acelerou\n' },
    ],
    { x: 0.2, y: 1.5, w: 2.4, h: 5 },
  );

  slide.addText(
    [
      { text: 'Equipamento\n' },
      { text: 'Coleta de Evidências Equipamentos\n' },
      { text: 'Telemetria - Arley\n' },
      { text: 'A mensuração do tambor de freio e os itens checados no sistema de freio estavam de acordo com o plano\n' },
    ],
    { x: 2.8, y: 1.5, w: 2.4, h: 5 },
  );

  const outro = pptx.addSlide();
  outro.addText(
    [
      { text: 'O que aconteceu?\n' },
      { text: 'Ao ultrapassar um caminhão, o ônibus abalroou a traseira do veículo ultrapassado\n' },
      { text: 'Onde aconteceu?\n' },
      { text: 'Rodovia de acesso à mina\n' },
      { text: 'Consequência real: Leve\n' },
      { text: 'Consequência potencial: Crítica\n' },
    ],
    { x: 9, y: 0.7, w: 3, h: 5 },
  );

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}

describe('separação do responsável', () => {
  it('reconhece o nome no fim do item', () => {
    const r = separarResponsavel('Plano de manutenção do ônibus frota W1252 - Watylon JSL');
    expect(r.responsavel).toBe('Watylon JSL');
    expect(r.texto).toBe('Plano de manutenção do ônibus frota W1252');
  });

  it('não confunde continuação de frase com nome de pessoa', () => {
    const r = separarResponsavel('O ônibus estava com 238748.2 KM rodados - 12 acima do previsto');
    expect(r.responsavel).toBeNull();
  });

  it('não engole o item quando o que sobra é curto demais', () => {
    const r = separarResponsavel('Telemetria - Arley');
    expect(r.texto).toContain('Telemetria');
  });

  it('remove o ponto que o modelo usa para marcar achado', () => {
    expect(separarResponsavel('.No relato o motorista trouxe').texto).toBe('No relato o motorista trouxe');
  });
});

describe('leitura do arquivo', () => {
  it('separa itens por categoria PEEPO', async () => {
    const r = await lerPptx(await pptxDeTeste());

    expect(r.slidesLidos).toEqual([1]);
    const pessoas = r.itens.filter((i) => i.categoria === 'pessoas');
    const equipamento = r.itens.filter((i) => i.categoria === 'equipamento');
    expect(pessoas.length).toBe(2);
    expect(equipamento.length).toBe(2);
  });

  it('distingue tarefa de coleta de constatação', async () => {
    const r = await lerPptx(await pptxDeTeste());

    const comDono = r.itens.find((i) => i.texto.startsWith('Relato do operador'));
    expect(comDono?.tipo).toBe('evidencia');
    expect(comDono?.responsavel).toBe('Adalberto JSL');

    const achado = r.itens.find((i) => i.texto.startsWith('No relato o motorista'));
    expect(achado?.tipo).toBe('constatacao');
    expect(achado?.responsavel).toBeNull();
  });

  it('ignora os cabeçalhos do modelo', async () => {
    const r = await lerPptx(await pptxDeTeste());
    expect(r.itens.some((i) => /coleta de evid/i.test(i.texto))).toBe(false);
    expect(r.itens.some((i) => /metodologia/i.test(i.texto))).toBe(false);
  });

  it('lê a caixa do evento, com rótulo em linha própria ou após dois-pontos', async () => {
    const r = await lerPptx(await pptxDeTeste());
    expect(r.evento.oQueAconteceu).toContain('abalroou');
    expect(r.evento.ondeAconteceu).toBe('Rodovia de acesso à mina');
    expect(r.evento.consequenciaReal).toBe('Leve');
    expect(r.evento.consequenciaPotencial).toBe('Crítica');
  });

  it('avisa quando o arquivo não tem slide de coleta', async () => {
    const pptx = new PptxGenJS();
    pptx.addSlide().addText('Plano de ação', { x: 1, y: 1, w: 4, h: 1 });
    const r = await lerPptx((await pptx.write({ outputType: 'nodebuffer' })) as Buffer);

    expect(r.itens).toHaveLength(0);
    expect(r.avisos.join(' ')).toContain('Coleta de Dados');
  });

  it('arquivo que não é PowerPoint não derruba a leitura', async () => {
    await expect(lerPptx(Buffer.from('isto não é um pptx'))).rejects.toBeTruthy();
  });
});

describe('extração de formas do XML', () => {
  it('mantém cada parágrafo separado e desescapa entidades', () => {
    const xml =
      '<p:sp><a:off x="100" y="200"/><a:p><a:t>Pessoas &amp; equipe</a:t></a:p>' +
      '<a:p><a:t>Item </a:t><a:t>partido em dois</a:t></a:p></p:sp>';
    const formas = lerFormas(xml);

    expect(formas).toHaveLength(1);
    expect(formas[0]?.paragrafos).toEqual(['Pessoas & equipe', 'Item partido em dois']);
  });

  it('não devolve forma sem texto', () => {
    expect(lerFormas('<p:sp><a:off x="1" y="2"/></p:sp>')).toHaveLength(0);
  });
});

describe('leitura do evento', () => {
  it('não inventa valor para campo ausente', () => {
    const evento = lerEvento([{ x: 0, y: 0, paragrafos: ['O que aconteceu?', 'Colisão na rampa'] }]);
    expect(evento.oQueAconteceu).toBe('Colisão na rampa');
    expect(evento.quemEnvolvido).toBeNull();
    expect(evento.quandoAconteceu).toBeNull();
  });
});
