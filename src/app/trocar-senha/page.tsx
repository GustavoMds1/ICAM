import { redirect } from 'next/navigation';
import { obterUsuarioAtual } from '@/servidor/sessao';
import { FormularioTrocarSenha } from './FormularioTrocarSenha';
import { Aviso } from '@/componentes/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trocar senha — Plataforma ICAM' };

export default async function PaginaTrocarSenha() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect('/entrar');

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">Trocar senha</h1>
      <p className="mt-1 text-sm text-texto-sutil">{usuario.email}</p>

      {usuario.deveTrocarSenha && (
        <div className="mt-4">
          <Aviso tom="alerta" titulo="Troca obrigatória">
            Esta conta ainda usa a senha inicial definida pelo administrador. Defina uma senha
            própria antes de continuar.
          </Aviso>
        </div>
      )}

      <div className="mt-6">
        <FormularioTrocarSenha />
      </div>
    </div>
  );
}
