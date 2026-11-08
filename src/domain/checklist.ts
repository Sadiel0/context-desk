import { BOLLINGER_ADAPTATION } from "@/domain/limits";
import { cleanText } from "@/domain/text";
import { isSessionDate } from "@/domain/time";
import { normalizeUrl } from "@/domain/urls";

export const CHECKLIST_ITEM_IDS = [
  "fed_earnings",
  "bollinger",
  "moving_averages",
  "trendline",
  "gap",
  "option_contract",
] as const;

export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number];
export type LegacyChecklistStatus = "confirmed" | "not_met" | "unknown" | "not_applicable";
export type ReviewMark = "unreviewed" | "reviewed";
export type Observation = "unknown" | "observed" | "not_observed" | "not_applicable";
export type EvidenceKind = "tc2000_user" | "sourced_fact" | "manual_note";
export type EvidenceScope = "symbol" | "macro" | "user";

export type ChecklistItem = {
  id: ChecklistItemId;
  titleEs: string;
  titleEn: string;
  rowEn: string;
  question: string;
  detail: string;
  provenance: string;
  allowedEvidence: readonly EvidenceKind[];
};

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = [
  {
    id: "fed_earnings",
    titleEs: "Reuniones de la Fed y earnings",
    titleEn: "Fed meetings and earnings",
    rowEn: "Fed and earnings",
    question: "Did you review Fed dates and earnings, and what did you actually find?",
    detail:
      "Reviewed means the look is finished. Observed means a dated Fed row or an earnings event was recorded. Finishing the review does not mean a trade is safe, and it does not mean a statement or a report has a clock time.",
    provenance: "Sourced fact or your note. Not TC2000.",
    allowedEvidence: ["sourced_fact", "manual_note"],
  },
  {
    id: "bollinger",
    titleEs: "Bollinger 15 min, hora y día",
    titleEn: "Bollinger Bands, 15-minute, hour, and day",
    rowEn: "Bands, 15m / hour / day",
    question: "What did you see on the 15-minute, hour, and day Bollinger Bands in TC2000?",
    detail: `TC2000 is the source. This desk does not read bands or candles and does not mark this item for you. ${BOLLINGER_ADAPTATION}`,
    provenance: "You record this from TC2000.",
    allowedEvidence: ["tc2000_user"],
  },
  {
    id: "moving_averages",
    titleEs: "Medias móviles, hora y día",
    titleEn: "Moving averages, hour and day",
    rowEn: "Averages, hour / day",
    question: "What did you see on the hour and day moving averages in TC2000?",
    detail: "TC2000 is the source. This desk does not calculate moving averages and does not mark this item for you.",
    provenance: "You record this from TC2000.",
    allowedEvidence: ["tc2000_user"],
  },
  {
    id: "trendline",
    titleEs: "Ruptura de línea de tendencia",
    titleEn: "Trendline breakout",
    rowEn: "Trendline breakout",
    question: "What did you see for a trendline breakout on your TC2000 chart?",
    detail: "TC2000 is the source. This desk does not draw trendlines and does not mark this item for you.",
    provenance: "You record this from TC2000.",
    allowedEvidence: ["tc2000_user"],
  },
  {
    id: "gap",
    titleEs: "Gap al alza o a la baja",
    titleEn: "Gap up or down",
    rowEn: "Gap up or down",
    question: "If this strategy uses a gap, did you see one?",
    detail:
      "A gap is strategy-dependent. It is not a universal gate. Not applicable means this strategy does not use the gap. This desk does not detect gaps from prices.",
    provenance: "You record this from TC2000, or you note why it does not apply.",
    allowedEvidence: ["tc2000_user", "manual_note"],
  },
  {
    id: "option_contract",
    titleEs: "Precio, bid, ask y vencimiento",
    titleEn: "Option price, bid, ask, and expiration",
    rowEn: "Price, bid, ask, expiration",
    question: "Is the exact contract recorded, and did the screen show the quotes you require?",
    detail:
      "Enter the contract in the capture. Unknown quotes stay unknown. Fees and ticks stay unknown unless you type a fee you saw. Attaching a snapshot does not set review or observation.",
    provenance: "Your capture from the screen you read. Not an order.",
    allowedEvidence: ["manual_note"],
  },
];

