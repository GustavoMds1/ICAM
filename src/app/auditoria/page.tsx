import { exigirAtor, obterRepositorioBanco } from '@/servidor/sessao';
import { autorizar } from '@/seguranca/rbac';
import { Aviso, Cartao, EstadoVazio, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaAuditoria() {
  const ator = await exigirAtor('/auditoria');
  const permissao = autorizar(ator, 'auditoria.ler', { organizacaoId: ator.organizacaoId });

  if (!permissao.permitido) {
    return (
      <Aviso tom="erro" titulo="Acesso negado">
        {permissao.motivo} Esta tentativa de acesso foi registrada.
      </Aviso>
    );
  }

  const repo = await obterRepositorioBanco();
  const registros = await repo.listarAuditoria(ator.organizacaoId, 200);
  const integridade = await repo.verificarIntegridadeAuditoria(ator.organizacaoId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trilha de auditoria</h1>
        <p className="mt-1 text-sm text-texto-sutil">
          Registro append-only de ações humanas e de IA, encadeado por hash.
        </p>
      </div>

      {integridade.integra ? (
        <Aviso tom="ok" titulo="Cadeia íntegra">
          {integridade.totalRegistros} registro(s) verificado(s). Nenhuma alteração ou remoção detectada.
        </Aviso>
      ) : (
        <Aviso tom="erro" titulo="Cadeia de auditoria quebrada">
          Quebra no registro {integridade.primeiraQuebra?.id} (posição {integridade.primeiraQuebra?.indice}):{' '}
          {integridade.primeiraQuebra?.motivo}
        </Aviso>
      )}

      <Cartao titulo="Registros">
        {registros.length === 0 ? (
          <EstadoVazio titulo="Nenhum registro" descricao="Ações sobre investigações, evidências, fatos e execuções de IA aparecem aqui." />
        ) : (
          <Tabela legenda="Registros de auditoria" cabecalho={['Quando', 'Ator', 'Ação', 'Entidade', 'Hash']}>
            {registros.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap font-mono text-xs tabular-nums">
                  {new Date(r.ocorridoEm).toISOString().replace('T', ' ').slice(0, 19)}
                </td>
                <td>
                  <Selo tom={r.atorTipo === 'ia' ? 'ia' : r.atorTipo === 'sistema' ? 'neutro' : 'marca'}>
                    {r.atorTipo}
                  </Selo>{' '}
                  <span className="text-xs text-texto-fraco">{r.usuarioId ?? '—'}</span>
                </td>
                <td className="text-xs">{r.acao}</td>
                <td className="font-mono text-xs">{r.entidadeTipo}:{r.entidadeId.slice(0, 16)}</td>
                <td className="font-mono text-xs text-texto-fraco">{r.hashRegistro.slice(0, 12)}…</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
    </div>
  );
}
