# Handheld PVT — implementation and controlled rollout

This is an opt-in handheld adaptation of brief PVT, not an independently validated instrument or a measure of overall fatigue, injury risk, match decision-making or training clearance. No camera/microphone code or permission requests are included.

## Player protocol v1

- A coach selects one official duration per survey: 60, 90 or 180 seconds. The 60/90-second modes are experimental adaptations, not validated equivalents. Duration cannot change after an official attempt starts that survey-local day.
- Familiarisation: complete a separate 60-second practice attempt before regular monitoring. Practice never contributes to the personal reference. Do not practice before every daily measurement.
- Use the same phone/browser, hand/thumb and posture daily. Hold the device in portrait orientation. Seated, reclined and lying are recorded separately; posture equivalence is not claimed. No stand required. Record minutes awake and whether caffeine has already been consumed. Choose a consistent daily measurement context with the coach.
- Enable Do Not Disturb. Watch the fixed counter area and tap the fixed response button as soon as numbers appear. Do not anticipate. Practice and official attempts use identical instructions.
- Cryptographically sampled independent uniform integer waits: 1000–4000 ms after the preceding response/timeout. Response feedback lasts 1000 ms and is included in that wait. No fixed sequence or moving targets. Every player gets the same stimulus rules/distribution, not a memorisable schedule.
- Response is recorded on primary pointer-down, not click. Keyboard Space/Enter is supported for accessibility, but should not be mixed with touch in a monitoring series. Negative/invalid timing is rejected. Responses <100 ms and taps without an active stimulus count as false starts.
- A response timeout is recorded after 30 seconds. The test ends at its fixed duration; any outstanding stimulus is retained as censored, not silently converted into an ordinary response. A censored response already ≥355 ms flags the attempt for review. This fixed-end behaviour is an adaptation and is explicitly versioned.
- Hiding the page, losing focus, changing orientation, navigating away or cancelling interrupts the attempt. Browser events are best-effort: mobile OS termination may leave a STARTED attempt without raw data. The original attempt is retained either way. Gaps >100 ms between animation frames flag timing quality for review; this cannot measure actual panel/touch latency.

## Measures and interpretation

Save all raw trials; recalculate summaries on the server. Report sample count, median response time, mean reciprocal response time (1/s), early taps, slow-response count/rate, and quality flags. The ≥355 ms brief-PVT reference is exploratory in this handheld implementation and especially in 60/90-second adaptations. It is not a clinical/fatigue threshold. Frame lag, unfinished response, few samples, interruption or excessive early taps require review.

The descriptive personal reference requires 7 distinct previous eligible days (up to the most recent 14 in the fetched 28-day history). Use the first completed quality-OK non-practice attempt per day with matching player, survey, protocol version, duration, device ID, browser user agent, posture and caffeine context. Minutes awake remain visible for staff interpretation; they are not statistically adjusted. No significance, smallest worthwhile change or reliable-change threshold is inferred from seven days. Positive percentage change means slower median RT, not percentage fatigue. Cross-phone raw RT rankings are not supported. Browser storage deletion or device/browser changes can require rebuilding the reference.

Sources: Basner et al. (2011), https://pubmed.ncbi.nlm.nih.gov/22025811/ ; Grant et al. (2017), https://pubmed.ncbi.nlm.nih.gov/27325169/ ; Jones et al. (2018), https://pubmed.ncbi.nlm.nih.gov/29384434/ . These studies do not validate this implementation.

## Integration

Existing wellness response submission is unchanged. The optional PVT-status request fails closed: disabled or unavailable means the existing return to kiosk. For an online successful wellness submission, an enabled PVT config redirects the identified player to /pvt/[surveyId]?playerId=...&lang=sr|en. The player confirms their existing access code again because the legacy kiosk client-side check is not a server identity session. Coaches can use the same route to repeat a test without replacing wellness answers. The player identity comes from the server-verified code/team combination, never from a posted score.

PVT persists in new pvt_configs, pvt_sessions and pvt_auth_windows tables. Existing tables/columns are not altered. All attempts are append-only at start; completion is a one-time conditional update authorised with a random 256-bit per-attempt token stored hashed. Retries are idempotent, never replace the first stored result and expire after 30 minutes. Pending finished records are retained in the same tab's sessionStorage for retry; this is not an offline-first application. Do not promise recovery after closing the tab. Unfinished STARTED sessions remain visible. No automatic best-of selection or forced retest after poor performance.

