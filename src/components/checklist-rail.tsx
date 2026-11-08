"use client";

import { useState } from "react";
import {
  CHECKLIST_ITEMS,
  EVIDENCE_KIND_LABEL,
  EVIDENCE_SCOPE_LABEL,
  OBSERVATION_LABEL,
  REVIEW_LABEL,
  setupNoteIsBlank,
  summarizeChecklist,
  type ChecklistItemId,
  type ChecklistSession,
  type Evidence,
  type EvidenceKind,
  type Observation,
  type ReviewMark,
  type SetupNote,
} from "@/domain/checklist";
import { agePhrase, retrievalPhrase } from "@/domain/freshness";
import { formatInstantEt } from "@/domain/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SafeLink } from "@/components/safe-link";

export function ChecklistRail({
  checklist,
  now,
  onReview,
  onObservation,
  onEvidence,
  onSetup,
  setupError,
}: {
  checklist: ChecklistSession;
  now: Date;
  onReview: (itemId: ChecklistItemId, review: ReviewMark) => void;
  onObservation: (itemId: ChecklistItemId, observation: Observation) => void;
  onEvidence: (evidence: Omit<Evidence, "id" | "recordedAt">) => void;
  onSetup: (note: SetupNote) => void;
  setupError: string | null;
}) {
  const summary = summarizeChecklist(checklist);
  return (
    <section className="panel" id="checklist" aria-labelledby="checklist-title">
      <h2 id="checklist-title">Checklist</h2>
      <p className="meta">
        {summary.unreviewed} unreviewed · {summary.reviewed} reviewed · {summary.observationUnknown} unknown observations. Not a trade score.
      </p>
      {CHECKLIST_ITEMS.map((item) => (
        <ChecklistRow
          key={item.id}
          itemId={item.id}
          checklist={checklist}
          now={now}
          onReview={onReview}
          onObservation={onObservation}
          onEvidence={onEvidence}
        />
      ))}
      <SetupNoteForm note={checklist.setup} error={setupError} onSetup={onSetup} />
    </section>
  );
}

