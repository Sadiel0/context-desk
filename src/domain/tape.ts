export type TapeKind = "bar_volume" | "time_and_sales" | "bid_ask_side" | "book_depth";
export type TapeAvailability = "manual" | "not_applicable" | "unavailable";

export type TapeRow = {
  kind: TapeKind;
  label: string;
  availability: TapeAvailability;
  /** Short status for the ledger. Not a print, a side, or a size. */
  status: string;
};

/**
 * What the tape can honestly show.
 * Bar volume is a 15-minute bar, typed or imported. It is not time-and-sales.
 * An up bar is not a buy, and a down bar is not a sell.
 */
export function tapeRows(symbol: string): TapeRow[] {
  const index = symbol === "SPX";
  return [
    {
      kind: "bar_volume",
      label: "Bar volume",
      availability: index ? "not_applicable" : "manual",
      status: index ? "N/A" : "Manual",
    },
    {
      kind: "time_and_sales",
      label: "Time and sales",
      availability: "unavailable",
      status: "Unavailable",
    },
    {
      kind: "bid_ask_side",
      label: "Bid/ask side",
      availability: "unavailable",
      status: "Unavailable",
    },
    {
      kind: "book_depth",
      label: "Book depth",
      availability: "unavailable",
      status: "Unavailable",
    },
  ];
}

export const TAPE_DETAIL =
  "Bar volume is the 15-minute bar you enter. Time and sales, bid/ask-side prints, and book depth need a print feed this desk does not have. A bar’s up or down close is not buyer or seller aggression, and it is not shown as flow.";
