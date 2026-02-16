import type { SqlQuery, SqlValue } from "./types.js";

export function raw(text: string): SqlQuery {
  return { text, values: [] };
}

function isSqlQuery(value: unknown): value is SqlQuery {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    "values" in value
  );
}

export function sql(
  strings: TemplateStringsArray,
  ...values: Array<SqlValue | SqlQuery>
): SqlQuery {
  let text = strings[0] ?? "";
  const boundValues: SqlValue[] = [];

  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (isSqlQuery(value)) {
      text += value.text;
      boundValues.push(...value.values);
    } else {
      text += "?";
      boundValues.push(value);
    }
    text += strings[i + 1] ?? "";
  }

  return { text, values: boundValues };
}

export function join(
  parts: SqlQuery[],
  separator = raw(", ")
): SqlQuery {
  if (parts.length === 0) return raw("");
  const texts: string[] = [];
  const values: SqlValue[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      texts.push(separator.text);
      values.push(...separator.values);
    }
    texts.push(parts[i]!.text);
    values.push(...parts[i]!.values);
  }
  return { text: texts.join(""), values };
}
