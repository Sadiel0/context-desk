import type { SecFiling } from "@/domain/sec-parse";

export type Mention = "names_symbol" | "feed_association";

export type AggregatorHeadline = {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  feedSummary: string | null;
  linkHost: string;
  mention: Mention;
};

export type TickerYahoo = {
  state: "ok" | "error";
  querySymbol: string;
  url: string;
  error: string | null;
  notice: string;
  items: AggregatorHeadline[];
};

export type TickerSecState = "confirmed" | "name_match" | "unconfirmed" | "not_applicable" | "error";

export type TickerSec = {
  state: TickerSecState;
  cik: string | null;
  name: string | null;
  exchanges: string[];
  sic: string | null;
  error: string | null;
  notice: string;
  filings: SecFiling[];
};

export type TickerLoad = {
  symbol: string;
  retrievedAt: string;
  yahoo: TickerYahoo;
  sec: TickerSec;
};

/**
 * CIKs checked against data.sec.gov submissions on 2026-11-09.
 * `ticker` means the submissions `tickers` array included the symbol.
 * `name` means the legal name matched and the tickers array was empty, so filings stay labeled as a name match.
 * IWM's candidate CIK was the multi-series iShares Trust with an empty tickers array, so it is not used.
 */
export const SEC_LOOKUP: Record<string, { cik: string; match: "ticker" | "name" }> = {
  AAPL: { cik: "0000320193", match: "ticker" },
  TSLA: { cik: "0001318605", match: "ticker" },
  META: { cik: "0001326801", match: "ticker" },
  SPY: { cik: "0000884394", match: "ticker" },
  DIA: { cik: "0001041130", match: "ticker" },
  QQQ: { cik: "0001067839", match: "name" },
  SPCX: { cik: "0001181412", match: "ticker" },
};

const ALIASES: Record<string, readonly string[]> = {
  TSLA: ["TSLA", "Tesla"],
  META: ["META", "Meta Platforms", "Facebook"],
  AAPL: ["AAPL", "Apple"],
  SPY: ["SPY", "SPDR S&P 500"],
  QQQ: ["QQQ", "Invesco QQQ"],
  IWM: ["IWM", "Russell 2000"],
  DIA: ["DIA", "SPDR Dow"],
  SPX: ["SPX", "S&P 500", "GSPC"],
  SPCX: ["SPCX", "SpaceX", "Space Exploration Technologies"],
};

const MACRO_CUES: readonly { label: string; pattern: RegExp }[] = [
  { label: "tariff", pattern: /\btariffs?\b/i },
  { label: "rates", pattern: /\binterest rates?\b|\brate cut\b|\brate hike\b|\bfomc\b|\bfederal reserve\b/i },
  { label: "inflation", pattern: /\binflation\b/i },
];

export function yahooQuerySymbol(symbol: string): string {
  return symbol === "SPX" ? "^GSPC" : symbol;
}

export function yahooFeedUrl(symbol: string): string {
  const query = yahooQuerySymbol(symbol);
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(query)}&region=US&lang=en-US`;
}

export function namesSymbol(symbol: string, text: string): boolean {
  const aliases = ALIASES[symbol] ?? [symbol];
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`, "i").test(text);
  });
}

export function watchlistMentions(text: string, symbols: readonly string[]): string[] {
  return symbols.filter((symbol) => namesSymbol(symbol, text));
}

export function macroCue(text: string): string | null {
  return MACRO_CUES.find((cue) => cue.pattern.test(text))?.label ?? null;
}

export function crossListingNote(symbol: string, text: string): string | null {
  const namesTesla = namesSymbol("TSLA", text);
  const namesSpace = namesSymbol("SPCX", text);
  if (symbol === "SPCX" && namesTesla) {
    return "This text also names Tesla (TSLA). TSLA is a different company and not this listing.";
  }
  if (symbol === "TSLA" && namesSpace) {
    return "This text also names SpaceX (SPCX). SPCX is a different listing and not a TSLA proxy.";
  }
  return null;
}

export function coverageShort(load: TickerLoad): string {
  const yahoo =
    load.yahoo.state === "error"
      ? "Yahoo RSS Unknown"
      : `Yahoo aggregator · ${countNamed(load)} name ${load.symbol} · ${countAssociated(load)} do not`;
  const sec =
    load.sec.state === "confirmed"
      ? "SEC ticker confirmed"
      : load.sec.state === "name_match"
        ? "SEC name match only"
        : load.sec.state === "not_applicable"
          ? "SEC not an issuer"
          : "SEC Unknown";
  return `${yahoo}. ${sec}. Not complete coverage.`;
}

export function coverageSummary(load: TickerLoad): string {
  const yahoo =
    load.yahoo.state === "error"
      ? `Yahoo Finance symbol RSS: Unknown. ${load.yahoo.error ?? "The feed failed."}`
      : `Yahoo Finance symbol RSS is an aggregator, not the publisher. Query ${load.yahoo.querySymbol}. ${countNamed(load)} headline(s) name ${load.symbol}. ${countAssociated(load)} other item(s) were on that feed and do not name ${load.symbol}.`;
  const sec = secSentence(load);
  return `Ticker news coverage is partial. ${yahoo} ${sec} An empty list is not a report of no catalysts.`;
}

export function coveragePending(message: string): string {
  return `Ticker news coverage: ${message} An empty list is not a report of no catalysts.`;
}

function countNamed(load: TickerLoad): number {
  return load.yahoo.items.filter((item) => item.mention === "names_symbol").length;
}

function countAssociated(load: TickerLoad): number {
  return load.yahoo.items.filter((item) => item.mention === "feed_association").length;
}

function secSentence(load: TickerLoad): string {
  if (load.sec.state === "not_applicable") return load.sec.notice;
  if (load.sec.state === "unconfirmed") return `SEC issuer filings: Unknown. ${load.sec.notice}`;
  if (load.sec.state === "error") return `SEC issuer filings: Unknown. ${load.sec.error ?? "The submissions file failed."}`;
  const who = load.sec.name ?? "Unknown name";
  if (load.sec.state === "name_match") {
    return `SEC submissions for CIK ${load.sec.cik} name “${who}”. The tickers array did not confirm ${load.symbol}, so these rows are a name match, not ticker-field confirmation.`;
  }
  const where = load.sec.exchanges.length ? load.sec.exchanges.join(", ") : "exchange Unknown";
  return `SEC submissions confirm ${load.symbol} as ${who} (${where}). A filing is the issuer’s document, not a news article.`;
}
