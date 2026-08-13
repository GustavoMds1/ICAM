import type { Dossie, DossieRecomendacao } from '../dossie';
import {
  CONTROLES_FRACOS,
  NATUREZAS_QUE_EXIGEM_ACAO,
  RELACOES_NAO_CAUSAIS,
  TIPOS_ASSERCAO_NAO_FACTUAIS,
  type SeveridadeVerificacao,
} from '../enumeracoes';
import { ehCodigoGenerico, ehCodigoSensivel, normalizar } from '../taxonomia/catalogo';
import { detectarDivergenciasDeRelogio } from '../tempo/normalizacao';
import {
  REGRAS_POR_ID,
  TERMOS_ACAO_VAGA,
  TERMOS_CULPABILIZADORES,
  type DefinicaoRegra,
} from './regras';

export interface Ocorrencia {
  regra: string;
  titulo: string;
  severidade: SeveridadeVerificacao;
  principio: string;
  entidadeTipo: string | null;
  entidadeId: string | null;
  mensagem: string;
  detalhe?: Record<string, unknown>;
}

export interface RelatorioQualidade {
  investigacaoId: string;
  ocorrencias: Ocorrencia[];
  bloqueios: number;
  alertas: number;
  informativos: number;
  podePublicar: boolean;
}

function regra(id: string): DefinicaoRegra {
  const r = REGRAS_POR_ID.get(id);
  if (!r) throw new Error(`Regra de qualidade desconhecida: ${id}`);
  return r;
}

function emitir(
  id: string,
  mensagem: string,
  entidadeTipo: string | null = null,
  entidadeId: string | null = null,
  detalhe?: Record<string, unknown>,
): Ocorrencia {
  const r = regra(id);
  return {
    regra: r.id,
    titulo: r.titulo,
    severidade: r.severidade,
    principio: r.principio,
    entidadeTipo,
    entidadeId,
    mensagem,
    ...(detalhe ? { detalhe } : {}),
  };
}

function contemTermo(texto: string, termos: readonly string[]): string[] {
  const alvo = normalizar(texto);
  return termos.filter((t) => alvo.includes(normalizar(t)));
}

/**
 * Executa todos os verificadores da seção 12 sobre o dossiê.
 *
 * Determinístico e sem efeitos colaterais: o mesmo dossiê produz sempre o
 * mesmo relatório, o que torna a suíte de regressão confiável.
 */
