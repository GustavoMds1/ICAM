import { describe, expect, it } from 'vitest';
import gabarito from '../dados/gabarito-icam.json';
import { identificarCodigo } from '@/lib/localIcam';
import { lexicoInvalido, LEXICO } from '@/lib/lexicoIcam';
import { CODIGOS, ORDEM_COLUNAS, obterCodigo } from '@/lib/codigos';
import { bigramas, indicaAusencia, radical, radicais } from '@/lib/texto';
import type { CategoriaPeepo } from '@/lib/pptxLeitura';

/**
 * Medição da identificação local contra o gabarito.
 *
 * O gabarito são os códigos que uma equipe de investigação atribuiu de fato,
 * no slide de classificação de um evento real. É a única régua honesta: acerto
 * contra exemplo inventado por quem escreveu o classificador não mede nada.
 *
 * Dois casos do gabarito têm texto idêntico e códigos diferentes, porque foi
 * assim que a equipe classificou. Nenhum método acerta os dois — e é bom que
 * o número reflita isso em vez de esconder.
 */

interface Caso {
  texto: string;
  categoria: string;
  esperado: string;
  ambiguo?: string;
}

const CASOS = (gabarito as { casos: Caso[] }).casos;

/**
 * Diagnóstico de um erro: por que o código errado ganhou.
 *
 * Sem isto, calibrar vira adivinhação — dá para ver que errou, mas não se o
 * código certo ficou em segundo por pouco ou nem pontuou, nem qual sinal
 * empurrou o vencedor. São informações diferentes e pedem correções opostas.
 */
function explicarErro(caso: Caso, r: ReturnType<typeof identificarCodigo>): string {
  const posicao = r.ranking.findIndex((a) => a.codigo.codigo === caso.esperado);
  const esperado = posicao >= 0 ? r.ranking[posicao]! : null;
  const vencedor = r.ranking[0]!;

  const linhas = [
    `  ${caso.esperado} → ${vencedor.codigo.codigo}  (${r.confianca}, margem ${Math.round(r.margem * 100)}%)`,
    `     texto: ${caso.texto}`,
    `     ganhou ${vencedor.codigo.codigo} com ${vencedor.pontuacao.toFixed(2)} — ${vencedor.sinais.join(' + ') || 'nenhum sinal'}`,
  ];

  if (esperado) {
    linhas.push(
      `     ${caso.esperado} ficou em ${posicao + 1}º com ${esperado.pontuacao.toFixed(2)} — ${esperado.sinais.join(' + ') || 'nenhum sinal'}`,
    );
  } else {
    linhas.push(`     ${caso.esperado} não pontuou nada`);
  }

  return linhas.join('\n');
}

function avaliar() {
  let topo1 = 0;
  let topo3 = 0;
  /**
   * Acerto que caiu num código "Outro fator". Conta como acerto — a equipe
   * usou esse código mesmo —, mas não é o classificador reconhecendo um modo
   * de falha: é ele reproduzindo "isto não cabe na taxonomia". Sem separar,
   * o total esconde a diferença.
   */
  let acertosGenericos = 0;
  const erros: string[] = [];
  const acertos: string[] = [];
  const altaCorreta: boolean[] = [];

  for (const caso of CASOS) {
    const r = identificarCodigo(caso.texto, caso.categoria as CategoriaPeepo);
    const tresPrimeiros = r.ranking.slice(0, 3).map((a) => a.codigo.codigo);

    if (r.melhor.codigo === caso.esperado) {
      topo1 += 1;
      if (r.melhor.generico) acertosGenericos += 1;
      acertos.push(
        `  ${caso.esperado} (${r.confianca}, ${r.ranking[0]!.pontuacao.toFixed(2)}) — ${r.ranking[0]!.sinais[0] ?? 'sem sinal'}`,
      );
    } else {
      erros.push(explicarErro(caso, r));
    }

    if (tresPrimeiros.includes(caso.esperado)) topo3 += 1;
    if (r.confianca === 'alta') altaCorreta.push(r.melhor.codigo === caso.esperado);
  }

  return {
    total: CASOS.length,
    topo1,
    topo3,
    acertosGenericos,
    erros,
    acertos,
    altas: altaCorreta.length,
    altasCorretas: altaCorreta.filter(Boolean).length,
  };
}

