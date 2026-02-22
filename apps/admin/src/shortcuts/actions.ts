export type AdminContextKey = "admin.global" | "admin.posts" | "admin.edit" | "admin.settings" | "admin.account";

export type AdminActionId =
  | "openCommandPalette"
  | "toggleLightDark"
  | "goSite"
  | "goAdminPosts"
  | "goAdminSettings"
  | "goAdminAccount"
  | "newPost"
  | "editorSave"
  | "editorPublish"
  | "editorRefreshPreview"
  | "back"
  | "forward"
  | "setWebStyle"
  | "setAdminStyle";

export type ActionPermission = "public" | "admin";
export type ActionDangerLevel = "normal" | "siteSetting";

export type UiStyle = "current" | "classic" | "glass" | "brutal" | "terminal";

export type ActionDef = {
  id: AdminActionId;
  label: string;
  description?: string;
  permission: ActionPermission;
  scopes: AdminContextKey[];
  defaultBinding?: string;
  dangerLevel?: ActionDangerLevel;
  allowWhenTyping?: boolean;
};

export const UI_STYLES: Array<{ value: UiStyle; label: string }> = [
  { value: "current", label: "current（默认）" },
  { value: "classic", label: "classic" },
  { value: "glass", label: "glass" },
  { value: "brutal", label: "brutal" },
  { value: "terminal", label: "terminal" }
];

export const ADMIN_ACTIONS: ActionDef[] = [
  {
    id: "openCommandPalette",
    label: "打开命令面板",
    description: "搜索并执行当前页可用动作",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "?"
  },
  {
    id: "toggleLightDark",
    label: "切换明暗主题",
    description: "只影响当前设备",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "shift+d"
  },
  {
    id: "goSite",
    label: "前往站点（前台）",
    description: "打开 /articles",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "g s"
  },
  {
    id: "goAdminPosts",
    label: "跳转：文章列表",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "g p"
  },
  {
    id: "goAdminSettings",
    label: "跳转：设置",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "g ,"
  },
  {
    id: "goAdminAccount",
    label: "跳转：账号",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "g a"
  },
  {
    id: "newPost",
    label: "新建文章",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "c n"
  },
  {
    id: "editorSave",
    label: "保存（编辑器）",
    permission: "admin",
    scopes: ["admin.edit"],
    defaultBinding: "mod+s",
    allowWhenTyping: true
  },
  {
    id: "editorRefreshPreview",
    label: "刷新预览（编辑器）",
    permission: "admin",
    scopes: ["admin.edit"],
    defaultBinding: "mod+shift+r",
    allowWhenTyping: true
  },
  {
    id: "editorPublish",
    label: "发布（编辑器）",
    description: "设为发布状态并保存",
    permission: "admin",
    scopes: ["admin.edit"],
    defaultBinding: "mod+shift+p",
    allowWhenTyping: true
  },
  {
    id: "back",
    label: "后退",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "g b"
  },
  {
    id: "forward",
    label: "前进",
    permission: "admin",
    scopes: ["admin.global", "admin.posts", "admin.edit", "admin.settings", "admin.account"],
    defaultBinding: "g n"
  },
  {
    id: "setWebStyle",
    label: "切换 Web UI 风格（全站）",
    description: "修改 ui.web_style 并使全站生效",
    permission: "admin",
    dangerLevel: "siteSetting",
    scopes: ["admin.global", "admin.settings"]
  },
  {
    id: "setAdminStyle",
    label: "切换 Admin UI 风格（全站）",
    description: "修改 ui.admin_style 并使全站生效",
    permission: "admin",
    dangerLevel: "siteSetting",
    scopes: ["admin.global", "admin.settings"]
  }
];

export const ADMIN_ACTION_ALIASES: Record<AdminActionId, string[]> = {
  openCommandPalette: ["openCommandPalette", "commandPalette", "palette"],
  toggleLightDark: ["toggleLightDark", "toggleTheme", "themeToggle"],
  goSite: ["goSite", "goHome"],
  goAdminPosts: ["goAdminPosts"],
  goAdminSettings: ["goAdminSettings"],
  goAdminAccount: ["goAdminAccount"],
  newPost: ["newPost"],
  editorSave: ["editorSave", "save"],
  editorPublish: ["editorPublish", "publish"],
  editorRefreshPreview: ["editorRefreshPreview", "refreshPreview"],
  back: ["back", "goBack"],
  forward: ["forward", "goForward"],
  setWebStyle: ["setWebStyle"],
  setAdminStyle: ["setAdminStyle"]
};

