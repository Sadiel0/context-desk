import { namesSymbol, type AggregatorHeadline, type Mention } from "@/domain/ticker-feed";
import { cleanText } from "@/domain/text";
import { normalizeUrl } from "@/domain/urls";

export type RssParse = {
  items: AggregatorHeadline[];
  notices: string[];
};

export function parseYahooHeadlines(xml: string, symbol: string): RssParse {
  const notices = [
    "Yahoo Finance is an aggregator. A headline on the symbol feed is not publisher coverage and is not a quote from this desk.",
  ];
  if (!/<rss[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml)) {
    return { items: [], notices: ["The response was not an RSS feed. No headlines were invented."] };
  }
  const seen = new Set<string>();
  const items: AggregatorHeadline[] = [];
  for (const block of xml.split(/<item\b/i).slice(1)) {
    const title = cleanText(decodeXml(inner(block, "title") ?? ""), 400).trim();
    const link = normalizeUrl(stripYahooTracking(decodeXml(inner(block, "link") ?? "")));
    if (!title || !link) continue;
    if (seen.has(link)) continue;
    seen.add(link);
    const summaryRaw = cleanText(stripTags(decodeXml(inner(block, "description") ?? "")), 500).trim();
    const publishedAt = isoOrNull(inner(block, "pubDate"));
    const mention: Mention = namesSymbol(symbol, `${title} ${summaryRaw}`) ? "names_symbol" : "feed_association";
    let host = "unknown host";
    try {
      host = new URL(link).hostname;
    } catch {
      host = "unknown host";
    }
    items.push({
      id: link,
      title,
      url: link,
      publishedAt,
      feedSummary: summaryRaw || null,
      linkHost: host,
      mention,
    });
    if (items.length >= 20) break;
  }
  if (items.length === 0) notices.push("The feed contained no usable items. That is not a report of no catalysts.");
  return { items, notices };
}

function inner(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return null;
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function isoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(decodeXml(value).trim());
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function stripYahooTracking(value: string): string {
  try {
    const url = new URL(value.trim());
    for (const key of [...url.searchParams.keys()]) {
      if (key === ".tsrc" || key === "tsrc") url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value;
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
