function partsInZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: Number(get("hour")),
    mm: Number(get("minute"))
  };
}

export function utcMsToZonedInput(ms: number, timeZone: string): string {
  const p = partsInZone(new Date(ms), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
}

export function zonedInputToUtcMs(value: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  let guess = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  const desired = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  for (let i = 0; i < 4; i++) {
    const actualParts = partsInZone(new Date(guess), timeZone);
    const actual = Date.UTC(
      actualParts.y,
      actualParts.m - 1,
      actualParts.d,
      actualParts.hh,
      actualParts.mm,
      0,
      0
    );
    const delta = desired - actual;
    if (delta === 0) return guess;
    guess += delta;
  }
  return guess;
}

