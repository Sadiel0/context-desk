import { formatDollars, formatPercent, formatPrice, showEntered } from "@/domain/format";
import { easternLocalToIso, isSessionDate, zonedErrorMessage } from "@/domain/time";

export type SpreadFormula = "mid" | "ask" | "bid";
export type OptionRight = "call" | "put" | "unknown";

export type OptionCapture = {
  root: string;
  right: OptionRight;
  strike: string;
  expiry: string;
  bid: string;
  ask: string;
  debit: string;
  contracts: string;
  multiplier: string;
  multiplierNote: string;
  sourceName: string;
  sourceTimestampLocal: string;
  feedDelay: string;
  feeEntryOpen: boolean;
  userEnteredFee: string;
  targetReturnPct: string;
  estimatedStopRisk: string;
  updatedAt: string | null;
};

export type OptionMath = {
  errors: string[];
  unknowns: string[];
  spreadDollars: number | null;
  formulaLabel: string;
  formulaExpression: string;
  spreadPct: number | null;
  premiumPerContract: number | null;
  fullPremiumExposure: number | null;
  targetContractPrice: number | null;
  targetExpression: string;
  fee: number | null;
  stopRisk: number | null;
  sourceIso: string | null;
  distinctions: string[];
  recordGaps: string[];
};

export const SPREAD_FORMULA_LABEL: Record<SpreadFormula, string> = {
  mid: "(ask − bid) / midpoint",
  ask: "(ask − bid) / ask",
  bid: "(ask − bid) / bid",
};

export function emptyOptionCapture(): OptionCapture {
  return {
    root: "",
    right: "unknown",
    strike: "",
    expiry: "",
    bid: "",
    ask: "",
    debit: "",
    contracts: "",
    multiplier: "",
    multiplierNote: "",
    sourceName: "",
    sourceTimestampLocal: "",
    feedDelay: "",
    feeEntryOpen: false,
    userEnteredFee: "",
    targetReturnPct: "10",
    estimatedStopRisk: "",
    updatedAt: null,
  };
}

type Parsed = { ok: true; value: number | null } | { ok: false; message: string };

function parsePlain(raw: string, label: string): Parsed {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > 12 || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: `${label} must be a plain number, or left blank for unknown.` };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, message: `${label} is not a finite number.` };
  return { ok: true, value };
}

function parsePositive(raw: string, label: string): Parsed {
  const parsed = parsePlain(raw, label);
  if (!parsed.ok || parsed.value === null) return parsed;
  if (parsed.value <= 0) return { ok: false, message: `${label} must be greater than 0, or left blank for unknown.` };
  return parsed;
}

function parseContracts(raw: string): Parsed {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^[1-9]\d{0,5}$/.test(trimmed)) {
    return { ok: false, message: "Contracts must be a whole number of at least 1, or blank for unknown." };
  }
  return { ok: true, value: Number(trimmed) };
}

function parseTarget(raw: string): Parsed {
  const parsed = parsePlain(raw, "Plan percent");
  if (!parsed.ok || parsed.value === null) return parsed;
  if (parsed.value > 1000) return { ok: false, message: "Plan percent must be between 0 and 1000, or blank." };
  return parsed;
}

export function contractDistinctions(root: string, symbol: string): string[] {
  const normalizedRoot = root.trim().toUpperCase();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const notes: string[] = [];
  if (!normalizedRoot) notes.push("Option root is unknown.");
  const indexRoot = normalizedSymbol === "SPX" || normalizedRoot === "SPX" || normalizedRoot === "SPXW";
  if (indexRoot) {
    notes.push("SPX is the S&P 500 index, not the SPY ETF.");
    notes.push("SPXW is a separate option root from SPX. They are not treated as the same contract.");
    notes.push("ETF share-delivery rules are not applied to SPX or SPXW.");
    notes.push("Settlement, exercise style, and expiration time are not loaded. Confirm them on the contract.");
  }
  if (normalizedSymbol === "SPY" && (normalizedRoot === "SPX" || normalizedRoot === "SPXW")) {
    notes.push("The selected symbol is the SPY ETF, while the root is an index option. They are different instruments.");
  }
  if (normalizedRoot === "SPX") notes.push("The root you typed is SPX, not SPXW.");
  if (normalizedRoot === "SPXW") notes.push("The root you typed is SPXW, not SPX.");
  return notes;
}

