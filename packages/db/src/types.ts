export type DbKind = "d1" | "sqlite" | "postgres" | "mysql";

export type SqlPrimitive = string | number | boolean | null | Uint8Array | Date;
export type SqlValue = SqlPrimitive;

export interface SqlQuery {
  text: string;
  values: SqlValue[];
}

export interface DbCapabilities {
  placeholder: "question" | "dollar";
  fullTextSearch:
    | { kind: "sqlite_fts5" }
    | { kind: "postgres_tsvector" }
    | { kind: "mysql_fulltext" }
    | { kind: "none" };
}

export interface Db {
  kind: DbKind;
  capabilities: DbCapabilities;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    query: SqlQuery
  ): Promise<T[]>;
  execute(query: SqlQuery): Promise<{ changes: number }>;
  close(): Promise<void>;
}

