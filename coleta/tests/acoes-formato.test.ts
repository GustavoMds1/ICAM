import { describe, expect, it } from 'vitest';
import { emDias, proporAcoes } from '@/lib/acoes';
import { gerarSlide } from '@/lib/pptxEscrita';
import { HIERARQUIAS, obterCodigo } from '@/lib/codigos';

const EVENTO = {
  oQueAconteceu: 'Colisão traseira durante ultrapassagem',
  quemEnvolvido: 'Operador de caminhão',
  ondeAconteceu: 'Rodovia de acesso',
  quandoAconteceu: '15/03/26',
  consequenciaReal: 'Leve',
  consequenciaPotencial: 'Crítica',
};

const ACHADO = {
  itemId: 'item-1',
  codigo: 'HF21',
  titulo: 'Padrões de turno ruins e horas extras',
  constatacao: 'A interjornada do motorista foi menor que a prevista na norma.',
};

describe('proposta de ações no modo local, pedido explicitamente', () => {
  it('devolve uma ação por achado, com prazo e hierarquia válidos', async () => {
    const r = await proporAcoes([ACHADO], { permitirLocal: true, hoje: new Date('2026-08-14T00:00:00Z') });

    expect(r.acoes).toHaveLength(1);
    expect(r.origem).toBe('local');
    expect(HIERARQUIAS).toContain(r.acoes[0]!.hierarquia);
    expect(r.acoes[0]!.prazo).toBe('2026-10-13');
  });

  it('não inventa executante nem matrícula', async () => {
    const r = await proporAcoes([ACHADO], { permitirLocal: true });
    expect(r.acoes[0]!.executante).toBe('');
    expect(r.acoes[0]!.matricula).toBe('');
  });

  it('avisa que o rascunho local não é análise', async () => {
    const r = await proporAcoes([ACHADO], { permitirLocal: true });
    expect(r.avisos.join(' ')).toContain('estrutura da ação');
  });

  it('a causa padrão carrega código, título e constatação, como no modelo', async () => {
    const r = await proporAcoes([ACHADO], { permitirLocal: true });
    expect(r.acoes[0]!.causaPadrao).toContain('HF21');
    expect(r.acoes[0]!.causaPadrao).toContain('Padrões de turno');
    expect(r.acoes[0]!.causaPadrao).toContain('interjornada');
  });

  it('lista vazia não quebra', async () => {
    const r = await proporAcoes([]);
    expect(r.acoes).toEqual([]);
  });

  it('o cálculo de prazo não depende do relógio da máquina', () => {
    expect(emDias(30, new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-31');
  });
});

describe('arquivo gerado com plano de ação', () => {
  const cartao = {
    codigo: 'HF21',
    titulo: obterCodigo('HF21')!.titulo,
    constatacao: 'A interjornada do motorista foi menor que a prevista na norma.',
    nivel: 'contribuinte' as const,
  };

  it('inclui a página do plano quando há ações', async () => {
    const acoes = (await proporAcoes([ACHADO], { permitirLocal: true })).acoes;
    const comPlano = await gerarSlide({ cartoes: [cartao], evento: EVENTO, acoes });
    const semPlano = await gerarSlide({ cartoes: [cartao], evento: EVENTO });

    expect(comPlano.arquivo.length).toBeGreaterThan(semPlano.arquivo.length);
  });

  it('avisa quando a ação vai para o slide sem dono', async () => {
    const acoes = (await proporAcoes([ACHADO], { permitirLocal: true })).acoes;
    const r = await gerarSlide({ cartoes: [cartao], evento: EVENTO, acoes });
    expect(r.avisos.join(' ')).toContain('sem executante');
  });

  it('não avisa quando o executante foi preenchido', async () => {
    const acoes = (await proporAcoes([ACHADO], { permitirLocal: true })).acoes.map((a) => ({ ...a, executante: 'Maria Silva' }));
    const r = await gerarSlide({ cartoes: [cartao], evento: EVENTO, acoes });
    expect(r.avisos.join(' ')).not.toContain('sem executante');
  });
});
