import { redirect } from 'next/navigation';
import { obterUsuarioAtual } from '@/servidor/sessao';
import { FormularioEntrar } from './FormularioEntrar';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar — Plataforma ICAM' };

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; senhaAlterada?: string }>;
}) {
  const { destino = '/', senhaAlterada } = await searchParams;
  if (await obterUsuarioAtual()) redirect('/');

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-texto-sutil">
        Acesso restrito à equipe de investigação. Toda tentativa de acesso é registrada.
      </p>

      {senhaAlterada && (
        <div role="status" className="mt-4 rounded-md border-l-4 border-ok bg-ok-fundo p-4">
          <p className="text-sm font-semibold">Senha alterada</p>
          <p className="mt-1 text-sm text-texto-sutil">
            Todas as sessões anteriores foram encerradas. Entre com a nova senha.
          </p>
        </div>
      )}

      <div className="mt-6">
        <FormularioEntrar destino={destino} />
      </div>
    </div>
  );
}
