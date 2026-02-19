-- Add client_code field to tools table
-- kind='page' tools store their JS logic here; kind='link' tools leave it NULL

ALTER TABLE tools ADD COLUMN client_code TEXT NULL;
