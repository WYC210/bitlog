-- Initial schema for bitlog MVP (Cloudflare D1 / SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash BLOB NOT NULL,
  password_salt BLOB NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  refresh_token_hash BLOB NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent TEXT NULL,
  ip TEXT NULL,
  UNIQUE (refresh_token_hash),
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS admin_sessions_admin ON admin_sessions(admin_user_id, expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limit_expires ON rate_limit_counters(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  storage_provider TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256_hex TEXT NOT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NULL,
  UNIQUE (storage_provider, storage_key),
  UNIQUE (sha256_hex),
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category_id TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','scheduled')),
  publish_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  content_md TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_text TEXT NOT NULL,
  cover_asset_id TEXT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_asset_id) REFERENCES assets(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS posts_status_publish_at ON posts(status, publish_at);
CREATE INDEX IF NOT EXISTS posts_updated_at ON posts(updated_at);
CREATE INDEX IF NOT EXISTS posts_category ON posts(category_id);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS post_tags_tag ON post_tags(tag_id, post_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

