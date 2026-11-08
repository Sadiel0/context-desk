export type Freshness = "unknown" | "fresh" | "aging" | "stale";

/** A successful fetch is not a freshness mark. Stale titles must not be labeled live. */
export function titleBadge(freshness: Freshness): string {
  if (freshness === "stale") return "Old title";
  if (freshness === "aging") return "Aging title";
  if (freshness === "fresh") return "Recent title";
  return "Title, time unknown";
}

export type FreshnessReading = {
  freshness: Freshness;
  reason: string;
};

const FIVE_MINUTES = 5 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1000;

/**
 * Freshness uses publish time, then event time. Ingest time is not a substitute.
 * A future timestamp is unknown, not fresh.
 */
export function classifyFreshness(
  publishedAt: string | null,
  eventAt: string | null,
  now: Date,
): FreshnessReading {
  const iso = publishedAt ?? eventAt;
  if (!iso) return { freshness: "unknown", reason: "No publish or event time." };
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return { freshness: "unknown", reason: "Time could not be read." };
  const age = now.getTime() - time;
  if (age < -FIVE_MINUTES) {
    return { freshness: "unknown", reason: "Timestamp is ahead of this clock, so it was not treated as fresh." };
  }
  if (age <= SIX_HOURS) return { freshness: "fresh", reason: "Publish or event time is within 6 hours." };
  if (age <= THIRTY_SIX_HOURS) return { freshness: "aging", reason: "Publish or event time is within 36 hours." };
  return { freshness: "stale", reason: "Publish or event time is older than 36 hours." };
}

export function agePhrase(iso: string | null, now: Date): string {
  const reading = classifyFreshness(iso, null, now);
  if (!iso || reading.freshness === "unknown") return "Publication time Unknown";
  const age = now.getTime() - Date.parse(iso);
  const hours = Math.max(0, Math.floor(age / (60 * 60 * 1000)));
  const span = hours >= 48 ? `${Math.floor(hours / 24)} days` : hours >= 1 ? `${hours} hours` : "under 1 hour";
  return `Published ${span} ago`;
}

export function retrievalPhrase(retrievedAt: string | null, now: Date): string {
  if (!retrievedAt) return "Last successful retrieval Unknown";
  const time = Date.parse(retrievedAt);
  if (Number.isNaN(time)) return "Last successful retrieval Unknown";
  const age = now.getTime() - time;
  if (age < -FIVE_MINUTES) return "Retrieval time is ahead of this clock";
  const minutes = Math.max(0, Math.floor(age / (60 * 1000)));
  const span = minutes >= 60 * 48 ? `${Math.floor(minutes / (60 * 24))} days` : minutes >= 60 ? `${Math.floor(minutes / 60)} hours` : `${minutes} minutes`;
  return `Retrieved ${span} ago`;
}
