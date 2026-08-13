# Passo a passo — publicar no GitHub sem usar terminal

Escolha **uma** das duas rotas. Ambas chegam ao mesmo lugar.

| Rota | Para quem | Terminal? | Tempo |
| --- | --- | --- | --- |
| **A — GitHub Desktop** | Recomendada. Programa com botões, tudo visual | Nenhum | ~15 min |
| **B — Duplo clique no arquivo** | Se preferir algo automático | Nenhum (só uma janela preta que se resolve sozinha) | ~10 min |

---

## Antes de começar: o que é isso e por que fazer

O GitHub é onde o código do projeto vai ficar guardado. É necessário porque o **Render** — o
serviço que vai deixar a plataforma no ar — busca o código de lá para publicar.

Pense assim: o GitHub é o arquivo onde o projeto mora; o Render é quem coloca ele no ar.

**Nada de sensível vai para o GitHub.** As senhas e o segredo de sessão ficam de fora — isso já
está configurado e é conferido automaticamente antes de qualquer envio.

---

# ROTA A — GitHub Desktop (recomendada)

Nenhum comando. Só cliques.

## Passo A1 — Criar a conta no GitHub

1. Abra <https://github.com/signup>
2. Informe seu e-mail, crie uma senha e escolha um nome de usuário.
   **Anote o nome de usuário** — você vai usá-lo em seguida.
3. Confirme o e-mail que o GitHub enviar.

> Se já tem conta, pule para o Passo A2.

## Passo A2 — Instalar o GitHub Desktop

1. Abra <https://desktop.github.com>
2. Clique em **Download for Windows**
3. Execute o arquivo baixado. A instalação é automática, sem perguntas.
4. Ao abrir, clique em **Sign in to GitHub.com**. Uma janela do navegador abre para você entrar
   com a conta do Passo A1. Autorize quando pedir.
5. Na tela seguinte, ele pede nome e e-mail para identificar suas alterações. Confirme.

> O GitHub Desktop instala o Git junto. Você não precisa instalar nada além disso.

## Passo A3 — Adicionar o projeto

1. No GitHub Desktop, clique no menu **File** → **Add local repository…**
2. Clique em **Choose…** e navegue até:

   ```
   C:\Users\gusta\OneDrive\Documentos\ICAM
   ```

3. Clique em **Selecionar pasta** e depois em **Add repository**.

**Se aparecer um aviso** dizendo que a pasta já é um repositório mas está com problema, ou algo
sobre `index.lock`:

- Abra o Explorador de Arquivos na pasta `ICAM`
- No menu **Exibir**, marque **Itens ocultos**
- Entre na pasta `.git` que apareceu
- Apague o arquivo chamado `index.lock` (se existir)
- Volte ao GitHub Desktop e tente adicionar de novo

> Esse arquivo ficou travado porque eu preparei o repositório de um ambiente que não conseguiu
> removê-lo. No seu computador ele apaga normalmente.

## Passo A4 — Conferir o que será enviado

Na coluna da esquerda você verá a lista de arquivos. **Confira estas duas coisas:**

- Deve haver por volta de **101 arquivos**
- **Não pode** aparecer nenhum item chamado `.env` (sozinho, sem o `.example`),
  `node_modules`, `armazenamento` ou `dados-locais`

O item `.env.example` **pode** aparecer — esse é só o modelo, sem senhas reais.

Se aparecer algo da lista proibida, **pare** e me avise antes de continuar.

## Passo A5 — Registrar a versão

No canto inferior esquerdo:

1. No campo **Summary**, escreva:

   ```
   Plataforma de investigação ICAM
   ```

2. Clique no botão azul **Commit to main**

Isso registra a versão do projeto no seu computador. Ainda não foi para a internet.

## Passo A6 — Enviar para o GitHub

1. No topo da tela, clique em **Publish repository**
2. Uma janela abre:
   - **Name:** deixe `ICAM` (ou mude para `icam`, tanto faz)
   - **Description:** opcional
   - **Keep this code private:** ✅ **deixe MARCADO**

     Isso é importante. Mesmo sem dados reais, o código contém a estrutura de segurança da
     plataforma. Você pode tornar público depois, se quiser.
3. Clique em **Publish repository**

Aguarde a barra de progresso. Quando terminar, seu código está no GitHub.

## Passo A7 — Confirmar

1. No GitHub Desktop, menu **Repository** → **View on GitHub**
2. O navegador abre no seu repositório
3. Confira: o `README.md` deve aparecer renderizado no meio da página, com o título
   "Plataforma de investigação ICAM"

**Anote o endereço da página.** Vai ser algo como:

```
https://github.com/SEU-USUARIO/ICAM
```

É esse endereço que o Render vai usar.

---

# ROTA B — Duplo clique

Se preferir o caminho automático.

## Passo B1 — Criar a conta no GitHub

