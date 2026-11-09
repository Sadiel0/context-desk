import { describe, expect, it } from "vitest";
import { saveParticipationBar, setSetupDirection } from "@/domain/actions";
import {
  asOfFitsWindow,
  importBars,
  isRegularWindow,
  marketAlignment,
  relativeVolume,
  validateBar,
  type BarDraft,
  type BarObservation,
} from "@/domain/participation";
import { initialWorkspace } from "@/domain/state";
import { contractDistinctions } from "@/domain/options";

const WINDOW = { start: "10:00", end: "10:15" };

function draft(overrides: Partial<BarDraft> = {}): BarDraft {
  return {
    id: "bar",
    symbol: "TSLA",
    sessionDate: "2026-11-06",
    windowStart: "10:00",
    windowEnd: "10:15",
    volume: 1000,
    open: 10,
    close: 11,
    sessionOpen: 9,
    partial: false,
    closedSession: false,
    sourceLabel: "Typed from TC2000",
    delayNote: "Unknown",
    asOf: null,
    observedAt: "2026-11-06T15:20:00.000Z",
    ...overrides,
  };
}

function bar(overrides: Partial<BarObservation> = {}): BarObservation {
  const validated = validateBar(draft(overrides));
  if (!validated.ok) throw new Error(validated.error);
  return { ...validated.bar, ...overrides };
}

describe("relative volume", () => {
  it("uses only the same Eastern clock window, excludes the current session, and refuses a daily-volume reading", () => {
    const bars = [
      bar({ id: "old-a", sessionDate: "2026-11-04", volume: 100 }),
      bar({ id: "old-b", sessionDate: "2026-11-05", volume: 300 }),
      bar({ id: "same-day-other", sessionDate: "2026-11-06", windowStart: "09:30", windowEnd: "09:45", volume: 9000 }),
      bar({ id: "current", sessionDate: "2026-11-06", volume: 200 }),
    ];
    const reading = relativeVolume(bars, "TSLA", "2026-11-06", "10:00");
    expect(reading.state).toBe("ratio");
    if (reading.state !== "ratio") return;
    expect(reading.sampleCount).toBe(2);
    expect(reading.baselineMean).toBe(200);
    expect(reading.ratio).toBe(1);
    expect(reading.baselineSessions).toEqual(["2026-11-04", "2026-11-05"]);
    expect(reading.text).not.toMatch(/cumulative|daily volume/i);
  });

  it("matches 10:00 ET across a daylight-saving change without converting the clock to UTC", () => {
    const bars = [
      bar({ id: "est", sessionDate: "2026-03-06", volume: 80 }),
      bar({ id: "edt", sessionDate: "2026-03-10", volume: 120 }),
      bar({ id: "now", sessionDate: "2026-03-11", volume: 100 }),
    ];
    const reading = relativeVolume(bars, "TSLA", "2026-03-11", "10:00");
    expect(reading.state).toBe("ratio");
    if (reading.state !== "ratio") return;
    expect(reading.sampleCount).toBe(2);
    expect(reading.baselineMean).toBe(100);
  });

  it("excludes partial, closed, weekend, and missing samples and does not treat them as zero", () => {
    const bars = [
      bar({ id: "partial", sessionDate: "2026-11-03", volume: 50, partial: true }),
      bar({
        id: "closed",
        sessionDate: "2026-11-04",
        volume: null,
        open: null,
        close: null,
        sessionOpen: null,
        closedSession: true,
      }),
      bar({ id: "weekend", sessionDate: "2026-11-01", volume: 5 }),
      bar({ id: "missing", sessionDate: "2026-11-05", volume: null }),
      bar({ id: "current", sessionDate: "2026-11-06", volume: 80 }),
    ];
    const reading = relativeVolume(bars, "TSLA", "2026-11-06", "10:00");
    expect(reading.state).toBe("unknown");
    expect(reading.sampleCount).toBe(0);
    expect(reading.text).toMatch(/Insufficient history/);
    expect(isRegularWindow("09:15", "09:30")).toBe(false);
    expect(isRegularWindow("16:00", "16:15")).toBe(false);
    expect(isRegularWindow("15:45", "16:00")).toBe(true);
    expect(validateBar(draft({ windowStart: "09:15", windowEnd: "09:30" })).ok).toBe(false);
  });

  it("keeps a partial current bar out of the completed-bar claim and rejects a zero baseline mean", () => {
    const partial = relativeVolume(
      [bar({ sessionDate: "2026-11-05", volume: 100 }), bar({ sessionDate: "2026-11-06", volume: 50, partial: true })],
      "TSLA",
      "2026-11-06",
      "10:00",
    );
    expect(partial.state).toBe("ratio");
    if (partial.state === "ratio") expect(partial.text).toMatch(/partial/);
    const zeros = relativeVolume(
      [bar({ sessionDate: "2026-11-05", volume: 0 }), bar({ sessionDate: "2026-11-06", volume: 40 })],
      "TSLA",
      "2026-11-06",
      "10:00",
    );
    expect(zeros.state).toBe("unknown");
    expect(zeros.text).toMatch(/undefined/);
  });

  it("marks SPX volume not applicable and does not borrow SPY", () => {
    const reading = relativeVolume(
      [bar({ symbol: "SPY", sessionDate: "2026-11-05", volume: 500 }), bar({ symbol: "SPY", sessionDate: "2026-11-06", volume: 800 })],
      "SPX",
      "2026-11-06",
      "10:00",
    );
    expect(reading.state).toBe("not_applicable");
    expect(reading.text).toMatch(/no traded volume/);
    expect(reading.text).toMatch(/not used/);
    expect(validateBar(draft({ symbol: "SPX", volume: 10, open: null, close: null, sessionOpen: null })).ok).toBe(false);
    const saved = saveParticipationBar(initialWorkspace(), draft({ symbol: "SPCX", volume: 10 }));
    expect(saved.error).toBeNull();
    expect(saved.state.participation.bars[0].symbol).toBe("SPCX");
  });
});

