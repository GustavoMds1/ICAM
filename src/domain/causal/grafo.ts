import type { Dossie, DossieClassificacao, DossieRelacaoCausal } from '../dossie';
import {
  COLUNAS_ICAM,
  RELACOES_NAO_CAUSAIS,
  ROTULOS_COLUNA_ICAM,
  type ColunaIcam,
} from '../enumeracoes';

/**
 * Mapa causal ICAM: quatro colunas, ligações testáveis e teste contrafactual.
 *
 * O grafo NUNCA infere causalidade sozinho. Ele organiza o que o investigador
 * afirmou, expõe inconsistências estruturais (ciclos, órfãos, colunas vazias)
 * e formula o contrafactual — que é apoio analítico, não prova isolada.
 */

export interface ColunaMapa {
  coluna: ColunaIcam;
  rotulo: string;
  fatores: DossieClassificacao[];
}

export interface MapaCausal {
  colunas: ColunaMapa[];
  relacoes: DossieRelacaoCausal[];
  fatoresOrfaos: string[];
  ciclos: string[][];
  colunasVazias: ColunaIcam[];
  avisos: string[];
}

export function montarMapaCausal(dossie: Dossie): MapaCausal {
  const relevantes = dossie.classificacoes.filter(
    (c) => c.estado === 'confirmado' || c.estado === 'em_analise' || c.estado === 'contestado',
  );

  const colunas: ColunaMapa[] = COLUNAS_ICAM.map((coluna) => ({
    coluna,
    rotulo: ROTULOS_COLUNA_ICAM[coluna],
    fatores: relevantes
      .filter((c) => c.coluna === coluna)
      .sort((a, b) => a.identificador.localeCompare(b.identificador)),
  }));

  const idsRelevantes = new Set(relevantes.map((c) => c.id));
  const relacoes = dossie.relacoesCausais.filter(
    (r) => idsRelevantes.has(r.origemId) && idsRelevantes.has(r.destinoId),
  );

  const conectados = new Set(relacoes.flatMap((r) => [r.origemId, r.destinoId]));
  const fatoresOrfaos = relevantes
    .filter((c) => !conectados.has(c.id) && c.natureza !== 'oportunidade_melhoria_nao_causal')
    .map((c) => c.identificador);

  const colunasVazias = colunas.filter((c) => c.fatores.length === 0).map((c) => c.coluna);

  const avisos: string[] = [];
  if (colunasVazias.includes('fatores_organizacionais')) {
    avisos.push(
      'Nenhum fator organizacional identificado. Verifique decisões, sistemas, recursos, prioridades e aprendizado antes de concluir.',
    );
  }
  if (colunasVazias.includes('defesas')) {
    avisos.push(
      'Nenhuma defesa analisada. Toda investigação ICAM deve examinar quais barreiras deveriam ter atuado.',
    );
  }
  if (fatoresOrfaos.length > 0) {
    avisos.push(
      `${fatoresOrfaos.length} fator(es) sem nenhuma ligação causal declarada: ${fatoresOrfaos.join(', ')}.`,
    );
  }

  const ciclos = detectarCiclos(relevantes, relacoes);
  if (ciclos.length > 0) {
    avisos.push(
      `O mapa contém ${ciclos.length} ciclo(s) causal(is), o que impede leitura de sequência. Revise as ligações.`,
    );
  }

  return { colunas, relacoes, fatoresOrfaos, ciclos, colunasVazias, avisos };
}

