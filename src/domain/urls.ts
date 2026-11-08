const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "igshid",
]);

export function safeHttpUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname || url.hostname === ".") return null;
  return url.toString();
}

export function normalizeUrl(input: string): string | null {
  const safe = safeHttpUrl(input);
  if (!safe) return null;
  const url = new URL(safe);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}
