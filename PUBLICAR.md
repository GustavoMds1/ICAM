# Publicar na Web — guia passo a passo

Guia para colocar a plataforma no ar no **Render**, com PostgreSQL gerenciado, login por usuário e
HTTPS. Tempo estimado: 30 a 45 minutos na primeira vez.

**Leia antes a seção final, "O que ainda falta antes de dados sensíveis".** Ela não é formalidade:
descreve o que a plataforma ainda não protege.

---

## O que já está pronto

| Item | Situação |
| --- | --- |
| Autenticação com login por usuário | Implementado e verificado |
| Senha com scrypt (custo de memória) | Implementado |
| Sessão em cookie assinado, revogável | Implementado |
| Bloqueio após 5 tentativas | Implementado |
| Troca de senha obrigatória no 1º acesso | Implementado |
| PostgreSQL com migrações versionadas | Implementado e verificado contra PostgreSQL real |
| Isolamento por organização no banco | Implementado e verificado |
| Auditoria append-only garantida pelo banco | Implementado — o PostgreSQL recusa UPDATE e DELETE |
| Imagem Docker e configuração do Render | Prontas |
| HTTPS | Fornecido pelo Render, automático |

---

## Passo 1 — Colocar o código em um repositório Git

O Render implanta a partir do Git. Se você ainda não usa Git:

1. Crie uma conta em <https://github.com> (o plano gratuito basta).
2. Crie um repositório **privado** chamado `icam`.

   Privado não é detalhe: mesmo sem dados reais, o repositório contém a estrutura de segurança da
   plataforma.

3. No terminal, dentro da pasta do projeto:

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\ICAM"
git init
git add .
git commit -m "Plataforma de investigação ICAM"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/icam.git
git push -u origin main
```

O `.gitignore` já exclui `node_modules`, `.env` e os dados locais. **Confirme que o `.env` não foi
enviado** — ele contém segredos:

```powershell
git ls-files | Select-String "^\.env$"
```

Se não retornar nada, está correto.

---

## Passo 2 — Criar a conta e o serviço no Render

1. Crie a conta em <https://render.com> e conecte-a ao GitHub.
2. No painel: **New → Blueprint**.
3. Selecione o repositório `icam`. O Render lê o `render.yaml` e propõe criar dois recursos:
   - `icam-postgres` — banco PostgreSQL 16 gerenciado;
   - `icam` — o serviço web.
4. Antes de confirmar, preencha as variáveis marcadas para preenchimento manual:

| Variável | O que colocar |
| --- | --- |
| `ADMIN_EMAIL` | Seu e-mail, que será o primeiro administrador |
| `ADMIN_SENHA` | Uma senha forte e provisória, com no mínimo 12 caracteres. Você a trocará no primeiro acesso |
| `ANTHROPIC_API_KEY` | Deixe vazio por ora — o modo determinístico não precisa dela |

`SESSAO_SEGREDO` é gerado automaticamente pelo Render (`generateValue: true`). Não defina esse
valor à mão nem o copie de outro ambiente.

5. Confirme. A primeira implantação leva de 5 a 10 minutos.

### Custos

O plano `starter` do serviço web e o `basic-256mb` do banco ficam na faixa de poucos dólares
mensais. O plano gratuito do Render hiberna após inatividade e **perde o banco depois de 90 dias** —
não serve para uso real. Confira os valores atuais em <https://render.com/pricing>.

---

## Passo 3 — Preparar o banco no primeiro acesso

As migrações rodam sozinhas a cada implantação (`preDeployCommand`). Falta criar a organização e o
seu usuário administrador.

No painel do Render, abra o serviço `icam` → aba **Shell**:

```bash
# Cria a organização e o usuário administrador. Sem o caso fictício.
npx tsx scripts/semear.ts --sem-demonstracao
```

A saída mostra o e-mail e confirma a criação. Se você definiu `ADMIN_SENHA`, use essa senha; se
deixou em branco, o comando gera uma e **a exibe uma única vez** — anote na hora.

Para conhecer a ferramenta com o caso fictício antes de usar para valer, rode sem o parâmetro:

```bash
npx tsx scripts/semear.ts
```

Depois remova o caso de demonstração antes do uso real:

```bash
npx tsx -e "import('./src/servidor/bd.js').then(async m => { const b = await m.abrirBanco(); await b.consultar(\"DELETE FROM investigacoes WHERE id = 'inv-2026-0001'\"); await b.encerrar(); })"
```

---

## Passo 4 — Primeiro acesso

1. Abra a URL do serviço (algo como `https://icam.onrender.com`).
2. Você cai direto na tela de **Entrar** — nenhuma página é acessível sem sessão.
3. Entre com o e-mail e a senha do administrador.
4. O sistema **obriga a trocar a senha** antes de qualquer outra ação. A troca encerra todas as
   sessões abertas, inclusive a que você acabou de abrir: é esperado ter de entrar de novo.

