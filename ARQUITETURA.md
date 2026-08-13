# Arquitetura e decisões

Cada decisão abaixo registra as alternativas consideradas, o critério de escolha e a consequência
assumida. Nenhuma tecnologia foi adotada por moda.

---

## ADR-01 — Aplicação web full-stack em Next.js e TypeScript estrito

**Alternativas consideradas**

| Opção | A favor | Contra |
| --- | --- | --- |
| SPA React + API separada (NestJS/Express) | Separação clara, times independentes | Dois deploys, duplicação de tipos, mais superfície de autorização para errar |
| Next.js App Router (escolhida) | Um repositório, tipos compartilhados do domínio à tela, autorização no servidor por padrão | Acoplamento a um framework |
| Django / Rails | Maturidade, admin pronto | Duplicaria a tipagem do domínio na camada de IA (TypeScript) |

**Decisão.** Next.js 15 (App Router) com TypeScript em modo estrito, incluindo
`noUncheckedIndexedAccess`.

**Por quê.** O produto é dominado por regras de domínio (tipos de asserção, estados de barreira,
hierarquia de controle, naturezas de fator). Compartilhar esses tipos entre servidor e interface
elimina uma classe inteira de erro: exibir "confirmado" para algo que o domínio considera hipótese.
Componentes de servidor mantêm dados sensíveis fora do cliente por padrão — o navegador recebe HTML
já filtrado por autorização, não o dossiê completo.

**Consequência.** Migrar de framework exigiria reescrever `src/app/`, mas `src/domain/`,
`src/agentes/` e `src/seguranca/` são TypeScript puro, sem dependência de framework.

---

## ADR-02 — Regras de domínio puras, separadas da persistência

**Decisão.** Os verificadores de qualidade, o mapa causal, a hierarquia de controles e a
normalização temporal operam sobre o tipo `Dossie` (`src/domain/dossie.ts`), nunca sobre o cliente
de banco.

**Por quê.** Três ganhos concretos:

1. as 26 regras da seção de qualidade são testáveis sem banco, o que torna a suíte de regressão
   rápida e determinística;
2. a mesma regra roda no servidor, em script e em CI;
3. a troca de mecanismo de persistência não toca em regra metodológica.

**Consequência.** É preciso montar o `Dossie` a partir da persistência. Em troca, a parte do sistema
que mais precisa ser confiável não depende de infraestrutura.

---

## ADR-03 — Persistência com duas implementações atrás de uma interface

**Alternativas consideradas**

| Opção | A favor | Contra |
| --- | --- | --- |
| PostgreSQL + Prisma como única opção | Fiel ao alvo de produção | Exige Docker/banco para qualquer execução; impede verificar o fluxo em ambientes restritos |
| SQLite via Prisma | Sem servidor de banco | Ainda exige download de binários do motor Prisma |
| Interface `Repositorio` com implementação em arquivo + modelo Prisma para produção (escolhida) | Fluxo vertical executável e verificável em qualquer ambiente; regra de negócio isolada | Duas implementações a manter |

**Decisão.** Todo acesso a dados passa por `Repositorio` (`src/servidor/repositorio.ts`).
A implementação `RepositorioArquivo` (JSON versionado) é o padrão de desenvolvimento e
demonstração. `prisma/schema.prisma` define o modelo relacional de produção.

**Por quê.** O requisito de entregar um fluxo vertical *executável e verificado* pesa mais do que a
aderência imediata ao banco alvo. Com a interface no meio, adotar PostgreSQL é implementar um
adaptador, não reescrever o produto.

**Situação atual.** O adaptador PostgreSQL foi implementado (`RepositorioPostgres`) e é o padrão em
produção. `RepositorioArquivo` permanece disponível, mas não é mais o caminho principal. O acesso é
feito por SQL direto, não por Prisma — ver ADR-09.

**Portabilidade do schema.** O `schema.prisma` permanece no repositório como referência do modelo
relacional completo dos agregados do dossiê, que é o próximo incremento de normalização.

---

## ADR-04 — Agentes como etapas contratadas, não como respostas livres

**Decisão.** Cada um dos dez agentes é uma `DefinicaoAgente` com: instrução de sistema, formato
esperado, esquema Zod de saída e uma implementação heurística determinística. Todos passam pelo
mesmo núcleo (`src/agentes/nucleo.ts`).

**Por quê.** Concentrar o fluxo em um ponto garante, sem depender de disciplina do desenvolvedor:

- neutralização de prompt injection em toda entrada;
- validação da saída contra o contrato antes de tocar o banco;
- registro completo da execução (hash da entrada, provedor, modelo, parâmetros, duração,
  sinalizações) para auditoria;
- fallback determinístico quando o provedor externo falha, com o erro registrado.

**Saída fora do contrato é descartada, não corrigida.** Corrigir uma saída malformada é inventar
conteúdo — exatamente o que o método proíbe.

---

## ADR-05 — Provedor determinístico como padrão, não como degradação

**Decisão.** `PROVEDOR_IA=deterministico` é o padrão. `obterProvedor()` devolve `null` e os agentes
executam heurísticas locais.

