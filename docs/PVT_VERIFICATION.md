# Focus integration verification — 15 October 2026

Branch: `codex/handheld-pvt`, based on `11a0c7b`. The original checkout remains untouched. Its 12 existing tracked local changes were preserved in the integration worktree before updating the survey form, Coach Mode and Live Ops.

Passed:
- 16 deterministic tests for both supported durations, unpredictable waits, response timing, anticipations, timeouts, interruption/censoring, record validation, personal reference, timezone/origin handling and additive build safety.
- 38 native API integration assertions using a separate loopback PGlite fixture with synthetic teams and players. Covers native question configuration, server player grant, wrong codes/team/question, protocol version, origin, result-token validation, server recomputation, idempotency, required-question enforcement, forged receipts, numeric CSV/Power BI output, retention/relinking on daily wellness replacement, practice/interruption exclusion, authenticated team-scoped raw trials, persistent rate limiting, legacy wellness submission, simultaneous editor/start consistency and assigned 60-second duration.
- Actual additive migration applied in memory to the pinned pre-feature schema: old answer data retained; new PVT question insertion succeeds.
- TypeScript no-emit check and targeted ESLint for the Focus module and fixture scripts.
- Optimized local Next build and Vercel production-target build with domain promotion deferred for verification.
- Chromium mobile 390×844: full real-time 30-second native test, saved completion, explicit Done, return to the same questionnaire with Completed, successful whole-survey submission and interrupted-attempt behavior. No browser exceptions.
- Mobile screenshots of all five survey appearance themes, preparation, running, completion and the completed native question. No horizontal overflow in preview themes.

Production safeguards:
- A private, permission-restricted consistent JSON snapshot of all 15 public data tables was saved before migration (41,538 rows, about 6.45 MB).
- The production-target deployment was initially built with `--skip-domain`; the canonical domain remained on `dpl_6ZefzH6ffJGxTWyGmKUXudJGCY7A` during staging.
- Existing survey requirements are not automatically changed. Coaches add Focus through the editor.
- Builds never run schema push or destructive migration commands. Roll back application code by promoting the previous deployment while retaining additive data tables.

Limits:
- Automated browser and PGlite tests establish software behavior, not physical reaction-time accuracy.
- Actual iPhone/Safari touch/panel latency, OS interruption edge cases, repeatability and agreement with a reference instrument require device validation.
- Player identification continues to use the app's legacy access-code system; the existing public kiosk payload exposes code material. Server receipt verification does not make that legacy identity system identity-proof.
- Thirty- and sixty-second monitoring, exploratory slow-response metrics and personal-reference deltas are not validated fatigue percentages, diagnosis or training-clearance rules.
