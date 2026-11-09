import { cleanText } from "@/domain/text";
import { isSessionDate, isWeekendDate, isoToEasternLocal } from "@/domain/time";
import { isBarSymbol } from "@/domain/watchlist";

export const INTERVAL_MINUTES = 15;
export const REGULAR_OPEN_MINUTES = 9 * 60 + 30;
export const REGULAR_CLOSE_MINUTES = 16 * 60;

export const INTRADAY_FEED = {
  mode: "disconnected" as const,
  entry: "manual" as const,
  reason:
    "No documented keyless 15-minute bar feed is connected. Nasdaq bars require a bearer token. SEC submissions are filings, not trades. Undocumented chart endpoints are not called. Bars below are only what you type or import.",
};

export const RVOL_FORMULA =
  "RVOL = volume of this 15-minute regular-session bar ÷ the mean volume of earlier regular-session bars in the same Eastern clock window. The current session is excluded. Partial bars, weekend bars, sessions you mark closed, and missing volumes are not baseline samples. A blank day is not stored as zero. This is not cumulative daily volume ÷ average daily volume.";

export const ALIGNMENT_DEFINITION =
  "Call/up is with a benchmark only when that benchmark’s price change is positive. Put/down is with a benchmark only when the change is negative. A zero change is unchanged, not agreement. If SPY and QQQ disagree, the read is mixed. If one is missing or its timestamp does not match, the read is incomplete. With no setup direction, alignment is not computed. A positive change alone is not alignment.";

export type SetupDirection = "unset" | "call_up" | "put_down";

export type BarObservation = {
  id: string;
  symbol: string;
  sessionDate: string;
  windowStart: string;
  windowEnd: string;
  volume: number | null;
  open: number | null;
  close: number | null;
  sessionOpen: number | null;
  partial: boolean;
  closedSession: boolean;
  sourceLabel: string;
  delayNote: string;
  asOf: string | null;
  observedAt: string;
};

export type ParticipationBook = {
  directions: Record<string, SetupDirection>;
  bars: BarObservation[];
};

export function emptyParticipation(): ParticipationBook {
  return { directions: {}, bars: [] };
}

export type ClockWindow = { start: string; end: string };

export function regularWindows(): ClockWindow[] {
  const windows: ClockWindow[] = [];
  for (let start = REGULAR_OPEN_MINUTES; start < REGULAR_CLOSE_MINUTES; start += INTERVAL_MINUTES) {
    windows.push({ start: formatMinutes(start), end: formatMinutes(start + INTERVAL_MINUTES) });
  }
  return windows;
}

export function isRegularWindow(start: string, end: string): boolean {
  const startMinutes = clockMinutes(start);
  const endMinutes = clockMinutes(end);
  if (startMinutes === null || endMinutes === null) return false;
  return (
    startMinutes >= REGULAR_OPEN_MINUTES &&
    endMinutes <= REGULAR_CLOSE_MINUTES &&
    endMinutes - startMinutes === INTERVAL_MINUTES &&
    startMinutes % INTERVAL_MINUTES === 0
  );
}

export function directionKey(symbol: string, sessionDate: string): string {
  return `${symbol}|${sessionDate}`;
}

export function isSetupDirection(value: string): value is SetupDirection {
  return value === "unset" || value === "call_up" || value === "put_down";
}

export type BarDraft = {
  id: string;
  symbol: string;
  sessionDate: string;
  windowStart: string;
  windowEnd: string;
  volume: number | null;
  open: number | null;
  close: number | null;
  sessionOpen: number | null;
  partial: boolean;
  closedSession: boolean;
  sourceLabel: string;
  delayNote: string;
  asOf: string | null;
  observedAt: string;
};

