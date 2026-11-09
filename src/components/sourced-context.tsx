"use client";

import { agePhrase, classifyFreshness, retrievalPhrase, titleBadge } from "@/domain/freshness";
import type { SecFiling } from "@/domain/sec-parse";
import { macroCue, watchlistMentions, type AggregatorHeadline, type TickerLoad } from "@/domain/ticker-feed";
import { WATCHLIST } from "@/domain/watchlist";
import { X_ALLOWLIST_PENDING } from "@/domain/sources";
import type { XDeskStatus, XPost } from "@/domain/x-snapshot";
import { SafeLink } from "@/components/safe-link";
import { Button } from "@/components/ui/button";

const SYMBOLS = WATCHLIST.map((instrument) => instrument.symbol);

export function SourcedContext({
  symbol,
  now,
  ticker,
  onAttachHeadline,
  onAttachFiling,
  x,
}: {
  symbol: string;
  now: Date;
  ticker: TickerLoad | null;
  onAttachHeadline: (item: AggregatorHeadline) => void;
  onAttachFiling: (filing: SecFiling) => void;
  x: XDeskStatus;
}) {
  if (!ticker) return null;
  const named = ticker.yahoo.items.filter((item) => item.mention === "names_symbol");
  const associated = ticker.yahoo.items.filter((item) => item.mention === "feed_association");
  const namedRecentAll = named.filter((item) => classifyFreshness(item.publishedAt, null, now).freshness !== "stale");
  const namedRecent = namedRecentAll.slice(0, 4);
  const namedMore = namedRecentAll.slice(4);
  const namedHistory = named.filter((item) => classifyFreshness(item.publishedAt, null, now).freshness === "stale");

  return (
    <>
      {ticker.yahoo.state === "error" ? (
        <p className="errors">
          Yahoo headlines: <span className="unknown-word">Unknown</span>. {ticker.yahoo.error}
        </p>
      ) : namedRecent.length === 0 ? (
        <p className="meta">
          No recent Yahoo headline names {symbol}. {namedHistory.length} older naming headline(s) are in history. {associated.length} feed item(s) do not name {symbol}.
        </p>
      ) : (
        <ul className="compact-list">
          {namedRecent.map((item) => (
            <HeadlineRow key={item.id} item={item} now={now} retrievedAt={ticker.retrievedAt} onAttach={onAttachHeadline} />
          ))}
        </ul>
      )}
      {namedMore.length ? (
        <details>
          <summary>More Yahoo headlines that name {symbol} · {namedMore.length}</summary>
          <ul className="compact-list">
            {namedMore.map((item) => (
              <HeadlineRow key={item.id} item={item} now={now} retrievedAt={ticker.retrievedAt} onAttach={onAttachHeadline} />
            ))}
          </ul>
        </details>
      ) : null}
      <details>
        <summary>Yahoo association · headline does not name {symbol} · {associated.length}</summary>
        <p className="meta">{ticker.yahoo.notice} These rows came back on the symbol feed. That is Yahoo’s association, not a direct mention and not publisher coverage.</p>
        <ul className="compact-list">
          {associated.map((item) => (
            <HeadlineRow key={item.id} item={item} now={now} retrievedAt={ticker.retrievedAt} onAttach={null} />
          ))}
        </ul>
      </details>
      <details>
        <summary>Older Yahoo headlines that name {symbol} · {namedHistory.length}</summary>
        <ul className="compact-list">
          {namedHistory.map((item) => (
            <HeadlineRow key={item.id} item={item} now={now} retrievedAt={ticker.retrievedAt} onAttach={onAttachHeadline} />
          ))}
        </ul>
      </details>
      <details>
        <summary>SEC issuer filings · {secSummary(ticker)} · {retrievalPhrase(ticker.retrievedAt, now)}</summary>
        <p className="meta">{ticker.sec.notice}</p>
        {ticker.sec.error ? (
          <p className="errors">
            Filings: <span className="unknown-word">Unknown</span>. {ticker.sec.error}
          </p>
        ) : null}
        {ticker.sec.name ? (
          <p className="meta">
            {ticker.sec.name}
            {ticker.sec.sic ? ` · ${ticker.sec.sic}` : ""}
            {ticker.sec.exchanges.length ? ` · ${ticker.sec.exchanges.join(", ")}` : ""}
          </p>
        ) : null}
        <ul className="compact-list">
          {ticker.sec.filings.map((filing) => (
            <li key={filing.accession}>
              <span className="badge">{filing.insider ? "Insider filing" : filing.form}</span>{" "}
              <span className="meta">{filing.acceptanceAt ? agePhrase(filing.acceptanceAt, now) : "Acceptance time Unknown"}</span>
              <p>
                {filing.form}
                {filing.description ? ` · ${filing.description}` : ""}
              </p>
              <p className="meta">
                Filing date {filing.filingDate ?? "Unknown"} is a date, not the business-event clock. Acceptance {filing.acceptanceAt ?? "Unknown"}.
              </p>
              <SafeLink href={filing.indexUrl}>Open filing index</SafeLink>{" "}
              {ticker.sec.state === "confirmed" || ticker.sec.state === "name_match" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onAttachFiling(filing)}>
                  Attach filing
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
      <XSweeper symbol={symbol} now={now} status={x} />
    </>
  );
}

function HeadlineRow({
  item,
  now,
  retrievedAt,
  onAttach,
}: {
  item: AggregatorHeadline;
  now: Date;
  retrievedAt: string;
  onAttach: ((item: AggregatorHeadline) => void) | null;
}) {
  const reading = classifyFreshness(item.publishedAt, null, now);
  return (
    <li>
      <span className="badge">{titleBadge(reading.freshness)}</span>{" "}
      <span className="badge">{item.mention === "names_symbol" ? "Names symbol" : "Feed association"}</span>{" "}
      <span className="meta">{agePhrase(item.publishedAt, now)}</span>
      <span className="meta"> · {retrievalPhrase(retrievedAt, now)}</span>
      <p>{item.title}</p>
      <p className="meta">
        Yahoo Finance aggregator. Link host {item.linkHost}. Not the publisher. Not a desk quote.
      </p>
      {item.feedSummary ? (
        <details>
          <summary>Yahoo feed summary</summary>
          <p className="meta">{item.feedSummary}</p>
        </details>
      ) : null}
      <SafeLink href={item.url}>Open link</SafeLink>{" "}
      {onAttach ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onAttach(item)}>
          Attach headline
        </Button>
      ) : null}
    </li>
  );
}

function secSummary(ticker: TickerLoad): string {
  if (ticker.sec.state === "confirmed") return "ticker confirmed";
  if (ticker.sec.state === "name_match") return "name match only";
  if (ticker.sec.state === "not_applicable") return "not an issuer";
  if (ticker.sec.state === "unconfirmed") return "Unknown";
  return "error";
}

function XSweeper({ symbol, now, status }: { symbol: string; now: Date; status: XDeskStatus }) {
  const named = status.posts.filter((post) => watchlistMentions(post.text, [symbol]).length > 0);
  const other = status.posts.filter((post) => watchlistMentions(post.text, [symbol]).length === 0);
  return (
    <details>
      <summary>
        X sweeper · {status.mode === "parent_snapshot" ? "parent snapshot, not live" : "Disconnected"} · polling off
      </summary>
      <p className="meta">{status.gap}</p>
      {status.error ? <p className="errors">{status.error}</p> : null}
      <p className="meta">Schema {status.schema}. Retrieved {status.retrievedAt ? retrievalPhrase(status.retrievedAt, now) : "never"}.</p>
      <ul className="compact-list">
        {status.identities.length === 0
          ? X_ALLOWLIST_PENDING.map((person) => (
              <li key={person.name}>
                {person.name}. Handle <span className="unknown-word">Unknown</span>. Numeric id <span className="unknown-word">Unknown</span>. Not monitored.
              </li>
            ))
          : status.identities.map((identity) => (
              <li key={identity.id}>
                {identity.name} @{identity.username} · id {identity.id}. Parent-supplied. This server did not re-check it.
              </li>
            ))}
      </ul>
      {named.map((post) => (
        <PostRow key={post.id} post={post} now={now} selected={symbol} />
      ))}
      {other.length ? (
        <details>
          <summary>Posts that do not name {symbol} · {other.length}</summary>
          {other.map((post) => (
            <PostRow key={post.id} post={post} now={now} selected={symbol} />
          ))}
        </details>
      ) : null}
    </details>
  );
}

function PostRow({ post, now, selected }: { post: XPost; now: Date; selected: string }) {
  const names = watchlistMentions(post.text, SYMBOLS);
  const cue = macroCue(post.text);
  return (
    <article className="item">
      <p className="meta">
        @{post.authorUsername} · {agePhrase(post.createdAt, now)} · original post text, not a fact check
      </p>
      <p>{post.text}</p>
      <p className="meta">
        {names.length ? `Text names ${names.join(", ")}.` : `Text does not name ${selected}.`}
        {cue ? ` Inferred macro cue: ${cue}. Not automatically this ticker.` : ""}
        {names.includes(selected) ? "" : ` Not a ${selected} stream.`}
      </p>
      {post.referenced.map((reference) => (
        <p key={`${reference.type}-${reference.id}`} className="meta">
          {reference.type} {reference.id}: {reference.text ?? "Quoted text not in the snapshot."}
        </p>
      ))}
      <SafeLink href={post.url}>Open post</SafeLink>
    </article>
  );
}
