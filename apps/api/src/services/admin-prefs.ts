import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";

export type EditorLayout = "split" | "write" | "preview";

export interface AdminPrefs {
  shortcutsJson: string | null;
  editorLayout: EditorLayout;
}

export async function getAdminPrefs(db: Db, adminUserId: string): Promise<AdminPrefs> {
  const now = Date.now();
  await db.execute(
    sql`INSERT INTO admin_user_prefs (admin_user_id, shortcuts_json, editor_layout, created_at, updated_at)
        VALUES (${adminUserId}, '', 'split', ${now}, ${now})
        ON CONFLICT(admin_user_id) DO NOTHING`
  );

  const rows = await db.query<{ shortcuts_json: string; editor_layout: EditorLayout }>(
    sql`SELECT shortcuts_json, editor_layout
        FROM admin_user_prefs
        WHERE admin_user_id = ${adminUserId}
        LIMIT 1`
  );
  const row = rows[0];
  return {
    shortcutsJson: row?.shortcuts_json ? String(row.shortcuts_json) : null,
    editorLayout: (row?.editor_layout ?? "split") as EditorLayout
  };
}

export async function setAdminPrefs(
  db: Db,
  adminUserId: string,
  patch: Partial<Pick<AdminPrefs, "shortcutsJson" | "editorLayout">>
): Promise<void> {
  const now = Date.now();
  const current = await getAdminPrefs(db, adminUserId);
  const shortcutsJson = patch.shortcutsJson !== undefined ? patch.shortcutsJson : current.shortcutsJson;
  const editorLayout = patch.editorLayout !== undefined ? patch.editorLayout : current.editorLayout;
  await db.execute(
    sql`UPDATE admin_user_prefs
        SET shortcuts_json = ${String(shortcutsJson ?? "")},
            editor_layout = ${editorLayout},
            updated_at = ${now}
        WHERE admin_user_id = ${adminUserId}`
  );
}

