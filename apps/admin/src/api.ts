export type ApiError = { message: string; status: number };

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const err: ApiError = data?.error?.message
      ? { message: String(data.error.message), status: Number(data.error.status ?? res.status) }
      : { message: `HTTP ${res.status}`, status: res.status };
    throw err;
  }
  return data as T;
}

export type SiteConfig = {
  title: string | null;
  description: string | null;
  baseUrl: string | null;
  timezone: string | null;
  embedAllowlistHosts: string[];
  cacheTtlSeconds: number;
  cacheVersion: number;
  shortcutsJson: string | null;
};

export type AdminPrefs = {
  shortcutsJson: string | null;
  editorLayout: "split" | "write" | "preview";
};

export type ProjectsConfigAdminView = {
  github: { enabled: boolean; username: string | null; tokenSet: boolean };
  gitee: { enabled: boolean; username: string | null; tokenSet: boolean };
  includeForks: boolean;
  maxItemsPerPlatform: number;
};

export async function getProjectsConfigAdmin(): Promise<ProjectsConfigAdminView> {
  const r = await apiJson<{ ok: true; config: ProjectsConfigAdminView }>("/api/admin/projects-config");
  return r.config;
}

export async function updateProjectsConfigAdmin(patch: any) {
  await apiJson("/api/admin/projects-config", { method: "PUT", body: JSON.stringify(patch) });
}

export type ToolGroup = "games" | "apis" | "utils" | "other";
export type ToolKind = "link" | "page";

export type AdminToolItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  groupKey: ToolGroup;
  kind: ToolKind;
  url: string | null;
  icon: string | null;
  clientCode: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export async function listAdminTools(): Promise<AdminToolItem[]> {
  const r = await apiJson<{ ok: true; tools: AdminToolItem[] }>("/api/admin/tools");
  return r.tools ?? [];
}

export async function createAdminTool(payload: {
  slug: string;
  title: string;
  description?: string;
  groupKey?: ToolGroup;
  kind?: ToolKind;
  url?: string | null;
  icon?: string | null;
  clientCode?: string | null;
  enabled?: boolean;
}): Promise<AdminToolItem> {
  const r = await apiJson<{ ok: true; tool: AdminToolItem }>("/api/admin/tools", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return r.tool;
}

export async function updateAdminTool(id: string, patch: Partial<Omit<AdminToolItem, "id" | "createdAt" | "updatedAt" | "sortOrder">> & { sortOrder?: number }) {
  await apiJson(`/api/admin/tools/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) });
}

export async function deleteAdminTool(id: string) {
  await apiJson(`/api/admin/tools/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({}) });
}

export async function reorderAdminTools(ids: string[]) {
  await apiJson("/api/admin/tools/reorder", { method: "PUT", body: JSON.stringify({ ids }) });
}

export async function getConfig(): Promise<SiteConfig> {
  const r = await apiJson<{ ok: true; config: SiteConfig }>("/api/config");
  return r.config;
}

export async function adminMe(): Promise<{ adminId: string; username: string }> {
  const r = await apiJson<{ ok: true; user: { adminId: string; username: string } }>("/api/admin/me");
  return r.user;
}

export async function adminLogin(username: string, password: string, remember: boolean) {
  await apiJson("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password, remember })
  });
}

export async function adminLogout() {
  await apiJson("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
}

export async function getAdminPrefs(): Promise<AdminPrefs> {
  const r = await apiJson<{ ok: true; prefs: AdminPrefs }>("/api/admin/prefs");
  return r.prefs;
}

export async function updateAdminPrefs(patch: Partial<AdminPrefs>) {
  await apiJson("/api/admin/prefs", { method: "PUT", body: JSON.stringify(patch) });
}

export async function changeAdminPassword(oldPassword: string, newPassword: string): Promise<{ relogin: boolean }> {
  const r = await apiJson<{ ok: true; relogin?: boolean }>("/api/admin/password", {
    method: "PUT",
    body: JSON.stringify({ oldPassword, newPassword })
  });
  return { relogin: !!r.relogin };
}

export type AdminPostListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: "draft" | "published" | "scheduled";
  publish_at: number | null;
  created_at: number;
  updated_at: number;
  category_slug: string | null;
  category_name: string | null;
};

export async function listAdminPosts(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  q?: string;
}): Promise<{ posts: AdminPostListItem[]; page: number; pageSize: number }> {
  const usp = new URLSearchParams();
  if (params.page) usp.set("page", String(params.page));
  if (params.pageSize) usp.set("pageSize", String(params.pageSize));
  if (params.status) usp.set("status", params.status);
  if (params.q) usp.set("q", params.q);
  const r = await apiJson<{ ok: true; posts: AdminPostListItem[]; page: number; pageSize: number }>(
    `/api/admin/posts?${usp.toString()}`
  );
  return { posts: r.posts, page: r.page, pageSize: r.pageSize };
}

export type AdminPostDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: "draft" | "published" | "scheduled";
  publish_at: number | null;
  created_at: number;
  updated_at: number;
  content_md: string;
  category_name: string | null;
  tags: Array<{ name: string; slug: string }>;
};

export async function getAdminPost(id: string): Promise<AdminPostDetail> {
  const r = await apiJson<{ ok: true; post: AdminPostDetail }>(`/api/admin/posts/${encodeURIComponent(id)}`);
  return r.post;
}

export async function createAdminPost(payload: {
  title: string;
  summary: string;
  content_md: string;
  category: string | null;
  tags: string[];
  status: "draft" | "published" | "scheduled";
  publish_at: number | null;
}): Promise<{ id: string; slug: string }> {
  const r = await apiJson<{ ok: true; post: { id: string; slug: string } }>("/api/admin/posts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return r.post;
}

export async function updateAdminPost(
  id: string,
  patch: Partial<{
    title: string;
    summary: string;
    content_md: string;
    category: string | null;
    tags: string[];
    status: "draft" | "published" | "scheduled";
    publish_at: number | null;
  }>
) {
  await apiJson(`/api/admin/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(patch)
  });
}

export async function deleteAdminPost(id: string) {
  await apiJson(`/api/admin/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({})
  });
}

export async function updateSettings(patch: Record<string, unknown>) {
  await apiJson("/api/admin/settings", { method: "PUT", body: JSON.stringify(patch) });
}

export async function getAdminSettings(keys: string[]): Promise<Record<string, string | null>> {
  const list = Array.from(new Set((keys ?? []).map((k) => String(k ?? "").trim()).filter(Boolean))).slice(0, 50);
  if (list.length === 0) return {};
  const usp = new URLSearchParams();
  usp.set("keys", list.join(","));
  const r = await apiJson<{ ok: true; settings: Record<string, string | null> }>(
    `/api/admin/settings?${usp.toString()}`
  );
  return r.settings ?? {};
}

export async function uploadAdminImage(file: File): Promise<{
  id: string;
  url: string;
  storageKey: string;
  mime: string;
  sizeBytes: number;
  sha256Hex: string;
}> {
  const res = await fetch("/api/admin/assets/images", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": file.type },
    body: file
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const err: ApiError = data?.error?.message
      ? { message: String(data.error.message), status: Number(data.error.status ?? res.status) }
      : { message: `HTTP ${res.status}`, status: res.status };
    throw err;
  }
  return data.asset as any;
}

export async function renderAdminMarkdown(content_md: string): Promise<{ html: string; text: string }> {
  const r = await apiJson<{ ok: true; rendered: { html: string; text: string } }>("/api/admin/render", {
    method: "POST",
    body: JSON.stringify({ content_md })
  });
  return r.rendered;
}
