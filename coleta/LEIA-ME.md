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
   catálogo dos 101, um nível (causa raiz, fator contribuinte, fato constatado) e uma justificativa.

3. **Revisar** — item a item: trocar o código, mudar o nível ou tirar do slide. É aqui que a
   investigação acontece; o resto é digitação.

4. **Gerar** — sai um `.pptx` com as quatro colunas ICAM, os cartões coloridos por nível, a caixa do
   evento e a legenda. Abra e cole na apresentação.

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

## Sobre a IA

**Com `GEMINI_API_KEY` configurada**, o Gemini recebe o catálogo inteiro dos 101 códigos e devolve,
para cada constatação, um código, um nível e uma justificativa. Código que não existir no catálogo é
descartado — nunca aproximado para o mais parecido.

**Sem a chave**, o aplicativo continua funcionando com associação local por palavras em comum com o
título e a definição do código. É fraca, serve como ponto de partida, e a interface diz isso
claramente em vez de fingir que é a mesma coisa.

Em qualquer um dos dois modos, **nada vai para o slide sem passar pela sua revisão**. O nível
proposto é sempre "fato constatado" no modo local: promover um achado a causa raiz é conclusão de
análise, e o custo de errar para cima é um plano de ação atacando o alvo errado.

### Obter a chave

<https://aistudio.google.com/apikey>. No Render: painel do serviço `icam-coleta` → **Environment** →
`GEMINI_API_KEY`.

---

## Quando o slide não cabe

Se os cartões não couberem em um slide, o aplicativo **distribui em vários** e avisa — nunca
descarta cartão. Um slide bonito e incompleto é pior do que dois slides.

---

## Rodar no seu computador

```bash
cd coleta
npm install
npm run dev          # http://localhost:3000
```

Para usar o Gemini localmente, crie um arquivo `.env.local` nesta pasta:

```
GEMINI_API_KEY=sua-chave
```

Verificação antes de publicar:

```bash
npm run verificar    # typecheck + lint + testes
```

---

## O catálogo

`dados/codigos-icam.json` traz os 101 códigos com código, título, grupo, coluna do slide e
definição. É derivado do catálogo do aplicativo de investigação, que por sua vez foi importado do
documento de origem da metodologia. Nenhuma definição foi gerada por IA.

O mapa de colunas segue o modelo:

| Coluna do slide | Códigos |
| --- | --- |
| Fatores Organizacionais | MS, PR, CO, TR, RM, MM, OC, OL e demais siglas de duas letras |
| Atividade e Condições Ambientais | TE e HF |
| Ações Individuais e de Equipe | IT |
| Defesas Ausentes ou Falhas | DF |
