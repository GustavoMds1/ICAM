import { NextResponse } from 'next/server';
import { lerPptx } from '@/lib/pptxLeitura';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Limite de tamanho: apresentação de investigação com vídeo passa fácil disso. */
const LIMITE_BYTES = 60 * 1024 * 1024;

export async function POST(requisicao: Request) {
  const formulario = await requisicao.formData().catch(() => null);
  const arquivo = formulario?.get('arquivo');

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Envie o arquivo .pptx da investigação.' }, { status: 400 });
  }
  if (!arquivo.name.toLowerCase().endsWith('.pptx')) {
    return NextResponse.json(
      { erro: 'Formato não aceito. O arquivo precisa ser .pptx (PowerPoint).' },
      { status: 400 },
    );
  }
  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json(
      { erro: `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(0)} MB e o limite é 60 MB.` },
      { status: 413 },
    );
  }

  try {
    const leitura = await lerPptx(await arquivo.arrayBuffer());
    return NextResponse.json({ ...leitura, nomeArquivo: arquivo.name });
  } catch (e) {
    return NextResponse.json(
      { erro: `Não foi possível ler o arquivo: ${e instanceof Error ? e.message : 'erro desconhecido'}` },
      { status: 422 },
    );
  }
}
