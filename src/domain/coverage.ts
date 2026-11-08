import type { EarningsEvent } from "@/domain/fundamentals";
import { EARNINGS_TIMING_LABEL } from "@/domain/fundamentals";
import { relateMeetings, type FomcMeeting } from "@/domain/fed-parse";
import { classifyFreshness } from "@/domain/freshness";
import { groupNews, type NewsItem } from "@/domain/news";

export const TICKER_COVERAGE =
  "Ticker news coverage: Unknown. No company news feed is connected. An empty list is not a report of no catalysts.";

export function partitionDirect(
  items: NewsItem[],
  symbol: string,
  now: Date,
  demo: boolean,
  flags?: { showCorrectedOriginals?: boolean; showDuplicates?: boolean },
): {
  recent: NewsItem[];
  history: NewsItem[];
} {
  const groups = groupNews(items, {
    symbol,
    includeInferred: false,
    sourceId: "all",
    showCorrectedOriginals: flags?.showCorrectedOriginals === true,
    showDuplicates: flags?.showDuplicates === true,
    demo,
  });
  const recent: NewsItem[] = [];
  const history: NewsItem[] = [];
  for (const item of groups.direct) {
    const reading = classifyFreshness(item.publishedAt, item.eventAt, now);
    if (reading.freshness === "stale") history.push(item);
    else recent.push(item);
  }
  return { recent, history };
}

export type NextSymbolEvent =
  | { state: "unknown" }
  | {
      state: "recorded";
      date: string;
      timingLabel: string;
      clockKnown: boolean;
      clockNote: string;
    };

export function nextSymbolEvent(earnings: EarningsEvent[], symbol: string, sessionDate: string): NextSymbolEvent {
  const upcoming = earnings
    .filter((event) => event.symbol === symbol && event.eventDate && event.eventDate >= sessionDate)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const event = upcoming[0];
  if (!event) return { state: "unknown" };
  const clockNote = event.clockTimeNote.trim();
  return {
    state: "recorded",
    date: event.eventDate,
    timingLabel: EARNINGS_TIMING_LABEL[event.timing],
    clockKnown: clockNote.length > 0,
    clockNote,
  };
}

export type NextFomc =
  | { state: "unknown"; reason: string }
  | {
      state: "dated";
      meeting: FomcMeeting;
      label: string;
    };

export function nextFomcDate(meetings: FomcMeeting[], sessionDate: string, calendarError: string | null): NextFomc {
  if (calendarError) return { state: "unknown", reason: calendarError };
  if (meetings.length === 0) return { state: "unknown", reason: "No FOMC rows were read." };
  const relation = relateMeetings(meetings, sessionDate);
  const meeting = relation.onSession[0] ?? relation.next;
  if (!meeting?.startDate) return { state: "unknown", reason: "No later dated FOMC row was parsed." };
  const label =
    meeting.endDate && meeting.endDate !== meeting.startDate
      ? `${meeting.startDate} to ${meeting.endDate}`
      : meeting.startDate;
  return { state: "dated", meeting, label };
}
