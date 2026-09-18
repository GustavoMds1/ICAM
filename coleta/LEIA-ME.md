# Coleta de Dados ICAM

Aplicativo separado, com uma função só: pegar a **Coleta de Dados** da investigação, associar os
códigos ICAM a cada constatação com apoio do **Gemini**, e gerar o **slide de classificação** no
padrão do slide 13 do modelo.

Não tem banco de dados nem login. O arquivo entra, é processado na memória do servidor e sai como
`.pptx`. Nada fica guardado.

---

## Como usar

1. **Importar** — envie o `.pptx` da investigação. São lidos os slides com o título "Coleta de
   Dados", separando os itens por PEEPO (Pessoas, Equipamento, Ambiente, Procedimentos,
   Organização) e lendo a caixa do evento (o quê, quem, onde, quando, consequências).

2. **Associar** — clique em *Associar códigos com IA*. Cada constatação recebe um código do
   catálogo dos 101, a classificação (fato constatado ou fator contribuinte) e a indicação de se
   exige ação.

3. **Revisar** — item a item: trocar o código, mudar a classificação, marcar se exige ação ou tirar
   do slide. É aqui que a investigação acontece; o resto é digitação.

4. **Planejar as ações** — para cada achado que exige tratamento, a IA redige a ação e escolhe a
   hierarquia de controle. Você ajusta o texto e define executante, matrícula e prazo.

5. **Gerar** — sai um `.pptx` com a página de classificação no formato do modelo e a página do plano
   de recomendações. Abra e cole na apresentação.

---

## Causa raiz não se define aqui

A classificação desta etapa tem **dois** níveis: fato constatado e fator contribuinte. Causa raiz
sai da análise causal, depois, com a equipe reunida — oferecer o rótulo aqui convidaria a eleger
causa raiz durante a digitação da coleta, que é como se fecha investigação no primeiro suspeito.

**A caixa "exige ação" nasce marcada em todos os itens** e quem desmarca é você, item a item. O que
ficar desmarcado sai do slide: classificação existe para sustentar plano de ação, não para listar
tudo que foi visto.

A escolha de deixar marcado por padrão é proposital. Se a IA desmarcasse sozinha, um achado sumiria
do slide sem ninguém perceber — e o erro de omissão é o mais difícil de notar numa revisão.

---

## Evidência e constatação

Os slides de coleta misturam duas coisas com a mesma aparência:

| | O que é | Vira código? |
| --- | --- | --- |
| **Evidência** | O que precisa ser buscado: "Telemetria — Arley" | Não. É tarefa, não achado |
| **Constatação** | O que a evidência mostrou: "O trecho não dispõe de sinalização vertical" | Sim |

A separação é automática: item com responsável no fim da linha é tarefa de coleta; item sem
responsável, marcado com ponto ou escrito como frase, é constatação. O aplicativo mostra as duas
listas separadas para você conferir.

Se uma constatação sua aparecer na lista errada, é porque no PowerPoint ela está escrita como um
título curto com responsável. Escreva como frase e reimporte.

---

## Como o código é identificado

A identificação roda **no próprio servidor**, sem rede, sem chave e sem custo por uso. Nenhum
conteúdo de investigação sai daqui.

Cada constatação é comparada com os 101 códigos por quatro evidências independentes:

| Evidência | O que é |
| --- | --- |
| **Termos ponderados** | Palavras em comum com o título e a definição, pesadas por raridade no catálogo. Palavra que aparece em metade dos códigos — "procedimento", "trabalho" — quase não pontua |
| **Expressões** | Pares de palavras vizinhas iguais. "hora extra" vale muito mais que "hora" |
| **Léxico do domínio** | Termos que apontam um código com pouca ambiguidade: "interjornada" → HF21, "etiloteste" → HF02, "simulado de emergência" → DF19. Existe porque constatação real quase nunca repete as palavras do título do código |
| **Coluna esperada** | A categoria PEEPO do item dá um empurrão à coluna coerente. Desempate, nunca decisão |

Antes de comparar, o texto passa por normalização e radicalização: "sinalizações", "sinalização" e
"sinalizar" viram o mesmo radical, senão o plural deixaria de casar com o singular.

### O que "confiança alta" quer dizer

Não é enfeite. Sai de três condições **simultâneas**:

1. pontuação acima do piso absoluto;
2. vantagem folgada sobre o segundo colocado;
3. pelo menos uma evidência específica — léxico ou expressão inteira — e não só palavras soltas
   coincidindo.

Faltando qualquer uma, a confiança cai para média ou baixa e a tela pede comparação com as
alternativas. **Confiança alta que erra é pior do que não ter confiança nenhuma**, porque ensina a
aceitar sem conferir.

