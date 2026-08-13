# Especificação do produto

## 1. Visão

Uma plataforma que conduz o investigador pelo ciclo completo de uma investigação ICAM, mantendo
rastreabilidade entre evidência, fato, fator, causa, ação e eficácia — e que **impede** que a
investigação avance com conclusões sem sustentação.

O diferencial não é a IA gerar texto. É o produto tornar visível e obrigatório o que normalmente se
perde: a evidência contrária, a contradição não resolvida, a lacuna, o mecanismo causal, o fator
organizacional, a força real do controle proposto e a decisão humana por trás de cada conclusão.

---

## 2. Personas

| Persona | Necessidade central | O que a frustra hoje |
| --- | --- | --- |
| **Facilitador ICAM** | Conduzir a análise sem que a equipe pule para a causa antes de estabelecer os fatos | Reuniões que terminam em "falta de atenção"; método aplicado de forma desigual entre times |
| **Líder da investigação** | Saber o que falta, quem está com cada pendência e o que impede o fechamento | Planilhas paralelas; descobrir lacuna na véspera da apresentação |
| **Especialista técnico** (manutenção, engenharia, operação) | Que a evidência técnica não seja sobrescrita por relato | Ver o registro de telemetria descartado porque "o operador disse outra coisa" |
| **Revisor / aprovador** | Verificar se cada conclusão tem sustentação antes de assinar | Ler relatório sem conseguir rastrear de onde veio cada afirmação |
| **Gestor de área** | Receber ações que mudem o sistema, não recados | Plano de ação com "reforçar treinamento" em cinco linhas diferentes |
| **Encarregado de privacidade** | Garantir tratamento adequado de dado pessoal e sensível | Nome, matrícula e dado de saúde circulando em anexos de relatório |

---

## 3. Jornadas principais

### 3.1 Da notificação ao plano de coleta
Registrar o evento com severidade real e potencial → montar equipe com declaração de conflito de
interesse → gerar plano PEEPO com pergunta investigativa, evidência esperada, responsável e prazo →
visualizar cobertura por dimensão.

### 3.2 Da evidência ao fato
Importar evidência (hash, cadeia de custódia, confidencialidade) → extrair proposições candidatas
com citação obrigatória → classificar o tipo de asserção → vincular evidências favoráveis **e**
contrárias → decisão humana promove candidato a fato.

### 3.3 Do fato ao fator ICAM
Descrever o achado → solicitar alternativas ranqueadas ao classificador → avaliar evidência,
mecanismo e motivo de não escolher os códigos próximos → aceitar, editar ou rejeitar com
justificativa → definir estado da barreira quando for defesa → responder o teste contrafactual →
confirmar com natureza declarada.

### 3.4 Do fator à ação eficaz
Vincular recomendação ao fator e ao mecanismo de risco → escolher hierarquia de controle e
justificar → registrar avaliação de alternativas superiores quando o controle for fraco → definir
responsável, prazo, indicador com meta e método, e risco residual → acompanhar a eficácia.

### 3.5 Do dossiê ao relatório aprovado
Compilar a minuta a partir dos registros → resolver bloqueios de qualidade → registrar opiniões
divergentes → obter aprovações obrigatórias → publicar versão com contagens reconciliadas e
citações rastreáveis.

---

## 4. Requisitos funcionais

### RF-01 Notificação e triagem
Registrar descrição inicial, data/hora com precisão declarada, local, atividade, envolvidos,
consequências reais e potenciais por dimensão, severidade, ações imediatas, condição do local e
nível de investigação.

*Aceite:* severidade potencial é campo obrigatório e distinto da real; precisão temporal
(exato/aproximado/intervalo/desconhecido) é sempre explícita.

### RF-02 Governança
Definir papéis (líder, dono do evento, facilitador, técnicos, revisores, aprovadores) com
declaração de conflito de interesse visível para toda a equipe.

*Aceite:* conflito declarado aparece na visão geral, não apenas no cadastro.

### RF-03 Plano PEEPO
Cada item traz dimensão, pergunta investigativa, evidência esperada, responsável, prazo,
prioridade, status e vínculo com hipótese ou lacuna. O sistema mostra cobertura por dimensão.

*Aceite:* dimensão sem nenhum item coletado gera alerta de qualidade.

### RF-04 Evidências e cadeia de custódia
Identificador, origem, responsável pela coleta, data de obtenção e do conteúdo, hash SHA-256,
arquivo original, derivados versionados, confidencialidade, autenticidade, limitações e histórico
de acesso.

*Aceite:* o arquivo original nunca é substituído; OCR, transcrição e extração são derivados com
proveniência e podem ser marcados para revisão.

### RF-05 Entrevistas
Planejamento, consentimento com base legal, roteiro, transcrição, revisão pelo entrevistado e
marcação de trechos. As perguntas geradas são abertas, neutras e ancoradas em lacuna, hipótese ou
conflito.

*Aceite:* pergunta com padrão indutivo ou culpabilizador é sinalizada antes do uso.

### RF-06 Cronologia
Eventos com instante bruto preservado, instante normalizado derivado, fonte temporal identificada,
desvio de relógio, precisão e conflito temporal.

*Aceite:* correção de relógio nunca sobrescreve o valor bruto; divergência entre fontes é reportada
como achado.

