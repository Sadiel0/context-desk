import {
  isChecklistItemId,
  isObservation,
  isReviewMark,
  withEvidence,
  withObservation,
  withReview,
  withSetup,
  type Evidence,
  type Observation,
  type ReviewMark,
  type SetupNote,
} from "@/domain/checklist";
import { describeMeeting, type FedPressItem, type FomcMeeting } from "@/domain/fed-parse";
import type { SecFiling } from "@/domain/sec-parse";
import type { AggregatorHeadline, TickerSec } from "@/domain/ticker-feed";
import {
  isEarningsTiming,
  type EarningsEvent,
  type Fundamentals,
} from "@/domain/fundamentals";
import { addNewsItem, evidenceFromNews, reviseNewsItem, type NewsDraft } from "@/domain/news";
import { describeCapture, type OptionCapture } from "@/domain/options";
import {
  checklistFor,
  fundamentalsFor,
  isSpreadFormula,
  optionFor,
  sessionKey,
  type WorkspaceState,
} from "@/domain/state";
import { easternLocalToIso, isSessionDate, zonedErrorMessage } from "@/domain/time";
import { normalizeUrl } from "@/domain/urls";
import { isWatchSymbol } from "@/domain/watchlist";
import { FED_CALENDAR_URL } from "@/domain/sources";
import {
  directionKey,
  importBars,
  isSetupDirection,
  upsertBar,
  validateBar,
  type BarDraft,
} from "@/domain/participation";

export type ActionResult = {
  state: WorkspaceState;
  error: string | null;
  duplicateOfId?: string;
};

function ok(state: WorkspaceState): ActionResult {
  return { state, error: null };
}

function fail(state: WorkspaceState, error: string, duplicateOfId?: string): ActionResult {
  return { state, error, duplicateOfId };
}

export function selectSymbol(state: WorkspaceState, symbol: string): ActionResult {
  if (!isWatchSymbol(symbol)) return fail(state, "That symbol is not on the watchlist.");
  return ok({ ...state, selectedSymbol: symbol });
}

export function setSessionOverride(state: WorkspaceState, sessionDate: string | null): ActionResult {
  if (sessionDate === null) return ok({ ...state, sessionDateOverride: null });
  if (!isSessionDate(sessionDate)) return fail(state, "That session date is not a real calendar date.");
  return ok({ ...state, sessionDateOverride: sessionDate });
}

export function setSpreadFormula(state: WorkspaceState, formula: string): ActionResult {
  if (!isSpreadFormula(formula)) return fail(state, "Unknown spread formula.");
  return ok({ ...state, spreadFormula: formula });
}

export function setDemo(state: WorkspaceState, demo: boolean): ActionResult {
  return ok({ ...state, demo });
}

function putChecklist(
  state: WorkspaceState,
  symbol: string,
  sessionDate: string,
  next: ReturnType<typeof checklistFor>,
): ActionResult {
  return ok({
    ...state,
    checklists: { ...state.checklists, [sessionKey(symbol, sessionDate)]: next },
  });
}

export function setReview(
  state: WorkspaceState,
  input: { symbol: string; sessionDate: string; itemId: string; review: string; at: string },
): ActionResult {
  if (!isWatchSymbol(input.symbol) || !isSessionDate(input.sessionDate)) return fail(state, "Unknown session.");
  if (!isChecklistItemId(input.itemId) || !isReviewMark(input.review)) return fail(state, "Unknown review mark.");
  const current = checklistFor(state, input.symbol, input.sessionDate);
  return putChecklist(state, input.symbol, input.sessionDate, withReview(current, input.itemId, input.review as ReviewMark, input.at));
}

export function setObservation(
  state: WorkspaceState,
  input: { symbol: string; sessionDate: string; itemId: string; observation: string; at: string },
): ActionResult {
  if (!isWatchSymbol(input.symbol) || !isSessionDate(input.sessionDate)) return fail(state, "Unknown session.");
  if (!isChecklistItemId(input.itemId) || !isObservation(input.observation)) return fail(state, "Unknown observation.");
  const current = checklistFor(state, input.symbol, input.sessionDate);
  return putChecklist(
    state,
    input.symbol,
    input.sessionDate,
    withObservation(current, input.itemId, input.observation as Observation, input.at),
  );
}

