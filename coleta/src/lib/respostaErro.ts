import { NextResponse } from 'next/server';
import { ErroGemini, ErroSemChave } from './gemini';

/**
 * Falha de IA vira mensagem com o que fazer, não queda silenciosa para o modo
 * local. Análise fraca com aparência de análise é pior do que erro visível.
 */
export function responderErro(e: unknown) {
  if (e instanceof ErroSemChave) {
    return NextResponse.json({ erro: e.message, codigo: 'SEM_CHAVE' }, { status: 503 });
  }
  if (e instanceof ErroGemini) {
    return NextResponse.json({ erro: e.message, codigo: 'FALHA_GEMINI' }, { status: 502 });
  }
  return NextResponse.json(
    { erro: e instanceof Error ? e.message : 'Erro desconhecido.', codigo: 'ERRO' },
    { status: 500 },
  );
}
