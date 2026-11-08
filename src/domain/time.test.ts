import { describe, expect, it } from "vitest";
import { describeSession, easternLocalToIso, formatInstantEt, isoToEasternLocal, isWeekendDate, sessionDateET } from "@/domain/time";

describe("Eastern session dates", () => {
  it("uses the Eastern calendar date across the UTC evening boundary", () => {
    expect(sessionDateET(new Date("2026-11-08T04:30:00.000Z"))).toBe("2026-11-07");
    expect(sessionDateET(new Date("2026-11-08T05:00:00.000Z"))).toBe("2026-11-08");
  });

  it("keeps the date across the spring-forward and fall-back instants", () => {
    expect(sessionDateET(new Date("2026-03-08T04:30:00.000Z"))).toBe("2026-03-07");
    expect(sessionDateET(new Date("2026-03-08T06:59:00.000Z"))).toBe("2026-03-08");
    expect(sessionDateET(new Date("2026-03-08T07:00:00.000Z"))).toBe("2026-03-08");
    expect(sessionDateET(new Date("2026-11-01T03:30:00.000Z"))).toBe("2026-10-31");
    expect(sessionDateET(new Date("2026-11-01T05:30:00.000Z"))).toBe("2026-11-01");
    expect(sessionDateET(new Date("2026-11-01T06:30:00.000Z"))).toBe("2026-11-01");
  });

  it("converts wall times and refuses the daylight-saving gap and overlap", () => {
    expect(easternLocalToIso("2026-11-08T09:30")).toEqual({ ok: true, iso: "2026-11-08T14:30:00.000Z" });
    expect(easternLocalToIso("2026-07-08T09:30")).toEqual({ ok: true, iso: "2026-07-08T13:30:00.000Z" });
    expect(easternLocalToIso("2026-03-08T01:30")).toEqual({ ok: true, iso: "2026-03-08T06:30:00.000Z" });
    expect(easternLocalToIso("2026-03-08T03:30")).toEqual({ ok: true, iso: "2026-03-08T07:30:00.000Z" });
    expect(easternLocalToIso("2026-03-08T02:30")).toEqual({ ok: false, reason: "gap" });
    expect(easternLocalToIso("2026-11-01T01:30")).toEqual({ ok: false, reason: "ambiguous" });
    expect(easternLocalToIso("2026-02-31T10:00")).toEqual({ ok: false, reason: "invalid" });
  });

  it("labels EST and EDT instead of leaving a bare clock time", () => {
    expect(formatInstantEt("2026-11-08T14:30:00.000Z")).toBe("Nov 8, 2026, 09:30 EST");
    expect(formatInstantEt("2026-07-08T13:30:00.000Z")).toBe("Jul 8, 2026, 09:30 EDT");
    expect(formatInstantEt(null)).toBe("Unknown");
    expect(isoToEasternLocal("2026-11-08T14:30:00.000Z")).toBe("2026-11-08T09:30");
    expect(formatInstantEt("2026-11-08T05:00:00.000Z")).toContain("00:00 EST");
  });

  it("labels a UTC Sunday morning as Saturday evening in Eastern time, and a manual date as not today", () => {
    const now = new Date("2026-11-08T03:30:00.000Z");
    expect(sessionDateET(now)).toBe("2026-11-07");
    const today = describeSession(now, "2026-11-07", false);
    expect(today.matchesEasternToday).toBe(true);
    expect(today.weekend).toBe(true);
    expect(today.nowLabel).toContain("EST");
    expect(isWeekendDate("2026-11-08")).toBe(true);
    expect(isWeekendDate("2026-11-09")).toBe(false);
    const manual = describeSession(now, "2026-11-08", true);
    expect(manual.matchesEasternToday).toBe(false);
    expect(manual.manual).toBe(true);
    expect(manual.weekend).toBe(true);
  });
});
