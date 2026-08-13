import type { PrecisaoTemporal } from '../enumeracoes';

/**
 * Normalização temporal (seção 4.6).
 *
 * Princípio: o instante bruto NUNCA é sobrescrito. A correção de desvio de
 * relógio produz um valor derivado (`instanteNormalizado`) e o motivo da
 * correção fica registrado. Divergência entre relógios é achado de
 * investigação, não ruído a ser silenciosamente limpo.
 */

export interface FonteTemporalRef {
  id: string;
  nome: string;
  desvioSegundos: number | null;
  confiabilidade: 'baixa' | 'media' | 'alta' | 'nao_avaliada';
}

export interface EventoBruto {
  id: string;
  titulo: string;
  fonteTemporalId: string | null;
  instanteBruto: Date | null;
  instanteFim?: Date | null;
  precisao: PrecisaoTemporal;
  ordemRelativa?: number | null;
}

export interface EventoNormalizado extends EventoBruto {
  instanteNormalizado: Date | null;
  correcaoAplicadaSegundos: number | null;
  fonteNome: string | null;
  avisos: string[];
}

export function normalizarEvento(
  evento: EventoBruto,
  fontes: readonly FonteTemporalRef[],
): EventoNormalizado {
  const avisos: string[] = [];
  const fonte = fontes.find((f) => f.id === evento.fonteTemporalId) ?? null;

  if (!fonte && evento.instanteBruto) {
    avisos.push('Evento com instante registrado mas sem fonte temporal declarada.');
  }
  if (fonte && fonte.desvioSegundos === null && evento.instanteBruto) {
    avisos.push(
      `Desvio do relógio "${fonte.nome}" não foi verificado; o instante não pôde ser corrigido.`,
    );
  }
  if (fonte && fonte.confiabilidade === 'baixa') {
    avisos.push(`Fonte temporal "${fonte.nome}" tem confiabilidade baixa.`);
  }

  let instanteNormalizado: Date | null = null;
  let correcao: number | null = null;

  if (evento.instanteBruto) {
    if (fonte?.desvioSegundos != null && fonte.desvioSegundos !== 0) {
      correcao = -fonte.desvioSegundos; // relógio adiantado -> subtrai
      instanteNormalizado = new Date(evento.instanteBruto.getTime() + correcao * 1000);
      avisos.push(
        `Correção de ${fonte.desvioSegundos > 0 ? '+' : ''}${fonte.desvioSegundos}s aplicada a partir da fonte "${fonte.nome}".`,
      );
    } else {
      instanteNormalizado = new Date(evento.instanteBruto.getTime());
      correcao = 0;
    }
  }

  return {
    ...evento,
    instanteNormalizado,
    correcaoAplicadaSegundos: correcao,
    fonteNome: fonte?.nome ?? null,
    avisos,
  };
}

export interface DivergenciaRelogio {
  fonteA: string;
  fonteB: string;
  diferencaSegundos: number;
  descricao: string;
}

/**
 * Detecta relógios de sistemas com datas divergentes (seção 13.6).
 * Compara os desvios declarados entre si; qualquer par acima do limite é
 * reportado para diligência humana.
 */
export function detectarDivergenciasDeRelogio(
  fontes: readonly FonteTemporalRef[],
  limiteSegundos = 60,
): DivergenciaRelogio[] {
  const comDesvio = fontes.filter((f) => f.desvioSegundos != null);
  const divergencias: DivergenciaRelogio[] = [];

  for (let i = 0; i < comDesvio.length; i += 1) {
    for (let j = i + 1; j < comDesvio.length; j += 1) {
      const a = comDesvio[i];
      const b = comDesvio[j];
      if (!a || !b) continue;
      const diferenca = (a.desvioSegundos ?? 0) - (b.desvioSegundos ?? 0);
      if (Math.abs(diferenca) >= limiteSegundos) {
        divergencias.push({
          fonteA: a.nome,
          fonteB: b.nome,
          diferencaSegundos: diferenca,
          descricao:
            `Os relógios "${a.nome}" e "${b.nome}" divergem em ${formatarDuracao(Math.abs(diferenca))}. ` +
            'Instantes originados dessas fontes não são diretamente comparáveis sem correção.',
        });
      }
    }
  }
  return divergencias;
}

/**
 * Ordena eventos preservando a incerteza: instantes desconhecidos não são
 * inventados, vão para o fim ordenados por `ordemRelativa`.
 */
export function ordenarCronologia(eventos: readonly EventoNormalizado[]): EventoNormalizado[] {
  const comInstante = eventos.filter((e) => e.instanteNormalizado !== null);
  const semInstante = eventos.filter((e) => e.instanteNormalizado === null);

  comInstante.sort(
    (a, b) =>
      (a.instanteNormalizado as Date).getTime() - (b.instanteNormalizado as Date).getTime(),
  );
  semInstante.sort((a, b) => (a.ordemRelativa ?? Number.MAX_SAFE_INTEGER) - (b.ordemRelativa ?? Number.MAX_SAFE_INTEGER));

  return [...comInstante, ...semInstante];
}

export function formatarDuracao(segundos: number): string {
  const abs = Math.abs(segundos);
  if (abs < 60) return `${abs}s`;
  if (abs < 3600) return `${Math.round(abs / 60)}min`;
  if (abs < 86400) return `${(abs / 3600).toFixed(1)}h`;
  return `${(abs / 86400).toFixed(1)} dias`;
}

/** Rótulo humano da precisão, para nunca exibir aproximação como exatidão. */
export const ROTULOS_PRECISAO: Record<PrecisaoTemporal, string> = {
  exato: 'horário exato',
  aproximado: 'horário aproximado',
  intervalo: 'intervalo',
  desconhecido: 'horário desconhecido',
};