describe("market alignment", () => {
  it("does not treat a positive change as alignment until direction is set, and mixes opposing benchmarks", () => {
    const bars = [
      bar({ symbol: "TSLA", open: 10, close: 12, sessionOpen: 9 }),
      bar({ symbol: "SPY", open: 100, close: 101, sessionOpen: 99 }),
      bar({ symbol: "QQQ", open: 100, close: 99, sessionOpen: 101 }),
    ];
    const unset = marketAlignment(bars, "TSLA", "2026-11-06", WINDOW, "unset");
    expect(unset.windowCombined).toBe("unset");
    expect(unset.spy.class15).toBe("unset");
    expect(unset.note).toMatch(/neither is called with or against/);
    const mixed = marketAlignment(bars, "TSLA", "2026-11-06", WINDOW, "call_up");
    expect(mixed.spy.class15).toBe("with");
    expect(mixed.qqq.class15).toBe("against");
    expect(mixed.windowCombined).toBe("mixed");
    const flat = marketAlignment(
      [bar({ symbol: "SPY", open: 100, close: 100, sessionOpen: 100 }), bar({ symbol: "QQQ", open: 50, close: 50, sessionOpen: 50 })],
      "TSLA",
      "2026-11-06",
      WINDOW,
      "put_down",
    );
    expect(flat.windowCombined).toBe("unchanged");
    expect(flat.intradayCombined).toBe("unchanged");
  });

  it("reports timestamp mismatch instead of a nearest bar", () => {
    const bars = [
      bar({ symbol: "SPY", windowStart: "10:15", windowEnd: "10:30", open: 1, close: 2 }),
      bar({ symbol: "QQQ", open: 1, close: 2, sessionOpen: 1 }),
    ];
    const reading = marketAlignment(bars, "TSLA", "2026-11-06", WINDOW, "call_up");
    expect(reading.spy.coverage).toBe("mismatch");
    expect(reading.spy.change15).toBeNull();
    expect(reading.windowCombined).toBe("incomplete");
    expect(reading.qqq.class15).toBe("with");
    expect(asOfFitsWindow("2026-11-06T16:00:00.000Z", "2026-11-06", "10:00", "10:15")).toBe(false);
    const outside = validateBar(draft({ symbol: "QQQ", asOf: "2026-11-06T16:00:00.000Z" }));
    expect(outside.ok).toBe(false);
  });

  it("does not let SPY confirm itself", () => {
    const bars = [
      bar({ symbol: "SPY", open: 100, close: 110, sessionOpen: 90 }),
      bar({ symbol: "QQQ", open: 100, close: 90, sessionOpen: 100 }),
    ];
    const reading = marketAlignment(bars, "SPY", "2026-11-06", WINDOW, "call_up");
    expect(reading.spy.class15).toBe("self");
    expect(reading.qqq.class15).toBe("against");
    expect(reading.windowCombined).toBe("against");
    expect(reading.note).toMatch(/not counted as its own benchmark/);
  });

  it("keeps put/down with a falling intraday tape separate from the 15-minute window", () => {
    const bars = [
      bar({ symbol: "SPY", open: 100, close: 101, sessionOpen: 110 }),
      bar({ symbol: "QQQ", open: 50, close: 51, sessionOpen: 60 }),
    ];
    const reading = marketAlignment(bars, "AAPL", "2026-11-06", WINDOW, "put_down");
    expect(reading.windowCombined).toBe("against");
    expect(reading.intradayCombined).toBe("with");
    const cleared = setSetupDirection(
      saveParticipationBar(initialWorkspace(), draft()).state,
      "TSLA",
      "2026-11-06",
      "call_up",
    ).state;
    expect(cleared.participation.directions["TSLA|2026-11-06"]).toBe("call_up");
  });
});

describe("import", () => {
  it("rejects a non-array and a pre-session window without inventing bars", () => {
    expect(importBars({ bars: "nope" }).bars).toEqual([]);
    const result = importBars({
      bars: [{ ...draft(), symbol: "SPCX", windowStart: "16:00", windowEnd: "16:15", volume: 1 }],
    });
    expect(result.bars).toEqual([]);
    expect(result.errors[0]).toMatch(/09:30/);
    expect(contractDistinctions("SPCX", "SPCX").join(" ")).toMatch(/not the SPX index/);
    expect(contractDistinctions("SPCX", "SPCX").join(" ")).not.toMatch(/S&P 500 index/);
  });
});
