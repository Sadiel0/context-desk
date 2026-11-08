export type ZonedResult =
  | { ok: true; iso: string }
  | { ok: false; reason: "invalid" | "gap" | "ambiguous" };

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  abbr: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function isRealDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function isoDate(year: number, month: number, day: number): string | null {
  if (!isRealDate(year, month, day)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function isSessionDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  return isRealDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function wallClock(date: Date, timeZone = "America/New_York"): WallClock {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of formatted.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    abbr: bag.timeZoneName ?? "",
  };
}

export function sessionDateET(now: Date): string {
  const wall = wallClock(now);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

export function formatSessionLabel(sessionDate: string): string {
  if (!isSessionDate(sessionDate)) return "Unknown session date";
  const [year, month, day] = sessionDate.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(noon);
  return `${label} ET`;
}

export function formatInstantEt(iso: string | null): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const wall = wallClock(date);
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
  }).format(date);
  return `${month} ${wall.day}, ${wall.year}, ${pad(wall.hour)}:${pad(wall.minute)} ${wall.abbr}`;
}

export function easternLocalToIso(local: string): ZonedResult {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) return { ok: false, reason: "invalid" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!isRealDate(year, month, day) || hour > 23 || minute > 59) return { ok: false, reason: "invalid" };

  const matches: Date[] = [];
  for (const offsetHours of [4, 5]) {
    const utc = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute));
    const wall = wallClock(utc);
    if (
      wall.year === year &&
      wall.month === month &&
      wall.day === day &&
      wall.hour === hour &&
      wall.minute === minute
    ) {
      matches.push(utc);
    }
  }
  const unique = [...new Map(matches.map((date) => [date.toISOString(), date])).values()];
  if (unique.length === 1) return { ok: true, iso: unique[0].toISOString() };
  if (unique.length === 0) return { ok: false, reason: "gap" };
  return { ok: false, reason: "ambiguous" };
}

export function isoToEasternLocal(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const wall = wallClock(date);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

export function zonedErrorMessage(reason: Exclude<ZonedResult, { ok: true }>["reason"]): string {
  if (reason === "gap") return "That time does not exist in Eastern time (daylight-saving gap). It was not guessed.";
  if (reason === "ambiguous") {
    return "That time happens twice in Eastern time (daylight-saving overlap). It was not guessed.";
  }
  return "Enter a real Eastern date and time, or leave the field blank for unknown.";
}