### Como isso é medido, e o que deu

`dados/gabarito-icam.json` guarda os códigos que uma equipe de investigação atribuiu de fato, num
evento real, sem nomes. `tests/localIcam.test.ts` mede contra esse gabarito.

**Medição de 18/09/2026, com 17 casos:**

| | Resultado |
| --- | --- |
| Código certo em 1º lugar | **13/17 (76%)** |
| Código certo entre os 3 primeiros | 14/17 (82%) |
| Acerto quando diz "confiança alta" | **5/5 (100%)** |

O caminho até aqui vale mais que o número. A primeira medição deu 47% e, pior, a confiança alta
errava 3 de 9 — todas por uma regra que ligava "check list" a um código de barreira. Constatação de
investigação cita o check list como a **fonte** do achado, não como o assunto; a regra lia a fonte e
respondia com convicção sobre o tema errado.

O salto de 47% para 71% veio de uma inversão descoberta no diagnóstico: todos os acertos vinham do
léxico, e vários erros eram derrotas por 1% a 7% — o código certo tinha a regra curada e perdia para
um código qualquer que só tinha palavras em comum. Uma regra do léxico é afirmação deliberada sobre
o domínio; semelhança de palavras é coincidência estatística. A segunda não pode superar a primeira.

**Os quatro erros que sobram não valem perseguir.** Em três deles o código certo fica em 45º, 94º ou
97º lugar, com pontuação zero: não existe palavra no texto que leve até ele. Um exemplo é *"De acordo
com o procedimento, item 7.2.3, é proibido o uso do banheiro"* classificado como IT06 — o texto
descreve a regra, não a violação. Só leitura de sentido resolveria. O quarto é um caso em que a
própria equipe deu dois códigos diferentes para o mesmo texto.

Por isso **100% não é a meta certa**: acima de uns 75%, o classificador estaria decorando as
idiossincrasias de uma investigação em vez de aprender a metodologia. Mexer nos pesos sem rodar o
teste é adivinhação.

### O que o motor tem para comparar

Os 101 códigos já estão no catálogo com **termos de reconhecimento** — exemplos, termos relacionados
e regras de inclusão da metodologia —, e não só com título e definição. É ali que moram as palavras
que uma constatação real usa: "interjornada", "faixa contínua", "etilotestes". Os testes verificam
que os 101 continuam com esses termos; se algum perder, a medição reprova em vez de piorar calada.

`scripts/enriquecer-catalogo.mjs` é quem gera esse arquivo a partir da taxonomia de origem. Ele é
determinístico — mesma entrada, mesmos bytes —, então só há motivo para rodá-lo de novo se
`data/icam-taxonomy.pt-BR.json` mudar:

```bash
node scripts/enriquecer-catalogo.mjs
npm test    # confirme que o acerto não caiu
```

Uma observação honesta sobre o número acima: o catálogo já estava completo quando a medição de 76%
foi feita. Nunca houve uma medição do catálogo pobre para comparar, então **não dá para dizer quanto
os termos ajudaram** — só que o resultado registrado é o do catálogo completo, que é o que vai para
o ar.

---

## Versão paralela no Copilot Studio

Existe uma segunda implementação do classificador sendo avaliada como agente do **Copilot Studio**,
com modelo GPT-5, para o caso de a política de TI exigir que tudo fique no tenant da Microsoft.
Ela faz **só a classificação** — o slide continua saindo daqui.

O material para montá-la está em `copilot-studio/`, gerado pelo `MATERIAL-COPILOT.bat` a partir
deste mesmo catálogo e deste mesmo gabarito. Isso não é detalhe: se as duas versões usarem listas
de código diferentes, comparar o acerto delas não significa nada.

`MEDIR-COPILOT.bat` pontua a resposta do agente contra **os mesmos 17 casos**, e imprime o
resultado lado a lado com o da IA local. A régua tem que ser a mesma, senão a escolha entre as duas
vira preferência.

Uma coisa que o medidor verifica e o motor local não precisa verificar: **código inventado**. O
motor local só consegue devolver um dos 101 por construção; um modelo de linguagem consegue
devolver qualquer coisa, e é a falha mais silenciosa das duas.

Instruções de montagem: `copilot-studio/PASSO-A-PASSO.md`.

---

## O Gemini está em espera