function detectarCiclos(
  fatores: readonly DossieClassificacao[],
  relacoes: readonly DossieRelacaoCausal[],
): string[][] {
  const adj = new Map<string, string[]>();
  for (const r of relacoes) {
    if (RELACOES_NAO_CAUSAIS.includes(r.tipo)) continue;
    adj.set(r.origemId, [...(adj.get(r.origemId) ?? []), r.destinoId]);
  }
  const rotulo = new Map(fatores.map((f) => [f.id, f.identificador]));

  const ciclos: string[][] = [];
  const estado = new Map<string, 'branco' | 'cinza' | 'preto'>();
  const pilha: string[] = [];

  function visitar(no: string): void {
    estado.set(no, 'cinza');
    pilha.push(no);
    for (const proximo of adj.get(no) ?? []) {
      const st = estado.get(proximo) ?? 'branco';
      if (st === 'branco') visitar(proximo);
      else if (st === 'cinza') {
        const inicio = pilha.indexOf(proximo);
        if (inicio >= 0) ciclos.push(pilha.slice(inicio).map((id) => rotulo.get(id) ?? id));
      }
    }
    pilha.pop();
    estado.set(no, 'preto');
  }

  for (const f of fatores) if ((estado.get(f.id) ?? 'branco') === 'branco') visitar(f.id);
  return ciclos;
}

// ---------------------------------------------------------------------------
// Teste contrafactual
// ---------------------------------------------------------------------------

export interface Contrafactual {
  classificacaoId: string;
  pergunta: string;
  avisoMetodologico: string;
  opcoes: { valor: string; rotulo: string; leitura: string }[];
}

/**
 * Formula o teste contrafactual da seção 4.8. A resposta é sempre humana; o
 * sistema apenas registra a leitura de cada opção e lembra que o contrafactual
 * isolado não prova causalidade.
 */
export function formularContrafactual(fator: DossieClassificacao): Contrafactual {
  return {
    classificacaoId: fator.id,
    pergunta:
      `Se ${primeiraMinuscula(fator.descricaoContextual)} não existisse, o evento ou sua consequência ainda seria plausível?`,
    avisoMetodologico:
      'O contrafactual é apoio analítico. Uma resposta "improvável" não prova causalidade sozinha, e uma resposta "ainda plausível" não elimina o fator: pode haver múltiplas causas suficientes.',
    opcoes: [
      {
        valor: 'evento_improvavel',
        rotulo: 'O evento seria improvável',
        leitura:
          'Indício de que o fator é necessário na sequência. Confirme com evidência e mecanismo antes de tratá-lo como causa.',
      },
      {
        valor: 'evento_ainda_plausivel',
        rotulo: 'O evento ainda seria plausível',
        leitura:
          'O fator pode ser contribuinte, agravante ou oportunidade de melhoria não causal. Reavalie a natureza atribuída.',
      },
      {
        valor: 'indeterminado',
        rotulo: 'Não é possível determinar',
        leitura:
          'Registre a lacuna de informação e a diligência necessária. Não force uma conclusão.',
      },
    ],
  };
}

function primeiraMinuscula(texto: string): string {
  const t = texto.trim();
  if (t.length === 0) return t;
  return t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, '');
}

/**
 * Coerência entre o contrafactual respondido e a natureza atribuída ao fator.
 * Retorna avisos — nunca altera a classificação automaticamente.
 */
export function conferirCoerenciaContrafactual(fator: DossieClassificacao): string[] {
  const avisos: string[] = [];
  if (!fator.contrafactualResposta) {
    if (fator.natureza === 'causa_sistemica' || fator.natureza === 'fator_contribuinte') {
      avisos.push(
        `O fator ${fator.identificador} foi classificado como ${fator.natureza.replace(/_/g, ' ')} sem teste contrafactual registrado.`,
      );
    }
    return avisos;
  }

  if (
    fator.contrafactualResposta === 'evento_ainda_plausivel' &&
    fator.natureza === 'causa_sistemica'
  ) {
    avisos.push(
      `O fator ${fator.identificador} é tratado como causa sistêmica, mas o contrafactual indica que o evento ainda seria plausível sem ele. ` +
        'Justifique por que ele permanece como causa ou reclassifique.',
    );
  }
  if (
    fator.contrafactualResposta === 'evento_improvavel' &&
    fator.natureza === 'oportunidade_melhoria_nao_causal'
  ) {
    avisos.push(
      `O fator ${fator.identificador} está como oportunidade não causal, mas o contrafactual indica que o evento seria improvável sem ele. ` +
        'Reavalie: pode ser fator contribuinte ou causa.',
    );
  }
  return avisos;
}
