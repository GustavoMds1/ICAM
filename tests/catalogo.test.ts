import { describe, expect, it } from 'vitest';
import {
  buscarCodigos,
  carregarCatalogo,
  conferirCatalogo,
  ehCodigoGenerico,
  ehCodigoSensivel,
  obterCodigo,
} from '@/domain/taxonomia/catalogo';
import { DISTRIBUICAO_ESPERADA, TOTAL_CODIGOS_ESPERADO } from '@/domain/taxonomia/esquema';

describe('catálogo ICAM — seção 5 do prompt mestre', () => {
  it('carrega e valida o catálogo versionado', () => {
    expect(() => carregarCatalogo()).not.toThrow();
  });

  it('contém exatamente 101 códigos', () => {
    expect(carregarCatalogo().codigos).toHaveLength(TOTAL_CODIGOS_ESPERADO);
  });

  it.each(Object.entries(DISTRIBUICAO_ESPERADA))(
    'o grupo %s tem %i códigos',
    (grupo, esperado) => {
      const encontrado = carregarCatalogo().codigos.filter((c) => c.grupo === grupo);
      expect(encontrado).toHaveLength(esperado);
    },
  );

  it('não tem códigos duplicados', () => {
    expect(conferirCatalogo().duplicados).toEqual([]);
  });

  it('a conferência estrutural passa', () => {
    expect(conferirCatalogo().conforme).toBe(true);
  });

  it('nenhuma definição foi inventada: ausência é sempre um estado declarado', () => {
    const catalogo = carregarCatalogo();
    const estadosDeAusencia = ['PENDENTE_EXTRACAO_DOCX', 'SEM_DEFINICAO_NA_FONTE'];

    for (const c of catalogo.codigos) {
      if (c.definicao === null) {
        // Sem definição, o motivo precisa estar declarado — nunca preenchido.
        expect(estadosDeAusencia, `código ${c.codigo}`).toContain(c.definicaoStatus);
      } else {
        // Com definição, ela veio de importação com proveniência, não de geração.
        expect(['IMPORTADA', 'CONFERIDA'], `código ${c.codigo}`).toContain(c.definicaoStatus);
        expect(c.fonte.metodoExtracao).not.toMatch(/gera|model|ia/i);
      }
      expect(c.requerConferenciaHumana).toBe(true);
    }
  });

  it('as definições importadas trazem proveniência do documento de origem', () => {
    const importadas = carregarCatalogo().codigos.filter((c) => c.definicaoStatus === 'IMPORTADA');
    expect(importadas.length).toBeGreaterThan(0);

    for (const c of importadas) {
      expect(c.definicao).not.toBeNull();
      expect(c.definicao?.length ?? 0).toBeGreaterThan(19);
      expect(c.fonte.arquivo).toMatch(/\.docx$/i);
      expect(c.fonte.hashSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(c.fonte.localizacao).toBeTruthy();
      expect(c.fonte.escopo).toBe('definicao_e_exemplos');
    }
  });

  it('ausência de definição na fonte é registrada como fato conferido, não como pendência', () => {
    const semFonte = carregarCatalogo().codigos.filter(
      (c) => c.definicaoStatus === 'SEM_DEFINICAO_NA_FONTE',
    );
    for (const c of semFonte) {
      expect(c.definicao).toBeNull();
      expect(c.fonte.escopo).toBe('ausencia_de_definicao_confirmada');
      expect(c.fonte.hashSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('os exemplos vieram do documento, não foram redigidos', () => {
    const comExemplos = carregarCatalogo().codigos.filter((c) => c.exemplos.length > 0);
    expect(comExemplos.length).toBeGreaterThan(50);

    for (const c of comExemplos) {
      for (const exemplo of c.exemplos) {
        expect(exemplo, `exemplo de ${c.codigo}`).toMatch(/por exemplo|exemplos?/i);
      }
    }
  });

  it('todo código registra proveniência com arquivo, hash e localização', () => {
    for (const c of carregarCatalogo().codigos) {
      expect(c.fonte.arquivo).toBeTruthy();
      expect(c.fonte.hashSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(c.fonte.localizacao).toBeTruthy();
      expect(c.fonte.metodoExtracao).toBeTruthy();
    }
  });

  it('as fontes ainda não fornecidas estão declaradas explicitamente', () => {
    const pendentes = conferirCatalogo().fontesPendentes;
    expect(pendentes.length).toBeGreaterThan(0);
    expect(pendentes.some((f) => f.arquivo.includes('.docx'))).toBe(true);
  });

  it('identifica os códigos genéricos "Outro"', () => {
    for (const codigo of ['DF21', 'IT14', 'TE24', 'HF26']) {
      expect(ehCodigoGenerico(codigo)).toBe(true);
    }
    expect(ehCodigoGenerico('DF08')).toBe(false);
  });

  it('marca como sensíveis os fatores humanos que tocam saúde, substâncias e vida pessoal', () => {
    for (const codigo of ['HF02', 'HF04', 'HF08', 'HF09', 'HF10', 'HF11', 'HF14']) {
      expect(ehCodigoSensivel(codigo)).toBe(true);
    }
    expect(ehCodigoSensivel('HF03')).toBe(false);
  });

  it('as defesas exigem estado de barreira separado', () => {
    const defesas = carregarCatalogo().codigos.filter((c) => c.grupo === 'defesas_ausentes_ou_falhas');
    expect(defesas.every((d) => d.exigeEstadoBarreira)).toBe(true);
    expect(defesas[0]?.estadosBarreiraPermitidos).toContain('ausente');
    expect(defesas[0]?.estadosBarreiraPermitidos).toContain('nao_aplicavel');
  });

  it('busca por termos do catálogo e devolve motivo do casamento', () => {
    const acertos = buscarCodigos('condições do gradiente da superfície');
    expect(acertos.length).toBeGreaterThan(0);
    expect(acertos[0]?.termosCasados.length).toBeGreaterThan(0);
    expect(acertos.map((a) => a.codigo.codigo)).toContain('TE22');
  });

  it('busca é insensível a acento e caixa', () => {
    expect(buscarCodigos('FADIGA').map((a) => a.codigo.codigo)).toContain('HF04');
    expect(buscarCodigos('iluminacao').map((a) => a.codigo.codigo)).toContain('TE14');
  });

  it('obtém código por identificador, em qualquer caixa', () => {
    expect(obterCodigo('df08')?.titulo).toContain('Detectores de velocidade');
    expect(obterCodigo('XX99')).toBeUndefined();
  });

  it('os 16 códigos organizacionais estão presentes', () => {
    const organizacionais = ['CM', 'CO', 'DE', 'HW', 'IG', 'MC', 'MM', 'MS', 'OC', 'OL', 'OR', 'PR', 'RI', 'RM', 'TR', 'VW'];
    for (const c of organizacionais) {
      expect(obterCodigo(c), `código ${c} ausente`).toBeDefined();
    }
  });
});
