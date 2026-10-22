# Live Ops staff viewing

The admin opens **Live Ops → Share with staff** (also **Staff access** in the sidebar).
Sharing is disabled by default and no staff links or passwords are created automatically.

1. Set a separate staff password (10–72 UTF-8 bytes), enable viewing and save.
2. Create a named link per staff member/role with a 1–90 day expiry.
3. Copy that person's URL and share the password separately.
4. Use recent sessions and the access journal to review access, end a session,
   block/unblock an IP, revoke a link, replace its URL or disconnect everyone.

The password is never returned to the browser after saving. A blank password field
retains the existing hash. Saving access settings advances the permission version
and invalidates all previously issued viewer sessions. Replacing a link ends its
sessions and invalidates its old URL; revoked/expired links require a new link.
Changing the staff password does not change admin or kiosk credentials.

## Shared view

The separate `/staff/live-ops/[token]` page has a password gate on each opening,
even if an existing viewer cookie is present. It has no admin navigation. It
supports daily table/cards, dates, surveys, body maps, measurements, reliability,
weekly reporting, and the existing individual-player analysis with date ranges.
The table uses the granting admin's question mappings/column preferences.

Staff cannot change data/rules/preferences or use the admin APIs. PDF/print,
CSV-link and editing controls are omitted from this view. Data refreshes every
60 seconds while visible; a manual refresh is available. A session identifier,
link label and observed IP form a visible watermark. Reauthentication is required
after expiry, revocation, failed verification or reopening the page.

**Explicit user choice (22 October 2026): existing public CSV/Power BI URLs stay
unchanged and public.** Their access is outside these staff sessions and journal.
A person who knows such an export URL can still retrieve its data without the
staff password. The new view does not display these URLs; hiding controls does
not secure the pre-existing public endpoints. Securing exports requires a
separate migration and one-time replacement of Power BI source URLs.

## Permission boundary

- Viewer credentials are independent from admin/kiosk credentials. A random
  256-bit cookie secret is stored only as a SHA-256 hash; no viewer JWT grants
  admin rights. Cookies are HttpOnly, SameSite=Strict and Secure in production,
  scoped to the API for the specific link.
- Server-derived team scope and a small read-only endpoint allowlist are used;
  no client team/admin ID is trusted and no admin-cookie impersonation is used.
- The same daily/individual/insights/calendar readers serve both views. Staff
  readers skip schema initialization and operational rule/intervention writes.
  They do not mutate wellness, Focus, HR, kiosk or admin settings.
- Every read checks link enablement, expiry, settings version, session expiry/
  revocation, browser user agent, blocked IPs and the granting admin's active
  account/team membership. Data queries are followed by another permission
  check and an audit write before returning their result. Audit failures deny
  data release. In-flight responses already delivered cannot be withdrawn.
- Open pages verify permission every 15 seconds and before revealing data when
  returning to a background tab. Hidden tabs conceal data until verified. A
  failed network check also removes access; browser throttling/network latency
  can delay the next check. Revocation blocks subsequent server reads, but
  cannot erase information someone already saw, downloaded or photographed.
- Same-origin checks protect mutations. Database-backed atomic attempt/read
  limits work across server instances. Stream lengths and credential lengths
  are bounded. Responses use private/no-store, no-referrer, noindex and deny
  framing headers. No cross-origin data access is enabled.

## Journal and device information

Successful/failed password checks, authorised data requests and management
changes record time, staff-link label, session ID, observed IP, user agent,
coarse platform/device/browser and a limited resource description. The journal
never stores staff passwords, session secrets, share URLs or wellness payloads.
Heartbeat verification updates last-seen/IP without filling the view journal.
The admin can paginate events and inspect the latest 100 sessions and links.
The journal covers 90 days; older events/sessions are pruned on management activity.

Vercel deployment proxy headers supply IP addresses. Outside Vercel production,
no arbitrary forwarded header is trusted; an unavailable IP is shown as such.
The iPad desktop-UA hint is explicitly just a client hint. A browser can disguise
its platform; a Mac user agent cannot prove MacBook vs iMac. IPs identify network
connections, may change, and can be shared or masked by VPNs. Blocking an IP can
also block innocent colleagues on that network and cannot follow a person to a
new network. End a session or revoke the link for that case. Sharing a named
link/password does not verify the individual using it. Screenshots, photos,
manual copying and deliberate redistribution cannot be completely prevented.

## Schema and rollout

`prisma/manual-migrations/2026-10-22-live-ops-sharing.sql` adds six isolated tables
and cascading relations to teams. No existing answer/measurement schema changes.
The authenticated management endpoint also runs an idempotent sharing-only
initializer, so the production rollout does not depend on a destructive db push.
Read-only shared data routes do not initialize the database. Opening settings
initializes the new empty tables; it does not enable sharing or set a password.

## Verification

- Unit checks for secure cookies/tokens, proxy metadata, same-origin/resource
  filtering, chunked body limits and real repeatable PostgreSQL-compatible DDL.
- Loopback integration checks for team isolation, readonly domain data, password
  rotation, revoked/expired links/sessions, IP blocking, owner permission changes,
  concurrent rate limiting, logout, failed audit storage and unchanged legacy
  public CSV/Power BI URLs.
- Chrome and WebKit checks for password gate/reopening, daily and individual data,
  weekly/reliability tabs, absent admin/export controls, mobile/tablet widths,
  visible watermark and removal of a live view after admin revocation.
- Existing Ops, PVT, RHR and delivery regressions plus production build/type/lint.

Test scripts require explicit loopback HTTP/database URLs. The optional PGlite
runtime is separate from the app's dependencies; it is never shipped to Vercel.
