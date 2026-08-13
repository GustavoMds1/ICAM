/**
 * Fonte única de "agora". Existe para dois motivos:
 *  1. testes determinísticos (fixture e regressão da seção 13);
 *  2. auditoria consistente — todo registro crítico usa o mesmo relógio.
 *
 * O ESLint bloqueia `new Date()` sem argumentos no restante do código.
 */
export interface Relogio {
  agora(): Date;
}

export const relogioSistema: Relogio = {
  // eslint-disable-next-line no-restricted-syntax
  agora: () => new Date(),
};

export function relogioFixo(instante: Date | string): Relogio {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  return { agora: () => new Date(d.getTime()) };
}

let relogioAtual: Relogio = relogioSistema;

export function definirRelogio(r: Relogio): void {
  relogioAtual = r;
}

export function agora(): Date {
  return relogioAtual.agora();
}
