# Live Ops monitoring

`/admin/ops` has Daily overview, Measurements, Reliability, Weekly report, and Rules & metrics. Existing wellness table/card settings, body maps, rules, interventions, HR trends and Focus analysis remain accessible. The CSV button opens the existing permanent, unified survey export. Export columns and stored survey answers are unchanged.

## Results and weekly reporting

- Team scope is taken from the admin session. The report uses the selected survey and its timezone, including DST; calendar dots, month cache and daily results use the same day boundaries.
- A completed test awaiting questionnaire submission is displayed separately from a saved wellness result. Submitted Focus results must match the exact receipt, response, player and question. Submitted HR readings take precedence over operational observations.
- Weekly means seven calendar days ending on the selected date; the comparison covers the preceding seven days. Each player has one latest questionnaire per local day. The roster is the currently active team roster.
- Check-in coverage is relative to days with squad submissions, not a presumed training schedule. No submission does not prove no test was attempted.
- Weekly Focus medians exclude practice, invalid, repeat-required and quality-review attempts. Duration, device/browser fingerprint, protocol, posture and caffeine contexts remain separate. HR medians keep question, position, protocol and algorithm separate. Historical HR device matching is unavailable. Descriptive changes need at least three recorded days in both periods; this is a coverage rule, not a clinical threshold. Existing wellness WATCH/ALERT flags are reused without creating a new fatigue score.
- Print / save PDF uses the browser print dialog and prints the weekly report. Nothing is emailed or scheduled.

## Reliability observations

The additive `rhr_observations` table records starts and terminal outcomes, position, acquisition/protocol revision, coarse platform/browser groups, and server-computed accepted BPM/frame rate. Camera/video data, optical samples, camera IDs, exact phone model guesses and full user agents are not stored in this table. The existing Focus session schema is unchanged. Client-reported HR failures are labelled as browser-reported; clients cannot submit accepted outcomes or BPM through this endpoint.

Optional schema provisioning is CREATE TABLE/INDEX IF NOT EXISTS only; the same DDL is in `prisma/manual-migrations/2026-10-measurement-observations.sql`. Start/finish observation writes run after the HTTP response and errors are isolated from measurement. A late client failure cannot downgrade a server-accepted result. The diagnostic demo never writes observations. Tracking only describes recorded attempts, not sensor accuracy. Historical failed HR scans cannot be reconstructed. Missing abandoned starts become unfinished after 15 minutes; active starts are excluded from the completion-rate denominator. Incomplete tracking is disclosed instead of displayed as a successful zero-failure period.

HR estimator, RGB sampling, camera/torch/exposure controls, 15-second capture and Focus timing/anti-cheating protocol are unchanged.

## Validation

`npm run test:ops`, `npm run test:rhr`, `npm run test:pvt` test pure logic and protocol regression cases.

`tests/ops.integration.mjs` requires explicit loopback `PVT_TEST_BASE_URL` and `PVT_TEST_DATABASE_URL`, with the isolated fixture from `tests/pvt.fixture.mjs`. It checks authentication/scoping, deduplication, accepted-result immutability, original HR result calculation, timezone alignment, CSV headers and fail-open tracking. It leaves a synthetic survey and private `/tmp/ops-test-context.json` for `tests/ops.browser.cjs`. Browser tests require the same loopback base and `RHR_PLAYWRIGHT_MODULE`/`RHR_BROWSER` when not installed globally. The HR camera matrix uses owned synthetic video streams, not physical phone hardware. Run PVT integration before Ops integration because the legacy PVT fixture clears test-team sessions.
