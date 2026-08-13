import type { Metadata } from 'next';
import Link from 'next/link';
import { BarraUsuario } from '@/componentes/BarraUsuario';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plataforma de investigação ICAM',
  description:
    'Condução e documentação de investigações de incidentes segundo a metodologia ICAM, com copiloto de IA auditável.',
};

const NAVEGACAO = [
  { href: '/', rotulo: 'Portfólio' },
  { href: '/catalogo', rotulo: 'Catálogo ICAM' },
  { href: '/agentes', rotulo: 'Governança de IA' },
  { href: '/auditoria', rotulo: 'Auditoria' },
];

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="link-pular">
          Pular para o conteúdo principal
        </a>

        <header className="border-b border-borda bg-superficie">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded bg-marca text-sm font-bold text-white"
              >
                IC
              </span>
              <span className="text-sm font-semibold text-texto">
                Plataforma de investigação ICAM
              </span>
            </Link>

            <div className="flex flex-wrap items-center gap-4">
              <nav aria-label="Navegação principal">
                <ul className="flex flex-wrap gap-1">
                  {NAVEGACAO.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="rounded px-3 py-2 text-sm text-texto-sutil hover:bg-superficie-forte hover:text-texto"
                      >
                        {item.rotulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <BarraUsuario />
            </div>
          </div>
        </header>

        <main id="conteudo" className="mx-auto max-w-7xl px-4 py-8">
          {children}
        </main>

        <footer className="mt-16 border-t border-borda bg-superficie">
          <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-texto-fraco">
            <p>
              A IA é copiloto do investigador. Nenhuma sugestão vira conclusão sem decisão humana
              registrada, e nenhum relatório é publicado sem as aprovações obrigatórias.
            </p>
            <p className="mt-1">
              Relatórios executivos usam função ou pseudônimo por padrão. Nomes e matrículas
              dependem de autorização específica e ficam registrados na trilha de auditoria.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