export function setSetupNote(
  state: WorkspaceState,
  input: { symbol: string; sessionDate: string; note: SetupNote },
): ActionResult {
  if (!isWatchSymbol(input.symbol) || !isSessionDate(input.sessionDate)) return fail(state, "Unknown session.");
  let observedAt: string | null = null;
  const local = input.note.observedAtLocal.trim();
  if (local) {
    const zoned = easternLocalToIso(local);
    if (!zoned.ok) return fail(state, zonedErrorMessage(zoned.reason));
    observedAt = zoned.iso;
  }
  const current = checklistFor(state, input.symbol, input.sessionDate);
  return putChecklist(state, input.symbol, input.sessionDate, withSetup(current, { ...input.note, observedAtLocal: local, observedAt }));
}

export function addChecklistEvidence(
  state: WorkspaceState,
  input: { symbol: string; sessionDate: string; evidence: Evidence },
): ActionResult {
  if (!isWatchSymbol(input.symbol) || !isSessionDate(input.sessionDate)) return fail(state, "Unknown session.");
  const current = checklistFor(state, input.symbol, input.sessionDate);
  const result = withEvidence(current, input.evidence);
  if (result.error) return fail(state, result.error);
  return ok({
    ...state,
    checklists: { ...state.checklists, [sessionKey(input.symbol, input.sessionDate)]: result.session },
  });
}

export function attachNewsEvidence(
  state: WorkspaceState,
  input: { symbol: string; sessionDate: string; itemId: string; evidenceId: string; at: string },
): ActionResult {
  const item = state.news.find((entry) => entry.id === input.itemId);
  if (!item) return fail(state, "That item is not in the library.");
  const evidence = evidenceFromNews(item, input.evidenceId, input.at);
  if ("error" in evidence) return fail(state, evidence.error);
  return addChecklistEvidence(state, { symbol: input.symbol, sessionDate: input.sessionDate, evidence });
}

export function attachMeetingEvidence(
  state: WorkspaceState,
  input: {
    symbol: string;
    sessionDate: string;
    meeting: FomcMeeting;
    evidenceId: string;
    at: string;
    retrievedAt: string;
    lastUpdate: string | null;
  },
): ActionResult {
  const evidence: Evidence = {
    id: input.evidenceId,
    itemId: "fed_earnings",
    kind: "sourced_fact",
    text: `${describeMeeting(input.meeting)} This is a Federal Reserve calendar row, not a ${input.symbol} headline. Calendar retrieved ${input.retrievedAt}. Page last-update text: ${input.lastUpdate ?? "unknown"}.`,
    recordedAt: input.at,
    sourceUrl: FED_CALENDAR_URL,
    sourceLabel: "Federal Reserve FOMC calendar",
    publishedAt: null,
    eventAt: null,
    eventDate: input.meeting.startDate,
    retrievedAt: input.retrievedAt,
    scope: "macro",
  };
  return addChecklistEvidence(state, { symbol: input.symbol, sessionDate: input.sessionDate, evidence });
}

export function attachPressEvidence(
  state: WorkspaceState,
  input: {
    symbol: string;
    sessionDate: string;
    item: FedPressItem;
    evidenceId: string;
    at: string;
    retrievedAt: string;
  },
): ActionResult {
  const evidence: Evidence = {
    id: input.evidenceId,
    itemId: "fed_earnings",
    kind: "sourced_fact",
    text: `${input.item.title}. Federal Reserve monetary-policy feed. Not a ${input.symbol} headline. Article body was not retrieved.`,
    recordedAt: input.at,
    sourceUrl: input.item.url,
    sourceLabel: "Federal Reserve monetary-policy feed",
    publishedAt: input.item.publishedAt,
    eventAt: null,
    eventDate: null,
    retrievedAt: input.retrievedAt,
    scope: "macro",
  };
  return addChecklistEvidence(state, { symbol: input.symbol, sessionDate: input.sessionDate, evidence });
}

