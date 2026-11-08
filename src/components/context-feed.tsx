"use client";

import { useState } from "react";
import type { ActionResult } from "@/domain/actions";
import { TICKER_COVERAGE, partitionDirect } from "@/domain/coverage";
import { agePhrase, classifyFreshness, retrievalPhrase, titleBadge } from "@/domain/freshness";
import { duplicateCount, groupNews, type FeedQuery, type NewsDraft, type NewsItem } from "@/domain/news";
import { formatInstantEt } from "@/domain/time";
import type { FedPressItem } from "@/domain/fed-parse";
import type { FedLoadResult } from "@/server/fed-client";
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
  onAttachPress,
}: {
  symbol: string;
  items: NewsItem[];
  demo: boolean;
  now: Date;
  fed: FedLoadResult | null;
  onCommit: (draft: NewsDraft, mode: "primary" | "duplicate" | "correction" | "revise") => ActionResult;
  onAttach: (item: NewsItem) => void;
  onAttachPress: (item: FedPressItem) => void;
}) {
  const [query, setQuery] = useState<Pick<FeedQuery, "showCorrectedOriginals" | "showDuplicates">>({
    showCorrectedOriginals: false,
    showDuplicates: false,
  });
  const [form, setForm] = useState<"create" | { mode: "correction" | "revise"; id: string } | null>(null);
  const { recent, history } = partitionDirect(items, symbol, now, demo, query);
  const macro = groupNews(items, {
    symbol,
    includeInferred: true,
    sourceId: "all",
    showCorrectedOriginals: query.showCorrectedOriginals,
    showDuplicates: query.showDuplicates,
    demo,
  }).inferred;
  const editing = typeof form === "object" && form ? items.find((item) => item.id === form.id) : undefined;
  const press = fed?.press.data ?? [];
  const pressError = fed?.press.error ?? (fed ? null : "The monetary-policy feed has not returned yet.");

  return (
    <section className="panel" id="feed" aria-labelledby="feed-title">
      <h2 id="feed-title">Direct catalysts</h2>
      <p className="meta">{TICKER_COVERAGE}</p>
      <div className="inline-actions">
        <Button type="button" size="sm" onClick={() => setForm(form === "create" ? null : "create")}>
          Record a sourced item
        </Button>
      </div>
      {form === "create" ? <ItemForm mode="create" onCommit={onCommit} onClose={() => setForm(null)} /> : null}
      {recent.length === 0 ? (
        <p>
          <span className="unknown-word">Unknown</span>
          <span className="meta"> — no recent direct item is on file for {symbol}.</span>
        </p>
      ) : (
        recent.map((item) => (
          <FeedCard key={item.id} item={item} all={items} now={now} form={form} editing={editing} onForm={setForm} onCommit={onCommit} onAttach={onAttach} />
        ))
      )}
      <details>
        <summary>History · {history.length} older direct {history.length === 1 ? "item" : "items"}</summary>
        {history.length === 0 ? <p className="meta">No older direct item is on file. That is not “no catalysts.”</p> : null}
        {history.map((item) => (
          <FeedCard key={item.id} item={item} all={items} now={now} form={form} editing={editing} onForm={setForm} onCommit={onCommit} onAttach={onAttach} />
        ))}
      </details>
      <details>
        <summary>
          Macro context · not a {symbol} stream
          {fed ? ` · ${retrievalPhrase(fed.retrievedAt, now)}` : ""}
        </summary>
        <p className="meta">Federal Reserve titles stay here. A selected ticker does not make them company news. A meeting date is not a statement clock time.</p>
        {pressError ? (
          <p className="errors">
            Monetary-policy titles: <span className="unknown-word">Unknown</span>. {pressError}
          </p>
        ) : null}
        <ul className="compact-list">
          {press.map((item) => {
            const reading = classifyFreshness(item.publishedAt, null, now);
            return (
              <li key={item.url}>
                <span className="badge">{titleBadge(reading.freshness)}</span>{" "}
                <span className="meta">{agePhrase(item.publishedAt, now)}</span>
                {fed ? <span className="meta"> · {retrievalPhrase(fed.retrievedAt, now)}</span> : null}
                <p>{item.title}</p>
                <p className="meta">Not attributed to {symbol}. Author Unknown. Body not retrieved.</p>
                <SafeLink href={item.url}>Open release</SafeLink>{" "}
                <Button type="button" variant="outline" size="sm" onClick={() => onAttachPress(item)}>
                  Attach as macro evidence
                </Button>
              </li>
            );
          })}
        </ul>
        {macro.length ? <h3>Saved macro notes</h3> : null}
        {macro.map((item) => (
          <FeedCard key={item.id} item={item} all={items} now={now} form={form} editing={editing} onForm={setForm} onCommit={onCommit} onAttach={onAttach} />
        ))}
      </details>
      <div className="filters">
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
      </div>
    </section>
  );
}

