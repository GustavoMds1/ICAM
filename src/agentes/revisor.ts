import type { Dossie } from '../domain/dossie';
import { verificarQualidade } from '../domain/qualidade/verificar';
import { TERMOS_CULPABILIZADORES } from '../domain/qualidade/regras';
import { normalizar } from '../domain/taxonomia/catalogo';
import { conferirCoerenciaContrafactual, montarMapaCausal } from '../domain/causal/grafo';
import { redigirPII } from '../seguranca/redacao';
import { respostaRevisor, type RespostaRevisor } from './contratos';
import type { DefinicaoAgente } from './nucleo';

/**
 * Agente 10 — Revisor de qualidade, segurança e não culpabilização.
 *
 * É o último portão antes da revisão humana. Não aprova nada: apenas reúne
 * bloqueios, alertas e sinalizações de privacidade em um único parecer, com
 * sugestões de reescrita para linguagem culpabilizadora.
 */

export interface EntradaRevisor {
  dossie: Dossie;
  textosLivres: { origem: string; texto: string }[];
}

/** Reescritas orientadas a sistema para termos que encerram a análise na pessoa. */
const SUGESTOES_REESCRITA: Record<string, string> = {
  negligencia: 'descreva a condição da tarefa e a expectativa de trabalho vigente no momento',
  negligente: 'descreva o que a pessoa sabia, tinha disponível e era esperado dela',
  imprudencia: 'descreva o objetivo perseguido e os controles disponíveis na situação',
  descuido: 'descreva a demanda de atenção da tarefa e os sinais disponíveis para detecção',
  desatencao: 'descreva a carga de tarefas simultâneas e os mecanismos de detecção existentes',
  'falta de atencao': 'descreva quais sinais existiam, quão perceptíveis eram e o que competia por atenção',
  'nao seguiu o procedimento': 'descreva a diferença entre o procedimento prescrito e o trabalho como realizado, e por que a diferença existia',
  'descumpriu o procedimento': 'descreva a disponibilidade, a adequação e a exequibilidade do procedimento na tarefa real',
  'erro humano': 'descreva a ação específica, as condições que a tornaram provável e as defesas que deveriam tê-la interceptado',
  'falha humana': 'descreva a ação específica e as barreiras do sistema que não atuaram',
  culpa: 'descreva o fator e o mecanismo, sem atribuição de responsabilidade pessoal',
  culpado: 'descreva o fator e o mecanismo, sem atribuição de responsabilidade pessoal',
  complacencia: 'descreva a percepção de risco disponível, a frequência da exposição e o reforço organizacional dessa prática',
  displicencia: 'descreva as condições e prioridades que moldaram a decisão observada',
  irresponsabilidade: 'descreva o contexto de decisão e os controles de gestão aplicáveis',
  impericia: 'descreva o treinamento recebido, a experiência na tarefa e o suporte disponível',
};

export const agenteRevisor: DefinicaoAgente<EntradaRevisor, RespostaRevisor> = {
  nome: 'revisor',
  esquemaSaida: respostaRevisor,

  instrucao: [
    'Você é o agente revisor de qualidade, segurança e não culpabilização.',
    'Aponte bloqueios metodológicos, linguagem culpabilizadora e exposição de dado sensível.',
    'Nunca aprove conteúdo: seu parecer sempre vai para revisão humana.',
  ].join('\n'),

  formatoEsperado: [
    '{ "aprovadoParaRevisaoHumana": false,',
    '  "bloqueios": [{"regra":"...","mensagem":"...","entidadeId":null}],',
    '  "alertas": [{"regra":"...","mensagem":"...","entidadeId":null}],',
    '  "linguagemCulpabilizadora": [{"trecho":"...","sugestao":"..."}],',
    '  "dadosSensiveisDetectados": ["..."], "observacoes": ["..."] }',
  ].join('\n'),

  montarTarefa(e) {
    return `Revise a investigação ${e.dossie.codigo} na fase "${e.dossie.fase}" e ${e.textosLivres.length} texto(s) livre(s).`;
  },

  heuristica(entrada) {
    const relatorio = verificarQualidade(entrada.dossie);

    const bloqueios = relatorio.ocorrencias
      .filter((o) => o.severidade === 'bloqueio')
      .map((o) => ({ regra: o.regra, mensagem: o.mensagem, entidadeId: o.entidadeId }));
    const alertas = relatorio.ocorrencias
      .filter((o) => o.severidade !== 'bloqueio')
      .map((o) => ({ regra: o.regra, mensagem: o.mensagem, entidadeId: o.entidadeId }));

    // Linguagem culpabilizadora nos textos livres.
    const linguagem: RespostaRevisor['linguagemCulpabilizadora'] = [];
    for (const t of entrada.textosLivres) {
      const alvo = normalizar(t.texto);
      for (const termo of TERMOS_CULPABILIZADORES) {
        const termoNorm = normalizar(termo);
        if (!alvo.includes(termoNorm)) continue;
        linguagem.push({
          trecho: `[${t.origem}] …${recortarEmTorno(t.texto, termo)}…`,
          sugestao:
            SUGESTOES_REESCRITA[termoNorm] ??
            'Descreva a condição e o mecanismo em vez de qualificar a pessoa.',
        });
      }
    }

    // Dados pessoais em texto livre.
    const sensiveis: string[] = [];
    for (const t of entrada.textosLivres) {
      const r = redigirPII(t.texto);
      if (r.houveRedacao) {
        sensiveis.push(
          `[${t.origem}] ${r.ocorrencias.map((o) => `${o.quantidade}× ${o.padrao}`).join(', ')}. ` +
            'Relatórios executivos devem usar função ou pseudônimo.',
        );
      }
    }

    // Coerência do mapa causal e do teste contrafactual.
    const mapa = montarMapaCausal(entrada.dossie);
    const observacoes = [...mapa.avisos];
    for (const c of entrada.dossie.classificacoes.filter((x) => x.estado === 'confirmado')) {
      observacoes.push(...conferirCoerenciaContrafactual(c));
    }
    observacoes.push(
      `Verificadores executados: ${relatorio.ocorrencias.length} ocorrência(s) — ${relatorio.bloqueios} bloqueio(s), ${relatorio.alertas} alerta(s).`,
    );

    return {
      aprovadoParaRevisaoHumana: bloqueios.length === 0 && linguagem.length === 0,
      bloqueios,
      alertas,
      linguagemCulpabilizadora: linguagem,
      dadosSensiveisDetectados: sensiveis,
      observacoes,
    };
  },
};

function recortarEmTorno(texto: string, termo: string, janela = 45): string {
  const idx = normalizar(texto).indexOf(normalizar(termo));
  if (idx < 0) return texto.slice(0, janela * 2);
  const inicio = Math.max(0, idx - janela);
  const fim = Math.min(texto.length, idx + termo.length + janela);
  return texto.slice(inicio, fim).replace(/\s+/g, ' ');
}
