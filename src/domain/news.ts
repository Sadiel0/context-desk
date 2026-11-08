import type { Evidence, EvidenceKind } from "@/domain/checklist";
import { attributableSources } from "@/domain/sources";
import { blankToNull, cleanText } from "@/domain/text";
import { normalizeUrl } from "@/domain/urls";
import { isWatchSymbol } from "@/domain/watchlist";

export type Relevance = "direct" | "inferred" | "unknown";
export type Stance = "bullish" | "bearish" | "mixed" | "unclear";

export type XContext = {
  displayName: string;
  handle: string | null;
  numericId: string | null;
  identityStatus: "pending_verification";
  quotedText: string | null;
  repostContext: string | null;
  handleNote: string;
};

export type NewsRevision = { at: string; summary: string };

export type NewsItem = {
  id: string;
  demo: boolean;
  sourceId: string;
  sourceLabel: string;
  url: string | null;
  author: string | null;
  headline: string;
  quote: string | null;
  publishedAt: string | null;
  eventAt: string | null;
  ingestedAt: string;
  revisions: NewsRevision[];
  unknowns: string[];
  symbols: string[];
  relevance: Relevance;
  relevanceNote: string | null;
  extractedFact: string | null;
  interpretation: { stance: Stance; note: string } | null;
  rumor: boolean;
  uncertainAttribution: boolean;
  x: XContext | null;
  correctionOfId: string | null;
  correctedById: string | null;
  duplicateOfId: string | null;
};

export type NewsDraft = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  url: string;
  author: string;
  headline: string;
  quote: string;
  publishedAt: string | null;
  eventAt: string | null;
  symbols: string[];
  relevance: Relevance;
  relevanceNote: string;
  extractedFact: string;
  interpretation: { stance: Stance; note: string } | null;
  rumor: boolean;
  uncertainAttribution: boolean;
  x: {
    displayName: string;
    handle: string;
    numericId: string;
    quotedText: string;
    repostContext: string;
  } | null;
  correctionOfId: string | null;
  duplicateOfId: string | null;
  ingestedAt: string;
};

export type NewsWriteResult =
  | { ok: true; items: NewsItem[] }
  | { ok: false; error: string; duplicateOfId?: string };

const ATTRIBUTABLE = new Set(attributableSources().map((source) => source.id));
const STANCES = new Set<Stance>(["bullish", "bearish", "mixed", "unclear"]);

export function listUnknowns(item: Pick<
  NewsItem,
  "url" | "author" | "publishedAt" | "quote" | "extractedFact" | "relevance" | "x"
>): string[] {
  const unknowns: string[] = [];
  if (!item.url) unknowns.push("Original URL unknown");
  if (!item.author) unknowns.push("Author unknown");
  if (!item.publishedAt) unknowns.push("Publish time unknown");
  if (!item.quote) unknowns.push("No original quote beyond the headline");
  if (!item.extractedFact) unknowns.push("No separate fact extracted");
  if (item.relevance === "unknown") unknowns.push("Symbol relevance unknown");
  if (item.x) {
    unknowns.push(item.x.handle ? "X handle typed, not verified" : "X handle not verified");
    unknowns.push("X numeric id not verified");
  }
  return unknowns;
}

export function normalizeHeadline(headline: string): string {
  return headline.toLowerCase().replace(/\s+/g, " ").trim();
}

export function dedupeKey(item: Pick<NewsItem, "url" | "sourceId" | "headline">): string {
  if (item.url) return `url:${item.url}`;
  return `text:${item.sourceId}:${normalizeHeadline(item.headline)}`;
}

export function findDuplicate(items: NewsItem[], key: string, exceptIds: string[]): NewsItem | undefined {
  const hits = items.filter((item) => !exceptIds.includes(item.id) && dedupeKey(item) === key);
  return hits.find((item) => !item.correctedById && !item.duplicateOfId) ?? hits[0];
}

function isoOrNull(value: string | null): { ok: true; value: string | null } | { ok: false } {
  if (!value) return { ok: true, value: null };
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return { ok: false };
  return { ok: true, value: new Date(parsed).toISOString() };
}

