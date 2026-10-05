/**
 * Monta a versão de arquivo único: `ICAM-Coleta.html`.
 *
 * Um arquivo só, com tudo dentro — programa, estilos e os 101 códigos. Abre
 * com duplo clique no Edge, sem servidor, sem instalação e sem rede.
 *
 * Por que arquivo ÚNICO e não uma pasta com vários: quando a página é aberta
 * de `file://`, o navegador bloqueia o carregamento de módulos vizinhos por
 * segurança. Uma pasta com `.js` e `.css` separados funcionaria servida pela
 * rede e falharia calada no duplo clique — que é justamente o caso de uso.
 *
 * Por que o Tailwind roda aqui dentro, e não pelo `npx tailwindcss`: chamar o
 * CLI abre outro processo e carrega dezenas de arquivos de `node_modules`.
 * Numa pasta sincronizada pelo OneDrive isso falha com "UNKNOWN: unknown
 * error, read" quando algum arquivo ainda não desceu. Rodando pelo PostCSS,
 * no mesmo processo, o caminho é bem mais curto e não depende do `npx`.
 *
 * Uso, a partir da pasta `coleta`:
 *
 *     node scripts/montar-navegador.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const SAIDA = join(RAIZ, 'ICAM-Coleta.html');
const ENTRADA_CSS = join(RAIZ, 'src', 'app', 'globals.css');

// ------------------------------------------------------------------- estilos
console.log('1/3  Gerando os estilos...');

const resultadoCss = await postcss([
  tailwindcss({ config: join(RAIZ, 'tailwind.config.ts') }),
  autoprefixer(),
]).process(readFileSync(ENTRADA_CSS, 'utf8'), { from: ENTRADA_CSS, to: undefined });

const css = resultadoCss.css;

if (!css.includes('.botao')) {
  throw new Error(
    'Os estilos saíram sem as classes do aplicativo. Confira o content do tailwind.config.ts.',
  );
}

// ------------------------------------------------------------------ programa
console.log('2/3  Empacotando o programa...');

const resultado = await esbuild.build({
  entryPoints: [join(RAIZ, 'navegador', 'entrada.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome110', 'edge110'],
  jsx: 'automatic',
  // `@/` é o atalho que o código usa para `src/`.
  alias: { '@': join(RAIZ, 'src') },
  loader: { '.json': 'json' },
  // Sem isto o pacote quebra ao procurar `process`, que não existe no
  // navegador. A IA externa fica desligada por construção nesta versão.
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.USAR_GEMINI': '"false"',
    'process.env.GEMINI_API_KEY': '""',
    'process.env.MODELO_IA': 'undefined',
  },
  write: false,
  logLevel: 'info',
});

const js = resultado.outputFiles[0].text;

if (!js || js.length < 1000) {
  throw new Error('O pacote saiu vazio ou pequeno demais. Algo falhou sem avisar.');
}

// -------------------------------------------------------------------- juntar
console.log('3/3  Montando o arquivo final...');

// `</script>` dentro de um texto do programa encerraria a tag cedo demais e
// quebraria a página inteira. Mesma armadilha vale para `</style>`.
const seguro = (texto) => texto.replace(/<\/(script|style)/gi, '<\\/$1');

const html = readFileSync(join(RAIZ, 'navegador', 'modelo.html'), 'utf8')
  .replace('/*ESTILOS*/', () => seguro(css))
  .replace('/*PROGRAMA*/', () => seguro(js));

writeFileSync(SAIDA, html, 'utf8');

const mb = (html.length / 1024 / 1024).toFixed(1);
console.log(`\nPronto: ICAM-Coleta.html (${mb} MB)`);
console.log('\nDuplo clique nele para abrir no navegador. Não precisa de mais nada.');
