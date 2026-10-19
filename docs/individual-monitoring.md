# Individual player monitoring

Live Ops → Individual player. Select one player, survey and inclusive date range (up to 366 calendar days). Inactive players retain their history. All new API reads are scoped to the authenticated admin's team; no measuring, CSV, questionnaire, or persistence contracts change.

## Daily data and measurement setups

- The latest submitted questionnaire per survey-local day supplies analytical values. Every submission remains available in the daily drill-down; missing days stay missing.
- RHR uses accepted, rest-confirmed answers saved in that questionnaire and measured on that local day. Setups separate question, position, protocol and algorithm. Device identity is not present in saved HR answers, so HR setup matching cannot establish identical hardware.
- Focus uses the exact linked receipt/session, player, question and response. Practice, non-completed, repeat/review, missing median and different-day results are excluded. Setups additionally separate duration, private device/browser identity, posture and caffeine. Only opaque setup labels are returned; raw device IDs, user agents, tokens, receipts and optical samples never leave the server in this report.
- Camera and Focus attempt logs retain acquisition outcomes, including unsuccessful or unsaved attempts. Their existence does not make them eligible for analytical series.
- Standard wellness metrics use existing parsing and admin question mappings. Other numeric survey answers are available as extra variables; clock times, text and anatomical identifiers remain in the response history rather than being treated as linear numerical scales.

## Personal STEN and Z

A day is scored against that same player's preceding 28 calendar days from the selected setup. The scored day and future observations are excluded. At least 14 finite daily values and nonzero sample SD are required. The 14-day rule is an application eligibility choice, not a validated clinical threshold.

`Z = (value - previous mean) / previous sample SD`

`Personal STEN = clamp(round(5.5 + 2 * Z), 1, 10)`

Higher STEN means higher raw measurement; it does not mean better readiness. This is a personal display transformation, not population norms or a validated wellness instrument. Normality of individual distributions is not assumed proven. Original values, Z, reference count and missing/constant-baseline reasons remain visible.

Reference: [Saville, scoring norms](https://www.savilleassessment.com/wp-content/uploads/2024/07/Chapter-18-Norms.pdf).

## Correlations

Default Spearman correlation is Pearson correlation on average ranks, including tied values. Pearson on raw values is optional. Both use complete paired dates and one daily value, without imputation. Coefficients require at least 10 paired days and variation in both variables; the count and underlying pairs are always visible. The minimum is an application rule, not a guarantee of precision.

The one-day lag pairs yesterday's variable with today's outcome using exact calendar dates. Changes require the preceding calendar day on each side; the previous available observation is never substituted. All dates used for correlations must be in the selected range. No p-values are shown: serial dependence, multiple comparisons, shared trends and confounding prevent interpreting these descriptive coefficients as causal or validated predictive evidence.

References: [R correlation methods](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/cor.test.html), [NIST scatter plots](https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm).

## Experimental ridge models

Separate same-day RHR and Focus models use six fixed predictors: sleep duration, sleep quality, fatigue/energy, soreness, mood and stress. Each selected setup requires at least 80 complete daily records in the selected range, at least 45 training days, and training variation. These are operational safeguards, not sample-size validation claims.

The most recent 25% (at least 20 days) form one untouched temporal holdout. Seven calendar days immediately before the holdout are excluded from training. Feature means/SD and the outcome mean are estimated on training data only. Centered ridge regression solves `(X'X + 10 I) beta = X'(y - mean(y))`; the intercept is unpenalized. There is no tuning on the holdout. Constant training features contribute zero.

Display holdout MAE, the training-mean baseline MAE, improvement (including negative values), dates and observed/estimated holdout points. Do not issue future forecasts, injury probabilities or fatigue diagnoses. A single personal holdout is not external validation. No model output is shown for insufficient or constant data. Models execute locally in the browser from authorized data and are not persisted or sent to another service.

References: [Ridge objective](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html), [temporal validation](https://scikit-learn.org/stable/modules/cross_validation.html#time-series-split).

## PDF and checks

Light/Dark PDF exports include objective trends, statistics, correlation sample sizes, daily values, body-area history and model evidence. Full history additionally includes every saved answer and attempt logs. Long answers continue across rows; player, range and setups repeat on each page. PDF libraries load only for export.

- `npm run test:ops`: existing tests plus statistics, report assembly, eligibility, privacy, temporal leakage and NumPy-reference ridge tests.
- `tests/individual.integration.mjs`: explicit loopback fixture database and application URLs required. Seeds only its own `individual-fixture-*` records and checks authentication, team scoping, invalid ranges, history, cohorts and response privacy.
- `tests/individual.browser.cjs`: uses its saved local fixture session; supports Chromium and WebKit via the bundled Playwright runtime. No production player submissions.
