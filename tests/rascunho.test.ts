import { describe, expect, it } from 'vitest';
import {
  avaliarConfiguracaoIa,
  lerConfiguracaoIa,
  obterProvedor,
  ProvedorAnthropic,
  ProvedorGemini,
  ProvedorOpenAi,
} from '@/agentes/provedor';
import { dividirRelato, extrairEventosBrutos, montarRascunho } from '@/servidor/rascunho';
import type { InvestigacaoCompleta } from '@/servidor/repositorio';
import { dossieVazio } from '@/domain/dossie';
import { agora } from '@/domain/tempo/relogio';

/**
 * O rascunho assistido é o ponto onde a IA toca a investigação. O que estes
 * testes protegem não é o formato da saída — é a regra de que nada entra
 * aprovado e nada decidido por humano é sobrescrito.
 */

const RELATO = [
  'Por volta das 14:32 o operador iniciou a manobra de aproximação ao ponto de basculamento na rampa leste.',
  'O equipamento apresentou inclinação lateral e tombou. A área foi isolada às 14h40 e a emergência acionada.',
  'O checklist pré-operacional do turno foi preenchido sem apontamentos. O alarme de inclinação registrou 37 acionamentos em 90 dias.',
].join('\n\n');

function investigacaoDeTeste(relato = RELATO): InvestigacaoCompleta {
  return {
    ...dossieVazio('inv-teste'),
    codigo: 'INV-2026-9999',
    titulo: 'Tombamento de equipamento em rampa',
    fase: 'notificacao',
    metadados: {
      organizacaoId: 'org-teste',
      descricaoInicial: relato,
      ocorridoEm: '2026-08-13T17:32:00.000Z',
      precisaoOcorrencia: 'aproximado',
      local: 'Rampa leste',
      atividade: 'Basculamento',
      severidadeReal: 'moderada',
      severidadePotencial: 'maior',
      nivelInvestigacao: 'completo',
      acoesImediatas: 'Área isolada.',
      localPreservado: true,
      confidencialidade: 'interna',
      criadoEm: '2026-08-13T18:00:00.000Z',
      atualizadoEm: '2026-08-13T18:00:00.000Z',
      excluidoEm: null,
      versao: 1,
      equipe: [],
      envolvidos: [],
      consequencias: [],
    },
  };
}

describe('divisão do relato em trechos citáveis', () => {
  it('usa parágrafos como unidade de citação', () => {
    const trechos = dividirRelato(RELATO);
    expect(trechos).toHaveLength(3);
    expect(trechos[0]?.localizador).toBe('p1');
    expect(trechos[2]?.localizador).toBe('p3');
  });

  it('cai para frases quando o relato vem em bloco único', () => {
    const trechos = dividirRelato('O equipamento tombou na rampa. A área foi isolada em seguida.');
    expect(trechos.length).toBeGreaterThan(1);
  });

  it('nunca devolve lista vazia, para que sempre haja o que citar', () => {
    expect(dividirRelato('texto curto')).toHaveLength(1);
  });
});

describe('extração de eventos com horário', () => {
  it('reconhece 14:32 e 14h40 e monta instante com a data de referência', () => {
    const eventos = extrairEventosBrutos(dividirRelato(RELATO), new Date('2026-08-13T00:00:00.000Z'));
    expect(eventos).toHaveLength(2);
    expect(eventos[0]?.instanteBruto).toBeInstanceOf(Date);
    expect(eventos[0]?.precisao).toBe('aproximado');
  });

  it('sem data de referência, não simula precisão que não existe', () => {
    const eventos = extrairEventosBrutos(dividirRelato(RELATO), null);
    expect(eventos[0]?.instanteBruto).toBeNull();
    expect(eventos[0]?.precisao).toBe('desconhecido');
  });

  it('não inventa evento em trecho sem horário', () => {
    const eventos = extrairEventosBrutos(
      [{ localizador: 'p1', texto: 'O checklist foi preenchido sem apontamentos.' }],
      agora(),
    );
    expect(eventos).toHaveLength(0);
  });
});

