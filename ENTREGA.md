# Entrega — o que foi verificado, o que não foi, e o que falta

Este documento é deliberadamente honesto sobre limites. Um produto de investigação que exagera o
próprio alcance contradiz o método que ele implementa.

---

## 1. Cobertura das fontes

| Fonte prevista no escopo | Situação |
| --- | --- |
| `Prompt_Mestre_Claude_Opus_5_Agente_ICAM.md` | **Recebido e analisado integralmente.** SHA-256 `0942cc2efef5f8abaa27cce43a4459498830031637984bd13a3dce44998dc371` |
| `Códigos metologia ICAM.docx` | **Recebido e importado.** SHA-256 `efc414ed2a63a5ed088e8ea447be4ae589a527078d7dcfa256089fb067ebdc29` |
| 11 imagens `WhatsApp Image 2026-08-04 at 15.40.*.jpeg` | **Não fornecidas.** Conferência visual do catálogo |
| `PT_Investigação- Tomabamento Caminhão-rev01.pptx` | **Não fornecido.** Exemplo prático de fluxo |
| Planilhas "Plano de Recomendações" embutidas nos slides | **Não fornecidas** |

**Resultado da importação.** 99 dos 101 códigos receberam definição integral e os exemplos que o
próprio documento fornece. TE24 e HF26 ("Outro fator") constam do documento **sem definição alguma
além do rótulo** — registrado como `SEM_DEFINICAO_NA_FONTE`, com proveniência, porque ausência
confirmada na fonte é diferente de código não encontrado, e nenhuma das duas autoriza preencher por
inferência.

**Nenhuma divergência** foi encontrada entre os 101 títulos do catálogo (extraídos do prompt mestre)
e os títulos do documento. Isso é uma confirmação cruzada independente: duas fontes, o mesmo
resultado.

**Ainda pendente:** as 11 imagens de conferência visual. Todas as definições permanecem marcadas com
`requerConferenciaHumana: true` até serem conferidas contra elas.

Sobre o PPTX: sem ele, o fixture de regressão foi construído a partir do **tipo** de investigação
descrito no escopo (tombamento de equipamento móvel), com dados fictícios e sem nome, matrícula,
identidade corporativa ou conclusão do caso original. Os testes validam comportamento e regras, não
a reprodução de conclusões.

---

## 2. Confirmação do catálogo — 101 códigos

```
Total: 101/101
  OK  defesas_ausentes_ou_falhas: 21/21     (DF01–DF21)
  OK  acoes_individuais_ou_equipe: 14/14    (IT01–IT14)
  OK  condicoes_tarefa_ambiente: 24/24      (TE01–TE24)
  OK  fatores_humanos: 26/26                (HF01–HF26)
  OK  fatores_organizacionais: 16/16        (CM CO DE HW IG MC MM MS OC OL OR PR RI RM TR VW)
Duplicados: nenhum
Com definição importada: 99
Sem definição na fonte:  2  (TE24, HF26 — "Outro fator")
Com exemplos do documento: 80
```

Reproduzível com `npm run taxonomia:validar`. A validação é bloqueante: catálogo inconsistente é
falha, não aviso.

---

## 3. Verificação executada

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Checagem de tipos (estrito) | `npm run typecheck` | **Sem erros** |
| Lint | `npm run lint` | **Sem erros nem avisos** |
| Testes | `npm test` | **202 testes, 202 passando** |
| Build de produção | `npm run build` | **Compilado; 18 rotas geradas** |
| Estrutura do catálogo | `npm run taxonomia:validar` | **101/101 conforme** |
| Semeadura | `npm run db:seed` | **Caso carregado; verificadores executados** |
| Rotas HTTP autenticadas | Servidor de produção + sessão válida | **14 rotas em 200** |
| Rotas HTTP sem sessão | Servidor de produção sem cookie | **Todas redirecionam para `/entrar`; API devolve 401** |
| Cookie adulterado | Assinatura alterada | **Rejeitado; redireciona para `/entrar`** |
| Banco PostgreSQL | Migrações, consultas e gatilhos contra PostgreSQL 18 real (PGlite) | **41 testes passando** |
| API do classificador | `POST /api/agentes/classificador` | **Alternativas ranqueadas; TE22 na primeira posição; `requer_validacao_humana: true`** |
| Isolamento na API | Requisição com id de outra organização | **404, sem revelar existência** |

### Distribuição dos testes