export function validateBar(draft: BarDraft): { ok: true; bar: BarObservation } | { ok: false; error: string } {
  if (!isBarSymbol(draft.symbol)) return { ok: false, error: "That symbol is not on the watchlist or the comparison set." };
  if (!isSessionDate(draft.sessionDate)) return { ok: false, error: "Session date is not a real calendar date." };
  if (!isRegularWindow(draft.windowStart, draft.windowEnd)) {
    return {
      ok: false,
      error: "Window must be one 15-minute regular-session bar from 09:30 to 16:00 Eastern. 09:15 and 16:00 starts are outside the session.",
    };
  }
  if (draft.partial && draft.closedSession) {
    return { ok: false, error: "A bar cannot be both partial and a closed session." };
  }
  const sourceLabel = cleanText(draft.sourceLabel, 160).trim();
  if (!sourceLabel) return { ok: false, error: "A source label is required so the print has provenance." };
  if (!isoStamp(draft.observedAt)) return { ok: false, error: "Entered time must be a real timestamp." };
  if (draft.asOf !== null && !isoStamp(draft.asOf)) return { ok: false, error: "Quote time must be a real timestamp or blank." };
  if (draft.asOf && !asOfFitsWindow(draft.asOf, draft.sessionDate, draft.windowStart, draft.windowEnd)) {
    return { ok: false, error: "Quote time is outside this 15-minute Eastern window. It was not shifted to fit." };
  }
  if (draft.symbol === "SPX" && draft.volume !== null) {
    return { ok: false, error: "SPX has no traded volume. Leave volume blank. SPY volume is not a substitute." };
  }
  if (draft.closedSession) {
    if (draft.volume !== null || draft.open !== null || draft.close !== null || draft.sessionOpen !== null) {
      return { ok: false, error: "A closed session has no volume and no prices. Leave them blank. Do not enter zero." };
    }
  } else {
    const volume = finiteOrNull(draft.volume, "Volume");
    if (!volume.ok) return volume;
    if (volume.value !== null && volume.value < 0) return { ok: false, error: "Volume cannot be negative." };
    for (const [label, value] of [
      ["Open", draft.open],
      ["Close", draft.close],
      ["Session open", draft.sessionOpen],
    ] as const) {
      const parsed = finiteOrNull(value, label);
      if (!parsed.ok) return parsed;
      if (parsed.value !== null && parsed.value <= 0) {
        return { ok: false, error: `${label} must be a positive price, or blank if missing. Zero is not a print.` };
      }
    }
  }
  const delay = cleanText(draft.delayNote, 160).trim();
  return {
    ok: true,
    bar: {
      id: cleanText(draft.id, 80).trim() || `${draft.symbol}|${draft.sessionDate}|${draft.windowStart}`,
      symbol: draft.symbol,
      sessionDate: draft.sessionDate,
      windowStart: draft.windowStart,
      windowEnd: draft.windowEnd,
      volume: draft.closedSession ? null : draft.volume,
      open: draft.closedSession ? null : draft.open,
      close: draft.closedSession ? null : draft.close,
      sessionOpen: draft.closedSession ? null : draft.sessionOpen,
      partial: draft.partial === true,
      closedSession: draft.closedSession === true,
      sourceLabel,
      delayNote: delay || "Unknown",
      asOf: draft.asOf,
      observedAt: new Date(draft.observedAt).toISOString(),
    },
  };
}

export function upsertBar(bars: BarObservation[], bar: BarObservation): BarObservation[] {
  const next = bars.filter(
    (entry) => !(entry.symbol === bar.symbol && entry.sessionDate === bar.sessionDate && entry.windowStart === bar.windowStart),
  );
  next.push(bar);
  return next;
}

export type RvolReading =
  | { state: "not_applicable"; sampleCount: number; text: string }
  | { state: "unknown"; sampleCount: number; text: string; baselineSessions: string[] }
  | {
      state: "ratio";
      sampleCount: number;
      ratio: number;
      currentVolume: number;
      baselineMean: number;
      partial: boolean;
      baselineSessions: string[];
      text: string;
    };

