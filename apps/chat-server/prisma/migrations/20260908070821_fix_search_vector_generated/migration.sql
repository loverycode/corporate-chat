DROP INDEX IF EXISTS messages_search_vector_idx;

ALTER TABLE messages DROP COLUMN search_vector;

ALTER TABLE messages ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('russian', coalesce(body_md, ''))) STORED;

CREATE INDEX messages_search_vector_idx ON messages USING GIN (search_vector);