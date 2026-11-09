import type { Instrument } from "@/domain/watchlist";
import { INTRADAY_FEED } from "@/domain/participation";
import { X_GAP } from "@/domain/x-snapshot";

export type AdapterMode = "live" | "manual" | "demo" | "unconfigured";

export type SourceLink = {
  label: string;
  url: string;
  verifiedInBuild: boolean;
  note: string;
};

export type SourceAdapter = {
  id: string;
  label: string;
  mode: AdapterMode;
  summary: string;
  unresolved: string | null;
  links: (instrument: Instrument) => SourceLink[];
};

export const FED_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
export const FED_PRESS_URL = "https://www.federalreserve.gov/feeds/press_monetary.xml";
export const FED_FEEDS_URL = "https://www.federalreserve.gov/feeds/feeds.htm";
export const FED_HOST = "www.federalreserve.gov";

const UNVERIFIED_BLOCK =
  "This environment did not get a successful automated response. The address may still open in a browser. No feed is connected.";

function stockOrEtf(instrument: Instrument): boolean {
  return instrument.kind === "stock" || instrument.kind === "etf";
}

export const SOURCE_ADAPTERS: readonly SourceAdapter[] = [
  {
    id: "fed",
    label: "Federal Reserve",
    mode: "live",
    summary:
      "Read-only calendar page and monetary-policy RSS titles. Article bodies are not retrieved. A meeting date is not a statement clock time.",
    unresolved: null,
    links: () => [
      {
        label: "FOMC calendar",
        url: FED_CALENDAR_URL,
        verifiedInBuild: true,
        note: "Public calendar page returned HTTP 200 in this environment. Parsed for meeting rows, not embedded.",
      },
      {
        label: "Monetary-policy feed",
        url: FED_PRESS_URL,
        verifiedInBuild: true,
        note: "Public RSS of titles, links, and pubDates. Full text is not stored.",
      },
      {
        label: "Feed directory",
        url: FED_FEEDS_URL,
        verifiedInBuild: true,
        note: "Official feed list. Only the monetary-policy feed is read.",
      },
    ],
  },
  {
    id: "finviz",
    label: "Finviz",
    mode: "manual",
    summary: "Launcher for a quote page you read yourself. The announced API is not connected.",
    unresolved:
      "Finviz describes an API at https://finviz.com/blog/our-upgraded-api-higher-limits-clearer-data-and-more-ways-to-connect/ . Exact fields, freshness, storage rights, and subscription were not verified, so this desk does not call it.",
    links: (instrument) => {
      if (!stockOrEtf(instrument)) return [];
      return [
        {
          label: "Finviz quote",
          url: `https://finviz.com/stock?t=${instrument.symbol}`,
          verifiedInBuild: instrument.symbol === "AAPL",
          note:
            instrument.symbol === "AAPL"
              ? "AAPL URL returned HTTP 200 and redirected to /stock. Launcher only."
              : "Same path pattern as AAPL, which returned HTTP 200. This symbol was not separately checked. Launcher only.",
        },
      ];
    },
  },
  {
    id: "marketwatch",
    label: "MarketWatch",
    mode: "manual",
    summary: "Launcher for pre-market and after-hours context you read yourself. No feed is ingested.",
    unresolved:
      "MarketWatch publishes an RSS directory. Full-text processing rights are unresolved, so this desk does not ingest it.",
    links: (instrument) => [
      {
        label: instrument.kind === "index" ? "MarketWatch index" : "MarketWatch quote",
        url:
          instrument.kind === "index"
            ? "https://www.marketwatch.com/investing/index/spx"
            : `https://www.marketwatch.com/investing/stock/${instrument.symbol.toLowerCase()}`,
        verifiedInBuild: false,
        note: `Automated request received HTTP 401. ${UNVERIFIED_BLOCK}`,
      },
      {
        label: "RSS directory",
        url: "https://www.marketwatch.com/site/rss",
        verifiedInBuild: false,
        note: `Automated request received HTTP 401. Directory only. ${UNVERIFIED_BLOCK}`,
      },
    ],
  },
  {
    id: "sec",
    label: "SEC EDGAR",
    mode: "live",
    summary:
      "Read-only submissions JSON from data.sec.gov for CIKs whose ticker field was checked. Recent filing rows, acceptance time, and the filing index link. Not a news article and not an analyst target.",
    unresolved:
      "IWM has no confirmed ticker-field CIK here. QQQ is a name match because the tickers array was empty. SPX is an index and has no issuer filing. SPCX is CIK 0001181412, ticker field SPCX, checked 2026-11-09. www.sec.gov/files/company_tickers.json returned HTTP 403 in this environment, so the map was checked issuer by issuer.",
    links: (instrument) => [
      {
        label: "EDGAR search",
        url: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(instrument.symbol)}`,
        verifiedInBuild: false,
        note: "Launcher only. The desk reads data.sec.gov submissions, not this search page.",
      },
    ],
  },
  {
    id: "yahoo",
    label: "Yahoo Finance",
    mode: "live",
    summary:
      "Symbol headline RSS from feeds.finance.yahoo.com. Aggregator titles, links, and pubDates. Not the publisher, not a quote, and not full article text. The quote page is still only a launcher.",
    unresolved:
      "Yahoo’s current developer documentation for this RSS URL was not re-certified. The URL returned RSS in this environment. A symbol feed item counts as naming the symbol only when the title or feed summary does.",
    links: (instrument) => [
      {
        label: instrument.symbol === "SPX" ? "Yahoo ^GSPC" : "Yahoo quote",
        url:
          instrument.symbol === "SPX"
            ? "https://finance.yahoo.com/quote/%5EGSPC"
            : `https://finance.yahoo.com/quote/${instrument.symbol}`,
        verifiedInBuild: instrument.symbol === "AAPL" || instrument.symbol === "SPX",
        note:
          instrument.symbol === "SPX"
            ? "Index page is ^GSPC, not SPY. HTTP 200 in this environment. The quote page is a launcher. The ingested feed is the symbol RSS."
            : instrument.symbol === "AAPL"
              ? "Quote page HTTP 200. Launcher only. The ingested feed is the symbol RSS, not this page."
              : "Same quote-page pattern as AAPL, which returned HTTP 200. This symbol’s quote page was not separately checked.",
      },
    ],
  },
  {
    id: "optionslam",
    label: "OptionSlam",
    mode: "manual",
    summary: "Launcher for stock earnings pages. No supported API was verified. Before-open and after-close are not clock times.",
    unresolved: "Earnings dates are manual until a permitted feed exists. BO/AC does not establish an hour.",
    links: (instrument) => {
      if (instrument.kind !== "stock") return [];
      return [
        {
          label: "OptionSlam earnings",
          url: `https://www.optionslam.com/earnings/stocks/${instrument.symbol}`,
          verifiedInBuild: instrument.symbol === "AAPL",
          note:
            instrument.symbol === "AAPL"
              ? "AAPL path returned HTTP 200. Not a feed. BO/AC is not a clock time."
              : "Same path pattern as AAPL, which returned HTTP 200. This symbol was not separately checked.",
        },
      ];
    },
  },
  {
    id: "bloomberg",
    label: "Bloomberg",
    mode: "manual",
    summary: "Launcher only. No feed is connected.",
    unresolved: "A reachable page is not permission to store or process the article.",
    links: (instrument) => [
      {
        label: "Bloomberg quote",
        url:
          instrument.symbol === "SPX"
            ? "https://www.bloomberg.com/quote/SPX:IND"
            : `https://www.bloomberg.com/quote/${instrument.symbol}:US`,
        verifiedInBuild: false,
        note: `Automated request received HTTP 403. ${UNVERIFIED_BLOCK}`,
      },
    ],
  },
  {
    id: "wsj",
    label: "WSJ",
    mode: "manual",
    summary: "Launcher only. No feed is connected.",
    unresolved: "A reachable page is not permission to store or process the article.",
    links: (instrument) => [
      {
        label: "WSJ quote",
        url:
          instrument.symbol === "SPX"
            ? "https://www.wsj.com/market-data/quotes/index/SPX"
            : `https://www.wsj.com/market-data/quotes/${instrument.symbol}`,
        verifiedInBuild: false,
        note: `Automated request received HTTP 401. ${UNVERIFIED_BLOCK}`,
      },
    ],
  },
  {
    id: "cnbc",
    label: "CNBC",
    mode: "manual",
    summary: "Launcher only. The public franchise RSS is not a per-symbol feed, so it is not ingested.",
    unresolved:
      "A public CNBC Investing franchise RSS returned HTTP 200. It is not a per-symbol feed, so it is not used as ticker news. A reachable page is not permission to store the article.",
    links: (instrument) => [
      {
        label: "CNBC quote",
        url: instrument.symbol === "SPX" ? "https://www.cnbc.com/quotes/.SPX" : `https://www.cnbc.com/quotes/${instrument.symbol}`,
        verifiedInBuild: instrument.symbol === "AAPL" || instrument.symbol === "SPX",
        note:
          instrument.symbol === "AAPL" || instrument.symbol === "SPX"
            ? "HTTP 200 in this environment. Not a feed. SPX uses .SPX, not SPY."
            : "Same path pattern as AAPL, which returned HTTP 200. This symbol was not separately checked.",
      },
    ],
  },
  {
    id: "manual",
    label: "Manual capture",
    mode: "manual",
    summary: "A headline, quote, time, and URL you type from a page you opened.",
    unresolved: null,
    links: () => [],
  },
  {
    id: "x_manual",
    label: "X post, pasted",
    mode: "manual",
    summary:
      "Text you paste from a post you opened. A typed handle is not identity verification. This does not connect to X.",
    unresolved: "Monitoring stays off until a supported feed exists. A chat connector is not an app entitlement.",
    links: () => [],
  },
  {
    id: "x",
    label: "X catalyst sweeper",
    mode: "unconfigured",
    summary:
      "Disconnected. No polling and no posts on screen. A genuine post would still not prove its contents.",
    unresolved: X_GAP,
    links: () => [],
  },
  {
    id: "tc2000",
    label: "TC2000",
    mode: "manual",
    summary:
      "Separate chart source for 15-minute, hour, and day bands, moving averages, trendlines, and candles. Not embedded or scraped.",
    unresolved: null,
    links: () => [],
  },
  {
    id: "thinkorswim",
    label: "Thinkorswim",
    mode: "unconfigured",
    summary: "Orders stay on the phone. This desk has no order path.",
    unresolved:
      "A Schwab developer catalog exists. The exact endpoint and entitlement for this desk were not verified, and none is used.",
    links: () => [],
  },
  {
    id: "intraday",
    label: "Intraday bars",
    mode: "manual",
    summary:
      "Time-of-day relative volume and SPY/QQQ alignment use bars you type or import. No live 15-minute feed is connected. This is not an entry signal.",
    unresolved: INTRADAY_FEED.reason,
    links: () => [],
  },
  {
    id: "demo",
    label: "Demo fixtures",
    mode: "demo",
    summary: "Invented examples on example.com. Hidden unless DEMO is on. Not market data.",
    unresolved: null,
    links: () => [],
  },
];

