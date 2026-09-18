import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Diz à tela se a IA assistida pode ser ligada, e se ela já vem ligada.
 *
 * Devolve dois booleanos e nada mais. **A chave nunca sai daqui** — o navegador
 * precisa saber se existe uma, não qual é. Por isso a resposta é o resultado de
 * um teste sobre a variável, jamais o valor dela.
 *
 * Sem esta rota, o botão de ligar a IA prometeria algo que falharia só na hora
 * de usar, no meio de uma investigação.
 */
export function GET() {
  const chaveConfigurada = (process.env.GEMINI_API_KEY ?? '').trim() !== '';

  return NextResponse.json({
    iaDisponivel: chaveConfigurada,
    iaPadrao: chaveConfigurada && process.env.USAR_GEMINI === 'true',
  });
}