export function relativeVolume(
  bars: BarObservation[],
  symbol: string,
  sessionDate: string,
  windowStart: string,
): RvolReading {
  if (symbol === "SPX") {
    return {
      state: "not_applicable",
      sampleCount: 0,
      text: "SPX has no traded volume. Relative volume is not applicable. SPY volume is not used in its place.",
    };
  }
  const baseline = baselineVolumeBars(bars, symbol, windowStart, sessionDate);
  const sessions = baseline.map((bar) => bar.sessionDate);
  if (isWeekendDate(sessionDate)) {
    return {
      state: "unknown",
      sampleCount: sessions.length,
      baselineSessions: sessions,
      text: "This session date is a weekend. Regular-session relative volume is not computed. Weekend bars are not baseline samples.",
    };
  }
  const current = findSlot(bars, symbol, sessionDate, windowStart);
  if (!current) {
    return {
      state: "unknown",
      sampleCount: sessions.length,
      baselineSessions: sessions,
      text:
        sessions.length === 0
          ? "No bar for this window. Insufficient history: 0 prior regular-session samples. Missing sessions are not zeros."
          : "No current bar for this window. Baseline samples are on file, but there is no numerator.",
    };
  }
  if (current.closedSession) {
    return {
      state: "unknown",
      sampleCount: sessions.length,
      baselineSessions: sessions,
      text: "This session is marked closed. It is not a zero-volume bar, and it is not in anyone’s baseline.",
    };
  }
  if (current.volume === null) {
    return {
      state: "unknown",
      sampleCount: sessions.length,
      baselineSessions: sessions,
      text: "Current 15-minute volume is missing. It is not treated as zero.",
    };
  }
  if (sessions.length === 0) {
    return {
      state: "unknown",
      sampleCount: 0,
      baselineSessions: [],
      text: "Insufficient history: 0 prior regular-session bars in this Eastern clock window. The current session is excluded. Missing sessions are not zeros.",
    };
  }
  const mean = baseline.reduce((sum, bar) => sum + (bar.volume ?? 0), 0) / baseline.length;
  if (mean === 0) {
    return {
      state: "unknown",
      sampleCount: sessions.length,
      baselineSessions: sessions,
      text: "Baseline mean volume is 0, so the ratio is undefined. Zero samples were not dropped and were not replaced.",
    };
  }
  const ratio = current.volume / mean;
  const partial = current.partial ? " Current bar is partial, so this is not a completed 15-minute bar." : "";
  return {
    state: "ratio",
    sampleCount: sessions.length,
    ratio,
    currentVolume: current.volume,
    baselineMean: mean,
    partial: current.partial,
    baselineSessions: sessions,
    text: `RVOL ${formatNumber(ratio)} = ${formatNumber(current.volume)} ÷ ${formatNumber(mean)} across ${sessions.length} prior session${sessions.length === 1 ? "" : "s"} at ${current.windowStart}–${current.windowEnd} ET.${partial}`,
  };
}

export type MoveClass = "with" | "against" | "unchanged" | "unknown";
export type LegClass = MoveClass | "unset" | "self" | "mismatch" | "missing";
export type Combined = "unset" | "with" | "against" | "mixed" | "unchanged" | "incomplete" | "unknown";

export type BenchmarkView = {
  symbol: "SPY" | "QQQ";
  role: "self" | "benchmark";
  coverage: "self" | "missing" | "mismatch" | "present" | "closed";
  windowLabel: string | null;
  asOfEt: string | null;
  delayNote: string | null;
  sourceLabel: string | null;
  partial: boolean;
  change15: number | null;
  changeIntraday: number | null;
  class15: LegClass;
  classIntraday: LegClass;
  note: string;
};

export type AlignmentReading = {
  direction: SetupDirection;
  window: ClockWindow;
  spy: BenchmarkView;
  qqq: BenchmarkView;
  windowCombined: Combined;
  intradayCombined: Combined;
  note: string;
};

export function marketAlignment(
  bars: BarObservation[],
  symbol: string,
  sessionDate: string,
  window: ClockWindow,
  direction: SetupDirection,
): AlignmentReading {
  const spy = benchmarkView(bars, "SPY", symbol, sessionDate, window, direction);
  const qqq = benchmarkView(bars, "QQQ", symbol, sessionDate, window, direction);
  const windowCombined = combineClasses([spy.class15, qqq.class15]);
  const intradayCombined = combineClasses([spy.classIntraday, qqq.classIntraday]);
  const weekend = isWeekendDate(sessionDate) ? " Weekend session: this is not a regular-session read." : "";
  return {
    direction,
    window,
    spy,
    qqq,
    windowCombined,
    intradayCombined,
    note: `${alignmentNote(windowCombined, intradayCombined, direction, symbol)}${weekend}`,
  };
}

export function classifyChange(change: number | null, direction: SetupDirection): MoveClass | "unset" {
  if (direction === "unset") return "unset";
  if (change === null || !Number.isFinite(change)) return "unknown";
  if (change === 0) return "unchanged";
  const rising = change > 0;
  if (direction === "call_up") return rising ? "with" : "against";
  return rising ? "against" : "with";
}

