# Plataforma de investigação ICAM

Aplicativo profissional para conduzir e documentar investigações de incidentes segundo a
metodologia ICAM (Incident Cause Analysis Method), com um copiloto de IA auditável.

A IA é copiloto do investigador. Ela não substitui julgamento profissional, não declara culpa, não
inventa fatos, não escolhe uma versão contestada sem justificativa e não publica conclusão sem
aprovação humana.

---

## Como executar

Requisitos: Node.js 20.11 ou superior.

```bash
npm install
npm run db:seed           # migrações + usuário administrador + caso de demonstração
npm run dev               # http://localhost:3000
```

O `db:seed` exibe o e-mail e a senha do administrador criado. A troca de senha é obrigatória no
primeiro acesso.

Nenhum servidor de banco, Docker ou chave de API é necessário para rodar localmente: sem
`DATABASE_URL`, a aplicação usa PGlite (o próprio PostgreSQL compilado para WebAssembly), e o
provedor de IA determinístico executa heurísticas locais sem enviar nada para fora do ambiente.

O passo do `.env` é opcional — serve apenas para mudar o provedor de IA ou o caminho de
armazenamento. Guia detalhado, com roteiro de uso e solução de problemas:
[`COMO-EXECUTAR.md`](./COMO-EXECUTAR.md).

### Verificação

```bash
npm run verificar          # tipos + lint + testes
npm run taxonomia:validar  # confere os 101 códigos por grupo
npm run build              # build de produção
```

### Comandos disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm run typecheck` | Checagem de tipos (TypeScript estrito) |
| `npm run lint` | ESLint, zero avisos tolerados |
| `npm test` | Suíte de testes (Vitest) |
| `npm run verificar` | Tipos, lint e testes em sequência |
| `npm run db:seed` | Migrações, usuário administrador e caso de demonstração |
| `npm run db:migrar` | Só as migrações (usado na implantação) |
| `npm run taxonomia:validar` | Valida a estrutura do catálogo ICAM |
| `npm run taxonomia:importar-docx -- <arquivo.docx>` | Importa as definições integrais dos códigos |

---

## Estado do catálogo ICAM

Os **101 códigos** estão carregados e conferidos por grupo:

| Grupo | Códigos |
| --- | --- |
| Defesas ausentes ou falhas (DF01–DF21) | 21 |
| Ações individuais ou em equipe (IT01–IT14) | 14 |
| Condições da tarefa e do ambiente (TE01–TE24) | 24 |
| Fatores humanos (HF01–HF26) | 26 |
| Fatores organizacionais (CM…VW) | 16 |
| **Total** | **101** |

**99 dos 101 códigos têm a definição integral importada** de `Códigos metologia ICAM.docx`
(SHA-256 `efc414ed…`), com os exemplos que o próprio documento fornece.

Os dois restantes — **TE24** e **HF26**, ambos "Outro fator" — constam do documento **sem definição
alguma além do rótulo**. Isso é propriedade da fonte, não falha de extração, e está registrado como
`SEM_DEFINICAO_NA_FONTE` com proveniência. Nenhuma definição foi gerada por IA.

Todas as definições permanecem marcadas para conferência humana contra as 11 imagens de referência,
que ainda não foram fornecidas. Nenhuma divergência foi encontrada entre os títulos do catálogo e os
do documento.

Para reimportar, caso o documento seja atualizado:

```bash
npm run taxonomia:importar-docx -- "caminho/para/Códigos metologia ICAM.docx"
```

---

## O que o produto faz

**Fluxo ICAM completo** — notificação e triagem, governança da equipe, plano de coleta PEEPO,
biblioteca de evidências com cadeia de custódia, cronologia com fontes temporais identificadas,
livro de fatos, matriz de contradições, gráfico ICAM nas quatro colunas, mapa causal, plano de ação
com hierarquia de controles, relatório versionado e verificação de eficácia.

**Dez agentes de IA** (seção 6 do escopo), cada um com contrato de saída próprio validado por Zod:
ingestão, normalização temporal, fatos e citações, contradições e lacunas, planejamento PEEPO,
classificador ICAM, barreiras e causalidade, recomendações, compilador de relatório e revisor de
qualidade.

