"use client";

import { formatDollars, formatPrice, showEntered } from "@/domain/format";
import { evaluateOption, SPREAD_FORMULA_LABEL, type OptionCapture, type OptionRight, type SpreadFormula } from "@/domain/options";
import { formatInstantEt } from "@/domain/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";

export function OptionsPanel({
  symbol,
  capture,
  formula,
  onCapture,
  onFormula,
  onAttach,
}: {
  symbol: string;
  capture: OptionCapture;
  formula: SpreadFormula;
  onCapture: (capture: OptionCapture) => void;
  onFormula: (formula: SpreadFormula) => void;
  onAttach: () => void;
}) {
  const math = evaluateOption(capture, formula, symbol);
  const showDistinctions = symbol === "SPX" || symbol === "SPY" || /SPX/i.test(capture.root);
  const set = (patch: Partial<OptionCapture>) => onCapture({ ...capture, ...patch });

  return (
    <section className="panel" id="contract" aria-labelledby="contract-title">
      <h2 id="contract-title">Exact contract</h2>
      <p className="result-line">
        Spread {math.spreadDollars === null ? <span className="unknown-word">Unknown</span> : `${formatPrice(math.spreadDollars)}`}
        {" · "}Exposure {math.fullPremiumExposure === null ? <span className="unknown-word">Unknown</span> : formatDollars(math.fullPremiumExposure)}
        {" · "}Stop {math.stopRisk === null ? <span className="unknown-word">Not established</span> : showEntered(capture.estimatedStopRisk)}
        {" · "}Fees {math.fee === null ? <span className="unknown-word">Unknown</span> : showEntered(capture.userEnteredFee)}
      </p>
      <p className="meta mono">{symbol} · this session · not an order</p>
      {math.errors.length ? (
        <div className="errors">
          {math.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      <div className="grid-2">
        <Field label="Root" hint="SPXW is not SPX. SPX is not SPY.">
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={capture.root}
              placeholder="Unknown"
              onChange={(event) => set({ root: event.target.value.toUpperCase() })}
            />
          )}
        </Field>
        <label className="field">
          <span className="field-label">Right</span>
          <select
            className="control"
            value={capture.right}
            onChange={(event) => set({ right: event.target.value as OptionRight })}
          >
            <option value="unknown">Unknown</option>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </label>
        <Field label="Strike" hint="Leave blank if unknown.">
          {(id, describedBy) => (
            <Input id={id} aria-describedby={describedBy} inputMode="decimal" value={capture.strike} placeholder="Unknown" onChange={(event) => set({ strike: event.target.value })} />
          )}
        </Field>
        <Field label="Expiration date" hint="A date is not an expiration clock time.">
          {(id, describedBy) => (
            <Input id={id} aria-describedby={describedBy} type="date" value={capture.expiry} onChange={(event) => set({ expiry: event.target.value })} />
          )}
        </Field>
        <Field label="Bid">
          {(id) => <Input id={id} inputMode="decimal" value={capture.bid} placeholder="Unknown" onChange={(event) => set({ bid: event.target.value })} />}
        </Field>
        <Field label="Ask">
          {(id) => <Input id={id} inputMode="decimal" value={capture.ask} placeholder="Unknown" onChange={(event) => set({ ask: event.target.value })} />}
        </Field>
        <Field label="Premium debit" hint="The price you would pay, per unit. Not the spread.">
          {(id, describedBy) => (
            <Input id={id} aria-describedby={describedBy} inputMode="decimal" value={capture.debit} placeholder="Unknown" onChange={(event) => set({ debit: event.target.value })} />
          )}
        </Field>
        <Field label="Contracts">
          {(id) => (
            <Input id={id} inputMode="numeric" value={capture.contracts} placeholder="Unknown" onChange={(event) => set({ contracts: event.target.value })} />
          )}
        </Field>
      </div>
      <Field label="Multiplier" hint={capture.multiplierNote || "Dollar exposure is not calculated until you enter one."}>
        {(id, describedBy) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            inputMode="decimal"
            value={capture.multiplier}
            placeholder="Unknown"
            onChange={(event) =>
              set({
                multiplier: event.target.value,
                multiplierNote: event.target.value.trim()
                  ? "You entered this multiplier. It was not read from a feed."
                  : "",
              })
            }
          />
        )}
      </Field>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          set({
            multiplier: "100",
            multiplierNote: "You confirmed a multiplier of 100. This was not read from a feed.",
          })
        }
      >
        Set multiplier to 100. I confirm this contract uses 100.
      </Button>
      <dl className="math">
        <div>
          <dt>Spread</dt>
          <dd>{math.spreadDollars === null ? <span className="unknown-word">Unknown</span> : `${formatPrice(math.spreadDollars)} dollars`}</dd>
          <dd className="formula">{math.formulaExpression}</dd>
        </div>
        <div>
          <dt>Premium debit</dt>
          <dd>{showEntered(capture.debit)} <span className="meta">per unit, not the spread</span></dd>
        </div>
        <div>
          <dt>Full premium exposure</dt>
          <dd>{math.fullPremiumExposure === null ? <span className="unknown-word">Unknown</span> : `${formatDollars(math.fullPremiumExposure)}`}</dd>
          <dd className="formula">Debit × multiplier × contracts. Fees excluded. Premium invested, not a stop.</dd>
        </div>
        <div>
          <dt>Estimated stop risk</dt>
          <dd>{math.stopRisk === null ? <span className="unknown-word">Not established</span> : `${showEntered(capture.estimatedStopRisk)}. Not a broker stop.`}</dd>
        </div>
        <div>
          <dt>Contract plan</dt>
          <dd className="formula">{math.targetExpression}</dd>
          <dd className="hint">Plan for the contract. Not an account return, not a quote, and not an analyst stock target.</dd>
        </div>
      </dl>
      <p className="meta">
        {math.fee === null ? <span className="unknown-word">Fees unknown</span> : "A fee was typed. It is not in the exposure."}
        {" · "}
        <span className="unknown-word">Tick size unknown</span>
        {" · Source "}
        {capture.sourceName.trim() ? capture.sourceName : <span className="unknown-word">Unknown</span>}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onAttach}>
        Attach snapshot. Review and observation stay as you set them.
      </Button>
      <details>
        <summary>Provenance, fees, and formula</summary>
      <div className="grid-2">
      <Field label="Source name" hint="Where you read the bid and ask.">
          {(id, describedBy) => (
            <Input id={id} aria-describedby={describedBy} value={capture.sourceName} placeholder="Unknown" onChange={(event) => set({ sourceName: event.target.value })} />
          )}
        </Field>
        <Field label="Source time, Eastern" hint="Leave blank if unknown. A daylight-saving gap or overlap is not guessed.">
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="datetime-local"
              value={capture.sourceTimestampLocal}
              onChange={(event) => set({ sourceTimestampLocal: event.target.value })}
            />
          )}
        </Field>
      </div>
      <Field label="Feed delay" hint="Type only what the screen showed. This desk does not measure delay.">
        {(id, describedBy) => (
          <Input id={id} aria-describedby={describedBy} value={capture.feedDelay} placeholder="Unknown" onChange={(event) => set({ feedDelay: event.target.value })} />
        )}
      </Field>
      <label className="field">
        <span className="field-label">
          <input
            type="checkbox"
            checked={capture.feeEntryOpen}
            onChange={(event) => set({ feeEntryOpen: event.target.checked, userEnteredFee: event.target.checked ? capture.userEnteredFee : "" })}
          />{" "}
          I am entering a fee I saw. It is not verified.
        </span>
      </label>
      {capture.feeEntryOpen ? (
        <Field label="Fee you saw, dollars">
          {(id) => (
            <Input id={id} inputMode="decimal" value={capture.userEnteredFee} placeholder="Unknown" onChange={(event) => set({ userEnteredFee: event.target.value })} />
          )}
        </Field>
      ) : null}
      <Field label="Contract-return plan, percent" hint="A plan only. Contract return, not account return, and not a quote.">
        {(id, describedBy) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            inputMode="decimal"
            value={capture.targetReturnPct}
            placeholder="Unknown"
            onChange={(event) => set({ targetReturnPct: event.target.value })}
          />
        )}
      </Field>
      <Field label="Estimated stop risk, dollars" hint="Leave blank if you have not set one. This is not premium exposure and it is not enforced.">
        {(id, describedBy) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            inputMode="decimal"
            value={capture.estimatedStopRisk}
            placeholder="Not established"
            onChange={(event) => set({ estimatedStopRisk: event.target.value })}
          />
        )}
      </Field>
      <fieldset>
        <legend className="field-label">Spread percent formula</legend>
        <p className="hint">Display only. The bid and ask you entered stay as entered.</p>
        {(Object.keys(SPREAD_FORMULA_LABEL) as SpreadFormula[]).map((value) => (
          <label key={value} className="meta">
            <input type="radio" name="spread-formula" checked={formula === value} onChange={() => onFormula(value)} /> {SPREAD_FORMULA_LABEL[value]}
          </label>
        ))}
      </fieldset>
      {math.recordGaps.length ? <p className="meta">Still blank: {math.recordGaps.join(", ")}.</p> : <p className="meta">Root, expiry date, bid, ask, and source time are filled in.</p>}
      {showDistinctions ? (
        <div className="fact">
          {math.distinctions.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {capture.updatedAt ? <p className="meta">Capture updated {formatInstantEt(capture.updatedAt)}.</p> : null}
      </details>
    </section>
  );
}