function FeedCard({
  item,
  all,
  now,
  form,
  editing,
  onForm,
  onCommit,
  onAttach,
}: {
  item: NewsItem;
  all: NewsItem[];
  now: Date;
  form: "create" | { mode: "correction" | "revise"; id: string } | null;
  editing?: NewsItem;
  onForm: (form: "create" | { mode: "correction" | "revise"; id: string } | null) => void;
  onCommit: (draft: NewsDraft, mode: "primary" | "duplicate" | "correction" | "revise") => ActionResult;
  onAttach: (item: NewsItem) => void;
}) {
  const reading = classifyFreshness(item.publishedAt, item.eventAt, now);
  const earlier = item.correctionOfId ? all.find((entry) => entry.id === item.correctionOfId) : undefined;
  const copies = duplicateCount(all, item.id);
  return (
    <article className="item">
      <div className="badge-row">
        {item.demo ? <span className="badge badge-demo">DEMO</span> : null}
        <span className="badge">{titleBadge(reading.freshness)}</span>
        <span className="badge">{item.relevance === "direct" ? "Direct" : item.relevance === "inferred" ? "Inferred" : "Relevance unknown"}</span>
        {item.rumor ? <span className="badge badge-unknown">Rumor</span> : null}
        {item.correctedById ? <span className="badge">Corrected</span> : null}
      </div>
      <h3>{item.headline}</h3>
      <p className="meta">
        {item.sourceLabel}. {agePhrase(item.publishedAt ?? item.eventAt, now)}. Ingested {formatInstantEt(item.ingestedAt)}.{" "}
        {retrievalPhrase(item.ingestedAt, now)}.
      </p>
      <details>
        <summary>Quote, reading, and source</summary>
        {item.quote ? <blockquote className="quote"><p>{item.quote}</p></blockquote> : <p className="meta">No separate quote. The headline is the original text.</p>}
        {item.interpretation ? (
          <div className="interpretation">
            <p className="meta">Interpretation, separate from the headline</p>
            <p>{item.interpretation.stance}. {item.interpretation.note}</p>
          </div>
        ) : null}
        {item.relevance === "inferred" && item.relevanceNote ? <p>Why this is inferred: {item.relevanceNote}</p> : null}
        {item.relevance === "direct" ? <p className="meta">Direct because you named {item.symbols.join(", ") || "a symbol"} on this item.</p> : null}
        {item.url ? <SafeLink href={item.url}>Open original</SafeLink> : <p className="unknown-word">Original URL unknown</p>}
        {copies > 0 ? <p className="meta">{copies} duplicate{copies === 1 ? "" : "s"} hidden unless the duplicate filter is on.</p> : null}
        {earlier ? <p className="meta">Corrects: {earlier.headline}</p> : null}
      </details>
      {form && typeof form === "object" && form.id === item.id && editing ? (
        <ItemForm mode={form.mode} initial={editing} onCommit={onCommit} onClose={() => onForm(null)} />
      ) : null}
      <div className="inline-actions">
        <Button type="button" variant="outline" size="sm" disabled={item.demo} onClick={() => onAttach(item)}>
          {item.demo ? "Demo cannot become evidence" : "Attach to Fed and earnings"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={item.demo} onClick={() => onForm({ mode: "revise", id: item.id })}>
          Revise
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={item.demo || Boolean(item.duplicateOfId)} onClick={() => onForm({ mode: "correction", id: item.id })}>
          Correction
        </Button>
      </div>
    </article>
  );
}
