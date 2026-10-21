# Focus monitoring (30 / 60 seconds)

This release adds descriptive analysis of the existing handheld Focus task. It does not change stimulus timing, input handling, task duration, the three-early-tap limit, completion rules, historical scores or protocol version. No new questionnaire items or measurement hardware are introduced.

## Access

- Focus / Attention: select **Inspect session** beside an attempt.
- Live Ops > Individual player > Daily history > Focus attempt log: **Inspect session**.
- Individual player trends, correlations and standardized profiles also offer Focus mean RT, RT variation and exploratory slow-response percentage, using only the currently selected compatible saved setup.

## Calculations

`focus-descriptive-v1` uses actual `response` trials with finite RT >= 100 ms. Slow measured responses remain included; timeouts, false starts and the unfinished final stimulus are not measured RTs. Historical long responses retain their original values. The original saved median remains separately displayed, including the original scoring behavior for incomplete attempts.

- Mean RT: arithmetic mean.
- SD: sample SD (n - 1), unavailable below two responses.
- CV: sample SD / mean RT * 100. A measured zero is retained.
- P10/P90: linearly interpolated empirical quantiles, Hyndman-Fan type 7. These are descriptive sample quantiles, not population norms or uncertainty intervals.
- Slow responses: count and percentage of measured RT >= 355 ms. The threshold is exploratory for this 30/60-second adaptation, not an established fatigue boundary.
- Halves: split by stimulus onset at 15/30 seconds for a 30/60-second task. Each half needs at least three measured responses before its median is displayed. Change is (second median / first median - 1) * 100 and requires both medians. Sparse windows remain unavailable. No endurance classification is assigned.

Session comparisons use the first eligible attempt per prior calendar day, up to the latest 14 days within the preceding 28 calendar days. Player, survey/question, duration, protocol, device/browser, posture and caffeine must match. Each metric needs seven historical values; its reference is their median. CV/slow-percentage differences are percentage points. Invalid/review/practice current sessions retain descriptive data but have no change comparison. Truncated history suppresses references. This is separate from the existing Individual profile's 14-day minimum Z/STEN calculation, and neither establishes meaningful-change or clinical thresholds.

## Storage and exports

New server-computed summaries include an additive `analysis` object. Existing summary fields and the `handheld-pvt-v5` measurement protocol remain unchanged. Historical extra metrics are derived from original raw trials on read without database updates. Missing/malformed raw records produce blank extra metrics, never estimated values.

The unified wellness CSV, permanent CSV URL and Power BI JSON share appended descriptive fields. Existing Focus field names/order are preserved. Raw data, tokens and device identifiers are not added to these exports. The protected session page additionally offers a trial CSV.

The monitoring endpoint is an opt-in extension of the existing team-scoped admin raw-record endpoint (`?monitoring=1`). History is limited to the same team/player/setup and 28 prior days, with a 2001-row detection limit. It performs no writes and strips device identifiers. Only derived metrics, not raw trials, enter the Individual profile response.

## Verification

- `npm run test:pvt`: hand-calculated metrics, sparse/constant records, exclusions, historical immutability, coherent references, zero-reference arithmetic, existing anti-spam/idling/duration rules.
- `npm run test:ops`: selected-setup derived series, missing raw records, correlation/STEN regressions.
- `tests/pvt.integration.mjs`: loopback-only synthetic fixture; actual server completion, receipt, retry and combined CSV/Power BI checks, monitoring authorization, ownership and reference history.
- `tests/focus-monitoring.browser.cjs`: explicit loopback-only fixture, Chrome and WebKit session pages, responsive widths, downloads, failure UI, three-early-tap handling and real-time 30/60-second demo completions.
- Existing Individual browser/PDF regression checks and HR unit tests.

These software checks do not establish physical-device timing accuracy, test-retest reliability, fatigue sensitivity or neurological-health validity. No medical, injury or composite fatigue prediction is produced.
