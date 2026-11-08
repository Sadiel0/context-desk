"use client";

import { useState } from "react";
import type { ActionResult } from "@/domain/actions";
import { classifyFreshness } from "@/domain/freshness";
import {
  duplicateCount,
  groupNews,
  type FeedQuery,
  type NewsDraft,
  type NewsItem,
} from "@/domain/news";
import { formatInstantEt } from "@/domain/time";
import type { FedLoadResult } from "@/server/fed-client";
import type { FedPressItem } from "@/domain/fed-parse";
import { ItemForm } from "@/components/item-form";
import { SafeLink } from "@/components/safe-link";
import { Button } from "@/components/ui/button";

export function ContextFeed({
  symbol,
  items,
  demo,
  now,
  fed,
  onCommit,
  onAttach,
  onSavePress,
}: {
  symbol: string;
  items: NewsItem[];
  demo: boolean;
  now: Date;
  fed: FedLoadResult | null;
  onCommit: (draft: NewsDraft, mode: "primary" | "duplicate" | "correction" | "revise") => ActionResult;
  onAttach: (item: NewsItem) => void;
  onSavePress: (item: FedPressItem) => void;
}) {
  const [query, setQuery] = useState<Omit<FeedQuery, "symbol" | "demo">>({
    includeInferred: true,
    sourceId: "all",
    showCorrectedOriginals: false,
    showDuplicates: false,
  });
  const [form, setForm] = useState<"create" | { mode: "correction" | "revise"; id: string } | null>(null);
  const groups = groupNews(items, { ...query, symbol, demo });
  const editing = typeof form === "object" && form ? items.find((item) => item.id === form.id) : undefined;

  return (
    <section className="panel" id="feed" aria-labelledby="feed-title">
      <h2 id="feed-title">Context feed</h2>
      <p className="hint">Original words stay separate from any reading you add. Nothing here is a trade signal.</p>
      <div className="inline-actions">
        <Button type="button" size="sm" onClick={() => setForm("create")}>
          Record a sourced item
        </Button>
      </div>
      {form === "create" ? (
        <ItemForm mode="create" onCommit={onCommit} onClose={() => setForm(null)} />
      ) : null}
      <h3>Federal Reserve headlines</h3>
      {!fed ? <p>The monetary-policy feed has not returned yet.</p> : null}
      {fed?.press.error ? (
        <p className="errors">
          {fed.press.error} <SafeLink href={fed.press.url}>Open the feed</SafeLink>
        </p>
      ) : null}
      {fed && !fed.press.error && fed.press.data.length === 0 ? <p>The feed returned no items.</p> : null}
      <ul>
        {fed?.press.data.map((item) => {
          const reading = classifyFreshness(item.publishedAt, null, now);
          const saved = items.some((entry) => entry.url === item.url);
          return (
            <li key={item.url} className="item">
              <div className="badge-row">
                <span className="badge badge-live">Live title</span>
                <span className={`badge ${reading.freshness === "unknown" ? "badge-unknown" : ""}`} title={reading.reason}>
                  {reading.freshness === "unknown" ? "Unknown time" : reading.freshness}
                </span>
                <span className="badge">Inferred</span>
              </div>
              <p>{item.title}</p>
              <p className="meta">
                Publish time: {item.publishedAt ? formatInstantEt(item.publishedAt) : <span className="unknown-word">Unknown</span>}
                . Author: <span className="unknown-word">Unknown</span>. Body not retrieved.
              </p>
              <p className="hint">Any link to {symbol} is inferred through rates or index products. The feed did not say so.</p>
              <SafeLink href={item.url}>Open release</SafeLink>{" "}
              <Button type="button" variant="outline" size="sm" disabled={saved} onClick={() => onSavePress(item)}>
                {saved ? "Already in the library" : "Save headline into the library"}
              </Button>
            </li>
          );
        })}
      </ul>
      {fed?.press.notices.map((notice) => (
        <p key={notice} className="hint">
          {notice}
        </p>
      ))}
      <h3>Your library</h3>
      <div className="filters">
        <label>
          <input
            type="checkbox"
            checked={query.includeInferred}
            onChange={(event) => setQuery((current) => ({ ...current, includeInferred: event.target.checked }))}
          />{" "}
          Inferred macro
        </label>
        <label>
          <input
            type="checkbox"
            checked={query.showCorrectedOriginals}
            onChange={(event) => setQuery((current) => ({ ...current, showCorrectedOriginals: event.target.checked }))}
          />{" "}
          Corrected originals
        </label>
        <label>
          <input
            type="checkbox"
            checked={query.showDuplicates}
            onChange={(event) => setQuery((current) => ({ ...current, showDuplicates: event.target.checked }))}
          />{" "}
          Duplicates
        </label>
        <label>
          Source
          <select
            className="control"
            value={query.sourceId}
            onChange={(event) => setQuery((current) => ({ ...current, sourceId: event.target.value }))}
          >
            <option value="all">All</option>
            {[...new Set(items.map((item) => item.sourceId))].map((sourceId) => (
              <option key={sourceId} value={sourceId}>
                {sourceId}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FeedGroup title={`Direct for ${symbol}`} items={groups.direct} empty={`No direct items for ${symbol}.`} all={items} now={now} form={form} editing={editing} onForm={setForm} onCommit={onCommit} onAttach={onAttach} />
      <FeedGroup title="Inferred" items={groups.inferred} empty="No inferred items for this view." all={items} now={now} form={form} editing={editing} onForm={setForm} onCommit={onCommit} onAttach={onAttach} />
      <FeedGroup title="Relevance not established" items={groups.unclear} empty="No items with unknown relevance for this symbol." all={items} now={now} form={form} editing={editing} onForm={setForm} onCommit={onCommit} onAttach={onAttach} />
    </section>
  );
}

function FeedGroup({
  title,
  items,
  empty,
  all,
  now,
  form,
  editing,
  onForm,
  onCommit,
  onAttach,
}: {
  title: string;
  items: NewsItem[];
  empty: string;
  all: NewsItem[];
  now: Date;
  form: "create" | { mode: "correction" | "revise"; id: string } | null;
  editing?: NewsItem;
  onForm: (form: "create" | { mode: "correction" | "revise"; id: string } | null) => void;
  onCommit: (draft: NewsDraft, mode: "primary" | "duplicate" | "correction" | "revise") => ActionResult;
  onAttach: (item: NewsItem) => void;
}) {
  return (
    <div>
      <h3>{title}</h3>
      {items.length === 0 ? <p className="meta">{empty}</p> : null}
      {items.map((item) => {
        const reading = classifyFreshness(item.publishedAt, item.eventAt, now);
        const earlier = item.correctionOfId ? all.find((entry) => entry.id === item.correctionOfId) : undefined;
        const copies = duplicateCount(all, item.id);
        return (
          <article key={item.id} className="item">
            <div className="badge-row">
              {item.demo ? <span className="badge badge-demo">DEMO</span> : null}
              <span className="badge">{item.sourceLabel}</span>
              <span className={`badge ${reading.freshness === "unknown" ? "badge-unknown" : ""}`} title={reading.reason}>
                {reading.freshness === "unknown" ? "Unknown time" : reading.freshness}
              </span>
              <span className="badge">{item.relevance}</span>
              {item.rumor ? <span className="badge badge-unknown">Rumor</span> : null}
              {item.uncertainAttribution ? <span className="badge badge-unknown">Attribution uncertain</span> : null}
              {item.correctedById ? <span className="badge badge-off">Corrected</span> : null}
              {item.duplicateOfId ? <span className="badge">Duplicate</span> : null}
            </div>
            <h3>{item.headline}</h3>
            {item.quote ? (
              <blockquote className="quote">
                <p>{item.quote}</p>
                <p className="meta">Original</p>
              </blockquote>
            ) : (
              <p className="hint">No separate quote was recorded. The headline is the original text.</p>
            )}
            {item.extractedFact ? (
              <div className="fact">
                <p className="meta">Sourced fact</p>
                <p>{item.extractedFact}</p>
              </div>
            ) : null}
            {item.interpretation ? (
              <div className="interpretation">
                <p className="meta">Interpretation, not a sourced fact</p>
                <p>
                  {item.interpretation.stance}. {item.interpretation.note}
                </p>
                <p className="hint">This reading is not a signal to buy or sell.</p>
              </div>
            ) : null}
            {item.x ? (
              <div className="fact">
                <p>
                  {item.x.displayName}. Handle: {item.x.handle ?? <span className="unknown-word">Unknown</span>}. Numeric id:{" "}
                  {item.x.numericId ?? <span className="unknown-word">Unknown</span>}. {item.x.handleNote} Identity: pending verification.
                </p>
                {item.x.quotedText ? <p>Quoted context: {item.x.quotedText}</p> : <p>Quoted context: <span className="unknown-word">Unknown</span></p>}
                {item.x.repostContext ? <p>Repost context: {item.x.repostContext}</p> : null}
                <p className="hint">A post being real would not make its contents true.</p>
              </div>
            ) : null}
            <p className="meta">
              Author: {item.author ?? <span className="unknown-word">Unknown</span>}. Published:{" "}
              {item.publishedAt ? formatInstantEt(item.publishedAt) : <span className="unknown-word">Unknown</span>}. Ingested:{" "}
              {formatInstantEt(item.ingestedAt)}.
            </p>
            {item.url ? <SafeLink href={item.url}>Open original</SafeLink> : <p className="unknown-word">Original URL unknown</p>}
            {item.relevance === "inferred" && item.relevanceNote ? <p>Inferred: {item.relevanceNote}</p> : null}
            <ul>
              {item.unknowns.map((line) => (
                <li key={line} className="unknown-word">
                  {line}
                </li>
              ))}
            </ul>
            {item.revisions.map((revision) => (
              <p key={`${revision.at}-${revision.summary}`} className="meta">
                Revised {formatInstantEt(revision.at)}: {revision.summary}
              </p>
            ))}
            {copies > 0 ? <p className="meta">{copies} duplicate{copies === 1 ? "" : "s"} hidden unless the duplicate filter is on.</p> : null}
            {earlier ? (
              <details>
                <summary>Earlier item this corrects</summary>
                <p>{earlier.headline}</p>
              </details>
            ) : null}
            {form && typeof form === "object" && form.id === item.id && editing ? (
              <ItemForm mode={form.mode} initial={editing} onCommit={onCommit} onClose={() => onForm(null)} />
            ) : null}
            <div className="inline-actions">
              <Button type="button" variant="outline" size="sm" disabled={item.demo} onClick={() => onAttach(item)}>
                {item.demo ? "Demo cannot become evidence" : "Attach to Fed and earnings evidence"}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={item.demo} onClick={() => onForm({ mode: "revise", id: item.id })}>
                Revise
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={item.demo || Boolean(item.duplicateOfId)} onClick={() => onForm({ mode: "correction", id: item.id })}>
                Record a correction
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