| Suíte | Testes | Cobre |
| --- | --- | --- |
| `catalogo.test.ts` | 22 | 101 códigos, distribuição por grupo, proveniência, códigos genéricos e sensíveis, busca |
| `qualidade.test.ts` | 37 | Os verificadores da seção de qualidade, um a um, e a reconciliação de contagens |
| `agentes.test.ts` | 45 | Os 10 agentes, contratos, alternativas ranqueadas, preservação de conflito, validação de citação |
| `seguranca.test.ts` | 39 | Prompt injection (9 vetores), RBAC/ABAC, cadeia de auditoria, pseudonimização, isolamento |
| `postgres.test.ts` | 41 | Migrações, isolamento no banco, auditoria append-only garantida por gatilho, hash de senha, sessão assinada, bloqueio por tentativa, autenticação ponta a ponta |
| `secao13-fluxo-vertical.test.ts` | 18 | Os 14 comportamentos exigidos + fluxo vertical ponta a ponta + mapa causal |

### Os 14 comportamentos exigidos

Cada um tem teste nomeado em `tests/secao13-fluxo-vertical.test.ts`:

1. cronologia com manutenção e alarmes anteriores ✔
2. coleta organizada por PEEPO com responsável e prazo ✔
3. separação entre fatos, fatores contribuintes, causas sistêmicas e melhorias não causais ✔
4. conflito entre leitura relatada e registro técnico preservado ✔
5. matriz com limite do procedimento, nota de manutenção, parâmetro configurado e valor observado ✔
6. detecção de relógios de sistemas divergentes ✔
7. bypass de barreira de engenharia identificado sem encerrar no executante ✔
8. recorrência de alarmes ligada à aprendizagem organizacional apenas com evidência ✔
9. distinção entre condição mecânica, ambiente, ação humana, defesa e fator organizacional ✔
10. ações ligadas aos fatores e classificadas na hierarquia de controles ✔
11. plano excessivamente administrativo é desafiado ✔
12. reconciliação automática de contagens ✔
13. exigência de métrica de eficácia e risco residual ✔
14. relatório com citações rastreáveis ✔

---

## 4. O que NÃO pôde ser verificado

Declarado explicitamente, conforme exigido:

| Item | Motivo | Risco | Como validar |
| --- | --- | --- | --- |
| **Schema Prisma** (`prisma/schema.prisma`) | Não é mais usado em execução: a persistência passou a ser SQL direto, verificado contra PostgreSQL real. O arquivo permanece como referência do modelo relacional completo | **Nulo para a execução.** É documentação do próximo incremento | — |
| **Comportamento sob carga real** | Testado contra PostgreSQL em WebAssembly, não contra um servidor com concorrência e latência de rede | **Médio.** O SQL é o mesmo; o que não foi exercitado é contenção e pool | Rodar a suíte apontando `DATABASE_URL` para um PostgreSQL de homologação |
| **Fluxo de login pela interface** | Verificado no serviço e pelo caminho cookie→sessão→autorização via HTTP. O envio do formulário em si (Server Action) não foi automatizado | **Baixo.** As duas pontas estão cobertas | Teste de navegador (Playwright) no backlog |
| **Acessibilidade WCAG 2.2 AA** | Não houve auditoria com leitor de tela nem ferramenta automatizada (axe, Lighthouse) | **Médio.** As diretrizes foram aplicadas por construção (foco visível, `lang`, `caption`, `aria-live`, contraste, cor nunca única portadora de informação), mas construção não substitui auditoria | Rodar axe-core e navegação por teclado e leitor de tela em cada rota |
| **Adaptador Anthropic em execução real** | Sem chave de API. O código do adaptador e a extração de JSON não foram exercitados contra a API | **Baixo.** O contrato Zod rejeita saída malformada; a falha do provedor cai para a heurística e registra o erro | Configurar `ANTHROPIC_API_KEY` e `IA_ENVIO_EXTERNO_AUTORIZADO=true` e comparar as saídas |
| **Qualidade do classificador contra especialistas** | Não há conjunto dourado revisado | **Médio.** As métricas de precisão/recall por código estão no roadmap | Montar conjunto dourado com facilitadores ICAM |

---

## 5. Limitações de escopo declaradas

Estas não são falhas: são limites do MVP, registrados para não haver redução silenciosa.

1. **Autenticação implementada.** Login por usuário, senha com scrypt, sessão revogável em cookie
   assinado, bloqueio por tentativa e troca obrigatória no primeiro acesso. Falta MFA/SSO.
2. **Persistência em PostgreSQL implementada e verificada.** O dossiê da investigação é gravado em
   JSONB dentro de uma tabela com colunas relacionais para isolamento e índice; usuários, sessões,
   auditoria e execuções de IA são totalmente relacionais. A normalização relacional dos agregados
   do dossiê é o próximo incremento — ver ADR-09.
