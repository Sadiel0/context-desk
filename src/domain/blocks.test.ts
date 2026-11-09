import { describe, expect, it } from "vitest";
import { blockComparison, blockMembers, percentChange } from "@/domain/blocks";
import { validateBar, type BarDraft } from "@/domain/participation";
import { isWatchSymbol } from "@/domain/watchlist";

const WINDOW = { start: "10:00", end: "10:15" };

function draft(symbol: string, open: number, close: number, sessionOpen: number, overrides: Partial<BarDraft> = {}): BarDraft {
  return {
    id: symbol,
    symbol,
    sessionDate: "2026-11-06",
    windowStart: "10:00",
    windowEnd: "10:15",
    volume: symbol === "SPX" ? null : 100,
    open,
    close,
    sessionOpen,
    partial: false,
    closedSession: false,
    sourceLabel: "Typed from TC2000",
    delayNote: "Unknown",
    asOf: null,
    observedAt: "2026-11-06T15:20:00.000Z",
    ...overrides,
  };
}

function bar(symbol: string, open: number, close: number, sessionOpen: number, overrides: Partial<BarDraft> = {}) {
  const validated = validateBar(draft(symbol, open, close, sessionOpen, overrides));
  if (!validated.ok) throw new Error(validated.error);
  return validated.bar;
}

describe("block comparison", () => {
  it("keeps SPY, QQQ, and NVDA, and adds the selected stock once", () => {
    expect(blockMembers("TSLA")).toEqual(["SPY", "QQQ", "NVDA", "TSLA"]);
    expect(blockMembers("QQQ")).toEqual(["SPY", "QQQ", "NVDA"]);
    expect(blockMembers("SPCX")).toContain("NVDA");
    expect(isWatchSymbol("NVDA")).toBe(false);
    expect(isWatchSymbol("HPY")).toBe(false);
    expect(validateBar(draft("NVDA", 100, 102, 98)).ok).toBe(true);
  });

  it("compares percent signs on the same completed window and does not treat points as equal weight", () => {
    const bars = [
      bar("SPY", 100, 101, 99),
      bar("QQQ", 400, 402, 390),
      bar("NVDA", 1000, 1030, 980),
      bar("TSLA", 200, 198, 190),
    ];
    const reading = blockComparison(bars, "TSLA", "2026-11-06", WINDOW);
    expect(reading.manual).toBe(true);
    expect(reading.legs.find((leg) => leg.symbol === "SPY")?.change15Pct).toBeCloseTo(1);
    expect(reading.legs.find((leg) => leg.symbol === "NVDA")?.change15Pct).toBeCloseTo(3);
    expect(reading.legs.find((leg) => leg.symbol === "NVDA")?.change15).toBe(30);
    expect(reading.windowGroup).toBe("opposite");
    expect(reading.sessionGroup).toBe("same");
    expect(reading.note).not.toMatch(/\b(leads|follows|correlation|breadth|entry)\b/i);
    expect(percentChange(100, 101)).toBeCloseTo(1);
  });

  it("calls disagreement among the companions mixed, and a missing or partial leg incomplete", () => {
    const mixed = blockComparison(
      [bar("SPY", 100, 101, 100), bar("QQQ", 100, 99, 100), bar("NVDA", 100, 101, 100), bar("AAPL", 100, 101, 100)],
      "AAPL",
      "2026-11-06",
      WINDOW,
    );
    expect(mixed.windowGroup).toBe("mixed");
    const partial = blockComparison(
      [bar("SPY", 100, 101, 100), bar("QQQ", 100, 101, 100), bar("NVDA", 100, 101, 100, { partial: true }), bar("AAPL", 100, 101, 100)],
      "AAPL",
      "2026-11-06",
      WINDOW,
    );
    expect(partial.legs.find((leg) => leg.symbol === "NVDA")?.coverage).toBe("partial");
    expect(partial.legs.find((leg) => leg.symbol === "NVDA")?.change15Pct).toBeNull();
    expect(partial.windowGroup).toBe("incomplete");
    const mismatch = blockComparison(
      [bar("NVDA", 100, 110, 100, { windowStart: "10:15", windowEnd: "10:30" }), bar("SPY", 100, 101, 100)],
      "TSLA",
      "2026-11-06",
      WINDOW,
    );
    expect(mismatch.legs.find((leg) => leg.symbol === "NVDA")?.coverage).toBe("mismatch");
    expect(mismatch.legs.find((leg) => leg.symbol === "NVDA")?.change15).toBeNull();
    expect(mismatch.windowGroup).toBe("incomplete");
  });

  it("does not compute a weekend block or a flat tape as a direction", () => {
    const weekend = blockComparison([bar("SPY", 100, 101, 100, { sessionDate: "2026-11-08" })], "TSLA", "2026-11-08", WINDOW);
    expect(weekend.windowGroup).toBe("unknown");
    const flat = blockComparison(
      [bar("SPY", 100, 100, 100), bar("QQQ", 50, 50, 50), bar("NVDA", 10, 10, 10), bar("TSLA", 20, 20, 20)],
      "TSLA",
      "2026-11-06",
      WINDOW,
    );
    expect(flat.windowGroup).toBe("unchanged");
    expect(flat.sessionGroup).toBe("unchanged");
  });
});
