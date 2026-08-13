import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { abrirBanco, type Banco } from './bd';
import { ServicoAutenticacao, type UsuarioAutenticado } from './autenticacao';
import { RepositorioPostgres } from './repositorioPostgres';
import type { Repositorio } from './repositorio';
import type { Ator } from '../seguranca/rbac';
import {
  lerValorCookie,
  NOME_COOKIE_SESSAO,
  obterSegredo,
} from '../seguranca/sessaoAssinada';

/**
 * Sessão do usuário — autenticação real.
 *
 * O ator do RBAC/ABAC é derivado da sessão gravada no banco, não de um valor
 * fixo. Como a sessão vive no banco, revogar acesso (logout, troca de senha,
 * desativação de conta) tem efeito imediato na requisição seguinte.
 */

export const AUTENTICACAO_IMPLEMENTADA = true;

let bancoCompartilhado: Banco | null = null;

/** Conexão única por processo. Em produção é um pool; em desenvolvimento, PGlite. */
export async function obterBanco(): Promise<Banco> {
  bancoCompartilhado ??= await abrirBanco();
  return bancoCompartilhado;
}

export async function obterServicoAutenticacao(): Promise<ServicoAutenticacao> {
  return new ServicoAutenticacao(await obterBanco());
}

export async function obterRepositorioBanco(): Promise<Repositorio> {
  return new RepositorioPostgres(await obterBanco());
}

/**
 * Usuário da requisição atual, ou `null`.
 *
 * `cache` do React garante uma única resolução por requisição, mesmo que
 * várias camadas peçam o usuário.
 */
export const obterUsuarioAtual = cache(async (): Promise<UsuarioAutenticado | null> => {
  const cookieSessao = (await cookies()).get(NOME_COOKIE_SESSAO)?.value;
  if (!cookieSessao) return null;

  let idSessao: string | null;
  try {
    idSessao = lerValorCookie(cookieSessao, obterSegredo());
  } catch {
    // Segredo ausente ou fraco: nenhuma sessão é aceita.
    return null;
  }
  if (!idSessao) return null;

  const auth = await obterServicoAutenticacao();
  return auth.resolverSessao(idSessao);
});

/** Ator do RBAC/ABAC da requisição atual, ou `null` se não autenticado. */
export const obterAtorAtual = cache(async (): Promise<Ator | null> => {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return null;
  const auth = await obterServicoAutenticacao();
  return auth.montarAtor(usuario);
});

/**
 * Exige autenticação. Redireciona para o login preservando o destino, e para a
 * troca de senha quando ela é obrigatória.
 */
export async function exigirAtor(caminhoAtual?: string): Promise<Ator> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) {
    const destino = caminhoAtual ? `?destino=${encodeURIComponent(caminhoAtual)}` : '';
    redirect(`/entrar${destino}`);
  }
  if (usuario.deveTrocarSenha) {
    redirect('/trocar-senha');
  }

  const auth = await obterServicoAutenticacao();
  return auth.montarAtor(usuario);
}

/** Contexto da requisição, para a trilha de auditoria. */
export async function obterContextoRequisicao(): Promise<{
  origemIp: string | null;
  agenteUsuario: string | null;
}> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get('x-forwarded-for');
  return {
    origemIp: encaminhado?.split(',')[0]?.trim() ?? cabecalhos.get('x-real-ip') ?? null,
    agenteUsuario: cabecalhos.get('user-agent'),
  };
}
