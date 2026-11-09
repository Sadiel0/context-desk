export type PublicGetResult = { ok: true; text: string } | { ok: false; error: string };

export async function publicGet(
  fetchImpl: typeof fetch,
  url: string,
  options: {
    host: string;
    timeoutMs: number;
    maxBytes: number;
    accept: string;
    userAgent: string;
    label: string;
  },
): Promise<PublicGetResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: `${options.label} URL is not valid.` };
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== options.host) {
    return { ok: false, error: `${options.label} host is not allowlisted.` };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: options.accept, "user-agent": options.userAgent },
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, error: `${options.label} responded with a redirect (${response.status}), which this reader refuses.` };
    }
    if (response.status !== 200) {
      return { ok: false, error: `${options.label} responded with HTTP ${response.status}.` };
    }
    const finalUrl = response.url || url;
    const final = new URL(finalUrl);
    if (final.protocol !== "https:" || final.hostname !== options.host) {
      return { ok: false, error: `${options.label} response URL left the allowlisted host.` };
    }
    const declared = response.headers.get("content-length");
    if (declared && Number(declared) > options.maxBytes) {
      return { ok: false, error: `${options.label} response was larger than this reader accepts.` };
    }
    const text = await response.text();
    if (text.length > options.maxBytes) {
      return { ok: false, error: `${options.label} response was larger than this reader accepts.` };
    }
    return { ok: true, text };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: `${options.label} request timed out.` };
    }
    return { ok: false, error: `${options.label} request failed.` };
  } finally {
    clearTimeout(timer);
  }
}