describe('qualidade da identificação local', () => {
  it('relata o desempenho medido', () => {
    const r = avaliar();
    const pct = (n: number) => `${Math.round((n / r.total) * 100)}%`;

    console.log(`\n  casos: ${r.total}`);
    console.log(`  acerto em 1º lugar: ${r.topo1}/${r.total} (${pct(r.topo1)})`);
    console.log(`  acerto entre os 3 primeiros: ${r.topo3}/${r.total} (${pct(r.topo3)})`);
    console.log(`  confiança alta: ${r.altasCorretas}/${r.altas} corretas`);
    console.log(
      `  desses acertos, em código "Outro fator": ${r.acertosGenericos}` +
        ' (acerto de verdade, mas não é reconhecer o modo de falha)',
    );

    console.log('\n  --- ACERTOS ---');
    for (const a of r.acertos) console.log(a);

    console.log('\n  --- ERROS, com o motivo ---');
    for (const e of r.erros) console.log(`${e}\n`);

    // Qual catálogo está em uso. Esta linha nasceu de uma medição em que os
    // números vieram idênticos até a segunda casa depois de "enriquecer" o
    // catálogo. A suspeita era cache; a resposta, que o catálogo já estava
    // completo desde o começo. Sem imprimir o que está em uso, os dois casos
    // são indistinguíveis — e levam a correções opostas.
    const comTermos = CODIGOS.filter((c) => (c.termos ?? '').length > 0).length;
    console.log(
      `\n  --- CATÁLOGO EM USO: ${CODIGOS.length} códigos, ${comTermos} com termos de reconhecimento ---`,
    );

    // Controles: texto sem relação nenhuma e texto com sinal forte. Servem
    // para calibrar os limiares olhando número, não impressão.
    console.log('  --- CONTROLES ---');
    for (const [rotulo, texto] of [
      ['sem relação', 'O céu estava azul e a banda tocou uma valsa antiga na praça.'],
      ['sinal forte', 'Não foi realizado simulado de emergência com o ônibus.'],
      ['frase curta', 'O equipamento estava em ordem.'],
    ] as [string, string][]) {
      const c = identificarCodigo(texto);
      console.log(
        `  ${rotulo}: ${c.melhor.codigo} ${c.ranking[0]!.pontuacao.toFixed(2)} (${c.confianca}, margem ${Math.round(c.margem * 100)}%)`,
      );
    }

    expect(r.total).toBeGreaterThan(10);
  });

  /**
   * Os pisos existem para impedir regressão silenciosa: mexer nos pesos e
   * piorar o acerto sem ninguém perceber é o jeito mais fácil de estragar
   * isto.
   *
   * Estão fixados na medição de 18/09/2026, depois da calibragem: 13/17 em
   * primeiro lugar e 14/17 entre os três primeiros. Suba-os sempre que uma
   * medição nova trouxer número melhor; piso folgado não protege de nada.
   *
   * Se mexer no catálogo ou nos pesos piorar o acerto, é aqui que aparece.
   */
  it('acerta o código em primeiro lugar numa parcela razoável dos casos', () => {
    const r = avaliar();
    expect(r.topo1 / r.total).toBeGreaterThanOrEqual(0.76);
  });

  it('traz o código certo entre os três primeiros na maioria', () => {
    const r = avaliar();
    expect(r.topo3 / r.total).toBeGreaterThanOrEqual(0.82);
  });

  /**
   * A regra mais importante do arquivo. "Confiança alta" que erra é pior do
   * que não ter confiança nenhuma: ensina a aceitar sem conferir.
   *
   * Na primeira medição este teste reprovou — 6 de 9 —, e foi ele que
   * encontrou o defeito: uma regra ligava "check list" a um código de
   * barreira, e constatação de investigação cita o check list como fonte do
   * achado, não como assunto. Erro confiante, o pior tipo.
   *
   * Se voltar a reprovar, o caminho é o mesmo: olhe quais códigos aparecem
   * nos erros marcados "(alta)" e desconfie da regra de léxico que os produz,
   * não do limiar.
   */
  it('quando diz confiança alta, está certo', () => {
    const r = avaliar();
    if (r.altas === 0) return;
    expect(r.altasCorretas / r.altas).toBeGreaterThanOrEqual(0.8);
  });
});