---

## Passo 5 — Criar os usuários da equipe

Ainda não existe tela de administração de usuários (está no backlog P1). Por ora, crie cada conta
pelo Shell do Render:

```bash
npx tsx -e "
import('./src/servidor/bd.js').then(async (m) => {
  const bd = await m.abrirBanco();
  const { ServicoAutenticacao } = await import('./src/servidor/autenticacao.js');
  const auth = new ServicoAutenticacao(bd);
  const r = await auth.criarUsuario({
    organizacaoId: 'org-demo',
    nome: 'Nome da Pessoa',
    email: 'pessoa@empresa.com',
    senha: 'senha provisoria com quatro palavras',
    papelGlobal: 'investigador',
    podeVerCamposSensiveis: false,
  });
  console.log(r);
  await bd.encerrar();
});
"
```

### Papéis disponíveis

| Papel | O que pode fazer |
| --- | --- |
| `administrador` | Tudo, incluindo gestão de usuários e auditoria |
| `gestor` | Ler tudo, aprovar recomendações, publicar relatório, ler auditoria |
| `investigador` | Criar e editar investigações, evidências, fatos, classificações, ações; usar a IA |
| `revisor` | Ler tudo e aprovar fatos |
| `aprovador` | Ler tudo, aprovar recomendações e publicar relatório |
| `leitor` | Somente leitura |

`podeVerCamposSensiveis` controla o acesso a nome, matrícula e dados de saúde, fadiga e substâncias.
Deixe `false` por padrão — o relatório executivo usa função e pseudônimo. Conceda apenas a quem
precisa, e saiba que cada acesso fica registrado na trilha de auditoria.

Ao criar a conta, entregue a senha provisória por um canal separado (pessoalmente ou por telefone,
não por e-mail junto com o link). A troca no primeiro acesso é obrigatória.

---

## Passo 6 — Conferir que está tudo certo

| Verificação | Como fazer | Esperado |
| --- | --- | --- |
| Saúde | Abra `https://sua-url/api/saude` | `{"estado":"ok"}` |
| Proteção das rotas | Abra a URL raiz em uma janela anônima | Redireciona para `/entrar` |
| Bloqueio por tentativa | Erre a senha 5 vezes | Mensagem de excesso de tentativas |
| Isolamento | Peça a URL de uma investigação a um colega de outra organização | Página não encontrada |
| Auditoria | Menu **Auditoria** | "Cadeia íntegra" com os registros do seu acesso |
| Catálogo | Menu **Catálogo ICAM** | 101 códigos, 99 com definição importada |

---

## Operação

### Backup

O Render faz backup automático do PostgreSQL nos planos pagos. **Teste a restauração antes de
confiar nela** — backup não verificado não é backup. No painel: banco → *Backups* → *Restore*, para
uma instância separada.

Backup manual:

```bash
pg_dump "$DATABASE_URL" > icam-$(date +%Y%m%d).sql
```

### Rotação do segredo de sessão

Trocar `SESSAO_SEGREDO` invalida todas as sessões — todos precisam entrar de novo. Faça isso se
suspeitar de exposição do valor. No painel: serviço → *Environment* → editar → *Save*, o que dispara
nova implantação.

### Ver os registros

Painel → serviço `icam` → aba **Logs**. Tentativas de login ficam na tabela `tentativas_login`, e as
ações na `auditoria` — ambas consultáveis pelo Shell.

