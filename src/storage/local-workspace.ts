import {
  emptyChecklist,
  emptySetupNote,
  isChecklistItemId,
  isLegacyChecklistStatus,
  isObservation,
  isReviewMark,
  migrateLegacyStatus,
  type ChecklistItemId,
  type ChecklistSession,
  type Evidence,
  type EvidenceKind,
  type EvidenceScope,
  type SetupNote,
} from "@/domain/checklist";
import {
  isEarningsTiming,
  type EarningsEvent,
  type EarningsTiming,
  type Fundamentals,
} from "@/domain/fundamentals";
import type { NewsItem, Relevance, Stance, XContext } from "@/domain/news";
import { listUnknowns } from "@/domain/news";
import { emptyOptionCapture, type OptionCapture, type OptionRight } from "@/domain/options";
import { initialWorkspace, isSpreadFormula, type WorkspaceState } from "@/domain/state";
import { cleanText } from "@/domain/text";
import { isSessionDate } from "@/domain/time";
import { normalizeUrl } from "@/domain/urls";
import { isWatchSymbol } from "@/domain/watchlist";

export const STORAGE_KEY = "context-desk.workspace.v1";
const MAX_ITEMS = 500;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { ok: true; state: WorkspaceState }
  | { ok: false; message: string };

const UNREADABLE = "Saved workspace data could not be read. It was left untouched.";

export function loadWorkspace(store: KeyValueStore): LoadResult {
  const raw = store.getItem(STORAGE_KEY);
  if (raw === null || raw.trim() === "") return { ok: true, state: initialWorkspace() };
  try {
    const state = parseWorkspace(JSON.parse(raw) as unknown);
    if (!state) return { ok: false, message: UNREADABLE };
    return { ok: true, state };
  } catch {
    return { ok: false, message: UNREADABLE };
  }
}

export function saveWorkspace(store: KeyValueStore, state: WorkspaceState): void {
  store.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? cleanText(value, max) : "";
}

function asUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return normalizeUrl(value);
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseWorkspace(raw: unknown): WorkspaceState | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  if (!Array.isArray(raw.news) || raw.news.length > MAX_ITEMS) return null;
  if (!Array.isArray(raw.earnings) || raw.earnings.length > MAX_ITEMS) return null;
  if (!isRecord(raw.checklists) || !isRecord(raw.fundamentals) || !isRecord(raw.options)) return null;

  const news: NewsItem[] = [];
  for (const entry of raw.news) {
    const item = sanitizeNews(entry);
    if (item) news.push(item);
  }

  const checklists: WorkspaceState["checklists"] = {};
  for (const [key, value] of Object.entries(raw.checklists)) {
    const session = sanitizeChecklist(key, value);
    if (session) checklists[key] = session;
  }

  const fundamentals: WorkspaceState["fundamentals"] = {};
  for (const [symbol, value] of Object.entries(raw.fundamentals)) {
    if (!isWatchSymbol(symbol)) continue;
    const cleaned = sanitizeFundamentals(value);
    if (cleaned) fundamentals[symbol] = cleaned;
  }

  const options: WorkspaceState["options"] = {};
  for (const [key, value] of Object.entries(raw.options)) {
    const [symbol, sessionDate] = key.split("|");
    if (!symbol || !sessionDate || !isWatchSymbol(symbol) || !isSessionDate(sessionDate)) continue;
    options[key] = sanitizeCapture(value);
  }

  const earnings: EarningsEvent[] = [];
  for (const entry of raw.earnings) {
    const event = sanitizeEarnings(entry);
    if (event) earnings.push(event);
  }

  const selected = typeof raw.selectedSymbol === "string" && isWatchSymbol(raw.selectedSymbol) ? raw.selectedSymbol : "TSLA";
  const override = typeof raw.sessionDateOverride === "string" && isSessionDate(raw.sessionDateOverride)
    ? raw.sessionDateOverride
    : null;

  return {
    version: 1,
    selectedSymbol: selected,
    sessionDateOverride: override,
    spreadFormula: typeof raw.spreadFormula === "string" && isSpreadFormula(raw.spreadFormula) ? raw.spreadFormula : "mid",
    demo: raw.demo === true,
    checklists,
    news,
    fundamentals,
    earnings,
    options,
  };
}

