import { describe, expect, it } from "vitest";
import { clearTickerCache, loadTicker } from "@/server/ticker-client";

const RSS = `<?xml version="1.0"?><rss><channel><item>
<title>Apple event</title>
<link>https://finance.yahoo.com/news/apple-event.html</link>
<pubDate>Mon, 09 Nov 2026 02:04:21 +0000</pubDate>
<description>Apple held an event.</description>
</item></channel></rss>`;

const SEC = JSON.stringify({
  cik: "0000320193",
  name: "Apple Inc.",
  tickers: ["AAPL"],
  exchanges: ["Nasdaq"],
  sicDescription: "Electronic Computers",
  filings: {
    recent: {
      form: ["8-K"],
      filingDate: ["2026-11-05"],
      acceptanceDateTime: ["2026-11-05T21:58:46.000Z"],
      accessionNumber: ["0001193125-26-450074"],
      primaryDocument: ["d8k.htm"],
      primaryDocDescription: ["8-K"],
    },
  },
});

function responseWithUrl(body: string, url: string, status = 200): Response {
  const response = new Response(body, { status });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("ticker reader", () => {
  it("reads allowlisted Yahoo and SEC responses and refuses a redirect", async () => {
    clearTickerCache();
    const ok = await loadTicker(
      async (input) => {
        const url = String(input);
        if (url.includes("feeds.finance.yahoo.com")) return responseWithUrl(RSS, url);
        if (url.includes("data.sec.gov")) return responseWithUrl(SEC, url);
        return responseWithUrl("no", "https://evil.example/no", 404);
      },
      "AAPL",
      { bypassCache: true },
    );
    expect(ok.yahoo.state).toBe("ok");
    expect(ok.yahoo.items[0].mention).toBe("names_symbol");
    expect(ok.sec.state).toBe("confirmed");
    expect(ok.sec.filings).toHaveLength(1);

    clearTickerCache();
    const redirected = await loadTicker(
      async (input) => {
        const url = String(input);
        if (url.includes("feeds.finance.yahoo.com")) {
          return new Response(null, { status: 302, headers: { location: "https://evil.example" } });
        }
        return responseWithUrl(SEC, url.includes("data.sec.gov") ? url : "https://data.sec.gov/submissions/CIK0000320193.json");
      },
      "AAPL",
      { bypassCache: true },
    );
    expect(redirected.yahoo.state).toBe("error");
    expect(redirected.yahoo.error).toMatch(/redirect/);
    expect(redirected.yahoo.items).toEqual([]);
    expect(redirected.sec.state).toBe("confirmed");

    clearTickerCache();
    const index = await loadTicker(async () => responseWithUrl(RSS, "https://feeds.finance.yahoo.com/rss"), "SPX", {
      bypassCache: true,
    });
    expect(index.yahoo.querySymbol).toBe("^GSPC");
    expect(index.sec.state).toBe("not_applicable");
    expect(index.sec.filings).toEqual([]);

    clearTickerCache();
    const iwm = await loadTicker(async () => responseWithUrl(RSS, "https://feeds.finance.yahoo.com/rss"), "IWM", {
      bypassCache: true,
    });
    expect(iwm.sec.state).toBe("unconfirmed");
    expect(iwm.sec.filings).toEqual([]);

    clearTickerCache();
    const withheld = await loadTicker(
      async (input) => {
        const url = String(input);
        if (url.includes("feeds.finance.yahoo.com")) return responseWithUrl(RSS, url);
        const body = JSON.parse(SEC) as { tickers: string[] };
        body.tickers = ["MSFT"];
        return responseWithUrl(JSON.stringify(body), url);
      },
      "AAPL",
      { bypassCache: true },
    );
    expect(withheld.sec.state).toBe("error");
    expect(withheld.sec.filings).toEqual([]);
    expect(withheld.sec.error).toMatch(/did not include AAPL/);
  });
});
