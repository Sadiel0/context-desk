import type { BarObservation, ClockWindow } from "@/domain/participation";
import { asOfFitsWindow, priceChange } from "@/domain/participation";
import { isWeekendDate } from "@/domain/time";

/** Requested comparison set. NVDA is not a trading-watchlist symbol. */
export const BLOCK_CORE = ["SPY", "QQQ", "NVDA"] as const;

export const BLOCK_SCOPE =
  "15-minute percent is close versus that bar’s open. Session percent is close versus the 09:30 open. The words same, opposite, and mixed are signs on that window.";

export type BlockSign = "up" | "down" | "flat" | "unknown";
export type BlockCoverage = "present" | "missing" | "mismatch" | "partial" | "closed";
export type BlockGroup = "same" | "opposite" | "mixed" | "unchanged" | "incomplete" | "unknown";

export type BlockLeg = {
  symbol: string;
  selected: boolean;
  coverage: BlockCoverage;
  change15: number | null;
  change15Pct: number | null;
  sessionPct: number | null;
  sign15: BlockSign;
  signSession: BlockSign;
};

export type BlockReading = {
  members: string[];
  windowLabel: string;
  manual: true;
  legs: BlockLeg[];
  windowGroup: BlockGroup;
  sessionGroup: BlockGroup;
  note: string;
};

export function blockMembers(selected: string): string[] {
  const members: string[] = [...BLOCK_CORE];
  if (selected && !members.includes(selected)) members.push(selected);
  return members;
}

export function blockComparison(
  bars: BarObservation[],
  selected: string,
  sessionDate: string,
  window: ClockWindow,
): BlockReading {
  const members = blockMembers(selected);
  const windowLabel = `${window.start}–${window.end} ET`;
  if (isWeekendDate(sessionDate)) {
    return {
      members,
      windowLabel,
      manual: true,
      legs: members.map((symbol) => emptyLeg(symbol, selected, "missing")),
      windowGroup: "unknown",
      sessionGroup: "unknown",
      note: `Weekend session. Block signs are not computed for ${windowLabel}.`,
    };
  }
  const legs = members.map((symbol) => legFor(bars, symbol, selected, sessionDate, window));
  const windowGroup = groupOf(legs, selected, "sign15");
  const sessionGroup = groupOf(legs, selected, "signSession");
  return {
    members,
    windowLabel,
    manual: true,
    legs,
    windowGroup,
    sessionGroup,
    note: `Manual bars only. ${windowLabel}. 15-minute signs: ${windowGroup}. Since the 09:30 open: ${sessionGroup}. ${BLOCK_SCOPE}`,
  };
}

export function percentChange(base: number | null, next: number | null): number | null {
  if (base === null || next === null || !Number.isFinite(base) || !Number.isFinite(next) || base === 0) return null;
  return ((next - base) / base) * 100;
}

function legFor(
  bars: BarObservation[],
  symbol: string,
  selected: string,
  sessionDate: string,
  window: ClockWindow,
): BlockLeg {
  const sameSession = bars.filter((bar) => bar.symbol === symbol && bar.sessionDate === sessionDate);
  const matched = [...sameSession].reverse().find((bar) => bar.windowStart === window.start && bar.windowEnd === window.end);
  if (!matched) {
    const other = sameSession.some((bar) => bar.windowStart !== window.start);
    return emptyLeg(symbol, selected, other ? "mismatch" : "missing");
  }
  if (matched.closedSession) return emptyLeg(symbol, selected, "closed");
  if (matched.asOf && !asOfFitsWindow(matched.asOf, matched.sessionDate, matched.windowStart, matched.windowEnd)) {
    return emptyLeg(symbol, selected, "mismatch");
  }
  if (matched.partial) return emptyLeg(symbol, selected, "partial");
  const change15 = priceChange(matched.open, matched.close);
  const change15Pct = percentChange(matched.open, matched.close);
  const sessionPct = percentChange(matched.sessionOpen, matched.close);
  return {
    symbol,
    selected: symbol === selected,
    coverage: "present",
    change15,
    change15Pct,
    sessionPct,
    sign15: signOf(change15Pct),
    signSession: signOf(sessionPct),
  };
}

function emptyLeg(symbol: string, selected: string, coverage: BlockCoverage): BlockLeg {
  return {
    symbol,
    selected: symbol === selected,
    coverage,
    change15: null,
    change15Pct: null,
    sessionPct: null,
    sign15: "unknown",
    signSession: "unknown",
  };
}

function signOf(value: number | null): BlockSign {
  if (value === null || !Number.isFinite(value)) return "unknown";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function groupOf(legs: BlockLeg[], selected: string, key: "sign15" | "signSession"): BlockGroup {
  const blocked = legs.some((leg) => leg.coverage !== "present" || leg[key] === "unknown");
  const usable = legs.filter((leg) => leg.coverage === "present" && leg[key] !== "unknown");
  if (usable.length < 2) return blocked ? "incomplete" : "unknown";
  if (blocked) return "incomplete";
  const directional = usable.filter((leg) => leg[key] === "up" || leg[key] === "down");
  if (directional.length === 0) return "unchanged";
  const signs = new Set(directional.map((leg) => leg[key]));
  if (signs.size === 1) return "same";
  const selectedLeg = directional.find((leg) => leg.symbol === selected);
  const others = directional.filter((leg) => leg.symbol !== selected);
  const otherSigns = new Set(others.map((leg) => leg[key]));
  if (selectedLeg && others.length > 0 && otherSigns.size === 1 && !otherSigns.has(selectedLeg[key])) return "opposite";
  return "mixed";
}
