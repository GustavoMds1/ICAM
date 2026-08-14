import Link from 'next/link';
import { exigirAtor } from '@/servidor/sessao';
import { autorizar } from '@/seguranca/rbac';
import { Aviso } from '@/componentes/ui';
import { FormularioAbertura } from './FormularioAbertura';

export const dynamic = 'force-dynamic';

export default async function PaginaNovaInvestigacao() {
  const ator = await exigirAtor('/investigacoes/nova');
  const permissao = autorizar(ator, 'investigacao.criar', { organizacaoId: ator.organizacaoId });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-texto-sutil">
          <Link href="/" className="text-marca underline underline-offset-2">
            Portfólio
          </Link>{' '}
          / Nova investigação
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-texto">Notificação inicial</h1>
        <p className="mt-1 max-w-prose text-sm text-texto-sutil">
          Registre o evento como ele foi observado. Depois de abrir, a plataforma oferece o rascunho
          assistido: a IA propõe cronologia, fatos, classificação ICAM, causas e recomendações, e
          cada item só entra na investigação depois que você aprovar.
        </p>
      </div>

      {permissao.permitido ? (
        <FormularioAbertura />
      ) : (
        <Aviso tom="erro" titulo="Sem permissão para abrir investigação">
          {permissao.motivo} Procure um administrador se precisar deste acesso.
        </Aviso>
      )}
    </div>
  );
}
