-- Chat storage
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         uuid PRIMARY KEY,
  state      jsonb NOT NULL,
  touched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  user_id    text NOT NULL,
  role       text NOT NULL CHECK (role IN ('user','bot')),
  text       text NOT NULL,
  style      text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_user_session_idx ON chat_messages (user_id, session_id, id);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (created_at);
CREATE INDEX IF NOT EXISTS chat_sessions_touched_idx ON chat_sessions (touched_at);

-- RAG knowledge base (PostgreSQL full-text search, needs PostgreSQL 12+)
CREATE TABLE IF NOT EXISTS kb_documents (
  id           serial PRIMARY KEY,
  source       text NOT NULL UNIQUE,
  title        text NOT NULL,
  content_hash text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id     bigserial PRIMARY KEY,
  doc_id int NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  idx    int NOT NULL,
  text   text NOT NULL,
  tsv    tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX IF NOT EXISTS kb_chunks_tsv_idx ON kb_chunks USING gin (tsv);
