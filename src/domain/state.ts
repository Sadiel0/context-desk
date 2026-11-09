import { emptyChecklist, type ChecklistSession } from "@/domain/checklist";
import { emptyFundamentals, type EarningsEvent, type Fundamentals } from "@/domain/fundamentals";
import type { NewsItem } from "@/domain/news";
import { emptyOptionCapture, type OptionCapture, type SpreadFormula } from "@/domain/options";
import { emptyParticipation, type ParticipationBook } from "@/domain/participation";
import { isSessionDate, sessionDateET } from "@/domain/time";
import { instrumentFor, isWatchSymbol } from "@/domain/watchlist";

export const WORKSPACE_VERSION = 1 as const;

export type WorkspaceState = {
  version: typeof WORKSPACE_VERSION;
  selectedSymbol: string;
  sessionDateOverride: string | null;
  spreadFormula: SpreadFormula;
  demo: boolean;
  checklists: Record<string, ChecklistSession>;
  news: NewsItem[];
  fundamentals: Record<string, Fundamentals>;
  earnings: EarningsEvent[];
  options: Record<string, OptionCapture>;
  participation: ParticipationBook;
};

export function initialWorkspace(): WorkspaceState {
  return {
    version: WORKSPACE_VERSION,
    selectedSymbol: "TSLA",
    sessionDateOverride: null,
    spreadFormula: "mid",
    demo: false,
    checklists: {},
    news: [],
    fundamentals: {},
    earnings: [],
    options: {},
    participation: emptyParticipation(),
  };
}

export function sessionKey(symbol: string, sessionDate: string): string {
  return `${symbol}|${sessionDate}`;
}

export function resolveSessionDate(state: WorkspaceState, now: Date): string {
  if (state.sessionDateOverride && isSessionDate(state.sessionDateOverride)) return state.sessionDateOverride;
  return sessionDateET(now);
}

export function checklistFor(state: WorkspaceState, symbol: string, sessionDate: string): ChecklistSession {
  return state.checklists[sessionKey(symbol, sessionDate)] ?? emptyChecklist(symbol, sessionDate);
}

export function optionFor(state: WorkspaceState, symbol: string, sessionDate: string): OptionCapture {
  return state.options[sessionKey(symbol, sessionDate)] ?? emptyOptionCapture();
}

export function fundamentalsFor(state: WorkspaceState, symbol: string): Fundamentals | null {
  const instrument = instrumentFor(symbol);
  if (!instrument) return null;
  return state.fundamentals[symbol] ?? emptyFundamentals(instrument);
}

export function isSpreadFormula(value: string): value is SpreadFormula {
  return value === "mid" || value === "ask" || value === "bid";
}

export function assertWatchSymbol(symbol: string): string | null {
  return isWatchSymbol(symbol) ? symbol : null;
}