3. **Sem upload real de arquivo.** O modelo de evidência, cadeia de custódia e derivados está
   completo; falta a camada de recebimento com validação e antivírus. É o P0 remanescente.
4. **Exportação em Markdown e JSON.** PDF e DOCX partem da mesma estrutura já compilada.
5. **Busca textual determinística**, não vetorial.
6. **A gravação da classificação a partir da decisão do classificador** está registrada na tela mas
   ainda não persiste o fator — declarado na própria interface.

---

## 6. Riscos remanescentes

| Risco | Impacto | Mitigação atual | Ação recomendada |
| --- | --- | --- | --- |
| Catálogo sem definições integrais | Classificação apoiada só no título do código | Alerta na interface e no catálogo; alerta por alternativa no classificador; código marcado para conferência | Fornecer o DOCX e rodar o importador |
| Caso fictício confundido com investigação real | Dados de demonstração em relatório real | Semeadura marca a origem na auditoria; `--sem-demonstracao` evita carregá-lo | Remover o caso antes do uso efetivo |
| Trilha de auditoria adulterada | Log reescrito por quem tem acesso ao banco | Cadeia de hash **mais** gatilho no PostgreSQL que recusa UPDATE e DELETE | Âncora externa periódica |
| Senha comprometida | Acesso completo ao perfil do usuário | Política NIST, bloqueio por tentativa, sessão revogável | MFA/SSO |
| Excesso de confiança nas sugestões da IA | Investigador aceitar alternativa sem verificar | Alternativas ranqueadas, alerta de que semelhança textual não classifica, bloqueio de confirmação sem evidência e mecanismo, decisão humana obrigatória | Medir taxa de aceitação sem edição no conjunto dourado |
| Fixture confundido com caso real | Dados fictícios em relatório real | Semeadura marca origem como demonstração na auditoria | Separar ambientes |

---

## 7. Onde encontrar cada requisito no código

| Requisito do escopo | Arquivo |
| --- | --- |
| Catálogo dos 101 códigos | `data/icam-taxonomy.pt-BR.json`, `src/domain/taxonomia/` |
| Modelo de dados mínimo | `prisma/schema.prisma` |
| Fluxo ICAM completo | `src/app/investigacoes/[id]/` |
| Os 10 agentes | `src/agentes/` |
| Contrato de saída obrigatório | `src/agentes/contratos.ts` |
| Verificadores de qualidade causal | `src/domain/qualidade/` |
| Prompt injection | `src/seguranca/injecao.ts` |
| RBAC/ABAC e isolamento | `src/seguranca/rbac.ts` |
| Auditoria resistente a adulteração | `src/seguranca/auditoria.ts` |
| Privacidade e pseudonimização | `src/seguranca/redacao.ts` |
| Hierarquia de controles | `src/domain/recomendacoes/hierarquia.ts` |
| Mapa causal e contrafactual | `src/domain/causal/grafo.ts` |
| Normalização temporal | `src/domain/tempo/normalizacao.ts` |
| Fixture anonimizado | `src/fixtures/casoAnonimizado.ts` |
| Autenticação e sessão | `src/servidor/autenticacao.ts`, `src/seguranca/senha.ts`, `src/seguranca/sessaoAssinada.ts` |
| Persistência PostgreSQL | `db/migracoes/`, `src/servidor/bd.ts`, `src/servidor/repositorioPostgres.ts` |
| Publicação na Web | `Dockerfile`, `render.yaml`, `PUBLICAR.md` |
| Regressão dos 14 comportamentos | `tests/secao13-fluxo-vertical.test.ts` |

---

## 8. Conclusão

O fluxo vertical está **executável e verificado**: criar investigação → importar evidência →
extrair fato com citação → classificar candidato ICAM → revisar com decisão humana → criar ação
vinculada ao fator → gerar trecho de relatório com citação rastreável. O percurso é coberto por
teste de integração e foi exercitado contra o servidor de produção via HTTP.

A plataforma está **publicável**: autenticação por usuário, PostgreSQL com migrações, auditoria que
o próprio banco impede de adulterar, imagem Docker e configuração de nuvem — tudo verificado contra
o motor PostgreSQL real.

O que ainda falta antes de dados sensíveis — upload com antivírus, MFA/SSO, criptografia de campo,
retenção automática e avaliação de impacto — está identificado, priorizado e declarado em
`PUBLICAR.md`. Nada foi silenciado.
