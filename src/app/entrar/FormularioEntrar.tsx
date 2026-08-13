'use client';

import { useActionState } from 'react';
import { entrar, type EstadoFormulario } from '../acoes/autenticacao';
import { Aviso } from '@/componentes/ui';

const INICIAL: EstadoFormulario = { erro: null };

export function FormularioEntrar({ destino }: { destino: string }) {
  const [estado, acao, pendente] = useActionState(entrar, INICIAL);

  return (
    <form action={acao} className="space-y-4 rounded-lg border border-borda bg-superficie p-6">
      <input type="hidden" name="destino" value={destino} />

      <div aria-live="polite">
        {estado.erro && (
          <Aviso tom="erro" titulo="Não foi possível entrar">
            {estado.erro}
          </Aviso>
        )}
      </div>

      <div>
        <label htmlFor="email" className="rotulo-campo">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="senha" className="rotulo-campo">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
        />
      </div>

      <button type="submit" className="botao-primario w-full justify-center" disabled={pendente}>
        {pendente ? 'Verificando…' : 'Entrar'}
      </button>

      <p className="text-xs text-texto-fraco">
        Esqueceu a senha? Procure o administrador da plataforma. Por segurança, não há redefinição
        automática por e-mail nesta versão.
      </p>
    </form>
  );
}
