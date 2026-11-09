import { parseYahooHeadlines } from "@/domain/rss-parse";
import { parseSecSubmissions, tickerConfirmed } from "@/domain/sec-parse";
import {
  SEC_LOOKUP,
  yahooFeedUrl,
  yahooQuerySymbol,
  type TickerLoad,
  type TickerSec,
  type TickerYahoo,
} from "@/domain/ticker-feed";
import { publicGet } from "@/server/public-get";

const MAX_BYTES = 2_000_000;
const USER_AGENT = "ContextDesk/0.2 (personal read-only; unpublished workstation)";
const SUCCESS_TTL_MS = 90_000;
const ERROR_TTL_MS = 20_000;

const cache = new Map<string, { at: number; ttl: number; value: TickerLoad }>();

export function clearTickerCache(): void {
  cache.clear();
}

export async function loadTicker(
  fetchImpl: typeof fetch,
  symbol: string,
  options?: { timeoutMs?: number; now?: Date; bypassCache?: boolean },
): Promise<TickerLoad> {
  const now = options?.now ?? new Date();
  const cached = cache.get(symbol);
  if (!options?.bypassCache && cached && now.getTime() - cached.at < cached.ttl) return cached.value;
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const [yahoo, sec] = await Promise.all([
    loadYahoo(fetchImpl, symbol, timeoutMs),
    loadSec(fetchImpl, symbol, timeoutMs),
  ]);
  const value: TickerLoad = { symbol, retrievedAt: now.toISOString(), yahoo, sec };
  const failed = yahoo.state === "error" || sec.state === "error";
  cache.set(symbol, { at: now.getTime(), ttl: failed ? ERROR_TTL_MS : SUCCESS_TTL_MS, value });
  return value;
}

async function loadYahoo(fetchImpl: typeof fetch, symbol: string, timeoutMs: number): Promise<TickerYahoo> {
  const querySymbol = yahooQuerySymbol(symbol);
  const url = yahooFeedUrl(symbol);
  const notice =
    symbol === "SPX"
      ? "Yahoo query symbol is ^GSPC. That is the index feed, not SPY. Yahoo is an aggregator, not the publisher."
      : "Yahoo Finance symbol RSS is an aggregator. Items that do not name the symbol stay out of the direct list.";
  const result = await publicGet(fetchImpl, url, {
    host: "feeds.finance.yahoo.com",
    timeoutMs,
    maxBytes: MAX_BYTES,
    accept: "application/rss+xml, application/xml, text/xml;q=0.9",
    userAgent: USER_AGENT,
    label: "Yahoo Finance",
  });
  if (!result.ok) {
    return { state: "error", querySymbol, url, error: result.error, notice, items: [] };
  }
  const parsed = parseYahooHeadlines(result.text, symbol);
  if (!/<rss[\s>]/i.test(result.text) && parsed.items.length === 0) {
    return {
      state: "error",
      querySymbol,
      url,
      error: "Yahoo Finance response was not an RSS feed.",
      notice,
      items: [],
    };
  }
  return { state: "ok", querySymbol, url, error: null, notice: [notice, ...parsed.notices].join(" "), items: parsed.items };
}

async function loadSec(fetchImpl: typeof fetch, symbol: string, timeoutMs: number): Promise<TickerSec> {
  if (symbol === "SPX") {
    return {
      state: "not_applicable",
      cik: null,
      name: null,
      exchanges: [],
      sic: null,
      error: null,
      notice: "SPX is an index. SEC issuer filings do not apply. This is not SPY.",
      filings: [],
    };
  }
  const lookup = SEC_LOOKUP[symbol];
  if (!lookup) {
    return {
      state: "unconfirmed",
      cik: null,
      name: null,
      exchanges: [],
      sic: null,
      error: null,
      notice: `No CIK with a ${symbol} ticker field was confirmed. Filing coverage is Unknown.`,
      filings: [],
    };
  }
  const url = `https://data.sec.gov/submissions/CIK${lookup.cik}.json`;
  const result = await publicGet(fetchImpl, url, {
    host: "data.sec.gov",
    timeoutMs,
    maxBytes: MAX_BYTES,
    accept: "application/json",
    userAgent: USER_AGENT,
    label: "SEC EDGAR",
  });
  if (!result.ok) {
    return {
      state: "error",
      cik: lookup.cik,
      name: null,
      exchanges: [],
      sic: null,
      error: result.error,
      notice: "Filings were not invented to fill the gap.",
      filings: [],
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(result.text);
  } catch {
    return {
      state: "error",
      cik: lookup.cik,
      name: null,
      exchanges: [],
      sic: null,
      error: "SEC submissions were not JSON.",
      notice: "Filings were not invented to fill the gap.",
      filings: [],
    };
  }
  const parsed = parseSecSubmissions(json, lookup.cik);
  if (!parsed.ok) {
    return {
      state: "error",
      cik: lookup.cik,
      name: null,
      exchanges: [],
      sic: null,
      error: parsed.error,
      notice: "Filings were not invented to fill the gap.",
      filings: [],
    };
  }
  const base = {
    cik: parsed.issuer.cik,
    name: parsed.issuer.name,
    exchanges: parsed.issuer.exchanges,
    sic: parsed.issuer.sic,
    error: null,
    filings: parsed.issuer.filings,
  };
  if (lookup.match === "ticker") {
    if (!tickerConfirmed(parsed.issuer.tickers, symbol)) {
      return {
        ...base,
        state: "error",
        filings: [],
        error: `SEC tickers field did not include ${symbol}. Filings were withheld.`,
        notice: "A CIK that no longer lists the symbol is not shown as that symbol’s filings.",
      };
    }
    return {
      ...base,
      state: "confirmed",
      notice: "SEC acceptance time is when EDGAR accepted the filing. It is not the business-event clock. Analyst targets are not in this file.",
    };
  }
  if (!parsed.issuer.name.toUpperCase().includes(symbol)) {
    return {
      ...base,
      state: "error",
      filings: [],
      error: `SEC legal name did not contain ${symbol}. Filings were withheld.`,
      notice: "Name match failed.",
    };
  }
  return {
    ...base,
    state: "name_match",
    notice: `Tickers array was empty. The legal name contains ${symbol}, so rows are a name match only.`,
  };
}
