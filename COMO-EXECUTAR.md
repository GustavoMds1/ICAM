# Como executar — guia detalhado (Windows)

Guia passo a passo, do zero até a aplicação aberta no navegador. Tempo estimado na primeira vez:
5 a 10 minutos, quase todo em download de dependências.

**Resumo para quem tem pressa:**

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\ICAM"
npm install
npm run db:seed
npm run dev
```

Depois abra <http://localhost:3000>.

Não é preciso banco de dados, Docker nem chave de API.

---

## Passo 0 — Instalar o Node.js

A aplicação exige **Node.js 20.11 ou superior**. Recomendo a versão LTS mais recente.

1. Baixe em <https://nodejs.org> a versão **LTS** para Windows (arquivo `.msi`).
2. Instale aceitando as opções padrão. Marque a opção de adicionar ao PATH, se perguntado.
3. **Feche e reabra o terminal** — o PATH só é atualizado em terminais novos.

Confira a instalação:

```powershell
node -v
npm -v
```

Você deve ver algo como `v22.x.x` e `10.x.x`. Se `node` não for reconhecido, o instalador não
adicionou ao PATH: reinstale marcando essa opção, ou reinicie o computador.

---

## Passo 1 — Abrir o terminal na pasta do projeto

**Jeito mais fácil:** abra o Explorador de Arquivos em
`C:\Users\gusta\OneDrive\Documentos\ICAM`, clique na barra de endereço, digite `powershell` e
pressione Enter.

**Ou pelo terminal:**

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\ICAM"
```

As aspas são necessárias por causa dos espaços no caminho.

Confirme que está no lugar certo:

```powershell
dir package.json
```

Se aparecer o arquivo, você está na pasta correta.

---

## Passo 2 — Instalar as dependências

```powershell
npm install
```

**O que acontece:** o npm lê `package.json` e `package-lock.json` e baixa cerca de 537 pacotes para
uma pasta `node_modules`. Na primeira vez leva de 1 a 3 minutos e usa cerca de 400 MB.

**Saída esperada:** algo como `added 537 packages in 45s`. Avisos (`warn`) são normais; erros
(`error`) não são — veja a seção de problemas no fim.

> **Nota sobre o OneDrive.** A pasta está dentro do OneDrive, então ele vai tentar sincronizar os
> milhares de arquivos de `node_modules`. Isso funciona, mas deixa a instalação mais lenta e gera
> tráfego desnecessário. Se incomodar, você tem duas saídas: pausar a sincronização durante a
> instalação (ícone do OneDrive → engrenagem → *Pausar sincronização*), ou mover o projeto para
> fora do OneDrive, por exemplo `C:\Projetos\ICAM`. O arquivo `.gitignore` já exclui `node_modules`
> do controle de versão.

---

## Passo 3 — Configurar o ambiente (opcional)

**Este passo é opcional.** A aplicação funciona sem nenhuma configuração: o padrão é armazenamento
em arquivo e provedor de IA determinístico, que roda localmente sem enviar nada para fora.

Crie o arquivo `.env` apenas se quiser mudar algum padrão:

```powershell
Copy-Item .env.example .env
```

No Prompt de Comando (CMD), use `copy .env.example .env`.

O que dá para ajustar:

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PROVEDOR_IA` | `deterministico` | `anthropic` ativa o modelo externo (ver seção adiante) |
| `IA_ENVIO_EXTERNO_AUTORIZADO` | `false` | Trava de segurança: sem `true`, nenhuma chamada externa é feita |
| `ANTHROPIC_API_KEY` | vazio | Chave da API, se usar o provedor externo |
| `ARMAZENAMENTO_BANCO` | `./armazenamento/banco.json` | Onde os dados de demonstração ficam |

---

## Passo 4 — Carregar o caso de demonstração

```powershell
npm run db:seed
```

**O que acontece:** cria `armazenamento/banco.json` com uma investigação fictícia e anonimizada
(tombamento de equipamento móvel em rampa), valida os 101 códigos do catálogo e roda os
verificadores de qualidade.

**Saída esperada:**

```
Armazenamento: C:\Users\gusta\OneDrive\Documentos\ICAM\armazenamento\banco.json
Catálogo ICAM: 101/101 códigos — conforme: true
  definições pendentes de importação do DOCX: 101
  defesas_ausentes_ou_falhas: 21/21
  acoes_individuais_ou_equipe: 14/14
  condicoes_tarefa_ambiente: 24/24
  fatores_humanos: 26/26
  fatores_organizacionais: 16/16
