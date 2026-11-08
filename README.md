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

Data is stored in this browser under `context-desk.workspace.v1`. No account, no API key, and no environment variable is required. The Federal Reserve reader runs server-side when you open the desk or press Refresh.

## What the screen does

- Watchlist: TSLA, META, AAPL, SPY, QQQ, IWM, DIA, and occasional SPX. SPX is the index, not the SPY ETF. Filters narrow the chips without dropping the selected symbol.
- Checklist and option capture are keyed by symbol plus the Eastern calendar date. Reset clears that pair only. The news library, fundamentals, and earnings notes stay.
- Checklist states are confirmed, not met, unknown, and not applicable. Unknown is the start. A count is not a ban. Gap is strategy-dependent and can be not applicable.
- Bollinger, moving averages, and trendline evidence can only be “you, in TC2000.” A headline cannot check them.
- Fed meetings and earnings can take a sourced fact or your note. Attaching one does not change the status.
- The option panel keeps bid/ask spread, premium debit, full premium exposure, estimated stop risk, and the contract-return plan separate. Blank is unknown, not zero. Fees and tick size stay unknown unless you type a fee you saw. The +10% field is a plan for the contract, not an account return and not a quote. Multiplier stays blank until you enter it or confirm 100.
- SPX and SPXW are called out as different roots. ETF share-delivery rules are not applied. Settlement and expiration time are not loaded.
- News items keep the original headline and quote apart from any interpretation. Interpretations are labeled and are not buy or sell signals. Duplicates and corrections are explicit. Demo fixtures stay hidden until DEMO is on, and they use invented `example.com` text.
- Analyst targets are stock targets you type, with firm, date, and horizon only if you enter them. They are not scalp exits. Stock recommendations are not used for ETFs, the index, or options.

## Design

Wireframe: a short ink mast, a watchlist, then checklist | feed | context rail.

Critique that the build follows:

- Equal columns would starve headlines, so the feed is the flexible center.
- Status is a labeled radio. Unknown uses an amber wash and the word Unknown, so a missing value is not a calm zero and not a green check.
- There is no price chart and no profit card. Those would impersonate TC2000 and a broker.
- Six named colors: ink `#1c1917`, paper `#f3efe6`, rule `#d5cfc3`, signal `#143f4d`, amber `#7a4e0d`, clay `#6f3330`. Washes are tints of those, not extra hues.
- Type: Newsreader for the symbol and titles, Source Sans 3 for the interface, IBM Plex Mono for figures and timestamps.
- DEMO is a full-width clay banner, not a toast.
- Narrow widths stack in the order symbol, checklist, feed, then calendar, contract, and fundamentals.
- Focus rings stay visible. Motion is not used. `prefers-reduced-motion` disables animation if any is introduced later.

## Data contracts

Session date is the `America/New_York` calendar date. A daylight-saving gap or overlap in a typed clock time is rejected instead of guessed. Displayed instants include EST or EDT.

Checklist item ids: `fed_earnings`, `bollinger`, `moving_averages`, `trendline`, `gap`, `option_contract`.

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
| Federal Reserve calendar and monetary-policy RSS | Live read | Server fetch of two allowlisted `www.federalreserve.gov` URLs, 8s timeout, no redirects, 2 MB cap. Meeting rows and feed titles, links, and `pubDate`s. Article bodies are not stored. |
| Finviz | Manual | Quote launcher for stocks and ETFs. No API call. |
| MarketWatch | Manual | Quote launcher and RSS-directory link. No ingest. |
| Yahoo Finance | Manual | Quote launcher. SPX opens `^GSPC`. No Finance API. |
| OptionSlam | Manual | Stock earnings launcher. No API. Before open / after close are not clock times. |
| Bloomberg, WSJ, CNBC | Manual | Launchers only. |
| Manual capture and pasted X text | Manual | You type what you read. A typed handle is not identity verification. |
| X catalyst sweeper | Not connected | Paused. No polling, cookies, or social session. Elon Musk and Donald Trump are names only; handles and numeric ids are not verified. |
| Demo fixtures | Demo, off by default | Invented examples. Not market data. |
| TC2000 | Manual, outside this app | Not embedded, scraped, or replaced. |
| Thinkorswim / Schwab | Not connected | No order API. Phone execution only. |

Launchers that this environment actually received HTTP 200 for: Federal Reserve calendar, monetary-policy feed, and feed directory; Finviz AAPL (redirected to `/stock`); Yahoo AAPL and `^GSPC`; CNBC AAPL and `.SPX`; OptionSlam AAPL. MarketWatch, Bloomberg, and WSJ refused the automated request (401 or 403). Those links are still offered and marked unverified. Other symbols use the same path pattern and were not each checked.

## Unresolved before any further feed

- Finviz has announced an API. Fields, freshness, storage rights, and subscription were not verified. Reference: [Finviz API note](https://finviz.com/blog/our-upgraded-api-higher-limits-clearer-data-and-more-ways-to-connect/).
- MarketWatch has an RSS directory. Full-text processing rights are unresolved, so the directory is a launcher only.
- Yahoo Finance has no verified finance-specific API here.
- OptionSlam has no verified supported API. BO/AC is not a clock time.
- A publisher RSS feed is not permission to store or process the article.
- Schwab’s developer catalog was not verified for an endpoint or an entitlement. This desk does not use it.
- X monitoring needs a supported feed plus verified handles and numeric ids. A chat connector is not an entitlement for this app. No cookie or token scraping.

The Federal Reserve pages used are public: [feeds](https://www.federalreserve.gov/feeds/feeds.htm) and the [FOMC calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm). A meeting date does not establish the statement release time. The calendar text says dates are tentative until confirmed at the prior meeting. The parsed 2026 rows are not monthly.

## Tests

Unit tests cover Eastern dates across the March 2026 spring-forward and November 2026 fall-back, checklist isolation and reset, evidence kind rules, option spread versus debit versus exposure versus stop versus plan, missing multiplier not becoming zero, SPX versus SPXW wording, URL rejection, dedupe and corrections, freshness without inventing it from ingest time, demo hiding, the Fed HTML and RSS parsers, redirect / foreign-host / oversize / timeout handling, and corrupt local storage left untouched.

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` are the checks. Browser smoke is desktop and a narrow width against the dev server.

## Next

- Keep TC2000 and the phone as they are.
- Add another live adapter only after the feed’s fields, freshness, and storage rights are verified.
- Verify X handles and ids before any sweeper exists. Do not poll in the meantime.
- Earnings stay manual until a permitted source is chosen.
- Do not deploy this draft publicly from here.

## Not in this desk

No order ticket, no account login, no key collection, no chart, no technical scanner, no automatic green check, no made-up quote, target, fee, or market condition, and no claim that one unchecked item forbids a trade.
