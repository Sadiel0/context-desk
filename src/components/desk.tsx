"use client";

import {
  addChecklistEvidence,
  addEarnings,
  attachCaptureEvidence,
  attachFilingEvidence,
  attachHeadlineEvidence,
  attachMeetingEvidence,
  attachNewsEvidence,
  attachPressEvidence,
  removeEarnings,
  resetSession,
  reviseNews,
  importParticipationBars,
  removeParticipationBar,
  saveNews,
  saveParticipationBar,
  selectSymbol,
  setDemo,
  setFundamentals,
  setObservation,
  setOptionCapture,
  setReview,
  setSessionOverride,
  setSetupDirection,
  setSetupNote,
  setSpreadFormula,
} from "@/domain/actions";
import type { ChecklistItemId, Evidence, Observation, ReviewMark, SetupNote } from "@/domain/checklist";
import { CHECKLIST_ITEMS } from "@/domain/checklist";
import { nextFomcDate, nextSymbolEvent } from "@/domain/coverage";
import { coveragePending, coverageShort } from "@/domain/ticker-feed";
import { DEMO_BANNER, itemsForView } from "@/domain/demo";
import type { FedPressItem, FomcMeeting } from "@/domain/fed-parse";
import { ADVISORY_LIMITS, BOLLINGER_ADAPTATION, TC2000_BOUNDARY } from "@/domain/limits";
import type { NewsDraft } from "@/domain/news";
import { checklistFor, fundamentalsFor, optionFor } from "@/domain/state";
import { describeSession, isSessionDate } from "@/domain/time";
import { instrumentFor } from "@/domain/watchlist";
import { CalendarPanel } from "@/components/calendar-panel";
import { ChecklistRail } from "@/components/checklist-rail";
import { ContextFeed } from "@/components/context-feed";
import { FundamentalsPanel } from "@/components/fundamentals-panel";
import { OptionsPanel } from "@/components/options-panel";
import { ParticipationPanel } from "@/components/participation-panel";
import { SourcesPanel } from "@/components/sources-panel";
import { useFed } from "@/components/use-fed";
import { useTicker } from "@/components/use-ticker";
import { useWorkspace } from "@/components/use-workspace";
import { useXStatus } from "@/components/use-x";
import { WatchlistBar } from "@/components/watchlist-bar";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function Desk() {
  const workspace = useWorkspace();
  const fed = useFed();
  const x = useXStatus();
  const { state, ready, now, sessionDate } = workspace;
  const ticker = useTicker(state?.selectedSymbol ?? "TSLA");

  if (!ready || !state || !now || !sessionDate) {
    return (
      <>
        <a className="skip" href="#checklist">Skip to checklist</a>
        <Mast sessionDate="" nowLabel="" onSession={() => undefined} onReset={null} />
        <p className="opening" role="status">Opening the workspace saved in this browser…</p>
      </>
    );
  }

  const symbol = state.selectedSymbol;
  const instrument = instrumentFor(symbol)!;
  const checklist = checklistFor(state, symbol, sessionDate);
  const capture = optionFor(state, symbol, sessionDate);
  const fundamentals = fundamentalsFor(state, symbol)!;
  const library = itemsForView(state.news, state.demo);
  const workspaceState = state;
  const clock = describeSession(now, sessionDate, state.sessionDateOverride !== null);
  const earnings = state.earnings.filter((event) => event.symbol === symbol);
  const symbolEvent = nextSymbolEvent(state.earnings, symbol, sessionDate);
  const fomc = nextFomcDate(fed.result?.calendar.data ?? [], sessionDate, fed.failed ?? fed.result?.calendar.error ?? (fed.result ? null : "Not retrieved yet."));

  function applyReview(itemId: ChecklistItemId, review: ReviewMark) {
    workspace.apply(setReview(workspaceState, { symbol, sessionDate: sessionDate!, itemId, review, at: new Date().toISOString() }), "Review saved. Observation was not changed.");
  }

  function applyObservation(itemId: ChecklistItemId, observation: Observation) {
    workspace.apply(
      setObservation(workspaceState, { symbol, sessionDate: sessionDate!, itemId, observation, at: new Date().toISOString() }),
      "Observation saved. It is not a permission to trade.",
    );
  }

  function applyEvidence(evidence: Omit<Evidence, "id" | "recordedAt">) {
    workspace.apply(
      addChecklistEvidence(workspaceState, {
        symbol,
        sessionDate: sessionDate!,
        evidence: { ...evidence, id: crypto.randomUUID(), recordedAt: new Date().toISOString() },
      }),
      "Evidence saved. Review and observation were not changed.",
    );
  }

  function applySetup(note: SetupNote) {
    workspace.apply(setSetupNote(workspaceState, { symbol, sessionDate: sessionDate!, note }));
  }

  function commitNews(draft: NewsDraft, mode: "primary" | "duplicate" | "correction" | "revise") {
    if (mode === "revise") return workspace.apply(reviseNews(workspaceState, draft.id, draft), "Revision saved.");
    return workspace.apply(saveNews(workspaceState, draft, mode), "Item saved in the library.");
  }

  function attachPress(item: FedPressItem) {
    if (!fed.result) return;
    workspace.apply(
      attachPressEvidence(workspaceState, {
        symbol,
        sessionDate: sessionDate!,
        item,
        evidenceId: crypto.randomUUID(),
        at: new Date().toISOString(),
        retrievedAt: fed.result.retrievedAt,
      }),
      "Federal Reserve title attached as macro evidence. Review and observation were not changed.",
    );
  }

  function attachMeeting(meeting: FomcMeeting) {
    if (!fed.result) return;
    workspace.apply(
      attachMeetingEvidence(workspaceState, {
        symbol,
        sessionDate: sessionDate!,
        meeting,
        evidenceId: crypto.randomUUID(),
        at: new Date().toISOString(),
        retrievedAt: fed.result.retrievedAt,
        lastUpdate: fed.result.calendar.lastUpdate,
      }),
      "Meeting attached as macro evidence. Review and observation were not changed.",
    );
  }

  return (
    <>
      <a className="skip" href="#feed">Skip to headlines</a>
      <a className="skip" href="#participation">Skip to tape</a>
      <a className="skip" href="#checklist">Skip to checklist</a>
      <Mast
        sessionDate={sessionDate}
        nowLabel={clock.nowLabel}
        onSession={(value) => {
          if (value === "") workspace.apply(setSessionOverride(state, null), "Using today’s Eastern date.");
          else if (isSessionDate(value)) workspace.apply(setSessionOverride(state, value));
          else workspace.setNotice("That session date is not a real calendar date.");
        }}
        onReset={() =>
          workspace.apply(
            resetSession(state, symbol, sessionDate),
            "Session reset. News, fundamentals, and typed bars stayed. Setup direction for this session was cleared.",
          )
        }
        help={<HelpCopy />}
        contract={
          <OptionsPanel
            symbol={symbol}
            capture={capture}
            formula={state.spreadFormula}
            onCapture={(next) => workspace.apply(setOptionCapture(state, symbol, sessionDate, next, new Date().toISOString()))}
            onFormula={(formula) => workspace.apply(setSpreadFormula(state, formula), "Spread formula saved.")}
            onAttach={() =>
              workspace.apply(
                attachCaptureEvidence(state, { symbol, sessionDate, evidenceId: crypto.randomUUID(), at: new Date().toISOString() }),
                "Contract snapshot attached. Review and observation were not changed.",
              )
            }
          />
        }
        sources={
          <>
            <SourcesPanel instrument={instrument} demo={state.demo} onDemo={(demo) => workspace.apply(setDemo(state, demo))} />
            <CalendarPanel
              symbol={symbol}
              sessionDate={sessionDate}
              result={fed.result}
              loading={fed.loading}
              failed={fed.failed}
              onRefresh={fed.refresh}
              earnings={earnings}
              onAttach={attachMeeting}
              onAddEarnings={(event) =>
                workspace.apply(addEarnings(state, { ...event, id: crypto.randomUUID(), recordedAt: new Date().toISOString() }), "Earnings note saved.")
              }
              onRemoveEarnings={(id) => workspace.apply(removeEarnings(state, id), "Earnings note removed.")}
            />
            <FundamentalsPanel key={symbol} symbol={symbol} value={fundamentals} onChange={(next) => workspace.apply(setFundamentals(state, symbol, next))} />
          </>
        }
      />
      {state.demo ? (
        <div className="demo-banner" role="status">
          <p>{DEMO_BANNER}</p>
        </div>
      ) : null}
      {workspace.storageMessage ? (
        <div className="storage-banner">
          <div className="band">
            <p>{workspace.storageMessage}</p>
            <Button type="button" variant="clay" onClick={workspace.replaceStorage}>Replace it with an empty workspace</Button>
            <Button type="button" variant="outline" onClick={workspace.keepWithoutSaving}>Continue without saving</Button>
          </div>
        </div>
      ) : null}
      <div className="band">
        <WatchlistBar selected={symbol} onSelect={(next) => workspace.apply(selectSymbol(state, next))} />
        <div className="symbol-strip">
          <div>
            <h2 className="mono">{symbol}</h2>
            <p className="meta">{instrument.name} · {instrument.kind}{instrument.occasional ? " · occasional" : ""}</p>
          </div>
          <p className="meta symbol-facts">
            {clock.sessionLabel}
            {clock.weekend ? " · Weekend" : ""}
            {clock.matchesEasternToday ? " · today ET" : " · manual date"}
            {" · "}
            {ticker.result
              ? coverageShort(ticker.result)
              : coveragePending(ticker.failed ?? (ticker.loading ? "retrieving public feeds." : "Unknown."))}
            {" · "}
            {symbolEvent.state === "unknown" ? "Next event Unknown" : `Next event ${symbolEvent.date}`}
            {" · "}
            {fomc.state === "unknown" ? "FOMC Unknown" : `FOMC ${fomc.label}`}
            {" · macro, not this tape"}
          </p>
          {instrument.identity ? (
            <details>
              <summary>Listing</summary>
              <p className="meta">{instrument.identity}</p>
            </details>
          ) : null}
        </div>
        <p className="notice" role="status">{workspace.notice ?? ""}</p>
      </div>
      <div className="desk">
        <ParticipationPanel
          symbol={symbol}
          sessionDate={sessionDate}
          book={state.participation}
          onDirection={(direction) => workspace.apply(setSetupDirection(state, symbol, sessionDate, direction))}
          onSave={(draft) => workspace.apply(saveParticipationBar(state, draft), "Bar saved. It is not an entry.")}
          onRemove={(id) => workspace.apply(removeParticipationBar(state, id), "Bar removed.")}
          onImport={(raw) => workspace.apply(importParticipationBars(state, raw), "Bars imported. Invalid rows were skipped when named in the notice.")}
        />
        <ChecklistRail
          checklist={checklist}
          now={now}
          onReview={applyReview}
          onObservation={applyObservation}
          onEvidence={applyEvidence}
          onSetup={applySetup}
          setupError={workspace.notice && /not guessed|leave the field blank/.test(workspace.notice) ? workspace.notice : null}
        />
        <ContextFeed
          symbol={symbol}
          items={library}
          demo={state.demo}
          now={now}
          fed={fed.result}
          ticker={ticker.result}
          tickerFailed={ticker.failed}
          tickerLoading={ticker.loading}
          x={x}
          onCommit={commitNews}
          onAttach={(item) =>
            workspace.apply(
              attachNewsEvidence(state, { symbol, sessionDate, itemId: item.id, evidenceId: crypto.randomUUID(), at: new Date().toISOString() }),
              "Headline attached. Review and observation were not changed.",
            )
          }
          onAttachPress={attachPress}
          onAttachHeadline={(item) => {
            if (!ticker.result) return;
            workspace.apply(
              attachHeadlineEvidence(state, {
                symbol,
                sessionDate,
                item,
                querySymbol: ticker.result.yahoo.querySymbol,
                evidenceId: crypto.randomUUID(),
                at: new Date().toISOString(),
                retrievedAt: ticker.result.retrievedAt,
              }),
              "Aggregator headline attached. Review and observation were not changed. This is not a permission to trade.",
            );
          }}
          onAttachFiling={(filing) => {
            if (!ticker.result) return;
            workspace.apply(
              attachFilingEvidence(state, {
                symbol,
                sessionDate,
                filing,
                sec: ticker.result.sec,
                evidenceId: crypto.randomUUID(),
                at: new Date().toISOString(),
                retrievedAt: ticker.result.retrievedAt,
              }),
              "SEC filing attached. Review and observation were not changed. This is not a permission to trade.",
            );
          }}
        />
      </div>
    </>
  );
}