**Por quê.** Três razões:

1. **Privacidade por padrão.** Conteúdo de investigação de incidente frequentemente contém dado
   pessoal e informação sensível de operação. O envio externo exige autorização explícita
   (`IA_ENVIO_EXTERNO_AUTORIZADO=true`) e o adaptador recusa a chamada sem ela.
2. **Auditabilidade.** As heurísticas são código legível e determinístico: a mesma entrada produz a
   mesma saída, o que torna a regressão confiável.
3. **Operação sem dependência externa.** O produto funciona por completo sem chave de API.

O adaptador da Anthropic está implementado e usa o mesmo contrato. Trocar de provedor não altera
nenhuma regra de investigação.

---

## ADR-06 — Autorização em duas camadas, isolamento verificado primeiro

**Decisão.** `autorizar(ator, acao, recurso)` verifica, nesta ordem: isolamento entre organizações,
RBAC do papel, vínculo com a investigação (ABAC), campo sensível.

**Por quê.** O isolamento vem antes do papel de propósito: um administrador da organização A não
pode alcançar dados da organização B. Acesso cruzado devolve **404, não 403** — 403 confirmaria que
o recurso existe.

**Consequência.** Toda página de servidor usa `carregarInvestigacao()`, que concentra a checagem.
Não há caminho de leitura que contorne a autorização.

---

## ADR-07 — Trilha de auditoria encadeada por hash

**Decisão.** Cada registro carrega o hash do anterior, formando uma cadeia por organização.

**Por quê.** Log resistente a adulteração é requisito de governança. Encadear por hash torna
detectável tanto a alteração de um registro quanto a remoção de um registro do meio — a verificação
falha e aponta a posição da quebra. A cadeia é por organização para não vazar volume de atividade
entre elas.

**Limite honesto.** Isso detecta adulteração, não a impede. Quem tem acesso de escrita ao
armazenamento pode reescrever a cadeia inteira. Proteção real exige armazenamento append-only
(WORM) ou âncora externa — está no roadmap.

---

## ADR-08 — Conteúdo importado é dado, nunca instrução

**Decisão.** Defesa em quatro camadas (`src/seguranca/injecao.ts`):

1. **Detecção** — padrões de sobrescrita de instrução, exfiltração, mudança de papel, ação externa,
   delimitador falso e caracteres invisíveis. Sinalizações ficam na evidência.
2. **Envelope** — o conteúdo é embrulhado com um delimitador aleatório que o próprio conteúdo não
   consegue fechar (ocorrências do delimitador no texto são neutralizadas).
3. **Instrução de sistema** — o prompt declara que o bloco é dado do documento investigado e que
   texto com aparência de ordem deve ser reportado, nunca obedecido.
4. **Contrato de saída** — validação Zod; saída fora do contrato é descartada.

Complementa: allowlist de ferramentas por agente.

---

## Modelo de ameaças

| Ameaça | Vetor | Mitigação | Estado |
| --- | --- | --- | --- |
| Vazamento entre organizações | Manipulação de id na URL ou API | Isolamento verificado antes de qualquer permissão; 404 em vez de 403 | Implementado e testado |
| Prompt injection via documento | PDF/DOCX/transcrição com instrução embutida | Detecção, envelope, instrução de sistema, contrato de saída, allowlist | Implementado e testado |
| Citação inexistente | Modelo referencia evidência que não existe | `validarCitacoes` + regra `CITACAO_NAO_SUSTENTA` | Implementado e testado |
| Exposição de dado pessoal em relatório | Nome/matrícula/CPF em texto livre | Pseudonimização por padrão, redação de PII, ABAC de campo sensível | Implementado e testado |
| Adulteração da trilha de auditoria | Escrita direta no armazenamento | Cadeia de hash detecta alteração e remoção | Detecção implementada; prevenção no roadmap |
| Conclusão sem sustentação | Fator confirmado sem evidência ou mecanismo | Verificadores de bloqueio impedem publicação | Implementado e testado |
| Publicação sem aprovação | Mudança direta de status | Regra `PUBLICACAO_SEM_APROVACAO` | Implementado e testado |
| Inferência sensível indevida | Fadiga/álcool/saúde deduzidos de comportamento | Códigos sensíveis marcados no catálogo; exigem evidência objetiva e peso forte | Implementado e testado |
| Sequestro de sessão | Cookie sem proteção | — | **Não mitigado**: autenticação não implementada |
| Upload malicioso | Arquivo com carga executável | — | **Não mitigado**: antivírus e validação de arquivo no roadmap |

---

## Pilha e versões

| Camada | Escolha | Versão |
| --- | --- | --- |
| Runtime | Node.js | ≥ 20.11 |
| Framework | Next.js (App Router) | 15.x |
| Linguagem | TypeScript estrito | 5.7 |
| Validação | Zod | 3.24 |
| Estilo | Tailwind CSS | 3.4 |
| Testes | Vitest | 3.x |
| ORM (produção) | Prisma | 6.x |
| Banco (produção) | PostgreSQL | 16 |
| Provedor de IA | Determinístico (padrão) / Anthropic | — |