const ITEM_BY_ID = new Map(CHECKLIST_ITEMS.map((item) => [item.id, item]));

export function checklistItem(id: ChecklistItemId): ChecklistItem | undefined {
  return ITEM_BY_ID.get(id);
}

export function isChecklistItemId(value: string): value is ChecklistItemId {
  return ITEM_BY_ID.has(value as ChecklistItemId);
}

export function isLegacyChecklistStatus(value: string): value is LegacyChecklistStatus {
  return value === "confirmed" || value === "not_met" || value === "unknown" || value === "not_applicable";
}

export function isReviewMark(value: string): value is ReviewMark {
  return value === "unreviewed" || value === "reviewed";
}

export function isObservation(value: string): value is Observation {
  return value === "unknown" || value === "observed" || value === "not_observed" || value === "not_applicable";
}

/**
 * Older files used one status. "Confirmed" on Fed and earnings meant the look was finished,
 * not that an event was seen. On the other five it meant the condition was seen.
 */
export function migrateLegacyStatus(
  itemId: ChecklistItemId,
  status: LegacyChecklistStatus,
): { review: ReviewMark; observation: Observation } {
  if (status === "unknown") return { review: "unreviewed", observation: "unknown" };
  if (status === "not_applicable") return { review: "reviewed", observation: "not_applicable" };
  if (status === "not_met") return { review: "reviewed", observation: "not_observed" };
  if (itemId === "fed_earnings") return { review: "reviewed", observation: "unknown" };
  return { review: "reviewed", observation: "observed" };
}

export const REVIEW_LABEL: Record<ReviewMark, string> = {
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
};

export const OBSERVATION_LABEL: Record<Observation, string> = {
  unknown: "Unknown",
  observed: "Observed",
  not_observed: "Not observed",
  not_applicable: "Not applicable",
};

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  tc2000_user: "You, in TC2000",
  sourced_fact: "Sourced fact",
  manual_note: "Your note",
};

export const EVIDENCE_SCOPE_LABEL: Record<EvidenceScope, string> = {
  symbol: "This symbol",
  macro: "Macro, not this symbol",
  user: "Your note",
};

export type Evidence = {
  id: string;
  itemId: ChecklistItemId;
  kind: EvidenceKind;
  text: string;
  recordedAt: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  publishedAt: string | null;
  eventAt: string | null;
  eventDate: string | null;
  retrievedAt: string | null;
  scope: EvidenceScope;
};

export type SetupNote = {
  lateralOrSqueeze: string;
  bandsWidening: string;
  directionalExit: string;
  candle: string;
  nearbyLineOrMa: string;
  extensionJudgment: string;
  observedAtLocal: string;
  observedAt: string | null;
  setupVersion: string;
};

export function emptySetupNote(): SetupNote {
  return {
    lateralOrSqueeze: "",
    bandsWidening: "",
    directionalExit: "",
    candle: "",
    nearbyLineOrMa: "",
    extensionJudgment: "",
    observedAtLocal: "",
    observedAt: null,
    setupVersion: "",
  };
}

export function setupNoteIsBlank(note: SetupNote): boolean {
  return (
    !note.lateralOrSqueeze.trim() &&
    !note.bandsWidening.trim() &&
    !note.directionalExit.trim() &&
    !note.candle.trim() &&
    !note.nearbyLineOrMa.trim() &&
    !note.extensionJudgment.trim() &&
    !note.observedAtLocal.trim() &&
    !note.setupVersion.trim()
  );
}

