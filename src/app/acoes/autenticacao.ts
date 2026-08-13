'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  lerValorCookie,
  montarValorCookie,
  NOME_COOKIE_SESSAO,
  obterSegredo,
  opcoesCookie,
} from '@/seguranca/sessaoAssinada';
import {
  obterContextoRequisicao,
  obterServicoAutenticacao,
  obterUsuarioAtual,
} from '@/servidor/sessao';

/**
 * Ações de autenticação executadas no servidor.
 *
 * O Next.js protege Server Actions contra CSRF verificando a origem da
 * requisição; combinado com o cookie `sameSite=lax`, cobre o vetor clássico.
 */

export interface EstadoFormulario {
  erro: string | null;
  problemas?: string[];
}

export async function entrar(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const email = String(dados.get('email') ?? '').trim();
  const senha = String(dados.get('senha') ?? '');
  const destinoBruto = String(dados.get('destino') ?? '/');

  if (!email || !senha) {
    return { erro: 'Informe e-mail e senha.' };
  }

  const contexto = await obterContextoRequisicao();
  const auth = await obterServicoAutenticacao();
  const resultado = await auth.autenticar(email, senha, contexto);

  if (!resultado.ok) {
    return { erro: resultado.motivo };
  }

  const armazem = await cookies();
  armazem.set(
    NOME_COOKIE_SESSAO,
    montarValorCookie(resultado.idSessao, obterSegredo()),
    opcoesCookie(),
  );

  // Só aceita destino interno: bloqueia redirecionamento aberto.
  const destino =
    destinoBruto.startsWith('/') && !destinoBruto.startsWith('//') ? destinoBruto : '/';

  redirect(resultado.usuario.deveTrocarSenha ? '/trocar-senha' : destino);
}

export async function sair(): Promise<void> {
  const armazem = await cookies();
  const valor = armazem.get(NOME_COOKIE_SESSAO)?.value;

  if (valor) {
    try {
      const idSessao = lerValorCookie(valor, obterSegredo());
      if (idSessao) {
        const auth = await obterServicoAutenticacao();
        await auth.encerrarSessao(idSessao, 'logout');
      }
    } catch {
      // Segredo indisponível: ainda assim removemos o cookie.
    }
  }

  armazem.delete(NOME_COOKIE_SESSAO);
  redirect('/entrar');
}

export async function trocarSenha(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect('/entrar');

  const atual = String(dados.get('senhaAtual') ?? '');
  const nova = String(dados.get('senhaNova') ?? '');
  const confirmacao = String(dados.get('senhaConfirmacao') ?? '');

  if (nova !== confirmacao) {
    return { erro: 'A confirmação não confere com a nova senha.' };
  }

  const auth = await obterServicoAutenticacao();
  const resultado = await auth.trocarSenha(usuario.id, atual, nova);

  if (!resultado.ok) {
    return { erro: 'Não foi possível alterar a senha.', problemas: resultado.problemas };
  }

  // A troca invalida todas as sessões, inclusive esta.
  (await cookies()).delete(NOME_COOKIE_SESSAO);
  redirect('/entrar?senhaAlterada=1');
}