export function combineClasses(classes: LegClass[]): Combined {
  const independent = classes.filter((item) => item !== "self");
  if (independent.length === 0) return "unknown";
  if (independent.every((item) => item === "unset")) return "unset";
  const usable = independent.filter((item): item is MoveClass => item === "with" || item === "against" || item === "unchanged");
  const blocked = independent.some((item) => item === "mismatch" || item === "missing" || item === "unknown");
  if (usable.length === 0) return "unknown";
  if (blocked) return "incomplete";
  const unique = new Set(usable);
  if (unique.size > 1) return "mixed";
  return [...unique][0];
}

export function asOfFitsWindow(asOf: string, sessionDate: string, windowStart: string, windowEnd: string): boolean {
  const local = isoToEasternLocal(asOf);
  if (!local) return false;
  const [date, time] = local.split("T");
  if (date !== sessionDate) return false;
  const minute = clockMinutes(time ?? "");
  const start = clockMinutes(windowStart);
  const end = clockMinutes(windowEnd);
  if (minute === null || start === null || end === null) return false;
  return minute >= start && minute <= end;
}

export function priceChange(left: number | null, right: number | null): number | null {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return null;
  return right - left;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "Unknown";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2);
}

export function importBars(raw: unknown): { bars: BarObservation[]; errors: string[] } {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { bars?: unknown }).bars)) {
    return { bars: [], errors: ["Import must be an object with a bars array. Nothing was saved."] };
  }
  const bars: BarObservation[] = [];
  const errors: string[] = [];
  const entries = (raw as { bars: unknown[] }).bars;
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      errors.push(`Row ${index + 1} is not an object.`);
      return;
    }
    const body = entry as Record<string, unknown>;
    const validated = validateBar({
      id: typeof body.id === "string" ? body.id : `import-${index + 1}`,
      symbol: typeof body.symbol === "string" ? body.symbol.toUpperCase() : "",
      sessionDate: typeof body.sessionDate === "string" ? body.sessionDate : "",
      windowStart: typeof body.windowStart === "string" ? body.windowStart : "",
      windowEnd: typeof body.windowEnd === "string" ? body.windowEnd : "",
      volume: numberOrNull(body.volume),
      open: numberOrNull(body.open),
      close: numberOrNull(body.close),
      sessionOpen: numberOrNull(body.sessionOpen),
      partial: body.partial === true,
      closedSession: body.closedSession === true,
      sourceLabel: typeof body.sourceLabel === "string" ? body.sourceLabel : "",
      delayNote: typeof body.delayNote === "string" ? body.delayNote : "",
      asOf: typeof body.asOf === "string" && body.asOf.trim() ? body.asOf : null,
      observedAt: typeof body.observedAt === "string" ? body.observedAt : "",
    });
    if (!validated.ok) {
      errors.push(`Row ${index + 1}: ${validated.error}`);
      return;
    }
    const replaced = bars.findIndex(
      (bar) =>
        bar.symbol === validated.bar.symbol &&
        bar.sessionDate === validated.bar.sessionDate &&
        bar.windowStart === validated.bar.windowStart,
    );
    if (replaced >= 0) bars.splice(replaced, 1, validated.bar);
    else bars.push(validated.bar);
  });
  return { bars, errors };
}