Igual ao Passo A1: <https://github.com/signup>. Anote o nome de usuário.

## Passo B2 — Instalar o Git

1. Abra <https://git-scm.com/download/win>
2. O download começa sozinho. Execute o arquivo baixado.
3. Clique em **Next** em todas as telas, sem mudar nada, e depois em **Install**.
4. Ao terminar, desmarque "View Release Notes" e clique em **Finish**.

## Passo B3 — Executar

1. Abra o Explorador de Arquivos em `C:\Users\gusta\OneDrive\Documentos\ICAM`
2. Dê **duplo clique** no arquivo **`PUBLICAR-NO-GITHUB.bat`**
3. Uma janela preta abre e pergunta seu usuário do GitHub. Digite e pressione **Enter**.

O que acontece em seguida:

- O programa confere se não há senhas no que vai ser enviado, e **para sozinho** se encontrar algo
- Registra a versão
- Tenta criar o repositório

**Se o Windows mostrar um aviso azul** ("O Windows protegeu o computador"), clique em
**Mais informações** → **Executar assim mesmo**. Isso aparece porque o arquivo foi criado
recentemente, não porque há problema com ele.

## Passo B4 — Criar o repositório no site

O programa provavelmente vai dizer que o *GitHub CLI não está instalado* e mostrar instruções.
É esperado. Faça o seguinte, **sem fechar a janela preta**:

1. Abra <https://github.com/new>
2. Em **Repository name**, escreva: `icam`
3. Escolha **Private**
4. **NÃO marque** nenhuma das três caixas do fim da página:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license

   > Marcar qualquer uma delas faz o envio dar erro de conflito. O projeto já tem esses arquivos.

5. Clique no botão verde **Create repository**

## Passo B5 — Enviar

Volte à janela preta e dê **duplo clique no `PUBLICAR-NO-GITHUB.bat` de novo**, informando o mesmo
usuário.

Desta vez ele vai pedir suas credenciais. Vai abrir uma janela do navegador ou uma caixa pedindo
login:

- **Se abrir o navegador:** entre com sua conta do GitHub e autorize. Pronto.
- **Se pedir usuário e senha na janela preta:** a senha da conta **não funciona**. Você precisa de
  um token — veja o quadro abaixo.

### Como criar um token (só se for pedido)

1. Abra <https://github.com/settings/tokens/new>
2. Em **Note**, escreva: `publicar icam`
3. Em **Expiration**, escolha `90 days`
4. Marque a caixa **`repo`** (a primeira da lista, com várias sub-opções)
5. Role até o fim e clique em **Generate token**
6. **Copie o código que aparecer** — ele só é exibido uma vez
7. Cole no lugar da senha na janela preta

   > Ao colar, nada aparece na tela. É proposital, por segurança. Cole e pressione Enter.

Quando terminar, aparece o endereço do repositório. **Anote.**

---

## Depois de publicar

Você agora tem o código no GitHub. O próximo passo é colocar no ar.

Abra o **`PUBLICAR.md`** e siga a partir do **Passo 2 — Criar a conta e o serviço no Render**.
Lá você vai conectar o Render a este repositório, e ele cuida do resto: banco de dados, HTTPS e
publicação automática.

---

## Se algo der errado

| O que aconteceu | O que fazer |
| --- | --- |
| "git não é reconhecido" | O Git não está instalado ou a janela foi aberta antes da instalação. Instale (Passo B2), **feche a janela** e abra de novo |
| "Another git process seems to be running" | Apague `.git\index.lock` como descrito no Passo A3 |
| "Updates were rejected" / "failed to push" | Você marcou alguma caixa ao criar o repositório no site. Apague o repositório em Settings → Delete this repository e refaça o Passo B4 sem marcar nada |
| "Authentication failed" | A senha da conta não serve. Crie um token (quadro acima) |
| O programa parou dizendo que encontrou arquivos proibidos | **Não force.** Ele encontrou algo que não deveria ser publicado. Me avise qual arquivo apareceu |
| A janela preta fecha sozinha antes de eu ler | Abra o Explorador na pasta, clique com o botão direito no `.bat` e escolha **Executar como administrador** — ou use a Rota A |

Se travar em qualquer ponto, me diga **em qual passo** parou e **o que apareceu na tela**. Com isso
eu consigo indicar exatamente o que fazer.

---

## E a rota em que eu publico para você?

Existe uma: **autorizar o conector do GitHub no claude.ai**.

Em Configurações → Conectores, autorize o GitHub. Feito isso, em uma nova conversa eu consigo criar
o repositório e enviar o código sem que você toque em nada.

O que eu **não** posso fazer, nem se você pedir, é receber sua senha ou seu token de acesso. Essas
credenciais dão controle total da sua conta, e a forma correta é você usá-las diretamente — pelo
GitHub Desktop, pelo navegador, ou pelo conector autorizado.
