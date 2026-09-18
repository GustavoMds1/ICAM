/**
 * Gera o material para montar a versão do classificador no Copilot Studio.
 *
 * Por que isto é um script e não arquivos escritos à mão: o agente do Copilot
 * Studio precisa dos MESMOS 101 códigos e dos MESMOS 17 casos de teste que o
 * aplicativo usa. Transcrever à mão garante divergência com o tempo, e aí a
 * comparação entre as duas versões deixa de significar alguma coisa.
 *
 * Uso, a partir da pasta `coleta`:
 *
 *     node scripts/gerar-material-copilot.mjs
 *
 * Sai tudo em `copilot-studio/`, pronto para copiar e colar.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, '..', 'dados');
const SAIDA = join(AQUI, '..', 'copilot-studio');

const catalogo = JSON.parse(readFileSync(join(DADOS, 'codigos-icam.json'), 'utf8'));
const gabarito = JSON.parse(readFileSync(join(DADOS, 'gabarito-icam.json'), 'utf8'));

const CODIGOS = catalogo.codigos;
const CASOS = gabarito.casos;

/**
 * Limite documentado do campo de instruções do agente. O campo aceita até
 * aqui, mas a própria Microsoft avisa que instrução longa demais causa
 * latência e timeout — por isso o catálogo vai num Prompt separado, não aqui.
 */
const LIMITE_INSTRUCOES = 8000;

// ---------------------------------------------------------------------------
// 1. Instruções do agente: só a metodologia. Sem catálogo.
// ---------------------------------------------------------------------------

const INSTRUCOES = `Você apoia a etapa de Coleta de Dados de uma investigação de incidentes pela metodologia ICAM. Sua função é associar um código ICAM a cada constatação e dizer se ela é fato constatado ou fator contribuinte.

Responda sempre em português do Brasil.

## O que você recebe

Uma lista numerada de itens vindos dos slides de Coleta de Dados de uma investigação.

## Distinga evidência de constatação

Os slides de coleta misturam duas coisas com a mesma aparência:

- EVIDÊNCIA é o que ainda precisa ser buscado, e costuma vir como título curto com um responsável no fim da linha: "Telemetria - Fulano". Evidência NÃO recebe código. Responda "não se aplica" e siga.
- CONSTATAÇÃO é o que a evidência mostrou, escrita como frase: "O trecho não dispõe de sinalização vertical". Só constatação recebe código.

## Dois níveis, e só dois

- FATO CONSTATADO: o que foi apurado e está registrado.
- FATOR CONTRIBUINTE: o que ajudou o evento a acontecer.

CAUSA RAIZ NÃO SE DEFINE AQUI. Ela sai da análise causal, depois, com a equipe reunida. Se você oferecer causa raiz nesta etapa, convida a investigação a se fechar no primeiro suspeito. Não use esse rótulo, nem mesmo se pedirem.

## A armadilha mais comum

Constatação de investigação cita o instrumento de coleta como FONTE do achado, não como assunto. Em "No check list, a avaria é informada apenas no dia em que foi identificada", o assunto é o registro tardio da avaria — não o check list. Classificar pelo instrumento citado é o erro mais frequente, e o mais confiante.

Vale igual para "de acordo com o procedimento", "conforme a norma", "na folha de ponto", "pela telemetria": são a fonte da informação. Leia o que está sendo afirmado, não onde foi visto.

## Regras que você não quebra

1. Só use códigos da lista dos 101. Código fora da lista é resposta inválida. Se nenhum servir, diga "sem código adequado" em vez de aproximar.
2. Não invente nome de pessoa, matrícula ou data.
3. Não proponha ação corretiva. Esta etapa é classificação.
4. Se o texto não permitir decidir, diga confiança BAIXA. Chute com cara de certeza é pior do que admitir dúvida, porque ensina quem revisa a aceitar sem conferir.

## Como declarar confiança

- ALTA: o texto traz termo que aponta o código com pouca ambiguidade e nenhum outro código disputa de perto.
- MÉDIA: o código é o mais plausível, mas há outro defensável.
- BAIXA: você está escolhendo o menos ruim.

Seja duro com ALTA. Quem revisa vai conferir com atenção os de confiança baixa e passar os olhos nos de alta; errar com confiança alta é o erro que escapa.

## Formato da resposta

Uma linha por item, exatamente assim, sem cabeçalho e sem texto antes ou depois:

NÚMERO | CÓDIGO | NÍVEL | CONFIANÇA | alternativa | justificativa em uma frase

Onde NÍVEL é constatado ou contribuinte, CONFIANÇA é alta, media ou baixa, e alternativa é o segundo código mais plausível (ou "-" se não houver).

Exemplo:
3 | HF21 | contribuinte | alta | HF20 | A interjornada abaixo da norma é padrão de turno, não falha de barreira.

Para evidência, não constatação:
7 | - | - | - | - | Evidência a coletar, não constatação.

## Ao final

Depois das linhas, escreva uma seção "PARA CONFERIR" listando os números com confiança baixa ou média e o que falta no texto para decidir. Quem lê precisa saber onde olhar primeiro.
`;

