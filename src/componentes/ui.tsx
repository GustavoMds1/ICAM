import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Componentes de interface compartilhados.
 *
 * Diretrizes aplicadas (seção 11): português do Brasil, tom sóbrio, contraste
 * WCAG 2.2 AA, estados explícitos (vazio, erro, pendência, revisão), e nenhuma
 * cor usada como único portador de informação — todo selo traz texto.
 */

export function Cartao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cartao">
      {(titulo || acao) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="text-base font-semibold text-texto">{titulo}</h2>}
            {descricao && <p className="mt-1 text-sm text-texto-sutil">{descricao}</p>}
          </div>
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

type TomSelo = 'neutro' | 'ok' | 'alerta' | 'erro' | 'ia' | 'marca';

const TONS: Record<TomSelo, string> = {
  neutro: 'bg-superficie-forte text-texto-sutil border-borda-forte',
  ok: 'bg-ok-fundo text-ok border-ok',
  alerta: 'bg-alerta-fundo text-alerta border-alerta',
  erro: 'bg-erro-fundo text-erro border-erro',
  ia: 'bg-ia-fundo text-ia border-ia',
  marca: 'bg-marca-claro text-marca border-marca',
};

export function Selo({ tom = 'neutro', children }: { tom?: TomSelo; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}

export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-borda-forte bg-superficie-sutil p-8 text-center">
      <p className="font-medium text-texto">{titulo}</p>
      <p className="mx-auto mt-2 max-w-prose text-sm text-texto-sutil">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Aviso({
  tom = 'alerta',
  titulo,
  children,
}: {
  tom?: 'alerta' | 'erro' | 'ok' | 'ia';
  titulo: string;
  children?: ReactNode;
}) {
  const cores = {
    alerta: 'border-alerta bg-alerta-fundo',
    erro: 'border-erro bg-erro-fundo',
    ok: 'border-ok bg-ok-fundo',
    ia: 'border-ia bg-ia-fundo',
  } as const;
  const papel = tom === 'erro' ? 'alert' : 'status';

  return (
    <div role={papel} className={`rounded-md border-l-4 p-4 ${cores[tom]}`}>
      <p className="text-sm font-semibold text-texto">{titulo}</p>
      {children && <div className="mt-1 text-sm text-texto-sutil">{children}</div>}
    </div>
  );
}

export function Metrica({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-4">
      <dt className="text-sm text-texto-sutil">{rotulo}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-texto">{valor}</dd>
      {detalhe && <p className="mt-1 text-xs text-texto-fraco">{detalhe}</p>}
    </div>
  );
}

export function CampoLeitura({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="rotulo-campo">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-texto">{children}</dd>
    </div>
  );
}

/**
 * Citação clicável. Toda afirmação analítica exibida na interface deve trazer
 * a origem com localizador (princípio 3.4).
 */
export function Citacao({
  evidencia,
  localizador,
  href,
}: {
  evidencia: string;
  localizador: string | null;
  href?: string;
}) {
  const conteudo = (
    <>
      <span className="font-mono">{evidencia}</span>
      {localizador ? (
        <span className="text-texto-sutil"> · {localizador}</span>
      ) : (
        <span className="text-erro"> · sem localizador</span>
      )}
    </>
  );

  if (!href) {
    return <span className="text-xs">{conteudo}</span>;
  }
  return (
    <Link
      href={href}
      className="text-xs text-marca underline underline-offset-2 hover:text-marca-escuro"
    >
      {conteudo}
    </Link>
  );
}

export function ListaDefinicoes({ children }: { children: ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

export function Tabela({
  cabecalho,
  children,
  legenda,
}: {
  cabecalho: string[];
  children: ReactNode;
  legenda?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        {legenda && <caption className="sr-only">{legenda}</caption>}
        <thead>
          <tr>
            {cabecalho.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
