'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { bloqueiosParaConfirmar } from '@/agentes';
import { lerConfiguracaoIa, obterProvedor } from '@/agentes/provedor';
import { dossieVazio } from '@/domain/dossie';
import {
  NATUREZAS_FATOR,
  NIVEIS_CONFIDENCIALIDADE,
  NIVEIS_INVESTIGACAO,
  NIVEIS_SEVERIDADE,
  PRECISOES_TEMPORAIS,
  TIPOS_ASSERCAO_FACTUAIS,
  type DecisaoHumana,
  type NaturezaFator,
} from '@/domain/enumeracoes';
import { agora } from '@/domain/tempo/relogio';
import { autorizar, type Acao, type Ator } from '@/seguranca/rbac';
import type { InvestigacaoCompleta, Repositorio } from '@/servidor/repositorio';
import { montarRascunho, type ResumoRascunho } from '@/servidor/rascunho';
import {
  exigirAtor,
  obterContextoRequisicao,
  obterRepositorioBanco,
  obterUsuarioAtual,
} from '@/servidor/sessao';

/**
 * Escrita de investigações.
 *
 * Todo caminho de gravação passa por aqui e obedece à mesma sequência:
 * autenticar, autorizar pelo RBAC, validar com Zod, gravar, registrar na
 * trilha de auditoria. Nenhuma tela grava direto no repositório.
 *
 * O Next.js protege Server Actions contra CSRF verificando a origem da
 * requisição; somado ao cookie `sameSite=lax`, cobre o vetor clássico.
 */

export interface EstadoInvestigacao {
  erro: string | null;
  problemas?: string[];
}

const esquemaAbertura = z.object({
  titulo: z
    .string()
    .trim()
    .min(10, 'O título precisa de pelo menos 10 caracteres para identificar o evento.')
    .max(300, 'O título ficou longo demais; resuma em até 300 caracteres.'),
  descricaoInicial: z
    .string()
    .trim()
    .min(40, 'Descreva o que aconteceu com pelo menos 40 caracteres. É esse relato que alimenta a análise.')
    .max(20_000, 'O relato passou do limite de 20.000 caracteres.'),
  codigo: z.string().trim().max(40).optional(),
  ocorridoEm: z.string().trim().optional(),
  precisaoOcorrencia: z.enum(PRECISOES_TEMPORAIS),
  local: z.string().trim().max(300).optional(),
  atividade: z.string().trim().max(300).optional(),
  severidadeReal: z.enum(NIVEIS_SEVERIDADE),
  severidadePotencial: z.enum(NIVEIS_SEVERIDADE),
  nivelInvestigacao: z.enum(NIVEIS_INVESTIGACAO),
  acoesImediatas: z.string().trim().max(5_000).optional(),
  localPreservado: z.boolean(),
  confidencialidade: z.enum(NIVEIS_CONFIDENCIALIDADE),
});

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

function opcional(valor: string): string | undefined {
  return valor.length > 0 ? valor : undefined;
}

/**
 * Gera o próximo código no formato INV-ANO-0000.
 *
 * A numeração é por organização e por ano. Colisão é possível se duas pessoas
 * abrirem investigação no mesmo segundo; por isso o código é apenas rótulo, e
 * a identidade real é o UUID.
 */
function proximoCodigo(existentes: string[], ano: number): string {
  const prefixo = `INV-${ano}-`;
  const usados = existentes
    .filter((c) => c.startsWith(prefixo))
    .map((c) => Number.parseInt(c.slice(prefixo.length), 10))
    .filter((n) => Number.isFinite(n));
  const proximo = (usados.length > 0 ? Math.max(...usados) : 0) + 1;
  return `${prefixo}${String(proximo).padStart(4, '0')}`;
}

/**
 * Converte a data do formulário (`datetime-local`, sem fuso) em ISO.
 *
 * Devolve `null` quando vazia ou inválida: data de ocorrência desconhecida é
 * situação legítima na notificação inicial, e mentir uma data seria pior.
 */