Investigação semeada: INV-2026-0001 — Tombamento de equipamento móvel em rampa de acesso...
Verificadores de qualidade: 1 bloqueio(s), 2 alerta(s) — publicação liberada: false
```

**Os avisos no fim são o comportamento correto, não um erro.** O caso de demonstração foi montado
de propósito com um bloqueio e dois alertas para você ver os verificadores agindo:

- **1 bloqueio** — a lacuna L-002 (falta registro de gestão de mudanças do parâmetro) é de
  criticidade alta e continua aberta;
- **2 alertas** — os relógios do sistema de despacho e do controlador divergem 372 segundos, e há
  um evento com conflito temporal não resolvido.

As "101 definições pendentes" também são esperadas: o DOCX com as definições integrais não foi
fornecido, e elas não foram geradas artificialmente.

---

## Passo 5 — Iniciar a aplicação

```powershell
npm run dev
```

**Saída esperada:**

```
  ▲ Next.js 15.5.22
  - Local:   http://localhost:3000
  ✓ Ready in 2.1s
```

Abra <http://localhost:3000> no navegador. O terminal precisa **continuar aberto** enquanto você
usa a aplicação. Para parar, pressione `Ctrl + C` no terminal.

Se a porta 3000 estiver ocupada, use outra:

```powershell
npx next dev -p 3001
```

---

## Passo 6 — Roteiro de uso

Sugestão de percurso para ver o produto funcionando de ponta a ponta.

### 6.1 Portfólio (página inicial)

Mostra as investigações com fase, número de fatores, ações e bloqueios de qualidade. O aviso
amarelo no topo é intencional: lembra que a autenticação real ainda não está implementada e que o
ambiente não deve receber dados reais.

### 6.2 Abrir a investigação

Clique em **INV-2026-0001**. Você cai na **Visão geral**, com notificação inicial, consequências
reais e potenciais, equipe (com conflito de interesse declarado visível), envolvidos
pseudonimizados e a cobertura do plano PEEPO por dimensão.

### 6.3 Percorrer as abas

| Aba | O que observar |
| --- | --- |
| **Cronologia** | O aviso de relógios divergentes no topo. Cada evento mostra a fonte temporal e a precisão (exato, aproximado, intervalo). Eventos anteriores de manutenção e alarme aparecem antes da ocorrência |
| **Evidências** | Hash, autenticidade e confidencialidade de cada item; a lista de localizadores válidos no fim é o que torna as citações verificáveis |
| **Livro de fatos** | Cada registro traz o tipo de asserção e as evidências **favoráveis e contrárias** lado a lado. Veja o F-006: o relato do operador (≈6%) contra a telemetria (10,8%) |
| **Contradições** | As versões conflitantes preservadas. O C-002 é a matriz com limite do procedimento, nota de manutenção, parâmetro configurado e valor observado |
| **Gráfico ICAM** | As quatro colunas com os fatores, estado da barreira, natureza e grau de sustentação de cada ligação causal. Abaixo, o teste contrafactual de cada fator |
| **Plano de ação** | Perfil do plano na hierarquia de controles, com indicador de eficácia e risco residual por ação |
| **Qualidade** | Os 26 verificadores, o que cada um protege e quantas ocorrências geraram |
| **Relatório** | A minuta montada a partir dos registros, aprovações pendentes, contagens reconciliadas e o Markdown de exportação |

### 6.4 Testar o copiloto de IA

Na aba **Gráfico ICAM**, role até o painel **Classificador ICAM** no fim da página.

1. Em "Descrição do achado", escreva algo como:
   *A via de acesso apresentava gradiente da superfície acima do limite do procedimento vigente.*
2. Em "Mecanismo", escreva:
   *O gradiente acima do especificado reduz a margem de estabilidade lateral do equipamento carregado.*
3. Clique em **Solicitar alternativas**.

**O que observar:** o classificador devolve alternativas **ranqueadas** (o TE22 costuma vir em
primeiro), cada uma com mecanismo, regra de inclusão, motivo para não escolher os códigos próximos
e alertas. Nenhuma é aplicada automaticamente — você escolhe entre aceitar, editar ou rejeitar, e a
justificativa é obrigatória.

Experimente também deixar o campo "Mecanismo" vazio: a resposta vem marcada como **classificação
incerta**, porque sem mecanismo a confirmação é bloqueada.

### 6.5 Governança e auditoria

- **Governança de IA** — provedor ativo, política de envio externo, os dez agentes com suas
  ferramentas permitidas e o contrato de saída obrigatório.
- **Auditoria** — a trilha encadeada por hash, com verificação de integridade no topo. As consultas
  ao classificador que você fez no passo anterior aparecem aqui, marcadas como ator `ia`.
- **Catálogo ICAM** — busca nos 101 códigos. Tente "gradiente", "alarme" ou "fadiga". Repare nos
  selos **Genérico** e **Sensível**, e no aviso de definições pendentes.

---

## Passo 7 — Rodar as verificações

Fora do fluxo de uso, para confirmar que está tudo íntegro:

```powershell
npm run verificar
```

Roda checagem de tipos, lint e os **158 testes**, nessa ordem. Deve terminar com
`Tests  158 passed (158)`.

Individualmente:

| Comando | O que faz | Duração |
| --- | --- | --- |
| `npm run typecheck` | Checagem de tipos TypeScript | ~10 s |
| `npm run lint` | ESLint, zero avisos tolerados | ~15 s |
| `npm test` | Os 158 testes | ~5 s |
| `npm run taxonomia:validar` | Confere os 101 códigos por grupo | ~2 s |
| `npm run build` | Build de produção | ~30 s |

---

## Modo produção (opcional)

Para ver o desempenho real, com o código otimizado:

```powershell
npm run build
npm start
```

A diferença: `npm run dev` recompila a cada alteração de arquivo e é mais lento em cada página;
`npm start` serve o build pronto. Use `dev` para explorar e alterar, `start` para avaliar
desempenho.

---

## Ativar o modelo externo (opcional)

O padrão é o provedor **determinístico**: heurísticas locais e auditáveis, sem enviar nada para
fora. Para usar a API da Anthropic:

```powershell
npm install @anthropic-ai/sdk
```

E no arquivo `.env`:

```
PROVEDOR_IA=anthropic
ANTHROPIC_API_KEY=sua-chave-aqui
IA_ENVIO_EXTERNO_AUTORIZADO=true
IA_RESIDENCIA_DADOS=us
```

Reinicie a aplicação (`Ctrl + C`, depois `npm run dev`).

**Duas travas propositais.** Sem `IA_ENVIO_EXTERNO_AUTORIZADO=true`, nenhuma chamada é feita — a
página *Governança de IA* mostra o motivo em vermelho. E se `IA_RESIDENCIA_DADOS` continuar
indefinida, aparece um alerta: registrar onde os dados são processados é requisito de governança
antes de enviar conteúdo de investigação para fora.

---

## Carregar as definições dos códigos ICAM

Quando tiver o arquivo `Códigos metologia ICAM.docx`:

```powershell
npm install mammoth
npm run taxonomia:importar-docx -- "C:\caminho\para\Códigos metologia ICAM.docx"
```

Os dois hífens (`--`) são necessários: eles separam os argumentos do npm dos argumentos do script.

O importador calcula o SHA-256 do arquivo, extrai o texto, casa cada definição com seu código e
grava proveniência individual. Todas ficam marcadas para conferência humana contra as imagens de
referência. Se um código não for encontrado no documento, ele **permanece pendente** em vez de
receber uma definição aproximada.

Confira o resultado com `npm run taxonomia:validar`.

---

## Recomeçar do zero

Para apagar os dados de demonstração e recarregar:

```powershell
Remove-Item -Recurse -Force armazenamento
npm run db:seed
```

Para reinstalar as dependências:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

---

## Problemas comuns

### `node` ou `npm` não é reconhecido

O Node.js não está no PATH. Feche e reabra o terminal. Se persistir, reinstale o Node.js marcando a
opção de adicionar ao PATH, ou reinicie o computador.

### `npm : O arquivo ... npm.ps1 não pode ser carregado`

A política de execução do PowerShell está bloqueando scripts. Duas saídas:

**Contornar sem alterar nada** — use `npm.cmd` no lugar de `npm`:

```powershell
npm.cmd install
```

**Ou liberar scripts para o seu usuário** (permanente, afeta só a sua conta):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### `EADDRINUSE: address already in use :::3000`

Outra aplicação ocupa a porta 3000. Use outra porta:

```powershell
npx next dev -p 3001
```

Ou descubra e encerre o processo:

```powershell
netstat -ano | findstr :3000
taskkill /PID <numero-do-pid> /F
```

### `npm install` falha com erro de rede ou proxy

Em rede corporativa, configure o proxy:

```powershell
npm config set proxy http://usuario:senha@proxy.empresa:porta
npm config set https-proxy http://usuario:senha@proxy.empresa:porta
```

Se houver inspeção de TLS na rede, pode ser necessário apontar o certificado da empresa com
`npm config set cafile C:\caminho\certificado.pem`.

### A página abre em branco ou com erro 500

Olhe o terminal onde `npm run dev` está rodando — o erro aparece lá com o arquivo e a linha. A causa
mais comum é `armazenamento/banco.json` ausente: rode `npm run db:seed`.

### Erro de permissão ao gravar arquivos

O OneDrive pode estar com o arquivo bloqueado durante a sincronização. Pause a sincronização e
tente de novo, ou mova o projeto para fora do OneDrive.

### `npm run pg:push` falha

Esperado. Os comandos `pg:*` são para o adaptador PostgreSQL, que **ainda não foi implementado** —
o schema em `prisma/schema.prisma` está pronto, mas a implementação é o primeiro item do backlog em
`PLANO.md`. A aplicação não precisa deles para funcionar.

---

## Referência dos comandos

| Comando | O que faz |
| --- | --- |
| `npm install` | Instala as dependências |
| `npm run db:seed` | Carrega o caso anonimizado de demonstração |
| `npm run dev` | Servidor de desenvolvimento em <http://localhost:3000> |
| `npm run build` | Build de produção |
| `npm start` | Executa o build de produção |
| `npm run verificar` | Tipos, lint e testes em sequência |
| `npm run typecheck` | Só a checagem de tipos |
| `npm run lint` | Só o lint |
| `npm test` | Só os testes |
| `npm run test:watch` | Testes em modo contínuo |
| `npm run taxonomia:validar` | Confere os 101 códigos por grupo |
| `npm run taxonomia:importar-docx -- <arquivo>` | Importa as definições integrais dos códigos |
| `npm run setup` | Atalho para `db:seed` |

---

## Antes de usar com dados reais

**Não use.** A autenticação de produção ainda não está implementada e a sessão usa um usuário fixo
de demonstração. Os itens que precisam existir antes de qualquer dado real estão listados como
**P0** em [`PLANO.md`](./PLANO.md): autenticação com MFA/SSO, adaptador PostgreSQL, upload com
antivírus e validação de tipo, criptografia em repouso e política de backup e retenção.

O detalhamento do que foi verificado e do que não pôde ser está em [`ENTREGA.md`](./ENTREGA.md).
