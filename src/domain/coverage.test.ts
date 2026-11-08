import { describe, expect, it } from "vitest";
import { nextFomcDate, nextSymbolEvent, partitionDirect, TICKER_COVERAGE } from "@/domain/coverage";
import { titleBadge } from "@/domain/freshness";
import type { NewsItem } from "@/domain/news";
import type { FomcMeeting } from "@/domain/fed-parse";

function item(partial: Partial<NewsItem> & Pick<NewsItem, "id" | "headline" | "relevance">): NewsItem {
  return {
    demo: false,
    sourceId: "manual",
    sourceLabel: "Manual",
    url: `https://example.com/${partial.id}`,
    author: null,
    quote: null,
    publishedAt: "2026-11-08T17:00:00.000Z",
    eventAt: null,
    ingestedAt: "2026-11-08T17:05:00.000Z",
    revisions: [],
    unknowns: [],
    symbols: ["TSLA"],
    relevanceNote: partial.relevance === "inferred" ? "Rates, not the company." : null,
    extractedFact: null,
    interpretation: null,
    rumor: false,
    uncertainAttribution: false,
    x: null,
    correctionOfId: null,
    correctedById: null,
    duplicateOfId: null,
    ...partial,
  };
}

const meeting: FomcMeeting = {
  year: 2026,
  month: 12,
  monthLabel: "December",
  startDay: 8,
  endDay: 9,
  startDate: "2026-12-08",
  endDate: "2026-12-09",
  sep: true,
  statementUrl: null,
  minutesNote: null,
  dateWarning: null,
};

describe("coverage and freshness labels", () => {
  const now = new Date("2026-11-08T18:00:00.000Z");

  it("sends stale direct items to history and keeps inferred items out of the ticker list", () => {
    const items = [
      item({ id: "new", headline: "Fresh direct", relevance: "direct" }),
      item({ id: "old", headline: "Old direct", relevance: "direct", publishedAt: "2026-10-01T15:00:00.000Z" }),
      item({ id: "macro", headline: "Policy", relevance: "inferred", symbols: [], publishedAt: "2026-11-08T12:00:00.000Z" }),
      item({ id: "blank", headline: "No time", relevance: "direct", publishedAt: null }),
    ];
    const lists = partitionDirect(items, "TSLA", now, false);
    expect(lists.recent.map((entry) => entry.id)).toEqual(["new", "blank"]);
    expect(lists.history.map((entry) => entry.id)).toEqual(["old"]);
    expect(TICKER_COVERAGE).toMatch(/Unknown/);
    expect(TICKER_COVERAGE).toMatch(/not a report of no catalysts/);
  });

  it("does not call a stale title live, and does not invent a ticker event or a statement clock", () => {
    expect(titleBadge("stale")).toBe("Old title");
    expect(titleBadge("stale").toLowerCase()).not.toContain("live");
    expect(nextSymbolEvent([], "TSLA", "2026-11-08")).toEqual({ state: "unknown" });
    expect(nextSymbolEvent([
      {
        id: "e1",
        symbol: "TSLA",
        eventDate: "2026-11-20",
        timing: "before_open",
        clockTimeNote: "",
        sourceUrl: null,
        sourceLabel: "",
        note: "",
        recordedAt: "2026-11-08T15:00:00.000Z",
      },
    ], "TSLA", "2026-11-08")).toMatchObject({ state: "recorded", date: "2026-11-20", clockKnown: false });
    const fomc = nextFomcDate([meeting], "2026-11-08", null);
    expect(fomc.state).toBe("dated");
    if (fomc.state === "dated") expect(fomc.label).toBe("2026-12-08 to 2026-12-09");
    expect(nextFomcDate([], "2026-11-08", "Calendar failed.")).toEqual({ state: "unknown", reason: "Calendar failed." });
  });
});
