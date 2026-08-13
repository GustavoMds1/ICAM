import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Dossie } from '../domain/dossie';
import { agora } from '../domain/tempo/relogio';
import {
  HASH_GENESE,
  prepararRegistro,
  verificarCadeia,
  type EntradaAuditoria,
  type RegistroAuditoriaCalculado,
  type VerificacaoCadeia,
} from '../seguranca/auditoria';
import type { RegistroExecucao } from '../agentes/contratos';

/**
 * Camada de persistência.
 *
 * O produto acessa dados exclusivamente por esta interface. Isso permite duas
 * implementações sem tocar em regra de negócio:
 *
 *   - `RepositorioArquivo` — armazenamento em JSON versionado. É o padrão de
 *     desenvolvimento e demonstração: roda sem banco, sem Docker e sem
 *     download de binários, o que torna o fluxo vertical verificável de ponta
 *     a ponta em qualquer ambiente.
 *   - Adaptador PostgreSQL/Prisma — modelo em `prisma/schema.prisma`,
 *     destinado a produção (ver ENTREGA.md, item "limitações").
 *
 * Regras preservadas em qualquer implementação: exclusão lógica, histórico
 * imutável de auditoria, isolamento por organização e versionamento.
 */

export interface MetadadosInvestigacao {
  organizacaoId: string;
  descricaoInicial: string;
  ocorridoEm: string | null;
  precisaoOcorrencia: string;
  local: string | null;
  atividade: string | null;
  severidadeReal: string;
  severidadePotencial: string;
  nivelInvestigacao: string;
  acoesImediatas: string | null;
  localPreservado: boolean;
  confidencialidade: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm: string | null;
  versao: number;
  equipe: { usuarioId: string; nome: string; papel: string; conflitoInteresse: boolean }[];
  envolvidos: {
    id: string;
    tipo: string;
    pseudonimo: string;
    funcao: string | null;
    nome: string | null;
    matricula: string | null;
  }[];
  consequencias: { dimensao: string; tipo: string; descricao: string; nivel: string }[];
}

export interface InvestigacaoCompleta extends Dossie {
  metadados: MetadadosInvestigacao;
}

export interface Repositorio {
  listarInvestigacoes(organizacaoId: string): Promise<InvestigacaoCompleta[]>;
  obterInvestigacao(organizacaoId: string, id: string): Promise<InvestigacaoCompleta | null>;
  salvarInvestigacao(investigacao: InvestigacaoCompleta): Promise<InvestigacaoCompleta>;
  registrarAuditoria(entrada: EntradaAuditoria): Promise<RegistroAuditoriaCalculado>;
  listarAuditoria(organizacaoId: string, limite?: number): Promise<(RegistroAuditoriaCalculado & { id: string })[]>;
  verificarIntegridadeAuditoria(organizacaoId: string): Promise<VerificacaoCadeia>;
  registrarExecucaoIa(investigacaoId: string, registro: RegistroExecucao): Promise<void>;
  listarExecucoesIa(investigacaoId: string): Promise<(RegistroExecucao & { id: string; executadoEm: string })[]>;
}

interface Banco {
  investigacoes: Record<string, InvestigacaoCompleta>;
  auditoria: (RegistroAuditoriaCalculado & { id: string })[];
  execucoesIa: (RegistroExecucao & { id: string; investigacaoId: string; executadoEm: string })[];
}

const BANCO_VAZIO: Banco = { investigacoes: {}, auditoria: [], execucoesIa: [] };

export class RepositorioArquivo implements Repositorio {
  private cache: Banco | null = null;

  constructor(private readonly caminho: string) {}

  private async carregar(): Promise<Banco> {
    if (this.cache) return this.cache;
    if (!existsSync(this.caminho)) {
      this.cache = structuredClone(BANCO_VAZIO);
      return this.cache;
    }
    const bruto = await readFile(this.caminho, 'utf8');
    const dados = JSON.parse(bruto) as Partial<Banco>;
    this.cache = {
      investigacoes: dados.investigacoes ?? {},
      auditoria: (dados.auditoria ?? []).map((r) => ({ ...r, ocorridoEm: new Date(r.ocorridoEm) })),
      execucoesIa: dados.execucoesIa ?? [],
    };
    return this.cache;
  }

