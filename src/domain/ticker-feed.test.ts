import { describe, expect, it } from "vitest";
import { attachFilingEvidence, attachHeadlineEvidence } from "@/domain/actions";
import { initialWorkspace } from "@/domain/state";
import { parseYahooHeadlines } from "@/domain/rss-parse";
import { parseSecSubmissions, secIndexUrl } from "@/domain/sec-parse";
import {
  coveragePending,
  coverageShort,
  coverageSummary,
  macroCue,
  namesSymbol,
  watchlistMentions,
  type TickerLoad,
} from "@/domain/ticker-feed";
import { disconnectedX, readXSnapshot, X_SNAPSHOT_SCHEMA } from "@/domain/x-snapshot";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
<item>
  <title>Dow Jones Futures Rise As Nvidia Probes CEO</title>
  <link>https://finance.yahoo.com/m/aaa/dow.html?.tsrc=rss</link>
  <pubDate>Mon, 09 Nov 2026 02:04:21 +0000</pubDate>
  <description>Futures rose after a board statement.</description>
</item>
<item>
  <title>Apple won&#39;t play in traffic</title>
  <link>https://www.tikr.com/blog/apple?ref=yahoofinance&amp;.tsrc=rss</link>
  <pubDate>Sun, 08 Nov 2026 21:55:41 +0000</pubDate>
  <description>Apple (AAPL) stock gained. Closing near $342 is the feed's number.</description>
</item>
<item>
  <title>Apple won&#39;t play in traffic</title>
  <link>https://www.tikr.com/blog/apple?ref=yahoofinance</link>
  <pubDate>Sun, 08 Nov 2026 21:55:41 +0000</pubDate>
  <description>duplicate</description>
</item>
<item>
  <title>Broken</title>
  <link>javascript:alert(1)</link>