**Verificadores automáticos de qualidade causal** — 26 regras que bloqueiam achado sem evidência,
citação que não sustenta a afirmação, fator sem mecanismo, código "Outro" sem justificativa,
conclusão baseada só em relato, confusão entre fato e inferência, classificação sensível sem
evidência robusta, recomendação sem vínculo, ação sem responsável/prazo/eficácia, excesso de
controles administrativos, contagem divergente, relógio divergente, lacuna crítica aberta, opinião
divergente omitida, linguagem culpabilizadora, análise encerrada no executante, correlação
apresentada como causa e publicação sem aprovação.

---

## Princípios que o código materializa

| Princípio | Onde está no código |
| --- | --- |
| Não inventar fatos | `definicao: null` no catálogo; agentes emitem `[RASCUNHO]`/`DEFINIR` em vez de preencher |
| Separar fato, declaração, inferência e hipótese | `TIPOS_ASSERCAO` em `src/domain/enumeracoes.ts` |
| Toda afirmação com evidência favorável e contrária | `VinculoFatoEvidencia`, `SustentacaoClassificacao` |
| Citação abre a fonte com localizador | `validarCitacoes`, regra `CITACAO_NAO_SUSTENTA` |
| Correlação não vira causalidade | `RELACOES_NAO_CAUSAIS`, regra `CORRELACAO_COMO_CAUSA` |
| Não encerrar em "erro do operador" | Regra `ANALISE_ENCERRADA_NO_EXECUTANTE` |
| Alternativas ranqueadas, nunca rótulo único | `agenteClassificador`, contrato `respostaClassificador` |
| Versões conflitantes preservadas | `versaoEscolhida: z.null()` no contrato de conflito |
| Original preservado, derivados versionados | `ArquivoEvidencia.papel` e `derivadoDeId` |
| Trilha de auditoria completa | `src/seguranca/auditoria.ts`, cadeia de hash |
| Aprovação humana para publicar | Regra `PUBLICACAO_SEM_APROVACAO` |
| Conteúdo importado é dado, nunca instrução | `src/seguranca/injecao.ts` |

---

## Estrutura

```
data/icam-taxonomy.pt-BR.json   catálogo versionado dos 101 códigos
db/migracoes/                   migrações SQL versionadas do PostgreSQL
prisma/schema.prisma            modelo relacional completo (referência do próximo incremento)
scripts/                        semeadura, validação do catálogo, importador do DOCX
src/domain/                     regras puras: taxonomia, tempo, causalidade, qualidade, controles
src/agentes/                    os dez agentes, contratos Zod e abstração de provedores
src/seguranca/                  prompt injection, RBAC/ABAC, auditoria, pseudonimização
src/servidor/                   persistência e carregamento autorizado
src/app/                        interface Next.js em português do Brasil
src/fixtures/                   caso anonimizado de regressão
tests/                          suíte de testes
```

---

## Documentos

- [`COMO-EXECUTAR.md`](./COMO-EXECUTAR.md) — guia detalhado de execução local, roteiro de uso e problemas comuns
- [`PUBLICAR.md`](./PUBLICAR.md) — publicar na Web com banco, login e HTTPS
- [`ESPECIFICACAO.md`](./ESPECIFICACAO.md) — personas, jornadas, requisitos, critérios de aceite, escopo do MVP
- [`ARQUITETURA.md`](./ARQUITETURA.md) — decisões arquiteturais com alternativas e modelo de ameaças
- [`PLANO.md`](./PLANO.md) — incrementos, backlog priorizado e roadmap para produção
- [`ENTREGA.md`](./ENTREGA.md) — o que foi verificado, o que não pôde ser, limitações e riscos

---

## Aviso

O `db:seed` carrega um caso de demonstração com dados fictícios e anonimizados. Não use dados
fictícios para preencher uma investigação real — remova o caso antes do uso efetivo
(ver [`PUBLICAR.md`](./PUBLICAR.md), passo 3).

A autenticação, o banco PostgreSQL e a auditoria à prova de adulteração já estão implementados. O
que ainda falta antes de dados sensíveis — upload com antivírus, MFA/SSO, criptografia de campo e
avaliação de impacto — está listado em [`PUBLICAR.md`](./PUBLICAR.md) e em
[`ENTREGA.md`](./ENTREGA.md).