function baselineVolumeBars(bars: BarObservation[], symbol: string, windowStart: string, currentSession: string): BarObservation[] {
  const bySession = new Map<string, BarObservation>();
  for (const bar of bars) {
    if (bar.symbol !== symbol || bar.windowStart !== windowStart) continue;
    if (bar.sessionDate === currentSession) continue;
    if (bar.closedSession || bar.partial || bar.volume === null) continue;
    if (isWeekendDate(bar.sessionDate)) continue;
    if (!isRegularWindow(bar.windowStart, bar.windowEnd)) continue;
    bySession.set(bar.sessionDate, bar);
  }
  return [...bySession.values()].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

function findSlot(bars: BarObservation[], symbol: string, sessionDate: string, windowStart: string): BarObservation | null {
  const matches = bars.filter((bar) => bar.symbol === symbol && bar.sessionDate === sessionDate && bar.windowStart === windowStart);
  return matches.length ? matches[matches.length - 1] : null;
}

function benchmarkView(
  bars: BarObservation[],
  benchmark: "SPY" | "QQQ",
  selected: string,
  sessionDate: string,
  window: ClockWindow,
  direction: SetupDirection,
): BenchmarkView {
  if (selected === benchmark) {
    return {
      symbol: benchmark,
      role: "self",
      coverage: "self",
      windowLabel: `${window.start}–${window.end} ET`,
      asOfEt: null,
      delayNote: null,
      sourceLabel: null,
      partial: false,
      change15: null,
      changeIntraday: null,
      class15: "self",
      classIntraday: "self",
      note: `${benchmark} is the selected symbol. Its bar is not an independent benchmark.`,
    };
  }
  const sameSession = bars.filter((bar) => bar.symbol === benchmark && bar.sessionDate === sessionDate);
  const matched = [...sameSession].reverse().find((bar) => bar.windowStart === window.start && bar.windowEnd === window.end);
  if (!matched) {
    const other = sameSession.find((bar) => bar.windowStart !== window.start);
    if (other) {
      return emptyBenchmark(benchmark, "mismatch", "mismatch", {
        windowLabel: `${other.windowStart}–${other.windowEnd} ET`,
        note: `${benchmark} has ${other.windowStart}–${other.windowEnd} ET on this session, not ${window.start}–${window.end} ET. The bars are not timestamp-aligned, so no direction is taken from ${benchmark}.`,
      });
    }
    return emptyBenchmark(benchmark, "missing", "missing", {
      note: `No ${benchmark} bar for ${window.start}–${window.end} ET on ${sessionDate}. Missing is not a zero change.`,
    });
  }
  if (matched.closedSession) {
    return emptyBenchmark(benchmark, "closed", "missing", {
      windowLabel: `${matched.windowStart}–${matched.windowEnd} ET`,
      sourceLabel: matched.sourceLabel,
      note: `${benchmark} is marked closed for this session. That is not a zero change.`,
    });
  }
  if (matched.asOf && !asOfFitsWindow(matched.asOf, matched.sessionDate, matched.windowStart, matched.windowEnd)) {
    return emptyBenchmark(benchmark, "mismatch", "mismatch", {
      windowLabel: `${matched.windowStart}–${matched.windowEnd} ET`,
      asOfEt: isoToEasternLocal(matched.asOf),
      sourceLabel: matched.sourceLabel,
      delayNote: matched.delayNote,
      note: `${benchmark} quote time falls outside ${matched.windowStart}–${matched.windowEnd} ET. Alignment is not computed from it.`,
    });
  }
  const change15 = priceChange(matched.open, matched.close);
  const changeIntraday = priceChange(matched.sessionOpen, matched.close);
  const quote = matched.asOf ? isoToEasternLocal(matched.asOf) : null;
  return {
    symbol: benchmark,
    role: "benchmark",
    coverage: "present",
    windowLabel: `${matched.windowStart}–${matched.windowEnd} ET`,
    asOfEt: quote,
    delayNote: matched.delayNote,
    sourceLabel: matched.sourceLabel,
    partial: matched.partial,
    change15,
    changeIntraday,
    class15: change15 === null ? "unknown" : classifyChange(change15, direction),
    classIntraday: changeIntraday === null ? "unknown" : classifyChange(changeIntraday, direction),
    note: matched.partial
      ? `${benchmark} bar is partial.`
      : quote
        ? `${benchmark} quote time ${quote} ET.`
        : `${benchmark} quote timestamp is Unknown. The entered window clocks match.`,
  };
}

function emptyBenchmark(
  symbol: "SPY" | "QQQ",
  coverage: BenchmarkView["coverage"],
  leg: LegClass,
  extra: Partial<BenchmarkView> & { note: string },
): BenchmarkView {
  return {
    symbol,
    role: "benchmark",
    coverage,
    windowLabel: null,
    asOfEt: null,
    delayNote: null,
    sourceLabel: null,
    partial: false,
    change15: null,
    changeIntraday: null,
    class15: leg,
    classIntraday: leg,
    ...extra,
  };
}

function alignmentNote(windowCombined: Combined, intradayCombined: Combined, direction: SetupDirection, symbol: string): string {
  if (direction === "unset") {
    return "Setup direction is unset. SPY and QQQ changes are shown, and neither is called with or against.";
  }
  const self = symbol === "SPY" || symbol === "QQQ" ? ` ${symbol} is this symbol, so it is not counted as its own benchmark.` : "";
  return `15-minute window: ${windowCombined}. Since the 09:30 open: ${intradayCombined}.${self}`;
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutes(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isoStamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function finiteOrNull(value: number | null, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  if (!Number.isFinite(value)) return { ok: false, error: `${label} is not a finite number.` };
  return { ok: true, value };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  return null;
}
