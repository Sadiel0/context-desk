"use client";

import { useState } from "react";
import { displayOrUnknown, fieldMode, type Fundamentals } from "@/domain/fundamentals";
import { normalizeUrl } from "@/domain/urls";
import { instrumentFor } from "@/domain/watchlist";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function FundamentalsPanel({
  symbol,
  value,
  onChange,
}: {
  symbol: string;
  value: Fundamentals;
  onChange: (value: Fundamentals) => void;
}) {
  const instrument = instrumentFor(symbol);
  const mode = instrument ? fieldMode(instrument.kind) : null;
  const [urlError, setUrlError] = useState<string | null>(null);
  if (!instrument || !mode) return null;
  const set = (patch: Partial<Fundamentals>) => onChange({ ...value, ...patch });

  function commitUrl(key: "marketCapSourceUrl" | "analystSourceUrl" | "recommendationSourceUrl", raw: string) {
    if (!raw.trim()) {
      setUrlError(null);
      set({ [key]: null });
      return;
    }
    const url = normalizeUrl(raw);
    if (!url) {
      setUrlError("Only http and https links can be saved.");
      return;
    }
    setUrlError(null);
    set({ [key]: url });
  }

  return (
    <section className="panel" aria-labelledby="fundamentals-title">
      <h2 id="fundamentals-title">Fundamentals</h2>
      <p className="meta">Entered by you. Empty fields stay unknown. Nothing here is a live lookup.</p>
      {instrument.identity ? <p>{instrument.identity}</p> : null}
      <dl className="math">
        <div>
          <dt>Index membership</dt>
          <dd>{value.indexMembership.trim() ? value.indexMembership : <span className="unknown-word">Unknown</span>}</dd>
        </div>
        <div>
          <dt>Market cap</dt>
          <dd>{value.marketCap.trim() ? value.marketCap : <span className="unknown-word">Unknown</span>}</dd>
        </div>
        <div>
          <dt>Analyst target, stock</dt>
          <dd>
            {mode.analystTarget === "not_applicable" ? (
              "Not applicable. A single-stock target is not used for this ETF or index, and it is not an option target."
            ) : value.analystTarget.trim() ? (
              value.analystTarget
            ) : (
              <span className="unknown-word">Unknown</span>
            )}
          </dd>
          <dd className="hint">Not a scalp exit. Horizon: {value.analystHorizon.trim() || "not stated"}.</dd>
        </div>
        <div>
          <dt>Stock recommendation</dt>
          <dd>
            {mode.recommendation === "not_applicable" ? (
              "Not applicable. Stock recommendations are not used for ETFs, indexes, or options."
            ) : value.stockRecommendation.trim() ? (
              value.stockRecommendation
            ) : (
              <span className="unknown-word">Unknown</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Insider context</dt>
          <dd>
            {mode.insider === "not_applicable" ? (
              "Not applicable. Company insider context is not used for an ETF or the index."
            ) : value.insiderContext.trim() ? (
              value.insiderContext
            ) : (
              <span className="unknown-word">Unknown</span>
            )}
          </dd>
        </div>
      </dl>
      <Field label="Company or product name">
        {(id) => <Input id={id} value={value.displayName} onChange={(event) => set({ displayName: event.target.value })} />}
      </Field>
      <Field label="Index membership" hint="Leave blank for unknown. This desk does not look it up.">
        {(id, describedBy) => (
          <Input id={id} aria-describedby={describedBy} value={value.indexMembership} placeholder="Unknown" onChange={(event) => set({ indexMembership: event.target.value })} />
        )}
      </Field>
      <Field label="Market cap, as you read it" hint="Include the as-of date in the text if you have it. Blank stays unknown.">
        {(id, describedBy) => (
          <Input id={id} aria-describedby={describedBy} value={value.marketCap} placeholder="Unknown" onChange={(event) => set({ marketCap: event.target.value })} />
        )}
      </Field>
      <UrlField label="Market-cap source URL" initial={value.marketCapSourceUrl} onCommit={(raw) => commitUrl("marketCapSourceUrl", raw)} />
      {mode.analystTarget === "enter" ? (
        <>
          <div className="grid-2">
            <Field label="Firm">
              {(id) => <Input id={id} value={value.analystFirm} placeholder="Unknown" onChange={(event) => set({ analystFirm: event.target.value })} />}
            </Field>
            <Field label="Analyst">
              {(id) => <Input id={id} value={value.analystName} placeholder="Unknown" onChange={(event) => set({ analystName: event.target.value })} />}
            </Field>
          </div>
          <Field label="Valuation target" hint="Attributed stock target. Not a scalp exit and not an option price.">
            {(id, describedBy) => (
              <Input id={id} aria-describedby={describedBy} value={value.analystTarget} placeholder="Unknown" onChange={(event) => set({ analystTarget: event.target.value })} />
            )}
          </Field>
          <div className="grid-2">
            <Field label="Target date" hint="Blank if the source did not state one.">
              {(id, describedBy) => (
                <Input id={id} aria-describedby={describedBy} value={value.analystTargetDate} placeholder="Unknown" onChange={(event) => set({ analystTargetDate: event.target.value })} />
              )}
            </Field>
            <Field label="Horizon" hint="Leave blank when the source does not state a horizon. Do not assume one.">
              {(id, describedBy) => (
                <Input id={id} aria-describedby={describedBy} value={value.analystHorizon} placeholder="Not stated" onChange={(event) => set({ analystHorizon: event.target.value })} />
              )}
            </Field>
          </div>
          <UrlField label="Target source URL" initial={value.analystSourceUrl} onCommit={(raw) => commitUrl("analystSourceUrl", raw)} />
          <Field label="Stock recommendation" hint="Stocks only. Not an option recommendation.">
            {(id, describedBy) => (
              <Input id={id} aria-describedby={describedBy} value={value.stockRecommendation} placeholder="Unknown" onChange={(event) => set({ stockRecommendation: event.target.value })} />
            )}
          </Field>
          <Field label="Recommendation date">
            {(id) => (
              <Input id={id} value={value.recommendationDate} placeholder="Unknown" onChange={(event) => set({ recommendationDate: event.target.value })} />
            )}
          </Field>
          <UrlField label="Recommendation source URL" initial={value.recommendationSourceUrl} onCommit={(raw) => commitUrl("recommendationSourceUrl", raw)} />
          <Field label="Insider context" hint="Blank means unknown, not that nothing happened.">
            {(id, describedBy) => (
              <Textarea id={id} aria-describedby={describedBy} value={value.insiderContext} placeholder="Unknown" onChange={(event) => set({ insiderContext: event.target.value })} />
            )}
          </Field>
        </>
      ) : null}
      <Field label="Context note">
        {(id) => <Textarea id={id} value={value.contextNote} onChange={(event) => set({ contextNote: event.target.value })} />}
      </Field>
      {urlError ? <p className="errors">{urlError}</p> : null}
      <p className="meta">Displayed name: {displayOrUnknown(value.displayName)}</p>
    </section>
  );
}

function UrlField({ label, initial, onCommit }: { label: string; initial: string | null; onCommit: (raw: string) => void }) {
  const [draft, setDraft] = useState(initial ?? "");
  return (
    <Field label={label} hint="Blank if you do not have a link.">
      {(id, describedBy) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          type="url"
          value={draft}
          placeholder="Unknown"
          onChange={(event) => {
            setDraft(event.target.value);
            onCommit(event.target.value);
          }}
        />
      )}
    </Field>
  );
}
