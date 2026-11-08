import { BOLLINGER_ADAPTATION } from "@/domain/limits";
import { cleanText } from "@/domain/text";
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
export type ChecklistStatus = "confirmed" | "not_met" | "unknown" | "not_applicable";
export type EvidenceKind = "tc2000_user" | "sourced_fact" | "manual_note";

export type ChecklistItem = {
  id: ChecklistItemId;
  title: string;
  question: string;
  detail: string;
  provenance: string;
  allowedEvidence: readonly EvidenceKind[];
};

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = [
  {
    id: "fed_earnings",
    title: "Fed meetings and earnings",
    question: "Have you checked Fed meetings and earnings for this session?",
    detail:
      "Confirmed means the check is done, not that a meeting or a report exists. A meeting date does not establish the statement time. Before-open and after-close marks are not clock times. Record the facts, then set the status yourself.",
    provenance: "Sourced fact or your note. Not TC2000.",
    allowedEvidence: ["sourced_fact", "manual_note"],
  },
  {
    id: "bollinger",
    title: "Bollinger Bands, 15-minute, hour, and day",
    question: "Do the 15-minute, hour, and day Bollinger Bands in TC2000 match the condition you use?",
    detail: `TC2000 is the source. This desk does not read bands or candles and does not mark this item for you. ${BOLLINGER_ADAPTATION}`,
    provenance: "You confirm this in TC2000.",
    allowedEvidence: ["tc2000_user"],
  },
  {
    id: "moving_averages",
    title: "Moving averages, hour and day",
    question: "Do the hour and day moving averages in TC2000 match the condition you require?",
    detail: "TC2000 is the source. This desk does not calculate moving averages and does not mark this item for you.",
    provenance: "You confirm this in TC2000.",
    allowedEvidence: ["tc2000_user"],
  },
  {
    id: "trendline",
    title: "Trendline breakout",
    question: "Do you see a trendline breakout on your TC2000 chart?",
    detail: "TC2000 is the source. This desk does not draw trendlines and does not mark this item for you.",
    provenance: "You confirm this in TC2000.",
    allowedEvidence: ["tc2000_user"],
  },
  {
    id: "gap",
    title: "Gap up or down",
    question: "If this strategy uses a gap, is that gap present?",
    detail:
      "A gap is strategy-dependent. It is not a universal gate. Choose Not applicable when this strategy does not use the gap. This desk does not detect gaps from prices.",
    provenance: "You confirm this in TC2000, or you note why it does not apply.",
    allowedEvidence: ["tc2000_user", "manual_note"],
  },
  {
    id: "option_contract",
    title: "Option price, bid, ask, and expiration",
    question: "Is the exact contract recorded, including root, expiry, bid, ask, and source time?",
    detail:
      "Enter the contract in the capture panel. Unknown quotes stay unknown. Fees and ticks stay unknown unless you type a fee you saw. Attaching a snapshot does not set this status.",
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

export function isChecklistStatus(value: string): value is ChecklistStatus {
  return value === "confirmed" || value === "not_met" || value === "unknown" || value === "not_applicable";
}

export const STATUS_LABEL: Record<ChecklistStatus, string> = {
  confirmed: "Confirmed",
  not_met: "Not met",
  unknown: "Unknown",
  not_applicable: "Not applicable",
};

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  tc2000_user: "You, in TC2000",
  sourced_fact: "Sourced fact",
  manual_note: "Your note",
};

export type Evidence = {
  id: string;
  itemId: ChecklistItemId;
  kind: EvidenceKind;
  text: string;
  recordedAt: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
};

export type ChecklistSession = {
  symbol: string;
  sessionDate: string;
  statuses: Record<ChecklistItemId, ChecklistStatus>;
  statusSetAt: Partial<Record<ChecklistItemId, string>>;
  evidence: Evidence[];
};

export function emptyChecklist(symbol: string, sessionDate: string): ChecklistSession {
  return {
    symbol,
    sessionDate,
    statuses: {
      fed_earnings: "unknown",
      bollinger: "unknown",
      moving_averages: "unknown",
      trendline: "unknown",
      gap: "unknown",
      option_contract: "unknown",
    },
    statusSetAt: {},
    evidence: [],
  };
}

export function withStatus(
  session: ChecklistSession,
  itemId: ChecklistItemId,
  status: ChecklistStatus,
  at: string,
): ChecklistSession {
  return {
    ...session,
    statuses: { ...session.statuses, [itemId]: status },
    statusSetAt: { ...session.statusSetAt, [itemId]: at },
  };
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
  const next: Evidence = {
    ...evidence,
    text,
    sourceUrl,
    sourceLabel: evidence.sourceLabel ? cleanText(evidence.sourceLabel, 200).trim() || null : null,
  };
  return {
    session: { ...session, evidence: [...session.evidence, next] },
    error: null,
  };
}

export type ChecklistSummary = Record<ChecklistStatus, number>;

export function summarizeChecklist(session: ChecklistSession): ChecklistSummary {
  const summary: ChecklistSummary = { confirmed: 0, not_met: 0, unknown: 0, not_applicable: 0 };
  for (const id of CHECKLIST_ITEM_IDS) summary[session.statuses[id]] += 1;
  return summary;
}
