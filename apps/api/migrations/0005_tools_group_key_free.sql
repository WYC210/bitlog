-- Relax tools.group_key constraint to allow custom groups.
-- Previously: CHECK (group_key IN ('games','apis','utils','other'))

PRAGMA foreign_keys = OFF;

BEGIN;

DROP TABLE IF EXISTS tools__new;

CREATE TABLE tools__new (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  group_key TEXT NOT NULL DEFAULT 'utils',
  kind TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link','page')),
  url TEXT NULL,
  icon TEXT NULL,
  client_code TEXT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO tools__new (
  id,
  slug,
  title,
  description,
  group_key,
  kind,
  url,
  icon,
  client_code,
  enabled,
  sort_order,
  created_at,
  updated_at
)
SELECT
  id,
  slug,
  title,
  description,
  group_key,
  kind,
  url,
  icon,
  client_code,
  enabled,
  sort_order,
  created_at,
  updated_at
FROM tools;

DROP TABLE tools;
ALTER TABLE tools__new RENAME TO tools;

CREATE INDEX IF NOT EXISTS tools_enabled_sort ON tools(enabled, sort_order, updated_at);

COMMIT;

PRAGMA foreign_keys = ON;
