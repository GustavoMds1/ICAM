import { createHash, randomUUID } from 'node:crypto';
import {
  agenteCausalidade,
  agenteClassificador,
  agenteFatos,
  agentePeepo,
  agenteRecomendacoes,
  agenteTemporal,
  executarAgente,
} from '../agentes';
import type { RegistroExecucao } from '../agentes/contratos';
import type { ProvedorIa } from '../agentes/provedor';
import type {
  DossieClassificacao,
  DossieEvento,
  DossieEvidencia,
  DossieFato,
  DossieItemPeepo,
  DossieLacuna,
  DossieRecomendacao,
  DossieRelacaoCausal,
} from '../domain/dossie';
import type { DimensaoPeepo, PrecisaoTemporal } from '../domain/enumeracoes';
import type { EventoBruto, FonteTemporalRef } from '../domain/tempo/normalizacao';
import type { InvestigacaoCompleta } from './repositorio';

/**
 * Rascunho assistido: do relato inicial às propostas de análise.
 *
 * O que este módulo faz e o que deliberadamente NÃO faz:
 *
 *   - Encadeia os agentes na ordem da metodologia — fatos, cronologia,
 *     classificação ICAM, causalidade, recomendações, perguntas PEEPO — e
 *     grava tudo como PROPOSTA.
 *   - Nada entra aprovado. Fato nasce com `aprovadoPorHumano: false` e
 *     classificação com `decisaoHumana: 'pendente'`. A investigação só avança
 *     quando alguém decide item a item.
 *   - Nunca altera nem apaga item já decidido por humano. Rodar de novo só
 *     acrescenta o que ainda não existe.
 *   - Falha de um agente não derruba o rascunho: o passo é pulado, o motivo
 *     vira aviso e a execução fica registrada na trilha.
 *
 * O relato inicial é registrado como evidência (EV-000) antes de qualquer
 * extração. Sem isso, os fatos não teriam o que citar — e fato sem citação
 * verificável é exatamente o que a plataforma existe para impedir.
 */

export interface OpcoesRascunho {
  /**
   * Teto de chamadas ao classificador. Cada fato vira uma chamada ao provedor;
   * sem teto, um relato longo produziria dezenas de requisições pagas.
   */
  maxClassificacoes?: number;
}

export interface ResumoRascunho {
  evidenciaRelato: boolean;
  fatos: number;
  eventos: number;
  classificacoes: number;
  relacoes: number;
  recomendacoes: number;
  diligencias: number;
  lacunas: number;
}

export interface ResultadoRascunho {
  investigacao: InvestigacaoCompleta;
  registros: RegistroExecucao[];
  resumo: ResumoRascunho;
  avisos: string[];
}

const ID_EVIDENCIA_RELATO = 'ev-relato-inicial';
const ID_FONTE_TEMPORAL = 'ft-relato-inicial';

/** Tipos de asserção que não vale classificar: não descrevem achado verificável. */
const NAO_CLASSIFICAVEIS = new Set(['lacuna_informacao', 'hipotese', 'informacao_refutada']);

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
}

function identificador(prefixo: string, quantidadeExistente: number, indice: number): string {
  return `${prefixo}-${String(quantidadeExistente + indice + 1).padStart(3, '0')}`;
}

/**
 * Divide o relato em trechos citáveis.
 *
 * Parágrafo é a unidade: é o que a pessoa consegue localizar de volta no texto
 * quando for conferir a citação. Se o relato vier em bloco único, cada frase
 * longa vira um trecho, para que a citação não aponte o documento inteiro.
 */
export function dividirRelato(relato: string): { localizador: string; texto: string }[] {
  const porParagrafo = relato
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const partes =
    porParagrafo.length > 1
      ? porParagrafo
      : relato
          .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/)
          .map((f) => f.trim())
          .filter((f) => f.length > 0);

  const efetivas = partes.length > 0 ? partes : [relato.trim()];
  return efetivas.map((texto, i) => ({ localizador: `p${i + 1}`, texto }));
}

/**
 * Localiza expressões de horário no relato e monta eventos brutos.
 *
 * A extração é explícita e conservadora de propósito: só vira evento o trecho
 * que traz hora reconhecível. O agente temporal normaliza o que recebe, não
 * adivinha cronologia em prosa — e é melhor uma linha do tempo curta e correta
 * do que uma inventada.
 */
