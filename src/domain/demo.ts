import type { NewsItem } from "@/domain/news";
import { listUnknowns } from "@/domain/news";

export const DEMO_BANNER =
  "DEMO is on. Every item marked DEMO is invented for layout and pipeline practice. None of it is a quote, a filing, a post, or a market condition. Turn DEMO off to hide it.";

function item(partial: NewsItem): NewsItem {
  return { ...partial, unknowns: listUnknowns(partial) };
}

export function demoFixtures(): NewsItem[] {
  const direct = item({
    id: "demo-direct",
    demo: true,
    sourceId: "manual",
    sourceLabel: "Demo desk",
    url: "https://example.com/demo/northwind",
    author: "Demo Desk",
    headline: "[DEMO] Invented: Northwind Robotics describes a fictional factory note",
    quote: "This sentence was written for the fixture. It is not a filing.",
    publishedAt: "2026-11-08T15:00:00.000Z",
    eventAt: null,
    ingestedAt: "2026-11-08T15:05:00.000Z",
    revisions: [],
    unknowns: [],
    symbols: ["TSLA"],
    relevance: "direct",
    relevanceNote: null,
    extractedFact: "Fixture fact: the headline is fictional and names no real filing.",
    interpretation: {
      stance: "bullish",
      note: "Invented bullish reading for layout practice only.",
    },
    rumor: false,
    uncertainAttribution: false,
    x: null,
    correctionOfId: null,
    correctedById: null,
    duplicateOfId: null,
  });

  const duplicate = item({
    ...direct,
    id: "demo-dup",
    headline: "[DEMO] Duplicate of the invented Northwind headline",
    duplicateOfId: "demo-direct",
    extractedFact: null,
    interpretation: null,
  });

  const older = item({
    id: "demo-old",
    demo: true,
    sourceId: "manual",
    sourceLabel: "Demo desk",
    url: "https://example.com/demo/old-headline",
    author: "Demo Desk",
    headline: "[DEMO] Invented earlier headline that the fixture corrects",
    quote: "This earlier fixture sentence is superseded inside the demo.",
    publishedAt: "2026-11-07T15:00:00.000Z",
    eventAt: null,
    ingestedAt: "2026-11-07T15:05:00.000Z",
    revisions: [],
    unknowns: [],
    symbols: ["AAPL"],
    relevance: "direct",
    relevanceNote: null,
    extractedFact: null,
    interpretation: null,
    rumor: false,
    uncertainAttribution: false,
    x: null,
    correctionOfId: null,
    correctedById: "demo-new",
    duplicateOfId: null,
  });

  const correction = item({
    id: "demo-new",
    demo: true,
    sourceId: "manual",
    sourceLabel: "Demo desk",
    url: "https://example.com/demo/corrected-headline",
    author: "Demo Desk",
    headline: "[DEMO] Invented correction: the earlier fixture headline was replaced",
    quote: "This correction sentence is also invented.",
    publishedAt: "2026-11-08T16:00:00.000Z",
    eventAt: null,
    ingestedAt: "2026-11-08T16:05:00.000Z",
    revisions: [],
    unknowns: [],
    symbols: ["AAPL"],
    relevance: "direct",
    relevanceNote: null,
    extractedFact: null,
    interpretation: null,
    rumor: false,
    uncertainAttribution: false,
    x: null,
    correctionOfId: "demo-old",
    correctedById: null,
    duplicateOfId: null,
  });

  const post = item({
    id: "demo-x",
    demo: true,
    sourceId: "x_manual",
    sourceLabel: "X post, pasted",
    url: "https://example.com/demo/fictional-post",
    author: "A. Example (fictional)",
    headline: "[DEMO] Invented post from a fictional account about a fictional tariff",
    quote: "[DEMO] Invented post text. It was not fetched from X.",
    publishedAt: "2026-11-08T17:00:00.000Z",
    eventAt: null,
    ingestedAt: "2026-11-08T17:05:00.000Z",
    revisions: [],
    unknowns: [],
    symbols: [],
    relevance: "inferred",
    relevanceNote: "Inferred only inside the fixture: a fictional tariff remark. Not a real policy claim.",
    extractedFact: null,
    interpretation: {
      stance: "unclear",
      note: "Invented unclear reading. Not a trade signal.",
    },
    rumor: true,
    uncertainAttribution: true,
    x: {
      displayName: "A. Example",
      handle: "@example_not_real",
      numericId: null,
      identityStatus: "pending_verification",
      quotedText: "[DEMO] Invented quoted text.",
      repostContext: "[DEMO] Invented repost context.",
      handleNote: "Invented for the fixture. Not a real handle and not verified.",
    },
    correctionOfId: null,
    correctedById: null,
    duplicateOfId: null,
  });

  return [direct, duplicate, older, correction, post];
}

export function itemsForView(library: NewsItem[], demoOn: boolean): NewsItem[] {
  const stored = library.filter((item) => !item.demo);
  return demoOn ? [...stored, ...demoFixtures()] : stored;
}