  private async gravar(): Promise<void> {
    const banco = await this.carregar();
    await mkdir(dirname(this.caminho), { recursive: true });
    await writeFile(this.caminho, JSON.stringify(banco, null, 2), 'utf8');
  }

  /** Invalida o cache — usado quando o arquivo é alterado por outro processo. */
  invalidar(): void {
    this.cache = null;
  }

  async listarInvestigacoes(organizacaoId: string): Promise<InvestigacaoCompleta[]> {
    const banco = await this.carregar();
    return Object.values(banco.investigacoes)
      .filter((i) => i.metadados.organizacaoId === organizacaoId && i.metadados.excluidoEm === null)
      .sort((a, b) => b.metadados.criadoEm.localeCompare(a.metadados.criadoEm));
  }

  async obterInvestigacao(organizacaoId: string, id: string): Promise<InvestigacaoCompleta | null> {
    const banco = await this.carregar();
    const inv =
      banco.investigacoes[id] ??
      Object.values(banco.investigacoes).find((i) => i.codigo === id) ??
      null;
    if (!inv) return null;
    // Isolamento: fora da organização, o recurso simplesmente não existe.
    if (inv.metadados.organizacaoId !== organizacaoId) return null;
    if (inv.metadados.excluidoEm !== null) return null;
    return inv;
  }

  async salvarInvestigacao(investigacao: InvestigacaoCompleta): Promise<InvestigacaoCompleta> {
    const banco = await this.carregar();
    const anterior = banco.investigacoes[investigacao.investigacaoId];
    const atualizada: InvestigacaoCompleta = {
      ...investigacao,
      metadados: {
        ...investigacao.metadados,
        versao: (anterior?.metadados.versao ?? 0) + 1,
        atualizadoEm: agora().toISOString(),
      },
    };
    banco.investigacoes[investigacao.investigacaoId] = atualizada;
    await this.gravar();
    return atualizada;
  }

  async registrarAuditoria(entrada: EntradaAuditoria): Promise<RegistroAuditoriaCalculado> {
    const banco = await this.carregar();
    const daOrganizacao = banco.auditoria.filter((r) => r.organizacaoId === entrada.organizacaoId);
    const ultimo = daOrganizacao[daOrganizacao.length - 1];
    const registro = prepararRegistro(entrada, ultimo?.hashRegistro ?? null);
    banco.auditoria.push({ ...registro, id: `AUD-${banco.auditoria.length + 1}` });
    await this.gravar();
    return registro;
  }

  async listarAuditoria(
    organizacaoId: string,
    limite = 100,
  ): Promise<(RegistroAuditoriaCalculado & { id: string })[]> {
    const banco = await this.carregar();
    return banco.auditoria
      .filter((r) => r.organizacaoId === organizacaoId)
      .slice(-limite)
      .reverse();
  }

  async verificarIntegridadeAuditoria(organizacaoId: string): Promise<VerificacaoCadeia> {
    const banco = await this.carregar();
    return verificarCadeia(banco.auditoria.filter((r) => r.organizacaoId === organizacaoId));
  }

  async registrarExecucaoIa(investigacaoId: string, registro: RegistroExecucao): Promise<void> {
    const banco = await this.carregar();
    banco.execucoesIa.push({
      ...registro,
      id: `IA-${banco.execucoesIa.length + 1}`,
      investigacaoId,
      executadoEm: agora().toISOString(),
    });
    await this.gravar();
  }

  async listarExecucoesIa(
    investigacaoId: string,
  ): Promise<(RegistroExecucao & { id: string; executadoEm: string })[]> {
    const banco = await this.carregar();
    return banco.execucoesIa.filter((e) => e.investigacaoId === investigacaoId).reverse();
  }
}

export const CAMINHO_PADRAO = join(process.cwd(), 'armazenamento', 'banco.json');

let instancia: RepositorioArquivo | null = null;

export function obterRepositorio(caminho = process.env.ARMAZENAMENTO_BANCO ?? CAMINHO_PADRAO): Repositorio {
  if (!instancia) instancia = new RepositorioArquivo(caminho);
  return instancia;
}

export function definirRepositorio(repo: RepositorioArquivo): void {
  instancia = repo;
}

export { HASH_GENESE };
