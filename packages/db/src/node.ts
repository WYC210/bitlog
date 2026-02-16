import type { Db, SqlQuery } from "./types.js";
import { toPostgresQuery } from "./placeholder.js";

export type NodeDbConfig =
  | { kind: "sqlite"; filename: string }
  | { kind: "postgres"; url: string; max?: number }
  | { kind: "mysql"; url: string; connectionLimit?: number };

export async function createNodeDb(config: NodeDbConfig): Promise<Db> {
  if (config.kind === "sqlite") return createSqliteDb(config.filename);
  if (config.kind === "postgres") return createPostgresDb(config.url, config.max);
  return createMysqlDb(config.url, config.connectionLimit);
}

async function createSqliteDb(filename: string): Promise<Db> {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(filename);

  return {
    kind: "sqlite",
    capabilities: {
      placeholder: "question",
      fullTextSearch: { kind: "sqlite_fts5" }
    },
    async query<T extends Record<string, unknown>>(query: SqlQuery): Promise<T[]> {
      const stmt = db.prepare(query.text);
      return stmt.all(...query.values) as T[];
    },
    async execute(query: SqlQuery): Promise<{ changes: number }> {
      const stmt = db.prepare(query.text);
      const result = stmt.run(...query.values);
      return { changes: Number(result.changes ?? 0) };
    },
    async close(): Promise<void> {
      db.close();
    }
  };
}

async function createPostgresDb(url: string, max = 10): Promise<Db> {
  const pg = await import("pg");
  const pool = new pg.Pool({ connectionString: url, max });

  return {
    kind: "postgres",
    capabilities: {
      placeholder: "dollar",
      fullTextSearch: { kind: "postgres_tsvector" }
    },
    async query<T extends Record<string, unknown>>(query: SqlQuery): Promise<T[]> {
      const q = toPostgresQuery(query);
      const result = await pool.query(q.text, q.values);
      return (result.rows ?? []) as T[];
    },
    async execute(query: SqlQuery): Promise<{ changes: number }> {
      const q = toPostgresQuery(query);
      const result = await pool.query(q.text, q.values);
      return { changes: Number(result.rowCount ?? 0) };
    },
    async close(): Promise<void> {
      await pool.end();
    }
  };
}

async function createMysqlDb(url: string, connectionLimit = 10): Promise<Db> {
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool({ uri: url, connectionLimit });

  return {
    kind: "mysql",
    capabilities: {
      placeholder: "question",
      fullTextSearch: { kind: "mysql_fulltext" }
    },
    async query<T extends Record<string, unknown>>(query: SqlQuery): Promise<T[]> {
      const [rows] = await pool.query(query.text, query.values);
      return rows as T[];
    },
    async execute(query: SqlQuery): Promise<{ changes: number }> {
      const [result] = await pool.execute(query.text, query.values);
      const anyResult = result as unknown as { affectedRows?: number };
      return { changes: Number(anyResult.affectedRows ?? 0) };
    },
    async close(): Promise<void> {
      await pool.end();
    }
  };
}

