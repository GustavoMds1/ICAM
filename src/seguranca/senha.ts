import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * `promisify` escolhe a sobrecarga de 3 argumentos de `scrypt`, que não aceita
 * opções. A assinatura é declarada explicitamente para preservar `N`, `r`, `p`
 * e `maxmem` com tipagem estrita.
 */
const scryptAsync = promisify(scrypt) as (
  senha: string | Buffer,
  sal: string | Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
) => Promise<Buffer>;

/**
 * Hash de senha com scrypt.
 *
 * Por que scrypt e não Argon2id: scrypt é uma função de derivação com custo de
 * memória, recomendada pelo NIST e pela OWASP, e está na biblioteca padrão do
 * Node. Argon2id é marginalmente preferível em teoria, mas exige dependência
 * nativa compilada — que é fonte recorrente de falha de build em provedores de
 * nuvem. Aqui a robustez operacional pesou mais que a margem teórica.
 *
 * Parâmetros: N=2^16, r=8, p=1 (custo de ~64 MiB por verificação), acima do
 * mínimo recomendado pela OWASP para scrypt (N=2^15). O formato guarda os
 * parâmetros junto do hash, então aumentá-los depois não invalida as senhas
 * existentes.
 */

const CUSTO_N = 65536; // 2^16
const BLOCO_R = 8;
const PARALELISMO_P = 1;
const TAMANHO_CHAVE = 64;
const TAMANHO_SAL = 32;
const MEMORIA_MAXIMA = 160 * 1024 * 1024; // scrypt exige ~128*N*r bytes

/**
 * Custo efetivo. Em produção é SEMPRE `CUSTO_N`, independentemente de
 * variável de ambiente — um custo reduzido em produção seria uma falha de
 * segurança silenciosa. Fora de produção, `SENHA_CUSTO_N` permite baixar o
 * custo para manter a suíte de testes rápida.
 */
export function custoEfetivo(ambiente: Record<string, string | undefined> = process.env): number {
  if (ambiente.NODE_ENV === 'production') return CUSTO_N;
  const informado = Number.parseInt(ambiente.SENHA_CUSTO_N ?? '', 10);
  return Number.isFinite(informado) && informado >= 1024 ? informado : CUSTO_N;
}

export interface ParametrosSenha {
  N: number;
  r: number;
  p: number;
}

/** Formato: `scrypt$N$r$p$sal_base64$hash_base64`. */
export async function gerarHashSenha(
  senha: string,
  parametros: ParametrosSenha = { N: custoEfetivo(), r: BLOCO_R, p: PARALELISMO_P },
): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const derivada = await scryptAsync(senha.normalize('NFKC'), sal, TAMANHO_CHAVE, {
    N: parametros.N,
    r: parametros.r,
    p: parametros.p,
    maxmem: MEMORIA_MAXIMA,
  });

  return [
    'scrypt',
    parametros.N,
    parametros.r,
    parametros.p,
    sal.toString('base64'),
    derivada.toString('base64'),
  ].join('$');
}

/**
 * Verifica a senha em tempo constante. Nunca lança para hash malformado:
 * devolve `false`, para não distinguir "usuário inexistente" de "senha errada".
 */
export async function verificarSenha(senha: string, hashArmazenado: string): Promise<boolean> {
  try {
    const partes = hashArmazenado.split('$');
    if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

    const N = Number.parseInt(partes[1] ?? '', 10);
    const r = Number.parseInt(partes[2] ?? '', 10);
    const p = Number.parseInt(partes[3] ?? '', 10);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const sal = Buffer.from(partes[4] ?? '', 'base64');
    const esperado = Buffer.from(partes[5] ?? '', 'base64');
    if (sal.length === 0 || esperado.length === 0) return false;

    const derivada = await scryptAsync(senha.normalize('NFKC'), sal, esperado.length, {
      N,
      r,
      p,
      maxmem: MEMORIA_MAXIMA,
    });

    return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
  } catch {
    return false;
  }
}

/** Indica se o hash usa parâmetros abaixo do padrão atual e deve ser regerado. */
export function precisaRehash(hashArmazenado: string): boolean {
  const partes = hashArmazenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return true;
  return Number.parseInt(partes[1] ?? '0', 10) < custoEfetivo();
}

// ---------------------------------------------------------------------------
// Política de senha
// ---------------------------------------------------------------------------

export interface AvaliacaoSenha {
  aceitavel: boolean;
  problemas: string[];
}

/** Senhas muito comuns, recusadas independentemente do tamanho. */
const SENHAS_PROIBIDAS = new Set([
  '12345678', '123456789', '1234567890', 'senha123', 'password', 'password1',
  'qwertyui', 'admin123', 'mudar123', 'trocar123', 'icam1234', 'abcd1234',
]);

/**
 * Política baseada na recomendação do NIST SP 800-63B: comprimento mínimo
 * relevante, verificação contra senhas comuns, e SEM exigência de composição
 * (maiúscula, símbolo), que comprovadamente leva a senhas piores.
 */
export function avaliarSenha(senha: string, dadosDoUsuario: string[] = []): AvaliacaoSenha {
  const problemas: string[] = [];
  const limpa = senha.normalize('NFKC');

  if (limpa.length < 12) problemas.push('A senha deve ter no mínimo 12 caracteres.');
  if (limpa.length > 200) problemas.push('A senha deve ter no máximo 200 caracteres.');
  if (SENHAS_PROIBIDAS.has(limpa.toLowerCase())) {
    problemas.push('Esta senha é muito comum e não pode ser usada.');
  }
  if (/^(.)\1+$/.test(limpa)) problemas.push('A senha não pode ser um único caractere repetido.');

  // Palavras do próprio contexto do usuário (NIST SP 800-63B, 5.1.1.2).
  // O e-mail é decomposto: "joao.silva@empresa.com" gera "joao", "silva",
  // "empresa" — usar qualquer uma delas na senha é previsível.
  const minuscula = limpa.toLowerCase();
  const termosProibidos = new Set<string>();
  for (const dado of dadosDoUsuario) {
    for (const termo of dado.toLowerCase().split(/[^a-z0-9à-ú]+/i)) {
      if (termo.length >= 4 && !['com', 'br', 'org', 'net'].includes(termo)) {
        termosProibidos.add(termo);
      }
    }
  }
  for (const termo of termosProibidos) {
    if (minuscula.includes(termo)) {
      problemas.push('A senha não pode conter partes do seu nome ou do seu e-mail.');
      break;
    }
  }

  return { aceitavel: problemas.length === 0, problemas };
}

/** Gera uma senha inicial legível para entrega ao usuário na criação da conta. */
export function gerarSenhaInicial(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(20);
  let senha = '';
  for (const b of bytes) senha += alfabeto[b % alfabeto.length];
  return senha;
}
