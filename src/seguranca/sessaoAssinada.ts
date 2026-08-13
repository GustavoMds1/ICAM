import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Sessão em cookie assinado.
 *
 * O cookie carrega apenas o identificador da sessão e uma assinatura HMAC. O
 * estado fica no banco (tabela `sessoes`), o que permite revogar acesso de
 * imediato — coisa que um token autocontido não permite.
 *
 * O cookie é `httpOnly` (inacessível a JavaScript), `sameSite=lax` (barra
 * envio em requisição de terceiros) e `secure` em produção (só por HTTPS).
 */

export const NOME_COOKIE_SESSAO = 'icam_sessao';
export const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000; // 12 horas
export const RENOVAR_APOS_MS = 30 * 60 * 1000; // renova atividade a cada 30 min

export class SegredoAusenteError extends Error {
  constructor() {
    super(
      'SESSAO_SEGREDO não configurado ou fraco. Defina um valor aleatório com ao menos 32 caracteres. ' +
        'Gere um com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
    this.name = 'SegredoAusenteError';
  }
}

const SEGREDO_EXEMPLO = 'troque-este-valor-em-producao-com-32-bytes-aleatorios';

export function obterSegredo(ambiente: Record<string, string | undefined> = process.env): string {
  const segredo = ambiente.SESSAO_SEGREDO ?? '';
  const producao = ambiente.NODE_ENV === 'production';

  if (segredo.length < 32 || (producao && segredo === SEGREDO_EXEMPLO)) {
    throw new SegredoAusenteError();
  }
  return segredo;
}

export function gerarIdSessao(): string {
  return randomBytes(32).toString('base64url');
}

function assinar(idSessao: string, segredo: string): string {
  return createHmac('sha256', segredo).update(idSessao).digest('base64url');
}

export function montarValorCookie(idSessao: string, segredo: string): string {
  return `${idSessao}.${assinar(idSessao, segredo)}`;
}

/**
 * Confere a assinatura em tempo constante e devolve o id da sessão.
 * Devolve `null` para qualquer valor inválido, sem distinguir o motivo.
 */
export function lerValorCookie(valor: string | undefined, segredo: string): string | null {
  if (!valor) return null;

  const separador = valor.lastIndexOf('.');
  if (separador <= 0) return null;

  const idSessao = valor.slice(0, separador);
  const assinaturaRecebida = valor.slice(separador + 1);
  const assinaturaEsperada = assinar(idSessao, segredo);

  const a = Buffer.from(assinaturaRecebida);
  const b = Buffer.from(assinaturaEsperada);
  if (a.length !== b.length) return null;

  return timingSafeEqual(a, b) ? idSessao : null;
}

export interface OpcoesCookie {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
}

export function opcoesCookie(
  ambiente: Record<string, string | undefined> = process.env,
): OpcoesCookie {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: ambiente.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(DURACAO_SESSAO_MS / 1000),
  };
}

// ---------------------------------------------------------------------------
// Limite de tentativas de login
// ---------------------------------------------------------------------------

export const MAX_TENTATIVAS = 5;
export const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;

export interface EstadoBloqueio {
  bloqueado: boolean;
  tentativasRestantes: number;
  liberaEm: Date | null;
}

/**
 * Avalia o bloqueio a partir das tentativas recentes com falha.
 *
 * O bloqueio é por e-mail, não por IP: bloquear por IP é contornável e pune
 * quem está atrás do mesmo NAT corporativo.
 */
export function avaliarBloqueio(
  falhasRecentes: readonly Date[],
  agoraEm: Date,
  maxTentativas = MAX_TENTATIVAS,
  janelaMs = JANELA_TENTATIVAS_MS,
): EstadoBloqueio {
  const dentroDaJanela = falhasRecentes
    .filter((d) => agoraEm.getTime() - d.getTime() < janelaMs)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dentroDaJanela.length < maxTentativas) {
    return {
      bloqueado: false,
      tentativasRestantes: maxTentativas - dentroDaJanela.length,
      liberaEm: null,
    };
  }

  const maisAntiga = dentroDaJanela[dentroDaJanela.length - maxTentativas];
  return {
    bloqueado: true,
    tentativasRestantes: 0,
    liberaEm: maisAntiga ? new Date(maisAntiga.getTime() + janelaMs) : null,
  };
}
