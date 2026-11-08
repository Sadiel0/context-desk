import { isChecklistItemId, isChecklistStatus, withEvidence, withStatus, type Evidence } from "@/domain/checklist";
import { describeMeeting, type FomcMeeting } from "@/domain/fed-parse";
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
import { isSessionDate } from "@/domain/time";
import { normalizeUrl } from "@/domain/urls";
import { isWatchSymbol } from "@/domain/watchlist";
import { FED_CALENDAR_URL } from "@/domain/sources";

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

export function setChecklistStatus(
  state: WorkspaceState,
  input: { symbol: string; sessionDate: string; itemId: string; status: string; at: string },
): ActionResult {
  if (!isWatchSymbol(input.symbol) || !isSessionDate(input.sessionDate)) return fail(state, "Unknown session.");
  if (!isChecklistItemId(input.itemId) || !isChecklistStatus(input.status)) return fail(state, "Unknown checklist status.");
  const current = checklistFor(state, input.symbol, input.sessionDate);
  const next = withStatus(current, input.itemId, input.status, input.at);
  return ok({
    ...state,
    checklists: { ...state.checklists, [sessionKey(input.symbol, input.sessionDate)]: next },
  });
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
    text: `${describeMeeting(input.meeting)} Calendar retrieved ${input.retrievedAt}. Page last-update text: ${input.lastUpdate ?? "unknown"}.`,
    recordedAt: input.at,
    sourceUrl: FED_CALENDAR_URL,
    sourceLabel: "Federal Reserve FOMC calendar",
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
  };
  return addChecklistEvidence(state, { symbol: input.symbol, sessionDate: input.sessionDate, evidence });
}

export function resetSession(state: WorkspaceState, symbol: string, sessionDate: string): ActionResult {
  if (!isWatchSymbol(symbol) || !isSessionDate(sessionDate)) return fail(state, "Unknown session.");
  const key = sessionKey(symbol, sessionDate);
  const checklists = { ...state.checklists };
  const options = { ...state.options };
  delete checklists[key];
  delete options[key];
  return ok({ ...state, checklists, options });
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
