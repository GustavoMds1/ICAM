import { z } from 'zod';
import { gerarSlide } from '@/lib/pptxEscrita';
import { NIVEIS_VALIDOS } from '@/lib/codigos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const corpo = z.object({
  cartoes: z
    .array(
      z.object({
        codigo: z.string().min(2),
        titulo: z.string().min(1),
        constatacao: z.string().min(1),
        nivel: z.enum(NIVEIS_VALIDOS as [string, ...string[]]),
      }),
    )
    .min(1, 'Aprove ao menos um cartão antes de gerar o slide.'),
  evento: z.object({
    oQueAconteceu: z.string().nullable(),
    quemEnvolvido: z.string().nullable(),
    ondeAconteceu: z.string().nullable(),
    quandoAconteceu: z.string().nullable(),
    consequenciaReal: z.string().nullable(),
    consequenciaPotencial: z.string().nullable(),
  }),
  tituloInvestigacao: z.string().max(200).optional(),
});

export async function POST(requisicao: Request) {
  const bruto: unknown = await requisicao.json().catch(() => null);
  const pedido = corpo.safeParse(bruto);
  if (!pedido.success) {
    return Response.json({ erro: pedido.error.issues.map((i) => i.message).join(' ') }, { status: 400 });
  }

  const { arquivo, avisos } = await gerarSlide({
    cartoes: pedido.data.cartoes as never,
    evento: pedido.data.evento,
    tituloInvestigacao: pedido.data.tituloInvestigacao,
  });

  return new Response(new Uint8Array(arquivo), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'content-disposition': 'attachment; filename="classificacao-icam.pptx"',
      // Os avisos viajam no cabeçalho porque o corpo é o próprio arquivo.
      'x-avisos': encodeURIComponent(JSON.stringify(avisos)),
    },
  });
}
