import type { Instrument, InstrumentKind } from "@/domain/watchlist";

export type Fundamentals = {
  displayName: string;
  indexMembership: string;
  marketCap: string;
  marketCapSourceUrl: string | null;
  analystFirm: string;
  analystName: string;
  analystTarget: string;
  analystTargetDate: string;
  analystHorizon: string;
  analystSourceUrl: string | null;
  stockRecommendation: string;
  recommendationDate: string;
  recommendationSourceUrl: string | null;
  insiderContext: string;
  contextNote: string;
};

export type EarningsTiming = "unspecified" | "before_open" | "after_close" | "during_session" | "not_scheduled";

export type EarningsEvent = {
  id: string;
  symbol: string;
  eventDate: string;
  timing: EarningsTiming;
  clockTimeNote: string;
  sourceUrl: string | null;
  sourceLabel: string;
  note: string;
  recordedAt: string;
};

export const EARNINGS_TIMING_LABEL: Record<EarningsTiming, string> = {
  unspecified: "Timing not specified",
  before_open: "Before open — not a clock time",
  after_close: "After close — not a clock time",
  during_session: "During the session — clock time still unknown unless you note it",
  not_scheduled: "No earnings date in this note",
};

export function isEarningsTiming(value: string): value is EarningsTiming {
  return value in EARNINGS_TIMING_LABEL;
}

export type FieldMode = "enter" | "not_applicable";

export function fieldMode(kind: InstrumentKind): {
  analystTarget: FieldMode;
  recommendation: FieldMode;
  insider: FieldMode;
} {
  if (kind === "stock") {
    return { analystTarget: "enter", recommendation: "enter", insider: "enter" };
  }
  return { analystTarget: "not_applicable", recommendation: "not_applicable", insider: "not_applicable" };
}

export function emptyFundamentals(instrument: Instrument): Fundamentals {
  return {
    displayName: instrument.name,
    indexMembership: "",
    marketCap: "",
    marketCapSourceUrl: null,
    analystFirm: "",
    analystName: "",
    analystTarget: "",
    analystTargetDate: "",
    analystHorizon: "",
    analystSourceUrl: null,
    stockRecommendation: "",
    recommendationDate: "",
    recommendationSourceUrl: null,
    insiderContext: "",
    contextNote: "",
  };
}

export function displayOrUnknown(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : "Unknown";
}