// ---------------------------------------------------------------------------
// 2. Prompt classificador: aqui mora o catálogo.
// ---------------------------------------------------------------------------

/**
 * A coluna não vai linha a linha: ela sai do prefixo do código por regra, o
 * que economiza cerca de mil caracteres e não tem como sair dessincronizado.
 */
function listaCompacta() {
  return CODIGOS.map((c) => `${c.codigo} ${c.titulo}`).join('\n');
}

const PROMPT = `Classifique cada item da lista abaixo segundo a metodologia ICAM, escolhendo um código da tabela dos 101.

=== ITENS A CLASSIFICAR ===

{{ITENS}}

=== OS 101 CÓDIGOS ICAM ===

${listaCompacta()}

=== COLUNA DO SLIDE, POR PREFIXO ===

DF... = Defesas Ausentes ou Falhas
IT... = Ações Individuais e de Equipe
TE... e HF... = Atividade e Condições Ambientais
Qualquer outro prefixo = Fatores Organizacionais

=== COMO RESPONDER ===

Uma linha por item, nesta ordem exata, sem cabeçalho:

NÚMERO | CÓDIGO | NÍVEL | CONFIANÇA | ALTERNATIVA | justificativa

NÍVEL: constatado ou contribuinte. Nunca causa raiz.
CONFIANÇA: alta, media ou baixa.
ALTERNATIVA: o segundo código mais plausível, ou "-".

Só use códigos da tabela acima. Se nenhum servir, escreva "sem código adequado" no lugar do código.

Lembre: quando o texto cita check list, procedimento, norma, folha de ponto ou telemetria, isso é a FONTE do achado e quase nunca o assunto dele. Classifique o que está sendo afirmado.
`;

// ---------------------------------------------------------------------------
// 3. Bloco de teste: os mesmos 17 casos do gabarito.
// ---------------------------------------------------------------------------

const BLOCO = CASOS.map((c, i) => `${i + 1}. ${c.texto}`).join('\n');

const TESTE = `Cole o bloco abaixo no agente, de uma vez só.

São os mesmos 17 casos que medem o aplicativo, com nomes removidos. Os códigos
que a equipe de investigação atribuiu de fato estão guardados e NÃO aparecem
aqui de propósito: se você colar o gabarito junto, não mede nada.

Depois que o agente responder, copie a resposta inteira, salve em
copilot-studio/resposta-do-agente.txt e dê um duplo clique em MEDIR-COPILOT.bat.

------------------------------ COPIE DAQUI ------------------------------

Classifique os itens abaixo:

${BLOCO}

------------------------------ ATÉ AQUI ------------------------------
`;

// ---------------------------------------------------------------------------

mkdirSync(SAIDA, { recursive: true });

const arquivos = [
  ['1-INSTRUCOES-DO-AGENTE.txt', INSTRUCOES],
  ['2-PROMPT-CLASSIFICADOR.txt', PROMPT],
  ['3-BLOCO-DE-TESTE.txt', TESTE],
];

for (const [nome, conteudo] of arquivos) {
  writeFileSync(join(SAIDA, nome), conteudo, 'utf8');
}

console.log(`Material gravado em copilot-studio/\n`);
for (const [nome, conteudo] of arquivos) {
  console.log(`  ${nome} — ${conteudo.length} caracteres`);
}

console.log(`\n  catálogo: ${CODIGOS.length} códigos`);
console.log(`  casos de teste: ${CASOS.length}`);

if (INSTRUCOES.length > LIMITE_INSTRUCOES) {
  console.error(
    `\n[X] As instruções passaram de ${LIMITE_INSTRUCOES} caracteres e o Copilot Studio vai recusar. Encurte antes de colar.`,
  );
  process.exit(1);
}

const folga = LIMITE_INSTRUCOES - INSTRUCOES.length;
console.log(`\n  Instruções cabem no limite de ${LIMITE_INSTRUCOES}: sobram ${folga} caracteres.`);
console.log('\nAgora siga copilot-studio/PASSO-A-PASSO.md');
