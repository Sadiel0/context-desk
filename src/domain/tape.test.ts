import { describe, expect, it } from "vitest";
import { TAPE_DETAIL, tapeRows } from "@/domain/tape";
import { stepSymbol } from "@/domain/watchlist";

describe("tape", () => {
  it("keeps prints, side, and depth unavailable and does not turn a bar into buys or sells", () => {
    for (const symbol of ["TSLA", "SPCX", "SPY", "SPX"]) {
      const rows = tapeRows(symbol);
      expect(rows.map((row) => row.kind)).toEqual(["bar_volume", "time_and_sales", "bid_ask_side", "book_depth"]);
      expect(rows.filter((row) => row.kind !== "bar_volume").every((row) => row.availability === "unavailable")).toBe(true);
      const text = `${JSON.stringify(rows)} ${TAPE_DETAIL}`;
      expect(text).not.toMatch(/\b(buys|sells|buy volume|sell volume|institutional)\b/i);
    }
    expect(tapeRows("SPX").find((row) => row.kind === "bar_volume")?.availability).toBe("not_applicable");
    expect(tapeRows("SPCX").find((row) => row.kind === "bar_volume")?.availability).toBe("manual");
    expect(TAPE_DETAIL).toMatch(/not buyer or seller aggression/);
  });
});

describe("symbol stepping", () => {
  it("moves through the watchlist without dropping SPCX or treating it as SPX", () => {
    expect(stepSymbol("TSLA", 1)).toBe("SPCX");
    expect(stepSymbol("SPCX", 1)).toBe("META");
    expect(stepSymbol("SPCX", -1)).toBe("TSLA");
    expect(stepSymbol("SPX", 1)).toBe("TSLA");
    expect(stepSymbol("TSLA", -1)).toBe("SPX");
    expect(stepSymbol("NOPE", 1)).toBe("TSLA");
  });
});