function instanteIso(valor: string | undefined): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export async function abrirInvestigacao(
  _anterior: EstadoInvestigacao,
  dados: FormData,
): Promise<EstadoInvestigacao> {
  const ator = await exigirAtor('/investigacoes/nova');
  const usuario = await obterUsuarioAtual();

  const permissao = autorizar(ator, 'investigacao.criar', { organizacaoId: ator.organizacaoId });
  if (!permissao.permitido) {
    return { erro: permissao.motivo };
  }

  const analise = esquemaAbertura.safeParse({
    titulo: texto(dados, 'titulo'),
    descricaoInicial: texto(dados, 'descricaoInicial'),
    codigo: opcional(texto(dados, 'codigo')),
    ocorridoEm: opcional(texto(dados, 'ocorridoEm')),
    precisaoOcorrencia: texto(dados, 'precisaoOcorrencia') || 'desconhecido',
    local: opcional(texto(dados, 'local')),
    atividade: opcional(texto(dados, 'atividade')),
    severidadeReal: texto(dados, 'severidadeReal') || 'nao_classificada',
    severidadePotencial: texto(dados, 'severidadePotencial') || 'nao_classificada',
    nivelInvestigacao: texto(dados, 'nivelInvestigacao') || 'nao_definido',
    acoesImediatas: opcional(texto(dados, 'acoesImediatas')),
    localPreservado: dados.get('localPreservado') === 'on',
    confidencialidade: texto(dados, 'confidencialidade') || 'interna',
  });

  if (!analise.success) {
    return {
      erro: 'Confira os campos destacados.',
      problemas: analise.error.issues.map((i) => i.message),
    };
  }

  const entrada = analise.data;
  const repo = await obterRepositorioBanco();
  const existentes = await repo.listarInvestigacoes(ator.organizacaoId);

  const codigo = entrada.codigo || proximoCodigo(existentes.map((i) => i.codigo), agora().getFullYear());
  if (existentes.some((i) => i.codigo.toLowerCase() === codigo.toLowerCase())) {
    return { erro: `Já existe uma investigação com o código ${codigo}.` };
  }

  const id = randomUUID();
  const instante = agora().toISOString();

  const investigacao: InvestigacaoCompleta = {
    ...dossieVazio(id),
    codigo,
    titulo: entrada.titulo,
    fase: 'notificacao',
    metadados: {
      organizacaoId: ator.organizacaoId,
      descricaoInicial: entrada.descricaoInicial,
      ocorridoEm: instanteIso(entrada.ocorridoEm),
      precisaoOcorrencia: entrada.precisaoOcorrencia,
      local: entrada.local ?? null,
      atividade: entrada.atividade ?? null,
      severidadeReal: entrada.severidadeReal,
      severidadePotencial: entrada.severidadePotencial,
      nivelInvestigacao: entrada.nivelInvestigacao,
      acoesImediatas: entrada.acoesImediatas ?? null,
      localPreservado: entrada.localPreservado,
      confidencialidade: entrada.confidencialidade,
      criadoEm: instante,
      atualizadoEm: instante,
      excluidoEm: null,
      versao: 0,
      // Quem abre entra na equipe: sem isso, investigação restrita ficaria
      // inacessível para o próprio autor na verificação de vínculo do ABAC.
      equipe: [
        {
          usuarioId: ator.usuarioId,
          nome: usuario?.nome ?? 'Responsável pela abertura',
          papel: 'lider',
          conflitoInteresse: false,
        },
      ],
      envolvidos: [],
      consequencias: [],
    },
  };

  await repo.salvarInvestigacao(investigacao);

  const contexto = await obterContextoRequisicao();
  await repo.registrarAuditoria({
    organizacaoId: ator.organizacaoId,
    usuarioId: ator.usuarioId,
    atorTipo: 'humano',
    acao: 'criar',
    entidadeTipo: 'investigacao',
    entidadeId: id,
    investigacaoId: id,
    depois: { codigo, titulo: entrada.titulo, fase: 'notificacao' },
    origemIp: contexto.origemIp,
    agenteUsuario: contexto.agenteUsuario,
  });

  revalidatePath('/');
  // `redirect` lança por dentro: precisa ficar fora de try/catch.
  redirect(`/investigacoes/${id}`);
}

// ---------------------------------------------------------------------------
// Rascunho assistido e decisões humanas sobre as propostas
// ---------------------------------------------------------------------------

interface ContextoEscrita {
  ator: Ator;
  repo: Repositorio;
  investigacao: InvestigacaoCompleta;
}

/**
 * Carrega a investigação já autorizada para escrita.
 *
 * Investigação de outra organização devolve "não encontrada", nunca "sem
 * permissão": a diferença entre as duas respostas revelaria a existência do
 * recurso.
 */
