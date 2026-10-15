# Local verification — 15 October 2026

Implementation branch: codex/handheld-pvt, based on GitHub main 11a0c7b. The original checkout's uncommitted work was left unchanged. No remote push, Vercel deployment, production database access or production migration was performed.

Passed:
- 16 deterministic automated tests (all three durations, random wait bounds, false starts, unseen-stimulus prevention, timeouts, interruptions, incomplete final stimulus, server record validation, personal references, timezone/schedule, reverse-proxy origin handling, additive migration and non-mutating Vercel build).
- 29 API integration assertions against a fresh isolated in-memory PostgreSQL-compatible fixture. Includes authentication, team scoping, all supported coach durations, rejected unsupported duration, same-day protocol lock, simultaneous start/config update consistency, origin checks, result token, server-side score calculation, idempotency, practice/interruption retention, persistent rate limiting, and existing wellness submission preserving test history.
- TypeScript no-emit check and targeted ESLint checks for the new module and integration fixture.
- Optimized Next.js production build.
- Chromium mobile viewport: complete real-time 60-second run saved 21 responses and received quality OK; its median RT was 285 ms. These are browser automation results, not athlete data or physical timing validation.
- Browser demo controls for 60/90/180 seconds and cancellation; authenticated coach table and downloaded CSV; no browser exceptions.
- Existing mobile wellness form submission redirected the identified synthetic player to the optional PVT screen.
- A separate server with PVT_ENABLED=false and an intentionally unavailable database returned enabled:false from the optional PVT endpoint without requiring any new tables.
- Visual inspection of the mobile preparation/run screens and desktop coach dashboard.

Limits before production:
- Test database is PGlite via a loopback socket, not the hosted production PostgreSQL service.
- Actual iPhone/Android timing, OS interruption behaviour, handheld posture repeatability, supported browser/device list, and comparison to a reference PVT instrument remain unvalidated.
- Vercel production/preview branch and database environment scoping remain unconfirmed. Production migration and activation are intentionally not performed.
- Player identity uses the existing access-code system. The legacy kiosk exposes code material in its public payload; the new server check is not identity-proof and does not repair that existing design.
