import { describe, expect, it } from "vitest";
import { addChecklistEvidence, resetSession, setChecklistStatus } from "@/domain/actions";
import {
  CHECKLIST_ITEMS,
  emptyChecklist,
  summarizeChecklist,
  withEvidence,
} from "@/domain/checklist";
import { ADVISORY_LIMITS, BOLLINGER_ADAPTATION } from "@/domain/limits";
import { initialWorkspace } from "@/domain/state";

describe("checklist", () => {
  it("starts unknown and does not treat that as confirmed", () => {
    const session = emptyChecklist("TSLA", "2026-11-08");
    expect(Object.values(session.statuses).every((status) => status === "unknown")).toBe(true);
    expect(summarizeChecklist(session)).toEqual({ confirmed: 0, not_met: 0, unknown: 6, not_applicable: 0 });
    expect(Object.keys(summarizeChecklist(session)).sort()).toEqual([
      "confirmed",
      "not_applicable",
      "not_met",
      "unknown",
    ]);
  });

  it("keeps technical items off sourced facts and leaves status untouched", () => {
    const session = emptyChecklist("TSLA", "2026-11-08");
    const rejected = withEvidence(session, {
      id: "e1",
      itemId: "bollinger",
      kind: "sourced_fact",
      text: "A headline is not a band.",
      recordedAt: "2026-11-08T15:00:00.000Z",
      sourceUrl: null,
      sourceLabel: null,
    });
    expect(rejected.error).toMatch(/cannot be attached/);
    expect(rejected.session.statuses.bollinger).toBe("unknown");

    const accepted = withEvidence(session, {
      id: "e2",
      itemId: "bollinger",
      kind: "tc2000_user",
      text: "Seen on the 15-minute chart.",
      recordedAt: "2026-11-08T15:00:00.000Z",
      sourceUrl: null,
      sourceLabel: "TC2000",
    });
    expect(accepted.error).toBeNull();
    expect(accepted.session.statuses.bollinger).toBe("unknown");
    expect(accepted.session.evidence).toHaveLength(1);
  });

  it("rejects a script URL and allows a gap to be not applicable", () => {
    const session = emptyChecklist("TSLA", "2026-11-08");
    const bad = withEvidence(session, {
      id: "e1",
      itemId: "fed_earnings",
      kind: "sourced_fact",
      text: "Checked the calendar.",
      recordedAt: "2026-11-08T15:00:00.000Z",
      sourceUrl: "javascript:alert(1)",
      sourceLabel: "Fed",
    });
    expect(bad.error).toMatch(/http/);
    const gap = CHECKLIST_ITEMS.find((item) => item.id === "gap");
    expect(gap?.detail).toMatch(/not a universal gate/);
    expect(gap?.allowedEvidence).toContain("manual_note");
  });

  it("isolates symbol and session, and reset does not touch the library", () => {
    let state = initialWorkspace();
    state = setChecklistStatus(state, {
      symbol: "TSLA",
      sessionDate: "2026-11-08",
      itemId: "bollinger",
      status: "confirmed",
      at: "2026-11-08T15:00:00.000Z",
    }).state;
    state = addChecklistEvidence(state, {
      symbol: "TSLA",
      sessionDate: "2026-11-08",
      evidence: {
        id: "e1",
        itemId: "bollinger",
        kind: "tc2000_user",
        text: "Bands widened and price left them.",
        recordedAt: "2026-11-08T15:00:00.000Z",
        sourceUrl: null,
        sourceLabel: null,
      },
    }).state;
    state = { ...state, news: [{ ...state.news[0], id: "keep" } as never] };
    const other = setChecklistStatus(state, {
      symbol: "AAPL",
      sessionDate: "2026-11-08",
      itemId: "bollinger",
      status: "not_met",
      at: "2026-11-08T16:00:00.000Z",
    }).state;
    expect(other.checklists["TSLA|2026-11-08"].statuses.bollinger).toBe("confirmed");
    expect(other.checklists["AAPL|2026-11-08"].statuses.bollinger).toBe("not_met");
    expect(other.checklists["TSLA|2026-11-09"]).toBeUndefined();

    const reset = resetSession(other, "TSLA", "2026-11-08").state;
    expect(reset.checklists["TSLA|2026-11-08"]).toBeUndefined();
    expect(reset.checklists["AAPL|2026-11-08"].statuses.bollinger).toBe("not_met");
    expect(reset.news).toHaveLength(1);
  });

  it("states the Bollinger adaptation and the academy limits without a ban", () => {
    const bollinger = CHECKLIST_ITEMS.find((item) => item.id === "bollinger");
    expect(bollinger?.detail).toContain(BOLLINGER_ADAPTATION);
    expect(bollinger?.detail).toMatch(/No universal completed-candle rule/);
    expect(ADVISORY_LIMITS.join(" ")).toMatch(/premium invested, not a stop-risk/);
    expect(ADVISORY_LIMITS.join(" ")).toMatch(/not a return on the account/);
    expect(ADVISORY_LIMITS.join(" ")).toMatch(/does not ban/);
    expect(ADVISORY_LIMITS.join(" ")).toMatch(/Thinkorswim phone/);
  });
});
