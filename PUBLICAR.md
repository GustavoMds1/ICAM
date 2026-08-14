# Publicar na Web — guia passo a passo

Guia para colocar a plataforma no ar **sem custo mensal**, com login por usuário e HTTPS:

- **Neon** guarda o banco de dados — PostgreSQL gratuito e permanente
- **Render** roda a aplicação — plano Hobby, gratuito

Tempo estimado: 30 a 40 minutos na primeira vez.

**Leia antes a seção final, "O que ainda falta antes de dados sensíveis".** Ela não é formalidade:
descreve o que a plataforma ainda não protege.

---

## Por que o banco fica fora do Render

O Render tem PostgreSQL gratuito, mas ele **expira 30 dias depois de criado** e é apagado 14 dias
depois disso. Serve para experimentar, não para guardar investigações. O banco pago mais barato
custa US$ 6 por mês.

O Neon dá PostgreSQL gratuito sem prazo: 0,5 GB de dados, que para investigações em texto é muito.
Ele hiberna após 5 minutos parado e acorda em milissegundos — você não percebe.

O plano **Pro do Render, de US$ 25/mês, não é necessário**. Ele só acrescenta relatórios de
conformidade, registro de auditoria da conta e mais banda. O plano Hobby publica normalmente.

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
| Configuração do Render para o plano gratuito | Pronta, com build e migração verificados |
| HTTPS | Fornecido pelo Render, automático |

---

## Passo 1 — Colocar o código no GitHub

Se ainda não fez: abra **`PASSO-A-PASSO-GITHUB.md`** e siga até o fim. São dois cliques e o
preenchimento do seu usuário. Volte aqui com o endereço do repositório na mão.

---

## Passo 2 — Criar o banco no Neon

1. Abra <https://console.neon.tech/signup> e entre com a conta do GitHub (evita criar outra senha).
2. Em **Create project**:
   - **Project name:** `icam`
   - **Postgres version:** 16 ou superior
   - **Region:** **AWS US East (N. Virginia)** — é a mais próxima do Brasil e casa com a região que
     vamos usar no Render
3. Clique em **Create project**.
4. A tela seguinte mostra a **connection string**. Marque a opção **Pooled connection** e copie o
   texto inteiro. Ele se parece com:

   ```
   postgresql://icam_owner:SENHA@ep-nome-123-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   **Guarde em lugar seguro.** Essa linha é a chave do banco: quem a tem, lê tudo. Não a coloque em
   e-mail, em documento compartilhado nem no repositório.

> Se fechar a tela sem copiar: no painel do projeto, **Connect** → **Connection string** →
> **Pooled connection**.

---

## Passo 3 — Criar o serviço no Render

1. Crie a conta em <https://render.com> e conecte-a ao GitHub. Fique no plano **Hobby** (gratuito) —
   não aceite oferta de upgrade.
2. No painel: **New → Blueprint**.
3. Selecione o repositório `ICAM`. O Render lê o `render.yaml` e propõe criar o serviço web `icam`.
4. Ele vai pedir os valores marcados para preenchimento manual:

| Variável | O que colocar |
| --- | --- |
| `DATABASE_URL` | A connection string do Neon, colada inteira, do Passo 2 |
| `ADMIN_EMAIL` | Seu e-mail — será o primeiro administrador |
| `ADMIN_SENHA` | Senha provisória forte, no mínimo 12 caracteres. Você troca no primeiro acesso |
| `USUARIOS_INICIAIS` | A equipe, uma pessoa por linha (formato abaixo). Pode deixar vazio e preencher depois |
| `ANTHROPIC_API_KEY` | Deixe vazio — o modo determinístico não usa |

   `SESSAO_SEGREDO` é gerado pelo próprio Render. Não preencha à mão nem copie de outro ambiente.

5. Confirme. A primeira implantação leva de 5 a 10 minutos.

Durante o build, nesta ordem: instala as dependências, confere o catálogo ICAM, compila, aplica as
migrações e cria os usuários. **Se a migração falhar, a implantação é abortada** — não sobe
aplicação contra banco inconsistente.

### O formato de `USUARIOS_INICIAIS`

Uma pessoa por linha:

```
maria@empresa.com | Maria Silva | investigador
joao@empresa.com | João Souza | aprovador
carla@empresa.com | Carla Nunes | gestor | sensivel
```

O papel é opcional — sem ele, a pessoa entra como `investigador`. A palavra `sensivel` no fim é o
que libera ver nome, matrícula e dados de saúde; use com parcimônia.

As senhas provisórias são geradas e aparecem **uma única vez** no registro do build:
painel → serviço `icam` → aba **Logs** → procure por `--- Equipe ---`. Anote e entregue cada uma
pessoalmente ou por telefone, nunca no mesmo e-mail que leva o endereço da plataforma.

Para acrescentar gente depois: painel → **Environment** → editar `USUARIOS_INICIAIS` → **Save**.
Isso dispara nova implantação e cria só quem ainda não existe.

---

## Passo 4 — Primeiro acesso

1. Abra a URL do serviço (algo como `https://icam.onrender.com`).

   **A primeira abertura demora cerca de 1 minuto.** É a hibernação do plano gratuito, explicada
   mais abaixo. O navegador mostra uma tela de carregamento do Render enquanto isso.