</item>
</channel></rss>`;

describe("ticker feeds", () => {
  it("keeps Yahoo association separate from a headline that names the symbol", () => {
    const parsed = parseYahooHeadlines(RSS, "AAPL");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].mention).toBe("feed_association");
    expect(parsed.items[0].linkHost).toBe("finance.yahoo.com");
    expect(parsed.items[1].mention).toBe("names_symbol");
    expect(parsed.items[1].linkHost).toBe("www.tikr.com");
    expect(parsed.items[1].url).not.toMatch(/tsrc/);
    expect(parsed.items[1].title).toMatch(/won't/);
    expect(namesSymbol("AAPL", "METADATA Apple")).toBe(true);
    expect(namesSymbol("META", "METADATA only")).toBe(false);
    expect(namesSymbol("SPY", "The S&P 500 rose")).toBe(false);
    expect(namesSymbol("SPX", "The S&P 500 rose")).toBe(true);
    expect(namesSymbol("DIA", "Dow Jones Futures")).toBe(false);
  });

  it("withholds SEC rows when the ticker field does not match and builds a real index link", () => {
    const body = {
      cik: "0000320193",
      name: "Apple Inc.",
      tickers: ["AAPL"],
      exchanges: ["Nasdaq"],
      sicDescription: "Electronic Computers",
      filings: {
        recent: {
          form: ["8-K", "4"],
          filingDate: ["2026-11-05", "2026-11-06"],
          acceptanceDateTime: ["2026-11-05T21:58:46.000Z", "2026-11-06T23:36:37.000Z"],
          accessionNumber: ["0001193125-26-450074", "0000950103-26-017123"],
          primaryDocument: ["d8k.htm", "xslF345X06/ownership.xml"],
          primaryDocDescription: ["8-K", "4"],
        },
      },
    };
    const parsed = parseSecSubmissions(body, "0000320193");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.issuer.filings[0].form).toBe("4");
    expect(parsed.issuer.filings[0].insider).toBe(true);
    expect(parsed.issuer.filings[0].indexUrl).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/0000950103-26-017123-index.html",
    );
    expect(secIndexUrl("0000320193", "not-an-accession")).toBeNull();
    expect(coverageSummary(sampleLoad("AAPL", ["AAPL"]))).toMatch(/not the publisher/);
    expect(coverageSummary(sampleLoad("AAPL", ["AAPL"]))).toMatch(/not a report of no catalysts/);
    expect(coverageShort(sampleLoad("SPX", []))).toMatch(/not an issuer|Yahoo/);
    expect(coveragePending("retrieving public feeds.")).toMatch(/Unknown|retrieving/);
    expect(coveragePending("retrieving public feeds.")).toMatch(/not a report of no catalysts/);
  });

  it("attaches a naming headline and a filing without marking the checklist", () => {
    const headline = parseYahooHeadlines(RSS, "AAPL").items[1];
    const attached = attachHeadlineEvidence(initialWorkspace(), {
      symbol: "AAPL",
      sessionDate: "2026-11-08",
      item: headline,
      querySymbol: "AAPL",
      evidenceId: "h1",
      at: "2026-11-09T02:00:00.000Z",
      retrievedAt: "2026-11-09T01:59:00.000Z",
    });
    expect(attached.error).toBeNull();
    const evidence = attached.state.checklists["AAPL|2026-11-08"].evidence[0];
    expect(evidence.scope).toBe("symbol");
    expect(evidence.text).toMatch(/aggregator/);
    expect(evidence.text).not.toMatch(/\$342/);
    expect(attached.state.checklists["AAPL|2026-11-08"].reviews.fed_earnings).toBe("unreviewed");
    const refused = attachHeadlineEvidence(initialWorkspace(), {
      symbol: "AAPL",
      sessionDate: "2026-11-08",
      item: parseYahooHeadlines(RSS, "AAPL").items[0],
      querySymbol: "AAPL",
      evidenceId: "h2",
      at: "2026-11-09T02:00:00.000Z",
      retrievedAt: "2026-11-09T01:59:00.000Z",
    });
    expect(refused.error).toMatch(/does not name/);
    const filing = attachFilingEvidence(initialWorkspace(), {
      symbol: "AAPL",
      sessionDate: "2026-11-08",
      filing: {
        form: "8-K",
        filingDate: "2026-11-05",
        acceptanceAt: "2026-11-05T21:58:46.000Z",
        accession: "0001193125-26-450074",
        primaryDocument: "d8k.htm",
        description: "8-K",
        indexUrl: "https://www.sec.gov/Archives/edgar/data/320193/0001193125-26-450074-index.html",
        insider: false,
      },
      sec: sampleLoad("AAPL", ["AAPL"]).sec,
      evidenceId: "f1",
      at: "2026-11-09T02:00:00.000Z",
      retrievedAt: "2026-11-09T01:59:00.000Z",
    });
    expect(filing.state.checklists["AAPL|2026-11-08"].observations.fed_earnings).toBe("unknown");
    expect(filing.state.checklists["AAPL|2026-11-08"].evidence[0].eventDate).toBe("2026-11-05");
    expect(filing.state.checklists["AAPL|2026-11-08"].evidence[0].text).toMatch(/not the business-event clock/);
  });
});

describe("X snapshot", () => {
  it("stays disconnected and rejects a snapshot that claims to be live or unverified", () => {
    expect(disconnectedX(null).live).toBe(false);
    expect(disconnectedX(null).posts).toEqual([]);
    expect(disconnectedX(null).mode).toBe("disconnected");
    const good = readXSnapshot({
      schema: X_SNAPSHOT_SCHEMA,
      live: false,
      polling: false,
      retrievalMethod: "hosted-public-x-read",
      retrievedAt: "2026-11-09T02:00:00.000Z",
      identities: [{ name: "Example Person", username: "example_user", id: "100", verified: true }],
      posts: [
        {
          id: "200",
          url: "https://x.com/example_user/status/200",
          text: "Tesla delivery note. Not a market call.",
          createdAt: "2026-11-09T01:00:00.000Z",
          authorId: "100",
          authorUsername: "example_user",
          referenced: [{ type: "quoted", id: "199", text: "Earlier text" }],
        },
      ],
    });
    expect(good.mode).toBe("parent_snapshot");
    expect(good.live).toBe(false);
    expect(good.identities[0].serverRechecked).toBe(false);
    expect(good.posts).toHaveLength(1);
    expect(watchlistMentions(good.posts[0].text, ["TSLA", "AAPL"])).toEqual(["TSLA"]);
    expect(macroCue("New tariffs on autos")).toBe("tariff");
    expect(macroCue("Tesla delivery note")).toBeNull();
    expect(readXSnapshot({ ...good, live: true }).mode).toBe("invalid_snapshot");
    expect(readXSnapshot({ schema: X_SNAPSHOT_SCHEMA, live: true, polling: false }).posts).toEqual([]);
    const foreign = readXSnapshot({
      schema: X_SNAPSHOT_SCHEMA,
      live: false,
      polling: false,
      retrievalMethod: "hosted-public-x-read",
      retrievedAt: "2026-11-09T02:00:00.000Z",
      identities: [{ name: "Example Person", username: "example_user", id: "100", verified: true }],
      posts: [
        {
          id: "200",
          url: "https://example.com/status/200",
          text: "no",
          createdAt: "2026-11-09T01:00:00.000Z",
          authorId: "100",
          authorUsername: "example_user",
          referenced: [],
        },
      ],
    });
    expect(foreign.mode).toBe("invalid_snapshot");
    expect(foreign.posts).toEqual([]);
  });
});

function sampleLoad(symbol: string, tickers: string[]): TickerLoad {
  const confirmed = tickers.includes(symbol);
  return {
    symbol,
    retrievedAt: "2026-11-09T02:00:00.000Z",
    yahoo: {
      state: "ok",
      querySymbol: symbol === "SPX" ? "^GSPC" : symbol,
      url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL",
      error: null,
      notice: "aggregator",
      items: [],
    },
    sec:
      symbol === "SPX"
        ? {
            state: "not_applicable",
            cik: null,
            name: null,
            exchanges: [],
            sic: null,
            error: null,
            notice: "SPX is an index. SEC issuer filings do not apply. This is not SPY.",
            filings: [],
          }
        : {
            state: confirmed ? "confirmed" : "error",
            cik: "0000320193",
            name: "Apple Inc.",
            exchanges: ["Nasdaq"],
            sic: "Electronic Computers",
            error: confirmed ? null : "withheld",
            notice: "acceptance is not the event clock",
            filings: [],
          },
  };
}