describe('rascunho assistido no modo determinístico', () => {
  it('registra o relato como evidência citável antes de extrair qualquer fato', async () => {
    const r = await montarRascunho(investigacaoDeTeste(), null);
    const evidencia = r.investigacao.evidencias.find((e) => e.id === 'ev-relato-inicial');

    expect(evidencia).toBeDefined();
    expect(evidencia?.identificador).toBe('EV-000');
    expect(evidencia?.hashOriginal).toMatch(/^[0-9a-f]{64}$/);
    expect(evidencia?.localizadoresValidos).toEqual(['p1', 'p2', 'p3']);
  });

  it('toda proposição nasce sem aprovação humana e citando evidência real', async () => {
    const r = await montarRascunho(investigacaoDeTeste(), null);
    expect(r.investigacao.fatos.length).toBeGreaterThan(0);

    for (const fato of r.investigacao.fatos) {
      expect(fato.aprovadoPorHumano).toBe(false);
      expect(fato.origemIa).toBe(true);
      expect(fato.vinculos.length).toBeGreaterThan(0);
      for (const vinculo of fato.vinculos) {
        expect(vinculo.evidenciaId).toBe('ev-relato-inicial');
        expect(r.investigacao.evidencias.some((e) => e.id === vinculo.evidenciaId)).toBe(true);
        expect(evidenciaTemLocalizador(r.investigacao, vinculo.localizador)).toBe(true);
      }
    }
  });

  it('nenhuma classificação sai decidida nem com natureza atribuída pela IA', async () => {
    const r = await montarRascunho(investigacaoDeTeste(), null);
    for (const c of r.investigacao.classificacoes) {
      expect(c.decisaoHumana).toBe('pendente');
      expect(c.estado).toBe('candidato');
      expect(c.natureza).toBe('nao_definida');
      expect(c.origemIa).toBe(true);
    }
  });

  it('move a investigação de notificação para análise, mas não além', async () => {
    const r = await montarRascunho(investigacaoDeTeste(), null);
    expect(r.investigacao.fase).toBe('analise');

    const emRevisao = { ...investigacaoDeTeste(), fase: 'revisao' };
    const r2 = await montarRascunho(emRevisao, null);
    expect(r2.investigacao.fase).toBe('revisao');
  });

  it('rodar de novo não duplica nada', async () => {
    const primeira = await montarRascunho(investigacaoDeTeste(), null);
    const segunda = await montarRascunho(primeira.investigacao, null);

    expect(segunda.investigacao.fatos).toHaveLength(primeira.investigacao.fatos.length);
    expect(segunda.investigacao.classificacoes).toHaveLength(primeira.investigacao.classificacoes.length);
    expect(segunda.investigacao.eventos).toHaveLength(primeira.investigacao.eventos.length);
    expect(segunda.investigacao.recomendacoes).toHaveLength(primeira.investigacao.recomendacoes.length);
    expect(segunda.resumo.fatos).toBe(0);
  });

  it('não sobrescreve decisão humana já tomada', async () => {
    const primeira = await montarRascunho(investigacaoDeTeste(), null);
    const comDecisao: InvestigacaoCompleta = {
      ...primeira.investigacao,
      fatos: primeira.investigacao.fatos.map((f, i) =>
        i === 0 ? { ...f, aprovadoPorHumano: true } : f,
      ),
    };

    const segunda = await montarRascunho(comDecisao, null);
    const alvo = segunda.investigacao.fatos.find((f) => f.id === comDecisao.fatos[0]?.id);
    expect(alvo?.aprovadoPorHumano).toBe(true);
  });

  it('registra execução de agente para auditoria', async () => {
    const r = await montarRascunho(investigacaoDeTeste(), null);
    expect(r.registros.length).toBeGreaterThan(0);
    expect(r.registros.every((x) => x.provedor === 'deterministico')).toBe(true);
    expect(r.registros.every((x) => typeof x.entradaHash === 'string' && x.entradaHash.length === 64)).toBe(true);
  });

  it('relato vazio não gera análise nenhuma', async () => {
    const r = await montarRascunho(investigacaoDeTeste('   '), null);
    expect(r.investigacao.fatos).toHaveLength(0);
    expect(r.avisos.join(' ')).toContain('relato inicial');
  });
});

