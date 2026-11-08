"use client";

import { useState } from "react";
import { KIND_LABEL, WATCHLIST, type InstrumentKind } from "@/domain/watchlist";

const FILTERS: { id: "all" | InstrumentKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stock", label: "Stocks" },
  { id: "etf", label: "ETFs" },
  { id: "index", label: "Index" },
];

export function WatchlistBar({ selected, onSelect }: { selected: string; onSelect: (symbol: string) => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const visible = WATCHLIST.filter((instrument) => filter === "all" || instrument.kind === filter || instrument.symbol === selected);

  return (
    <div className="watch-row">
      <div className="filters" role="group" aria-label="Filter the watchlist">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={filter === entry.id ? "filter-btn filter-on" : "filter-btn"}
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="chips" role="radiogroup" aria-label="Watchlist. Arrow keys move between symbols.">
        {visible.map((instrument) => {
          const on = instrument.symbol === selected;
          return (
            <label key={instrument.symbol} className={on ? "chip chip-on" : "chip"}>
              <input
                className="sr-only"
                type="radio"
                name="watchlist"
                value={instrument.symbol}
                checked={on}
                onChange={() => onSelect(instrument.symbol)}
              />
              <span className="mono">{instrument.symbol}</span>
              <small>
                {KIND_LABEL[instrument.kind]}
                {instrument.occasional ? " · occasional" : ""}
              </small>
            </label>
          );
        })}
      </div>
    </div>
  );
}