export type ChecklistSession = {
  symbol: string;
  sessionDate: string;
  reviews: Record<ChecklistItemId, ReviewMark>;
  observations: Record<ChecklistItemId, Observation>;
  reviewSetAt: Partial<Record<ChecklistItemId, string>>;
  observationSetAt: Partial<Record<ChecklistItemId, string>>;
  setup: SetupNote;
  evidence: Evidence[];
};

function marks<T extends string>(value: T): Record<ChecklistItemId, T> {
  return {
    fed_earnings: value,
    bollinger: value,
    moving_averages: value,
    trendline: value,
    gap: value,
    option_contract: value,
  };
}

export function emptyChecklist(symbol: string, sessionDate: string): ChecklistSession {
  return {
    symbol,
    sessionDate,
    reviews: marks("unreviewed"),
    observations: marks("unknown"),
    reviewSetAt: {},
    observationSetAt: {},
    setup: emptySetupNote(),
    evidence: [],
  };
}

export function withReview(
  session: ChecklistSession,
  itemId: ChecklistItemId,
  review: ReviewMark,
  at: string,
): ChecklistSession {
  return {
    ...session,
    reviews: { ...session.reviews, [itemId]: review },
    reviewSetAt: { ...session.reviewSetAt, [itemId]: at },
  };
}

export function withObservation(
  session: ChecklistSession,
  itemId: ChecklistItemId,
  observation: Observation,
  at: string,
): ChecklistSession {
  return {
    ...session,
    observations: { ...session.observations, [itemId]: observation },
    observationSetAt: { ...session.observationSetAt, [itemId]: at },
  };
}

export function withSetup(session: ChecklistSession, setup: SetupNote): ChecklistSession {
  return { ...session, setup };
}

export function withEvidence(
  session: ChecklistSession,
  evidence: Evidence,
): { session: ChecklistSession; error: string | null } {
  const item = checklistItem(evidence.itemId);
  if (!item) return { session, error: "Unknown checklist item." };
  if (!item.allowedEvidence.includes(evidence.kind)) {
    return { session, error: "That kind of evidence cannot be attached to this item." };
  }
  const text = cleanText(evidence.text, 2000).trim();
  if (!text) return { session, error: "Evidence text is empty." };
  let sourceUrl: string | null = null;
  if (evidence.sourceUrl) {
    sourceUrl = normalizeUrl(evidence.sourceUrl);
    if (!sourceUrl) return { session, error: "Evidence link must be an http or https URL." };
  }
  const eventDate = evidence.eventDate && isSessionDate(evidence.eventDate) ? evidence.eventDate : null;
  const scope: EvidenceScope =
    evidence.scope === "symbol" || evidence.scope === "macro" || evidence.scope === "user" ? evidence.scope : "user";
  const next: Evidence = {
    ...evidence,
    text,
    sourceUrl,
    sourceLabel: evidence.sourceLabel ? cleanText(evidence.sourceLabel, 200).trim() || null : null,
    eventDate,
    scope,
  };
  return {
    session: { ...session, evidence: [...session.evidence, next] },
    error: null,
  };
}

export type ChecklistSummary = {
  unreviewed: number;
  reviewed: number;
  observationUnknown: number;
  observed: number;
  notObserved: number;
  notApplicable: number;
};

export function summarizeChecklist(session: ChecklistSession): ChecklistSummary {
  const summary: ChecklistSummary = {
    unreviewed: 0,
    reviewed: 0,
    observationUnknown: 0,
    observed: 0,
    notObserved: 0,
    notApplicable: 0,
  };
  for (const id of CHECKLIST_ITEM_IDS) {
    if (session.reviews[id] === "reviewed") summary.reviewed += 1;
    else summary.unreviewed += 1;
    const observation = session.observations[id];
    if (observation === "unknown") summary.observationUnknown += 1;
    else if (observation === "observed") summary.observed += 1;
    else if (observation === "not_observed") summary.notObserved += 1;
    else summary.notApplicable += 1;
  }
  return summary;
}