function sanitizeNews(raw: unknown): NewsItem | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.headline !== "string") return null;
  const relevance: Relevance = raw.relevance === "direct" || raw.relevance === "inferred" || raw.relevance === "unknown"
    ? raw.relevance
    : "unknown";
  const stanceOk = raw.interpretation && isRecord(raw.interpretation) && typeof raw.interpretation.note === "string"
    && (raw.interpretation.stance === "bullish" || raw.interpretation.stance === "bearish" || raw.interpretation.stance === "mixed" || raw.interpretation.stance === "unclear");
  const interpretation = stanceOk && isRecord(raw.interpretation)
    ? { stance: raw.interpretation.stance as Stance, note: cleanText(String(raw.interpretation.note), 2000).trim() }
    : null;
  const symbols = Array.isArray(raw.symbols) ? raw.symbols.filter((symbol): symbol is string => typeof symbol === "string" && isWatchSymbol(symbol)) : [];
  const item: NewsItem = {
    id: cleanText(raw.id, 80),
    demo: raw.demo === true,
    sourceId: asText(raw.sourceId, 40) || "manual",
    sourceLabel: asText(raw.sourceLabel, 120) || "Manual capture",
    url: asUrl(raw.url),
    author: asText(raw.author, 160).trim() || null,
    headline: cleanText(raw.headline, 400).trim(),
    quote: asText(raw.quote, 4000).trim() || null,
    publishedAt: asIso(raw.publishedAt),
    eventAt: asIso(raw.eventAt),
    ingestedAt: asIso(raw.ingestedAt) ?? new Date(0).toISOString(),
    revisions: sanitizeRevisions(raw.revisions),
    unknowns: [],
    symbols,
    relevance,
    relevanceNote: asText(raw.relevanceNote, 2000).trim() || null,
    extractedFact: asText(raw.extractedFact, 2000).trim() || null,
    interpretation: interpretation && interpretation.note ? interpretation : null,
    rumor: raw.rumor === true,
    uncertainAttribution: raw.uncertainAttribution === true,
    x: sanitizeX(raw.x),
    correctionOfId: asText(raw.correctionOfId, 80).trim() || null,
    correctedById: asText(raw.correctedById, 80).trim() || null,
    duplicateOfId: asText(raw.duplicateOfId, 80).trim() || null,
  };
  if (!item.id || !item.headline) return null;
  item.unknowns = listUnknowns(item);
  return item;
}

function sanitizeRevisions(raw: unknown): NewsItem["revisions"] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.summary !== "string") return [];
    return [{ at: asIso(entry.at) ?? new Date(0).toISOString(), summary: cleanText(entry.summary, 400) }];
  });
}

function sanitizeX(raw: unknown): XContext | null {
  if (!isRecord(raw) || typeof raw.displayName !== "string" || !raw.displayName.trim()) return null;
  const handle = asText(raw.handle, 80).trim() || null;
  return {
    displayName: cleanText(raw.displayName, 120).trim(),
    handle,
    numericId: asText(raw.numericId, 40).trim() || null,
    identityStatus: "pending_verification",
    quotedText: asText(raw.quotedText, 2000).trim() || null,
    repostContext: asText(raw.repostContext, 2000).trim() || null,
    handleNote: handle ? "Typed by you. Not verified against an X id." : "Not provided. Not verified.",
  };
}

