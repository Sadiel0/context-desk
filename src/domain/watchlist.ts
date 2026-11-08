export type InstrumentKind = "stock" | "etf" | "index";

export type Instrument = {
  symbol: string;
  name: string;
  kind: InstrumentKind;
  /** SPX is on the desk only some sessions. It is not an ETF. */
  occasional?: boolean;
  /** Product identity, not a live holding, membership list, or quote. */
  identity: string | null;
};

export const WATCHLIST: readonly Instrument[] = [
  { symbol: "TSLA", name: "Tesla, Inc.", kind: "stock", identity: null },
  { symbol: "META", name: "Meta Platforms, Inc.", kind: "stock", identity: null },
  { symbol: "AAPL", name: "Apple Inc.", kind: "stock", identity: null },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    kind: "etf",
    identity: "ETF that tracks the S&P 500. Product identity only — not a live holding or a quote.",
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    kind: "etf",
    identity: "ETF that tracks the Nasdaq-100. Product identity only — not a live holding or a quote.",
  },
  {
    symbol: "IWM",
    name: "iShares Russell 2000 ETF",
    kind: "etf",
    identity: "ETF that tracks the Russell 2000. Product identity only — not a live holding or a quote.",
  },
  {
    symbol: "DIA",
    name: "SPDR Dow Jones Industrial Average ETF Trust",
    kind: "etf",
    identity: "ETF that tracks the Dow Jones Industrial Average. Product identity only — not a live holding or a quote.",
  },
  {
    symbol: "SPX",
    name: "S&P 500 Index",
    kind: "index",
    occasional: true,
    identity: "The S&P 500 index, not the SPY ETF. SPXW is a separate option root and is not implied by selecting SPX.",
  },
] as const;

const BY_SYMBOL = new Map(WATCHLIST.map((instrument) => [instrument.symbol, instrument]));

export function isWatchSymbol(symbol: string): boolean {
  return BY_SYMBOL.has(symbol);
}

export function instrumentFor(symbol: string): Instrument | null {
  return BY_SYMBOL.get(symbol) ?? null;
}

export const KIND_LABEL: Record<InstrumentKind, string> = {
  stock: "Stock",
  etf: "ETF",
  index: "Index",
};