2. Você cai direto na tela de **Entrar** — nenhuma página é acessível sem sessão.
3. Entre com o e-mail e a senha de administrador que você definiu.
4. O sistema **obriga a trocar a senha**. A troca encerra todas as sessões abertas, inclusive a que
   você acabou de abrir: é esperado ter de entrar de novo.

---

## Passo 5 — Conferir que está tudo certo

| Verificação | Como fazer | Esperado |
| --- | --- | --- |
| Saúde | Abra `https://sua-url/api/saude` | `{"estado":"ok"}` |
| Proteção das rotas | Abra a URL raiz em uma janela anônima | Redireciona para `/entrar` |
| Bloqueio por tentativa | Erre a senha 5 vezes | Mensagem de excesso de tentativas |
| Auditoria | Menu **Auditoria** | "Cadeia íntegra" com os registros do seu acesso |
| Catálogo | Menu **Catálogo ICAM** | 101 códigos, 99 com definição importada |
| Equipe | Peça a uma pessoa que entre com a senha provisória | Cai na troca de senha obrigatória |

---

## Papéis disponíveis

| Papel | O que pode fazer |
| --- | --- |
| `administrador` | Tudo, incluindo gestão de usuários e auditoria |
| `gestor` | Ler tudo, aprovar recomendações, publicar relatório, ler auditoria |
| `investigador` | Criar e editar investigações, evidências, fatos, classificações, ações; usar a IA |
| `revisor` | Ler tudo e aprovar fatos |
| `aprovador` | Ler tudo, aprovar recomendações e publicar relatório |
| `leitor` | Somente leitura |

`sensivel` (o `podeVerCamposSensiveis`) controla o acesso a nome, matrícula e dados de saúde, fadiga
e substâncias. Deixe de fora por padrão — o relatório executivo usa função e pseudônimo. Cada acesso
a campo sensível fica registrado na trilha de auditoria.

---

## O que esperar do plano gratuito

| Comportamento | O que significa na prática |
| --- | --- |
| **Hiberna após 15 min sem acesso** | O primeiro acesso depois de um tempo parado leva ~1 minuto. Os seguintes são normais |
| **750 horas de máquina por mês** | Suficiente para um único serviço ligado o mês inteiro. Não crie um segundo serviço gratuito |
| **5 GB de tráfego por mês** | Muito acima do uso de uma equipe pequena com texto |
| **Sem terminal e sem disco** | Por isso migração e criação de usuários passaram para variáveis de ambiente |
| **Pode reiniciar sozinho** | Sem aviso. Como o estado está todo no banco, nada se perde |
| **Neon: 0,5 GB e 100 h de banco ativo/mês** | O banco só conta tempo quando consultado. Uso em horário comercial cabe com folga |

Se a espera de 1 minuto incomodar na hora de mostrar para alguém, abra a URL cinco minutos antes —
depois disso ela responde na hora.

**Não use um serviço de "ping" 24 horas para evitar a hibernação.** Ele mantém o banco do Neon
acordado o tempo todo e estoura as 100 horas mensais, o que derruba o banco até o mês seguinte.

---

## Operação

### Backup

O Neon guarda um histórico curto de restauração no plano gratuito. Para um backup de verdade, o
caminho mais simples é criar um **branch** no painel do Neon: é uma cópia instantânea do banco
naquele instante, e o plano gratuito permite 10.

Painel do Neon → **Branches** → **Create branch** → nome `backup-2026-08-13`.

Faça isso antes de qualquer mudança grande e no fim de cada investigação encerrada. Um branch não
protege contra a conta do Neon ser perdida — para isso, exporte com `pg_dump` de um computador que
tenha o cliente do PostgreSQL instalado:

```bash
pg_dump "SUA_DATABASE_URL" > icam-2026-08-13.sql
```

### Rotação do segredo de sessão

