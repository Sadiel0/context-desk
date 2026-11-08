import {
  parseFedPressRss,
  parseFomcCalendar,
  type FedPressItem,
  type FomcMeeting,
} from "@/domain/fed-parse";
import { FED_CALENDAR_URL, FED_HOST, FED_PRESS_URL } from "@/domain/sources";

const MAX_BYTES = 2_000_000;

export type FedSourceResult<T> = {
  url: string;
  error: string | null;
  notices: string[];
  data: T;
};

export type FedLoadResult = {
  ok: boolean;
  partial: boolean;
  retrievedAt: string;
  calendar: FedSourceResult<FomcMeeting[]> & { lastUpdate: string | null };
  press: FedSourceResult<FedPressItem[]>;
};

export async function loadFed(
  fetchImpl: typeof fetch,
  options?: { timeoutMs?: number; now?: Date },
): Promise<FedLoadResult> {
  const now = options?.now ?? new Date();
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const [calendarText, pressText] = await Promise.all([
    fetchSource(fetchImpl, FED_CALENDAR_URL, timeoutMs),
    fetchSource(fetchImpl, FED_PRESS_URL, timeoutMs),
  ]);

  const calendar = readCalendar(calendarText);
  const press = readPress(pressText);
  const calendarUsable = calendar.error === null;
  const pressUsable = press.error === null;
  return {
    ok: calendarUsable && pressUsable,
    partial: calendarUsable !== pressUsable,
    retrievedAt: now.toISOString(),
    calendar,
    press,
  };
}

function readCalendar(result: FetchResult): FedLoadResult["calendar"] {
  if (!result.ok) {
    return { url: FED_CALENDAR_URL, error: result.error, notices: [], data: [], lastUpdate: null };
  }
  try {
    const parsed = parseFomcCalendar(result.text);
    if (parsed.meetings.length === 0) {
      return {
        url: FED_CALENDAR_URL,
        error: "The calendar page was retrieved but no meetings could be read. Nothing was invented to fill the gap.",
        notices: parsed.notices,
        data: [],
        lastUpdate: parsed.lastUpdate,
      };
    }
    return {
      url: FED_CALENDAR_URL,
      error: null,
      notices: parsed.notices,
      data: parsed.meetings,
      lastUpdate: parsed.lastUpdate,
    };
  } catch {
    return {
      url: FED_CALENDAR_URL,
      error: "The Federal Reserve calendar could not be parsed.",
      notices: [],
      data: [],
      lastUpdate: null,
    };
  }
}

function readPress(result: FetchResult): FedLoadResult["press"] {
  if (!result.ok) return { url: FED_PRESS_URL, error: result.error, notices: [], data: [] };
  try {
    const parsed = parseFedPressRss(result.text);
    const seen = new Set<string>();
    const data = parsed.items.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
    return { url: FED_PRESS_URL, error: null, notices: parsed.notices, data };
  } catch {
    return { url: FED_PRESS_URL, error: "The monetary-policy feed could not be parsed.", notices: [], data: [] };
  }
}

type FetchResult = { ok: true; text: string } | { ok: false; error: string };

async function fetchSource(fetchImpl: typeof fetch, url: string, timeoutMs: number): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Source URL is not valid." };
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== FED_HOST) {
    return { ok: false, error: "Source host is not allowlisted." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "text/html, application/xml, text/xml;q=0.9, */*;q=0.1",
        "user-agent": "ContextDesk/0.1 (personal read-only calendar reader)",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, error: `Federal Reserve responded with a redirect (${response.status}), which this reader refuses.` };
    }
    if (response.status !== 200) {
      return { ok: false, error: `Federal Reserve responded with HTTP ${response.status}.` };
    }
    const finalUrl = response.url || url;
    const final = new URL(finalUrl);
    if (final.protocol !== "https:" || final.hostname !== FED_HOST) {
      return { ok: false, error: "Response URL left the allowlisted host." };
    }
    const text = await readCapped(response, MAX_BYTES);
    return { ok: true, text };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.message === "too large")) {
      return {
        ok: false,
        error: error.message === "too large"
          ? "The Federal Reserve response was larger than this reader accepts."
          : "The Federal Reserve request timed out.",
      };
    }
    return { ok: false, error: "The Federal Reserve request failed." };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) throw new Error("too large");
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) throw new Error("too large");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
