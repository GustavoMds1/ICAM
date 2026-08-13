import { NextResponse } from 'next/server';
import { verificarSaude } from '@/servidor/bd';
import { obterBanco } from '@/servidor/sessao';

export const dynamic = 'force-dynamic';

/**
 * Verificação de saúde para o provedor de nuvem.
 *
 * Responde sem autenticação — o provedor precisa consultar antes de haver
 * sessão —, mas não revela versão, host nem nada que ajude um atacante.
 */
export async function GET() {
  try {
    const saude = await verificarSaude(await obterBanco());
    return NextResponse.json(
      { estado: saude.ok ? 'ok' : 'degradado' },
      { status: saude.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ estado: 'indisponivel' }, { status: 503 });
  }
}