function ChecklistRow({
  itemId,
  checklist,
  now,
  onReview,
  onObservation,
  onEvidence,
}: {
  itemId: ChecklistItemId;
  checklist: ChecklistSession;
  now: Date;
  onReview: (itemId: ChecklistItemId, review: ReviewMark) => void;
  onObservation: (itemId: ChecklistItemId, observation: Observation) => void;
  onEvidence: (evidence: Omit<Evidence, "id" | "recordedAt">) => void;
}) {
  const item = CHECKLIST_ITEMS.find((entry) => entry.id === itemId)!;
  const review = checklist.reviews[itemId];
  const observation = checklist.observations[itemId];
  const evidence = checklist.evidence.filter((entry) => entry.itemId === itemId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<EvidenceKind>(item.allowedEvidence[0]);
  const [error, setError] = useState<string | null>(null);

  return (
    <article className="check-row">
      <p className="check-title" title={item.titleEn}>
        <span lang="es">{item.titleEs}</span>
        <span className="en" lang="en">
          {item.rowEn}
        </span>
        <button type="button" className="text-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {evidence.length === 0 ? "Note" : `Note ${evidence.length}`}
        </button>
      </p>
      <div className="mark-line">
        <fieldset className="status-list">
          <legend className="sr-only">Review for {item.titleEn}</legend>
          {(Object.keys(REVIEW_LABEL) as ReviewMark[]).map((value) => (
            <label key={value} className={value}>
              <input
                type="radio"
                name={`review-${itemId}`}
                value={value}
                checked={review === value}
                onChange={() => onReview(itemId, value)}
              />
              {REVIEW_LABEL[value]}
            </label>
          ))}
        </fieldset>
        <fieldset className="status-list">
          <legend className="sr-only">Observation for {item.titleEn}</legend>
          {(Object.keys(OBSERVATION_LABEL) as Observation[]).map((value) => (
            <label key={value} className={value} title={OBSERVATION_LABEL[value]}>
              <input
                type="radio"
                name={`observation-${itemId}`}
                value={value}
                checked={observation === value}
                aria-label={OBSERVATION_LABEL[value]}
                onChange={() => onObservation(itemId, value)}
              />
              {value === "not_observed" ? "Not seen" : value === "not_applicable" ? "N/A" : OBSERVATION_LABEL[value]}
            </label>
          ))}
        </fieldset>
      </div>
      {open ? (
        <div className="evidence-drawer">
          {evidence.length === 0 ? <p className="meta">No evidence on this row. That is not the same as a clear condition.</p> : null}
          <ul className="evidence-list">
            {evidence.map((entry) => (
              <li key={entry.id}>
                <span className="badge">{EVIDENCE_KIND_LABEL[entry.kind]}</span>{" "}
                <span className="badge">{EVIDENCE_SCOPE_LABEL[entry.scope]}</span>{" "}
                <span className="meta">{agePhrase(entry.publishedAt ?? entry.eventAt, now)}</span>
                {entry.eventDate ? <span className="meta"> · Event date {entry.eventDate} · clock Unknown</span> : null}
                <span className="meta"> · {retrievalPhrase(entry.retrievedAt, now)}</span>
                <p>{entry.text}</p>
                {entry.sourceUrl ? <SafeLink href={entry.sourceUrl}>{entry.sourceLabel || "Source"}</SafeLink> : null}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!text.trim()) {
                setError("Evidence text is empty.");
                return;
              }
              onEvidence({
                itemId,
                kind,
                text,
                sourceUrl: null,
                sourceLabel: kind === "tc2000_user" ? "TC2000" : null,
                publishedAt: null,
                eventAt: null,
                eventDate: null,
                retrievedAt: null,
                scope: "user",
              });
              setText("");
              setError(null);
            }}
          >
            {item.allowedEvidence.length > 1 ? (
              <label className="field">
                <span className="field-label">Evidence kind</span>
                <select className="control" value={kind} onChange={(event) => setKind(event.target.value as EvidenceKind)}>
                  {item.allowedEvidence.map((allowed) => (
                    <option key={allowed} value={allowed}>
                      {EVIDENCE_KIND_LABEL[allowed]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="meta">Kind: {EVIDENCE_KIND_LABEL[item.allowedEvidence[0]]}. Saving this does not change review or observation.</p>
            )}
            <label className="field">
              <span className="field-label">Note</span>
              <Textarea value={text} onChange={(event) => setText(event.target.value)} />
            </label>
            {error ? <p className="errors">{error}</p> : null}
            <Button type="submit" variant="outline" size="sm">
              Save note
            </Button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function SetupNoteForm({
  note,
  error,
  onSetup,
}: {
  note: SetupNote;
  error: string | null;
  onSetup: (note: SetupNote) => void;
}) {
  const summary = setupNoteIsBlank(note)
    ? "Not recorded"
    : note.observedAt
      ? `Noted ${formatInstantEt(note.observedAt)}`
      : "Noted, time unknown";
  return (
    <details className="setup-note">
      <summary>TC2000 setup note · optional · {summary}</summary>
      <p className="meta">
        Personal sequence, separate from the six rows. A new session starts blank. No threshold and no close-only rule are built in.
      </p>
      <SetupField label="Lateral or squeeze" value={note.lateralOrSqueeze} onChange={(lateralOrSqueeze) => onSetup({ ...note, lateralOrSqueeze })} />
      <SetupField label="Bands widening" value={note.bandsWidening} onChange={(bandsWidening) => onSetup({ ...note, bandsWidening })} />
      <SetupField label="Directional band exit" value={note.directionalExit} onChange={(directionalExit) => onSetup({ ...note, directionalExit })} />
      <SetupField label="Directional or non-neutral candle" value={note.candle} onChange={(candle) => onSetup({ ...note, candle })} />
      <SetupField label="Nearby tested line or moving average" value={note.nearbyLineOrMa} onChange={(nearbyLineOrMa) => onSetup({ ...note, nearbyLineOrMa })} />
      <SetupField label="Extension judgment" value={note.extensionJudgment} onChange={(extensionJudgment) => onSetup({ ...note, extensionJudgment })} />
      <label className="field">
        <span className="field-label">TC2000 observation time, Eastern</span>
        <Input
          type="datetime-local"
          value={note.observedAtLocal}
          onChange={(event) => onSetup({ ...note, observedAtLocal: event.target.value })}
        />
      </label>
      <SetupField label="Setup version" value={note.setupVersion} onChange={(setupVersion) => onSetup({ ...note, setupVersion })} />
      {error ? <p className="errors">{error}</p> : null}
    </details>
  );
}

function SetupField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <Input value={value} placeholder="Not recorded" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
