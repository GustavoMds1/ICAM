import { NextResponse } from 'next/server';
import { z } from 'zod';
import { classificar } from '@/lib/classificacao';
import { CATEGORIAS_PEEPO } from '@/lib/pptxLeitura';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const corpo = z.object({
  itens: z
    .array(
      z.object({
        id: z.string().min(1),
        categoria: z.enum([...CATEGORIAS_PEEPO, 'nao_classificado']),
        tipo: z.enum(['evidencia', 'constatacao']),
        texto: z.string().min(1),
        responsavel: z.string().nullable(),
        slide: z.number(),
      }),
    )
    .min(1, 'Nenhum item para classificar.')
    .max(300, 'São no máximo 300 itens por vez.'),
  contexto: z.string().max(4000).optional(),
});

export async function POST(requisicao: Request) {
  const bruto: unknown = await requisicao.json().catch(() => null);
  const pedido = corpo.safeParse(bruto);
  if (!pedido.success) {
    return NextResponse.json(
      { erro: pedido.error.issues.map((i) => i.message).join(' ') },
      { status: 400 },
    );
  }

  const resultado = await classificar(pedido.data.itens, { contexto: pedido.data.contexto });
  return NextResponse.json(resultado);
}
