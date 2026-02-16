export function formatMs(ms: number | null, tz: string | null): string {
  if (!ms) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz ?? undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(ms));
}