async function abrirParaEscrita(
  investigacaoId: string,
  acao: Acao,
): Promise<ContextoEscrita | { erro: string }> {
  const ator = await exigirAtor(`/investigacoes/${investigacaoId}`);
  const repo = await obterRepositorioBanco();
  const investigacao = await repo.obterInvestigacao(ator.organizacaoId, investigacaoId);
  if (!investigacao) return { erro: 'Investigação não encontrada.' };

  const permissao = autorizar(ator, acao, {
    organizacaoId: investigacao.metadados.organizacaoId,
    investigacaoId: investigacao.investigacaoId,
    confidencialidade: investigacao.metadados.confidencialidade as 'interna',
  });
  if (!permissao.permitido) return { erro: permissao.motivo };

  return { ator, repo, investigacao };
}

async function registrar(
  contexto: ContextoEscrita,
  entrada: {
    acao: string;
    entidadeTipo: string;
    entidadeId: string;
    atorTipo?: 'humano' | 'ia';
    antes?: unknown;
    depois?: unknown;
  },
): Promise<void> {
  const requisicao = await obterContextoRequisicao();
  await contexto.repo.registrarAuditoria({
    organizacaoId: contexto.ator.organizacaoId,
    usuarioId: contexto.ator.usuarioId,
    atorTipo: entrada.atorTipo ?? 'humano',
    acao: entrada.acao,
    entidadeTipo: entrada.entidadeTipo,
    entidadeId: entrada.entidadeId,
    investigacaoId: contexto.investigacao.investigacaoId,
    antes: entrada.antes,
    depois: entrada.depois,
    origemIp: requisicao.origemIp,
    agenteUsuario: requisicao.agenteUsuario,
  });
}

function revalidarInvestigacao(id: string): void {
  revalidatePath(`/investigacoes/${id}`, 'layout');
  revalidatePath('/');
}

export interface EstadoRascunho extends EstadoInvestigacao {
  resumo: ResumoRascunho | null;
  avisos: string[];
}

export const RASCUNHO_INICIAL: EstadoRascunho = { erro: null, resumo: null, avisos: [] };

/**
 * Gera o rascunho assistido a partir do relato inicial.
 *
 * Exige `ia.executar`: a permissão de rodar agentes é separada da de editar a
 * investigação, porque em provedor externo isso significa enviar conteúdo para
 * fora do ambiente.
 */
export async function gerarRascunho(
  _anterior: EstadoRascunho,
  dados: FormData,
): Promise<EstadoRascunho> {
  const investigacaoId = texto(dados, 'investigacaoId');
  const contexto = await abrirParaEscrita(investigacaoId, 'ia.executar');
  if ('erro' in contexto) return { ...RASCUNHO_INICIAL, erro: contexto.erro };

  const configuracao = lerConfiguracaoIa();
  let resultado;
  try {
    resultado = await montarRascunho(contexto.investigacao, obterProvedor(configuracao));
  } catch (e) {
    return {
      ...RASCUNHO_INICIAL,
      erro: `O rascunho não pôde ser gerado: ${e instanceof Error ? e.message : 'erro desconhecido'}`,
    };
  }

  await contexto.repo.salvarInvestigacao(resultado.investigacao);

  // Cada execução de agente fica registrada, mesmo quando a proposta for
  // recusada depois. É o que permite auditar o que a IA sugeriu e o que foi
  // aceito.
  for (const registro of resultado.registros) {
    await contexto.repo.registrarExecucaoIa(investigacaoId, registro);
  }

  await registrar(contexto, {
    acao: 'criar',
    entidadeTipo: 'rascunho_ia',
    entidadeId: investigacaoId,
    atorTipo: 'ia',
    depois: {
      provedor: configuracao.provedor,
      modelo: configuracao.modelo,
      ...resultado.resumo,
      avisos: resultado.avisos.length,
    },
  });

  revalidarInvestigacao(investigacaoId);
  return { erro: null, resumo: resultado.resumo, avisos: resultado.avisos };
}

export interface EstadoDecisao {
  erro: string | null;
  bloqueios?: string[];
  mensagem?: string | null;
}

export const DECISAO_INICIAL: EstadoDecisao = { erro: null, mensagem: null };

/**
 * Aceita ou recusa um fato proposto pela IA.
 *
 * Recusar remove a proposição do dossiê. Ela não se perde: o texto vai para o
 * campo `antes` da trilha de auditoria, que o banco impede de alterar ou
 * apagar. Manter proposta recusada no dossiê só produziria ruído nas
 * contagens do relatório.
 */
