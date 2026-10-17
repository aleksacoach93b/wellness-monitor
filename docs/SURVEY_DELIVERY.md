# Questionnaire journey and reliable delivery

This change covers the player questionnaire and its existing offline queue. Focus/RHR acquisition, scoring, CSV schemas and Live Ops calculations are unchanged.

- Question defaults and required validation remain the same. Progress reflects currently answered questions, including existing defaults.
- Review lists readable answers; measurement access tokens are never displayed. Final confirmation sends the questionnaire.
- Same-day drafts are scoped to survey/player/question configuration in session storage; reload and the explicit close action save the latest state. The old draft format is migrated when compatible. Drafts are not submitted results.
- Final confirmation freezes one payload under one UUID in local storage before sending. Network failures, HTTP 408/429/5xx, timeouts and malformed acknowledgements retain it for retry. Reconnect, a bounded background retry and a manual button retry the same request.
- Only a valid server acknowledgement shows **Questionnaire saved** and returns a player to the kiosk. Saved local receipts contain identifiers, not answers.
- A definitive rejection retains the answers and offers review/edit. A rejected Focus/RHR receipt clears only that question on edit so it can be completed again. Uncertain deliveries cannot be silently edited into another request.
- If storage is unavailable, the current page retains the request in memory and warns the player to keep the page open; it does not claim durable storage.
- Kiosk retry is scoped to its survey, with a persistent banner for unconfirmed submissions. Each player's pending payload is restored only on that player's questionnaire.

## Server receipts

Apply `prisma/manual-migrations/2026-10-survey-delivery-receipts.sql` before release. It only creates an additive ledger table/index; no existing response/answer data is migrated. A guarded initializer supports cold deployments. Prisma Client must be regenerated.

The optional delivery UUID is locked and recorded atomically with the existing response/Focus links. A canonical request hash detects changed payloads. Exact retries acknowledge the original response even if that response was subsequently superseded or its test receipt expired. They never recreate old answers. Existing clients without a UUID keep the existing submission behavior.

An unacknowledged previous-day request, incorrect client date, or request older than an already saved response is retained for explicit review rather than replacing newer data. Existing same-day/session response replacement and signed measurement validation remain in place.

Retain server delivery receipts when responses are replaced; they are what make a late acknowledgement safe. Do not copy or expose pending signed payloads in logs.

## Verification

- `npm run test:delivery`: storage/queue identity, lost acknowledgement, concurrency, scoped retries, validation recovery, blocked storage, legacy migration, malformed acknowledgements and retry backoff.
- `tests/survey-delivery.integration.mjs`: requires `PVT_TEST_BASE_URL` and `PVT_TEST_DATABASE_URL`, both loopback. Uses only its owned synthetic survey under the existing PVT fixture.
- `tests/survey-journey.browser.cjs`: run after the API fixture; the same loopback variables plus `PLAYWRIGHT_MODULE` point to the available Playwright installation. `CHROME_PATH` can select a Chrome executable. Tests review, drafts, isolation, actual lost acknowledgement, offline retry, server rejection, themes, mobile layout and storage denial.
- Existing PVT/RHR native integration suites continue to verify measurement receipt validation and the original exports.