### Atualizar a aplicação

`git push` na branch `main` dispara a implantação. As migrações rodam antes de o servidor subir; se
uma falhar, a implantação é abortada e a versão anterior continua no ar.

---

## Ativar o modelo externo (opcional)

O padrão é o provedor **determinístico**: heurísticas locais, nada sai do ambiente. Para usar a API
da Anthropic:

```bash
npm install @anthropic-ai/sdk   # e faça commit da alteração
```

E no painel do Render, em *Environment*:

```
PROVEDOR_IA=anthropic
ANTHROPIC_API_KEY=sua-chave
IA_ENVIO_EXTERNO_AUTORIZADO=true
IA_RESIDENCIA_DADOS=us
```

Antes de ativar, considere: conteúdo de investigação de incidente costuma conter dado pessoal e
informação sensível de operação. Verifique se o envio a um provedor externo é compatível com a
política da sua empresa e com a LGPD, e registre a base legal. A página **Governança de IA** mostra
a configuração ativa e alerta enquanto a residência de dados não estiver declarada.

---

## O que ainda falta antes de dados sensíveis

Estes pontos continuam abertos. Estão em ordem de risco.

| Falta | Risco concreto | Mitigação até lá |
| --- | --- | --- |
| **Upload de arquivo com antivírus e validação de tipo** | Ainda não há upload: evidências são registradas por referência, sem o arquivo | Guarde os arquivos no repositório documental atual e registre o localizador na plataforma |
| **MFA / SSO** | Uma senha comprometida dá acesso completo ao perfil | Senhas longas e únicas; papéis restritivos; revisar `tentativas_login` |
| **Criptografia de campo para dado sensível** | O banco é criptografado em repouso pelo Render, mas os campos não têm cifra própria | Mantenha `podeVerCamposSensiveis` em `false` e use pseudônimos |
| **Tela de administração de usuários** | Criar e desativar contas exige o Shell | Use os comandos do Passo 5 |
| **Retenção e descarte automáticos** | Nada expira sozinho | Defina o prazo em política escrita e execute manualmente |
| **Avaliação de impacto (LGPD)** | Obrigação legal para tratamento de dado pessoal em escala | Envolva o encarregado de dados antes do uso amplo |
| **Auditoria WCAG com leitor de tela** | Acessibilidade aplicada por construção, mas não auditada | Verificar antes de exigir uso por toda a equipe |

**Recomendação honesta:** comece com uma investigação real de baixa sensibilidade, com 2 ou 3
pessoas, e mantenha o registro paralelo atual por um ciclo. Isso valida o método e a ferramenta sem
apostar um caso crítico numa plataforma recém-publicada.

---

## Alternativas de hospedagem

| Opção | Quando faz sentido | Ressalva |
| --- | --- | --- |
| **Render** (este guia) | Time pequeno, sem infraestrutura própria | Dados fora da empresa; verifique a política interna |
| **Railway / Fly.io** | Semelhante ao Render | O `Dockerfile` serve nos dois; o `render.yaml` é específico |
| **Servidor da empresa** | Exigência de manter os dados internos | Precisa de PostgreSQL, HTTPS com certificado e backup próprios. Use o `Dockerfile` e defina `DATABASE_URL`, `SESSAO_SEGREDO` e `NODE_ENV=production` |
| **Vercel** | Não recomendado aqui | Funciona com PostgreSQL externo, mas o `preDeployCommand` de migração exige montagem manual |

Para servidor próprio com Docker:

```bash
docker build -t icam .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://usuario:senha@host:5432/icam" \
  -e SESSAO_SEGREDO="$(openssl rand -base64 48)" \
  -e NODE_ENV=production \
  --name icam icam
docker exec icam npx tsx scripts/migrar.ts
docker exec icam npx tsx scripts/semear.ts --sem-demonstracao
```

Coloque um proxy reverso com HTTPS na frente (nginx, Caddy ou Traefik). **Não exponha a porta 3000
diretamente**: o cookie de sessão só é marcado como `secure` sob HTTPS.