function minus(left: string, right: string): string {
  return `(${left} − ${right})`;
}

export function evaluateOption(capture: OptionCapture, formula: SpreadFormula, symbol: string): OptionMath {
  const errors: string[] = [];
  const unknowns: string[] = [];
  const recordGaps: string[] = [];

  const root = capture.root.trim();
  if (!root) {
    unknowns.push("Root unknown");
    recordGaps.push("root");
  }

  if (capture.right === "unknown") unknowns.push("Call or put unknown");

  const strike = parsePositive(capture.strike, "Strike");
  if (!strike.ok) errors.push(strike.message);
  else if (strike.value === null) unknowns.push("Strike unknown");

  if (!capture.expiry.trim()) {
    unknowns.push("Expiration date unknown");
    recordGaps.push("expiry date");
  } else if (!isSessionDate(capture.expiry.trim())) {
    errors.push("Expiration date is not a real calendar date.");
    recordGaps.push("expiry date");
  }
  unknowns.push("Expiration time unknown. A date is not a clock time.");

  const bid = parsePlain(capture.bid, "Bid");
  const ask = parsePlain(capture.ask, "Ask");
  if (!bid.ok) errors.push(bid.message);
  if (!ask.ok) errors.push(ask.message);
  const bidValue = bid.ok ? bid.value : null;
  const askValue = ask.ok ? ask.value : null;
  if (bid.ok && bidValue === null) {
    unknowns.push("Bid unknown");
    recordGaps.push("bid");
  }
  if (ask.ok && askValue === null) {
    unknowns.push("Ask unknown");
    recordGaps.push("ask");
  }

  let spreadDollars: number | null = null;
  let spreadPct: number | null = null;
  let formulaExpression = "Not calculated.";
  const formulaLabel = SPREAD_FORMULA_LABEL[formula];
  if (bidValue !== null && askValue !== null && bid.ok && ask.ok) {
    if (askValue < bidValue) {
      errors.push("Ask is below bid. The spread was not calculated.");
    } else {
      spreadDollars = askValue - bidValue;
      const bidText = capture.bid.trim();
      const askText = capture.ask.trim();
      const numerator = minus(askText, bidText);
      if (formula === "mid") {
        formulaExpression = `${numerator} / ((${askText} + ${bidText}) / 2)`;
        const midpoint = (askValue + bidValue) / 2;
        spreadPct = midpoint === 0 ? null : (spreadDollars / midpoint) * 100;
      } else if (formula === "ask") {
        formulaExpression = `${numerator} / ${askText}`;
        spreadPct = askValue === 0 ? null : (spreadDollars / askValue) * 100;
      } else {
        formulaExpression = `${numerator} / ${bidText}`;
        spreadPct = bidValue === 0 ? null : (spreadDollars / bidValue) * 100;
      }
      if (spreadPct === null) {
        formulaExpression += " was not calculated because the divisor is zero.";
      } else {
        formulaExpression += ` = ${formatPercent(spreadPct)} (rounded)`;
      }
    }
  }

  const debit = parsePlain(capture.debit, "Premium debit");
  if (!debit.ok) errors.push(debit.message);
  const debitValue = debit.ok ? debit.value : null;
  if (debit.ok && debitValue === null) unknowns.push("Premium debit unknown");

  const contracts = parseContracts(capture.contracts);
  if (!contracts.ok) errors.push(contracts.message);
  const contractCount = contracts.ok ? contracts.value : null;
  if (contracts.ok && contractCount === null) unknowns.push("Contract count unknown");

  const multiplier = parsePositive(capture.multiplier, "Multiplier");
  if (!multiplier.ok) errors.push(multiplier.message);
  const multiplierValue = multiplier.ok ? multiplier.value : null;
  if (multiplier.ok && multiplierValue === null) {
    unknowns.push("Multiplier unknown — dollar exposure not calculated");
  }

  const premiumPerContract =
    debitValue !== null && multiplierValue !== null && debit.ok && multiplier.ok ? debitValue * multiplierValue : null;
  const fullPremiumExposure =
    premiumPerContract !== null && contractCount !== null ? premiumPerContract * contractCount : null;
  if (fullPremiumExposure === null) unknowns.push("Full premium exposure unknown");

  const target = parseTarget(capture.targetReturnPct);
  if (!target.ok) errors.push(target.message);
  const targetPct = target.ok ? target.value : null;
  let targetContractPrice: number | null = null;
  let targetExpression = "Not calculated.";
  if (target.ok && targetPct === null) {
    unknowns.push("Contract-return plan percent unknown — target price not calculated");
  } else if (targetPct !== null && debitValue === null) {
    unknowns.push("Target contract price not calculated because the debit is unknown");
  } else if (targetPct !== null && debitValue !== null) {
    targetContractPrice = debitValue * (1 + targetPct / 100);
    targetExpression = `${capture.debit.trim()} × (1 + ${capture.targetReturnPct.trim()} / 100) = ${formatPrice(targetContractPrice)} (calculated plan, not a quote)`;
  }

  let fee: number | null = null;
  if (!capture.feeEntryOpen) {
    unknowns.push("Fees unknown");
  } else {
    const parsedFee = parsePlain(capture.userEnteredFee, "Fee");
    if (!parsedFee.ok) errors.push(parsedFee.message);
    else if (parsedFee.value === null) unknowns.push("Fee amount unknown");
    else fee = parsedFee.value;
  }
  unknowns.push("Tick size unknown");

  const stop = parsePlain(capture.estimatedStopRisk, "Estimated stop risk");
  if (!stop.ok) errors.push(stop.message);
  const stopRisk = stop.ok ? stop.value : null;
  if (stop.ok && stopRisk === null) unknowns.push("Estimated stop risk not established");

  if (!capture.feedDelay.trim()) unknowns.push("Feed delay unknown");
  if (!capture.sourceName.trim()) unknowns.push("Quote source name unknown");

  let sourceIso: string | null = null;
  if (!capture.sourceTimestampLocal.trim()) {
    unknowns.push("Source time unknown");
    recordGaps.push("source time");
  } else {
    const zoned = easternLocalToIso(capture.sourceTimestampLocal);
    if (!zoned.ok) {
      errors.push(zonedErrorMessage(zoned.reason));
      recordGaps.push("source time");
    } else sourceIso = zoned.iso;
  }

  return {
    errors,
    unknowns,
    spreadDollars,
    formulaLabel,
    formulaExpression,
    spreadPct,
    premiumPerContract,
    fullPremiumExposure,
    targetContractPrice,
    targetExpression,
    fee,
    stopRisk,
    sourceIso,
    distinctions: contractDistinctions(capture.root, symbol),
    recordGaps,
  };
}

