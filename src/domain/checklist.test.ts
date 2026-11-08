import { describe, expect, it } from "vitest";
import {
  addChecklistEvidence,
  attachPressEvidence,
  resetSession,
  setObservation,
  setReview,
  setSetupNote,
} from "@/domain/actions";
import {
  CHECKLIST_ITEMS,
  emptyChecklist,
  migrateLegacyStatus,
  summarizeChecklist,
  withEvidence,
  type Evidence,
} from "@/domain/checklist";
import { ADVISORY_LIMITS, BOLLINGER_ADAPTATION } from "@/domain/limits";
import { checklistFor, initialWorkspace } from "@/domain/state";

function evidence(partial: Pick<Evidence, "id" | "itemId" | "kind" | "text" | "recordedAt"> & Partial<Evidence>): Evidence {
  return {
    sourceUrl: null,
    sourceLabel: null,
    publishedAt: null,
    eventAt: null,
    eventDate: null,
    retrievedAt: null,
    scope: "user",
    ...partial,
  };
}

describe("checklist", () => {
  it("starts unreviewed and unknown, with no trade score", () => {
    const session = emptyChecklist("TSLA", "2026-11-08");
    expect(Object.values(session.reviews).every((mark) => mark === "unreviewed")).toBe(true);
    expect(Object.values(session.observations).every((mark) => mark === "unknown")).toBe(true);
    const summary = summarizeChecklist(session);
    expect(summary).toEqual({
      unreviewed: 6,
      reviewed: 0,
      observationUnknown: 6,
      observed: 0,
      notObserved: 0,
      notApplicable: 0,
    });
    expect(summary).not.toHaveProperty("safe");
    expect(summary).not.toHaveProperty("confirmed");
  });

  it("keeps a finished Fed review from becoming an observation", () => {
    let state = setReview(initialWorkspace(), {
      symbol: "TSLA",
      sessionDate: "2026-11-08",
      itemId: "fed_earnings",
      review: "reviewed",
      at: "2026-11-08T15:00:00.000Z",
    }).state;
    const session = state.checklists["TSLA|2026-11-08"];
    expect(session.reviews.fed_earnings).toBe("reviewed");
    expect(session.observations.fed_earnings).toBe("unknown");
    state = addChecklistEvidence(state, {
      symbol: "TSLA",
      sessionDate: "2026-11-08",
      evidence: evidence({
        id: "e1",
        itemId: "fed_earnings",
        kind: "sourced_fact",
        text: "Looked at the calendar.",
        recordedAt: "2026-11-08T15:00:00.000Z",
      }),
    }).state;
    expect(state.checklists["TSLA|2026-11-08"].observations.fed_earnings).toBe("unknown");
    expect(state.checklists["TSLA|2026-11-08"].reviews.fed_earnings).toBe("reviewed");
  });

  it("keeps technical items off sourced facts and leaves both marks untouched", () => {
    const session = emptyChecklist("TSLA", "2026-11-08");
    const rejected = withEvidence(session, evidence({
      id: "e1",
      itemId: "bollinger",
      kind: "sourced_fact",
      text: "A headline is not a band.",
      recordedAt: "2026-11-08T15:00:00.000Z",
    }));
    expect(rejected.error).toMatch(/cannot be attached/);
    expect(rejected.session.observations.bollinger).toBe("unknown");
    const accepted = withEvidence(session, evidence({
      id: "e2",
      itemId: "bollinger",
      kind: "tc2000_user",
      text: "Seen on the 15-minute chart.",
      recordedAt: "2026-11-08T15:00:00.000Z",
      sourceLabel: "TC2000",
    }));
    expect(accepted.error).toBeNull();
    expect(accepted.session.reviews.bollinger).toBe("unreviewed");
    expect(accepted.session.observations.bollinger).toBe("unknown");
  });

  it("rejects a script URL and does not carry marks onto another session", () => {
    const bad = withEvidence(emptyChecklist("TSLA", "2026-11-08"), evidence({
      id: "e1",
      itemId: "fed_earnings",
      kind: "sourced_fact",
      text: "Checked the calendar.",
      recordedAt: "2026-11-08T15:00:00.000Z",
      sourceUrl: "javascript:alert(1)",
      sourceLabel: "Fed",
    }));
    expect(bad.error).toMatch(/http/);
    let state = setObservation(initialWorkspace(), {
      symbol: "TSLA",
      sessionDate: "2026-11-07",
      itemId: "bollinger",
      observation: "observed",
      at: "2026-11-07T15:00:00.000Z",
    }).state;
    state = setSetupNote(state, {
      symbol: "TSLA",
      sessionDate: "2026-11-07",
      note: {
        ...state.checklists["TSLA|2026-11-07"].setup,
        directionalExit: "Left the upper band.",
        observedAtLocal: "2026-11-07T10:15",
        setupVersion: "notebook-3",
      },
    }).state;
    const nextDay = checklistFor(state, "TSLA", "2026-11-08");
    expect(nextDay.observations.bollinger).toBe("unknown");
    expect(nextDay.reviews.bollinger).toBe("unreviewed");
    expect(nextDay.setup.directionalExit).toBe("");
    expect(nextDay.setup.observedAt).toBeNull();
    const gap = setSetupNote(state, {
      symbol: "TSLA",
      sessionDate: "2026-11-07",
      note: { ...state.checklists["TSLA|2026-11-07"].setup, observedAtLocal: "2026-03-08T02:30" },
    });
    expect(gap.error).toMatch(/not guessed/);
    expect(gap.state.checklists["TSLA|2026-11-07"].setup.observedAtLocal).toBe("2026-11-07T10:15");
  });

  it("isolates symbol and session, and reset clears the setup note without the library", () => {
    let state = setObservation(initialWorkspace(), {
      symbol: "TSLA",
      sessionDate: "2026-11-08",
      itemId: "bollinger",
      observation: "observed",
      at: "2026-11-08T15:00:00.000Z",
    }).state;
    state = setObservation(state, {
      symbol: "AAPL",
      sessionDate: "2026-11-08",
      itemId: "bollinger",
      observation: "not_observed",
      at: "2026-11-08T16:00:00.000Z",
    }).state;
    const reset = resetSession(state, "TSLA", "2026-11-08").state;
    expect(reset.checklists["TSLA|2026-11-08"]).toBeUndefined();
    expect(checklistFor(reset, "TSLA", "2026-11-08").observations.bollinger).toBe("unknown");
    expect(reset.checklists["AAPL|2026-11-08"].observations.bollinger).toBe("not_observed");
  });

  it("attaches a Fed title as macro evidence without marking the row", () => {
    const state = attachPressEvidence(initialWorkspace(), {
      symbol: "TSLA",
      sessionDate: "2026-11-08",
      evidenceId: "e-fed",
      at: "2026-11-08T16:00:00.000Z",
      retrievedAt: "2026-11-08T15:59:00.000Z",
      item: {
        title: "Federal Reserve issues FOMC statement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
        publishedAt: "2026-10-28T18:00:00.000Z",
        guid: null,
      },
    }).state;
    const session = state.checklists["TSLA|2026-11-08"];
    expect(session.reviews.fed_earnings).toBe("unreviewed");
    expect(session.observations.fed_earnings).toBe("unknown");
    expect(session.evidence[0].scope).toBe("macro");
    expect(session.evidence[0].publishedAt).toBe("2026-10-28T18:00:00.000Z");
    expect(session.evidence[0].text).toMatch(/Not a TSLA headline/);
    expect(migrateLegacyStatus("fed_earnings", "confirmed")).toEqual({ review: "reviewed", observation: "unknown" });
    expect(migrateLegacyStatus("bollinger", "confirmed")).toEqual({ review: "reviewed", observation: "observed" });
  });

  it("states the Bollinger adaptation, bilingual labels, and academy limits", () => {
    const bollinger = CHECKLIST_ITEMS.find((item) => item.id === "bollinger");
    expect(bollinger?.titleEs).toMatch(/Bollinger/);
    expect(bollinger?.titleEn).toMatch(/Bollinger/);
    expect(bollinger?.detail).toContain(BOLLINGER_ADAPTATION);
    expect(CHECKLIST_ITEMS.find((item) => item.id === "gap")?.detail).toMatch(/not a universal gate/);
    expect(CHECKLIST_ITEMS.map((item) => item.titleEs)).toEqual([
      "Reuniones de la Fed y earnings",
      "Bollinger 15 min, hora y día",
      "Medias móviles, hora y día",
      "Ruptura de línea de tendencia",
      "Gap al alza o a la baja",
      "Precio, bid, ask y vencimiento",
    ]);
    expect(ADVISORY_LIMITS.join(" ")).toMatch(/premium invested/);
    expect(ADVISORY_LIMITS.join(" ")).toMatch(/not a return on the account/);
    expect(ADVISORY_LIMITS.join(" ")).toMatch(/does not ban/);
  });
});