export function attachHeadlineEvidence(
  state: WorkspaceState,
  input: {
    symbol: string;
    sessionDate: string;
    item: AggregatorHeadline;
    querySymbol: string;
    evidenceId: string;
    at: string;
    retrievedAt: string;
  },
): ActionResult {
  if (input.item.mention !== "names_symbol") {
    return fail(state, "A headline that does not name the symbol is not attached as symbol evidence.");
  }
  const evidence: Evidence = {
    id: input.evidenceId,
    itemId: "fed_earnings",
    kind: "sourced_fact",
    text: `${input.item.title}. Yahoo Finance aggregator headline feed, query ${input.querySymbol}. Link host ${input.item.linkHost}. This is not the publisher and not a quote from this desk. The feed summary was not copied.`,
    recordedAt: input.at,
    sourceUrl: input.item.url,
    sourceLabel: "Yahoo Finance symbol RSS (aggregator)",
    publishedAt: input.item.publishedAt,
    eventAt: null,
    eventDate: null,
    retrievedAt: input.retrievedAt,
    scope: "symbol",
  };
  return addChecklistEvidence(state, { symbol: input.symbol, sessionDate: input.sessionDate, evidence });
}

export function attachFilingEvidence(
  state: WorkspaceState,
  input: {
    symbol: string;
    sessionDate: string;
    filing: SecFiling;
    sec: TickerSec;
    evidenceId: string;
    at: string;
    retrievedAt: string;
  },
): ActionResult {
  if (input.sec.state !== "confirmed" && input.sec.state !== "name_match") {
    return fail(state, "No confirmed SEC filing is available to attach.");
  }
  const match =
    input.sec.state === "confirmed"
      ? `SEC tickers field includes ${input.symbol}.`
      : `Name match only. The SEC tickers field did not confirm ${input.symbol}.`;
  const evidence: Evidence = {
    id: input.evidenceId,
    itemId: "fed_earnings",
    kind: "sourced_fact",
    text: `${input.filing.form}. ${input.sec.name ?? "Issuer"}. ${match} Filing date ${input.filing.filingDate ?? "Unknown"} is a date, not the business-event clock. SEC acceptance ${input.filing.acceptanceAt ?? "Unknown"}. Not a news article and not an analyst target.`,
    recordedAt: input.at,
    sourceUrl: input.filing.indexUrl,
    sourceLabel: "SEC EDGAR submissions",
    publishedAt: input.filing.acceptanceAt,
    eventAt: null,
    eventDate: input.filing.filingDate,
    retrievedAt: input.retrievedAt,
    scope: "symbol",
  };
  return addChecklistEvidence(state, { symbol: input.symbol, sessionDate: input.sessionDate, evidence });
}

export function attachCaptureEvidence(
  state: WorkspaceState,
  input: { symbol: string; sessionDate: string; evidenceId: string; at: string },
): ActionResult {
  const capture = optionFor(state, input.symbol, input.sessionDate);
  const evidence: Evidence = {
    id: input.evidenceId,
    itemId: "option_contract",
    kind: "manual_note",
    text: describeCapture(capture, input.symbol, state.spreadFormula),
    recordedAt: input.at,
    sourceUrl: null,
    sourceLabel: capture.sourceName.trim() || null,
    publishedAt: null,
    eventAt: null,
    eventDate: null,
    retrievedAt: null,
    scope: "user",
  };
  return addChecklistEvidence(state, { symbol: input.symbol, sessionDate: input.sessionDate, evidence });
}

export function resetSession(state: WorkspaceState, symbol: string, sessionDate: string): ActionResult {
  if (!isWatchSymbol(symbol) || !isSessionDate(sessionDate)) return fail(state, "Unknown session.");
  const key = sessionKey(symbol, sessionDate);
  const checklists = { ...state.checklists };
  const options = { ...state.options };
  const directions = { ...state.participation.directions };
  delete checklists[key];
  delete options[key];
  delete directions[key];
  return ok({ ...state, checklists, options, participation: { ...state.participation, directions } });
}

