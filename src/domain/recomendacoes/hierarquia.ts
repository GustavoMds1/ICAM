import {
  CONTROLES_FRACOS,
  FORCA_CONTROLE,
  HIERARQUIA_CONTROLE,
  ROTULOS_HIERARQUIA,
  type HierarquiaControle,
} from '../enumeracoes';

/**
 * Hierarquia de controles (seção 4.9).
 *
 * O sistema não decide a hierarquia pelo investigador — ele exige que a
 * escolha seja justificada e desafia planos dominados por controles fracos.
 */

export interface DesafioHierarquia {
  nivel: 'exigencia' | 'sugestao';
  mensagem: string;
  perguntasObrigatorias: string[];
}

export const DESCRICOES_HIERARQUIA: Record<HierarquiaControle, string> = {
  eliminacao: 'Remove fisicamente o perigo ou a tarefa que expõe a pessoa a ele.',
  substituicao: 'Troca o material, equipamento ou processo por outro de menor energia/risco.',
  engenharia:
    'Isola a pessoa do perigo por projeto: intertravamento, barreira física, automação, redundância.',
  administrativa:
    'Muda a forma de trabalhar por procedimento, treinamento, sinalização ou supervisão.',
  epi: 'Protege a pessoa no ponto de exposição; depende de uso correto e contínuo.',
};

export function forca(nivel: HierarquiaControle): number {
  return FORCA_CONTROLE[nivel];
}

export function ehControleFraco(nivel: HierarquiaControle): boolean {
  return CONTROLES_FRACOS.includes(nivel);
}

export function niveisSuperioresA(nivel: HierarquiaControle): HierarquiaControle[] {
  return HIERARQUIA_CONTROLE.filter((n) => FORCA_CONTROLE[n] > FORCA_CONTROLE[nivel]);
}

/**
 * Desafia a escolha de um controle fraco. Nunca bloqueia por si: obriga o
 * investigador a registrar por que os controles superiores foram descartados.
 */
export function desafiarEscolha(
  nivel: HierarquiaControle,
  alternativasAvaliadas: string | null,
): DesafioHierarquia | null {
  if (!ehControleFraco(nivel)) return null;
  if (alternativasAvaliadas && alternativasAvaliadas.trim().length >= 20) return null;

  const superiores = niveisSuperioresA(nivel);
  return {
    nivel: 'exigencia',
    mensagem:
      `A ação foi classificada como controle ${ROTULOS_HIERARQUIA[nivel].toLowerCase()}, que depende do comportamento humano para funcionar. ` +
      'Registre por que os controles mais fortes não são viáveis antes de fechar o plano.',
    perguntasObrigatorias: superiores.map(
      (s) => `${ROTULOS_HIERARQUIA[s]}: ${DESCRICOES_HIERARQUIA[s]} Por que não se aplica aqui?`,
    ),
  };
}

export interface PerfilPlano {
  total: number;
  porNivel: Record<HierarquiaControle, number>;
  proporcaoFraca: number;
  forcaMedia: number;
  equilibrado: boolean;
  observacao: string;
}

/**
 * Perfil do plano de ação. Usado pelo agente de recomendações e pelo
 * verificador EXCESSO_CONTROLES_FRACOS.
 */
export function perfilarPlano(
  niveis: readonly HierarquiaControle[],
): PerfilPlano {
  const porNivel = Object.fromEntries(
    HIERARQUIA_CONTROLE.map((n) => [n, niveis.filter((x) => x === n).length]),
  ) as Record<HierarquiaControle, number>;

  const total = niveis.length;
  if (total === 0) {
    return {
      total: 0,
      porNivel,
      proporcaoFraca: 0,
      forcaMedia: 0,
      equilibrado: false,
      observacao: 'Plano de ação vazio.',
    };
  }

  const fracas = niveis.filter(ehControleFraco).length;
  const proporcaoFraca = fracas / total;
  const forcaMedia = niveis.reduce((acc, n) => acc + FORCA_CONTROLE[n], 0) / total;
  const equilibrado = proporcaoFraca <= 0.7;

  const observacao = equilibrado
    ? `Plano com ${total} ação(ões); ${Math.round(proporcaoFraca * 100)}% dependem de controles administrativos ou EPI.`
    : `Plano predominantemente administrativo: ${fracas} de ${total} ações (${Math.round(proporcaoFraca * 100)}%) dependem de comportamento humano. ` +
      'Avalie explicitamente eliminação, substituição e engenharia para os fatores de maior energia.';

  return { total, porNivel, proporcaoFraca, forcaMedia, equilibrado, observacao };
}