function buildItem(draft: NewsDraft, structural: Pick<NewsItem, "correctionOfId" | "correctedById" | "duplicateOfId" | "revisions" | "demo">):
  | { ok: true; item: NewsItem }
  | { ok: false; error: string } {
  if (!ATTRIBUTABLE.has(draft.sourceId)) return { ok: false, error: "Choose a source." };
  const headline = cleanText(draft.headline, 400).trim();
  if (!headline) return { ok: false, error: "Headline is required." };
  let url: string | null = null;
  if (draft.url.trim()) {
    url = normalizeUrl(draft.url);
    if (!url) return { ok: false, error: "Only http and https links can be saved." };
  }
  const symbols = [...new Set(draft.symbols.filter(isWatchSymbol))];
  if (draft.relevance === "direct" && symbols.length === 0) {
    return { ok: false, error: "Direct relevance needs a watchlist symbol." };
  }
  if (draft.relevance === "inferred" && !draft.relevanceNote.trim()) {
    return { ok: false, error: "Inferred relevance needs a note that says why." };
  }
  let interpretation: NewsItem["interpretation"] = null;
  if (draft.interpretation) {
    if (!STANCES.has(draft.interpretation.stance)) return { ok: false, error: "Interpretation stance is not recognized." };
    const note = cleanText(draft.interpretation.note, 2000).trim();
    if (!note) return { ok: false, error: "An interpretation needs a note. A bare stance is not saved." };
    interpretation = { stance: draft.interpretation.stance, note };
  }
  const published = isoOrNull(draft.publishedAt);
  const event = isoOrNull(draft.eventAt);
  if (!published.ok || !event.ok) return { ok: false, error: "A time could not be read. Leave it blank if it is unknown." };

  let x: XContext | null = null;
  if (draft.sourceId === "x_manual") {
    if (!draft.x) return { ok: false, error: "A pasted X post needs the name you saw." };
    const displayName = cleanText(draft.x.displayName, 120).trim();
    if (!displayName) return { ok: false, error: "A pasted X post needs the name you saw." };
    const handle = blankToNull(draft.x.handle, 80);
    x = {
      displayName,
      handle,
      numericId: blankToNull(draft.x.numericId, 40),
      identityStatus: "pending_verification",
      quotedText: blankToNull(draft.x.quotedText, 2000),
      repostContext: blankToNull(draft.x.repostContext, 2000),
      handleNote: handle ? "Typed by you. Not verified against an X id." : "Not provided. Not verified.",
    };
  }

  const source = attributableSources().find((entry) => entry.id === draft.sourceId);
  const item: NewsItem = {
    id: draft.id,
    demo: structural.demo,
    sourceId: draft.sourceId,
    sourceLabel: cleanText(draft.sourceLabel, 120).trim() || source?.label || draft.sourceId,
    url,
    author: blankToNull(draft.author, 160),
    headline,
    quote: blankToNull(draft.quote, 4000),
    publishedAt: published.value,
    eventAt: event.value,
    ingestedAt: draft.ingestedAt,
    revisions: structural.revisions,
    unknowns: [],
    symbols,
    relevance: draft.relevance,
    relevanceNote: blankToNull(draft.relevanceNote, 2000),
    extractedFact: blankToNull(draft.extractedFact, 2000),
    interpretation,
    rumor: draft.rumor,
    uncertainAttribution: draft.uncertainAttribution,
    x,
    correctionOfId: structural.correctionOfId,
    correctedById: structural.correctedById,
    duplicateOfId: structural.duplicateOfId,
  };
  item.unknowns = listUnknowns(item);
  return { ok: true, item };
}

export function addNewsItem(items: NewsItem[], draft: NewsDraft, mode: "primary" | "duplicate" | "correction"): NewsWriteResult {
  if (mode === "duplicate") {
    if (!draft.duplicateOfId) return { ok: false, error: "Choose the item this duplicates." };
    const original = items.find((item) => item.id === draft.duplicateOfId);
    if (!original) return { ok: false, error: "The original item is not in the library." };
    const built = buildItem(draft, {
      demo: false,
      revisions: [],
      correctionOfId: null,
      correctedById: null,
      duplicateOfId: original.id,
    });
    if (!built.ok) return built;
    return { ok: true, items: [...items, built.item] };
  }

  if (mode === "correction") {
    if (!draft.correctionOfId) return { ok: false, error: "Choose the item this corrects." };
    const original = items.find((item) => item.id === draft.correctionOfId);
    if (!original) return { ok: false, error: "The item being corrected is not in the library." };
    if (original.correctedById) return { ok: false, error: "That item already has a correction." };
    if (original.duplicateOfId) return { ok: false, error: "Correct the original item, not a duplicate." };
    const built = buildItem(draft, {
      demo: false,
      revisions: [],
      correctionOfId: original.id,
      correctedById: null,
      duplicateOfId: null,
    });
    if (!built.ok) return built;
    const clash = findDuplicate(items, dedupeKey(built.item), [original.id]);
    if (clash) return { ok: false, error: "That correction matches a different library item.", duplicateOfId: clash.id };
    return {
      ok: true,
      items: items.map((item) => (item.id === original.id ? { ...item, correctedById: built.item.id } : item)).concat(built.item),
    };
  }

  const built = buildItem(draft, {
    demo: false,
    revisions: [],
    correctionOfId: null,
    correctedById: null,
    duplicateOfId: null,
  });
  if (!built.ok) return built;
  const clash = findDuplicate(items, dedupeKey(built.item), []);
  if (clash) {
    return { ok: false, error: "This matches an item already in the library.", duplicateOfId: clash.id };
  }
  return { ok: true, items: [...items, built.item] };
}