describe('comportamento do motor', () => {
  it('texto sem relação com o catálogo não recebe confiança alta', () => {
    const r = identificarCodigo('O céu estava azul e a banda tocou uma valsa antiga.');
    expect(r.confianca).not.toBe('alta');
  });

  it('código genérico só vence quando nada mais pontua', () => {
    const especifico = identificarCodigo(
      'Identificado na folha de ponto que a interjornada foi menor que a prevista na norma.',
      'pessoas',
    );
    expect(especifico.melhor.generico).toBe(false);
  });

  it('devolve alternativas para a pessoa comparar', () => {
    const r = identificarCodigo('Não foi apresentada evidência de treinamento do colaborador.', 'procedimentos');
    expect(r.alternativas.length).toBeGreaterThan(0);
    expect(r.alternativas.map((a) => a.codigo.codigo)).not.toContain(r.melhor.codigo);
  });

  it('a explicação diz por que aquele código, não só qual', () => {
    const r = identificarCodigo('Não foi realizado simulado de emergência com o ônibus.', 'procedimentos');
    expect(r.explicacao.length).toBeGreaterThan(20);
    expect(r.margem).toBeGreaterThanOrEqual(0);
  });

  it('a margem fica entre zero e um', () => {
    for (const caso of CASOS) {
      const r = identificarCodigo(caso.texto, caso.categoria as CategoriaPeepo);
      expect(r.margem).toBeGreaterThanOrEqual(0);
      expect(r.margem).toBeLessThanOrEqual(1);
    }
  });

  it('texto vazio não quebra', () => {
    const r = identificarCodigo('');
    expect(r.confianca).toBe('baixa');
    expect(obterCodigo(r.melhor.codigo)).not.toBeNull();
  });
});

/**
 * O catálogo é a matéria-prima da comparação: sem os termos de
 * reconhecimento, o motor compara a constatação apenas com o título e a
 * definição do código, e cai de patamar sem avisar.
 *
 * Isto existe porque houve uma medição em que a linha de diagnóstico já
 * mostrava o número certo e ninguém tinha como saber — era só um `console.log`,
 * e `console.log` não reprova nada. Número que importa vira asserção.
 *
 * Se algum destes reprovar, o conserto é rodar, dentro da pasta `coleta`:
 *
 *     node scripts/enriquecer-catalogo.mjs
 */
