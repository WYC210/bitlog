import type { ToolGroup, ToolKind } from "../api";

export type ToolSeed = {
  title: string;
  slug: string;
  groupKey: ToolGroup;
  kind: ToolKind;
  url: string | null;
  description: string;
  clientCode: string | null;
  enabled: boolean;
};

// NOTE: We no longer seed tools with shared client scripts.
// These tools are intended to be backed by first-party `/api/*` endpoints,
// and their UI+request logic should be pasted into D1 per tool via `client_code`.

export const DEFAULT_TOOLS: ToolSeed[] = [
  // API tools (group: apis) — currently selected for migration
  { title: "IP归属地查询", slug: "ip-location", groupKey: "apis", kind: "page", url: null, description: "查询 IP / 域名 / URL 的地理位置信息。", clientCode: null, enabled: true },
  { title: "DNS解析查询", slug: "dns-query", groupKey: "apis", kind: "page", url: null, description: "查询域名的 DNS 记录（A）。", clientCode: null, enabled: true },
  { title: "ICP备案查询", slug: "icp-query", groupKey: "apis", kind: "page", url: null, description: "查询域名的ICP备案信息。", clientCode: null, enabled: true },
  { title: "手机号归属地", slug: "phone-location", groupKey: "apis", kind: "page", url: null, description: "查询手机号归属地信息。", clientCode: null, enabled: true },
  { title: "ASCII艺术字", slug: "ascii-art", groupKey: "apis", kind: "page", url: null, description: "将文本转换为 ASCII 艺术字。", clientCode: null, enabled: true },
  { title: "JSON格式化", slug: "json-format", groupKey: "apis", kind: "page", url: null, description: "快速格式化 JSON 字符串。", clientCode: null, enabled: true }
];