### RF-07 Livro de fatos
Proposição atômica, tipo de asserção, estado de verificação, evidências favoráveis e contrárias,
confiança e decisão humana.

*Aceite:* registro cujo tipo é inferência, hipótese ou informação contestada não pode ser marcado
como corroborado.

### RF-08 Matriz de contradições
Versões conflitantes lado a lado, com confiabilidade de cada fonte e diligências recomendadas.

*Aceite:* nenhuma fonte sobrescreve outra; resolução exige registro de qual versão prevaleceu e por
quê.

### RF-09 Classificação ICAM
Catálogo de 101 códigos pesquisável; classificação com código principal, secundários, descrição
contextual, mecanismo, evidências dos dois lados, estado, natureza, confiança, estado da barreira e
decisão humana.

*Aceite:* o classificador devolve alternativas ranqueadas com motivo de não escolher as próximas;
confirmação é bloqueada sem evidência e sem mecanismo; código "Outro" exige justificativa; código
sensível exige evidência objetiva.

### RF-10 Mapa causal
Quatro colunas, ligações como afirmações testáveis com grau de sustentação, teste contrafactual e
detecção de ciclos e fatores órfãos.

*Aceite:* ligação que afirma causalidade com sustentação fraca ou não avaliada é bloqueada.

### RF-11 Recomendações e plano de ação
Vínculo obrigatório com fator e mecanismo de risco, hierarquia de controle justificada,
responsável, prazo, indicador com meta e método, risco residual e acompanhamento de eficácia.

*Aceite:* ação sem responsável, prazo, indicador ou risco residual é bloqueada; plano com mais de
70% de controles administrativos/EPI é desafiado.

### RF-12 Relatório e aprovação
Minuta versionada montada a partir dos registros, com contagens reconciliadas, citações
rastreáveis, contribuições de IA identificadas e opiniões divergentes preservadas.

*Aceite:* publicação exige aprovação de conclusões, recomendações e publicação; seção sem dado diz
"sem registro" em vez de ser preenchida.

### RF-13 Qualidade causal
Execução contínua dos verificadores, com severidade e princípio metodológico associado a cada
regra.

*Aceite:* bloqueio impede publicação; alerta exige justificativa registrada.

### RF-14 Governança de IA
Configuração do provedor, política de envio externo, residência de dados e não treinamento;
registro de toda execução com hash da entrada e sinalizações de segurança.

*Aceite:* provedor externo sem autorização de envio não realiza nenhuma chamada.

### RF-15 Auditoria
Trilha append-only de ações humanas e de IA, encadeada por hash, com verificação de integridade.

*Aceite:* alteração ou remoção de registro quebra a verificação e aponta a posição.

---

## 5. Requisitos não funcionais

| Categoria | Requisito |
| --- | --- |
| Acessibilidade | WCAG 2.2 AA: foco visível, navegação por teclado, contraste, `lang="pt-BR"`, tabelas com `caption`, regiões `aria-live` para conteúdo assíncrono, cor nunca como único portador de informação, respeito a `prefers-reduced-motion` |
| Idioma | Interface, mensagens e dados em português do Brasil |
| Segurança | RBAC + ABAC, isolamento por organização, CSP restritiva, cabeçalhos de segurança, defesa contra prompt injection |
| Privacidade | Pseudonimização por padrão, redação de PII, proteção reforçada de dado sensível, registro de base legal |
| Determinismo | Verificadores e agentes determinísticos produzem a mesma saída para a mesma entrada |
| Manutenibilidade | TypeScript estrito, domínio sem dependência de framework, arquivos coesos, sem `any` |
| Observabilidade | Registro de execução de IA com duração, provedor, modelo e sinalizações |

---

## 6. Escopo do MVP

### Dentro do escopo (implementado)

- Catálogo dos 101 códigos versionado, validado e pesquisável, com proveniência
- Modelo de dados completo do domínio (`prisma/schema.prisma`)
- Camada de domínio: tipos de asserção, tempo, causalidade, contrafactual, hierarquia de controles
- 26 verificadores automáticos de qualidade causal
- Os 10 agentes com contrato Zod, provedor determinístico e adaptador Anthropic
- Segurança: prompt injection, RBAC/ABAC, auditoria encadeada, pseudonimização
- Interface em pt-BR: portfólio, visão geral, cronologia, evidências, fatos, contradições, gráfico
  ICAM, plano de ação, qualidade, relatório, catálogo, governança de IA, auditoria
- Fluxo vertical executável: criar → importar → extrair fato com citação → classificar → revisar →
  criar ação → gerar trecho de relatório
- Fixture anonimizado e suíte de regressão dos 14 comportamentos exigidos

### Fora do escopo do MVP (declarado, não silenciado)

- Autenticação real com MFA/SSO — sessão usa ator fixo de demonstração
- Adaptador PostgreSQL/Prisma — schema pronto, implementação pendente
- Upload real de arquivos, OCR e transcrição — contratos e modelo prontos
- Exportação para PDF e DOCX — Markdown e JSON estruturado disponíveis
- Busca vetorial — busca textual determinística implementada
- Fila de tarefas assíncronas
- Telas de escrita para todas as entidades — o MVP prioriza o fluxo vertical

O detalhamento e a ordem de execução estão em [`PLANO.md`](./PLANO.md).
