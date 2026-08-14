import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coleta de Dados ICAM',
  description:
    'Importa a coleta de dados da investigação, associa os códigos ICAM com apoio de IA e gera o slide de classificação.',
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b border-borda bg-white">
          <div className="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-4">
            <h1 className="text-lg font-semibold">Coleta de Dados ICAM</h1>
            <p className="text-xs text-sutil">Associação de códigos e geração do slide de classificação</p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