export function extrairEventosBrutos(
  trechos: { localizador: string; texto: string }[],
  dataReferencia: Date | null,
): EventoBruto[] {
  const eventos: EventoBruto[] = [];

  for (const trecho of trechos) {
    const horario = /\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)\b/.exec(trecho.texto);
    if (!horario) continue;

    let instanteBruto: Date | null = null;
    if (dataReferencia) {
      const data = new Date(dataReferencia);
      data.setHours(Number(horario[1]), Number(horario[2]), 0, 0);
      instanteBruto = data;
    }

    eventos.push({
      id: `ev-bruto-${trecho.localizador}`,
      titulo: trecho.texto.slice(0, 160),
      fonteTemporalId: ID_FONTE_TEMPORAL,
      instanteBruto,
      // Sem data de referência, o horário isolado não vira instante: fica
      // registrado como aproximado para não simular precisão que não existe.
      precisao: instanteBruto ? 'aproximado' : 'desconhecido',
      ordemRelativa: eventos.length + 1,
    });
  }

  return eventos;
}

function evidenciaDoRelato(investigacao: InvestigacaoCompleta, trechos: { localizador: string }[]): DossieEvidencia {
  return {
    id: ID_EVIDENCIA_RELATO,
    identificador: 'EV-000',
    titulo: 'Relato da notificação inicial',
    categoria: 'relato_inicial',
    // Hash do texto: se o relato for editado depois, a citação deixa de bater
    // com a evidência e isso fica detectável.
    hashOriginal: createHash('sha256').update(investigacao.metadados.descricaoInicial).digest('hex'),
    confidencialidade: investigacao.metadados.confidencialidade,
    contemDadoSensivel: false,
    autenticidadeAvaliada: 'declarada_pelo_notificante',
    localizadoresValidos: trechos.map((t) => t.localizador),
  };
}