const ADAPTER_BY_ID = new Map(SOURCE_ADAPTERS.map((adapter) => [adapter.id, adapter]));

export function adapterById(id: string): SourceAdapter | undefined {
  return ADAPTER_BY_ID.get(id);
}

export function attributableSources(): SourceAdapter[] {
  return SOURCE_ADAPTERS.filter((adapter) =>
    ["fed", "finviz", "marketwatch", "yahoo", "optionslam", "bloomberg", "wsj", "cnbc", "manual", "x_manual"].includes(
      adapter.id,
    ),
  );
}

export type PendingIdentity = {
  name: string;
  handle: null;
  numericId: null;
  identityStatus: "pending_verification";
  monitored: false;
};

export const X_ALLOWLIST_PENDING: readonly PendingIdentity[] = [
  {
    name: "Elon Musk",
    handle: null,
    numericId: null,
    identityStatus: "pending_verification",
    monitored: false,
  },
  {
    name: "Donald Trump",
    handle: null,
    numericId: null,
    identityStatus: "pending_verification",
    monitored: false,
  },
];

export function xSweeperStatus(): { mode: "unconfigured"; polling: false; live: false; reason: string } {
  return {
    mode: "unconfigured",
    polling: false,
    live: false,
    reason: X_GAP,
  };
}
