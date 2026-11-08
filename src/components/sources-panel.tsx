"use client";

import { SOURCE_ADAPTERS, X_ALLOWLIST_PENDING, xSweeperStatus, type AdapterMode } from "@/domain/sources";
import type { Instrument } from "@/domain/watchlist";
import { SafeLink } from "@/components/safe-link";

const MODE_LABEL: Record<AdapterMode, string> = {
  live: "Live read",
  manual: "Manual",
  demo: "Demo only",
  unconfigured: "Not connected",
};

export function SourcesPanel({ instrument, demo, onDemo }: { instrument: Instrument; demo: boolean; onDemo: (demo: boolean) => void }) {
  const sweeper = xSweeperStatus();
  return (
    <section className="panel" aria-labelledby="sources-title">
      <h2 id="sources-title">Sources</h2>
      <p>Launchers open the publisher in a new tab. They are not embedded, and a page is not a feed.</p>
      <label>
        <input type="checkbox" checked={demo} onChange={(event) => onDemo(event.target.checked)} /> Show invented demo items
      </label>
      <p className="hint">Demo items are fiction for the pipeline. They are hidden until this is on.</p>
      {SOURCE_ADAPTERS.map((adapter) => {
        const links = adapter.links(instrument);
        return (
          <article key={adapter.id} className="source-card">
            <h3>
              {adapter.label}{" "}
              <span className={`badge ${adapter.mode === "live" ? "badge-live" : adapter.mode === "unconfigured" ? "badge-off" : adapter.mode === "demo" ? "badge-demo" : ""}`}>
                {MODE_LABEL[adapter.mode]}
              </span>
            </h3>
            <p>{adapter.summary}</p>
            {adapter.unresolved ? <p className="hint">{adapter.unresolved}</p> : null}
            {links.length ? (
              <ul>
                {links.map((link) => (
                  <li key={link.url}>
                    <SafeLink href={link.url}>{link.label}</SafeLink>
                    {link.verifiedInBuild ? null : <span className="badge badge-unknown">Unverified link</span>}
                    <span className="hint"> {link.note}</span>
                  </li>
                ))}
              </ul>
            ) : adapter.id === "finviz" && instrument.kind === "index" ? (
              <p className="hint">No Finviz launcher for SPX. An equity quote page would be the wrong instrument.</p>
            ) : adapter.id === "optionslam" && instrument.kind !== "stock" ? (
              <p className="hint">No OptionSlam stock-earnings launcher for this instrument.</p>
            ) : null}
          </article>
        );
      })}
      <article className="source-card">
        <h3>Allowlist, not monitored</h3>
        <p>{sweeper.reason} Polling is off.</p>
        <ul>
          {X_ALLOWLIST_PENDING.map((person) => (
            <li key={person.name}>
              {person.name}. Handle: <span className="unknown-word">not verified</span>. Numeric id:{" "}
              <span className="unknown-word">not verified</span>. Not monitored.
            </li>
          ))}
        </ul>
        <p className="hint">
          Policy, tariffs, rates, and company mentions would be labeled inferred. A genuine post would not prove that its contents are accurate.
        </p>
      </article>
    </section>
  );
}
