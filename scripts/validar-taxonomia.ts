/**
 * Valida o catálogo ICAM versionado. Executado no CI e antes do build:
 * catálogo inconsistente é falha de build, não aviso.
 */
import { carregarCatalogo, conferirCatalogo } from '../src/domain/taxonomia/catalogo';

const catalogo = carregarCatalogo();
const conferencia = conferirCatalogo(catalogo);

console.log(`Catálogo ${catalogo.id} versão ${catalogo.versao}`);
console.log(`Total: ${conferencia.total}/${conferencia.totalEsperado}`);
for (const g of conferencia.porGrupo) {
  console.log(`  ${g.conforme ? 'OK ' : 'ERRO'} ${g.grupo}: ${g.encontrado}/${g.esperado}`);
}
console.log(`Duplicados: ${conferencia.duplicados.length === 0 ? 'nenhum' : conferencia.duplicados.join(', ')}`);
console.log(`Definições pendentes de importação: ${conferencia.semDefinicao}`);

if (conferencia.fontesPendentes.length > 0) {
  console.log('\nFontes de proveniência ainda não fornecidas:');
  for (const f of conferencia.fontesPendentes) {
    console.log(`  - ${f.arquivo} (${f.papel}): ${f.status}`);
  }
}

if (!conferencia.conforme) {
  console.error('\nCatálogo INCONSISTENTE com a seção 5 do prompt mestre.');
  process.exit(1);
}
console.log('\nEstrutura do catálogo conforme.');