export async function decidirFato(
  _anterior: EstadoDecisao,
  dados: FormData,
): Promise<EstadoDecisao> {
  const investigacaoId = texto(dados, 'investigacaoId');
  const fatoId = texto(dados, 'fatoId');
  const decisao = texto(dados, 'decisao');

  const contexto = await abrirParaEscrita(investigacaoId, 'fato.aprovar');
  if ('erro' in contexto) return { erro: contexto.erro };

  const fato = contexto.investigacao.fatos.find((f) => f.id === fatoId);
  if (!fato) return { erro: 'Fato não encontrado nesta investigação.' };

  if (decisao === 'aceitar') {
    const atualizados = contexto.investigacao.fatos.map((f) =>
      f.id === fatoId ? { ...f, aprovadoPorHumano: true } : f,
    );
    await contexto.repo.salvarInvestigacao({ ...contexto.investigacao, fatos: atualizados });
    await registrar(contexto, {
      acao: 'aprovar',
      entidadeTipo: 'fato',
      entidadeId: fatoId,
      antes: { aprovadoPorHumano: false },
      depois: { aprovadoPorHumano: true, proposicao: fato.proposicao },
    });
    revalidarInvestigacao(investigacaoId);
    return { erro: null, mensagem: `${fato.identificador} aprovado.` };
  }

  if (decisao === 'rejeitar') {
    if (fato.aprovadoPorHumano) {
      return { erro: 'Este fato já foi aprovado. Reverter aprovação não é feito por aqui.' };
    }
    const atualizados = contexto.investigacao.fatos.filter((f) => f.id !== fatoId);
    // Classificações sustentadas apenas por este fato perderiam o alicerce.
    const classificacoes = contexto.investigacao.classificacoes.map((c) => ({
      ...c,
      sustentacoes: c.sustentacoes.filter((s) => s.fatoId !== fatoId),
    }));
    await contexto.repo.salvarInvestigacao({
      ...contexto.investigacao,
      fatos: atualizados,
      classificacoes,
    });
    await registrar(contexto, {
      acao: 'rejeitar',
      entidadeTipo: 'fato',
      entidadeId: fatoId,
      antes: { proposicao: fato.proposicao, tipoAssercao: fato.tipoAssercao, origemIa: fato.origemIa },
      depois: null,
    });
    revalidarInvestigacao(investigacaoId);
    return { erro: null, mensagem: `${fato.identificador} recusado e removido do dossiê.` };
  }

  return { erro: 'Decisão inválida.' };
}

/**
 * Confirma, edita ou rejeita uma classificação ICAM proposta.
 *
 * Confirmar passa pelos bloqueios da metodologia (`bloqueiosParaConfirmar`):
 * sem evidência favorável, sem mecanismo descrito ou com código genérico sem
 * justificativa, a confirmação é recusada com o motivo. Isso não é obstáculo
 * burocrático — é o que separa classificar de rotular.
 */
export async function decidirClassificacao(
  _anterior: EstadoDecisao,
  dados: FormData,
): Promise<EstadoDecisao> {
  const investigacaoId = texto(dados, 'investigacaoId');
  const classificacaoId = texto(dados, 'classificacaoId');
  const decisao = texto(dados, 'decisao');

  const contexto = await abrirParaEscrita(investigacaoId, 'classificacao.confirmar');
  if ('erro' in contexto) return { erro: contexto.erro };

  const atual = contexto.investigacao.classificacoes.find((c) => c.id === classificacaoId);
  if (!atual) return { erro: 'Classificação não encontrada nesta investigação.' };

  if (decisao === 'rejeitar') {
    const atualizadas = contexto.investigacao.classificacoes.map((c) =>
      c.id === classificacaoId
        ? { ...c, estado: 'rejeitado' as const, decisaoHumana: 'rejeitada' as const }
        : c,
    );
    await contexto.repo.salvarInvestigacao({
      ...contexto.investigacao,
      classificacoes: atualizadas,
    });
    await registrar(contexto, {
      acao: 'rejeitar',
      entidadeTipo: 'classificacao',
      entidadeId: classificacaoId,
      antes: { estado: atual.estado, decisaoHumana: atual.decisaoHumana },
      depois: { estado: 'rejeitado', decisaoHumana: 'rejeitada', codigo: atual.codigo },
    });
    revalidarInvestigacao(investigacaoId);
    return { erro: null, mensagem: `${atual.identificador} rejeitado.` };
  }

  if (decisao !== 'confirmar') return { erro: 'Decisão inválida.' };

  const mecanismo = texto(dados, 'mecanismo') || atual.mecanismo;
  const justificativaGenerico = texto(dados, 'justificativaGenerico') || atual.justificativaGenerico;
  const naturezaInformada = texto(dados, 'natureza');
  const natureza = (NATUREZAS_FATOR as readonly string[]).includes(naturezaInformada)
    ? (naturezaInformada as NaturezaFator)
    : atual.natureza;

  const favoraveis = atual.sustentacoes.filter((s) => s.sentido === 'favoravel');
  const temFonteObjetiva = favoraveis.some((s) => {
    const fato = contexto.investigacao.fatos.find((f) => f.id === s.fatoId);
    return fato ? TIPOS_ASSERCAO_FACTUAIS.includes(fato.tipoAssercao) : false;
  });

  const bloqueios = bloqueiosParaConfirmar({
    codigo: atual.codigo,
    mecanismo,
    quantidadeEvidenciasFavoraveis: favoraveis.length,
    temFonteObjetiva,
    justificativaGenerico,
  });

  if (bloqueios.length > 0) {
    return {
      erro: 'A confirmação foi barrada pelas regras da metodologia.',
      bloqueios: bloqueios.map((b) => b.motivo),
    };
  }

  const houveEdicao =
    mecanismo !== atual.mecanismo ||
    justificativaGenerico !== atual.justificativaGenerico ||
    natureza !== atual.natureza;

  const atualizadas = contexto.investigacao.classificacoes.map((c) =>
    c.id === classificacaoId
      ? {
          ...c,
          estado: 'confirmado' as const,
          // "Editada" e "aceita" são registros diferentes: mostra se a pessoa
          // apenas concordou ou se corrigiu o que a IA propôs.
          decisaoHumana: (houveEdicao ? 'editada' : 'aceita') as DecisaoHumana,
          mecanismo,
          justificativaGenerico,
          natureza,
        }
      : c,
  );

  await contexto.repo.salvarInvestigacao({ ...contexto.investigacao, classificacoes: atualizadas });
  await registrar(contexto, {
    acao: 'confirmar',
    entidadeTipo: 'classificacao',
    entidadeId: classificacaoId,
    antes: { estado: atual.estado, mecanismo: atual.mecanismo, natureza: atual.natureza },
    depois: { estado: 'confirmado', codigo: atual.codigo, mecanismo, natureza },
  });

  revalidarInvestigacao(investigacaoId);
  return { erro: null, mensagem: `${atual.identificador} confirmado.` };
}

