import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Camada de acesso ao PostgreSQL.
 *
 * Dois motores, o MESMO SQL:
 *   - `pg` contra um PostgreSQL real, em produção;
 *   - PGlite (PostgreSQL compilado para WebAssembly) em teste e desenvolvimento.
 *
 * PGlite não é um simulador: é o próprio PostgreSQL. Isso permite verificar as
 * migrações e todas as consultas contra o motor real, sem depender de um
 * servidor instalado — o que torna a suíte de testes uma verificação de
 * verdade, e não uma aproximação.
 */

export interface ResultadoConsulta<T> {
  linhas: T[];
  contagem: number;
}

export interface Banco {
  consultar<T = Record<string, unknown>>(sql: string, parametros?: unknown[]): Promise<ResultadoConsulta<T>>;
  executar(sql: string): Promise<void>;
  transacao<T>(operacao: (bd: Banco) => Promise<T>): Promise<T>;
  encerrar(): Promise<void>;
  readonly motor: 'pg' | 'pglite';
}

// ---------------------------------------------------------------------------
// PostgreSQL real (produção)
// ---------------------------------------------------------------------------

interface ClientePg {
  query(texto: string, valores?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  release?(): void;
}

interface PoolPg {
  query(texto: string, valores?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  connect(): Promise<ClientePg>;
  end(): Promise<void>;
}

class BancoPg implements Banco {
  readonly motor = 'pg' as const;

  constructor(private readonly pool: PoolPg) {}

  async consultar<T>(sql: string, parametros: unknown[] = []): Promise<ResultadoConsulta<T>> {
    const r = await this.pool.query(sql, parametros);
    return { linhas: r.rows as T[], contagem: r.rowCount ?? r.rows.length };
  }

  async executar(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transacao<T>(operacao: (bd: Banco) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    const escopo: Banco = {
      motor: 'pg',
      consultar: async <U>(sql: string, p: unknown[] = []) => {
        const r = await cliente.query(sql, p);
        return { linhas: r.rows as U[], contagem: r.rowCount ?? r.rows.length };
      },
      executar: async (sql: string) => {
        await cliente.query(sql);
      },
      transacao: async (op) => op(escopo), // transação aninhada reutiliza a atual
      encerrar: async () => {},
    };

    try {
      await cliente.query('BEGIN');
      const resultado = await operacao(escopo);
      await cliente.query('COMMIT');
      return resultado;
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release?.();
    }
  }

  async encerrar(): Promise<void> {
    await this.pool.end();
  }
}

// ---------------------------------------------------------------------------
// PGlite (teste e desenvolvimento)
// ---------------------------------------------------------------------------

interface ClientePglite {
  query(texto: string, valores?: unknown[]): Promise<{ rows: unknown[]; affectedRows?: number }>;
  exec(texto: string): Promise<unknown>;
  transaction<T>(op: (tx: ClientePglite) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class BancoPglite implements Banco {
  readonly motor = 'pglite' as const;

  constructor(private readonly cliente: ClientePglite) {}

  async consultar<T>(sql: string, parametros: unknown[] = []): Promise<ResultadoConsulta<T>> {
    const r = await this.cliente.query(sql, parametros);
    // Em UPDATE/DELETE não há linhas retornadas: a contagem vem de affectedRows.
    return { linhas: r.rows as T[], contagem: r.affectedRows ?? r.rows.length };
  }

  async executar(sql: string): Promise<void> {
    await this.cliente.exec(sql);
  }

  async transacao<T>(operacao: (bd: Banco) => Promise<T>): Promise<T> {
    return this.cliente.transaction(async (tx) => {
      const escopo: Banco = {
        motor: 'pglite',
        consultar: async <U>(sql: string, p: unknown[] = []) => {
          const r = await tx.query(sql, p);
          return { linhas: r.rows as U[], contagem: r.affectedRows ?? r.rows.length };
        },
        executar: async (sql: string) => {
          await tx.exec(sql);
        },
        transacao: async (op) => op(escopo),
        encerrar: async () => {},
      };
      return operacao(escopo);
    });
  }

  async encerrar(): Promise<void> {
    await this.cliente.close();
  }
}

// ---------------------------------------------------------------------------
// Abertura de conexão
// ---------------------------------------------------------------------------

export interface OpcoesBanco {
  urlConexao?: string;
  /** Caminho de dados do PGlite; `memory://` para efêmero. */
  caminhoPglite?: string;
  ssl?: boolean;
}

export async function abrirBanco(opcoes: OpcoesBanco = {}): Promise<Banco> {
  const url = opcoes.urlConexao ?? process.env.DATABASE_URL ?? '';

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const { Pool } = (await import('pg')) as unknown as { Pool: new (c: unknown) => PoolPg };
    const precisaSsl = opcoes.ssl ?? process.env.DATABASE_SSL !== 'false';
    const pool = new Pool({
      connectionString: url,
      max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
      // Provedores gerenciados exigem TLS, geralmente com certificado próprio.
      ssl: precisaSsl ? { rejectUnauthorized: false } : false,
    });
    return new BancoPg(pool);
  }

  const { PGlite } = (await import('@electric-sql/pglite')) as unknown as {
    PGlite: new (caminho?: string) => ClientePglite;
  };
  const caminho = opcoes.caminhoPglite ?? process.env.PGLITE_CAMINHO ?? undefined;
  return new BancoPglite(caminho ? new PGlite(caminho) : new PGlite());
}

// ---------------------------------------------------------------------------
// Migrações
// ---------------------------------------------------------------------------

export interface ResultadoMigracao {
  aplicadas: string[];
  jaAplicadas: string[];
}

/**
 * Aplica as migrações pendentes, em ordem de nome de arquivo, cada uma em sua
 * própria transação. Idempotente: rodar de novo não faz nada.
 */
export async function aplicarMigracoes(
  bd: Banco,
  diretorio = join(process.cwd(), 'db', 'migracoes'),
): Promise<ResultadoMigracao> {
  await bd.executar(
    'CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())',
  );

  const arquivos = (await readdir(diretorio)).filter((a) => a.endsWith('.sql')).sort();
  const existentes = await bd.consultar<{ nome: string }>('SELECT nome FROM migracoes');
  const aplicadasAntes = new Set(existentes.linhas.map((l) => l.nome));

  const aplicadas: string[] = [];
  const jaAplicadas: string[] = [];

  for (const arquivo of arquivos) {
    if (aplicadasAntes.has(arquivo)) {
      jaAplicadas.push(arquivo);
      continue;
    }
    const sql = await readFile(join(diretorio, arquivo), 'utf8');
    await bd.transacao(async (tx) => {
      await tx.executar(sql);
      await tx.consultar('INSERT INTO migracoes (nome) VALUES ($1)', [arquivo]);
    });
    aplicadas.push(arquivo);
  }

  return { aplicadas, jaAplicadas };
}

/** Verificação de saúde usada pelo endpoint /api/saude e pelo provedor de nuvem. */
export async function verificarSaude(bd: Banco): Promise<{ ok: boolean; detalhe: string }> {
  try {
    const r = await bd.consultar<{ um: number }>('SELECT 1 AS um');
    return r.linhas[0]?.um === 1
      ? { ok: true, detalhe: `banco respondendo (${bd.motor})` }
      : { ok: false, detalhe: 'resposta inesperada do banco' };
  } catch (e) {
    return { ok: false, detalhe: e instanceof Error ? e.message : 'falha desconhecida' };
  }
}
