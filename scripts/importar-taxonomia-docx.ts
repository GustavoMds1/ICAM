/**
 * Importa as definições integrais dos 101 códigos ICAM a partir do documento
 * de origem ("Códigos metologia ICAM.docx") para o catálogo versionado.
 *
 * Este é o ÚNICO caminho autorizado para preencher `definicao`. Definições
 * nunca são geradas por modelo (princípio 3.1). Cada definição importada
 * recebe proveniência completa — arquivo, hash, localização e método — e
 * permanece marcada para conferência humana contra as imagens de referência.
 *
 * O documento é estruturado em TABELAS de duas colunas: código | conteúdo,
 * onde o conteúdo tem a forma "Título: definição. Por exemplo, ...".
 * A extração respeita essa estrutura em vez de tentar casar linhas de texto.
 *
 * Divergência entre o título extraído e o título já conferido no catálogo é
 * SINALIZADA para revisão humana, nunca resolvida em silêncio (seção 2).
 *
 * Uso: npm run taxonomia:importar-docx -- "caminho/para/Codigos.docx"
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { agora } from '../src/domain/tempo/relogio';

const CAMINHO_CATALOGO = join(process.cwd(), 'data', 'icam-taxonomy.pt-BR.json');

interface CodigoJson {
  codigo: string;
  grupo: string;
  titulo: string;
  definicao: string | null;
  definicaoStatus: string;
  exemplos: string[];
  termosRelacionados: string[];
  regrasInclusao: string[];
  regrasExclusao: string[];
  fonte: Record<string, unknown>;
  requerConferenciaHumana: boolean;
}

interface Catalogo {
  versao: string;
  estadoDefinicoes: string;
  avisoProveniencia: string;
  fontesPendentes: { arquivo: string; papel: string; status: string }[];
  codigos: CodigoJson[];
}

interface LinhaExtraida {
  codigo: string;
  titulo: string;
  definicao: string;
  exemplos: string[];
  localizacao: string;
  bruto: string;
}

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------

async function converterParaHtml(caminho: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const resultado = await mammoth.convertToHtml({ path: caminho });
    return resultado.value;
  } catch (e) {
    if (e instanceof Error && /Cannot find module|ERR_MODULE_NOT_FOUND/.test(e.message)) {
      throw new Error(
        'A extração de DOCX requer a dependência "mammoth". Instale com: npm install mammoth',
      );
    }
    throw e;
  }
}

function limparHtml(trecho: string): string {
  return trecho
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Normaliza "IT 01", "it1", "DF01" para a forma canônica do catálogo. */
function normalizarCodigo(bruto: string): string | null {
  const limpo = bruto.replace(/\s+/g, '').toUpperCase();
  const comNumero = /^([A-Z]{2})(\d{1,2})$/.exec(limpo);
  if (comNumero) {
    return `${comNumero[1]}${Number.parseInt(comNumero[2] ?? '0', 10).toString().padStart(2, '0')}`;
  }
  return /^[A-Z]{2}$/.test(limpo) ? limpo : null;
}

/**
 * Separa título e definição. O documento usa "Título: definição", e o título
 * pode conter travessão, barra e parênteses — mas não dois-pontos.
 */
function separarTituloDefinicao(corpo: string): { titulo: string; definicao: string } {
  const posicao = corpo.indexOf(':');
  if (posicao <= 0 || posicao > 120) {
    return { titulo: '', definicao: corpo };
  }
  return {
    titulo: corpo.slice(0, posicao).trim(),
    definicao: corpo.slice(posicao + 1).trim(),
  };
}

/**
 * Extrai os exemplos que o próprio documento fornece.
 *
 * Decisão deliberada: a definição NÃO é recortada. Algumas entradas da fonte
 * são compostas — DF17, por exemplo, retoma uma segunda subdefinição logo após
 * o exemplo. Remover o bloco de exemplos mutilaria a definição. Aqui os
 * exemplos são apenas apontados, e a definição permanece literal.
 *
 * Cada exemplo vai do marcador ("Por exemplo", "Os exemplos incluem") até o
 * fim da frase — inclusive quando o documento emenda a frase seguinte sem
 * espaço, como em "…canteiro de obras.Zonas de exclusão:".
 */
