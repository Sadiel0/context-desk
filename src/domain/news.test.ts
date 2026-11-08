import { describe, expect, it } from "vitest";
import { demoFixtures, DEMO_BANNER, itemsForView } from "@/domain/demo";
import { classifyFreshness, titleBadge } from "@/domain/freshness";
import {
  addNewsItem,
  evidenceFromNews,
  groupNews,
  reviseNewsItem,
  type NewsDraft,
} from "@/domain/news";
import { X_ALLOWLIST_PENDING, adapterById, xSweeperStatus } from "@/domain/sources";
import { normalizeUrl, safeHttpUrl } from "@/domain/urls";

function draft(overrides: Partial<NewsDraft> = {}): NewsDraft {
  return {
    id: "n1",
    sourceId: "manual",
    sourceLabel: "",
    url: "https://example.com/story",
    author: "Reporter",
    headline: "A headline you read",
    quote: "The sentence on the page.",
    publishedAt: "2026-11-08T15:00:00.000Z",
    eventAt: null,
    symbols: ["TSLA"],
    relevance: "direct",
    relevanceNote: "",
    extractedFact: "The page stated the headline.",
    interpretation: { stance: "bullish", note: "Your reading, not the page." },
    rumor: false,
    uncertainAttribution: false,
    x: null,
    correctionOfId: null,
    duplicateOfId: null,
    ingestedAt: "2026-11-08T15:06:00.000Z",
    ...overrides,
  };
}

describe("urls and news pipeline", () => {
  it("rejects non-http links and strips tracking parameters", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("https://user:pass@example.com/a")).toBeNull();
    expect(safeHttpUrl("//example.com")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeUrl(" https://Example.com/a/?utm_source=x&id=2#frag ")).toBe("https://example.com/a?id=2");
  });

  it("dedupes normalized URLs, records corrections, and drops nulls from text", () => {
    const first = addNewsItem([], draft({ headline: "Headline\u0000 one", url: "https://example.com/story?utm_source=rss" }), "primary");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.items[0].headline).toBe("Headline one");
    const again = addNewsItem(first.items, draft({ id: "n2", url: "https://example.com/story" }), "primary");
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.duplicateOfId).toBe("n1");

    const marked = addNewsItem(first.items, draft({ id: "n2", url: "https://example.com/story", duplicateOfId: "n1" }), "duplicate");
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(marked.items.find((item) => item.id === "n2")?.duplicateOfId).toBe("n1");

    const corrected = addNewsItem(
      first.items,
      draft({
        id: "n3",
        url: "https://example.com/story-fixed",
        headline: "Corrected headline",
        correctionOfId: "n1",
      }),
      "correction",
    );
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.items.find((item) => item.id === "n1")?.correctedById).toBe("n3");
    expect(corrected.items.find((item) => item.id === "n3")?.correctionOfId).toBe("n1");

    const revised = reviseNewsItem(corrected.items, "n3", draft({
      id: "ignored",
      url: "https://example.com/story-fixed",
      headline: "Corrected headline again",
      correctionOfId: "n1",
      ingestedAt: "2026-11-08T18:00:00.000Z",
    }));
    expect(revised.ok).toBe(true);
    if (!revised.ok) return;
    expect(revised.items.find((item) => item.id === "n3")?.revisions[0]?.summary).toMatch(/headline/);
  });

  it("keeps interpretation out of checklist evidence and isolates symbols", () => {
    const saved = addNewsItem([], draft(), "primary");
    if (!saved.ok) throw new Error(saved.error);
    const evidence = evidenceFromNews(saved.items[0], "e1", "2026-11-08T15:07:00.000Z");
    if ("error" in evidence) throw new Error(evidence.error);
    expect(evidence.itemId).toBe("fed_earnings");
    expect(evidence.kind).toBe("sourced_fact");
    expect(evidence.text).not.toContain("Your reading, not the page.");
    expect(evidence.text).toContain("Interpretation was not copied.");
    expect(evidence.scope).toBe("symbol");
    expect(evidence.publishedAt).toBe("2026-11-08T15:00:00.000Z");

    const rumor = addNewsItem([], draft({ id: "r", rumor: true, url: "https://example.com/rumor" }), "primary");
    if (!rumor.ok) throw new Error(rumor.error);
    const rumorEvidence = evidenceFromNews(rumor.items[0], "e2", "2026-11-08T15:07:00.000Z");
    if ("error" in rumorEvidence) throw new Error(rumorEvidence.error);
    expect(rumorEvidence.kind).toBe("manual_note");

    const groups = groupNews(saved.items, {
      symbol: "AAPL",
      includeInferred: true,
      sourceId: "all",
      showCorrectedOriginals: false,
      showDuplicates: false,
      demo: false,
    });
    expect(groups.direct).toHaveLength(0);

    const macro = addNewsItem([], draft({
      id: "macro",
      url: "",
      symbols: [],
      relevance: "inferred",
      relevanceNote: "Rates can matter. The feed did not name a company.",
      headline: "A policy headline",
    }), "primary");
    if (!macro.ok) throw new Error(macro.error);
    const onTsla = groupNews(macro.items, {
      symbol: "TSLA",
      includeInferred: true,
      sourceId: "all",
      showCorrectedOriginals: false,
      showDuplicates: false,
      demo: false,
    });
    expect(onTsla.inferred).toHaveLength(1);
    expect(onTsla.direct).toHaveLength(0);
  });

  it("does not treat ingest time as freshness and does not call the future fresh", () => {
    const now = new Date("2026-11-08T18:00:00.000Z");
    expect(classifyFreshness(null, null, now).freshness).toBe("unknown");
    expect(classifyFreshness("2026-11-08T17:00:00.000Z", null, now).freshness).toBe("fresh");
    expect(classifyFreshness("2026-11-07T00:00:00.000Z", null, now).freshness).toBe("stale");
    expect(classifyFreshness("2026-11-09T00:00:00.000Z", null, now).freshness).toBe("unknown");
    expect(classifyFreshness(null, null, now).reason).not.toMatch(/ingest/i);
    expect(titleBadge("stale")).not.toMatch(/live/i);
    expect(titleBadge("fresh")).toBe("Recent title");
  });

  it("hides demo fixtures until asked and does not pretend X is verified", () => {
    expect(DEMO_BANNER).toMatch(/invented/i);
    expect(DEMO_BANNER).toMatch(/none of it is a quote/i);
    const fixtures = demoFixtures();
    expect(fixtures.every((item) => item.demo && item.headline.startsWith("[DEMO]"))).toBe(true);
    expect(fixtures.every((item) => item.url?.startsWith("https://example.com/demo/"))).toBe(true);
    expect(JSON.stringify(fixtures)).not.toMatch(/Elon|Trump|elonmusk|realDonald/i);
    expect(itemsForView(fixtures, false)).toHaveLength(0);
    expect(itemsForView([], true).length).toBe(fixtures.length);
    expect(xSweeperStatus().polling).toBe(false);
    expect(X_ALLOWLIST_PENDING.every((person) => person.handle === null && person.numericId === null && !person.monitored)).toBe(true);
    expect(adapterById("x")?.mode).toBe("unconfigured");
    expect(adapterById("fed")?.mode).toBe("live");
    expect(adapterById("finviz")?.links({ symbol: "SPX", name: "S&P 500 Index", kind: "index", identity: null, occasional: true })).toEqual([]);
    const script = addNewsItem([], draft({ url: "javascript:alert(1)" }), "primary");
    expect(script.ok).toBe(false);
  });
});
