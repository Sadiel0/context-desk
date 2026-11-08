import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFedPressRss, parseFomcCalendar, relateMeetings } from "@/domain/fed-parse";

const calendarHtml = readFileSync(new URL("./fixtures/fomc-sample.html", import.meta.url), "utf8");
const pressXml = readFileSync(new URL("./fixtures/press-sample.xml", import.meta.url), "utf8");

describe("Federal Reserve parsers", () => {
  it("reads meeting rows without inventing missing months or a statement clock", () => {
    const parsed = parseFomcCalendar(calendarHtml);
    expect(parsed.meetings.map((meeting) => [meeting.year, meeting.startDate, meeting.endDate, meeting.sep])).toEqual([
      [2026, "2026-01-27", "2026-01-28", false],
      [2026, "2026-03-17", "2026-03-18", true],
      [2026, "2026-04-28", "2026-04-29", false],
      [2027, "2027-01-26", "2027-01-27", false],
    ]);
    expect(parsed.meetings.some((meeting) => meeting.month === 2)).toBe(false);
    const january = parsed.meetings[0];
    expect(january.statementUrl).toBe("https://www.federalreserve.gov/newsevents/pressreleases/monetary20260128a.htm");
    expect(january.minutesNote).toBe("February 18, 2026");
    expect(january).not.toHaveProperty("releaseTime");
    expect(parsed.meetings[3].statementUrl).toBeNull();
    expect(parsed.notices.join(" ")).toMatch(/does not establish the statement release time/);
    expect(parsed.notices.join(" ")).toMatch(/tentative/);
    expect(parsed.lastUpdate).toBe("October 28, 2026");
  });

  it("leaves an unreadable date unknown and relates a session without filling months", () => {
    const parsed = parseFomcCalendar(`
      <h4><a id="x">2030 FOMC Meetings</a></h4>
      <div class="fomc-meeting__month"><strong>February</strong></div>
      <div class="fomc-meeting__date">TBD</div>
    `);
    expect(parsed.meetings[0].startDate).toBeNull();
    expect(parsed.meetings[0].dateWarning).toMatch(/could not be read/);
    const relation = relateMeetings(parseFomcCalendar(calendarHtml).meetings, "2026-11-08");
    expect(relation.onSession).toEqual([]);
    expect(relation.previous?.startDate).toBe("2026-04-28");
    expect(relation.next?.startDate).toBe("2027-01-26");
    const during = relateMeetings(parseFomcCalendar(calendarHtml).meetings, "2026-03-18");
    expect(during.onSession.map((meeting) => meeting.startDate)).toEqual(["2026-03-17"]);
  });

  it("keeps press titles, links, and pubDates, and drops foreign links", () => {
    const parsed = parseFedPressRss(pressXml);
    expect(parsed.items).toHaveLength(3);
    expect(parsed.items[0]).toMatchObject({
      title: "Federal Reserve issues FOMC statement",
      url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
      publishedAt: "2026-10-28T18:00:00.000Z",
    });
    expect(parsed.items[1].title).toBe("Minutes of the Board's discount rate meetings");
    expect(parsed.items[2].publishedAt).toBeNull();
    expect(parsed.notices.join(" ")).toMatch(/skipped/);
    expect(parsed.notices.join(" ")).toMatch(/bodies were not retrieved/);
    expect(JSON.stringify(parsed.items)).not.toContain("evil.example");
  });
});
