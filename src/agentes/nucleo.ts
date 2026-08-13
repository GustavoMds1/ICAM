import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { NomeAgente } from '../domain/enumeracoes';
import { gerarDelimitador, neutralizarConteudo, type SinalizacaoInjecao } from '../seguranca/injecao';
import { validarSaida, type RegistroExecucao } from './contratos';
import {
  ErroSaidaInvalida,
  type BlocoDados,
  type PedidoAgente,
  type ProvedorIa,
} from './provedor/tipos';

/**
 * Núcleo de execução dos agentes.
 *
 * Todo agente passa por aqui, o que garante em um único ponto:
 *   - neutralização de prompt injection nos dados de entrada;
 *   - validação da saída contra o contrato Zod;
 *   - registro completo da execução para auditoria;
 *   - fallback determinístico quando não há provedor de modelo.
 */

export interface FonteBruta {
  rotulo: string;
  conteudo: string;
}

export interface EntradaAgente<TEntrada> {
  agente: NomeAgente;
  investigacaoId: string;
  dados: TEntrada;
  fontes?: FonteBruta[];
}

export interface ResultadoAgente<TSaida> {
  saida: TSaida;
  registro: RegistroExecucao;
  sinalizacoesInjecao: SinalizacaoInjecao[];
}

export interface DefinicaoAgente<TEntrada, TSaida> {
  nome: NomeAgente;
  esquemaSaida: z.ZodType<TSaida>;
  /** Instrução de sistema usada quando há provedor de modelo. */
  instrucao: string;
  /** Descrição textual do formato, enviada ao modelo. */
  formatoEsperado: string;
  /** Monta a tarefa concreta a partir da entrada. */
  montarTarefa(entrada: TEntrada): string;
  /** Implementação determinística — sempre disponível, sem chamada externa. */
  heuristica(entrada: TEntrada): TSaida;
}

export async function executarAgente<TEntrada, TSaida>(
  definicao: DefinicaoAgente<TEntrada, TSaida>,
  entrada: EntradaAgente<TEntrada>,
  provedor: ProvedorIa | null,
): Promise<ResultadoAgente<TSaida>> {
  const inicio = Date.now();
  const delimitador = gerarDelimitador();

  const blocos: BlocoDados[] = [];
  const sinalizacoes: SinalizacaoInjecao[] = [];
  for (const fonte of entrada.fontes ?? []) {
    const n = neutralizarConteudo(fonte.conteudo, fonte.rotulo, delimitador);
    blocos.push({ rotulo: fonte.rotulo, conteudo: n.texto });
    sinalizacoes.push(...n.sinalizacoes);
  }

  const entradaSerializada = JSON.stringify(entrada.dados);
  const entradaHash = createHash('sha256').update(entradaSerializada).digest('hex');
  const tarefa = definicao.montarTarefa(entrada.dados);

  let saidaBruta: unknown;
  let modelo: string | null = null;
  let erro: string | null = null;

  if (provedor) {
    const pedido: PedidoAgente = {
      agente: definicao.nome,
      instrucao: definicao.instrucao,
      tarefa,
      dados: blocos,
      formatoEsperado: definicao.formatoEsperado,
      temperatura: 0,
    };
    try {
      const r = await provedor.executar(pedido);
      saidaBruta = r.conteudo;
      modelo = r.modelo;
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
      // Falha do provedor externo não interrompe a investigação: cai para a
      // heurística local e o erro fica registrado na trilha de auditoria.
      saidaBruta = definicao.heuristica(entrada.dados);
    }
  } else {
    saidaBruta = definicao.heuristica(entrada.dados);
  }

  const validacao = validarSaida(definicao.esquemaSaida, saidaBruta);
  if (!validacao.ok) {
    throw new ErroSaidaInvalida(definicao.nome, validacao.erros);
  }

  const registro: RegistroExecucao = {
    agente: definicao.nome,
    provedor: provedor?.nome ?? 'deterministico',
    modelo,
    parametros: { temperatura: 0, delimitadorDados: delimitador },
    entradaHash,
    entradaResumo: tarefa.slice(0, 500),
    saida: validacao.dados,
    citacoesValidadas: false,
    sinalizacoes: sinalizacoes.map((s) => `${s.categoria}:${s.padrao}`),
    duracaoMs: Date.now() - inicio,
    erro,
  };

  return { saida: validacao.dados, registro, sinalizacoesInjecao: sinalizacoes };
}

/** Base comum das respostas analíticas, com validação humana sempre exigida. */
export function baseAnalitica(resposta: string, tipo: 'fato' | 'declaracao' | 'inferencia' | 'hipotese' | 'conflito' | 'lacuna') {
  return {
    resposta,
    tipo,
    evidencias_favoraveis: [] as never[],
    evidencias_contrarias: [] as never[],
    citacoes: [] as never[],
    premissas: [] as string[],
    confianca: 'baixa' as const,
    limitacoes: [] as string[],
    proximas_diligencias: [] as string[],
    requer_validacao_humana: true as const,
  };
}
