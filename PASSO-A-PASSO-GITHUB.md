# Passo a passo — publicar no GitHub

Destino: repositório **privado** chamado **ICAM**, na sua conta.

O que já está pronto na sua pasta:

- A versão local está registrada (commit `54de0fa`, 104 arquivos)
- Nada sensível será enviado: `.env`, `node_modules`, `armazenamento` e o banco local ficam de fora
- O programa `PUBLICAR-NO-GITHUB.bat` faz o envio e confere tudo antes

Você não precisa escrever nenhum comando.

---

## Antes de começar: o que é isso e por que fazer

O GitHub é onde o código do projeto fica guardado. É necessário porque o **Render** — o serviço
que vai deixar a plataforma no ar — busca o código de lá para publicar.

O GitHub é o arquivo onde o projeto mora; o Render é quem coloca ele no ar.

---

# Rota escolhida — duplo clique no programa

## Passo 1 — Ter conta no GitHub

Se ainda não tem: <https://github.com/signup>. Anote o **nome de usuário** — é a única coisa que o
programa vai perguntar.

Se já tem, siga para o Passo 2.

## Passo 2 — Instalar o Git

1. Abra <https://git-scm.com/download/win>
2. O download começa sozinho. Execute o arquivo baixado.
3. Clique em **Next** em todas as telas, sem mudar nada, e depois em **Install**.
4. Ao terminar, desmarque "View Release Notes" e clique em **Finish**.

> Se não souber se já tem o Git, pule este passo. O programa avisa se estiver faltando.

## Passo 3 — Executar o programa

1. Abra o Explorador de Arquivos em `C:\Users\gusta\OneDrive\Documentos\ICAM`
2. Dê **duplo clique** em **`PUBLICAR-NO-GITHUB.bat`**
3. Uma janela preta abre e pergunta seu usuário do GitHub. Digite e pressione **Enter**.

**Se o Windows mostrar um aviso azul** ("O Windows protegeu o computador"), clique em
**Mais informações** → **Executar assim mesmo**. Isso aparece porque o arquivo foi criado
recentemente, não porque haja problema com ele.

O programa então:

- confere o Git
- confere arquivo por arquivo se há senha ou dado local no que vai ser enviado, e **para sozinho**
  se encontrar qualquer coisa
- registra a versão, se houver algo novo
- abre o navegador para você criar o repositório

## Passo 4 — Criar o repositório (o navegador abre sozinho)

A página <https://github.com/new> abre já com o nome preenchido. Na tela:

1. **Repository name:** confira que está `ICAM`
2. Marque **Private**
3. **NÃO marque** nenhuma das três caixas do fim da página:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license

   > Marcar qualquer uma delas faz o envio dar erro de conflito. O projeto já tem esses arquivos.

4. Clique no botão verde **Create repository**

> Se a página disser que o nome já existe, o repositório já foi criado antes. Não faça nada, é só
> voltar para a janela preta.

## Passo 5 — Voltar à janela preta e enviar

Volte para a janela preta e pressione **Enter**.

Agora o Git pede para você entrar na conta:

- **Se abrir uma janela do navegador:** entre com sua conta do GitHub e autorize. Pronto.
- **Se pedir usuário e senha na janela preta:** a senha da conta **não funciona**. Você precisa de
  um token — veja o quadro abaixo.

### Como criar um token (só se for pedido)

1. Abra <https://github.com/settings/tokens/new>
2. Em **Note**, escreva: `publicar icam`
3. Em **Expiration**, escolha `90 days`
4. Marque a caixa **`repo`** (a primeira da lista, com várias sub-opções)
5. Role até o fim e clique em **Generate token**
6. **Copie o código que aparecer** — ele só é exibido uma vez
7. Cole no lugar da senha, na janela preta

   > Ao colar, nada aparece na tela. É proposital, por segurança. Cole e pressione Enter.

## Passo 6 — Confirmar

Quando terminar, a janela mostra em verde:

```
PUBLICADO: https://github.com/SEU-USUARIO/ICAM
```

Abra esse endereço. O `README.md` deve aparecer renderizado no meio da página, com o título
"Plataforma de investigação ICAM". **Anote o endereço** — é ele que o Render vai usar.

---

## Rota alternativa — GitHub Desktop

Se preferir clicar em botões em vez de usar a janela preta.

1. Instale o <https://desktop.github.com> e entre com sua conta (ele instala o Git junto).
2. Menu **File** → **Add local repository…** → **Choose…** → selecione
   `C:\Users\gusta\OneDrive\Documentos\ICAM` → **Add repository**.

   Se reclamar de `index.lock`: no Explorador, menu **Exibir** → marque **Itens ocultos**, entre na
   pasta `.git` e apague o arquivo `index.lock`. Tente de novo.

3. Confira a lista de arquivos à esquerda: deve ter por volta de **104** itens, e **não pode**
   aparecer `.env` sozinho, `node_modules`, `armazenamento` nem `dados-locais`.
   O `.env.example` **pode** aparecer — é só o modelo, sem senhas reais.
4. Se houver algo pendente no campo **Summary**, escreva `Plataforma de investigação ICAM` e clique
   em **Commit to main**. Se não houver, siga adiante.
5. No topo, clique em **Publish repository**:
   - **Name:** `ICAM`
   - **Keep this code private:** ✅ deixe **MARCADO**
6. Clique em **Publish repository** e aguarde.
7. Menu **Repository** → **View on GitHub** para confirmar.

---

## Depois de publicar

Abra o **`PUBLICAR.md`** e siga a partir do **Passo 2 — Criar a conta e o serviço no Render**.
Lá você conecta o Render a este repositório, e ele cuida do resto: banco de dados, HTTPS e
publicação automática.

---

## Se algo der errado

O programa pode ser executado quantas vezes for preciso. Nada se perde entre uma tentativa e outra.

| O que apareceu | O que fazer |
| --- | --- |
| "git não é reconhecido" / "O Git não está instalado" | Instale (Passo 2), **feche a janela preta** e execute de novo |
| "Another git process seems to be running" | O programa já apaga essa trava sozinho. Se insistir, apague `.git\index.lock` como descrito na rota alternativa |
| "Repository not found" | O nome de usuário foi digitado diferente, ou o repositório não foi criado. Confira em <https://github.com> e execute de novo |
| "Authentication failed" | A senha da conta não serve. Crie um token (quadro do Passo 5) |
| "Updates were rejected" | Você marcou alguma caixa ao criar o repositório. Apague-o em Settings → Delete this repository e refaça o Passo 4 sem marcar nada |
| O programa parou dizendo que encontrou arquivos proibidos | **Não force.** Ele encontrou algo que não deveria ser publicado. Me avise qual arquivo apareceu |
| A janela fecha sozinha antes de eu ler | Clique com o botão direito no `.bat` → **Executar como administrador**, ou use a rota alternativa |

Se travar, me diga **em qual passo** parou e **o que apareceu na tela**.

---

## E a rota em que eu publico para você, sem você tocar em nada?

Conferi nesta sessão: **não há conector do GitHub disponível** para autorizar na sua conta, e a
extensão do navegador não está conectada. Sem um desses, eu não tenho como me autenticar no GitHub.

O que eu **não** faço, nem se você pedir, é receber sua senha ou seu token de acesso. Essas
credenciais dão controle total da conta, e o certo é você usá-las diretamente — pelo navegador que
abre no Passo 5, pelo GitHub Desktop, ou por um conector autorizado.

O que eu já fiz por você: preparei o repositório, conferi arquivo por arquivo que nada sensível
será enviado, e deixei o programa pronto para um duplo clique.
