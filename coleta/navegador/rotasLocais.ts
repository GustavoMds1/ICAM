/**
 * Faz as chamadas `/api/...` da tela serem atendidas dentro do próprio
 * navegador, sem servidor nenhum.
 *
 * Por que desviar o `fetch` em vez de reescrever a tela: assim `page.tsx` não
 * muda **uma linha**. A versão hospedada e a versão de arquivo único passam a
 * compartilhar cem por cento do código — inclusive a identificação dos
 * códigos, que é onde mora o resultado medido. Duas telas parecidas viram duas
 * telas diferentes em três meses, e aí a medição vale para uma só.
 *
 * O que NÃO funciona aqui, e está certo assim: a IA externa. Ela exige uma
 * chave, e chave dentro de arquivo que roda na máquina de quem usa é chave
 * publicada. `/api/estado` responde que a IA está indisponível, o botão nasce
 * desabilitado, e a identificação local — que é o padrão de qualquer forma —
 * segue igual.
 */
import { lerPptx } from '@/lib/pptxLeitura';
import { classificar } from '@/lib/classificacao';
import { proporAcoes } from '@/lib/acoes';
import { gerarSlide } from '@/lib/pptxEscrita';

const LIMITE_BYTES = 60 * 1024 * 1024;

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function caminhoDe(entrada: RequestInfo | URL): string {
  const bruto =
    typeof entrada === 'string'
      ? entrada
      : entrada instanceof URL
        ? entrada.pathname
        : entrada.url;
  const corte = bruto.indexOf('/api/');
  return corte >= 0 ? bruto.slice(corte) : bruto;
}

function corpoJson(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {};
  return JSON.parse(init.body) as Record<string, unknown>;
}

async function atender(caminho: string, init?: RequestInit): Promise<Response> {
  // ---------------------------------------------------------------- estado
  if (caminho.startsWith('/api/estado')) {
    return json({ iaDisponivel: false, iaPadrao: false });
  }

  // -------------------------------------------------------------- importar
  if (caminho.startsWith('/api/importar')) {
    const formulario = init?.body;
    const arquivo = formulario instanceof FormData ? formulario.get('arquivo') : null;

    if (!(arquivo instanceof File)) {
      return json({ erro: 'Envie o arquivo .pptx da investigação.' }, 400);
    }
    if (!arquivo.name.toLowerCase().endsWith('.pptx')) {
      return json({ erro: 'Formato não aceito. O arquivo precisa ser .pptx (PowerPoint).' }, 400);
    }
    if (arquivo.size > LIMITE_BYTES) {
      return json(
        { erro: `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(0)} MB e o limite é 60 MB.` },
        413,
      );
    }

    try {
      const leitura = await lerPptx(await arquivo.arrayBuffer());
      return json({ ...leitura, nomeArquivo: arquivo.name });
    } catch (e) {
      return json(
        {
          erro: `Não foi possível ler o arquivo: ${e instanceof Error ? e.message : 'erro desconhecido'}`,
        },
        422,
      );
    }
  }

  // ----------------------------------------------------------- classificar
  if (caminho.startsWith('/api/classificar')) {
    const pedido = corpoJson(init);
    const resultado = await classificar(pedido.itens as never, {
      contexto: pedido.contexto as string | undefined,
      // Sem servidor não há chave, e sem chave não há IA externa. Explícito
      // para não depender de um valor ausente se comportar bem.
      usarGemini: false,
    });
    return json({ ...resultado, origem: 'local' });
  }

  // ----------------------------------------------------------------- ações
  if (caminho.startsWith('/api/acoes')) {
    const pedido = corpoJson(init);
    const resultado = await proporAcoes(pedido.achados as never, {
      contexto: pedido.contexto as string | undefined,
      usarGemini: false,
    });
    return json({
      ...resultado,
      acoes: resultado.acoes.map((a) => ({ ...a, origem: 'local' })),
      origem: 'local',
    });
  }

  // ----------------------------------------------------------------- slide
  if (caminho.startsWith('/api/slide')) {
    const pedido = corpoJson(init);
    const { arquivo, avisos } = await gerarSlide({
      cartoes: pedido.cartoes as never,
      evento: pedido.evento as never,
      acoes: pedido.acoes as never,
    });

    // O mesmo formato de resposta da rota do servidor: a tela já sabe ler
    // isto, incluindo o cabeçalho com os avisos.
    return new Response(new Uint8Array(arquivo), {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'content-disposition': 'attachment; filename="classificacao-icam.pptx"',
        'x-avisos': encodeURIComponent(JSON.stringify(avisos)),
      },
    });
  }

  return json({ erro: `Rota não atendida nesta versão: ${caminho}` }, 404);
}

export function instalarRotasLocais(): void {
  const original = globalThis.fetch?.bind(globalThis);

  globalThis.fetch = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const caminho = caminhoDe(entrada);

    if (!caminho.startsWith('/api/')) {
      if (!original) throw new Error('Sem rede nesta versão.');
      return original(entrada, init);
    }

    try {
      return await atender(caminho, init);
    } catch (e) {
      // Erro daqui é defeito do aplicativo, não do arquivo de quem usa. Vai
      // para a tela com o texto real: mensagem genérica esconde a causa.
      return json(
        { erro: e instanceof Error ? e.message : 'Erro inesperado ao processar.', codigo: 'ERRO' },
        500,
      );
    }
  };
}
