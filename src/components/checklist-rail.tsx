"use client";

import { useState } from "react";
import { ADVISORY_LIMITS, TC2000_BOUNDARY } from "@/domain/limits";
import {
  CHECKLIST_ITEMS,
  EVIDENCE_KIND_LABEL,
  STATUS_LABEL,
  summarizeChecklist,
  type ChecklistItemId,
  type ChecklistSession,
  type ChecklistStatus,
  type Evidence,
  type EvidenceKind,
} from "@/domain/checklist";
import { formatInstantEt } from "@/domain/time";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SafeLink } from "@/components/safe-link";

export function ChecklistRail({
  checklist,
  onStatus,
  onEvidence,
}: {
  checklist: ChecklistSession;
  onStatus: (itemId: ChecklistItemId, status: ChecklistStatus) => void;
  onEvidence: (evidence: Omit<Evidence, "id" | "recordedAt">) => void;
}) {
  const summary = summarizeChecklist(checklist);
  return (
    <section className="panel" id="checklist" aria-labelledby="checklist-title">
      <h2 id="checklist-title">Checklist</h2>
      <p className="meta mono">
        {checklist.symbol} · {checklist.sessionDate} ET
      </p>
      <p>{TC2000_BOUNDARY}</p>
      <p>
        {summary.unknown} unknown, {summary.confirmed} confirmed, {summary.not_met} not met, {summary.not_applicable}{" "}
        not applicable. These counts do not block an order.
      </p>
      {CHECKLIST_ITEMS.map((item) => (
        <ChecklistRow key={item.id} itemId={item.id} checklist={checklist} onStatus={onStatus} onEvidence={onEvidence} />
      ))}
      <div className="item">
        <h3>Advisory limits</h3>
        <ul>
          {ADVISORY_LIMITS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ChecklistRow({
  itemId,
  checklist,
  onStatus,
  onEvidence,
}: {
  itemId: ChecklistItemId;
  checklist: ChecklistSession;
  onStatus: (itemId: ChecklistItemId, status: ChecklistStatus) => void;
  onEvidence: (evidence: Omit<Evidence, "id" | "recordedAt">) => void;
}) {
  const item = CHECKLIST_ITEMS.find((entry) => entry.id === itemId)!;
  const status = checklist.statuses[itemId];
  const [text, setText] = useState("");
  const [kind, setKind] = useState<EvidenceKind>(item.allowedEvidence[0]);
  const [error, setError] = useState<string | null>(null);
  const evidence = checklist.evidence.filter((entry) => entry.itemId === itemId);
  const detailId = `${itemId}-detail`;

  return (
    <article className="item">
      <h3>{item.title}</h3>
      <p id={detailId}>{item.detail}</p>
      <p className="meta">{item.provenance}</p>
      <fieldset className="status-list">
        <legend className="sr-only">{item.question}</legend>
        {(Object.keys(STATUS_LABEL) as ChecklistStatus[]).map((value) => (
          <label key={value} className={status === value ? value : undefined}>
            <input
              type="radio"
              name={`status-${itemId}`}
              value={value}
              checked={status === value}
              aria-describedby={detailId}
              onChange={() => onStatus(itemId, value)}
            />
            {STATUS_LABEL[value]}
          </label>
        ))}
      </fieldset>
      {checklist.statusSetAt[itemId] ? (
        <p className="meta">Status set {formatInstantEt(checklist.statusSetAt[itemId] ?? null)}.</p>
      ) : (
        <p className="meta">
          Status time: <span className="unknown-word">Unknown</span>
        </p>
      )}
      <p>{item.question}</p>
      {evidence.length === 0 ? <p className="meta">No evidence recorded.</p> : null}
      <ul>
        {evidence.map((entry) => (
          <li key={entry.id}>
            <span className="badge">{EVIDENCE_KIND_LABEL[entry.kind]}</span> {entry.text}{" "}
            <span className="meta">{formatInstantEt(entry.recordedAt)}</span>
            {entry.sourceUrl ? (
              <>
                {" "}
                <SafeLink href={entry.sourceUrl}>{entry.sourceLabel || "Source"}</SafeLink>
              </>
            ) : null}
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
          <p className="meta">Evidence kind: {EVIDENCE_KIND_LABEL[item.allowedEvidence[0]]}.</p>
        )}
        <label className="field">
          <span className="field-label">Evidence</span>
          <Textarea value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        {error ? <p className="errors">{error}</p> : null}
        <Button type="submit" variant="outline" size="sm">
          Add evidence. This does not change the status.
        </Button>
      </form>
    </article>
  );
}