describe('integridade do catálogo', () => {
  it('traz os 101 códigos', () => {
    expect(CODIGOS).toHaveLength(101);
  });

  it('todo código tem termos de reconhecimento', () => {
    const sem = CODIGOS.filter((c) => (c.termos ?? '').trim().length === 0).map((c) => c.codigo);
    expect(sem, `Códigos sem termos: ${sem.join(', ')}`).toEqual([]);
  });

  /**
   * A primeira versão deste teste exigia definição com 40 caracteres e
   * reprovou em TE24 e HF26 — que são "Outro fator", genéricos, e têm
   * definição vazia por natureza. O piso de 40 foi inventado por mim sem olhar
   * os dados, que é exatamente o erro que os testes daqui existem para pegar.
   *
   * O que de fato importa: código NÃO genérico precisa ter com o que casar.
   * Genérico é catch-all; a ausência de definição é a característica dele.
   *
   * A asserção é "não vazio" de propósito, e o mínimo encontrado é impresso em
   * vez de virar piso. Fixar um número antes de conhecer a distribuição é como
   * este teste quebrou da primeira vez.
   */
  it('todo código não genérico tem com o que casar', () => {
    const especificos = CODIGOS.filter((c) => !c.generico);
    const material = (c: (typeof CODIGOS)[number]) =>
      `${c.definicao} ${c.termos ?? ''}`.trim().length;

    const vazios = especificos.filter((c) => material(c) === 0).map((c) => c.codigo);
    expect(vazios, `Códigos específicos sem definição nem termos: ${vazios.join(', ')}`).toEqual([]);

    const menores = [...especificos].sort((a, b) => material(a) - material(b)).slice(0, 3);
    console.log(
      `\n  --- MENOR MATERIAL ENTRE OS ESPECÍFICOS: ${menores
        .map((c) => `${c.codigo} ${material(c)}`)
        .join(', ')} ---`,
    );
  });

  /**
   * Faltava esta: nada garantia que o código esperado pelo gabarito existisse
   * no catálogo. Se a equipe tivesse usado um código fora dos 101, a medição
   * estaria perseguindo um alvo inalcançável e o erro pareceria fraqueza do
   * classificador.
   */
  it('todo código esperado pelo gabarito existe no catálogo', () => {
    const fora = CASOS.filter((c) => obterCodigo(c.esperado) === null).map((c) => c.esperado);
    expect(fora, `Gabarito cita código inexistente: ${fora.join(', ')}`).toEqual([]);
  });

  it('todo código cai numa das quatro colunas do slide', () => {
    const colunas = new Set<string>(ORDEM_COLUNAS);
    const fora = CODIGOS.filter((c) => !colunas.has(c.coluna)).map((c) => `${c.codigo}=${c.coluna}`);
    expect(fora, `Coluna inválida: ${fora.join(', ')}`).toEqual([]);
  });

  it('nenhum código aparece duas vezes', () => {
    const vistos = new Set<string>();
    const repetidos: string[] = [];
    for (const c of CODIGOS) {
      if (vistos.has(c.codigo)) repetidos.push(c.codigo);
      vistos.add(c.codigo);
    }
    expect(repetidos, `Códigos repetidos: ${repetidos.join(', ')}`).toEqual([]);
  });
});

describe('léxico do domínio', () => {
  it('todo código citado existe no catálogo', () => {
    const invalidos = lexicoInvalido((codigo) => obterCodigo(codigo) !== null);
    expect(invalidos, `Códigos inexistentes no léxico: ${invalidos.join(', ')}`).toEqual([]);
  });

  it('nenhuma regra é tão genérica que casaria com tudo', () => {
    const frase = 'o procedimento de trabalho foi realizado pelo colaborador durante o turno';
    const disparos = LEXICO.filter((r) => r.padrao.test(frase));
    expect(disparos.map((d) => d.codigo)).toEqual([]);
  });
});

describe('processamento de texto', () => {
  it('reduz variações da mesma palavra ao mesmo radical', () => {
    expect(radical('sinalizacoes')).toBe(radical('sinalizacao'));
    expect(radical('treinamentos')).toBe(radical('treinamento'));
  });

  it('não corta a ponto de confundir palavras diferentes', () => {
    expect(radical('via')).toBe('via');
    expect(radical('risco')).not.toBe(radical('rota'));
  });

  it('descarta palavras sem poder de discriminação', () => {
    expect(radicais('o motorista estava na via')).not.toContain('esta');
  });

  it('reconhece o achado de ausência em suas várias formas', () => {
    expect(indicaAusencia('não existe evidência de treinamento')).toBe(true);
    expect(indicaAusencia('não foi apresentado o certificado')).toBe(true);
    expect(indicaAusencia('ausência de sinalização vertical')).toBe(true);
    expect(indicaAusencia('o equipamento estava em ordem')).toBe(false);
  });

  it('monta pares de palavras vizinhas', () => {
    expect(bigramas('sinalização vertical ausente').length).toBeGreaterThan(0);
  });
});
