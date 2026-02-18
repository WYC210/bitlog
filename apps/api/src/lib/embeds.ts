export interface EmbedOptions {
  embedAllowlist: Set<string>;
}

export function canEmbedHost(host: string, allowlist: Set<string>): boolean {
  return allowlist.has(host.toLowerCase());
}

export function embedFromShortcode(
  provider: string,
  value: string,
  opts: EmbedOptions
): string {
  const p = provider.toLowerCase();
  if (p === "github") return renderGitHubCard(value);
  if (p === "gitee") return renderGiteeCard(value);
  if (p === "youtube") return renderYouTube(value, opts.embedAllowlist);
  if (p === "bilibili") return renderBilibili(value, opts.embedAllowlist);
  if (p === "embed") return renderGenericEmbed(value, opts.embedAllowlist);
  return escapeHtml(`@[${provider}](${value})`);
}

function renderGitHubCard(repo: string): string {
  const trimmed = repo.trim().replace(/^https?:\/\/github\.com\//i, "");
  const href = `https://github.com/${trimmed}`;
  const safeText = escapeHtml(trimmed);
  return `
<a class="embed-card embed-card--github" href="${href}" target="_blank" rel="noopener noreferrer" data-bitlog-embed="1" data-provider="github" data-repo="${safeText}" data-loading="1">
  <span class="embed-card__row">
    <img class="embed-card__avatar" src="https://github.githubassets.com/favicons/favicon.png" alt="" loading="lazy" decoding="async" />
    <span class="embed-card__main">
      <span class="embed-card__title">${safeText}</span>
      <span class="embed-card__desc">Loading…</span>
      <span class="embed-card__meta">
        <span class="embed-pill" title="Stars">★ <span data-field="stars">—</span></span>
        <span class="embed-pill" title="Forks">⑂ <span data-field="forks">—</span></span>
        <span class="embed-pill" title="Language"><span data-field="lang">—</span></span>
      </span>
    </span>
    <span class="embed-card__badge" aria-label="GitHub">GitHub</span>
  </span>
</a>
`.trim();
}

function renderGiteeCard(repo: string): string {
  const trimmed = repo
    .trim()
    .replace(/^https?:\/\/gitee\.com\//i, "")
    .replace(/^\//, "")
    .replace(/\/+$/, "");

  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length < 2) return renderExternalLink(`https://gitee.com/${trimmed}`, "Gitee");

  const owner = parts[0]!;
  const name = parts[1]!;
  const safeRepo = escapeHtml(`${owner}/${name}`);
  const href = `https://gitee.com/${owner}/${name}`;

  return `
<a class="embed-card embed-card--gitee" href="${href}" target="_blank" rel="noopener noreferrer" data-bitlog-embed="1" data-provider="gitee" data-repo="${safeRepo}" data-loading="1">
  <span class="embed-card__row">
    <img class="embed-card__avatar" src="https://gitee.com/favicon.ico" alt="" loading="lazy" decoding="async" />
    <span class="embed-card__main">
      <span class="embed-card__title">${safeRepo}</span>
      <span class="embed-card__desc">Loading…</span>
      <span class="embed-card__meta">
        <span class="embed-pill" title="Stars">★ <span data-field="stars">—</span></span>
        <span class="embed-pill" title="Forks">⑂ <span data-field="forks">—</span></span>
        <span class="embed-pill" title="Language"><span data-field="lang">—</span></span>
      </span>
    </span>
    <span class="embed-card__badge" aria-label="Gitee">Gitee</span>
  </span>
</a>
`.trim();
}

function renderYouTube(idOrUrl: string, allowlist: Set<string>): string {
  const id = extractYouTubeId(idOrUrl);
  if (!id) return renderExternalLink("https://www.youtube.com", "YouTube");

  const host = allowlist.has("www.youtube-nocookie.com")
    ? "www.youtube-nocookie.com"
    : "www.youtube.com";
  if (!allowlist.has(host)) {
    return renderExternalLink(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, "YouTube");
  }
  const src = `https://${host}/embed/${encodeURIComponent(id)}`;
  return renderIframe(src, "youtube");
}

function extractYouTubeId(idOrUrl: string): string | null {
  const raw = idOrUrl.trim();
  if (/^[a-zA-Z0-9_-]{6,}$/.test(raw) && !raw.includes("http")) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("embed");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]!;
    }
    if (url.hostname === "youtu.be") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0]) return parts[0]!;
    }
  } catch {
    // ignore
  }
  return null;
}

function renderBilibili(idOrUrl: string, allowlist: Set<string>): string {
  const host = "player.bilibili.com";
  const raw = idOrUrl.trim();
  if (!allowlist.has(host)) {
    return renderExternalLink("https://www.bilibili.com", "Bilibili");
  }

  let src: string | null = null;
  const bv = raw.match(/\b(BV[0-9A-Za-z]+)\b/);
  const av = raw.match(/\bav(\d+)\b/i) ?? raw.match(/^\d+$/);
  if (bv?.[1]) {
    src = `https://${host}/player.html?bvid=${encodeURIComponent(bv[1])}`;
  } else if (av?.[1] ?? av?.[0]) {
    const aid = av[1] ?? av[0];
    src = `https://${host}/player.html?aid=${encodeURIComponent(aid)}`;
  } else {
    try {
      const url = new URL(raw);
      if (url.hostname.endsWith("bilibili.com")) {
        const bvid = url.pathname.match(/\bBV[0-9A-Za-z]+\b/)?.[0];
        if (bvid) src = `https://${host}/player.html?bvid=${encodeURIComponent(bvid)}`;
      }
    } catch {
      // ignore
    }
  }

  if (!src) return renderExternalLink("https://www.bilibili.com", "Bilibili");
  return renderIframe(src, "bilibili");
}

function renderGenericEmbed(urlText: string, allowlist: Set<string>): string {
  try {
    const url = new URL(urlText.trim());
    if (url.protocol !== "https:") return renderExternalLink(url.toString(), "Embed");
    if (!allowlist.has(url.hostname.toLowerCase())) return renderExternalLink(url.toString(), "Embed");
    return renderIframe(url.toString(), "embed");
  } catch {
    return escapeHtml(urlText);
  }
}

function renderIframe(src: string, provider: string): string {
  const safeSrc = escapeHtml(src);
  return `
<iframe
  class="embed-iframe embed-iframe--${provider}"
  src="${safeSrc}"
  loading="lazy"
  referrerpolicy="no-referrer"
  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen
  data-bitlog-embed="1"
  data-provider="${escapeHtml(provider)}"
></iframe>
`.trim();
}

function renderExternalLink(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  return `
<a class="embed-link" href="${safeHref}" target="_blank" rel="noopener noreferrer" data-bitlog-embed="1" data-provider="link">
  ${escapeHtml(label)}
</a>
`.trim();
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