export function reviseNewsItem(items: NewsItem[], id: string, draft: NewsDraft): NewsWriteResult {
  const current = items.find((item) => item.id === id);
  if (!current || current.demo) return { ok: false, error: "That item is not in the library." };
  const built = buildItem(
    { ...draft, id, ingestedAt: current.ingestedAt },
    {
      demo: false,
      revisions: current.revisions,
      correctionOfId: current.correctionOfId,
      correctedById: current.correctedById,
      duplicateOfId: current.duplicateOfId,
    },
  );
  if (!built.ok) return built;
  const clash = findDuplicate(items, dedupeKey(built.item), [id]);
  if (clash) return { ok: false, error: "The revision matches a different library item.", duplicateOfId: clash.id };
  const summary = revisionSummary(current, built.item);
  if (!summary) return { ok: false, error: "Nothing changed." };
  const revised: NewsItem = {
    ...built.item,
    revisions: [...current.revisions, { at: draft.ingestedAt, summary }],
  };
  return { ok: true, items: items.map((item) => (item.id === id ? revised : item)) };
}

function revisionSummary(before: NewsItem, after: NewsItem): string | null {
  const changed: string[] = [];
  if (before.headline !== after.headline) changed.push("headline");
  if (before.quote !== after.quote) changed.push("quote");
  if (before.url !== after.url) changed.push("URL");
  if (before.extractedFact !== after.extractedFact) changed.push("extracted fact");
  if (before.author !== after.author) changed.push("author");
  if (before.publishedAt !== after.publishedAt) changed.push("publish time");
  if (before.relevance !== after.relevance || before.relevanceNote !== after.relevanceNote) changed.push("relevance");
  if (JSON.stringify(before.interpretation) !== JSON.stringify(after.interpretation)) changed.push("interpretation");
  if (before.rumor !== after.rumor || before.uncertainAttribution !== after.uncertainAttribution) changed.push("flags");
  if (before.symbols.join(",") !== after.symbols.join(",")) changed.push("symbols");
  if (!changed.length) return null;
  return `Updated ${changed.join(", ")}`;
}

export type FeedQuery = {
  symbol: string;
  includeInferred: boolean;
  sourceId: string | "all";
  showCorrectedOriginals: boolean;
  showDuplicates: boolean;
  demo: boolean;
};

export type FeedGroups = {
  direct: NewsItem[];
  inferred: NewsItem[];
  unclear: NewsItem[];
};

function sortItems(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.publishedAt ?? a.eventAt ?? "");
    const bTime = Date.parse(b.publishedAt ?? b.eventAt ?? "");
    const aKey = Number.isNaN(aTime) ? Number.NEGATIVE_INFINITY : aTime;
    const bKey = Number.isNaN(bTime) ? Number.NEGATIVE_INFINITY : bTime;
    if (aKey !== bKey) return bKey - aKey;
    return b.ingestedAt.localeCompare(a.ingestedAt);
  });
}

export function groupNews(items: NewsItem[], query: FeedQuery): FeedGroups {
  const groups: FeedGroups = { direct: [], inferred: [], unclear: [] };
  for (const item of items) {
    if (item.demo && !query.demo) continue;
    if (item.duplicateOfId && !query.showDuplicates) continue;
    if (item.correctedById && !query.showCorrectedOriginals) continue;
    if (query.sourceId !== "all" && item.sourceId !== query.sourceId) continue;
    if (item.symbols.includes(query.symbol) && item.relevance === "direct") groups.direct.push(item);
    else if (
      item.relevance === "inferred" &&
      query.includeInferred &&
      (item.symbols.length === 0 || item.symbols.includes(query.symbol))
    ) {
      groups.inferred.push(item);
    } else if (item.relevance === "unknown" && item.symbols.includes(query.symbol)) groups.unclear.push(item);
  }
  return {
    direct: sortItems(groups.direct),
    inferred: sortItems(groups.inferred),
    unclear: sortItems(groups.unclear),
  };
}

export function duplicateCount(items: NewsItem[], id: string): number {
  return items.filter((item) => item.duplicateOfId === id).length;
}

export function evidenceFromNews(item: NewsItem, evidenceId: string, recordedAt: string): Evidence | { error: string } {
  if (item.demo) return { error: "Demo items cannot be attached as evidence." };
  const flagged = item.rumor || item.uncertainAttribution;
  const kind: EvidenceKind = flagged ? "manual_note" : "sourced_fact";
  const parts = [
    flagged ? "Flagged rumor or uncertain attribution. Not treated as a clean sourced fact." : null,
    `Headline: ${item.headline}`,
    item.quote ? `Original quote: ${item.quote}` : "No separate quote recorded.",
    item.publishedAt ? `Publish time: ${item.publishedAt}` : "Publish time unknown.",
    `Source: ${item.sourceLabel}`,
    item.extractedFact ? `Extracted fact: ${item.extractedFact}` : null,
    "Interpretation was not copied.",
  ].filter((part): part is string => Boolean(part));
  return {
    id: evidenceId,
    itemId: "fed_earnings",
    kind,
    text: cleanText(parts.join(" "), 2000),
    recordedAt,
    sourceUrl: item.url,
    sourceLabel: item.sourceLabel,
    publishedAt: item.publishedAt,
    eventAt: item.eventAt,
    eventDate: null,
    retrievedAt: item.ingestedAt,
    scope: item.relevance === "direct" ? "symbol" : item.relevance === "inferred" ? "macro" : "user",
  };
}