A integração continua inteira no código, desligada. Para religar, no Render: serviço `icam-coleta`
→ **Environment** → `USAR_GEMINI=true` e `GEMINI_API_KEY` preenchida
(<https://aistudio.google.com/apikey>).

Com ele ligado, o aplicativo absorve sozinho a sobrecarga do Google (`HTTP 503 — high demand`):
tenta de novo esperando 2 e 6 segundos, depois pergunta à API quais modelos existem na conta e tenta
outros dois, avisando qual usou. Só então devolve erro, dizendo que é temporário.

### O que nunca é decidido sozinho, com ou sem Gemini

- **Causa raiz** não existe nesta etapa
- **Executante e matrícula** saem em branco: nada de inventar nome de pessoa
- **Nada vai para o slide sem passar pela sua revisão**

### O plano de ação enquanto o Gemini dorme

O que sai no passo 4 é o **esqueleto** da ação: o verbo e o ponto de partida da hierarquia vêm do
tipo do achado — barreira que falhou pede restabelecer a barreira; fator organizacional pede mexer
no sistema de gestão. É orientação de forma, não análise. **Reescreva cada linha.**

Não se tenta redigir a ação por casamento de palavras de propósito: frase plausível e vazia é pior
do que campo à espera, porque parece pronta e passa.

---

## O formato do slide

O gerador reproduz o slide do modelo medida por medida, extraídas do arquivo da investigação:

| Elemento | Formato |
| --- | --- |
| Cartão | Retângulo arredondado, 2,544" de largura, borda pontilhada de 0,75 pt em cinza |
| Fato constatado | Cartão **transparente** — só a borda |
| Fator contribuinte | Preenchimento **amarelo FFFF00** sólido |
| Texto | 9 pt: "CÓDIGO – Título- " em negrito, constatação em cinza |
| Colunas | x = 0,090" · 2,756" · 5,396" · 8,058", na sequência ICAM |
| Caixa do evento | À direita, transparente, rótulos em negrito |

O slide do modelo não tem título nem cabeçalho de coluna, e o gerado também não. Acrescentar
enfeite que o original não usa é o que faz o slide parecer de outro lugar no meio da apresentação.

O plano de recomendações sai na tabela de seis colunas do modelo: Causa Padrão, Descrição da Ação,
Hierarquia de Controle, Executante, Matrícula e Prazo.

---

## Quando o slide não cabe

Se os cartões não couberem em um slide, o aplicativo **distribui em vários** e avisa — nunca
descarta cartão. Um slide bonito e incompleto é pior do que dois slides.

---

## Rodar sem terminal

Na pasta `coleta`, dois arquivos para duplo clique:

| Arquivo | O que faz |
| --- | --- |
| **`MEDIR.bat`** | Confere se o código compila e mede o acerto contra o gabarito, listando cada erro com o motivo |
| **`ABRIR-NO-NAVEGADOR.bat`** | Sobe o aplicativo em `http://localhost:3000` para você usar |
| **`MATERIAL-COPILOT.bat`** | Gera os textos para montar a versão do classificador no Copilot Studio |
| **`MEDIR-COPILOT.bat`** | Mede a versão do Copilot Studio contra os mesmos 17 casos |

Os dois precisam do **Node.js** instalado (versão LTS, <https://nodejs.org>). Na primeira execução
eles instalam as dependências sozinhos, o que leva alguns minutos.

---

## Rodar pelo terminal

No PowerShell, dentro da pasta `coleta`:

```powershell
npm install               # só na primeira vez

npm run typecheck         # o código compila?
npm test                  # mede o acerto contra o gabarito
npm run verificar         # typecheck + lint + testes, tudo junto

npm run dev               # abre em http://localhost:3000
```

Para regerar o catálogo, caso a taxonomia de origem mude:

```powershell
node scripts/enriquecer-catalogo.mjs
npm test                                  # confirme que o acerto não caiu
```

Para experimentar o Gemini localmente, crie um arquivo `.env.local` nesta pasta:

```
USAR_GEMINI=true
GEMINI_API_KEY=sua-chave
```

---

## O catálogo

`dados/codigos-icam.json` traz os 101 códigos com código, título, grupo, coluna do slide, definição,
termos de reconhecimento (exemplos, termos relacionados, regras de inclusão) e regras de exclusão —
estas últimas servem para **afastar** um código, nunca para aproximá-lo. É derivado do catálogo do
aplicativo de investigação, que por sua vez foi importado do documento de origem da metodologia.
Nenhuma definição foi gerada por IA.

O mapa de colunas segue o modelo:

| Coluna do slide | Códigos |
| --- | --- |
| Fatores Organizacionais | MS, PR, CO, TR, RM, MM, OC, OL e demais siglas de duas letras |
| Atividade e Condições Ambientais | TE e HF |
| Ações Individuais e de Equipe | IT |
| Defesas Ausentes ou Falhas | DF |
