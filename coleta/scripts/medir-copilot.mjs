/**
 * Mede a versão do Copilot Studio contra o MESMO gabarito do aplicativo.
 *
 * Sem isto, a comparação entre as duas versões viraria impressão: "achei que
 * respondeu bem". O aplicativo tem um número medido; a versão nova precisa ser
 * medida pela mesma régua, nos mesmos 17 casos, ou não dá para escolher.
 *
 * Uso, a partir da pasta `coleta`:
 *
 *     node scripts/medir-copilot.mjs
 *
 * Lê `copilot-studio/resposta-do-agente.txt` — onde você cola a resposta do
 * agente inteira, sem editar.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, '..', 'dados');
const RESPOSTA = join(AQUI, '..', 'copilot-studio', 'resposta-do-agente.txt');

/**
 * Medição do aplicativo em 18/09/2026, para comparar lado a lado. Se você
 * rodar o MEDIR.bat e o número mudar, atualize aqui — referência velha é pior
 * que referência nenhuma, porque parece atual.
 */
const REFERENCIA_LOCAL = { topo1: 13, comAlternativa: 14, total: 17, altas: 5, altasCorretas: 5 };

if (!existsSync(RESPOSTA)) {
  console.error('[X] Não encontrei copilot-studio/resposta-do-agente.txt\n');
  console.error('    Cole a resposta do agente nesse arquivo e rode de novo.');
  console.error('    O bloco para enviar ao agente está em copilot-studio/3-BLOCO-DE-TESTE.txt');
  process.exit(1);
}

const gabarito = JSON.parse(readFileSync(join(DADOS, 'gabarito-icam.json'), 'utf8'));
const catalogo = JSON.parse(readFileSync(join(DADOS, 'codigos-icam.json'), 'utf8'));

const CASOS = gabarito.casos;
const VALIDOS = new Set(catalogo.codigos.map((c) => c.codigo.toUpperCase()));

/** "HF 21", "**HF21**", "hf-21" e "`HF21`" são o mesmo código. */
function normalizarCodigo(valor) {
  const limpo = (valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return limpo === '' || limpo === '-' ? '' : limpo;
}

function semAcento(valor) {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const respostas = new Map();
const invalidos = [];

for (const bruta of readFileSync(RESPOSTA, 'utf8').split(/\r?\n/)) {
  // Tira ruído de formatação que o modelo costuma acrescentar.
  const linha = bruta.replace(/[*`#]/g, '').replace(/^\s*[-–]\s*/, '').trim();
  if (!linha.includes('|')) continue;

  const partes = linha.split('|').map((p) => p.trim());

  // O formato tem seis campos. Exigir pelo menos três descarta as linhas da
  // seção "PARA CONFERIR" do fim da resposta, que também trazem número.
  if (partes.length < 3) continue;

  const numero = Number.parseInt((partes[0] ?? '').replace(/\D/g, ''), 10);
  if (!Number.isInteger(numero) || numero < 1 || numero > CASOS.length) continue;

  // Primeira ocorrência vence: a classificação vem antes de qualquer resumo,
  // e sobrescrever com uma linha de rodapé estragaria a medição em silêncio.
  if (respostas.has(numero)) continue;

  const codigo = normalizarCodigo(partes[1]);
  if (codigo !== '' && !VALIDOS.has(codigo)) invalidos.push(`item ${numero}: ${codigo}`);

  respostas.set(numero, {
    codigo,
    nivel: semAcento(partes[2]),
    confianca: semAcento(partes[3]),
    alternativa: normalizarCodigo(partes[4]),
  });
}

let topo1 = 0;
let comAlternativa = 0;
let altas = 0;
let altasCorretas = 0;
const faltando = [];
const detalhes = [];

CASOS.forEach((caso, i) => {
  const numero = i + 1;
  const r = respostas.get(numero);

  if (!r) {
    faltando.push(numero);
    detalhes.push(`  ${numero}. SEM RESPOSTA — esperado ${caso.esperado}`);
    return;
  }

  const acertou = r.codigo === caso.esperado.toUpperCase();
  const naAlternativa = r.alternativa === caso.esperado.toUpperCase();

  if (acertou) topo1 += 1;
  if (acertou || naAlternativa) comAlternativa += 1;
  if (r.confianca === 'alta') {
    altas += 1;
    if (acertou) altasCorretas += 1;
  }

  const marca = acertou ? 'OK ' : naAlternativa ? '~  ' : 'X  ';
  const nota = acertou
    ? `${caso.esperado}`
    : `respondeu ${r.codigo || '(vazio)'}, esperado ${caso.esperado}${naAlternativa ? ' (estava na alternativa)' : ''}`;

  detalhes.push(`  ${marca}${numero}. ${nota}  [${r.nivel || '?'}, ${r.confianca || '?'}]`);
  if (!acertou) detalhes.push(`        ${caso.texto}`);
});

const pct = (n) => `${Math.round((n / CASOS.length) * 100)}%`;

console.log('\n============================================================');
console.log('  VERSÃO COPILOT STUDIO, medida contra o mesmo gabarito');
console.log('============================================================\n');

console.log(`  casos: ${CASOS.length}`);
console.log(`  acerto no código principal: ${topo1}/${CASOS.length} (${pct(topo1)})`);
console.log(`  acerto contando a alternativa: ${comAlternativa}/${CASOS.length} (${pct(comAlternativa)})`);
console.log(
  altas > 0
    ? `  confiança alta: ${altasCorretas}/${altas} corretas`
    : '  confiança alta: o agente não declarou nenhuma',
);

console.log('\n  --- CASO A CASO ---');
for (const d of detalhes) console.log(d);

if (invalidos.length > 0) {
  console.log('\n  --- CÓDIGOS QUE NÃO EXISTEM NO CATÁLOGO ---');
  console.log('  O agente inventou código. Reforce no prompt que a lista é fechada.');
  for (const c of invalidos) console.log(`  ${c}`);
}

if (faltando.length > 0) {
  console.log(`\n  [!] Sem resposta para os itens: ${faltando.join(', ')}`);
  console.log('      Ou o agente pulou, ou a resposta foi colada incompleta.');
}

console.log('\n  --- LADO A LADO ---');
console.log(
  `  aplicativo (IA local): ${REFERENCIA_LOCAL.topo1}/${REFERENCIA_LOCAL.total}` +
    `, alta ${REFERENCIA_LOCAL.altasCorretas}/${REFERENCIA_LOCAL.altas}`,
);
console.log(
  `  Copilot Studio:        ${topo1}/${CASOS.length}` +
    (altas > 0 ? `, alta ${altasCorretas}/${altas}` : ', alta não declarada'),
);

console.log('\n  Leia os dois números juntos. Acerto maior com confiança alta');
console.log('  errada é pior negócio do que acerto menor e honesto: o primeiro');
console.log('  ensina quem revisa a aceitar sem conferir.\n');
