# Focus test (native handheld PVT question)

Focus is a native `PVT` question in the survey editor, alongside Slider and Pain areas. A coach chooses its title, order, required state and 30- or 60-second duration. Configuration is stored in `Question.options` as JSON. Add it to the desired survey explicitly; deploying the feature does not add requirements to existing player forms.

The player opens their normal wellness profile, starts the question, completes the full-screen test, waits for server confirmation, then taps **Done**. Done returns to the same questionnaire with **Completed**. Practice and interrupted attempts remain in history but do not complete a required question. Test performance is never a pass/fail requirement. The player interface is English and uses the survey's existing theme tokens. `/pvt/demo` previews these same components without database writes.

## Standard protocol v3

- Official duration: 30 or 60 seconds, identical for all players assigned the same question. The first official start locks that question's duration for the survey-local calendar day. Editor updates and starts share a database advisory lock. Practice uses the same task for 30 seconds and is separate from reference data.
- Use the same phone/browser, hand/thumb and posture each day. Hold the phone upright; seated, standing, reclined and lying positions are recorded separately. Record minutes since waking and caffeine context. No stand, camera or microphone is used.
- Turn on Do Not Disturb. Watch the fixed counter area. Tap the fixed response pad once as soon as the counter appears; do not anticipate.
- Independent cryptographic random waits: uniform integer 1000–4000 ms after each response/timeout. Feedback lasts 1000 ms within the wait. Every player has the same rules and timing distribution; the sequence is unpredictable.
- The v3 stimulus is a fixed, high-contrast counter with immediate onset, no transition or animation. Stimulus contrast is identical across themes. Only surrounding chrome follows the survey theme. Versioning separates personal references from previous visual protocols.
- Primary pointer-down measures the response. Keyboard Space/Enter is available but should not be mixed with touch within a monitoring series. Taps without an active signal and responses below 100 ms are early taps.
- A signal times out after 30 seconds. The test stops at its assigned fixed horizon. Any final outstanding signal is saved as censored. Censored response time already at least 355 ms triggers a quality flag.
- Hidden page, blur, orientation change, navigation or cancellation interrupts the attempt. Frame gaps above 100 ms flag timing quality. Browser events cannot guarantee capture of OS termination or measure physical panel/touch latency.

Thirty and sixty seconds are experimental handheld adaptations. This implementation is not an independently validated instrument, diagnostic test, injury predictor or training-clearance score. Hardware timing and repeatability in the intended football population require separate validation.

## Storage and integrity

Three layers:
1. The survey Answer stores a verified attempt ID and a server-computed summary, never a test access token.
2. `pvt_sessions` stores player/team/survey/question IDs, question label snapshot, optional response link, protocol, device/browser, context, duration, status, timestamps and summary.
3. The attempt's raw JSON stores every response, early tap, timeout and final censored stimulus, plus interruption/frame-gap information.

The additive SQL adds the `PVT` enum value and three dedicated tables (`pvt_sessions`, the legacy reserved `pvt_configs`, and `pvt_auth_windows`). Nullable question/response links use `ON DELETE SET NULL`: replacing a daily wellness response cannot delete attempt history. Deliberate deletion of a player/team/survey follows the app's existing cascade lifecycle; inactivate records for archival instead.

Start uses the existing player access code/team check. Normal kiosk sign-in obtains a two-hour, HttpOnly signed player grant so the player need not type the code a second time. Direct survey links fall back to a code prompt. Coach Mode launches the same component for the selected player. The existing public kiosk exposes code material; this integration does not make that legacy identity system identity-proof.

Each start creates a random 256-bit attempt token, stored hashed. Finish validates that token, server wall time and raw timing structure, then recalculates scores. Conditional completion is idempotent and cannot overwrite the first stored result. Unfinished attempts expire for completion after 30 minutes. Pending results remain in tab sessionStorage until Done; retries resend the same attempt. Closing the tab can lose unsent browser data. Starting/saving a test requires connectivity. Existing offline wellness queuing is retained; a completed receipt can attach to its survey submission for up to 48 hours.

Submission validates player/question/survey ownership and a completed, non-practice attempt before storing a Focus answer. Daily response replacement and attempt relinking happen atomically. New raw/summary coach endpoints are authenticated and scoped to the admin's team. No token hashes or player codes are returned in result exports.

## Coach analysis and exports

`/admin/pvt` displays attempts, duration/version, median RT, mean reciprocal response speed, valid response count, early taps, exploratory slow-response percentage, quality flags, context and personal reference. Filter by survey, question, player and date or view 28-day history. Download attempts CSV or inspect authenticated raw trial JSON.

The descriptive reference uses the first eligible, quality-OK non-practice completion on each of at least 7 prior distinct days, up to the latest 14 within the loaded 28-day window. Match player, survey, question, duration, protocol, device/browser, posture and caffeine. Minutes awake are visible context, not statistically adjusted. Positive delta means slower median RT, not percentage fatigue. Repeats do not count as additional reference days. No reliable-change threshold or cross-phone ranking is implied.

The optional **Focus test** Live Ops column shows the first completed official result for the selected date, its quality and reference status, with a link to detailed analysis. It does not enter existing wellness/readiness calculations. If several Focus questions are assigned, the detailed view separates them.

Existing survey CSV includes separate numeric duration, median RT, responses and early-tap columns plus quality and attempt ID. Power BI flattened output includes those as separate metric rows. Existing question and body-map columns are retained. Raw trials are exported separately to avoid bloating wellness exports.

## Deployment and rollback

Builds use Prisma client generation and Next build only. Never run `db push --accept-data-loss`, reset, or automatic schema synchronization for this feature.

