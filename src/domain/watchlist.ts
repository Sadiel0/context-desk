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
  {
    symbol: "SPCX",
    name: "SpaceX",
    kind: "stock",
    identity:
      "Space Exploration Technologies Corp., the company called SpaceX. Class A common stock. SEC submissions for CIK 0001181412, read 2026-11-09, list ticker SPCX on Nasdaq. The Form 10-Q filed 2026-10-22 registers that class on The Nasdaq Stock Market LLC and Nasdaq Texas, LLC. Not TSLA and not a Tesla proxy. Nasdaq Trader News DTN2026-8 says the ticker SPCX was previously a different security and that this listing was set for June 12, 2026; older SPCX prints are not treated as SpaceX.",
  },
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

/** Nvidia is a block comparison name. It is not a trading-watchlist symbol. */
export const COMPARISON_SYMBOLS = ["NVDA"] as const;

export function isWatchSymbol(symbol: string): boolean {
  return BY_SYMBOL.has(symbol);
}

export function isBarSymbol(symbol: string): boolean {
  return isWatchSymbol(symbol) || (COMPARISON_SYMBOLS as readonly string[]).includes(symbol);
}

export function instrumentFor(symbol: string): Instrument | null {
  return BY_SYMBOL.get(symbol) ?? null;
}

export function stepSymbol(current: string, delta: number, symbols: readonly string[] = WATCHLIST.map((instrument) => instrument.symbol)): string {
  if (symbols.length === 0) return current;
  const index = symbols.indexOf(current);
  if (index < 0) return symbols[0];
  const next = (index + delta) % symbols.length;
  return symbols[next < 0 ? next + symbols.length : next];
}

export const KIND_LABEL: Record<InstrumentKind, string> = {
  stock: "Stock",
  etf: "ETF",
  index: "Index",
};