export function describeCapture(capture: OptionCapture, symbol: string, formula: SpreadFormula): string {
  const math = evaluateOption(capture, formula, symbol);
  const lines = [
    `Symbol context ${symbol}`,
    `Root: ${capture.root.trim() ? capture.root.trim().toUpperCase() : "Unknown"}`,
    `Right: ${capture.right}`,
    `Strike: ${showEntered(capture.strike)}`,
    `Expiry date: ${capture.expiry.trim() || "Unknown"}`,
    "Expiry time: Unknown",
    `Bid: ${showEntered(capture.bid)}`,
    `Ask: ${showEntered(capture.ask)}`,
    `Spread dollars: ${math.spreadDollars === null ? "Unknown" : `${formatPrice(math.spreadDollars)} (calculated)`}`,
    `Spread formula: ${math.formulaLabel}`,
    `Premium debit: ${showEntered(capture.debit)}`,
    `Multiplier: ${showEntered(capture.multiplier)}`,
    `Contracts: ${showEntered(capture.contracts)}`,
    `Full premium exposure: ${math.fullPremiumExposure === null ? "Unknown" : `${formatDollars(math.fullPremiumExposure)} (calculated)`}`,
    `Estimated stop risk: ${math.stopRisk === null ? "Not established" : `${showEntered(capture.estimatedStopRisk)} — not premium exposure`}`,
    `Fees: ${math.fee === null ? "Unknown" : showEntered(capture.userEnteredFee)}`,
    "Tick size: Unknown",
    `Feed delay: ${capture.feedDelay.trim() || "Unknown"}`,
    `Source: ${capture.sourceName.trim() || "Unknown"}`,
    `Plan target: ${math.targetExpression}`,
  ];
  if (math.distinctions.length) lines.push(math.distinctions.join(" "));
  lines.push("Snapshot only. Not an order.");
  return lines.join(". ");
}