function evidenciaTemLocalizador(inv: InvestigacaoCompleta, localizador: string | null): boolean {
  if (!localizador) return false;
  return inv.evidencias.some((e) => e.localizadoresValidos.includes(localizador));
}

describe('seleção de provedor de IA', () => {
  it('reconhece os três fornecedores externos e o modo local', () => {
    expect(obterProvedor(lerConfiguracaoIa({ PROVEDOR_IA: 'deterministico' }))).toBeNull();
    expect(obterProvedor(lerConfiguracaoIa({ PROVEDOR_IA: 'anthropic' }))).toBeInstanceOf(ProvedorAnthropic);
    expect(obterProvedor(lerConfiguracaoIa({ PROVEDOR_IA: 'openai' }))).toBeInstanceOf(ProvedorOpenAi);
    expect(obterProvedor(lerConfiguracaoIa({ PROVEDOR_IA: 'gemini' }))).toBeInstanceOf(ProvedorGemini);
  });

  it('valor desconhecido cai no modo local, nunca em provedor externo', () => {
    expect(lerConfiguracaoIa({ PROVEDOR_IA: 'gpt-caseiro' }).provedor).toBe('deterministico');
    expect(lerConfiguracaoIa({}).provedor).toBe('deterministico');
  });

  it('cada fornecedor lê a própria variável de chave', () => {
    expect(lerConfiguracaoIa({ PROVEDOR_IA: 'openai', OPENAI_API_KEY: 'k1' }).chaveApi).toBe('k1');
    expect(lerConfiguracaoIa({ PROVEDOR_IA: 'gemini', GEMINI_API_KEY: 'k2' }).chaveApi).toBe('k2');
    expect(lerConfiguracaoIa({ PROVEDOR_IA: 'anthropic', ANTHROPIC_API_KEY: 'k3' }).chaveApi).toBe('k3');
    // Chave do fornecedor errado não vale: evita enviar dados achando que a
    // configuração está completa.
    expect(lerConfiguracaoIa({ PROVEDOR_IA: 'openai', GEMINI_API_KEY: 'k2' }).chaveApi).toBe('');
  });

  it('MODELO_IA sobrepõe o padrão do fornecedor', () => {
    expect(lerConfiguracaoIa({ PROVEDOR_IA: 'gemini' }).modelo).toContain('gemini');
    expect(lerConfiguracaoIa({ PROVEDOR_IA: 'gemini', MODELO_IA: 'gemini-x' }).modelo).toBe('gemini-x');
  });

  it('o aviso de chave ausente nomeia a variável do fornecedor escolhido', () => {
    const avisos = avaliarConfiguracaoIa(
      lerConfiguracaoIa({ PROVEDOR_IA: 'openai', IA_ENVIO_EXTERNO_AUTORIZADO: 'true' }),
    );
    expect(avisos.some((a) => a.nivel === 'erro' && a.mensagem.includes('OPENAI_API_KEY'))).toBe(true);
  });

  it.each(['openai', 'gemini', 'anthropic'])(
    '%s recusa enviar quando o envio externo não está autorizado',
    async (nome) => {
      const provedor = obterProvedor(
        lerConfiguracaoIa({
          PROVEDOR_IA: nome,
          IA_ENVIO_EXTERNO_AUTORIZADO: 'false',
          OPENAI_API_KEY: 'k',
          GEMINI_API_KEY: 'k',
          ANTHROPIC_API_KEY: 'k',
        }),
      );

      await expect(
        provedor?.executar({
          agente: 'fatos',
          instrucao: 'x',
          tarefa: 'y',
          dados: [],
          formatoEsperado: '{}',
        }),
      ).rejects.toThrow(/não está habilitado/i);
    },
  );
});