/** Aprova ou recusa uma recomendação proposta, com responsável e prazo. */
export async function decidirRecomendacao(
  _anterior: EstadoDecisao,
  dados: FormData,
): Promise<EstadoDecisao> {
  const investigacaoId = texto(dados, 'investigacaoId');
  const recomendacaoId = texto(dados, 'recomendacaoId');
  const decisao = texto(dados, 'decisao');

  const contexto = await abrirParaEscrita(investigacaoId, 'recomendacao.aprovar');
  if ('erro' in contexto) return { erro: contexto.erro };

  const atual = contexto.investigacao.recomendacoes.find((r) => r.id === recomendacaoId);
  if (!atual) return { erro: 'Recomendação não encontrada nesta investigação.' };

  if (decisao === 'rejeitar') {
    const restantes = contexto.investigacao.recomendacoes.filter((r) => r.id !== recomendacaoId);
    await contexto.repo.salvarInvestigacao({ ...contexto.investigacao, recomendacoes: restantes });
    await registrar(contexto, {
      acao: 'rejeitar',
      entidadeTipo: 'recomendacao',
      entidadeId: recomendacaoId,
      antes: { acaoProposta: atual.acaoProposta, hierarquiaControle: atual.hierarquiaControle },
      depois: null,
    });
    revalidarInvestigacao(investigacaoId);
    return { erro: null, mensagem: `${atual.identificador} recusada e removida do plano.` };
  }

  if (decisao !== 'aprovar') return { erro: 'Decisão inválida.' };

  const responsavel = texto(dados, 'responsavel') || null;
  const prazo = texto(dados, 'prazo') || null;
  if (!responsavel || !prazo) {
    return {
      erro: 'Ação sem responsável e sem prazo não é plano de ação.',
      bloqueios: ['Informe quem responde pela ação e até quando.'],
    };
  }

  const atualizadas = contexto.investigacao.recomendacoes.map((r) =>
    r.id === recomendacaoId ? { ...r, status: 'aprovada', responsavel, prazo } : r,
  );
  await contexto.repo.salvarInvestigacao({ ...contexto.investigacao, recomendacoes: atualizadas });
  await registrar(contexto, {
    acao: 'aprovar',
    entidadeTipo: 'recomendacao',
    entidadeId: recomendacaoId,
    antes: { status: atual.status },
    depois: { status: 'aprovada', responsavel, prazo },
  });

  revalidarInvestigacao(investigacaoId);
  return { erro: null, mensagem: `${atual.identificador} aprovada.` };
}
