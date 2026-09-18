/**
 * Regenera `dados/codigos-icam.json` a partir do catálogo completo do
 * aplicativo de investigação, trazendo os campos que a identificação local
 * usa para comparar.
 *
 * Por que isto existe: a primeira versão do catálogo enxuto guardou apenas
 * código, título, grupo e um pedaço da definição. Exemplos, termos
 * relacionados e regras de inclusão são justamente onde aparecem as palavras
 * que uma constatação de investigação realmente usa — "interjornada",
 * "faixa contínua", "etilotestes" — e sem eles a comparação trabalha cega.
 *
 * Uso, a partir da pasta `coleta`:
 *
 *     node scripts/enriquecer-catalogo.mjs
 *
 * Depois rode `npm test`: o gabarito em `dados/gabarito-icam.json` mede se a
 * mudança melhorou ou piorou o acerto. Enriquecer sem medir é palpite.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ORIGEM = join(AQUI, '..', '..', 'data', 'icam-taxonomy.pt-BR.json');
const DESTINO = join(AQUI, '..', 'dados', 'codigos-icam.json');

const COLUNA_POR_GRUPO = {
  fatores_organizacionais: 'organizacionais',
  condicoes_tarefa_ambiente: 'condicoes',
  fatores_humanos: 'condicoes',
  acoes_individuais_ou_equipe: 'acoes',
  defesas_ausentes_ou_falhas: 'defesas',
};

function texto(valor) {
  if (Array.isArray(valor)) return valor.filter((v) => typeof v === 'string').join(' ');
  return typeof valor === 'string' ? valor : '';
}

const completo = JSON.parse(readFileSync(ORIGEM, 'utf8'));

const codigos = completo.codigos.map((item) => {
  const coluna = COLUNA_POR_GRUPO[item.grupo];
  if (!coluna) throw new Error(`Grupo sem coluna mapeada: ${item.grupo} (${item.codigo})`);

  return {
    codigo: item.codigo,
    titulo: item.titulo,
    grupo: item.grupo,
    coluna,
    generico: Boolean(item.codigoGenerico),
    definicao: texto(item.definicao).slice(0, 700),
    // Tudo que ajuda a reconhecer o código em texto corrido, num campo só.
    termos: [
      texto(item.termosRelacionados),
      texto(item.exemplos),
      texto(item.regrasInclusao),
      texto(item.subgrupo).replace(/_/g, ' '),
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 900),
    // Guardado separado: serve para AFASTAR o código, não para aproximar.
    exclusoes: texto(item.regrasExclusao).slice(0, 500),
  };
});

const saida = {
  origem: 'derivado de data/icam-taxonomy.pt-BR.json do aplicativo de investigação ICAM',
  geradoEm: completo.geradoEm ?? null,
  total: codigos.length,
  codigos,
};

writeFileSync(DESTINO, `${JSON.stringify(saida, null, 1)}\n`, 'utf8');

const comTermos = codigos.filter((c) => c.termos.length > 0).length;
const comExclusoes = codigos.filter((c) => c.exclusoes.length > 0).length;
console.log(`${codigos.length} códigos gravados em dados/codigos-icam.json`);
console.log(`  com termos de reconhecimento: ${comTermos}`);
console.log(`  com regras de exclusão: ${comExclusoes}`);
console.log('\nAgora rode "npm test" e compare o acerto no gabarito antes e depois.');
