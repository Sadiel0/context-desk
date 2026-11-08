import { describe, expect, it } from "vitest";
import { describeCapture, emptyOptionCapture, evaluateOption } from "@/domain/options";

function capture(overrides: Partial<ReturnType<typeof emptyOptionCapture>> = {}) {
  return { ...emptyOptionCapture(), ...overrides };
}

describe("option math", () => {
  it("separates spread, debit, exposure, stop, and the contract plan", () => {
    const math = evaluateOption(
      capture({
        root: "TSLA",
        right: "call",
        strike: "250",
        expiry: "2026-11-20",
        bid: "1.20",
        ask: "1.40",
        debit: "1.30",
        contracts: "2",
        multiplier: "100",
        sourceName: "Phone screen",
        sourceTimestampLocal: "2026-11-08T09:30",
        targetReturnPct: "10",
      }),
      "mid",
      "TSLA",
    );
    expect(math.errors).toEqual([]);
    expect(math.spreadDollars).toBeCloseTo(0.2);
    expect(math.spreadPct).toBeCloseTo((0.2 / 1.3) * 100);
    expect(math.formulaExpression).toContain("(1.40 − 1.20) / ((1.40 + 1.20) / 2)");
    expect(math.premiumPerContract).toBeCloseTo(130);
    expect(math.fullPremiumExposure).toBeCloseTo(260);
    expect(math.stopRisk).toBeNull();
    expect(math.fee).toBeNull();
    expect(math.targetContractPrice).toBeCloseTo(1.43);
    expect(math.targetExpression).toMatch(/not a quote/);
    expect(math.unknowns).toContain("Fees unknown");
    expect(math.unknowns).toContain("Tick size unknown");
    expect(math.unknowns).toContain("Estimated stop risk not established");
    expect(math.unknowns).toContain("Expiration time unknown. A date is not a clock time.");
    expect(math.recordGaps).toEqual([]);
  });

  it("does not turn a missing multiplier or debit into zero", () => {
    const math = evaluateOption(capture({ bid: "1.20", ask: "1.40", debit: "1.30", contracts: "1" }), "ask", "AAPL");
    expect(math.fullPremiumExposure).toBeNull();
    expect(math.premiumPerContract).toBeNull();
    expect(math.spreadPct).toBeCloseTo((0.2 / 1.4) * 100);
    expect(math.unknowns.join(" ")).toMatch(/Multiplier unknown/);
    expect(JSON.stringify(math)).not.toContain('"fullPremiumExposure":0');

    const blank = evaluateOption(emptyOptionCapture(), "mid", "TSLA");
    expect(blank.spreadDollars).toBeNull();
    expect(blank.targetContractPrice).toBeNull();
    expect(blank.unknowns).toContain("Bid unknown");
    const described = describeCapture(emptyOptionCapture(), "TSLA", "mid");
    expect(described).toContain("Bid: Unknown");
    expect(described).not.toContain("0.00");
  });

  it("refuses an inverted market and a zero divisor", () => {
    const inverted = evaluateOption(capture({ bid: "2", ask: "1" }), "mid", "META");
    expect(inverted.spreadDollars).toBeNull();
    expect(inverted.errors.join(" ")).toMatch(/Ask is below bid/);

    const locked = evaluateOption(capture({ bid: "0", ask: "0" }), "mid", "META");
    expect(locked.spreadDollars).toBe(0);
    expect(locked.spreadPct).toBeNull();
    expect(locked.formulaExpression).toMatch(/divisor is zero/);
  });

  it("keeps SPX and SPXW distinct from ETF delivery", () => {
    const spx = evaluateOption(capture({ root: "spx" }), "mid", "SPX");
    expect(spx.distinctions.join(" ")).toMatch(/not the SPY ETF/);
    expect(spx.distinctions.join(" ")).toMatch(/SPXW is a separate option root/);
    expect(spx.distinctions.join(" ")).toMatch(/ETF share-delivery rules are not applied/);
    expect(spx.distinctions.join(" ")).toMatch(/The root you typed is SPX, not SPXW/);
    expect(spx.distinctions.join(" ")).not.toMatch(/AM-settled|PM-settled|European/);

    const mismatch = evaluateOption(capture({ root: "SPXW" }), "bid", "SPY");
    expect(mismatch.distinctions.join(" ")).toMatch(/different instruments/);
    expect(mismatch.formulaLabel).toBe("(ask − bid) / bid");
  });

  it("does not guess a daylight-saving source time", () => {
    const math = evaluateOption(capture({ sourceTimestampLocal: "2026-11-01T01:30" }), "mid", "SPY");
    expect(math.sourceIso).toBeNull();
    expect(math.errors.join(" ")).toMatch(/was not guessed/);
    expect(math.recordGaps).toContain("source time");
  });
});
