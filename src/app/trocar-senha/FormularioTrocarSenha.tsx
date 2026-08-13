'use client';

import { useActionState } from 'react';
import { trocarSenha, type EstadoFormulario } from '../acoes/autenticacao';
import { Aviso } from '@/componentes/ui';

const INICIAL: EstadoFormulario = { erro: null };

export function FormularioTrocarSenha() {
  const [estado, acao, pendente] = useActionState(trocarSenha, INICIAL);

  return (
    <form action={acao} className="space-y-4 rounded-lg border border-borda bg-superficie p-6">
      <div aria-live="polite">
        {estado.erro && (
          <Aviso tom="erro" titulo={estado.erro}>
            {estado.problemas && estado.problemas.length > 0 && (
              <ul className="list-disc pl-5">
                {estado.problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </Aviso>
        )}
      </div>

      <div>
        <label htmlFor="senhaAtual" className="rotulo-campo">
          Senha atual
        </label>
        <input
          id="senhaAtual"
          name="senhaAtual"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="senhaNova" className="rotulo-campo">
          Nova senha
        </label>
        <input
          id="senhaNova"
          name="senhaNova"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
          aria-describedby="ajuda-senha"
        />
        <p id="ajuda-senha" className="mt-1 text-xs text-texto-fraco">
          Mínimo de 12 caracteres. Uma frase com quatro palavras é mais segura e mais fácil de
          lembrar do que uma sequência curta com símbolos. Não use partes do seu nome ou e-mail.
        </p>
      </div>

      <div>
        <label htmlFor="senhaConfirmacao" className="rotulo-campo">
          Confirme a nova senha
        </label>
        <input
          id="senhaConfirmacao"
          name="senhaConfirmacao"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 w-full rounded-md border border-borda-forte px-3 py-2 text-sm"
        />
      </div>

      <button type="submit" className="botao-primario w-full justify-center" disabled={pendente}>
        {pendente ? 'Salvando…' : 'Trocar senha'}
      </button>

      <p className="text-xs text-texto-fraco">
        Ao trocar a senha, todas as sessões abertas são encerradas, inclusive esta.
      </p>
    </form>
  );
}
