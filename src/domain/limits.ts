export const ADVISORY_LIMITS = [
  "The academy 10% figure used here is a cap on premium invested, not a stop-risk allowance.",
  "A +10% contract return is a return on the contract, not a return on the account.",
  "One unknown, not-met, or not-applicable item does not ban a trade in this desk.",
  "Limits are advisory. They are not broker enforcement. Orders are entered manually on the Thinkorswim phone. This desk submits nothing.",
] as const;

export const TC2000_BOUNDARY =
  "15-minute, hour, and day bands, moving averages, trendlines, and candles stay in TC2000. This desk does not read that platform, does not draw a replacement chart, and does not mark those items for you.";

export const BOLLINGER_ADAPTATION =
  "Adaptation on file: a 15-minute price exits the bands as they widen, plus a clear candle. No universal completed-candle rule and no numeric stop are established.";
