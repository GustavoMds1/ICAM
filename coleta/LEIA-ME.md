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

## A IA é obrigatória

A associação dos códigos e a redação das ações usam a **API do Gemini**, com a chave em
`GEMINI_API_KEY` no ambiente do servidor. No Render: serviço `icam-coleta` → **Environment** →
`GEMINI_API_KEY`. A chave fica no servidor e nunca chega ao navegador de quem usa.

**Sem a chave, o passo para e diz o que fazer** — não cai em silêncio para um modo mais fraco.
Aplicativo que degrada calado produz slide de investigação com cara de análise que ninguém fez.

O Gemini recebe o catálogo inteiro dos 101 códigos. Código que não existir no catálogo é descartado,
nunca aproximado para o mais parecido.

**Se o nome do modelo estiver errado**, o aplicativo pergunta à própria API quais modelos existem na
sua conta, usa o primeiro adequado e avisa qual foi — assim uma troca de nome pelo Google não vira
um beco sem saída. Para fixar a escolha, defina `MODELO_IA` no Render.

### Modo local, só a pedido

Quando a chamada falha, a tela oferece o botão **"Seguir sem IA, no modo local"**, que associa por
semelhança de palavras. Serve para não travar o trabalho num dia de instabilidade, não para
substituir a análise — e só roda quando você clica.

### O que a IA nunca decide sozinha

- **Causa raiz** não existe nesta etapa
- **Executante e matrícula** saem em branco: a IA não inventa nome de pessoa
- **Nada vai para o slide sem passar pela sua revisão**

### Obter a chave

<https://aistudio.google.com/apikey>

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
