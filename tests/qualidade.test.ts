import { describe, expect, it } from 'vitest';
import { criarCasoAnonimizado } from '@/fixtures/casoAnonimizado';
import { reconciliarContagens, verificarQualidade } from '@/domain/qualidade/verificar';
import { REGRAS } from '@/domain/qualidade/regras';
import type { Dossie } from '@/domain/dossie';

/**
 * Os testes verificam COMPORTAMENTO das regras, não conclusões. O fixture
 * fornece dados; cada caso o modifica pontualmente e confere se o verificador
 * correspondente reage. Nenhum resultado do fixture é pré-programado.
 */

function dossie(): Dossie {
  return criarCasoAnonimizado();
}

function regrasDisparadas(d: Dossie): string[] {
  return [...new Set(verificarQualidade(d).ocorrencias.map((o) => o.regra))];
}

describe('verificadores de qualidade — seção 12', () => {
  it('todas as regras declaradas têm id, severidade e princípio', () => {
    for (const r of REGRAS) {
      expect(r.id).toMatch(/^[A-Z_]+$/);
      expect(['bloqueio', 'alerta', 'informativo']).toContain(r.severidade);
      expect(r.principio).toBeTruthy();
    }
  });

  it('ACHADO_SEM_EVIDENCIA: fator confirmado sem evidência favorável é bloqueado', () => {
    const d = dossie();
    const alvo = d.classificacoes.find((c) => c.id === 'cl-1');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.sustentacoes = [];
    expect(regrasDisparadas(d)).toContain('ACHADO_SEM_EVIDENCIA');
  });

  it('FATOR_SEM_MECANISMO: fator confirmado sem mecanismo é bloqueado', () => {
    const d = dossie();
    const alvo = d.classificacoes.find((c) => c.id === 'cl-2');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.mecanismo = null;
    expect(regrasDisparadas(d)).toContain('FATOR_SEM_MECANISMO');
  });

  it('CODIGO_OUTRO_SEM_JUSTIFICATIVA: código genérico exige justificativa', () => {
    const d = dossie();
    const alvo = d.classificacoes.find((c) => c.id === 'cl-2');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.codigo = 'TE24';
    alvo.justificativaGenerico = null;
    expect(regrasDisparadas(d)).toContain('CODIGO_OUTRO_SEM_JUSTIFICATIVA');

    alvo.justificativaGenerico = 'Nenhum código específico de TE cobre este mecanismo, conforme análise da equipe.';
    expect(regrasDisparadas(d)).not.toContain('CODIGO_OUTRO_SEM_JUSTIFICATIVA');
  });

  it('SENSIVEL_SEM_EVIDENCIA_ROBUSTA: fator humano sensível exige evidência objetiva', () => {
    const d = dossie();
    const alvo = d.classificacoes.find((c) => c.id === 'cl-7');
    if (!alvo) throw new Error('fixture inconsistente');
    // Tentativa de confirmar fadiga apoiada apenas em relato.
    alvo.estado = 'confirmado';
    alvo.natureza = 'fator_contribuinte';
    alvo.mecanismo = 'A fadiga teria reduzido o tempo de reação durante a manobra de aproximação.';
    alvo.sustentacoes = [{ fatoId: 'f-6', sentido: 'favoravel', peso: 'medio' }];
    expect(regrasDisparadas(d)).toContain('SENSIVEL_SEM_EVIDENCIA_ROBUSTA');
  });

  it('CONCLUSAO_SO_COM_RELATO: fator sustentado apenas por declaração gera alerta', () => {
    const d = dossie();
    const alvo = d.classificacoes.find((c) => c.id === 'cl-4');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.sustentacoes = [{ fatoId: 'f-6', sentido: 'favoravel', peso: 'medio' }];
    expect(regrasDisparadas(d)).toContain('CONCLUSAO_SO_COM_RELATO');
  });

  it('FATO_INFERENCIA_CONFUNDIDOS: inferência marcada como corroborada é bloqueada', () => {
    const d = dossie();
    const alvo = d.fatos.find((f) => f.id === 'f-9');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.tipoAssercao = 'inferencia_analitica';
    alvo.estadoVerificacao = 'corroborado';
    expect(regrasDisparadas(d)).toContain('FATO_INFERENCIA_CONFUNDIDOS');
  });

  it('CITACAO_NAO_SUSTENTA: vínculo para evidência inexistente é bloqueado', () => {
    const d = dossie();
    const alvo = d.fatos[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.vinculos = [
      { evidenciaId: 'ev-inexistente', declaracaoId: null, sentido: 'favoravel', localizador: 'p. 1', trecho: null, peso: 'forte' },
    ];
    expect(regrasDisparadas(d)).toContain('CITACAO_NAO_SUSTENTA');
  });

  it('CITACAO_NAO_SUSTENTA: citação sem localizador é bloqueada', () => {
    const d = dossie();
    const alvo = d.fatos[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.vinculos = [
      { evidenciaId: 'ev-1', declaracaoId: null, sentido: 'favoravel', localizador: null, trecho: null, peso: 'forte' },
    ];
    expect(regrasDisparadas(d)).toContain('CITACAO_NAO_SUSTENTA');
  });

  it('ANALISE_ENCERRADA_NO_EXECUTANTE: análise só com ação individual é bloqueada', () => {
    const d = dossie();
    // Mantém apenas o fator da coluna de ações.
    d.classificacoes = d.classificacoes.filter((c) => c.id === 'cl-4');
    d.recomendacoes = [];
    expect(regrasDisparadas(d)).toContain('ANALISE_ENCERRADA_NO_EXECUTANTE');
  });

  it('o fixture completo NÃO dispara o bloqueio de análise encerrada no executante', () => {
    expect(regrasDisparadas(dossie())).not.toContain('ANALISE_ENCERRADA_NO_EXECUTANTE');
  });

  it('CORRELACAO_COMO_CAUSA: vínculo causal sem sustentação é bloqueado', () => {
    const d = dossie();
    const alvo = d.relacoesCausais[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.tipo = 'contribuiu_para';
    alvo.grauSustentacao = 'nao_avaliado';
    expect(regrasDisparadas(d)).toContain('CORRELACAO_COMO_CAUSA');
  });

  it('correlação declarada como correlação não dispara o bloqueio', () => {
    const d = dossie();
    const alvo = d.relacoesCausais[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.tipo = 'correlacao_observada';
    alvo.grauSustentacao = 'nao_avaliado';
    expect(regrasDisparadas(d)).not.toContain('CORRELACAO_COMO_CAUSA');
  });

  it('RECOMENDACAO_SEM_FATOR: ação sem vínculo é bloqueada', () => {
    const d = dossie();
    const alvo = d.recomendacoes[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.classificacaoIds = [];
    expect(regrasDisparadas(d)).toContain('RECOMENDACAO_SEM_FATOR');
  });

  it('FATOR_SEM_ACAO: causa sistêmica sem recomendação é bloqueada', () => {
    const d = dossie();
    d.recomendacoes = d.recomendacoes.filter((r) => !r.classificacaoIds.includes('cl-2'));
    expect(regrasDisparadas(d)).toContain('FATOR_SEM_ACAO');
  });

  it('ACAO_SEM_RESPONSAVEL_PRAZO_EFICACIA: falta responsável, prazo ou indicador', () => {
    const d = dossie();
    const alvo = d.recomendacoes[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.responsavel = null;
    alvo.prazo = null;
    alvo.indicadores = [];
    const ocorrencias = verificarQualidade(d).ocorrencias.filter(
      (o) => o.regra === 'ACAO_SEM_RESPONSAVEL_PRAZO_EFICACIA',
    );
    expect(ocorrencias.length).toBeGreaterThan(0);
    expect(ocorrencias[0]?.mensagem).toContain('responsável');
  });

  it('ACAO_SEM_RESPONSAVEL_PRAZO_EFICACIA: risco residual ausente é exigido', () => {
    const d = dossie();
    const alvo = d.recomendacoes[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.riscoResidual = null;
    const mensagens = verificarQualidade(d)
      .ocorrencias.filter((o) => o.regra === 'ACAO_SEM_RESPONSAVEL_PRAZO_EFICACIA')
      .map((o) => o.mensagem);
    expect(mensagens.some((m) => m.includes('risco residual'))).toBe(true);
  });

  it('ACAO_VAGA + EXCESSO_CONTROLES_FRACOS: plano administrativo genérico é desafiado', () => {
    const d = dossie();
    for (const r of d.recomendacoes) {
      r.hierarquiaControle = 'administrativa';
      r.acaoProposta = 'Reforçar a orientação e realizar treinamento de conscientização com a equipe.';
      r.alternativasSuperioresAvaliadas = null;
    }
    const disparadas = regrasDisparadas(d);
    expect(disparadas).toContain('ACAO_VAGA');
    expect(disparadas).toContain('EXCESSO_CONTROLES_FRACOS');
  });

  it('o plano do fixture, majoritariamente de engenharia, não dispara excesso de controles fracos', () => {
    const ocorrencias = verificarQualidade(dossie()).ocorrencias.filter(
      (o) => o.regra === 'EXCESSO_CONTROLES_FRACOS' && o.entidadeTipo === 'investigacao',
    );
    expect(ocorrencias).toHaveLength(0);
  });

  it('ACAO_JA_TRATADA_SEM_VINCULO: "já tratada" exige apontar a ação que cobre', () => {
    const d = dossie();
    const alvo = d.recomendacoes[2];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.status = 'ja_tratada';
    alvo.jaTratadaPorId = null;
    expect(regrasDisparadas(d)).toContain('ACAO_JA_TRATADA_SEM_VINCULO');
  });

  it('EVIDENCIA_DUPLICADA: hashes iguais são sinalizados', () => {
    const d = dossie();
    const [a, b] = d.evidencias;
    if (!a || !b) throw new Error('fixture inconsistente');
    b.hashOriginal = a.hashOriginal;
    expect(regrasDisparadas(d)).toContain('EVIDENCIA_DUPLICADA');
  });

  it('RELOGIO_DIVERGENTE: fontes com desvios incompatíveis são detectadas', () => {
    expect(regrasDisparadas(dossie())).toContain('RELOGIO_DIVERGENTE');
  });

  it('TEMPO_INCONSISTENTE: evento com conflito temporal é sinalizado', () => {
    expect(regrasDisparadas(dossie())).toContain('TEMPO_INCONSISTENTE');
  });

  it('CONFLITO_RESOLVIDO_SEM_JUSTIFICATIVA: resolução exige justificativa', () => {
    const d = dossie();
    const alvo = d.conflitos[0];
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.status = 'resolvido';
    alvo.justificativaResolucao = null;
    expect(regrasDisparadas(d)).toContain('CONFLITO_RESOLVIDO_SEM_JUSTIFICATIVA');
  });

  it('LACUNA_CRITICA_ABERTA: só bloqueia a partir da fase de revisão', () => {
    const d = dossie();
    expect(regrasDisparadas(d)).not.toContain('LACUNA_CRITICA_ABERTA');
    d.fase = 'revisao';
    expect(regrasDisparadas(d)).toContain('LACUNA_CRITICA_ABERTA');
  });

  it('SUGESTAO_IA_SEM_DECISAO_HUMANA: sugestão pendente bloqueia', () => {
    const d = dossie();
    const alvo = d.classificacoes.find((c) => c.id === 'cl-1');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.origemIa = true;
    alvo.decisaoHumana = 'pendente';
    expect(regrasDisparadas(d)).toContain('SUGESTAO_IA_SEM_DECISAO_HUMANA');
  });

  it('LINGUAGEM_CULPABILIZADORA: termos que encerram a análise na pessoa são sinalizados', () => {
    const d = dossie();
    const alvo = d.classificacoes.find((c) => c.id === 'cl-4');
    if (!alvo) throw new Error('fixture inconsistente');
    alvo.descricaoContextual = 'O operador não seguiu o procedimento por falta de atenção durante a manobra.';
    expect(regrasDisparadas(d)).toContain('LINGUAGEM_CULPABILIZADORA');
  });

  it('o fixture não usa linguagem culpabilizadora', () => {
    expect(regrasDisparadas(dossie())).not.toContain('LINGUAGEM_CULPABILIZADORA');
  });

  it('PEEPO_DIMENSAO_NAO_COBERTA: dimensão sem item coletado é sinalizada', () => {
    const d = dossie();
    for (const i of d.itensPeepo) {
      if (i.dimensao === 'organizacao') i.status = 'pendente';
    }
    expect(regrasDisparadas(d)).toContain('PEEPO_DIMENSAO_NAO_COBERTA');
  });

  it('CONTAGEM_DIVERGENTE: números do relatório devem bater com os registros', () => {
    const d = dossie();
    d.relatorio = {
      id: 'rel-1', versao: 1, status: 'minuta', resumoExecutivo: 'Resumo.',
      contagensDeclaradas: { fatores: 99 }, citacoes: [],
    };
    expect(regrasDisparadas(d)).toContain('CONTAGEM_DIVERGENTE');
  });

  it('OPINIAO_DIVERGENTE_OMITIDA: divergência registrada precisa aparecer no relatório', () => {
    const d = dossie();
    d.relatorio = {
      id: 'rel-1', versao: 1, status: 'minuta', resumoExecutivo: 'Resumo sem menção à divergência.',
      contagensDeclaradas: null, citacoes: [],
    };
    expect(regrasDisparadas(d)).toContain('OPINIAO_DIVERGENTE_OMITIDA');
  });

  it('PUBLICACAO_SEM_APROVACAO: publicar sem aprovações obrigatórias é bloqueado', () => {
    const d = dossie();
    d.relatorio = {
      id: 'rel-1', versao: 1, status: 'publicado', resumoExecutivo: 'Resumo.',
      contagensDeclaradas: null, citacoes: [],
    };
    expect(regrasDisparadas(d)).toContain('PUBLICACAO_SEM_APROVACAO');
  });

  it('aprovações completas liberam a publicação quanto a esta regra', () => {
    const d = dossie();
    d.aprovacoes = [
      { tipo: 'conclusoes', decisao: 'aprovado' },
      { tipo: 'recomendacoes', decisao: 'aprovado' },
      { tipo: 'publicacao_relatorio', decisao: 'aprovado' },
    ];
    d.relatorio = {
      id: 'rel-1', versao: 1, status: 'publicado', resumoExecutivo: 'Resumo.',
      contagensDeclaradas: null, citacoes: [],
    };
    expect(regrasDisparadas(d)).not.toContain('PUBLICACAO_SEM_APROVACAO');
  });
});

describe('reconciliação de contagens — seção 13.12', () => {
  it('reconcilia fatos, fatores, causas e ações a partir dos registros', () => {
    const d = dossie();
    const c = reconciliarContagens(d);

    expect(c.fatores).toBe(d.classificacoes.filter((x) => x.estado === 'confirmado').length);
    expect(c.causasSistemicas).toBe(
      d.classificacoes.filter((x) => x.estado === 'confirmado' && x.natureza === 'causa_sistemica').length,
    );
    expect(c.recomendacoes).toBe(d.recomendacoes.filter((r) => r.status !== 'cancelada').length);
    expect(c.fatos).toBe(d.fatos.filter((f) => f.estadoVerificacao === 'corroborado').length);
  });

  it('separa fatores contribuintes, causas sistêmicas e melhorias não causais', () => {
    const c = reconciliarContagens(dossie());
    expect(c.fatoresContribuintes).toBeGreaterThan(0);
    expect(c.causasSistemicas).toBeGreaterThan(0);
    expect(c.oportunidadesNaoCausais).toBeGreaterThan(0);
    expect(c.fatores).toBe(c.fatoresContribuintes + c.causasSistemicas + c.oportunidadesNaoCausais);
  });

  it('distribui os fatores pelas quatro colunas do gráfico ICAM', () => {
    const c = reconciliarContagens(dossie());
    expect(c.porColuna.defesas).toBeGreaterThan(0);
    expect(c.porColuna.condicoes_tarefa_ambiente).toBeGreaterThan(0);
    expect(c.porColuna.acoes).toBeGreaterThan(0);
    expect(c.porColuna.fatores_organizacionais).toBeGreaterThan(0);
  });

  it('é determinística: o mesmo dossiê produz o mesmo relatório', () => {
    const a = verificarQualidade(dossie());
    const b = verificarQualidade(dossie());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
