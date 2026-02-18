-- Tools center (public tools list + admin CRUD)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  group_key TEXT NOT NULL DEFAULT 'utils' CHECK (group_key IN ('games','apis','utils','other')),
  kind TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link','page')),
  url TEXT NULL,
  icon TEXT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tools_enabled_sort ON tools(enabled, sort_order, updated_at);
