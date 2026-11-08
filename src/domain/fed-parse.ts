import { cleanText } from "@/domain/text";
import { isoDate } from "@/domain/time";
import { safeHttpUrl } from "@/domain/urls";
import { FED_HOST } from "@/domain/sources";

export type FomcMeeting = {
  year: number;
  month: number | null;
  monthLabel: string;
  startDay: number | null;
  endDay: number | null;
  startDate: string | null;
  endDate: string | null;
  sep: boolean;
  statementUrl: string | null;
  minutesNote: string | null;
  dateWarning: string | null;
};

export type FomcParse = {
  meetings: FomcMeeting[];
  notices: string[];
  lastUpdate: string | null;
};

export type FedPressItem = {
  title: string;
  url: string;
  publishedAt: string | null;
  guid: string | null;
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export function parseFomcCalendar(html: string): FomcParse {
  const notices = ["A meeting date does not establish the statement release time."];
  if (/tentative until confirmed/i.test(html)) {
    notices.push(
      "The Federal Reserve says each meeting date is tentative until confirmed at the meeting immediately preceding it.",
    );
  }
  if (/Meeting associated with a Summary of Economic Projections/i.test(html)) {
    notices.push("An asterisk means the Federal Reserve associates that meeting with a Summary of Economic Projections.");
  }
  const lastUpdate = html.match(/Last Update:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i)?.[1] ?? null;
  const headings = [...html.matchAll(/<h4>\s*<a[^>]*>\s*(20\d{2})\s+FOMC Meetings\s*<\/a>\s*<\/h4>/gi)];
  const meetings: FomcMeeting[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const year = Number(headings[index][1]);
    const start = headings[index].index ?? 0;
    const end = headings[index + 1]?.index ?? html.length;
    meetings.push(...parseYearSlice(year, html.slice(start, end)));
  }
  return { meetings, notices, lastUpdate };
}

function parseYearSlice(year: number, slice: string): FomcMeeting[] {
  return slice.split("fomc-meeting__month").slice(1).map((part) => parseMeeting(year, part));
}

function parseMeeting(year: number, part: string): FomcMeeting {
  const monthLabel = part.match(/<strong>([A-Za-z]+)<\/strong>/)?.[1] ?? "";
  const month = MONTHS[monthLabel.toLowerCase()] ?? null;
  const dateText = (part.match(/fomc-meeting__date[^>]*>\s*([^<]+)</)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const sep = dateText.includes("*");
  const cleaned = dateText.replace(/\*/g, "").replace(/\s+/g, "");
  const range = /^(\d{1,2})(?:[-–](\d{1,2}))?$/.exec(cleaned);
  let startDay: number | null = null;
  let endDay: number | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;
  let dateWarning: string | null = null;

  if (!month) dateWarning = "Month could not be read.";
  else if (!range) {
    dateWarning = dateText ? `Date text “${cleanText(dateText, 40)}” could not be read.` : "Date text was empty.";
  } else {
    startDay = Number(range[1]);
    endDay = range[2] ? Number(range[2]) : startDay;
    startDate = isoDate(year, month, startDay);
    endDate = isoDate(year, month, endDay);
    if (!startDate || !endDate || endDay < startDay) {
      dateWarning = "Day was not a real date in that month.";
      startDate = null;
      endDate = null;
    }
  }

  const minutesRaw = part.match(/\(Released\s+([^)]+)\)/i)?.[1]?.trim() ?? null;
  return {
    year,
    month,
    monthLabel: monthLabel || "Unknown",
    startDay,
    endDay,
    startDate,
    endDate,
    sep,
    statementUrl: statementUrlFrom(part),
    minutesNote: minutesRaw ? cleanText(minutesRaw, 80) : null,
    dateWarning,
  };
}

function statementUrlFrom(part: string): string | null {
  for (const match of part.matchAll(/href="([^"]+)"/gi)) {
    const href = match[1];
    if (!href.includes("/newsevents/pressreleases/monetary") || !href.toLowerCase().endsWith(".htm")) continue;
    try {
      const url = new URL(href, "https://www.federalreserve.gov");
      if (url.protocol === "https:" && url.hostname === FED_HOST) return url.toString();
    } catch {
      continue;
    }
  }
  return null;
}

export function relateMeetings(meetings: FomcMeeting[], sessionDate: string): {
  onSession: FomcMeeting[];
  next: FomcMeeting | null;
  previous: FomcMeeting | null;
  undated: FomcMeeting[];
} {
  const dated = meetings.filter((meeting): meeting is FomcMeeting & { startDate: string; endDate: string } =>
    Boolean(meeting.startDate && meeting.endDate),
  );
  const undated = meetings.filter((meeting) => !meeting.startDate || !meeting.endDate);
  const onSession = dated.filter((meeting) => meeting.startDate <= sessionDate && sessionDate <= meeting.endDate);
  const next =
    dated
      .filter((meeting) => meeting.startDate > sessionDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  const previous =
    dated
      .filter((meeting) => meeting.endDate < sessionDate)
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;
  return { onSession, next, previous, undated };
}

export function describeMeeting(meeting: FomcMeeting): string {
  const when =
    meeting.startDate && meeting.endDate
      ? meeting.startDate === meeting.endDate
        ? meeting.startDate
        : `${meeting.startDate} to ${meeting.endDate}`
      : "date unknown";
  const sep = meeting.sep ? " Marked with an asterisk for a Summary of Economic Projections." : "";
  const warning = meeting.dateWarning ? ` ${meeting.dateWarning}` : "";
  return `FOMC meeting ${when}.${sep}${warning} Statement release time is not on the calendar. Dates on the page are tentative until the prior meeting confirms them.`;
}

export function decodeXml(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return unwrapped
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function safeCodePoint(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return "";
  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function inner(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

export function fedHttpsUrl(input: string): string | null {
  const safe = safeHttpUrl(input);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.protocol !== "https:" || url.hostname !== FED_HOST) return null;
  return url.toString();
}

export function parseFedPressRss(xml: string): { items: FedPressItem[]; notices: string[] } {
  const notices = [
    "These are titles and links from the Federal Reserve monetary-policy feed. Article bodies were not retrieved.",
    "A headline is not a claim about market direction.",
  ];
  const items: FedPressItem[] = [];
  let skipped = 0;
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = cleanText(stripTags(decodeXml(inner(block, "title"))), 400).trim();
    const link = decodeXml(inner(block, "link")).trim();
    const guid = decodeXml(inner(block, "guid")).trim();
    const publishedRaw = decodeXml(inner(block, "pubDate")).trim();
    if (!title) continue;
    const url = fedHttpsUrl(link);
    if (!url) {
      skipped += 1;
      continue;
    }
    let publishedAt: string | null = null;
    if (publishedRaw) {
      const parsed = Date.parse(publishedRaw);
      publishedAt = Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
      if (!publishedAt) notices.push("A pubDate could not be read and was left unknown.");
    }
    items.push({ title, url, publishedAt, guid: guid ? cleanText(guid, 500) : null });
    if (items.length >= 40) {
      notices.push("The feed was truncated to 40 items.");
      break;
    }
  }
  if (skipped > 0) {
    notices.push(
      `${skipped} feed item${skipped === 1 ? "" : "s"} skipped because the link was not an https URL on www.federalreserve.gov.`,
    );
  }
  return { items, notices };
}
