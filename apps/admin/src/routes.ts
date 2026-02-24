export type Route =
  | { page: "login" }
  | { page: "posts" }
  | { page: "edit"; id: string | "new" }
  | { page: "account" }
  | { page: "settings"; section?: "site" | "projects" | "tools" | "about" | null };

export function parseRoute(hash: string): Route {
  const raw = (hash || "#/posts").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "login") return { page: "login" };
  if (parts[0] === "account") return { page: "account" };
  if (parts[0] === "settings") {
    const sub = String(parts[1] ?? "").toLowerCase();
    if (sub === "site") return { page: "settings", section: "site" };
    if (sub === "projects") return { page: "settings", section: "projects" };
    if (sub === "tools") return { page: "settings", section: "tools" };
    if (sub === "about") return { page: "settings", section: "about" };
    return { page: "settings", section: null };
  }
  if (parts[0] === "posts" && parts[1]) return { page: "edit", id: parts[1] as any };
  return { page: "posts" };
}
