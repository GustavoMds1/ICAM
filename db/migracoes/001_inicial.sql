-- ---------------------------------------------------------------------------
-- Migração 001 — estrutura inicial em PostgreSQL
--
-- Escopo desta migração (declarado, não silencioso):
--   RELACIONAL para o que exige integridade, isolamento, índice e auditoria:
--     organizações, usuários, sessões, tentativas de acesso, investigações
--     (metadados consultáveis), trilha de auditoria e execuções de IA.
--   JSONB para o corpo do dossiê (fatos, classificações, conflitos, PEEPO,
--     recomendações). O modelo relacional completo desses agregados está em
--     prisma/schema.prisma e é o próximo incremento — ver ARQUITETURA.md,
--     ADR-09.
--
-- Toda tabela carrega organizacao_id: o isolamento é estrutural, não
-- convencional. Registros críticos são append-only.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizacoes (
  id           TEXT PRIMARY KEY,
  nome         TEXT NOT NULL,
  cnpj         TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  excluido_em  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS usuarios (
  id                        TEXT PRIMARY KEY,
  organizacao_id            TEXT NOT NULL REFERENCES organizacoes(id),
  nome                      TEXT NOT NULL,
  email                     TEXT NOT NULL,
  senha_hash                TEXT NOT NULL,
  papel_global              TEXT NOT NULL,
  pode_ver_campos_sensiveis BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_habilitado            BOOLEAN NOT NULL DEFAULT FALSE,
  ativo                     BOOLEAN NOT NULL DEFAULT TRUE,
  deve_trocar_senha         BOOLEAN NOT NULL DEFAULT TRUE,
  senha_alterada_em         TIMESTAMPTZ,
  ultimo_acesso_em          TIMESTAMPTZ,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  excluido_em               TIMESTAMPTZ,
  CONSTRAINT usuarios_papel_valido CHECK (
    papel_global IN ('administrador', 'gestor', 'investigador', 'revisor', 'aprovador', 'leitor')
  )
);

-- E-mail único por organização, ignorando caixa e registros excluídos.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico
  ON usuarios (organizacao_id, lower(email))
  WHERE excluido_em IS NULL;

CREATE TABLE IF NOT EXISTS sessoes (
  id              TEXT PRIMARY KEY,
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id),
  organizacao_id  TEXT NOT NULL REFERENCES organizacoes(id),
  criada_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em       TIMESTAMPTZ NOT NULL,
  ultima_atividade TIMESTAMPTZ NOT NULL DEFAULT now(),
  origem_ip       TEXT,
  agente_usuario  TEXT,
  encerrada_em    TIMESTAMPTZ,
  motivo_encerramento TEXT
);

CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes (usuario_id, expira_em);

-- Base do limite de tentativas de login. Append-only.
CREATE TABLE IF NOT EXISTS tentativas_login (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  origem_ip       TEXT,
  sucesso         BOOLEAN NOT NULL,
  motivo          TEXT,
  ocorrido_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tentativas_login_email ON tentativas_login (lower(email), ocorrido_em DESC);

CREATE TABLE IF NOT EXISTS investigacoes (
  id                    TEXT PRIMARY KEY,
  organizacao_id        TEXT NOT NULL REFERENCES organizacoes(id),
  codigo                TEXT NOT NULL,
  titulo                TEXT NOT NULL,
  fase                  TEXT NOT NULL DEFAULT 'notificacao',
  status                TEXT NOT NULL DEFAULT 'aberta',
  confidencialidade     TEXT NOT NULL DEFAULT 'interna',
  severidade_real       TEXT NOT NULL DEFAULT 'nao_classificada',
  severidade_potencial  TEXT NOT NULL DEFAULT 'nao_classificada',
  ocorrido_em           TIMESTAMPTZ,
  prazo_limite          TIMESTAMPTZ,
  -- Corpo do dossiê: evidências, fatos, classificações, conflitos, PEEPO,
  -- recomendações, relatório. Ver nota de escopo no topo do arquivo.
  dossie                JSONB NOT NULL,
  metadados             JSONB NOT NULL,
  versao                INTEGER NOT NULL DEFAULT 1,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  excluido_em           TIMESTAMPTZ,
  CONSTRAINT investigacoes_codigo_unico UNIQUE (organizacao_id, codigo)
);

CREATE INDEX IF NOT EXISTS investigacoes_org_status ON investigacoes (organizacao_id, status);
CREATE INDEX IF NOT EXISTS investigacoes_org_fase   ON investigacoes (organizacao_id, fase);
CREATE INDEX IF NOT EXISTS investigacoes_dossie     ON investigacoes USING GIN (dossie);

-- Histórico imutável de versões: nenhuma gravação sobrescreve o passado.
CREATE TABLE IF NOT EXISTS investigacoes_versoes (
  investigacao_id  TEXT NOT NULL REFERENCES investigacoes(id),
  versao           INTEGER NOT NULL,
  organizacao_id   TEXT NOT NULL REFERENCES organizacoes(id),
  dossie           JSONB NOT NULL,
  metadados        JSONB NOT NULL,
  gravado_por      TEXT,
  gravado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (investigacao_id, versao)
);

-- ---------------------------------------------------------------------------
-- Trilha de auditoria encadeada por hash. Append-only por construção:
-- o gatilho abaixo recusa UPDATE e DELETE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id              TEXT PRIMARY KEY,
  organizacao_id  TEXT NOT NULL REFERENCES organizacoes(id),
  usuario_id      TEXT,
  ator_tipo       TEXT NOT NULL DEFAULT 'humano',
  acao            TEXT NOT NULL,
  entidade_tipo   TEXT NOT NULL,
  entidade_id     TEXT NOT NULL,
  investigacao_id TEXT,
  antes_json      TEXT,
  depois_json     TEXT,
  origem_ip       TEXT,
  agente_usuario  TEXT,
  hash_anterior   TEXT,
  hash_registro   TEXT NOT NULL,
  sequencia       BIGSERIAL,
  ocorrido_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_ator_valido CHECK (ator_tipo IN ('humano', 'ia', 'sistema'))
);

CREATE INDEX IF NOT EXISTS auditoria_org_seq ON auditoria (organizacao_id, sequencia);
CREATE INDEX IF NOT EXISTS auditoria_entidade ON auditoria (entidade_tipo, entidade_id);

CREATE OR REPLACE FUNCTION auditoria_somente_insercao() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'A trilha de auditoria é append-only: % não é permitido.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auditoria_bloqueia_alteracao ON auditoria;
CREATE TRIGGER auditoria_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_somente_insercao();

-- ---------------------------------------------------------------------------
-- Execuções de IA — registro completo para auditoria e avaliação.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS execucoes_ia (
  id                 TEXT PRIMARY KEY,
  organizacao_id     TEXT NOT NULL REFERENCES organizacoes(id),
  investigacao_id    TEXT NOT NULL,
  agente             TEXT NOT NULL,
  provedor           TEXT NOT NULL,
  modelo             TEXT,
  parametros_json    TEXT,
  entrada_hash       TEXT NOT NULL,
  entrada_resumo     TEXT,
  saida_json         TEXT NOT NULL,
  citacoes_validadas BOOLEAN NOT NULL DEFAULT FALSE,
  sinalizacoes_json  TEXT,
  duracao_ms         INTEGER,
  erro               TEXT,
  executado_por      TEXT,
  executado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execucoes_ia_investigacao ON execucoes_ia (investigacao_id, executado_em DESC);

-- Controle de migrações aplicadas.
CREATE TABLE IF NOT EXISTS migracoes (
  nome        TEXT PRIMARY KEY,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
