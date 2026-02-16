export type Route =
  | { page: "login" }
  | { page: "posts" }
  | { page: "edit"; id: string | "new" }
  | { page: "settings" };

export function parseRoute(hash: string): Route {
  const raw = (hash || "#/posts").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "login") return { page: "login" };
  if (parts[0] === "settings") return { page: "settings" };
  if (parts[0] === "posts" && parts[1]) return { page: "edit", id: parts[1] as any };
  return { page: "posts" };
}

