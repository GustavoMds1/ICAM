# Plano técnico, backlog e roadmap

## 1. Incrementos entregues

| # | Incremento | Estado | Verificação |
| --- | --- | --- | --- |
| 1 | Catálogo ICAM versionado com proveniência | Concluído | 19 testes; `npm run taxonomia:validar` |
| 2 | Camada de domínio (asserções, tempo, causalidade, controles) | Concluído | Coberto pelas suítes de qualidade e seção 13 |
| 3 | 26 verificadores de qualidade causal | Concluído | 37 testes |
| 4 | Dez agentes com contrato Zod e provedor determinístico | Concluído | 45 testes |
| 5 | Segurança: injeção, RBAC/ABAC, auditoria, pseudonimização | Concluído | 39 testes |
| 6 | Persistência com isolamento e versionamento | Concluído | Testes de isolamento e integridade |
| 7 | Interface pt-BR do fluxo ICAM | Concluído | `next build`; smoke test HTTP das 13 rotas |
| 8 | Fluxo vertical ponta a ponta | Concluído | Teste de integração + verificação HTTP da API |
| 9 | Fixture anonimizado e regressão da seção 13 | Concluído | 18 testes |
| 10 | Catálogo com definições integrais importadas do DOCX | Concluído | 22 testes; 99/101 com definição |
| 11 | Autenticação real com login por usuário | Concluído | Coberto pelos testes de PostgreSQL |
| 12 | Persistência PostgreSQL com migrações | Concluído | 41 testes contra PostgreSQL real |
| 13 | Empacotamento e configuração de implantação | Concluído | `next build`; rotas verificadas com e sem sessão |

**Total: 202 testes, todos passando.**

---

## 2. Backlog priorizado

A ordem reflete risco: primeiro o que impede uso real, depois o que amplia o alcance.

### P0 — Impedem uso com dados reais

| Item | Por que é P0 | Esforço |
| --- | --- | --- |
| ~~Autenticação e sessão~~ | **Concluído.** Falta apenas MFA/SSO, abaixo | — |
| ~~Adaptador PostgreSQL~~ | **Concluído** e verificado contra PostgreSQL real | — |
| **Upload de arquivo com validação** — limite de tamanho, verificação de tipo real (magic bytes), antivírus, quarentena, armazenamento S3 com hash | Sem isso não há evidência real no sistema: hoje a evidência é registrada por referência | M |
| **MFA e/ou SSO** (OIDC/SAML) | Uma senha comprometida dá acesso completo ao perfil | M |
| **Tela de administração de usuários** | Criar e desativar contas exige acesso ao shell do servidor | S |
| **Criptografia de campo para dado sensível** | O banco é cifrado em repouso pelo provedor, mas os campos não têm cifra própria | M |
| **Retenção, descarte e teste de restauração de backup** | Requisito legal; backup não testado não é backup | S |

### P1 — Completam o método

| Item | Detalhe | Esforço |
| --- | --- | --- |
| Telas de escrita completas | Criar e editar fatos, classificações, conflitos, recomendações e itens PEEPO pela interface | L |
| Gravação da decisão do classificador | Hoje a decisão é registrada na tela; falta persistir a classificação a partir dela | S |
| OCR e transcrição | Fila assíncrona, derivados versionados, revisão humana obrigatória | M |
| Exportação PDF e DOCX | A partir da estrutura já compilada pelo agente de relatório | M |
| Módulo de entrevistas | Consentimento, roteiro, gravação, transcrição, revisão pelo entrevistado | M |
| Acompanhamento de eficácia | Ciclo de verificação pós-implementação com alerta de vencimento | M |
| Fluxo de aprovação | Solicitação, decisão, ressalva e reabertura | S |

### P2 — Ampliam alcance

| Item | Detalhe | Esforço |
| --- | --- | --- |
| Busca semântica com filtro de autorização | Índice vetorial restrito ao acervo da investigação | M |
| Visualização gráfica do mapa causal | Diagrama interativo com arrastar e conectar | M |
| Conjunto dourado e métricas de avaliação da IA | Precisão/recall por código, calibração de confiança, taxa de aceitação | L |
| Painéis de portfólio | Prazos, reincidência, eficácia por área | M |
| Trilha WORM ou âncora externa | Prevenção, não só detecção, de adulteração | M |
| Múltiplos idiomas | Estrutura já separa rótulos do domínio | M |

---

## 3. Roadmap para produção

### Fase A — Fundação segura (P0)
Autenticação real, adaptador PostgreSQL, upload validado, criptografia, backup. **Critério de
saída:** teste de penetração básico sem achado crítico; isolamento entre organizações verificado com
usuários reais; restauração de backup testada.

### Fase B — Método completo (P1)
Telas de escrita, OCR/transcrição, exportações, entrevistas, eficácia, aprovações. **Critério de
saída:** uma investigação real conduzida ponta a ponta sem planilha paralela.

### Fase C — Escala e avaliação (P2)
Busca semântica, mapa gráfico, métricas da IA, painéis. **Critério de saída:** conjunto dourado
revisado por especialistas com métricas publicadas; concordância medida entre a sugestão da IA e a
decisão do investigador.

### Fase D — Operação
Observabilidade (logs estruturados, métricas, tracing), ambientes separados, plano de resposta a
incidente, avaliação de impacto à proteção de dados, revisão periódica do catálogo.

---

## 4. Como validar cada entrega

| Camada | Como verificar |
| --- | --- |
| Domínio | `npm test` — regras determinísticas, sem banco |
| Catálogo | `npm run taxonomia:validar` — falha o build se a estrutura divergir |
| Agentes | Contrato Zod + testes de comportamento por agente |
| Autorização | Testes de isolamento, papel, vínculo e campo sensível |
| Interface | `npm run build` + verificação HTTP das rotas |
| Fluxo vertical | Teste de integração que percorre criar → citar → classificar → agir → relatar |

**Regra de aceite transversal:** nenhuma entrega pode reduzir a cobertura dos verificadores de
qualidade nem tornar opcional uma decisão humana hoje obrigatória.