export async function montarRascunho(
  investigacao: InvestigacaoCompleta,
  provedor: ProvedorIa | null,
  opcoes: OpcoesRascunho = {},
): Promise<ResultadoRascunho> {
  const maxClassificacoes = opcoes.maxClassificacoes ?? 6;
  const registros: RegistroExecucao[] = [];
  const avisos: string[] = [];
  const investigacaoId = investigacao.investigacaoId;

  const relato = investigacao.metadados.descricaoInicial.trim();
  if (relato.length === 0) {
    return {
      investigacao,
      registros,
      resumo: {
        evidenciaRelato: false,
        fatos: 0,
        eventos: 0,
        classificacoes: 0,
        relacoes: 0,
        recomendacoes: 0,
        diligencias: 0,
        lacunas: 0,
      },
      avisos: ['A investigação não tem relato inicial. Sem texto não há o que analisar.'],
    };
  }

  const trechos = dividirRelato(relato);

  // --- Evidência do relato -------------------------------------------------
  let evidencias = [...investigacao.evidencias];
  const jaTinhaEvidencia = evidencias.some((e) => e.id === ID_EVIDENCIA_RELATO);
  const evidencia = evidenciaDoRelato(investigacao, trechos);
  if (jaTinhaEvidencia) {
    // Só os localizadores são atualizados: título, hash e classificação da
    // evidência podem ter sido corrigidos por alguém, e sobrescrever isso
    // apagaria trabalho humano.
    evidencias = evidencias.map((e) =>
      e.id === ID_EVIDENCIA_RELATO
        ? { ...e, localizadoresValidos: evidencia.localizadoresValidos }
        : e,
    );
  } else {
    evidencias.unshift(evidencia);
  }

  // --- Agente de fatos -----------------------------------------------------
  const fatos = [...investigacao.fatos];
  const fatosNovos: DossieFato[] = [];
  const proposicoesExistentes = new Set(fatos.map((f) => normalizar(f.proposicao)));

  try {
    const r = await executarAgente(
      agenteFatos,
      {
        agente: 'fatos',
        investigacaoId,
        dados: {
          trechos: trechos.map((t) => ({
            evidenciaId: ID_EVIDENCIA_RELATO,
            categoriaEvidencia: 'relato_inicial',
            localizador: t.localizador,
            texto: t.texto,
          })),
        },
        fontes: trechos.map((t) => ({ rotulo: `${ID_EVIDENCIA_RELATO}#${t.localizador}`, conteudo: t.texto })),
      },
      provedor,
    );
    registros.push(r.registro);
    if (r.registro.erro) avisos.push(`Agente de fatos: ${r.registro.erro}`);

    for (const candidato of r.saida.candidatos) {
      const chave = normalizar(candidato.proposicao);
      if (proposicoesExistentes.has(chave)) continue;
      proposicoesExistentes.add(chave);

      fatosNovos.push({
        id: randomUUID(),
        identificador: identificador('F', fatos.length, fatosNovos.length),
        proposicao: candidato.proposicao,
        tipoAssercao: candidato.tipoAssercao,
        estadoVerificacao: 'nao_verificado',
        confianca: 'nao_avaliada',
        aprovadoPorHumano: false,
        origemIa: true,
        vinculos: [
          {
            evidenciaId: candidato.citacao.evidenciaId,
            declaracaoId: null,
            sentido: 'favoravel',
            localizador: candidato.citacao.localizador,
            trecho: candidato.citacao.trecho,
            peso: 'medio',
          },
        ],
      });
    }

    for (const diligencia of r.saida.proximas_diligencias) avisos.push(`Diligência sugerida: ${diligencia}`);
  } catch (e) {
    avisos.push(`Extração de fatos não produziu saída válida: ${(e as Error).message}`);
  }

  const fatosFinais = [...fatos, ...fatosNovos];

  // --- Agente temporal -----------------------------------------------------
  const eventos = [...investigacao.eventos];
  const eventosNovos: DossieEvento[] = [];
  const dataReferencia = investigacao.metadados.ocorridoEm
    ? new Date(investigacao.metadados.ocorridoEm)
    : null;
  const eventosBrutos = extrairEventosBrutos(trechos, dataReferencia);

  const fontesTemporais = [...investigacao.fontesTemporais];
  if (eventosBrutos.length > 0 && !fontesTemporais.some((f) => f.id === ID_FONTE_TEMPORAL)) {
    fontesTemporais.push({
      id: ID_FONTE_TEMPORAL,
      nome: 'Relato da notificação inicial',
      desvioSegundos: null,
      confiabilidade: 'nao_avaliada',
    });
  }

  if (eventosBrutos.length > 0) {
    try {
      const fontes: FonteTemporalRef[] = fontesTemporais.map((f) => ({
        id: f.id,
        nome: f.nome,
        desvioSegundos: f.desvioSegundos,
        confiabilidade: f.confiabilidade,
      }));
      const r = await executarAgente(
        agenteTemporal,
        { agente: 'temporal', investigacaoId, dados: { fontes, eventos: eventosBrutos } },
        provedor,
      );
      registros.push(r.registro);
      if (r.registro.erro) avisos.push(`Agente temporal: ${r.registro.erro}`);

      const titulosExistentes = new Set(eventos.map((e) => normalizar(e.titulo)));
      for (const evento of r.saida.eventos) {
        if (titulosExistentes.has(normalizar(evento.titulo))) continue;
        titulosExistentes.add(normalizar(evento.titulo));
        eventosNovos.push({
          id: randomUUID(),
          titulo: evento.titulo,
          instanteNormalizado: evento.instanteNormalizado,
          precisao: evento.precisao as PrecisaoTemporal,
          fonteTemporalId: ID_FONTE_TEMPORAL,
          conflitoTemporal: evento.avisos.length > 0,
        });
      }
    } catch (e) {
      avisos.push(`Normalização temporal não produziu saída válida: ${(e as Error).message}`);
    }
  }

  // --- Agente classificador ------------------------------------------------
  const classificacoes = [...investigacao.classificacoes];
  const classificacoesNovas: DossieClassificacao[] = [];
  const chavesExistentes = new Set(
    classificacoes.map((c) => `${c.codigo}|${normalizar(c.descricaoContextual)}`),
  );

  const candidatosClassificaveis = fatosNovos
    .filter((f) => !NAO_CLASSIFICAVEIS.has(f.tipoAssercao))
    .slice(0, maxClassificacoes);

  for (const fato of candidatosClassificaveis) {
    try {
      const r = await executarAgente(
        agenteClassificador,
        {
          agente: 'classificador',
          investigacaoId,
          dados: {
            descricao: fato.proposicao,
            mecanismo: null,
            evidencias: [{ tipo: 'fato' as const, id: fato.id }],
          },
        },
        provedor,
      );
      registros.push(r.registro);

      const melhor = r.saida.alternativas[0];
      if (!melhor) continue;

      const chave = `${melhor.codigo}|${normalizar(fato.proposicao)}`;
      if (chavesExistentes.has(chave)) continue;
      chavesExistentes.add(chave);

      classificacoesNovas.push({
        id: randomUUID(),
        identificador: identificador('C', classificacoes.length, classificacoesNovas.length),
        codigo: melhor.codigo,
        coluna: melhor.coluna,
        descricaoContextual: fato.proposicao,
        mecanismo: melhor.mecanismo,
        estado: 'candidato',
        // A natureza — fator contribuinte, causa sistêmica, melhoria não causal
        // — é decisão de análise humana. A IA não a preenche.
        natureza: 'nao_definida',
        confianca: melhor.confianca,
        estadoBarreira: null,
        justificativaBarreira: null,
        contrafactualResposta: null,
        origemIa: true,
        decisaoHumana: 'pendente',
        justificativaGenerico: null,
        sustentacoes: [{ fatoId: fato.id, sentido: 'favoravel', peso: 'medio' }],
        // As alternativas descartadas ficam registradas: é o que permite
        // discordar da escolha sem refazer a análise do zero.
        codigosSecundarios: r.saida.alternativas.slice(1, 3).map((a) => ({
          codigo: a.codigo,
          justificativa: a.motivoNaoEscolherProximos,
        })),
      });
    } catch (e) {
      avisos.push(`Classificação de "${fato.identificador}" descartada: ${(e as Error).message}`);
    }
  }

  const classificacoesFinais = [...classificacoes, ...classificacoesNovas];

  // --- Agente de causalidade ----------------------------------------------
  const relacoes = [...investigacao.relacoesCausais];
  const relacoesNovas: DossieRelacaoCausal[] = [];

  if (classificacoesFinais.length >= 2) {
    try {
      const r = await executarAgente(
        agenteCausalidade,
        {
          agente: 'causalidade',
          investigacaoId,
          dados: {
            fatores: classificacoesFinais,
            relacoesExistentes: relacoes.map((x) => ({ origemId: x.origemId, destinoId: x.destinoId })),
          },
        },
        provedor,
      );
      registros.push(r.registro);
      if (r.registro.erro) avisos.push(`Agente de causalidade: ${r.registro.erro}`);

      const paresExistentes = new Set(relacoes.map((x) => `${x.origemId}->${x.destinoId}`));
      for (const relacao of r.saida.relacoes) {
        const par = `${relacao.origemId}->${relacao.destinoId}`;
        if (paresExistentes.has(par)) continue;
        paresExistentes.add(par);
        relacoesNovas.push({
          id: randomUUID(),
          origemId: relacao.origemId,
          destinoId: relacao.destinoId,
          tipo: relacao.tipo,
          afirmacaoTestavel: relacao.afirmacaoTestavel,
          grauSustentacao: relacao.grauSustentacao,
        });
      }
    } catch (e) {
      avisos.push(`Mapa causal não produziu saída válida: ${(e as Error).message}`);
    }
  }

  // --- Agente de recomendações --------------------------------------------
  const recomendacoes = [...investigacao.recomendacoes];
  const recomendacoesNovas: DossieRecomendacao[] = [];

  if (classificacoesFinais.length > 0) {
    try {
      const r = await executarAgente(
        agenteRecomendacoes,
        {
          agente: 'recomendacoes',
          investigacaoId,
          dados: {
            fatores: classificacoesFinais.map((c) => ({
              classificacaoId: c.id,
              identificador: c.identificador,
              codigo: c.codigo,
              descricaoContextual: c.descricaoContextual,
              mecanismo: c.mecanismo,
              natureza: c.natureza,
              estadoBarreira: c.estadoBarreira,
            })),
            hierarquiasExistentes: recomendacoes.map((x) => x.hierarquiaControle),
          },
        },
        provedor,
      );
      registros.push(r.registro);
      if (r.registro.erro) avisos.push(`Agente de recomendações: ${r.registro.erro}`);

      const acoesExistentes = new Set(recomendacoes.map((x) => normalizar(x.acaoProposta)));
      for (const proposta of r.saida.propostas) {
        if (acoesExistentes.has(normalizar(proposta.acaoProposta))) continue;
        acoesExistentes.add(normalizar(proposta.acaoProposta));
        recomendacoesNovas.push({
          id: randomUUID(),
          identificador: identificador('R', recomendacoes.length, recomendacoesNovas.length),
          acaoProposta: proposta.acaoProposta,
          objetivo: proposta.objetivo,
          hierarquiaControle: proposta.hierarquiaControle,
          justificativaHierarquia: proposta.justificativaHierarquia,
          alternativasSuperioresAvaliadas: proposta.alternativasSuperioresAvaliadas,
          responsavel: null,
          prazo: null,
          riscoResidual: proposta.riscoResidualEsperado,
          status: 'proposta',
          jaTratadaPorId: null,
          classificacaoIds: proposta.classificacaoIds,
          indicadores: [
            {
              id: randomUUID(),
              nome: proposta.indicadorSugerido.nome,
              meta: proposta.indicadorSugerido.meta,
              metodoMedicao: proposta.indicadorSugerido.metodoMedicao,
              linhaBase: null,
              dataVerificacao: null,
            },
          ],
        });
      }
    } catch (e) {
      avisos.push(`Plano de ação não produziu saída válida: ${(e as Error).message}`);
    }
  }

  // --- Agente PEEPO: perguntas de coleta ----------------------------------
  const itensPeepo = [...investigacao.itensPeepo];
  const itensPeepoNovos: DossieItemPeepo[] = [];
  const lacunas = [...investigacao.lacunas];
  const lacunasNovas: DossieLacuna[] = [];

  try {
    const r = await executarAgente(
      agentePeepo,
      {
        agente: 'peepo',
        investigacaoId,
        dados: {
          descricaoEvento: relato,
          itensExistentes: itensPeepo.map((i) => ({ dimensao: i.dimensao, status: i.status })),
          lacunas: lacunas.map((l) => ({ id: l.id, descricao: l.descricao, criticidade: l.criticidade })),
          hipoteses: [],
          conflitos: investigacao.conflitos.map((c) => ({ id: c.id, titulo: c.titulo, status: c.status })),
        },
      },
      provedor,
    );
    registros.push(r.registro);
    if (r.registro.erro) avisos.push(`Agente PEEPO: ${r.registro.erro}`);

    const perguntasExistentes = new Set(itensPeepo.map((i) => normalizar(i.perguntaInvestigativa)));
    for (const item of r.saida.itens) {
      if (perguntasExistentes.has(normalizar(item.perguntaInvestigativa))) continue;
      perguntasExistentes.add(normalizar(item.perguntaInvestigativa));
      itensPeepoNovos.push({
        id: randomUUID(),
        dimensao: item.dimensao as DimensaoPeepo,
        perguntaInvestigativa: item.perguntaInvestigativa,
        status: 'aberto',
        responsavel: null,
        prazo: null,
      });
    }

    // O que o relato não responde vira lacuna registrada, não suposição.
    const descricoesExistentes = new Set(lacunas.map((l) => normalizar(l.descricao)));
    for (const diligencia of r.saida.proximas_diligencias) {
      if (descricoesExistentes.has(normalizar(diligencia))) continue;
      descricoesExistentes.add(normalizar(diligencia));
      lacunasNovas.push({
        id: randomUUID(),
        identificador: identificador('L', lacunas.length, lacunasNovas.length),
        descricao: diligencia,
        criticidade: 'media',
        status: 'aberta',
      });
    }
  } catch (e) {
    avisos.push(`Perguntas de coleta não produziram saída válida: ${(e as Error).message}`);
  }

  const atualizada: InvestigacaoCompleta = {
    ...investigacao,
    // Há material de análise na mesa: manter a investigação em "notificação"
    // esconderia isso do portfólio. Fases seguintes continuam sendo decisão
    // humana.
    fase: investigacao.fase === 'notificacao' ? 'analise' : investigacao.fase,
    evidencias,
    fatos: fatosFinais,
    eventos: [...eventos, ...eventosNovos],
    fontesTemporais,
    classificacoes: classificacoesFinais,
    relacoesCausais: [...relacoes, ...relacoesNovas],
    recomendacoes: [...recomendacoes, ...recomendacoesNovas],
    itensPeepo: [...itensPeepo, ...itensPeepoNovos],
    lacunas: [...lacunas, ...lacunasNovas],
  };

  return {
    investigacao: atualizada,
    registros,
    resumo: {
      evidenciaRelato: !jaTinhaEvidencia,
      fatos: fatosNovos.length,
      eventos: eventosNovos.length,
      classificacoes: classificacoesNovas.length,
      relacoes: relacoesNovas.length,
      recomendacoes: recomendacoesNovas.length,
      diligencias: itensPeepoNovos.length,
      lacunas: lacunasNovas.length,
    },
    avisos,
  };
}
