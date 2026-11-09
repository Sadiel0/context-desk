# Context desk

Personal trading context desk. One screen for complementary trade context: a per-symbol checklist, sourced headlines, fundamentals you type in, an exact-option capture, and the public Federal Reserve calendar.

It is not a broker, not a chart, and not a quote service. TC2000 stays the source for 15-minute, hour, and day Bollinger Bands, moving averages, and candles. Orders stay on the Thinkorswim phone. Nothing in this desk submits an order or marks a TC2000 condition for you.

This is a local unpublished draft. It does not claim market readiness or profitability.

## Run

```bash
npm install
npm run dev
```

The dev server listens on [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Data is stored in this browser under `context-desk.workspace.v1`. No account, no API key, and no environment variable is required. The Federal Reserve reader, the Yahoo Finance symbol RSS reader, and the SEC submissions reader run server-side when you open the desk.

This dev server’s loopback address is reachable on the machine that runs it. It is not a hosted preview. Opening it here does not publish the draft.

## What the screen does

- Watchlist: TSLA, SPCX (SpaceX), META, AAPL, SPY, QQQ, IWM, DIA, and occasional SPX. SPX is the index, not the SPY ETF. SPCX is Space Exploration Technologies Corp. Class A common stock, verified from SEC CIK 0001181412 on 2026-11-09, and it is not TSLA. Filters narrow the chips without dropping the selected symbol.
- Participation is manual. Time-of-day relative volume is this 15-minute regular-session bar divided by the mean of earlier regular-session bars in the same Eastern clock window. The current session is excluded. SPX volume is not applicable. SPY and QQQ alignment is with, against, mixed, unchanged, or incomplete only after you set call/up or put/down. No live intraday feed is connected.
- Block is a requested comparison, not an Academy rule. SPY, QQQ, and NVDA are shown beside the selected symbol on the same completed 15-minute window and from the 09:30 open, as percents. Same, opposite, and mixed are signs. NVDA can be typed or imported as a comparison bar and is not a watchlist chip. No leader, correlation, breadth, or index-weight math.
- The first look is the selected symbol’s headlines and the tape. The six checklist rows stay underneath. The exact contract is in Contract and is not required before that look. Arrow keys move the visible watchlist. Keys 1–9 jump the full list.
- Checklist and option capture are keyed by symbol plus the Eastern calendar date. Reset clears that pair, including the optional TC2000 setup note. The news library, fundamentals, and earnings notes stay. A new date does not inherit technical marks.
- Each of the six rows has a review mark and a separate observation. Reviewed means the look is finished. Observed means the condition was seen. Finishing an earnings review does not mark a trade safe, and the counts are not a score. The Spanish name and the English name are both on the row. Gap can be not applicable. An optional setup note (lateral or squeeze, widening, band exit, candle, nearby line or average, extension, TC2000 time, setup version) sits under the six rows and starts blank on every session.
- Bollinger, moving averages, and trendline evidence can only be “you, in TC2000.” A headline cannot check them.
- Fed meetings and earnings can take a sourced fact or your note. Attaching one does not change the status.
- The option panel keeps bid/ask spread, premium debit, full premium exposure, estimated stop risk, and the contract-return plan separate. Blank is unknown, not zero. Fees and tick size stay unknown unless you type a fee you saw. The +10% field is a plan for the contract, not an account return and not a quote. Multiplier stays blank until you enter it or confirm 100.
- SPX and SPXW are called out as different roots. ETF share-delivery rules are not applied. Settlement and expiration time are not loaded.
- News items keep the original headline and quote apart from any interpretation. Interpretations are labeled and are not buy or sell signals. Duplicates and corrections are explicit. Demo fixtures stay hidden until DEMO is on, and they use invented `example.com` text.
- Analyst targets are stock targets you type, with firm, date, and horizon only if you enter them. They are not scalp exits. Stock recommendations are not used for ETFs, the index, or options.

## Design

Wireframe: a short ink mast, a symbol strip, then tape | headlines, with the six checklist rows underneath. Contract is a drawer.

Critique that the build follows:

- Equal columns would starve headlines, so the feed is the flexible center.
- Status is a labeled radio. Unknown uses an amber wash and the word Unknown, so a missing value is not a calm zero and not a green check.
- There is no price chart and no profit card. Those would impersonate TC2000 and a broker.
- Dark mode is the only theme. Six named colors: ink `#f4efe6`, paper `#141210`, rule `#3d3832`, signal `#9fd0da`, amber `#e6c27a`, clay `#e7b2ab`. Washes are darker tints of those, not extra hues. Native inputs, selects, and date fields use `color-scheme: dark`.
- Type: Newsreader for the symbol and titles, Source Sans 3 for the interface, IBM Plex Mono for figures and timestamps.
- DEMO is a full-width clay banner, not a toast.
- Narrow widths stack symbol, tape, headlines, then the checklist. Calendar and fundamentals stay in Sources. The contract stays in its drawer.
- Focus rings stay visible. Motion is not used. `prefers-reduced-motion` disables animation if any is introduced later.

## Data contracts

Session date is the `America/New_York` calendar date. A daylight-saving gap or overlap in a typed clock time is rejected instead of guessed. Displayed instants include EST or EDT.

The first laptop view is the symbol, a short coverage line, Yahoo headlines that name the symbol, and the tape: relative volume, setup alignment, the block comparison, and the four volume rows. The six checklist rows sit under that. Yahoo items that do not name the symbol, older headlines, SEC filings, the X sweeper, macro titles, and saved notes start collapsed. The contract calculator is in Contract. Source launchers, the full calendar, and company fields are in Sources. Longer explanations, including why block is not an Academy confirmation, are in Help.

Yahoo and SEC requests are allowlisted, refuse redirects, time out at 8 seconds, and cap the body at 2 MB. A successful process caches a symbol for 90 seconds (20 seconds if a source errored). Publication age and retrieval time stay separate. Yahoo may itself cache the RSS for about five minutes; that is the origin’s header, not a freshness claim.

X parent snapshot schema is `context-desk.x-snapshot.v1`. Required: `live: false`, `polling: false`, `retrievalMethod: "hosted-public-x-read"`, `retrievedAt`, identities with `verified: true` plus a numeric `id` and username, and posts whose `https://x.com/{username}/status/{id}` URL matches that identity. The server never re-checks X. An invalid file yields no posts.

Checklist item ids: `fed_earnings`, `bollinger`, `moving_averages`, `trendline`, `gap`, `option_contract`. Review is `unreviewed` or `reviewed`. Observation is `unknown`, `observed`, `not_observed`, or `not_applicable`. Evidence does not change either mark. Older saves that used a single status are migrated on load: Fed “confirmed” becomes reviewed with observation still unknown; the other five “confirmed” values become observed.

Evidence kinds: `tc2000_user`, `sourced_fact`, `manual_note`. Technical items accept only `tc2000_user`. The option item accepts only `manual_note`. Fed and earnings accept `sourced_fact` or `manual_note`.

Option capture stores the strings you typed. Empty string means unknown. Spread percent formulas are explicit:

- `(ask − bid) / midpoint` (default display)
- `(ask − bid) / ask`
- `(ask − bid) / bid`

Full premium exposure is `debit × multiplier × contracts` and only when all three are present. It ignores fees. It is not a stop.

News items require a headline. Links must be `http` or `https` with no userinfo. `javascript:`, `data:`, and `file:` are rejected. Tracking parameters (`utm_*`, `fbclid`, `gclid`, and a few others) are stripped before duplicate detection. A correction points at the earlier item; the earlier item is marked corrected and hidden until you show corrected originals. Inferred relevance requires a note. An interpretation requires a note and is not copied into checklist evidence. Rumor or uncertain attribution is attached as your note, not as a clean sourced fact.

Workspace JSON is version `1`. Unreadable JSON or another version is left untouched until you choose to replace it.

## Capability matrix

| Source | Mode | What this draft does |
| --- | --- | --- |
| Federal Reserve calendar and monetary-policy RSS | Public read | Server fetch of two allowlisted `www.federalreserve.gov` URLs, 8s timeout, no redirects, 2 MB cap. Meeting rows and feed titles, links, and `pubDate`s. A successful fetch is not a freshness mark. Titles are macro context, not a ticker stream. Article bodies are not stored. |
| SEC EDGAR submissions | Public read | `data.sec.gov/submissions/CIK##########.json` for AAPL, TSLA, META, SPY, and DIA after the ticker field matched on 2026-11-09. QQQ is a name match only (empty tickers array, legal name contains QQQ). IWM is Unknown. SPX is not an issuer. Up to six recent filings, acceptance time, and the filing index link. Acceptance time is not the business-event clock. No article body. |
| Yahoo Finance symbol RSS | Public read, aggregator | `feeds.finance.yahoo.com/rss/2.0/headline` for the symbol, or `^GSPC` when the symbol is SPX. Titles, links, and `pubDate`s. A feed item is “names symbol” only when the title or Yahoo’s summary names it. Other items stay under feed association. Not publisher coverage and not a quote. Full text is not retrieved. The quote page stays a launcher. |
| Finviz | Manual | Quote launcher for stocks and ETFs. No API call. |
| MarketWatch | Manual | Quote launcher and RSS-directory link. No ingest. |
| OptionSlam | Manual | Stock earnings launcher. No API. Before open / after close are not clock times. |
| Bloomberg, WSJ | Manual | Launchers only. |
| CNBC | Manual | Quote launcher. A public Investing franchise RSS exists and is not a per-symbol feed, so it is not ingested as ticker news. |
| Manual capture and pasted X text | Manual | You type what you read. A typed handle is not identity verification. |
| X catalyst sweeper | Disconnected | Hosted public user lookup returned `client-not-enrolled` / Client Forbidden. No handle, numeric id, or post is verified, and none is shown. The server does not call `api.x.com` and does not accept a token. Optional parent file `data/x-snapshot.json` must match `context-desk.x-snapshot.v1` with `live: false`. Until it validates, the sweeper is not live. |
| Demo fixtures | Demo, off by default | Invented examples. Not market data. |
| TC2000 | Manual, outside this app | Not embedded, scraped, or replaced. |
| Thinkorswim / Schwab | Not connected | No order API. Phone execution only. |
| Intraday 15-minute bars | Manual | No documented keyless consolidated bar feed. Nasdaq bars need a bearer token. Relative volume, SPY/QQQ setup alignment, and the SPY/QQQ/NVDA block use bars you type or import. A typed bar is not a live quote. Time and sales, bid/ask side, and book depth are unavailable. An up bar is not a buy. |
| Block comparison | Manual | SPY, QQQ, NVDA, plus the selected symbol when it is not already one of those three. Completed 15-minute percent and session-open percent. Same, opposite, mixed, unchanged, or incomplete. Not a leader and not Academy confirmation. |
| SpaceX / SPCX | Listed stock, public reads where the other adapters already apply | SEC submissions CIK 0001181412 returned ticker SPCX on Nasdaq on 2026-11-09. Form 10-Q filed 2026-10-22 (`0001628280-26-066880`) registers Class A common stock, symbol SPCX, on Nasdaq and Nasdaq Texas. Yahoo symbol RSS answered for SPCX as an aggregator. Nasdaq Trader News DTN2026-8 says this listing was set for June 12, 2026 and that SPCX previously named a different security. Not TSLA. No synthetic price, option, or RVOL. |

Launchers that this environment actually received HTTP 200 for: Federal Reserve calendar, monetary-policy feed, and feed directory; Finviz AAPL (redirected to `/stock`); Yahoo AAPL and `^GSPC`; CNBC AAPL and `.SPX`; OptionSlam AAPL. MarketWatch, Bloomberg, and WSJ refused the automated request (401 or 403). Those links are still offered and marked unverified. Other symbols use the same path pattern and were not each checked.

## Unresolved before any further feed

- Finviz has announced an API. Fields, freshness, storage rights, and subscription were not verified. Reference: [Finviz API note](https://finviz.com/blog/our-upgraded-api-higher-limits-clearer-data-and-more-ways-to-connect/).
- MarketWatch has an RSS directory. Full-text processing rights are unresolved, so the directory is a launcher only.
- Yahoo’s symbol RSS is a public aggregator feed that returned HTTP 200 here. It is not a licensed full-text feed, and Yahoo’s current developer page for that exact URL was not re-certified.
- OptionSlam has no verified supported API. BO/AC is not a clock time.
- A publisher RSS feed is not permission to store or process the article. CNBC’s Investing franchise RSS is general, so it stays a launcher.
- Schwab’s developer catalog was not verified for an endpoint or an entitlement. This desk does not use it.
- X: the hosted public lookup in this session returned `client-not-enrolled` / Client Forbidden. Handles for Elon Musk and Donald Trump were not verified. Do not send a bearer token. A parent snapshot is the only ingest, and it is not a live poller.

The Federal Reserve pages used are public: [feeds](https://www.federalreserve.gov/feeds/feeds.htm) and the [FOMC calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm). A meeting date does not establish the statement release time. The calendar text says dates are tentative until confirmed at the prior meeting. The parsed 2026 rows are not monthly.

## Tests

Unit tests cover Eastern dates across the March 2026 spring-forward and November 2026 fall-back, checklist isolation and reset, evidence kind rules, option spread versus debit versus exposure versus stop versus plan, missing multiplier not becoming zero, SPX versus SPXW wording, URL rejection, dedupe and corrections, freshness without inventing it from ingest time, demo hiding, the Fed HTML and RSS parsers, redirect / foreign-host / oversize / timeout handling, corrupt local storage left untouched, Yahoo mention versus feed association, SEC ticker-field withholding, headline and filing attach without changing review or observation, X snapshot rejection when a payload claims to be live or uses a non-X URL, same-clock relative volume, partial and mismatched bars, SPX volume refusal, and the SPY/QQQ/NVDA block signs. NVDA is accepted as a comparison bar and rejected as a watchlist symbol. Live Yahoo and SEC responses are not required for the unit tests. A separate manual probe in this environment called those hosts.

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` are the checks. Browser smoke is desktop and a narrow width against the dev server.

## Next

- Keep TC2000 and the phone as they are.
- Earnings stay manual until a permitted source is chosen.
- X stays disconnected until a parent supplies a validated `context-desk.x-snapshot.v1` file from a hosted public read. This app will not take a token.
- Do not deploy this draft publicly from here. A user-accessible copy is this repo run locally with `npm install` and `npm run dev`. Loopback inside a cloud VM is not that preview.

## Not in this desk

No order ticket, no account login, no key collection, no chart, no technical scanner, no automatic green check, no made-up quote, target, fee, or market condition, and no claim that one unchecked item forbids a trade.