export function setSetupDirection(
  state: WorkspaceState,
  symbol: string,
  sessionDate: string,
  direction: string,
): ActionResult {
  if (!isWatchSymbol(symbol) || !isSessionDate(sessionDate)) return fail(state, "Unknown session.");
  if (!isSetupDirection(direction)) return fail(state, "Direction must be unset, call/up, or put/down.");
  return ok({
    ...state,
    participation: {
      ...state.participation,
      directions: { ...state.participation.directions, [directionKey(symbol, sessionDate)]: direction },
    },
  });
}

export function saveParticipationBar(state: WorkspaceState, draft: BarDraft): ActionResult {
  const validated = validateBar(draft);
  if (!validated.ok) return fail(state, validated.error);
  const bars = upsertBar(state.participation.bars, validated.bar).slice(-500);
  return ok({ ...state, participation: { ...state.participation, bars } });
}

export function removeParticipationBar(state: WorkspaceState, id: string): ActionResult {
  return ok({
    ...state,
    participation: { ...state.participation, bars: state.participation.bars.filter((bar) => bar.id !== id) },
  });
}

export function importParticipationBars(state: WorkspaceState, raw: unknown): ActionResult {
  const imported = importBars(raw);
  if (imported.bars.length === 0) {
    return fail(state, imported.errors[0] ?? "No bars were imported.");
  }
  let bars = state.participation.bars;
  for (const bar of imported.bars) bars = upsertBar(bars, bar);
  const next = { ...state, participation: { ...state.participation, bars: bars.slice(-500) } };
  if (imported.errors.length) return fail(next, imported.errors.join(" "));
  return ok(next);
}

export function saveNews(state: WorkspaceState, draft: NewsDraft, mode: "primary" | "duplicate" | "correction"): ActionResult {
  const result = addNewsItem(state.news, draft, mode);
  if (!result.ok) return fail(state, result.error, result.duplicateOfId);
  return ok({ ...state, news: result.items });
}

export function reviseNews(state: WorkspaceState, id: string, draft: NewsDraft): ActionResult {
  const result = reviseNewsItem(state.news, id, draft);
  if (!result.ok) return fail(state, result.error, result.duplicateOfId);
  return ok({ ...state, news: result.items });
}

export function setFundamentals(state: WorkspaceState, symbol: string, fundamentals: Fundamentals): ActionResult {
  if (!fundamentalsFor(state, symbol)) return fail(state, "That symbol is not on the watchlist.");
  return ok({ ...state, fundamentals: { ...state.fundamentals, [symbol]: fundamentals } });
}

export function addEarnings(state: WorkspaceState, event: EarningsEvent): ActionResult {
  if (!isWatchSymbol(event.symbol)) return fail(state, "That symbol is not on the watchlist.");
  if (!isEarningsTiming(event.timing)) return fail(state, "Unknown earnings timing.");
  if (event.eventDate && !isSessionDate(event.eventDate)) return fail(state, "Earnings date is not a real calendar date.");
  let sourceUrl: string | null = null;
  if (event.sourceUrl) {
    sourceUrl = normalizeUrl(event.sourceUrl);
    if (!sourceUrl) return fail(state, "Earnings link must be an http or https URL.");
  }
  return ok({ ...state, earnings: [...state.earnings, { ...event, sourceUrl }] });
}

export function removeEarnings(state: WorkspaceState, id: string): ActionResult {
  return ok({ ...state, earnings: state.earnings.filter((event) => event.id !== id) });
}

export function setOptionCapture(
  state: WorkspaceState,
  symbol: string,
  sessionDate: string,
  capture: OptionCapture,
  at: string,
): ActionResult {
  if (!isWatchSymbol(symbol) || !isSessionDate(sessionDate)) return fail(state, "Unknown session.");
  return ok({
    ...state,
    options: {
      ...state.options,
      [sessionKey(symbol, sessionDate)]: { ...capture, updatedAt: at },
    },
  });
}