function extrairExemplos(corpo: string): string[] {
  const marcador = /(?:Por exemplo|Os exemplos incluem|Exemplos?:)/gi;
  const exemplos: string[] = [];

  let acerto: RegExpExecArray | null = marcador.exec(corpo);
  while (acerto !== null) {
    const inicio = acerto.index;
    const restante = corpo.slice(inicio + acerto[0].length);
    const fim = /\.(?=\s+[A-ZÀ-Ú]|[A-ZÀ-Ú]|\s*$)/.exec(restante);
    const trecho = (
      fim ? corpo.slice(inicio, inicio + acerto[0].length + fim.index + 1) : corpo.slice(inicio)
    ).trim();

    if (trecho.length > acerto[0].length + 5) exemplos.push(trecho);
    acerto = marcador.exec(corpo);
  }

  return exemplos;
}

function extrairLinhas(html: string): LinhaExtraida[] {
  const padraoLinha = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
  const linhas: LinhaExtraida[] = [];
  const vistos = new Set<string>();

  let indice = 0;
  let acerto: RegExpExecArray | null = padraoLinha.exec(html);
  while (acerto !== null) {
    indice += 1;
    const codigo = normalizarCodigo(limparHtml(acerto[1] ?? ''));
    const corpo = limparHtml(acerto[2] ?? '').replace(/\n/g, ' ');
    acerto = padraoLinha.exec(html);

    if (!codigo || corpo.length === 0) continue; // linha de cabeçalho ou vazia
    if (vistos.has(codigo)) continue; // primeira ocorrência prevalece
    vistos.add(codigo);

    const { titulo, definicao } = separarTituloDefinicao(corpo);
    const exemplos = extrairExemplos(definicao);

    linhas.push({
      codigo,
      titulo,
      definicao,
      exemplos,
      localizacao: `tabela, linha ${indice}`,
      bruto: corpo,
    });
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Conferência
// ---------------------------------------------------------------------------

function normalizarParaComparar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

interface Divergencia {
  codigo: string;
  tituloCatalogo: string;
  tituloDocumento: string;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

async function principal(): Promise<void> {
  const caminhoDocx = process.argv[2];
  if (!caminhoDocx) {
    console.error('Uso: npm run taxonomia:importar-docx -- "caminho/para/Codigos.docx"');
    process.exit(1);
  }
  if (!existsSync(caminhoDocx)) {
    console.error(`Arquivo não encontrado: ${caminhoDocx}`);
    process.exit(1);
  }

  const bytes = await readFile(caminhoDocx);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const nomeArquivo = caminhoDocx.split(/[\\/]/).pop() ?? caminhoDocx;

  const html = await converterParaHtml(caminhoDocx);
  const extraidas = new Map(extrairLinhas(html).map((l) => [l.codigo, l]));

  const catalogo = JSON.parse(await readFile(CAMINHO_CATALOGO, 'utf8')) as Catalogo;

  let importadas = 0;
  let semDefinicao = 0;
  const divergencias: Divergencia[] = [];
  const naoEncontrados: string[] = [];
  const semDefinicaoNaFonte: string[] = [];
  const instante = agora().toISOString();

  for (const codigo of catalogo.codigos) {
    const linha = extraidas.get(codigo.codigo);

    if (!linha) {
      // Melhor uma lacuna explícita do que uma definição aproximada.
      naoEncontrados.push(codigo.codigo);
      semDefinicao += 1;
      continue;
    }

    // O código existe na fonte, mas a fonte não define nada além do rótulo.
    // Registrar isso é diferente de não ter encontrado o código — e continua
    // sendo motivo para NÃO preencher a definição por outros meios.
    if (linha.definicao.length < 20) {
      semDefinicaoNaFonte.push(codigo.codigo);
      semDefinicao += 1;
      codigo.definicao = null;
      codigo.definicaoStatus = 'SEM_DEFINICAO_NA_FONTE';
      codigo.requerConferenciaHumana = true;
      codigo.fonte = {
        arquivo: nomeArquivo,
        hashSha256: hash,
        metodoExtracao: 'mammoth_convert_to_html + parse_tabela',
        extraidoEm: instante,
        localizacao: linha.localizacao,
        trecho: linha.bruto,
        confianca: 'alta',
        escopo: 'ausencia_de_definicao_confirmada',
        observacao:
          'O código consta do documento de origem, mas o documento não fornece definição além do rótulo. ' +
          'A ausência foi confirmada na fonte e não deve ser preenchida por inferência.',
      };
      continue;
    }

    if (
      linha.titulo.length > 0 &&
      normalizarParaComparar(linha.titulo) !== normalizarParaComparar(codigo.titulo)
    ) {
      divergencias.push({
        codigo: codigo.codigo,
        tituloCatalogo: codigo.titulo,
        tituloDocumento: linha.titulo,
      });
    }

    codigo.definicao = linha.definicao;
    codigo.definicaoStatus = 'IMPORTADA';
    codigo.exemplos = linha.exemplos;
    codigo.requerConferenciaHumana = true;
    codigo.fonte = {
      arquivo: nomeArquivo,
      hashSha256: hash,
      metodoExtracao: 'mammoth_convert_to_html + parse_tabela',
      extraidoEm: instante,
      localizacao: linha.localizacao,
      trecho: linha.bruto.slice(0, 240),
      confianca: 'media',
      escopo: 'definicao_e_exemplos',
      observacao:
        'Definição extraída da tabela do documento de origem. Conferir contra as 11 imagens de referência antes de marcar como CONFERIDA.',
      tituloNoDocumento: linha.titulo,
    };
    importadas += 1;
  }

  catalogo.estadoDefinicoes =
    semDefinicao === 0 ? 'COMPLETO' : importadas > 0 ? 'PARCIAL' : 'INCOMPLETO';
  catalogo.versao = `${catalogo.versao.replace(/\+docx.*$/, '')}+docx`;
  catalogo.fontesPendentes = catalogo.fontesPendentes.map((f) =>
    f.papel === 'fonte_principal_definicoes'
      ? { ...f, arquivo: nomeArquivo, status: 'IMPORTADO' }
      : f,
  );
  catalogo.avisoProveniencia =
    `Catálogo com ${catalogo.codigos.length} códigos. Código, grupo e título foram conferidos contra o prompt mestre; ` +
    `${importadas} definições e seus exemplos foram importados de "${nomeArquivo}" (SHA-256 ${hash.slice(0, 16)}…). ` +
    'Nenhuma definição foi gerada por IA. Todas permanecem marcadas para conferência humana contra as 11 imagens de referência.';

  await writeFile(CAMINHO_CATALOGO, `${JSON.stringify(catalogo, null, 2)}\n`, 'utf8');

  console.log(`Arquivo:  ${nomeArquivo}`);
  console.log(`SHA-256:  ${hash}`);
  console.log(`Linhas de tabela reconhecidas: ${extraidas.size}`);
  console.log(`Definições importadas: ${importadas}`);
  console.log(`Ainda pendentes: ${semDefinicao}`);
  if (naoEncontrados.length > 0) {
    console.log(`  Não encontrados no documento: ${naoEncontrados.join(', ')}`);
  }
  if (semDefinicaoNaFonte.length > 0) {
    console.log(
      `  Presentes na fonte, porém sem definição no documento: ${semDefinicaoNaFonte.join(', ')}`,
    );
  }

  if (divergencias.length > 0) {
    console.log(`\nDIVERGÊNCIAS DE TÍTULO — ${divergencias.length} caso(s) para revisão humana:`);
    for (const d of divergencias) {
      console.log(`  ${d.codigo}`);
      console.log(`    catálogo:  ${d.tituloCatalogo}`);
      console.log(`    documento: ${d.tituloDocumento}`);
    }
    console.log(
      '\nO título do catálogo foi PRESERVADO. Confira qual versão é a correta antes de alterar.',
    );
  } else {
    console.log('\nNenhuma divergência entre os títulos do catálogo e os do documento.');
  }

  console.log('\nTodas as definições importadas permanecem marcadas para conferência humana.');
}

principal().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
