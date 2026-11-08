"use client";

import { useState } from "react";
import type { ActionResult } from "@/domain/actions";
import type { NewsDraft, NewsItem, Relevance, Stance } from "@/domain/news";
import { attributableSources } from "@/domain/sources";
import { easternLocalToIso, isoToEasternLocal, zonedErrorMessage } from "@/domain/time";
import { WATCHLIST } from "@/domain/watchlist";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FormMode = "create" | "correction" | "revise";

export function ItemForm({
  mode,
  initial,
  duplicateOfId,
  onCommit,
  onClose,
}: {
  mode: FormMode;
  initial?: NewsItem;
  duplicateOfId?: string;
  onCommit: (draft: NewsDraft, mode: "primary" | "duplicate" | "correction" | "revise") => ActionResult;
  onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState(initial?.sourceId || "manual");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [quote, setQuote] = useState(initial?.quote ?? "");
  const [publishedLocal, setPublishedLocal] = useState(initial?.publishedAt ? isoToEasternLocal(initial.publishedAt) ?? "" : "");
  const [symbols, setSymbols] = useState<string[]>(initial?.symbols ?? []);
  const [relevance, setRelevance] = useState<Relevance>(initial?.relevance ?? "unknown");
  const [relevanceNote, setRelevanceNote] = useState(initial?.relevanceNote ?? "");
  const [extractedFact, setExtractedFact] = useState(initial?.extractedFact ?? "");
  const [stance, setStance] = useState<Stance | "none">(initial?.interpretation?.stance ?? "none");
  const [interpretationNote, setInterpretationNote] = useState(initial?.interpretation?.note ?? "");
  const [rumor, setRumor] = useState(initial?.rumor ?? false);
  const [uncertain, setUncertain] = useState(initial?.uncertainAttribution ?? false);
  const [displayName, setDisplayName] = useState(initial?.x?.displayName ?? "");
  const [handle, setHandle] = useState(initial?.x?.handle ?? "");
  const [numericId, setNumericId] = useState(initial?.x?.numericId ?? "");
  const [quotedText, setQuotedText] = useState(initial?.x?.quotedText ?? "");
  const [repostContext, setRepostContext] = useState(initial?.x?.repostContext ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<string | null>(duplicateOfId ?? null);

  function build(now: string): NewsDraft | string {
    let publishedAt: string | null = null;
    if (publishedLocal.trim()) {
      const zoned = easternLocalToIso(publishedLocal);
      if (!zoned.ok) return zonedErrorMessage(zoned.reason);
      publishedAt = zoned.iso;
    }
    return {
      id: mode === "revise" && initial ? initial.id : crypto.randomUUID(),
      sourceId,
      sourceLabel: "",
      url,
      author,
      headline,
      quote,
      publishedAt,
      eventAt: null,
      symbols,
      relevance,
      relevanceNote,
      extractedFact,
      interpretation: stance === "none" ? null : { stance, note: interpretationNote },
      rumor,
      uncertainAttribution: uncertain,
      x:
        sourceId === "x_manual"
          ? { displayName, handle, numericId, quotedText, repostContext }
          : null,
      correctionOfId: mode === "correction" && initial ? initial.id : null,
      duplicateOfId: null,
      ingestedAt: now,
    };
  }

  function submit(saveMode: "primary" | "duplicate" | "correction" | "revise", duplicateTarget?: string) {
    const now = new Date().toISOString();
    const draft = build(now);
    if (typeof draft === "string") {
      setError(draft);
      return;
    }
    const payload = duplicateTarget ? { ...draft, duplicateOfId: duplicateTarget } : draft;
    const result = onCommit(payload, saveMode);
    if (result.error) {
      setError(result.error);
      setPendingDuplicate(result.duplicateOfId ?? null);
      return;
    }
    onClose();
  }

  return (
    <form
      className="fact"
      onSubmit={(event) => {
        event.preventDefault();
        submit(mode === "revise" ? "revise" : mode === "correction" ? "correction" : "primary");
      }}
    >
      <h3>
        {mode === "create" ? "Record a sourced item" : mode === "correction" ? "Record a correction" : "Revise this item"}
      </h3>
      <p className="hint">
        The headline and quote stay the original words. A bullish or bearish note is stored separately and is not a buy or sell.
      </p>
      <label className="field">
        <span className="field-label">Source</span>
        <select className="control" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
          {attributableSources().map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      <Field label="Original URL" hint="http or https only. Leave blank if you do not have one.">
        {(id, describedBy) => (
          <Input id={id} aria-describedby={describedBy} type="url" value={url} placeholder="Unknown" onChange={(event) => setUrl(event.target.value)} />
        )}
      </Field>
      <Field label="Author" hint="Blank stays unknown.">
        {(id, describedBy) => (
          <Input id={id} aria-describedby={describedBy} value={author} placeholder="Unknown" onChange={(event) => setAuthor(event.target.value)} />
        )}
      </Field>
      <Field label="Headline">
        {(id) => <Input id={id} value={headline} onChange={(event) => setHeadline(event.target.value)} required />}
      </Field>
      <Field label="Original quote" hint="The words on the page. Leave blank if you only have the headline.">
        {(id, describedBy) => (
          <Textarea id={id} aria-describedby={describedBy} value={quote} onChange={(event) => setQuote(event.target.value)} />
        )}
      </Field>
      <Field label="Publish time, Eastern" hint="Blank if unknown.">
        {(id, describedBy) => (
          <Input id={id} aria-describedby={describedBy} type="datetime-local" value={publishedLocal} onChange={(event) => setPublishedLocal(event.target.value)} />
        )}
      </Field>
      <fieldset>
        <legend className="field-label">Symbols</legend>
        <div className="inline-actions">
          {WATCHLIST.map((instrument) => (
            <label key={instrument.symbol}>
              <input
                type="checkbox"
                checked={symbols.includes(instrument.symbol)}
                onChange={(event) =>
                  setSymbols((current) =>
                    event.target.checked ? [...current, instrument.symbol] : current.filter((symbol) => symbol !== instrument.symbol),
                  )
                }
              />{" "}
              {instrument.symbol}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label">Relevance</legend>
        {(["direct", "inferred", "unknown"] as const).map((value) => (
          <label key={value} className="meta">
            <input type="radio" name="relevance" checked={relevance === value} onChange={() => setRelevance(value)} /> {value}
          </label>
        ))}
      </fieldset>
      <Field label="Relevance note" hint="Required when relevance is inferred. Say why, including if the link is only rates, policy, or a company mention.">
        {(id, describedBy) => (
          <Textarea id={id} aria-describedby={describedBy} value={relevanceNote} onChange={(event) => setRelevanceNote(event.target.value)} />
        )}
      </Field>
      <Field label="Extracted fact" hint="Only what the source stated. Leave blank if you are not extracting a fact.">
        {(id, describedBy) => (
          <Textarea id={id} aria-describedby={describedBy} value={extractedFact} onChange={(event) => setExtractedFact(event.target.value)} />
        )}
      </Field>
      <label className="field">
        <span className="field-label">Interpretation</span>
        <select className="control" value={stance} onChange={(event) => setStance(event.target.value as Stance | "none")}>
          <option value="none">No interpretation</option>
          <option value="bullish">Bullish reading</option>
          <option value="bearish">Bearish reading</option>
          <option value="mixed">Mixed reading</option>
          <option value="unclear">Unclear reading</option>
        </select>
      </label>
      {stance !== "none" ? (
        <Field label="Interpretation note" hint="Required. This is not a sourced fact and not a signal.">
          {(id, describedBy) => (
            <Textarea id={id} aria-describedby={describedBy} value={interpretationNote} onChange={(event) => setInterpretationNote(event.target.value)} />
          )}
        </Field>
      ) : null}
      {sourceId === "x_manual" ? (
        <div className="fact">
          <p>Pasted post. A handle or id you type is not verified. This does not connect to X.</p>
          <Field label="Name you saw">
            {(id) => <Input id={id} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />}
          </Field>
          <Field label="Handle you saw" hint="Optional. Not an identity check.">
            {(id, describedBy) => (
              <Input id={id} aria-describedby={describedBy} value={handle} placeholder="Unknown" onChange={(event) => setHandle(event.target.value)} />
            )}
          </Field>
          <Field label="Numeric id you saw" hint="Optional. Typing it does not verify it.">
            {(id, describedBy) => (
              <Input id={id} aria-describedby={describedBy} value={numericId} placeholder="Unknown" onChange={(event) => setNumericId(event.target.value)} />
            )}
          </Field>
          <Field label="Quoted or reposted text">
            {(id) => <Textarea id={id} value={quotedText} onChange={(event) => setQuotedText(event.target.value)} />}
          </Field>
          <Field label="Repost context">
            {(id) => <Textarea id={id} value={repostContext} onChange={(event) => setRepostContext(event.target.value)} />}
          </Field>
        </div>
      ) : null}
      <label>
        <input type="checkbox" checked={rumor} onChange={(event) => setRumor(event.target.checked)} /> Rumor or unconfirmed
      </label>
      <label>
        <input type="checkbox" checked={uncertain} onChange={(event) => setUncertain(event.target.checked)} /> Attribution uncertain
      </label>
      {error ? <p className="errors">{error}</p> : null}
      {pendingDuplicate ? (
        <p>
          This matches an item already in the library.{" "}
          <Button type="button" size="sm" variant="outline" onClick={() => submit("duplicate", pendingDuplicate)}>
            Mark this submission as a duplicate
          </Button>
        </p>
      ) : null}
      <div className="inline-actions">
        <Button type="submit">{mode === "revise" ? "Save revision" : mode === "correction" ? "Save correction" : "Save item"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}
