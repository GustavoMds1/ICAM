import { NextResponse } from 'next/server';
import { ErroGemini, ErroSemChave } from './gemini';
import { semFornecedor } from './rotulos';

/**
 * Falha de IA vira mensagem com o que fazer, não queda silenciosa para o modo
 * local. Análise fraca com aparência de análise é pior do que erro visível.
 *
 * A mensagem detalhada vai para o log do servidor, onde serve a quem
 * administra; para o navegador vai a versão sem o nome do fornecedor, com a
 * saída prática — que, neste aplicativo, é desligar a IA e seguir no modo
 * local.
 */
export function responderErro(e: unknown) {
  if (e instanceof ErroSemChave) {
    console.error('[IA] configuração ausente:', e.message);
    return NextResponse.json(
      {
        erro:
          'A IA assistida não está configurada neste servidor. Desative a IA no botão do topo para seguir com a identificação local, ou peça a quem administra o aplicativo para configurar a chave.',
        codigo: 'SEM_CHAVE',
      },
      { status: 503 },
    );
  }

  if (e instanceof ErroGemini) {
    console.error('[IA] falha na chamada:', e.message);
    return NextResponse.json(
      {
        erro: `${semFornecedor(e.message)} Se persistir, desative a IA no botão do topo e siga com a identificação local.`,
        codigo: 'FALHA_IA',
      },
      { status: 502 },
    );
  }

  const mensagem = e instanceof Error ? e.message : 'Erro desconhecido.';
  if (e instanceof Error) console.error('[erro]', e.message);
  return NextResponse.json({ erro: semFornecedor(mensagem), codigo: 'ERRO' }, { status: 500 });
}
