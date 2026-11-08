export type Freshness = "unknown" | "fresh" | "aging" | "stale";

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
