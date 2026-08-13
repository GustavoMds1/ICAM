import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agenteClassificador, executarAgente } from '@/agentes';
import { obterProvedor } from '@/agentes/provedor';
import { obterAtorAtual, obterRepositorioBanco } from '@/servidor/sessao';
import { autorizar } from '@/seguranca/rbac';

export const dynamic = 'force-dynamic';

const corpoPedido = z.object({
  investigacaoId: z.string().min(1),
  descricao: z.string().min(15, 'Descreva o achado com pelo menos 15 caracteres.'),
  mecanismo: z.string().nullable(),
  colunaPreferida: z.string().nullable().optional(),
});

export async function POST(requisicao: Request) {
  const ator = await obterAtorAtual();
  if (!ator) {
    return NextResponse.json({ erro: 'Sessão expirada ou inexistente.' }, { status: 401 });
  }
  const repo = await obterRepositorioBanco();

  const bruto: unknown = await requisicao.json().catch(() => null);
  const pedido = corpoPedido.safeParse(bruto);
  if (!pedido.success) {
    return NextResponse.json(
      { erro: pedido.error.issues.map((i) => i.message).join(' ') },
      { status: 400 },
    );
  }

  const investigacao = await repo.obterInvestigacao(ator.organizacaoId, pedido.data.investigacaoId);
  if (!investigacao) {
    // Isolamento entre organizações: recurso de outra organização não existe.
    return NextResponse.json({ erro: 'Investigação não encontrada.' }, { status: 404 });
  }

  const permissao = autorizar(ator, 'ia.executar', {
    organizacaoId: investigacao.metadados.organizacaoId,
    investigacaoId: investigacao.investigacaoId,
    confidencialidade: investigacao.metadados.confidencialidade as 'interna',
  });
  if (!permissao.permitido) {
    return NextResponse.json({ erro: permissao.motivo }, { status: 403 });
  }

  try {
    const resultado = await executarAgente(
      agenteClassificador,
      {
        agente: 'classificador',
        investigacaoId: investigacao.investigacaoId,
        dados: {
          descricao: pedido.data.descricao,
          mecanismo: pedido.data.mecanismo,
          colunaPreferida: pedido.data.colunaPreferida ?? null,
          // Evidências já vinculadas à investigação ficam disponíveis para citação.
          evidencias: [],
        },
      },
      obterProvedor(),
    );

    // A execução é registrada mesmo quando a sugestão é descartada pelo usuário.
    await repo.registrarExecucaoIa(investigacao.investigacaoId, resultado.registro);
    await repo.registrarAuditoria({
      organizacaoId: ator.organizacaoId,
      usuarioId: ator.usuarioId,
      atorTipo: 'ia',
      acao: 'criar',
      entidadeTipo: 'sugestao_classificacao',
      entidadeId: resultado.registro.entradaHash.slice(0, 16),
      investigacaoId: investigacao.investigacaoId,
      depois: { agente: 'classificador', alternativas: resultado.saida.alternativas.length },
    });

    return NextResponse.json(resultado.saida);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Erro desconhecido no classificador.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
