import { NextResponse } from 'next/server';
import { z } from 'zod';
import { proporAcoes } from '@/lib/acoes';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const corpo = z.object({
  achados: z
    .array(
      z.object({
        itemId: z.string().min(1),
        codigo: z.string().min(2),
        titulo: z.string().min(1),
        constatacao: z.string().min(1),
      }),
    )
    .min(1, 'Nenhum achado exige ação.')
    .max(100, 'São no máximo 100 achados por vez.'),
  contexto: z.string().max(4000).optional(),
});

export async function POST(requisicao: Request) {
  const bruto: unknown = await requisicao.json().catch(() => null);
  const pedido = corpo.safeParse(bruto);
  if (!pedido.success) {
    return NextResponse.json({ erro: pedido.error.issues.map((i) => i.message).join(' ') }, { status: 400 });
  }

  const resultado = await proporAcoes(pedido.data.achados, { contexto: pedido.data.contexto });
  return NextResponse.json(resultado);
}
