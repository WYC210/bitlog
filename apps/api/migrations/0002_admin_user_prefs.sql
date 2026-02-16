-- Admin user preferences (shortcuts, editor layout)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_user_prefs (
  admin_user_id TEXT PRIMARY KEY,
  shortcuts_json TEXT NOT NULL DEFAULT '',
  editor_layout TEXT NOT NULL DEFAULT 'split' CHECK (editor_layout IN ('split','write','preview')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