New routes: /admin/pvt (authenticated/team scoped), /api/pvt/admin, /pvt/[surveyId], /api/kiosk/[surveyId]/pvt. /pvt/demo is an isolated demo that makes no database/API writes. The new PVT API never returns access codes. Start attempts are rate-limited in PostgreSQL per player/survey/10-minute window, including failed code attempts. This does not remediate pre-existing public kiosk code exposure; review the legacy kiosk authentication before treating the system as identity-proof.

The coach page displays all attempts, practice/repeat labels, quality, context, reference and CSV export. It is separate from existing wellness scores and does not change their formulas. Legacy CSV/Power BI schemas remain unchanged. The new attempts CSV is importable separately. Deliberate deletion of a player/survey/team cascades to its PVT records consistently with existing lifecycle deletion; use inactive status for archival. Expired authentication windows can be deleted by an explicit maintenance task; no scheduled job is installed.

## Production safety

No production credentials are copied into the worktree. No production database has been queried or mutated for development. No push or deployment is part of the local implementation.

The old vercel-build command ran prisma db push --accept-data-loss. It is now prisma generate && next build: builds must not mutate the schema. Existing schema changes in other local work must be handled separately, not bundled implicitly.

1. Confirm which Git branch/deployment/domain is live and how Vercel Preview vs Production DATABASE_URL and direct database URLs are scoped. The checked-in canonical domain is not proof of the latest deployed SHA.
2. Provision/choose a separate preview PostgreSQL database. Never point preview at production. No deployment should occur until this is confirmed.
3. Back up the chosen database and review prisma/manual-migrations/2026-10-handheld-pvt.sql. It creates only three tables, indexes and foreign keys on the new tables. Apply explicitly with the database operator's approved tool. This repository uses manual migrations; do not run migrate deploy as though a full Prisma migration history existed. Do not use db push --accept-data-loss.
4. Deploy a private preview with PVT_ENABLED=true, opt in a test survey in /admin/pvt, and use synthetic players. Production remains PVT_ENABLED unset/false. Existing wellness works with PVT off even before the new migration.
5. Validate on the actual supported phones (including Safari/iOS): panel/touch latency against a high-speed recording/reference setup; frame stalls; app switching; orientation; interruptions; retry and access control. Software tests alone cannot validate physical reaction-time accuracy. Pilot repeatability and agreement with a reference implementation before meaningful-change thresholds or staff decisions.
6. After review, make a production backup, apply the reviewed additive migration explicitly, deploy with flag off, regression-check wellness/kiosk/exports, then enable the flag and opt in one survey. Disabling the flag is the immediate functional rollback and retains records. Do not drop tables for rollback.

## Verification

- npm run test:pvt: deterministic timing/state-machine, data validation, personal-reference and timezone tests; no database connection.
- npx tsc --noEmit --incremental false
- npx eslint src/lib/pvt src/components/pvt src/app/pvt src/app/admin/pvt src/app/api/pvt 'src/app/api/kiosk/[surveyId]/pvt'
- npm run build (requires dependencies/font-download access; uses no migration command).
- Integration testing uses an explicitly separate loopback PostgreSQL-compatible fixture, synthetic teams/players, real API routes and browser UI. Never reuse production .env files for this.

### Reproduce the isolated integration fixture

Install test-only dependencies into a separate temporary directory (not this app's dependency tree):

```sh
npm install --prefix /tmp/wellness-pvt-test-runtime --ignore-scripts @electric-sql/pglite@0.5.10 @electric-sql/pglite-socket@0.2.13
PVT_TEST_RUNTIME=/tmp/wellness-pvt-test-runtime node tests/pvt.fixture.mjs
```

In another terminal, run the built app with synthetic-only settings:

```sh
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1&pgbouncer=true' PVT_ENABLED=true ADMIN_JWT_SECRET=pvt-local-test-only npm run start -- --hostname 127.0.0.1 --port 4317
```

Run the integration assertions against a fresh fixture:

```sh
PVT_TEST_BASE_URL=http://127.0.0.1:4317 PVT_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1&pgbouncer=true' node tests/pvt.integration.mjs
```

The fixture uses an in-memory WASM PostgreSQL implementation, so actual hosted PostgreSQL and target-device tests remain part of preview verification. Its test-only admin signing secret is intentionally public and must never be used outside this loopback fixture. Stop the fixture to discard all synthetic data. Tests write an ephemeral synthetic admin cookie to /tmp/pvt-test-admin-cookie for local UI checks.