export function verificarQualidade(dossie: Dossie): RelatorioQualidade {
  const oc: Ocorrencia[] = [];
  const confirmados = dossie.classificacoes.filter((c) => c.estado === 'confirmado');
  const fatosPorId = new Map(dossie.fatos.map((f) => [f.id, f]));
  const evidenciasPorId = new Map(dossie.evidencias.map((e) => [e.id, e]));

  // --- Fatores ICAM --------------------------------------------------------
  for (const c of confirmados) {
    const favoraveis = c.sustentacoes.filter((s) => s.sentido === 'favoravel');

    if (favoraveis.length === 0) {
      oc.push(
        emitir(
          'ACHADO_SEM_EVIDENCIA',
          `O fator ${c.identificador} (${c.codigo}) está confirmado sem nenhuma evidência favorável vinculada.`,
          'classificacao',
          c.id,
        ),
      );
    }

    if (!c.mecanismo || c.mecanismo.trim().length < 15) {
      oc.push(
        emitir(
          'FATOR_SEM_MECANISMO',
          `O fator ${c.identificador} (${c.codigo}) não descreve o mecanismo pelo qual contribuiu para o evento.`,
          'classificacao',
          c.id,
        ),
      );
    }

    if (ehCodigoGenerico(c.codigo) && !c.justificativaGenerico?.trim()) {
      oc.push(
        emitir(
          'CODIGO_OUTRO_SEM_JUSTIFICATIVA',
          `O fator ${c.identificador} usa o código genérico ${c.codigo} sem justificar por que nenhum código específico se aplica.`,
          'classificacao',
          c.id,
        ),
      );
    }

    // Corroboração: relato isolado não sustenta fator confirmado.
    const tiposDasFontes = favoraveis
      .map((s) => fatosPorId.get(s.fatoId)?.tipoAssercao)
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    const temFonteObjetiva = tiposDasFontes.some(
      (t) => t === 'fato_confirmado' || t === 'medicao_ou_registro',
    );
    if (favoraveis.length > 0 && !temFonteObjetiva) {
      oc.push(
        emitir(
          'CONCLUSAO_SO_COM_RELATO',
          `O fator ${c.identificador} (${c.codigo}) está sustentado apenas por relatos, sem medição, registro ou documento que corrobore.`,
          'classificacao',
          c.id,
          { tiposDasFontes },
        ),
      );
    }

    // Fatores humanos sensíveis exigem evidência robusta e corroborada.
    if (ehCodigoSensivel(c.codigo)) {
      const fortes = favoraveis.filter((s) => s.peso === 'forte');
      if (fortes.length === 0 || !temFonteObjetiva) {
        oc.push(
          emitir(
            'SENSIVEL_SEM_EVIDENCIA_ROBUSTA',
            `O fator ${c.identificador} usa o código sensível ${c.codigo} sem evidência robusta e corroborada. ` +
              'Códigos que tocam saúde, fadiga, substâncias ou vida pessoal exigem evidência objetiva, nunca inferência de comportamento.',
            'classificacao',
            c.id,
          ),
        );
      }
    }

    if (c.origemIa && c.decisaoHumana === 'pendente') {
      oc.push(
        emitir(
          'SUGESTAO_IA_SEM_DECISAO_HUMANA',
          `O fator ${c.identificador} foi sugerido por IA e ainda não tem decisão humana (aceitar, editar ou rejeitar).`,
          'classificacao',
          c.id,
        ),
      );
    }

    const culpa = contemTermo(c.descricaoContextual, TERMOS_CULPABILIZADORES);
    if (culpa.length > 0) {
      oc.push(
        emitir(
          'LINGUAGEM_CULPABILIZADORA',
          `A descrição do fator ${c.identificador} usa linguagem culpabilizadora: ${culpa.join(', ')}.`,
          'classificacao',
          c.id,
          { termos: culpa },
        ),
      );
    }
  }

  // Não encerrar em "erro do operador" (princípio 3.7).
  const acoesConfirmadas = confirmados.filter((c) => c.coluna === 'acoes');
  const contextoConfirmado = confirmados.filter((c) =>
    (['defesas', 'condicoes_tarefa_ambiente', 'fatores_organizacionais'] as const).includes(
      c.coluna as 'defesas' | 'condicoes_tarefa_ambiente' | 'fatores_organizacionais',
    ),
  );
  if (acoesConfirmadas.length > 0 && contextoConfirmado.length === 0) {
    oc.push(
      emitir(
        'ANALISE_ENCERRADA_NO_EXECUTANTE',
        `Há ${acoesConfirmadas.length} fator(es) confirmado(s) em ações individuais/equipe e nenhum em defesas, condições da tarefa ou fatores organizacionais. ` +
          'A análise não pode se encerrar no executante local.',
        'investigacao',
        dossie.investigacaoId,
      ),
    );
  }

  // --- Fatos ---------------------------------------------------------------
  for (const f of dossie.fatos) {
    if (
      f.estadoVerificacao === 'corroborado' &&
      TIPOS_ASSERCAO_NAO_FACTUAIS.includes(f.tipoAssercao)
    ) {
      oc.push(
        emitir(
          'FATO_INFERENCIA_CONFUNDIDOS',
          `O registro ${f.identificador} está marcado como corroborado, mas seu tipo de asserção é "${f.tipoAssercao}". ` +
            'Inferência, hipótese e informação contestada não podem ser apresentadas como fato.',
          'fato',
          f.id,
        ),
      );
    }
    for (const v of f.vinculos) {
      if (v.evidenciaId && !evidenciasPorId.has(v.evidenciaId)) {
        oc.push(
          emitir(
            'CITACAO_NAO_SUSTENTA',
            `O registro ${f.identificador} referencia uma evidência inexistente (${v.evidenciaId}).`,
            'fato',
            f.id,
          ),
        );
      }
      if (v.evidenciaId && !v.localizador) {
        oc.push(
          emitir(
            'CITACAO_NAO_SUSTENTA',
            `O registro ${f.identificador} cita a evidência ${evidenciasPorId.get(v.evidenciaId)?.identificador ?? v.evidenciaId} sem localizador (página, slide, célula ou timestamp).`,
            'fato',
            f.id,
          ),
        );
      }
    }
  }

  // --- Recomendações e plano de ação --------------------------------------
  const idsClassificacoes = new Set(dossie.classificacoes.map((c) => c.id));

  for (const r of dossie.recomendacoes) {
    if (r.status === 'cancelada') continue;

    if (r.classificacaoIds.length === 0) {
      oc.push(
        emitir(
          'RECOMENDACAO_SEM_FATOR',
          `A recomendação ${r.identificador} não está vinculada a nenhum fator.`,
          'recomendacao',
          r.id,
        ),
      );
    } else {
      const orfas = r.classificacaoIds.filter((id) => !idsClassificacoes.has(id));
      if (orfas.length > 0) {
        oc.push(
          emitir(
            'RECOMENDACAO_SEM_FATOR',
            `A recomendação ${r.identificador} aponta para fator(es) inexistente(s): ${orfas.join(', ')}.`,
            'recomendacao',
            r.id,
          ),
        );
      }
    }

    if (r.status === 'ja_tratada' && !r.jaTratadaPorId) {
      oc.push(
        emitir(
          'ACAO_JA_TRATADA_SEM_VINCULO',
          `A recomendação ${r.identificador} está marcada como "já tratada" sem apontar qual ação a cobre.`,
          'recomendacao',
          r.id,
        ),
      );
    }

    if (r.status !== 'ja_tratada') {
      const faltantes: string[] = [];
      if (!r.responsavel?.trim()) faltantes.push('responsável');
      if (!r.prazo) faltantes.push('prazo');
      const indicadorValido = r.indicadores.some(
        (i) => i.meta.trim().length > 0 && i.metodoMedicao.trim().length > 0,
      );
      if (!indicadorValido) faltantes.push('indicador de eficácia com meta e método');
      if (faltantes.length > 0) {
        oc.push(
          emitir(
            'ACAO_SEM_RESPONSAVEL_PRAZO_EFICACIA',
            `A recomendação ${r.identificador} está sem: ${faltantes.join(', ')}.`,
            'recomendacao',
            r.id,
            { faltantes },
          ),
        );
      }
      if (!r.riscoResidual?.trim()) {
        oc.push(
          emitir(
            'ACAO_SEM_RESPONSAVEL_PRAZO_EFICACIA',
            `A recomendação ${r.identificador} não declara o risco residual após a implementação.`,
            'recomendacao',
            r.id,
          ),
        );
      }
    }

    const vagos = contemTermo(`${r.acaoProposta} ${r.objetivo}`, TERMOS_ACAO_VAGA);
    if (vagos.length > 0 && CONTROLES_FRACOS.includes(r.hierarquiaControle)) {
      oc.push(
        emitir(
          'ACAO_VAGA',
          `A recomendação ${r.identificador} descreve uma ação genérica (${vagos.join(', ')}) classificada como controle ${r.hierarquiaControle}. ` +
            'Descreva a mudança sistêmica verificável ou avalie um controle mais forte.',
          'recomendacao',
          r.id,
          { termos: vagos },
        ),
      );
    }

    if (
      CONTROLES_FRACOS.includes(r.hierarquiaControle) &&
      !r.alternativasSuperioresAvaliadas?.trim()
    ) {
      oc.push(
        emitir(
          'EXCESSO_CONTROLES_FRACOS',
          `A recomendação ${r.identificador} adota controle ${r.hierarquiaControle} sem registrar a avaliação de eliminação, substituição ou engenharia.`,
          'recomendacao',
          r.id,
        ),
      );
    }
  }

  // Duplicidade textual de ações.
  const porTexto = new Map<string, DossieRecomendacao[]>();
  for (const r of dossie.recomendacoes) {
    const chave = normalizar(r.acaoProposta);
    porTexto.set(chave, [...(porTexto.get(chave) ?? []), r]);
  }
  for (const [, grupo] of porTexto) {
    if (grupo.length > 1) {
      const ids = grupo.map((g) => g.identificador).join(', ');
      const primeiro = grupo[0];
      if (primeiro) {
        oc.push(
          emitir(
            'ACAO_JA_TRATADA_SEM_VINCULO',
            `Ações com texto idêntico sem vínculo de cobertura: ${ids}.`,
            'recomendacao',
            primeiro.id,
          ),
        );
      }
    }
  }

  // Proporção de controles fracos no plano.
  const ativas = dossie.recomendacoes.filter((r) => r.status !== 'cancelada');
  if (ativas.length >= 3) {
    const fracas = ativas.filter((r) => CONTROLES_FRACOS.includes(r.hierarquiaControle));
    const proporcao = fracas.length / ativas.length;
    if (proporcao > 0.7) {
      oc.push(
        emitir(
          'EXCESSO_CONTROLES_FRACOS',
          `${fracas.length} de ${ativas.length} ações (${Math.round(proporcao * 100)}%) são administrativas ou de EPI. ` +
            'Avalie explicitamente eliminação, substituição e engenharia antes de fechar o plano.',
          'investigacao',
          dossie.investigacaoId,
          { proporcao },
        ),
      );
    }
  }

  // Fatores que exigem tratamento e ficaram sem ação.
  const fatoresTratados = new Set(dossie.recomendacoes.flatMap((r) => r.classificacaoIds));
  for (const c of confirmados) {
    if (!NATUREZAS_QUE_EXIGEM_ACAO.includes(c.natureza)) continue;
    if (!fatoresTratados.has(c.id)) {
      oc.push(
        emitir(
          'FATOR_SEM_ACAO',
          `O fator ${c.identificador} (${c.codigo}) é ${c.natureza.replace(/_/g, ' ')} e não tem nenhuma recomendação vinculada.`,
          'classificacao',
          c.id,
        ),
      );
    }
  }

  // --- Causalidade ---------------------------------------------------------
  for (const rel of dossie.relacoesCausais) {
    const afirmaCausa = !RELACOES_NAO_CAUSAIS.includes(rel.tipo);
    if (afirmaCausa && (rel.grauSustentacao === 'nao_avaliado' || rel.grauSustentacao === 'fraco')) {
      oc.push(
        emitir(
          'CORRELACAO_COMO_CAUSA',
          `A relação "${rel.afirmacaoTestavel}" afirma causalidade (${rel.tipo}) com grau de sustentação ${rel.grauSustentacao}. ` +
            'Reclassifique como correlação observada ou registre a evidência que sustenta o vínculo.',
          'relacao_causal',
          rel.id,
        ),
      );
    }
  }

  // --- Tempo ---------------------------------------------------------------
  for (const e of dossie.eventos) {
    if (e.instanteNormalizado && !e.fonteTemporalId) {
      oc.push(
        emitir(
          'TEMPO_INCONSISTENTE',
          `O evento "${e.titulo}" tem instante registrado sem fonte temporal declarada.`,
          'evento',
          e.id,
        ),
      );
    }
    if (e.conflitoTemporal) {
      oc.push(
        emitir(
          'TEMPO_INCONSISTENTE',
          `O evento "${e.titulo}" está marcado com conflito temporal não resolvido.`,
          'evento',
          e.id,
        ),
      );
    }
  }

  for (const d of detectarDivergenciasDeRelogio(
    dossie.fontesTemporais.map((f) => ({
      id: f.id,
      nome: f.nome,
      desvioSegundos: f.desvioSegundos,
      confiabilidade: f.confiabilidade === 'nao_avaliada' ? 'nao_avaliada' : f.confiabilidade,
    })),
  )) {
    oc.push(
      emitir('RELOGIO_DIVERGENTE', d.descricao, 'investigacao', dossie.investigacaoId, {
        diferencaSegundos: d.diferencaSegundos,
      }),
    );
  }

  // --- Evidências ----------------------------------------------------------
  const porHash = new Map<string, string[]>();
  for (const e of dossie.evidencias) {
    if (!e.hashOriginal) continue;
    porHash.set(e.hashOriginal, [...(porHash.get(e.hashOriginal) ?? []), e.identificador]);
  }
  for (const [hash, ids] of porHash) {
    if (ids.length > 1) {
      oc.push(
        emitir(
          'EVIDENCIA_DUPLICADA',
          `Evidências com conteúdo idêntico (hash ${hash.slice(0, 12)}…): ${ids.join(', ')}.`,
          'investigacao',
          dossie.investigacaoId,
        ),
      );
    }
  }

  // --- Conflitos e lacunas -------------------------------------------------
  for (const c of dossie.conflitos) {
    if (c.status === 'resolvido' && !c.justificativaResolucao?.trim()) {
      oc.push(
        emitir(
          'CONFLITO_RESOLVIDO_SEM_JUSTIFICATIVA',
          `O conflito ${c.identificador} está resolvido sem registrar qual versão prevaleceu e por quê.`,
          'conflito',
          c.id,
        ),
      );
    }
  }

  const fasePublicacao = ['revisao', 'aprovacao', 'publicado'].includes(dossie.fase);
  for (const l of dossie.lacunas) {
    if (
      (l.criticidade === 'alta' || l.criticidade === 'critica') &&
      (l.status === 'aberta' || l.status === 'em_diligencia') &&
      fasePublicacao
    ) {
      oc.push(
        emitir(
          'LACUNA_CRITICA_ABERTA',
          `A lacuna ${l.identificador} é de criticidade ${l.criticidade} e continua ${l.status} na fase "${dossie.fase}".`,
          'lacuna',
          l.id,
        ),
      );
    }
  }

  // --- PEEPO ---------------------------------------------------------------
  const dimensoes = ['pessoas', 'ambiente', 'equipamentos', 'procedimentos', 'organizacao'] as const;
  if (dossie.itensPeepo.length > 0) {
    for (const dim of dimensoes) {
      const itens = dossie.itensPeepo.filter((i) => i.dimensao === dim);
      const coletados = itens.filter((i) => i.status === 'coletado');
      if (coletados.length === 0) {
        oc.push(
          emitir(
            'PEEPO_DIMENSAO_NAO_COBERTA',
            `A dimensão PEEPO "${dim}" não tem nenhum item de coleta concluído (${itens.length} item(ns) planejado(s)).`,
            'investigacao',
            dossie.investigacaoId,
          ),
        );
      }
    }
  }

  // --- Relatório -----------------------------------------------------------
  if (dossie.relatorio) {
    const rel = dossie.relatorio;

    for (const cit of rel.citacoes) {
      const ev = evidenciasPorId.get(cit.evidenciaId);
      if (!ev) {
        oc.push(
          emitir(
            'CITACAO_NAO_SUSTENTA',
            `O relatório v${rel.versao} cita uma evidência inexistente (${cit.evidenciaId}).`,
            'relatorio',
            rel.id,
          ),
        );
        continue;
      }
      if (!cit.localizador?.trim()) {
        oc.push(
          emitir(
            'CITACAO_NAO_SUSTENTA',
            `O relatório v${rel.versao} cita a evidência ${ev.identificador} sem localizador.`,
            'relatorio',
            rel.id,
          ),
        );
      }
      if (cit.fatoId && !fatosPorId.has(cit.fatoId)) {
        oc.push(
          emitir(
            'CITACAO_NAO_SUSTENTA',
            `O relatório v${rel.versao} cita um registro de fato inexistente (${cit.fatoId}).`,
            'relatorio',
            rel.id,
          ),
        );
      }
    }

    const reais = {
      fatos: dossie.fatos.filter((f) => f.estadoVerificacao === 'corroborado').length,
      fatores: confirmados.length,
      causasSistemicas: confirmados.filter((c) => c.natureza === 'causa_sistemica').length,
      recomendacoes: dossie.recomendacoes.filter((r) => r.status !== 'cancelada').length,
    };
    const declaradas = rel.contagensDeclaradas;
    if (declaradas) {
      for (const chave of Object.keys(reais) as (keyof typeof reais)[]) {
        const decl = declaradas[chave];
        if (decl !== undefined && decl !== reais[chave]) {
          oc.push(
            emitir(
              'CONTAGEM_DIVERGENTE',
              `O relatório declara ${decl} para "${chave}" mas os registros somam ${reais[chave]}.`,
              'relatorio',
              rel.id,
              { chave, declarado: decl, real: reais[chave] },
            ),
          );
        }
      }
    }

    if (rel.resumoExecutivo) {
      const culpa = contemTermo(rel.resumoExecutivo, TERMOS_CULPABILIZADORES);
      if (culpa.length > 0) {
        oc.push(
          emitir(
            'LINGUAGEM_CULPABILIZADORA',
            `O resumo executivo usa linguagem culpabilizadora: ${culpa.join(', ')}.`,
            'relatorio',
            rel.id,
            { termos: culpa },
          ),
        );
      }
    }

    const divergentes = dossie.comentarios.filter((c) => c.tipo === 'opiniao_divergente');
    if (divergentes.length > 0) {
      const textoRelatorio = normalizar(rel.resumoExecutivo ?? '');
      const omitidas = divergentes.filter(
        (d) => !textoRelatorio.includes(normalizar(d.texto).slice(0, 40)),
      );
      if (omitidas.length > 0) {
        oc.push(
          emitir(
            'OPINIAO_DIVERGENTE_OMITIDA',
            `Existem ${omitidas.length} opinião(ões) divergente(s) registrada(s) que não aparecem no relatório.`,
            'relatorio',
            rel.id,
          ),
        );
      }
    }

    if (rel.status === 'publicado') {
      const obrigatorias = ['conclusoes', 'recomendacoes', 'publicacao_relatorio'];
      const faltando = obrigatorias.filter(
        (t) => !dossie.aprovacoes.some((a) => a.tipo === t && a.decisao === 'aprovado'),
      );
      if (faltando.length > 0) {
        oc.push(
          emitir(
            'PUBLICACAO_SEM_APROVACAO',
            `Relatório publicado sem as aprovações obrigatórias: ${faltando.join(', ')}.`,
            'relatorio',
            rel.id,
          ),
        );
      }
    }
  }

  const bloqueios = oc.filter((o) => o.severidade === 'bloqueio').length;
  const alertas = oc.filter((o) => o.severidade === 'alerta').length;
  const informativos = oc.filter((o) => o.severidade === 'informativo').length;

  return {
    investigacaoId: dossie.investigacaoId,
    ocorrencias: oc,
    bloqueios,
    alertas,
    informativos,
    podePublicar: bloqueios === 0,
  };
}

