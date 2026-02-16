import type { SqlQuery } from "./types.js";

export function toPostgresQuery(query: SqlQuery): SqlQuery {
  let parameterIndex = 0;

  const text = query.text.replaceAll("?", () => {
    parameterIndex += 1;
    return `$${parameterIndex}`;
  });

  return { text, values: query.values };
}

