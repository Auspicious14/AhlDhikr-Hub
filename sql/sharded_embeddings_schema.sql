CREATE TABLE IF NOT EXISTS document_embeddings (
  id BIGINT PRIMARY KEY,
  shard_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  text TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding DOUBLE PRECISION[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_type
  ON document_embeddings(type);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_shard_id
  ON document_embeddings(shard_id);