function sanitizeChecklist(key: string, raw: unknown): ChecklistSession | null {
  const [symbol, sessionDate] = key.split("|");
  if (!symbol || !sessionDate || !isWatchSymbol(symbol) || !isSessionDate(sessionDate) || !isRecord(raw)) return null;
  const base = emptyChecklist(symbol, sessionDate);
  const reviews = { ...base.reviews };
  const observations = { ...base.observations };
  const hasNewMarks = isRecord(raw.reviews) || isRecord(raw.observations);
  if (hasNewMarks) {
    for (const id of Object.keys(base.reviews) as ChecklistItemId[]) {
      const review = isRecord(raw.reviews) ? raw.reviews[id] : undefined;
      const observation = isRecord(raw.observations) ? raw.observations[id] : undefined;
      reviews[id] = typeof review === "string" && isReviewMark(review) ? review : "unreviewed";
      observations[id] = typeof observation === "string" && isObservation(observation) ? observation : "unknown";
    }
  } else if (isRecord(raw.statuses)) {
    for (const id of Object.keys(base.reviews) as ChecklistItemId[]) {
      const value = raw.statuses[id];
      const legacy = typeof value === "string" && isLegacyChecklistStatus(value) ? value : "unknown";
      const migrated = migrateLegacyStatus(id, legacy);
      reviews[id] = migrated.review;
      observations[id] = migrated.observation;
    }
  }
  const reviewSetAt: ChecklistSession["reviewSetAt"] = {};
  const observationSetAt: ChecklistSession["observationSetAt"] = {};
  const stampSource = isRecord(raw.reviewSetAt) ? raw.reviewSetAt : isRecord(raw.statusSetAt) ? raw.statusSetAt : null;
  if (stampSource) {
    for (const id of Object.keys(base.reviews) as ChecklistItemId[]) {
      const value = asIso(stampSource[id]);
      if (value) reviewSetAt[id] = value;
    }
  }
  if (isRecord(raw.observationSetAt)) {
    for (const id of Object.keys(base.reviews) as ChecklistItemId[]) {
      const value = asIso(raw.observationSetAt[id]);
      if (value) observationSetAt[id] = value;
    }
  }
  const evidence: Evidence[] = [];
  if (Array.isArray(raw.evidence)) {
    if (raw.evidence.length > 200) return null;
    for (const entry of raw.evidence) {
      const cleaned = sanitizeEvidence(entry);
      if (cleaned) evidence.push(cleaned);
    }
  }
  return {
    symbol,
    sessionDate,
    reviews,
    observations,
    reviewSetAt,
    observationSetAt,
    setup: sanitizeSetup(raw.setup),
    evidence,
  };
}

function sanitizeSetup(raw: unknown): SetupNote {
  const empty = emptySetupNote();
  if (!isRecord(raw)) return empty;
  const local = typeof raw.observedAtLocal === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw.observedAtLocal)
    ? raw.observedAtLocal
    : "";
  return {
    lateralOrSqueeze: asText(raw.lateralOrSqueeze, 400),
    bandsWidening: asText(raw.bandsWidening, 400),
    directionalExit: asText(raw.directionalExit, 400),
    candle: asText(raw.candle, 400),
    nearbyLineOrMa: asText(raw.nearbyLineOrMa, 400),
    extensionJudgment: asText(raw.extensionJudgment, 400),
    observedAtLocal: local,
    observedAt: asIso(raw.observedAt),
    setupVersion: asText(raw.setupVersion, 80),
  };
}

function sanitizeEvidence(raw: unknown): Evidence | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.text !== "string") return null;
  if (typeof raw.itemId !== "string" || !isChecklistItemId(raw.itemId)) return null;
  const kind = raw.kind === "tc2000_user" || raw.kind === "sourced_fact" || raw.kind === "manual_note" ? raw.kind : null;
  if (!kind) return null;
  const allowed = allowedKind(raw.itemId, kind);
  if (!allowed) return null;
  const text = cleanText(raw.text, 2000).trim();
  if (!text) return null;
  const scope: EvidenceScope = raw.scope === "symbol" || raw.scope === "macro" || raw.scope === "user" ? raw.scope : "user";
  const eventDate = typeof raw.eventDate === "string" && isSessionDate(raw.eventDate) ? raw.eventDate : null;
  return {
    id: cleanText(raw.id, 80),
    itemId: raw.itemId,
    kind,
    text,
    recordedAt: asIso(raw.recordedAt) ?? new Date(0).toISOString(),
    sourceUrl: asUrl(raw.sourceUrl),
    sourceLabel: asText(raw.sourceLabel, 200).trim() || null,
    publishedAt: asIso(raw.publishedAt),
    eventAt: asIso(raw.eventAt),
    eventDate,
    retrievedAt: asIso(raw.retrievedAt),
    scope,
  };
}

