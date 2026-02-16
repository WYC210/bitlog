import type { D1Database } from "@cloudflare/workers-types";
import type { Db, SqlQuery } from "./types.js";

export function createD1Db(binding: D1Database): Db {
  return {
    kind: "d1",
    capabilities: {
      placeholder: "question",
      fullTextSearch: { kind: "none" }
    },
    async query<T extends Record<string, unknown>>(query: SqlQuery): Promise<T[]> {
      const result = await binding.prepare(query.text).bind(...query.values).all<T>();
      return result.results ?? [];
    },
    async execute(query: SqlQuery): Promise<{ changes: number }> {
      const result = await binding.prepare(query.text).bind(...query.values).run();
      const anyResult = result as unknown as { changes?: number; meta?: { changes?: number } };
      return { changes: Number(anyResult.changes ?? anyResult.meta?.changes ?? 0) };
    },
    async close(): Promise<void> {
      return;
    }
  };
}