Trocar `SESSAO_SEGREDO` invalida todas as sessões — todos precisam entrar de novo. Faça isso se
suspeitar de exposição. Painel do Render → serviço → **Environment** → editar → **Save**, o que
dispara nova implantação.

### Ver os registros

Painel do Render → serviço `icam` → aba **Logs**. É onde aparecem as senhas provisórias geradas no
build e os erros de execução.

### Atualizar a aplicação

`git push` na `main` dispara a implantação. As migrações rodam no build, antes de o servidor subir;
se uma falhar, a implantação é abortada e a versão anterior continua no ar.

### Carregar o caso de demonstração

Para conhecer a ferramenta com um caso fictício antes de usar para valer, tire o
`--sem-demonstracao` do `buildCommand` no `render.yaml`, faça o push, e depois recoloque. O caso
fica marcado como demonstração na trilha de auditoria — nunca o confunda com investigação real.

---

## Ativar o modelo externo (opcional)

O padrão é o provedor **determinístico**: heurísticas locais, nada sai do ambiente, custo zero. Ele
já produz o rascunho completo — só que com sugestões limitadas a padrões de texto.

Para usar um modelo de verdade, escolha **um** fornecedor. Não é preciso instalar pacote nenhum: os
três falam HTTP direto.

No painel do Render, em **Environment**:

```
PROVEDOR_IA=anthropic          # ou openai, ou gemini
ANTHROPIC_API_KEY=sua-chave    # OPENAI_API_KEY / GEMINI_API_KEY conforme o escolhido
IA_ENVIO_EXTERNO_AUTORIZADO=true
IA_RESIDENCIA_DADOS=us
```

| Fornecedor | `PROVEDOR_IA` | Variável da chave | Onde obter |
| --- | --- | --- | --- |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | <https://console.anthropic.com> |
| OpenAI | `openai` | `OPENAI_API_KEY` | <https://platform.openai.com/api-keys> |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> |

Cada fornecedor tem um modelo padrão. Nomes de modelo mudam com frequência — se a chamada for
recusada por modelo inexistente, defina `MODELO_IA` com o nome atual do fornecedor. **Nada quebra
enquanto isso:** o agente cai para a heurística local e o erro fica registrado na trilha de
auditoria e na aba Agentes.

`IA_ENVIO_EXTERNO_AUTORIZADO=false` bloqueia qualquer chamada externa mesmo com chave configurada.
É a trava para o caso de a chave entrar antes da decisão sobre enviar dados para fora.

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
| **Criptografia de campo para dado sensível** | O banco é criptografado em repouso pelo Neon, mas os campos não têm cifra própria | Mantenha `sensivel` desligado por padrão e use pseudônimos |
| **Tela de administração de usuários** | Criar e desativar contas depende de variável de ambiente e nova implantação | Use `USUARIOS_INICIAIS` do Passo 3 |
| **Retenção e descarte automáticos** | Nada expira sozinho | Defina o prazo em política escrita e execute manualmente |
| **Avaliação de impacto (LGPD)** | Obrigação legal para tratamento de dado pessoal em escala | Envolva o encarregado de dados antes do uso amplo |
| **Auditoria WCAG com leitor de tela** | Acessibilidade aplicada por construção, mas não auditada | Verificar antes de exigir uso por toda a equipe |

Some-se a isto que **plano gratuito não tem compromisso de disponibilidade**: nem o Render nem o
Neon garantem nada, e ambos podem mudar os limites. Para investigação que a empresa precise
consultar daqui a cinco anos, planeje a saída desde já — o backup do Neon é o que garante que os
dados não dependem de nenhum dos dois.

**Recomendação honesta:** comece com uma investigação real de baixa sensibilidade, com 2 ou 3
pessoas, e mantenha o registro paralelo atual por um ciclo. Isso valida o método e a ferramenta sem
apostar um caso crítico numa plataforma recém-publicada.

---

## Se precisar sair do gratuito depois

| Situação | O que fazer | Custo aproximado |
| --- | --- | --- |
| A espera de 1 minuto virou problema | Instância `starter` no Render, sem hibernação | US$ 7/mês |
| O banco passou de 0,5 GB | Plano pago do Neon, ou Postgres do Render | a partir de US$ 5 a 6/mês |
| A empresa exigiu dados internos | `Dockerfile` em servidor próprio, com PostgreSQL da casa | Sem mensalidade, exige quem administre |

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

O `Dockerfile` também serve em Railway, Fly.io e Koyeb sem alteração. Só o `render.yaml` é
específico do Render.
