"use client";

import {
  addChecklistEvidence,
  addEarnings,
  attachCaptureEvidence,
  attachMeetingEvidence,
  attachNewsEvidence,
  removeEarnings,
  resetSession,
  saveNews,
  selectSymbol,
  setChecklistStatus,
  setDemo,
  setFundamentals,
  setOptionCapture,
  setSessionOverride,
  setSpreadFormula,
  reviseNews,
} from "@/domain/actions";
import type { ChecklistItemId, ChecklistStatus, Evidence } from "@/domain/checklist";
import { DEMO_BANNER, itemsForView } from "@/domain/demo";
import type { FedPressItem, FomcMeeting } from "@/domain/fed-parse";
import type { Fundamentals } from "@/domain/fundamentals";
import type { NewsDraft } from "@/domain/news";
import type { OptionCapture } from "@/domain/options";
import { SOURCE_ADAPTERS } from "@/domain/sources";
import { checklistFor, fundamentalsFor, optionFor } from "@/domain/state";
import { formatSessionLabel, isSessionDate } from "@/domain/time";
import { instrumentFor } from "@/domain/watchlist";
import { CalendarPanel } from "@/components/calendar-panel";
import { ChecklistRail } from "@/components/checklist-rail";
import { ContextFeed } from "@/components/context-feed";
import { FundamentalsPanel } from "@/components/fundamentals-panel";
import { OptionsPanel } from "@/components/options-panel";
import { SafeLink } from "@/components/safe-link";
import { SourcesPanel } from "@/components/sources-panel";
import { useFed } from "@/components/use-fed";
import { useWorkspace } from "@/components/use-workspace";
import { WatchlistBar } from "@/components/watchlist-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function Desk() {
  const workspace = useWorkspace();
  const fed = useFed();
  const { state, ready, now, sessionDate } = workspace;

  if (!ready || !state || !now || !sessionDate) {
    return (
      <>
        <a className="skip" href="#checklist">
          Skip to checklist
        </a>
        <Mast sessionDate="" onSession={() => undefined} onReset={null} />
        <p className="opening" role="status">
          Opening the workspace saved in this browser…
        </p>
      </>
    );
  }

  const symbol = state.selectedSymbol;
  const instrument = instrumentFor(symbol)!;
  const checklist = checklistFor(state, symbol, sessionDate);
  const capture = optionFor(state, symbol, sessionDate);
  const fundamentals = fundamentalsFor(state, symbol)!;
  const library = itemsForView(state.news, state.demo);
  const links = SOURCE_ADAPTERS.flatMap((adapter) => adapter.links(instrument));
  const workspaceState = state;

  function applyStatus(itemId: ChecklistItemId, status: ChecklistStatus) {
    workspace.apply(
      setChecklistStatus(workspaceState, {
        symbol,
        sessionDate: sessionDate!,
        itemId,
        status,
        at: new Date().toISOString(),
      }),
      "Status saved. It does not submit an order.",
    );
  }

  function applyEvidence(evidence: Omit<Evidence, "id" | "recordedAt">) {
    workspace.apply(
      addChecklistEvidence(workspaceState, {
        symbol,
        sessionDate: sessionDate!,
        evidence: { ...evidence, id: crypto.randomUUID(), recordedAt: new Date().toISOString() },
      }),
      "Evidence saved. The status was not changed.",
    );
  }

  function commitNews(draft: NewsDraft, mode: "primary" | "duplicate" | "correction" | "revise") {
    if (mode === "revise") return workspace.apply(reviseNews(workspaceState, draft.id, draft), "Revision saved.");
    return workspace.apply(saveNews(workspaceState, draft, mode), "Item saved in the library.");
  }

  function savePress(item: FedPressItem) {
    workspace.apply(
      saveNews(
        workspaceState,
        {
          id: crypto.randomUUID(),
          sourceId: "fed",
          sourceLabel: "Federal Reserve monetary-policy feed",
          url: item.url,
          author: "",
          headline: item.title,
          quote: "",
          publishedAt: item.publishedAt,
          eventAt: null,
          symbols: [],
          relevance: "inferred",
          relevanceNote:
            "Monetary-policy headline. Any link to a watchlist name is inferred through rates or index products, not stated by the feed.",
          extractedFact: "",
          interpretation: null,
          rumor: false,
          uncertainAttribution: false,
          x: null,
          correctionOfId: null,
          duplicateOfId: null,
          ingestedAt: new Date().toISOString(),
        },
        "primary",
      ),
      "Federal Reserve headline saved. It is inferred context, not a company filing.",
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
      "Meeting attached as a sourced fact. The checklist status was not changed.",
    );
  }

  function saveCapture(next: OptionCapture) {
    workspace.apply(setOptionCapture(workspaceState, symbol, sessionDate!, next, new Date().toISOString()));
  }

  function saveFundamentals(next: Fundamentals) {
    workspace.apply(setFundamentals(workspaceState, symbol, next));
  }

  return (
    <>
      <a className="skip" href="#checklist">
        Skip to checklist
      </a>
      <a className="skip" href="#feed">
        Skip to context feed
      </a>
      <a className="skip" href="#contract">
        Skip to option capture
      </a>
      <Mast
        sessionDate={sessionDate}
        onSession={(value) => {
          if (value === "") workspace.apply(setSessionOverride(state, null), "Using today’s Eastern date.");
          else if (isSessionDate(value)) workspace.apply(setSessionOverride(state, value));
          else workspace.setNotice("That session date is not a real calendar date.");
        }}
        onReset={() => workspace.apply(resetSession(state, symbol, sessionDate), "Session reset. News and fundamentals stayed.")}
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
            <Button type="button" variant="clay" onClick={workspace.replaceStorage}>
              Replace it with an empty workspace
            </Button>
            <Button type="button" variant="outline" onClick={workspace.keepWithoutSaving}>
              Continue without saving
            </Button>
          </div>
        </div>
      ) : null}
      <div className="band">
        <WatchlistBar selected={symbol} onSelect={(next) => workspace.apply(selectSymbol(state, next))} />
        <div className="ticker-row">
          <div>
            <p className="eyebrow">{instrument.kind === "index" ? "Index, occasional" : instrument.kind}</p>
            <h2>{symbol}</h2>
            <p>{instrument.name}</p>
          </div>
          <p className="meta">{formatSessionLabel(sessionDate)}</p>
        </div>
        <p className="hint">Price, bands, moving averages, and candles stay in TC2000.</p>
        <div className="launcher-row" aria-label="Source launchers">
          {links.map((link) => (
            <SafeLink key={link.url} href={link.url}>
              {link.label}
              {link.verifiedInBuild ? "" : " (unverified)"}
            </SafeLink>
          ))}
        </div>
        <p className="notice" role="status">
          {workspace.notice ??
            (workspace.holdWrites
              ? "Changes in this tab are not being written to the saved workspace."
              : "Saved in this browser for each symbol and Eastern session.")}
        </p>
      </div>
      <div className="desk">
        <ChecklistRail checklist={checklist} onStatus={applyStatus} onEvidence={applyEvidence} />
        <ContextFeed
          symbol={symbol}
          items={library}
          demo={state.demo}
          now={now}
          fed={fed.result}
          onCommit={(draft, mode) => commitNews(draft, mode)}
          onAttach={(item) =>
            workspace.apply(
              attachNewsEvidence(state, {
                symbol,
                sessionDate,
                itemId: item.id,
                evidenceId: crypto.randomUUID(),
                at: new Date().toISOString(),
              }),
              "Headline attached as evidence. The status was not changed.",
            )
          }
          onSavePress={(item) => savePress(item)}
        />
        <div className="stack">
          <CalendarPanel
            symbol={symbol}
            sessionDate={sessionDate}
            result={fed.result}
            loading={fed.loading}
            failed={fed.failed}
            onRefresh={fed.refresh}
            earnings={state.earnings.filter((event) => event.symbol === symbol)}
            onAttach={(meeting) => attachMeeting(meeting)}
            onAddEarnings={(event) =>
              workspace.apply(
                addEarnings(state, { ...event, id: crypto.randomUUID(), recordedAt: new Date().toISOString() }),
                "Earnings note saved.",
              )
            }
            onRemoveEarnings={(id) => workspace.apply(removeEarnings(state, id), "Earnings note removed.")}
          />
          <OptionsPanel
            symbol={symbol}
            capture={capture}
            formula={state.spreadFormula}
            onCapture={(next) => saveCapture(next)}
            onFormula={(formula) => workspace.apply(setSpreadFormula(state, formula), "Spread formula saved.")}
            onAttach={() =>
              workspace.apply(
                attachCaptureEvidence(state, {
                  symbol,
                  sessionDate,
                  evidenceId: crypto.randomUUID(),
                  at: new Date().toISOString(),
                }),
                "Contract snapshot attached. The status was not changed.",
              )
            }
          />
          <FundamentalsPanel
            key={symbol}
            symbol={symbol}
            value={fundamentals}
            onChange={(next) => saveFundamentals(next)}
          />
          <SourcesPanel instrument={instrument} demo={state.demo} onDemo={(demo) => workspace.apply(setDemo(state, demo))} />
        </div>
      </div>
    </>
  );
}

