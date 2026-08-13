import { obterUsuarioAtual } from '@/servidor/sessao';
import { sair } from '@/app/acoes/autenticacao';
import { Selo } from './ui';

/**
 * Identificação do usuário autenticado e saída.
 *
 * O papel fica visível o tempo todo: o investigador precisa saber com quais
 * permissões está operando antes de tentar uma ação que será negada.
 */
export async function BarraUsuario() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-texto-sutil">
        {usuario.nome} <Selo tom="marca">{usuario.papelGlobal}</Selo>
      </span>
      <form action={sair}>
        <button type="submit" className="botao text-xs">
          Sair
        </button>
      </form>
    </div>
  );
}