/**
 * Reconciliação de contagens (seção 13.12): números que o relatório pode
 * declarar, calculados a partir dos registros.
 */
export function reconciliarContagens(dossie: Dossie) {
  const confirmados = dossie.classificacoes.filter((c) => c.estado === 'confirmado');
  return {
    evidencias: dossie.evidencias.length,
    fatos: dossie.fatos.filter((f) => f.estadoVerificacao === 'corroborado').length,
    fatosTotais: dossie.fatos.length,
    fatores: confirmados.length,
    fatoresContribuintes: confirmados.filter((c) => c.natureza === 'fator_contribuinte').length,
    causasSistemicas: confirmados.filter((c) => c.natureza === 'causa_sistemica').length,
    oportunidadesNaoCausais: confirmados.filter(
      (c) => c.natureza === 'oportunidade_melhoria_nao_causal',
    ).length,
    recomendacoes: dossie.recomendacoes.filter((r) => r.status !== 'cancelada').length,
    conflitosAbertos: dossie.conflitos.filter((c) => c.status !== 'resolvido').length,
    lacunasAbertas: dossie.lacunas.filter((l) => l.status === 'aberta').length,
    porColuna: {
      defesas: confirmados.filter((c) => c.coluna === 'defesas').length,
      acoes: confirmados.filter((c) => c.coluna === 'acoes').length,
      condicoes_tarefa_ambiente: confirmados.filter(
        (c) => c.coluna === 'condicoes_tarefa_ambiente',
      ).length,
      fatores_humanos: confirmados.filter((c) => c.coluna === 'fatores_humanos').length,
      fatores_organizacionais: confirmados.filter((c) => c.coluna === 'fatores_organizacionais')
        .length,
    },
  };
}
