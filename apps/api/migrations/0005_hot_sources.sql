-- Hot sources (today hotlist)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hot_sources (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('rss', 'rsshub')),
  route_or_url TEXT NOT NULL,
  icon TEXT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS hot_sources_enabled_sort ON hot_sources(enabled, sort_order, updated_at);

-- Seed: minimal "easy" sources (can be edited in admin)
INSERT OR IGNORE INTO hot_sources
  (id, slug, name, category, kind, route_or_url, icon, enabled, sort_order, created_at, updated_at)
VALUES
  ('hot_linuxdo', 'linuxdo', 'Linux DO', '技术', 'rss', 'https://linux.do/latest.rss', 'https://www.google.com/s2/favicons?domain=linux.do&sz=64', 1, 10, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('hot_hackernews', 'hackernews', 'Hacker News', '技术', 'rsshub', '/hackernews/best', 'https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=64', 1, 20, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('hot_v2ex', 'v2ex', 'V2EX 热门', '技术', 'rsshub', '/v2ex/topics/hot', 'https://www.google.com/s2/favicons?domain=v2ex.com&sz=64', 1, 30, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('hot_zaobao', 'zaobao', '联合早报', '新闻', 'rsshub', '/zaobao/realtime/china', 'https://www.google.com/s2/favicons?domain=zaobao.com&sz=64', 1, 40, strftime('%s','now')*1000, strftime('%s','now')*1000);

-- Default RSSHub instance settings (admin can override via /api/admin/settings)
INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES
  ('hot.rsshub_url', 'https://rsshub.rssforever.com', strftime('%s','now')*1000),
  ('hot.rsshub_fallback_urls', 'https://rsshub.feeded.xyz,https://hub.slarker.me', strftime('%s','now')*1000);

