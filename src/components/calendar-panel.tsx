"use client";

import { useState } from "react";
import {
  EARNINGS_TIMING_LABEL,
  isEarningsTiming,
  type EarningsEvent,
  type EarningsTiming,
} from "@/domain/fundamentals";
import { describeMeeting, relateMeetings, type FomcMeeting } from "@/domain/fed-parse";
import { FED_CALENDAR_URL } from "@/domain/sources";
import { formatInstantEt } from "@/domain/time";
import type { FedLoadResult } from "@/server/fed-client";
import { instrumentFor } from "@/domain/watchlist";
import { Field } from "@/components/field";
import { SafeLink } from "@/components/safe-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CalendarPanel({
  symbol,
  sessionDate,
  result,
  loading,
  failed,
  onRefresh,
  onAttach,
  earnings,
  onAddEarnings,
  onRemoveEarnings,
}: {
  symbol: string;
  sessionDate: string;
  result: FedLoadResult | null;
  loading: boolean;
  failed: string | null;
  onRefresh: () => void;
  onAttach: (meeting: FomcMeeting) => void;
  earnings: EarningsEvent[];
  onAddEarnings: (event: Omit<EarningsEvent, "id" | "recordedAt">) => void;
  onRemoveEarnings: (id: string) => void;
}) {
  const instrument = instrumentFor(symbol);
  const year = Number(sessionDate.slice(0, 4));
  const meetings = result?.calendar.data ?? [];
  const relation = result?.calendar.error ? null : relateMeetings(meetings, sessionDate);
  const yearMeetings = meetings.filter((meeting) => meeting.year === year);

  return (
    <section className="panel" aria-labelledby="calendar-title">
      <h2 id="calendar-title">Calendar and earnings</h2>
      <p className="hint">A meeting date is not a statement time. Before open and after close are not clock times.</p>
      <div className="inline-actions">
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          Refresh Federal Reserve
        </Button>
        <SafeLink href={FED_CALENDAR_URL}>Open the FOMC calendar</SafeLink>
      </div>
      {loading ? <p role="status">Retrieving the Federal Reserve calendar and monetary-policy feed…</p> : null}
      {failed ? <p className="errors">{failed}</p> : null}
      {result ? (
        <>
          <p className="meta">Retrieved {formatInstantEt(result.retrievedAt)}.</p>
          {result.calendar.lastUpdate ? <p className="meta">Page last-update text: {result.calendar.lastUpdate}.</p> : null}
          {result.calendar.error ? <p className="errors">{result.calendar.error}</p> : null}
          {result.calendar.notices.map((notice) => (
            <p key={notice} className="hint">
              {notice}
            </p>
          ))}
          {relation ? (
            <div className="fact">
              {relation.onSession.length ? (
                <p>This session date falls on a scheduled meeting. The statement time is still not established.</p>
              ) : (
                <p>No parsed FOMC row covers this session date. Months without a row are not filled in, and this is not a monthly schedule.</p>
              )}
              {relation.next ? <MeetingFacts title="Next parsed meeting" meeting={relation.next} onAttach={onAttach} /> : <p>Next meeting: <span className="unknown-word">Unknown</span></p>}
              {relation.previous ? <MeetingFacts title="Previous parsed meeting" meeting={relation.previous} onAttach={onAttach} /> : null}
            </div>
          ) : null}
          {yearMeetings.length ? (
            <ul>
              {yearMeetings.map((meeting) => (
                <li key={`${meeting.year}-${meeting.monthLabel}-${meeting.startDate ?? meeting.dateWarning}`}>
                  {describeMeeting(meeting)}{" "}
                  {meeting.statementUrl ? <SafeLink href={meeting.statementUrl}>Statement</SafeLink> : null}{" "}
                  <Button type="button" variant="ghost" size="sm" onClick={() => onAttach(meeting)}>
                    Attach to Fed and earnings evidence
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <h3>Earnings for {symbol}</h3>
      {instrument?.kind === "index" ? (
        <p>SPX is an index. It does not have a company earnings release. A constituent event is a note you record, not a loaded calendar.</p>
      ) : (
        <p>No earnings feed is connected. OptionSlam before-open and after-close marks are not clock times.</p>
      )}
      {earnings.length === 0 ? <p className="meta">No earnings note for {symbol}.</p> : null}
      <ul>
        {earnings.map((event) => (
          <li key={event.id}>
            {event.eventDate || "Date unknown"} · {EARNINGS_TIMING_LABEL[event.timing]}
            {event.clockTimeNote ? ` · Clock note: ${event.clockTimeNote}` : " · Clock time unknown"}
            {event.note ? ` · ${event.note}` : ""}{" "}
            {event.sourceUrl ? <SafeLink href={event.sourceUrl}>{event.sourceLabel || "Source"}</SafeLink> : null}{" "}
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveEarnings(event.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <EarningsForm symbol={symbol} onAdd={onAddEarnings} />
    </section>
  );
}

function MeetingFacts({
  title,
  meeting,
  onAttach,
}: {
  title: string;
  meeting: FomcMeeting;
  onAttach: (meeting: FomcMeeting) => void;
}) {
  return (
    <p>
      {title}: {describeMeeting(meeting)}{" "}
      <Button type="button" variant="ghost" size="sm" onClick={() => onAttach(meeting)}>
        Attach
      </Button>
    </p>
  );
}

function EarningsForm({
  symbol,
  onAdd,
}: {
  symbol: string;
  onAdd: (event: Omit<EarningsEvent, "id" | "recordedAt">) => void;
}) {
  const [eventDate, setEventDate] = useState("");
  const [timing, setTiming] = useState<EarningsTiming>("unspecified");
  const [clockTimeNote, setClockTimeNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onAdd({
          symbol,
          eventDate,
          timing,
          clockTimeNote,
          sourceUrl: sourceUrl.trim() || null,
          sourceLabel,
          note,
        });
        setNote("");
        setSourceUrl("");
      }}
    >
      <div className="grid-2">
        <Field label="Earnings date" hint="Blank if unknown.">
          {(id, describedBy) => (
            <Input id={id} aria-describedby={describedBy} type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
          )}
        </Field>
        <label className="field">
          <span className="field-label">Timing mark</span>
          <select
            className="control"
            value={timing}
            onChange={(event) => {
              if (isEarningsTiming(event.target.value)) setTiming(event.target.value);
            }}
          >
            {Object.entries(EARNINGS_TIMING_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Field label="Clock-time note" hint="Leave blank when you do not have an hour.">
        {(id, describedBy) => (
          <Input id={id} aria-describedby={describedBy} value={clockTimeNote} placeholder="Unknown" onChange={(event) => setClockTimeNote(event.target.value)} />
        )}
      </Field>
      <Field label="Source label">
        {(id) => <Input id={id} value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} />}
      </Field>
      <Field label="Source URL">
        {(id) => <Input id={id} type="url" value={sourceUrl} placeholder="Unknown" onChange={(event) => setSourceUrl(event.target.value)} />}
      </Field>
      <Field label="Note">
        {(id) => <Textarea id={id} value={note} onChange={(event) => setNote(event.target.value)} />}
      </Field>
      <Button type="submit" variant="outline" size="sm">
        Save earnings note
      </Button>
    </form>
  );
}
