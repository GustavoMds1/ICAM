# Versão do classificador no Copilot Studio

Isto monta um agente que faz **só a classificação**: recebe as constatações da Coleta de Dados e
devolve código ICAM, nível e confiança. Não gera o slide — essa parte continua no aplicativo.

O objetivo é comparar. Ao final você terá dois números medidos pela mesma régua e poderá escolher
com fundamento, em vez de impressão.

> Os nomes de tela do Copilot Studio mudam com frequência. O que está aqui foi conferido em
> setembro de 2026; se um botão estiver com outro nome, procure pela função descrita.

---

## Antes de começar

Rode o **`MATERIAL-COPILOT.bat`** na pasta `coleta`. Ele gera, nesta pasta, os três arquivos que
você vai colar:

| Arquivo | Onde vai |
| --- | --- |
| `1-INSTRUCOES-DO-AGENTE.txt` | Campo de instruções do agente |
| `2-PROMPT-CLASSIFICADOR.txt` | Uma ferramenta do tipo Prompt |
| `3-BLOCO-DE-TESTE.txt` | Colado na conversa, na hora de medir |

**Por que dois textos separados:** o campo de instruções do agente aceita no máximo 8.000
caracteres, e a Microsoft avisa que instrução longa causa latência e timeout. Os 101 códigos não
cabem lá — por isso o catálogo vai num Prompt à parte.

---

## 1. Criar o agente

Em <https://copilotstudio.microsoft.com>, crie um agente novo.

- **Nome:** `Classificador ICAM`
- **Descrição:** `Associa códigos ICAM às constatações da Coleta de Dados de uma investigação.`

## 2. Colar as instruções

Abra `1-INSTRUCOES-DO-AGENTE.txt`, copie tudo e cole no campo de instruções do agente.

## 3. Desligar o conhecimento geral e a busca na web

Nas configurações de conhecimento (*Knowledge*), **desmarque a busca na web e o uso do conhecimento
geral do modelo**.

São dois motivos, e os dois importam:

- **Qualidade:** a resposta precisa sair dos 101 códigos, não de alguma página sobre ICAM que o
  modelo encontrou. Com a web ligada, ele mistura as duas coisas e você não sabe qual foi.
- **Política de dados:** com a busca na web ligada, trechos da conversa podem virar consulta
  externa. Desligada, o conteúdo da investigação não sai do tenant — que era o ponto da sua TI.

## 4. Escolher o modelo

Nas configurações do agente, escolha a família **GPT-5**. Para esta tarefa prefira a opção de
raciocínio (*GPT-5 Reasoning*) em vez do roteador automático: classificar código ICAM é decisão com
comparação entre alternativas próximas, não resposta de balcão.

## 5. Criar a ferramenta com o catálogo

Em **Tools / Ferramentas**, adicione uma nova ferramenta do tipo **Prompt**:

1. Nome: `Classificar constatacoes`
2. Crie uma **variável de entrada** de texto chamada `ITENS`
3. Abra `2-PROMPT-CLASSIFICADOR.txt`, copie tudo e cole no corpo do prompt
4. No texto colado há o marcador `{{ITENS}}`. **Apague esse marcador e insira a variável `ITENS`
   pelo botão do editor** — variável precisa ser inserida pela interface; digitada como texto ela
   não é substituída por nada, e o prompt chega vazio ao modelo
5. Salve e deixe o agente autorizado a usar esta ferramenta

## 6. Testar com um caso só

No painel de teste, cole:

```
Classifique os itens abaixo:

1. Identificado na folha de ponto que a interjornada durante este trajeto é menor do que a estabelecida na norma, com intervalo de 8 a 9 horas de descanso.
```

A resposta deve vir numa linha só, no formato `1 | HF21 | contribuinte | alta | ... | justificativa`.

Se vier texto corrido, prosa explicativa ou um código fora da lista, o formato não pegou: revise o
passo 5, especialmente a variável.

---

## 7. Medir de verdade

1. Abra `3-BLOCO-DE-TESTE.txt` e cole o bloco inteiro no agente, de uma vez
2. Copie a resposta **inteira e sem editar**
3. Salve em `copilot-studio\resposta-do-agente.txt`
4. Duplo clique em **`MEDIR-COPILOT.bat`**

Sai o acerto caso a caso e o número final lado a lado com o do aplicativo.

**Não teste com o PowerPoint real.** O bloco de teste é a versão sem nomes. Enquanto você está
ajustando o agente, não há motivo para colocar nome de motorista em tela de configuração.

---

## O que observar na comparação

Não olhe só o total. Três coisas decidem:

1. **Acerto no código principal.** O aplicativo faz 13/17. Menos que isso, o agente não substitui.
2. **Confiança alta que erra.** O aplicativo faz 5/5. Se o agente disser "alta" e errar, é pior do
   que acertar menos — porque quem revisa passa os olhos no que veio com confiança alta.
3. **Código inventado.** O medidor avisa se o agente devolveu código fora dos 101. O aplicativo não
   consegue fazer isso por construção; um modelo de linguagem consegue, e é a falha mais silenciosa
   das duas.

Um empate em acerto **não** é empate: a versão local é de graça, roda sem rede e tem teste que
reprova regressão. O Copilot Studio precisa vencer com folga para valer a troca — ou vencer em algo
que o número não mostra, como estar dentro do Teams e do tenant.

---

## Custo

Cada rodada consome créditos: US$ 0,01 no pago-conforme-uso, ou US$ 200/mês por 25.000. Uma
resposta generativa custa cerca de 2 créditos. Os 17 casos de teste saem por centavos — mas repita
o teste algumas dezenas de vezes ajustando o prompt e isso aparece na fatura da empresa.