1. Test on the isolated synthetic fixture below and apply the actual additive SQL against the pre-feature schema in memory.
2. Back up production data to a private location. Build a production-target deployment with `--skip-domain` so the active domain stays on the old version during verification.
3. Apply `prisma/manual-migrations/2026-10-handheld-pvt.sql` explicitly. Only the enum and new tables/indexes/foreign keys are added. Compare existing record counts before and after.
4. Verify the staged deployment, then promote its domain. Add Focus questions through the normal editor when the coach is ready.
5. Prefer an enum-aware application rollback and retain the additive tables. A build predating the PVT enum cannot read native PVT questions: snapshot and reconfigure those questions before restoring such a build. `PVT_ENABLED=false` disables new test operations; remove the required state/question before using that emergency switch on an assigned survey. Do not drop result tables.

Actual iPhone/Safari timing, touch latency, OS interruption behavior and agreement with a reference instrument remain device-validation work. Automated browser tests establish application behavior only.

## Reproduce verification

Install fixture dependencies outside the app:

```sh
npm install --prefix /tmp/wellness-pvt-test-runtime --ignore-scripts @electric-sql/pglite@0.5.10 @electric-sql/pglite-socket@0.2.13
PVT_TEST_RUNTIME=/tmp/wellness-pvt-test-runtime node tests/pvt.migration.mjs
PVT_TEST_RUNTIME=/tmp/wellness-pvt-test-runtime node tests/pvt.fixture.mjs
```

In another terminal, build/start with synthetic-only credentials:

```sh
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1&pgbouncer=true' ADMIN_JWT_SECRET=pvt-local-test-only npm run build
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1&pgbouncer=true' ADMIN_JWT_SECRET=pvt-local-test-only npm run start -- --hostname 127.0.0.1 --port 4317
```

Run against a fresh fixture:

```sh
npm run test:pvt
PVT_TEST_BASE_URL=http://127.0.0.1:4317 PVT_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1&pgbouncer=true' node tests/pvt.integration.mjs
```

Never reuse production environment files for synthetic tests. Stop the fixture to discard its in-memory data.


## Unified wellness CSV and Live Ops (October 2026)

The permanent main URL is `/api/surveys/{surveyId}/export/csv`. It retains one row per submitted wellness response, with the original wellness/body-map fields and Focus fields prefixed by the question text. Existing six Focus column names are retained. Added columns contain status, protocol, survey-local test date, UTC start/completion timestamps, mean reciprocal response speed (1/s), exploratory slow-response count/percentage (≥355 ms), quality flags, posture, caffeine (0/1), minutes since waking and question ID. `playerId` and `responseId` are appended before session tags. Numeric missing values are blank; measured zero stays zero. Empty exports include the header. Responses are served with `Cache-Control: no-store`.

Focus joins require the answer's exact attempt ID, response ID, player ID and question ID, plus a non-practice completed session. No same-day/best/latest substitute is used in the CSV. Old answer snapshots retain their existing summary fields if a joined session is unavailable; unavailable context is blank. No raw events, player grants, token hashes or device identifiers enter the public CSV. The established `?legacy=1` option removes only the extra body-map detail columns; it includes Focus. The Power BI JSON endpoint uses the same Focus values and units. Existing Power Query column-selection steps may need to include the added columns.

Live Ops displays a dedicated Focus overview regardless of an administrator's saved table-column visibility. The Focus table column is enabled in new/default layouts. The selected wellness response's attached result takes priority, matching CSV; otherwise the first completed official test on the selected date is shown as awaiting wellness submission. Practice/unfinished attempts stay separate. Analysis links carry survey, player, question and date context. Focus does not contribute to wellness readiness scores or rule weighting.

The Focus analysis page distinguishes linked results from unsubmitted tests and retains a separate attempts CSV. Its personal reference uses up to 14 distinct prior eligible days within the 28 calendar days preceding each test, with a minimum of seven and the established matching conditions. Extra earlier history is loaded to calculate references for historical rows in the 28-day view; only the requested display window is shown. Positive percentage change is slower median RT, never a fatigue percentage.

Demo attempts at `/pvt/demo` are isolated and never exported. Players must finish their Focus test, select Done, then submit the wellness questionnaire to include it in the main CSV.


## Glass setup and donut visual version v4

The setup uses the wellness theme's glass surfaces, three concise instruction tiles, 2×2 posture choices and centered 3×2 awake-minute presets with manual entry. The old “A little time…” subtitle is removed. Reduced-motion preference disables decorative setup/result transitions, not the measured counter.

`handheld-pvt-v4` replaces the white square with a fixed-size circular SVG counter. Its clockwise arc is presentation only: `min(elapsedMs / 500, 1)`. The center displays uncapped elapsed milliseconds. The waiting ring is stationary; numeric post-tap feedback freezes briefly, then resets before the next signal. No CSS interpolation is applied to the arc. All themes share the same blue signal color and neutral background/text contrast; app chrome follows the chosen theme. 500 ms is not an interpretive or fatigue threshold. Engine waits, pointer timing, 30/60-second durations, raw trials and server-computed metrics are unchanged.

New clients request v4 and sessions record that version. Cached v3 square clients may still start/finish v3 sessions during deployment; the server records the requested supported renderer version rather than relabelling old clients as v4. Earlier pending results remain valid. Existing question options using v3 remain editable without a data rewrite; updated builders write v4 options and duration continues to come from the assigned question/day lock. Baselines already match protocol version, so square and donut records never pool. CSV, Live Ops and history retain every session's original version. No database migration or production answer updates are needed.