Nenhuma versão obsoleta foi fixada. Tailwind 3 foi preferido a 4 por estabilidade da cadeia de
build no momento da implementação.


---

## ADR-09 — SQL direto sobre PostgreSQL, em vez de ORM

**Contexto.** Era preciso persistência real para publicar na Web. A opção natural seria Prisma, já
que o schema existia.

**Alternativas consideradas**

| Opção | A favor | Contra |
| --- | --- | --- |
| Prisma | Schema já escrito, tipos gerados, migrações prontas | Exige baixar binários do motor no build e em runtime; **não foi possível verificar nada** no ambiente de desenvolvimento usado, o que significaria entregar código não testado na camada mais crítica |
| SQL direto com `pg` + migrações `.sql` (escolhida) | Verificável contra PostgreSQL real; sem binário externo; controle explícito sobre o isolamento em cada consulta | Sem tipos gerados; mapeamento manual |
| Drizzle | Tipos sem binário externo | Mais uma abstração a aprender, sem ganho decisivo aqui |

**Decisão.** Migrações em `.sql` versionado e acesso por `pg`, atrás da interface `Banco`.

**O que isso comprou.** PGlite — o próprio PostgreSQL compilado para WebAssembly — permite rodar o
motor real dentro da suíte de testes. As 41 verificações de banco exercitam as migrações, os
índices, as restrições `CHECK`, o gatilho append-only e cada consulta contra **PostgreSQL 18 de
verdade**. Isso é qualitativamente diferente de "compila, deve funcionar".

**Consequência.** O mapeamento entre linha e objeto é manual, concentrado em
`repositorioPostgres.ts`. Em troca, cada `WHERE` com `organizacao_id` está visível no código, o que
importa quando isolamento é requisito de segurança.

**Escopo declarado.** O dossiê da investigação é gravado em `JSONB`, com colunas relacionais para
os campos que exigem isolamento, índice e consulta. Usuários, sessões, auditoria e execuções de IA
são inteiramente relacionais. A normalização relacional dos agregados do dossiê (fatos,
classificações, conflitos) permanece no backlog — não é uma limitação escondida, está aqui e em
`PLANO.md`.

---

## ADR-10 — scrypt em vez de Argon2id

**Decisão.** Hash de senha com `crypto.scrypt` da biblioteca padrão do Node, com N=2^16, r=8, p=1.

**Por quê.** Argon2id é preferível em teoria. Na prática, exige dependência nativa compilada, que é
causa recorrente de falha de build em provedores de nuvem — e uma falha de build no dia da
implantação leva a soluções apressadas que costumam piorar a segurança. scrypt é recomendado pelo
NIST e pela OWASP, tem custo de memória, e não adiciona nenhuma dependência.

O formato guarda os parâmetros junto do hash (`scrypt$N$r$p$sal$hash`), então aumentar o custo
depois não invalida as senhas existentes: `precisaRehash` detecta e a senha é reprocessada no
próximo login bem-sucedido.

**Guarda explícita.** `SENHA_CUSTO_N` permite reduzir o custo fora de produção para manter a suíte
rápida, mas é **ignorado quando `NODE_ENV=production`**. Um custo reduzido em produção seria uma
falha de segurança silenciosa; a trava está testada.

---

## ADR-11 — Sessão no banco, não em token autocontido

**Decisão.** O cookie carrega apenas o identificador da sessão e uma assinatura HMAC; o estado vive
na tabela `sessoes`.

**Por quê.** Um JWT autocontido não pode ser revogado antes de expirar. Neste produto, revogação
imediata é requisito: desativar uma conta, trocar a senha ou encerrar a sessão precisa ter efeito na
requisição seguinte — não em 12 horas. O custo é uma consulta por requisição, irrelevante diante do
volume esperado.

O cookie é `httpOnly`, `sameSite=lax` e `secure` em produção. A assinatura é conferida em tempo
constante, e qualquer valor inválido devolve `null` sem distinguir o motivo.

---

## Modelo de ameaças — atualização

| Ameaça | Situação anterior | Situação atual |
| --- | --- | --- |
| Sequestro de sessão | **Não mitigado** — sem autenticação | Cookie assinado, `httpOnly`, `secure`, revogável; sessão expira em 12 h |
| Força bruta de senha | Inexistente | Bloqueio após 5 falhas em 15 min, por e-mail; toda tentativa registrada |
| Enumeração de usuários | Inexistente | Mensagem idêntica e verificação de hash mesmo para e-mail inexistente |
| Adulteração da auditoria | Detectada pela cadeia de hash | **Impedida pelo PostgreSQL**: gatilho recusa UPDATE e DELETE |
| Redirecionamento aberto no login | Inexistente | Destino aceito somente se interno |
| Vazamento entre organizações | Verificado em memória | Verificado **no banco**, com `organizacao_id` em toda consulta |
| Upload malicioso | **Não mitigado** | **Continua não mitigado** — não há upload; é o P0 remanescente |
| Ausência de MFA | — | **Não mitigado**; senha única é o fator |
