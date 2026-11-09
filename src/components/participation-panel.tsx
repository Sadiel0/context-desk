"use client";

import { useEffect, useState } from "react";
import type { ActionResult } from "@/domain/actions";
import {
  ALIGNMENT_DEFINITION,
  INTRADAY_FEED,
  RVOL_FORMULA,
  directionKey,
  marketAlignment,
  regularWindows,
  relativeVolume,
  type BarDraft,
  type ParticipationBook,
  type SetupDirection,
} from "@/domain/participation";
import { blockComparison } from "@/domain/blocks";
import { TAPE_DETAIL, tapeRows } from "@/domain/tape";
import { easternLocalToIso, formatInstantEt, zonedErrorMessage } from "@/domain/time";
import { COMPARISON_SYMBOLS, WATCHLIST } from "@/domain/watchlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WINDOWS = regularWindows();

export function ParticipationPanel({
  symbol,
  sessionDate,
  book,
  onDirection,
  onSave,
  onRemove,
  onImport,
}: {
  symbol: string;
  sessionDate: string;
  book: ParticipationBook;
  onDirection: (direction: SetupDirection) => void;
  onSave: (draft: BarDraft) => ActionResult;
  onRemove: (id: string) => void;
  onImport: (raw: unknown) => ActionResult;
}) {
  const [windowStart, setWindowStart] = useState(WINDOWS[2]?.start ?? "10:00");
  const window = WINDOWS.find((entry) => entry.start === windowStart) ?? WINDOWS[0];
  const direction = book.directions[directionKey(symbol, sessionDate)] ?? "unset";
  const rvol = relativeVolume(book.bars, symbol, sessionDate, window.start);
  const alignment = marketAlignment(book.bars, symbol, sessionDate, window, direction);
  const current = book.bars.find(
    (bar) => bar.symbol === symbol && bar.sessionDate === sessionDate && bar.windowStart === window.start,
  );
  const slot = book.bars.filter((bar) => bar.symbol === symbol && bar.windowStart === window.start);

  const rows = tapeRows(symbol);
  const block = blockComparison(book.bars, symbol, sessionDate, window);
  const rvolFigure = rvol.state === "ratio" ? rvol.ratio.toFixed(2) : rvol.state === "not_applicable" ? "N/A" : "Unknown";

  return (
    <section className="panel tape" id="participation" aria-labelledby="participation-title">
      <div className="tape-head">
        <h2 id="participation-title">Tape</h2>
        <p className={rvol.state === "ratio" ? "rvol-figure" : "rvol-figure unknown-word"}>{rvolFigure}</p>
        <p className="meta">RVOL · {window.start}–{window.end} ET · baseline {rvol.sampleCount}</p>
      </div>
      <p className="result-line">
        15m {labelCombined(alignment.windowCombined)} · since open {labelCombined(alignment.intradayCombined)}
        {symbol === "SPCX" ? " · SPCX tape, not TSLA" : ""}
      </p>
      <p className="meta">
        Setup SPY {showChange(alignment.spy.change15)} {alignment.spy.class15} · open {showChange(alignment.spy.changeIntraday)} {alignment.spy.classIntraday}
        {" · "}
        QQQ {showChange(alignment.qqq.change15)} {alignment.qqq.class15} · open {showChange(alignment.qqq.changeIntraday)} {alignment.qqq.classIntraday}
      </p>
      <div className="block-line">
        <p className="meta">
          Block {block.windowLabel} · manual · 15m {block.windowGroup} · since open {block.sessionGroup}
        </p>
        <ul className="block-members">
          {block.legs.map((leg) => (
            <li key={leg.symbol} className={leg.selected ? "block-on" : undefined}>
              <span className="mono">{leg.symbol}</span>
              <span>{leg.coverage === "present" ? formatPct(leg.change15Pct) : coverageWord(leg.coverage)}</span>
              <span className="meta">open {leg.coverage === "present" ? formatPct(leg.sessionPct) : "—"}</span>
            </li>
          ))}
        </ul>
      </div>
      <table className="ledger">
        <tbody>
          {rows.map((row) => (
            <tr key={row.kind}>
              <th scope="row">{row.label}</th>
              <td className={row.availability === "unavailable" ? "status-off" : row.availability === "manual" ? "status-manual" : "unknown-word"}>
                {row.kind === "bar_volume" && current?.volume != null ? `${current.volume.toLocaleString("en-US")} · ${row.status}` : row.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="filters">
        <label>
          Window
          <select className="control" value={window.start} onChange={(event) => setWindowStart(event.target.value)} aria-label="15-minute window">
            {WINDOWS.map((entry) => (
              <option key={entry.start} value={entry.start}>
                {entry.start}–{entry.end}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="mark-line">
          <legend className="sr-only">Setup direction</legend>
          {(
            [
              ["unset", "Unset"],
              ["call_up", "Call / up"],
              ["put_down", "Put / down"],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="setup-direction" checked={direction === value} onChange={() => onDirection(value)} /> {label}
            </label>
          ))}
        </fieldset>
      </div>
      <details>
        <summary>How this tape is read</summary>
        <p>{TAPE_DETAIL}</p>
        <p className="meta">{rvol.text}</p>
        <p className="meta">{alignment.note}</p>
        <p className="meta">{block.note}</p>
        <p className="meta">
          Source {current?.sourceLabel ?? "no bar entered"} · delay {current?.delayNote ?? "Unknown"} · quote{" "}
          {current?.asOf ? formatInstantEt(current.asOf) : "Unknown"} · entered {current ? formatInstantEt(current.observedAt) : "never"}. Entered time is not a market-data timestamp.
        </p>
        <p>{RVOL_FORMULA}</p>
        <p>{ALIGNMENT_DEFINITION}</p>
        <p className="meta">{INTRADAY_FEED.reason}</p>
      </details>
      <details>
        <summary>Enter or import a bar · {slot.length} stored</summary>
        <BarForm symbol={symbol} sessionDate={sessionDate} windowStart={window.start} windowEnd={window.end} onSave={onSave} />
        <ImportForm onImport={onImport} />
        <ul className="compact-list">
          {slot.map((bar) => (
            <li key={bar.id}>
              {bar.sessionDate} {bar.windowStart}–{bar.windowEnd} ET · volume {bar.volume ?? "missing"} · {bar.partial ? "partial · " : ""}
              {bar.closedSession ? "closed · " : ""}
              {bar.sourceLabel}
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(bar.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function labelCombined(value: string): string {
  if (value === "unset" || value === "unknown" || value === "incomplete") return value === "unset" ? "direction unset" : value;
  return value;
}

function showChange(value: number | null): string {
  if (value === null) return "Unknown";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unknown";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function coverageWord(coverage: string): string {
  if (coverage === "partial") return "partial";
  if (coverage === "mismatch") return "other window";
  if (coverage === "closed") return "closed";
  return "Unknown";
}

function BarForm({
  symbol,
  sessionDate,
  windowStart,
  windowEnd,
  onSave,
}: {
  symbol: string;
  sessionDate: string;
  windowStart: string;
  windowEnd: string;
  onSave: (draft: BarDraft) => ActionResult;
}) {
  const [barSymbol, setBarSymbol] = useState(symbol);
  const [date, setDate] = useState(sessionDate);
  useEffect(() => {
    setBarSymbol(symbol);
    setDate(sessionDate);
  }, [symbol, sessionDate]);
  const [volume, setVolume] = useState("");
  const [open, setOpen] = useState("");
  const [close, setClose] = useState("");
  const [sessionOpen, setSessionOpen] = useState("");
  const [partial, setPartial] = useState(false);
  const [closedSession, setClosedSession] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [asOfLocal, setAsOfLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const volumeBlocked = barSymbol === "SPX";

  function save() {
    const asOf = asOfLocal.trim() ? easternLocalToIso(asOfLocal.trim()) : { ok: true as const, iso: null };
    if (!asOf.ok) {
      setError(zonedErrorMessage(asOf.reason));
      return;
    }
    const result = onSave({
      id: `${barSymbol}|${date}|${windowStart}|${Date.now()}`,
      symbol: barSymbol,
      sessionDate: date,
      windowStart,
      windowEnd,
      volume: volumeBlocked || closedSession ? null : parseBlank(volume),
      open: closedSession ? null : parseBlank(open),
      close: closedSession ? null : parseBlank(close),
      sessionOpen: closedSession ? null : parseBlank(sessionOpen),
      partial,
      closedSession,
      sourceLabel,
      delayNote,
      asOf: asOf.iso,
      observedAt: new Date().toISOString(),
    });
    setError(result.error);
  }

  return (
    <div className="grid-2">
      <label>
        Symbol
        <select className="control" value={barSymbol} onChange={(event) => setBarSymbol(event.target.value)}>
          {WATCHLIST.map((instrument) => (
            <option key={instrument.symbol} value={instrument.symbol}>
              {instrument.symbol} · {instrument.name}
            </option>
          ))}
          {COMPARISON_SYMBOLS.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol} · comparison only
            </option>
          ))}
        </select>
      </label>
      <label>
        Session date
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label>
        15-minute volume {volumeBlocked ? "(N/A for SPX)" : ""}
        <Input value={volume} disabled={volumeBlocked || closedSession} inputMode="decimal" onChange={(event) => setVolume(event.target.value)} placeholder={volumeBlocked ? "N/A" : "Blank if missing"} />
      </label>
      <label>
        Bar open
        <Input value={open} disabled={closedSession} inputMode="decimal" onChange={(event) => setOpen(event.target.value)} placeholder="Blank if missing" />
      </label>
      <label>
        Bar close
        <Input value={close} disabled={closedSession} inputMode="decimal" onChange={(event) => setClose(event.target.value)} placeholder="Blank if missing" />
      </label>
      <label>
        09:30 session open
        <Input value={sessionOpen} disabled={closedSession} inputMode="decimal" onChange={(event) => setSessionOpen(event.target.value)} placeholder="Blank if missing" />
      </label>
      <label>
        Source
        <Input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Where you read the print" />
      </label>
      <label>
        Delay note
        <Input value={delayNote} onChange={(event) => setDelayNote(event.target.value)} placeholder="Unknown if not stated" />
      </label>
      <label>
        Quote time, Eastern
        <Input value={asOfLocal} onChange={(event) => setAsOfLocal(event.target.value)} placeholder="YYYY-MM-DDTHH:mm" />
      </label>
      <label>
        <input type="checkbox" checked={partial} onChange={(event) => setPartial(event.target.checked)} /> Partial bar
      </label>
      <label>
        <input type="checkbox" checked={closedSession} onChange={(event) => setClosedSession(event.target.checked)} /> Closed session, not zero
      </label>
      {error ? <p className="errors">{error}</p> : null}
      <Button type="button" onClick={save}>
        Save bar
      </Button>
    </div>
  );
}

function ImportForm({ onImport }: { onImport: (raw: unknown) => ActionResult }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label>
        Import JSON
        <textarea className="control" value={text} onChange={(event) => setText(event.target.value)} placeholder='{"bars":[...]}' />
      </label>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          try {
            const result = onImport(JSON.parse(text));
            setError(result.error);
          } catch {
            setError("That text is not JSON. Nothing was saved.");
          }
        }}
      >
        Import bars
      </Button>
      {error ? <p className="errors">{error}</p> : null}
    </div>
  );
}

function parseBlank(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