function Mast({
  sessionDate,
  nowLabel,
  onSession,
  onReset,
  help,
  sources,
  contract,
}: {
  sessionDate: string;
  nowLabel: string;
  onSession: (value: string) => void;
  onReset: (() => void) | null;
  help?: ReactNode;
  sources?: ReactNode;
  contract?: ReactNode;
}) {
  return (
    <header className="mast">
      <div className="mast-inner">
        <div className="mast-top">
          <div>
            <p className="eyebrow">Unpublished local draft</p>
            <h1>Context desk</h1>
            {nowLabel ? <p className="now-line">Eastern now {nowLabel}</p> : null}
          </div>
          {sessionDate ? (
            <div className="session-controls">
              <label>
                Session date
                <Input type="date" value={sessionDate} onChange={(event) => onSession(event.target.value)} />
              </label>
              <Button type="button" variant="outline" onClick={() => onSession("")}>Today (ET)</Button>
              {onReset ? <ResetControl sessionDate={sessionDate} onReset={onReset} /> : null}
              {help ? <Drawer label="Help" title="How the marks work">{help}</Drawer> : null}
              {sources ? <Drawer label="Sources" title="Sources, calendar, and company notes" wide>{sources}</Drawer> : null}
              {contract ? <Drawer label="Contract" title="Exact contract, after the look" wide>{contract}</Drawer> : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function Drawer({ label, title, wide, children }: { label: string; title: string; wide?: boolean; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">{label}</Button>
      </DialogTrigger>
      <DialogContent className={wide ? "dialog-wide" : undefined}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <div className="drawer-body">{children}</div>
        <DialogClose asChild>
          <Button type="button" variant="outline">Close</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function HelpCopy() {
  return (
    <>
      <p>
        Reviewed means you looked. Observed means you saw the condition. Neither one is a permission to trade, and there is no combined score.
      </p>
      <p>{TC2000_BOUNDARY}</p>
      <p>{BOLLINGER_ADAPTATION}</p>
      <p>The six Spanish names are the same six requirements. This draft’s source list was written in English.</p>
      <ul>
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item.id}>
            <span lang="es">{item.titleEs}</span> / {item.titleEn}. {item.detail}
          </li>
        ))}
      </ul>
      <ul>
        {ADVISORY_LIMITS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>A successful fetch is not a fresh item. Publication age and the last retrieval are separate. A date-only Fed row is not a statement clock time. Missing ticker coverage stays Unknown.</p>
      <p>
        Arrow keys move the watchlist when you are not typing in a field. Keys 1 through 9 jump the full list in order. The contract calculator stays in Contract and is not required before the headlines or the tape.
      </p>
      <p>
        Block compares SPY, QQQ, and NVDA with the symbol you selected, on one completed 15-minute window and from the 09:30 open. Same, opposite, and mixed are signs only. That comparison was requested. The Academy notes do not define which names share a block or who leads. Index weights, correlation, breadth, and lead/lag are not calculated. NVDA is a comparison symbol, not a watchlist name. Bars are manual.
      </p>
      <p>Orders stay on the Thinkorswim phone. Nothing here is an entry.</p>
    </>
  );
}

function ResetControl({ sessionDate, onReset }: { sessionDate: string; onReset: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="clay">Reset</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Reset this session?</DialogTitle>
        <DialogDescription id="reset-desc">
          Clears review, observation, evidence, the setup note, and the option capture for this symbol on {sessionDate}. The news library, fundamentals, and earnings notes stay. A later date does not inherit these marks.
        </DialogDescription>
        <div className="inline-actions">
          <DialogClose asChild>
            <Button type="button" variant="clay" onClick={onReset}>Reset session</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