function Mast({
  sessionDate,
  onSession,
  onReset,
}: {
  sessionDate: string;
  onSession: (value: string) => void;
  onReset: (() => void) | null;
}) {
  return (
    <header className="mast">
      <div className="mast-inner">
        <div className="mast-top">
          <div>
            <p className="eyebrow">Unpublished local draft</p>
            <h1>Context desk</h1>
          </div>
          {sessionDate ? (
            <div className="session-controls">
              <label>
                Eastern session date
                <Input type="date" value={sessionDate} onChange={(event) => onSession(event.target.value)} />
              </label>
              <Button type="button" variant="outline" onClick={() => onSession("")}>
                Use today (ET)
              </Button>
              {onReset ? <ResetControl sessionDate={sessionDate} onReset={onReset} /> : null}
            </div>
          ) : null}
        </div>
        <p className="mast-note">
          Orders stay on the Thinkorswim phone. Bands, averages, and candles stay in TC2000. This desk does not quote the market and does not send orders.
        </p>
      </div>
    </header>
  );
}

function ResetControl({ sessionDate, onReset }: { sessionDate: string; onReset: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="clay">
          Reset session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Reset this session?</DialogTitle>
        <DialogDescription id="reset-desc">
          Clears checklist statuses, evidence, and the option capture for this symbol on {sessionDate}. The news library, fundamentals, and earnings notes stay.
        </DialogDescription>
        <div className="inline-actions">
          <DialogClose asChild>
            <Button type="button" variant="clay" onClick={onReset}>
              Reset session
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