function allowedKind(itemId: ChecklistItemId, kind: EvidenceKind): boolean {
  if (itemId === "fed_earnings") return kind === "sourced_fact" || kind === "manual_note";
  if (itemId === "gap") return kind === "tc2000_user" || kind === "manual_note";
  if (itemId === "option_contract") return kind === "manual_note";
  return kind === "tc2000_user";
}

function sanitizeFundamentals(raw: unknown): Fundamentals | null {
  if (!isRecord(raw)) return null;
  return {
    displayName: asText(raw.displayName, 160),
    indexMembership: asText(raw.indexMembership, 400),
    marketCap: asText(raw.marketCap, 400),
    marketCapSourceUrl: asUrl(raw.marketCapSourceUrl),
    analystFirm: asText(raw.analystFirm, 160),
    analystName: asText(raw.analystName, 160),
    analystTarget: asText(raw.analystTarget, 160),
    analystTargetDate: asText(raw.analystTargetDate, 40),
    analystHorizon: asText(raw.analystHorizon, 160),
    analystSourceUrl: asUrl(raw.analystSourceUrl),
    stockRecommendation: asText(raw.stockRecommendation, 400),
    recommendationDate: asText(raw.recommendationDate, 40),
    recommendationSourceUrl: asUrl(raw.recommendationSourceUrl),
    insiderContext: asText(raw.insiderContext, 2000),
    contextNote: asText(raw.contextNote, 2000),
  };
}

function sanitizeCapture(raw: unknown): OptionCapture {
  const empty = emptyOptionCapture();
  if (!isRecord(raw)) return empty;
  const right: OptionRight = raw.right === "call" || raw.right === "put" ? raw.right : "unknown";
  return {
    root: asText(raw.root, 16),
    right,
    strike: asText(raw.strike, 16),
    expiry: asText(raw.expiry, 16),
    bid: asText(raw.bid, 16),
    ask: asText(raw.ask, 16),
    debit: asText(raw.debit, 16),
    contracts: asText(raw.contracts, 8),
    multiplier: asText(raw.multiplier, 8),
    multiplierNote: asText(raw.multiplierNote, 200),
    sourceName: asText(raw.sourceName, 160),
    sourceTimestampLocal: asText(raw.sourceTimestampLocal, 20),
    feedDelay: asText(raw.feedDelay, 160),
    feeEntryOpen: raw.feeEntryOpen === true,
    userEnteredFee: asText(raw.userEnteredFee, 16),
    targetReturnPct: asText(raw.targetReturnPct, 8),
    estimatedStopRisk: asText(raw.estimatedStopRisk, 16),
    updatedAt: asIso(raw.updatedAt),
  };
}

function sanitizeEarnings(raw: unknown): EarningsEvent | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.symbol !== "string" || !isWatchSymbol(raw.symbol)) return null;
  const timing: EarningsTiming = typeof raw.timing === "string" && isEarningsTiming(raw.timing) ? raw.timing : "unspecified";
  const eventDate = typeof raw.eventDate === "string" && isSessionDate(raw.eventDate) ? raw.eventDate : "";
  return {
    id: cleanText(raw.id, 80),
    symbol: raw.symbol,
    eventDate,
    timing,
    clockTimeNote: asText(raw.clockTimeNote, 200),
    sourceUrl: asUrl(raw.sourceUrl),
    sourceLabel: asText(raw.sourceLabel, 120),
    note: asText(raw.note, 2000),
    recordedAt: asIso(raw.recordedAt) ?? new Date(0).toISOString(),
  };
}
