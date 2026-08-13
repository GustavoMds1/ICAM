/**
 * Aplica as migrações pendentes. Executado antes de cada implantação.
 *
 * Idempotente: rodar de novo não altera nada. Falha com código diferente de
 * zero se alguma migração não aplicar, o que aborta a implantação em vez de
 * subir a aplicação contra um banco inconsistente.
 */
import { abrirBanco, aplicarMigracoes, verificarSaude } from '../src/servidor/bd';

async function principal(): Promise<void> {
  const bd = await abrirBanco();

  const saude = await verificarSaude(bd);
  if (!saude.ok) {
    console.error(`Banco indisponível: ${saude.detalhe}`);
    process.exit(1);
  }
  console.log(`Conectado (${bd.motor}).`);

  const resultado = await aplicarMigracoes(bd);
  if (resultado.aplicadas.length > 0) {
    console.log(`Migrações aplicadas: ${resultado.aplicadas.join(', ')}`);
  } else {
    console.log(`Nenhuma migração pendente (${resultado.jaAplicadas.length} já aplicada(s)).`);
  }

  await bd.encerrar();
}

principal().catch((e: unknown) => {
  console.error('Falha ao migrar:', e);
  process.exit(1);
});
