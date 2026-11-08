import { describe, expect, it } from "vitest";
import { setObservation } from "@/domain/actions";
import { initialWorkspace } from "@/domain/state";
import { loadWorkspace, saveWorkspace, STORAGE_KEY, type KeyValueStore } from "@/storage/local-workspace";

class MemoryStore implements KeyValueStore {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

describe("local workspace", () => {
  it("round-trips a session and strips a javascript link without writing on corrupt JSON", () => {
    const store = new MemoryStore();
    let state = initialWorkspace();
    state = setObservation(state, {
      symbol: "META",
      sessionDate: "2026-11-08",
      itemId: "gap",
      observation: "not_applicable",
      at: "2026-11-08T15:00:00.000Z",
    }).state;
    state = {
      ...state,
      news: [
        {
          id: "n1",
          demo: false,
          sourceId: "manual",
          sourceLabel: "Manual capture",
          url: "javascript:alert(1)",
          author: "A",
          headline: "Kept as text <script>",
          quote: null,
          publishedAt: "2026-11-08T15:00:00.000Z",
          eventAt: null,
          ingestedAt: "2026-11-08T15:01:00.000Z",
          revisions: [],
          unknowns: [],
          symbols: ["META"],
          relevance: "direct",
          relevanceNote: null,
          extractedFact: null,
          interpretation: null,
          rumor: false,
          uncertainAttribution: false,
          x: null,
          correctionOfId: null,
          correctedById: null,
          duplicateOfId: null,
        },
      ],
      checklists: {
        ...state.checklists,
        "META|2026-11-08": {
          ...state.checklists["META|2026-11-08"],
          observations: { ...state.checklists["META|2026-11-08"].observations, bollinger: "pwned" as never },
          evidence: [
            {
              id: "e1",
              itemId: "fed_earnings",
              kind: "sourced_fact",
              text: "Calendar checked",
              recordedAt: "2026-11-08T15:00:00.000Z",
              sourceUrl: "javascript:alert(1)",
              sourceLabel: "Fed",
              publishedAt: null,
              eventAt: null,
              eventDate: null,
              retrievedAt: null,
              scope: "user",
            },
          ],
        },
      },
    };
    saveWorkspace(store, state);
    const loaded = loadWorkspace(store);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.checklists["META|2026-11-08"].observations.gap).toBe("not_applicable");
    expect(loaded.state.checklists["META|2026-11-08"].observations.bollinger).toBe("unknown");
    expect(loaded.state.checklists["META|2026-11-08"].reviews.gap).toBe("unreviewed");
    expect(loaded.state.checklists["TSLA|2026-11-08"]).toBeUndefined();
    expect(loaded.state.news[0].url).toBeNull();
    expect(loaded.state.news[0].headline).toContain("<script>");
    expect(loaded.state.checklists["META|2026-11-08"].evidence[0].sourceUrl).toBeNull();
    expect(JSON.stringify(loaded.state)).not.toContain("javascript:");

    const corrupt = new MemoryStore();
    corrupt.setItem(STORAGE_KEY, "{");
    const failed = loadWorkspace(corrupt);
    expect(failed.ok).toBe(false);
    expect(corrupt.getItem(STORAGE_KEY)).toBe("{");

    const foreign = new MemoryStore();
    foreign.setItem(STORAGE_KEY, JSON.stringify({ version: 2, news: [], earnings: [], checklists: {}, fundamentals: {}, options: {} }));
    expect(loadWorkspace(foreign).ok).toBe(false);
    expect(foreign.getItem(STORAGE_KEY)).toContain('"version":2');

    const legacy = new MemoryStore();
    legacy.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      news: [],
      earnings: [],
      fundamentals: {},
      options: {},
      selectedSymbol: "TSLA",
      checklists: {
        "TSLA|2026-11-08": {
          statuses: { fed_earnings: "confirmed", bollinger: "confirmed" },
          evidence: [],
        },
      },
    }));
    const migrated = loadWorkspace(legacy);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.state.checklists["TSLA|2026-11-08"].reviews.fed_earnings).toBe("reviewed");
    expect(migrated.state.checklists["TSLA|2026-11-08"].observations.fed_earnings).toBe("unknown");
    expect(migrated.state.checklists["TSLA|2026-11-08"].observations.bollinger).toBe("observed");
    expect(migrated.state.checklists["TSLA|2026-11-09"]).toBeUndefined();
  });

  it("starts from an empty workspace with demo off", () => {
    const loaded = loadWorkspace(new MemoryStore());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state).toEqual(initialWorkspace());
    expect(loaded.state.demo).toBe(false);
  });
});
