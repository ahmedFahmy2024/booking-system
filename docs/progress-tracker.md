# Cinema seat booking progress tracker

Status follows the [build plan](build-plan.md). Update this file when a slice is accepted, its verification changes, or a decision unblocks the next slice.

## Milestones

| ID | Status | Current state |
| --- | --- | --- |
| B0 | Implemented | The generic prototype has a booking form and list, a service catalogue, Hono endpoints, and a Drizzle migration. It saves a service and a requested time. |
| B1 | Complete | The user approved the launch scope, booking rules, operating policies, and [D1–D8 implementation decisions](build-plan.md#approved-implementation-decisions). |
| B2 | Complete | B2.1 defined the [permission matrix](permission-matrix.md), B2.2 added Better Auth staff sign-in, sessions, invitations, and password reset, B2.3 enforced default-deny in the Hono API including the staff booking list, and B2.4 added scoped private guest-link credentials, read-only guest access, staff resend and rate limiting. The prototype list no longer exposes contact details without an access check; the guest-facing page and cancellation remain in B5. |
| B3 | Partial | Arabic localization and RTL are wired into the current web shell. Film catalogue, auditoriums, seats, published showtimes, and seat-map reads remain. |
| B4 | Planned | Multi-seat booking and confirmation, atomic seat claims, and retry behavior. B0 covers only generic booking persistence. |
| B5 | Planned | Guest booking retrieval, guest and staff cancellation, and admin showtime cancellation. |
| B6 | Planned | Show occupancy and staff booking management, including an activity record. |
| B7 | Planned | Confirmation and change communication through agreed channels. |
| B8 | Planned | End-to-end release verification, deployment, monitoring, and recovery. |

## Evidence

| Area | Evidence | Scope and latest check |
| --- | --- | --- |
| Web | `npm --prefix apps/web run verify` | Passed locally on 2026-11-23, including seven Vitest tests and Arabic locale behavior (three pre-existing advisory fast-refresh lint warnings). |
| API | `npm --prefix apps/api run verify` | Passed locally on 2026-11-23: lint, typecheck, 41 Vitest tests in 7 files, and build. The route suite mocks the database and the auth/session boundary. |
| Booking journey | [Playwright scenario](../apps/web/e2e/booking.spec.ts) | Passed in Chromium on 2026-11-22 using the isolated database. **Still failing after B2.4 (2026-11-23):** the home route prefetches `GET /bookings`, which returns 401 for an anonymous visitor, so the page never renders the form; the scenario also reads the public list directly. B2.4 deliberately did not run Playwright. The known E2E gap must be reworked when B3/B4 replace the home page with the public catalogue and B5 adds the guest-link page. |
| Delivery workflow | [CI](../.github/workflows/ci.yml) and [workflow](WORKFLOW.md) | Web and API checks, advisory React Doctor on PRs, and an on-demand Playwright job using an isolated test database. |
| Access policy | [Permission matrix](permission-matrix.md) | B2.1 definition recorded on 2026-11-22. B2.3 server-side enforcement verified on 2026-11-23 (401/403/200 matrix cases); B2.4 guest-link verification added on 2026-11-23 (valid, invalid, expired, wrong-booking, reference-only, staff resend). |
| Staff authentication | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `auth check schema`, Hono CLI, and `npm --prefix apps/api run auth:verify-flow` on the isolated `booking_system_test` Neon database | B2.2 passed on 2026-11-22: 14 API tests, Web verify, `GET /api/auth/ok` 200, schema check, Hono route list, and the live flow (sign-in, 24-hour invite TTL from the stored token, password reset, role guard, deactivation, sign-out, last-admin trigger, concurrent deactivation). Migrations `0001` and `0002` were applied to the isolated database via `db:migrate` with `DATABASE_URL_UNPOOLED`. An independent review found two blocking issues (banned session escape and last-admin race); both were fixed and re-verified live. |
| Cinema schema | `npm --prefix apps/api run verify`, `npm run db:generate`, `npm run db:migrate` and `npx tsx scripts/verify-cinema-schema.ts` on the isolated `booking_system_test` database | B3.1 passed on 2026-11-23: migration `0004` applied to the isolated unpooled database with 3 services and 6 bookings preserved, four empty cinema tables, NULL `bookings.showtime_id`; repeated generate/migrate idempotent. 50 API tests and 7 web tests pass. Full commands and outcomes in the B3.1 section below. |

## B2.3 — API permission enforcement (2026-11-23)

Acceptance criteria were written to the task checkpoint before editing. Each is stated as starting state → request → expected result → evidence.

| ID | Starting state → request → expected result | Evidence |
| --- | --- | --- |
| AC1 | `GET /bookings` had no session and the DB held customer names/emails → request with no session → 401 `{ error: 'authentication_required' }`, no DB query, no booking fields. | `apps/api/src/features/bookings/index.test.ts`: "refuses a request with no session…"; asserts `getDb().select` was not called and the body contains no `customerName`/`customerEmail`. |
| AC2 | Valid `operations` session → `GET /bookings` → 200 with the unchanged array (`id`, `customerName`, `customerEmail`, `startsAt`, `serviceName`). | Vitest case with exact JSON equality. |
| AC3 | Valid `admin` session → `GET /bookings` → 200 with the same unchanged contract. | Vitest case with exact JSON equality. |
| AC4 | Session exists but `user.banned = true` → `GET /bookings` → 403 `{ error: 'staff_account_inactive' }`, no DB query or booking fields. | Two Vitest cases (banned operations and banned admin). The staff suite's banned-admin case still passes. |
| AC5 | Session carries a role outside the matrix → `GET /bookings` → 403 `{ error: 'forbidden' }`, no DB query, no booking fields (default deny). | Vitest case using role `customer`; `requireStaff` now allowlists `admin`/`operations`. |
| AC6 | No session / operations session → admin-only staff routes → 401 / 403, no staff mutation. | Existing `apps/api/src/features/staff/index.test.ts` cases pass unchanged. |
| AC7 | No session → `GET /services`, `GET /`, valid `POST /bookings` → 200/200/201 as before; guest creation and catalogue stay public until B2.4/B4. | Services and bookings Vitest cases; the create test asserts `getSession` is not called. |
| AC8 | Authorised staff session with DB rows → `GET /bookings` → response shape and status unchanged. | Exact-equality assertions in AC2/AC3; the handler's select projection is unchanged. |

**Changed files:** `apps/api/src/auth/middleware.ts` (default-deny role allowlist in `requireStaff`, banned check preserved), `apps/api/src/features/bookings/index.ts` (`requireStaff` on the list, `AuthEnv` typing), `apps/api/src/features/bookings/index.test.ts` (auth/DB mocks and matrix cases), plus these docs and the local task checkpoint.

**Verification:** `npm --prefix apps/api run verify` passed on 2026-11-23 (lint, typecheck, 19 tests, build); `npm --prefix apps/web run verify` passed on 2026-11-23 (lint with three pre-existing advisory fast-refresh warnings, typecheck, 7 tests, build). No browser E2E, migrations, or live-database access were used for this API-only task.

**Risk review (focused pass):** base `6f75135`; diff limited to two API source files and one API test file; no schema or stored-data writes; no web/API contract change for authorised callers. Confirmed: denial happens before `getDb()`, so no customer fields can leak on 401/403; `requireAdmin` behaviour and the banned-account check are untouched; `requireStaff` now rejects unknown roles rather than granting access; public catalogue and guest creation remain open per the matrix; denial is stateless and retryable after signing in with an active allowed role. Recovery from an unintended denial is a code revert (no data or migration to roll back). **Limitation:** no separate reviewer delegation tool was available in this session, so this was a focused self-review rather than an independent one.

**Noted consequence (not a B2.3 failure):** the prototype home page prefetches `GET /bookings` for every visitor. That request now returns 401 because the matrix denies the public visitor the staff list. Running `npm --prefix apps/web run test:e2e` on 2026-11-23 confirmed the old B0 scenario fails at page load (`authentication_required` in the route loader); its later direct `GET /api/bookings` assertion would also be denied. The browser-visible empty/error state and the E2E journey must be reworked when B3/B4 replace the home page with the public catalogue and B2.4 introduces guest-link retrieval. `POST /bookings` still returns the prototype's customer fields to an unauthenticated creator, which is allowed for guest checkout until B2.4/B4 change that contract.

## B2.4 — Private guest booking links (2026-11-23)

Acceptance criteria were written to the local checkpoint `.booking-work/handoffs/b2-4-guest-links.md` before editing. Each is starting state → request → expected result → evidence.

| ID | Starting state → request → expected result | Evidence |
| --- | --- | --- |
| AC1 | New booking created → `POST /bookings` → 201 with opaque `reference`; only an HMAC verifier, AES-256-GCM ciphertext and `startsAt + 7 days` expiry are stored; the credential is emailed to `customerEmail` and never appears in the response or logs. | `apps/api/src/features/bookings/index.test.ts` creation case; captured mail and console spies. |
| AC2 | Valid unexpired credential → `GET /guest/bookings/:reference?token=…` → 200 read-only detail with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, no credential/verifier in body or headers. | `apps/api/src/features/guest/index.test.ts` valid-detail case; exact body and header assertions. |
| AC3 | Invalid token → guest detail → the same generic 404 `{ error: 'guest_link_invalid' }` as every other denial, no booking fields. | Guest suite invalid-token case. |
| AC4 | One second after `startsAt + 7 days` → guest detail → generic 404; at the exact expiry instant → 200. | Guest suite expired and exact-boundary cases with a controlled clock. |
| AC5 | Credential for booking A with booking B's reference → guest detail → generic 404, no fields from either booking. | Guest suite cross-booking case. |
| AC6 | Valid reference, no token → guest detail → generic 404 with no database read. | Guest suite reference-only case asserting no `select` call. |
| AC7 | Resend with no session / operations / admin / banned session → 401 / 200 / 200 / 403; a 200 re-emails the same credential without a DB write or expiry change; an expired link returns 409 with no email; a backfilled row gets a first link. | Bookings suite resend cases using `requireStaff` and captured mail. |
| AC8 | Schema change generated with `npm --prefix apps/api run db:generate` → migration `0003_narrow_wallow.sql` adds the four columns; existing rows get a unique reference from the column default and no active link until an email is sent; no live database touched. | Generated migration plus its snapshot; paper rehearsal in the checkpoint. |
| AC9 | Repeated checkout/guest requests from one address beyond the window → generic 429 before DB work; single-process limiter documented as acceptable for the one Node service, durability deferred. | Rate-limit cases in both suites; rate-limit note in the checkpoint. |
| AC10 | Any guest response and handler execution → no-store/no-referrer headers on success and denial, no token in response headers or console output. | Header and console-spy assertions in the guest and bookings suites. |
| AC11 | B2.3 state → guest-resource and regression requests → `GET /bookings` still 401/403/200 through `requireStaff`, staff routes and public catalogue unchanged. | Existing B2.3 cases pass unchanged in both suites. |
| AC12 | Complete change → both verify commands, `git diff --check` and a focused risk review → all green, B2.4 ticked, E2E gap and next action recorded; no Playwright, live DB, commit or PR. | Command outputs below and this section. |

**Changed files:** `apps/api/src/db/schema.ts` and generated `drizzle/0003_narrow_wallow.sql` + snapshot; `apps/api/src/features/guest/{index.ts,credentials.ts,index.test.ts,credentials.test.ts}`; `apps/api/src/features/bookings/index.ts` and its test; `apps/api/src/features/mail/index.ts`; `apps/api/src/app.ts`; `apps/api/src/rate-limit.ts`; the checkpoint and these docs. B2.3's uncommitted edits were preserved unchanged.

**Verification:** `npm --prefix apps/api run verify` passed on 2026-11-23 (lint, typecheck, 41 tests in 7 files, build); `npm --prefix apps/web run verify` passed on 2026-11-23 (three pre-existing advisory fast-refresh lint warnings, typecheck, 7 tests, build); `git diff --check` clean. No Playwright, no migration applied, no live-database access, no commit or PR.

**Risk review (focused pass, base `6f75135`):** schema, stored credentials and the web/API contract are affected, so the review used `review-booking-change`. One concrete bug was found and fixed: generated references are base64url and can contain `-`/`_`, but the guest path regex only allowed alphanumerics, which would have denied valid links; the regex now accepts base64url and a regression test covers it. Confirmed: denial is uniform for invalid/expired/wrong-booking/reference-only; reference-only is rejected before any DB read; `GET /bookings` and `requireStaff`/`requireAdmin` are untouched; no cancellation route exists in B2.4; the verifier/ciphertext/credential are excluded from responses and logs; the resend never writes a new expiry; the migration backfills existing rows and leaves their link columns NULL. Recovery: rolling back application code leaves safe NULL columns and the backfilled reference; a key or migration rollback requires reissuing links. **Limitation:** no separate reviewer delegation tool was available, so this was a focused self-review rather than an independent one.

**Unresolved findings / release concerns:** `GUEST_LINK_KEY` rotation invalidates stored verifiers and ciphertext, so existing links must be reissued (manual recovery: clear a booking's three guest-link columns and let staff resend); the in-memory limiter is per-process and can be bypassed by a spoofed `x-forwarded-for` when not behind the trusted Render proxy, so durable centralised limiting is a release concern; the credential is carried in the guest URL query string, so B5's web page must keep it out of history, logs and referrers and set the same no-store/no-referrer headers; migration rehearsal on an isolated database is deferred to B3/B8 as required here.

**Known E2E gap (unchanged by B2.4):** the B0 Playwright scenario still fails at page load because the prototype home prefetches the now-protected `GET /bookings`. It must be reworked when B3/B4 replace the home page and B5 adds the guest-link page.

## B3.1 — Cinema schema and isolated rehearsal (2026-11-23)

Acceptance criteria were written to `.booking-work/handoffs/b3-1-cinema-schema.md` before editing. Each is starting state → action → expected result → evidence.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | No film table → add `films` with title, integer duration, synopsis, optional poster URL and `timestamptz` timestamps → migration creates it; no `pgEnum`; a second `db:generate` finds no change. | `apps/api/src/db/cinema-schema.ts`, `drizzle/0004_free_paibok.sql`; repeated `db:generate` output below. |
| AC2 | No auditorium/seat tables → add `auditoriums` and `seats` with row label, seat number, aisle gap and out-of-service flag → UUID PKs, `seats.auditorium_id` FK, unique `(auditorium_id, row_label, seat_number)` index; duplicate labels are rejected by the index. | Generated SQL lines 1–29 and 45–50; schema file. |
| AC3 | No showtime table → add `showtimes` with film/auditorium FKs, Cairo-scheduled `starts_at timestamptz`, piastre price, text status with TS union, typed JSONB layout snapshot → migration creates it with film/starts-at and auditorium/starts-at indexes; drafts may have no snapshot. | Generated SQL lines 31–42, 46–47, 51–53; `AuditoriumLayoutSnapshot` interface. |
| AC4 | Cairo wall clock and film duration known → call pure helpers → winter resolves at UTC+2, summer at UTC+3, occupancy = duration + 15 min, next showtime allowed at the exact end instant, 1 ms/minute earlier overlaps. | `apps/api/src/features/showtimes/schedule.ts` + `schedule.test.ts`; 9 Vitest cases. No route, DB enforcement or price validation in this task. |
| AC5 | `bookings` has prototype rows and B2.4 columns → add NULLABLE `showtime_id uuid` FK + index and relations → existing rows stay valid, all 6 remain NULL, creation behaviour unchanged, showtime delete is blocked while referenced. | Generated SQL lines 44 and 54–55; rehearsal post-check; existing booking tests unchanged. |
| AC6 | Schema edited → `npm --prefix apps/api run db:generate` → `0004_free_paibok.sql` + `meta/0004_snapshot.json` + journal entry generated; only new tables, the nullable column and supporting constraints; all instants `timestamptz`; no `NOT NULL` added to existing columns. | Generated files and diff. |
| AC7 | Isolated `booking_system_test` with prototype rows → load `.env.test` into the process without printing values and migrate with `DATABASE_URL_UNPOOLED` → four new tables and NULL `showtime_id` exist; prototype counts unchanged; new tables empty. Failure/guard: refuse to migrate if the URL is not the isolated unpooled target. | Rehearsal commands and outputs below. |
| AC8 | Implementation and rehearsal complete → both verify commands, `git diff --check`, focused risk review → all green, one documentation finding fixed, B3.1 ticked, next action B3.2; no Playwright, no other DB, no commit or PR. | Verification outputs and risk review below. |

**Changed files:** new `apps/api/src/db/cinema-schema.ts`, `apps/api/src/features/showtimes/{schedule.ts,schedule.test.ts}`, `apps/api/scripts/verify-cinema-schema.ts`, `apps/api/drizzle/0004_free_paibok.sql`, `apps/api/drizzle/meta/0004_snapshot.json`; edited `apps/api/src/db/schema.ts`, `apps/api/drizzle/meta/_journal.json`, the checkpoint and these docs. All pre-existing B2.3/B2.4 uncommitted changes were preserved untouched.

### Isolated migration rehearsal (exact commands and outcomes)

Run from `apps/api` in PowerShell. No value from `.env.test` was printed at any point; only the parsed database name and the unpooled flag were reported.

```powershell
Get-Content '.env.test' | ForEach-Object { if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
$u = [Uri]$env:DATABASE_URL_UNPOOLED
# printed only: "Rehearsal target database: booking_system_test; unpooled: True"
if ($u.AbsolutePath.TrimStart('/') -ne 'booking_system_test' -or $u.Host.Contains('-pooler')) { throw 'Refusing to migrate: unpooled URL is not the isolated booking_system_test database' }
npx tsx scripts/verify-cinema-schema.ts    # baseline
npm run db:migrate
npx tsx scripts/verify-cinema-schema.ts    # post-check
npm run db:generate                        # retry/idempotency for generation
npm run db:migrate                         # retry/idempotency for migration
npx tsx scripts/verify-cinema-schema.ts    # final check
```

- Target guard output: `Rehearsal target database: booking_system_test; unpooled: True`. No credential printed.
- Baseline: `{"serviceCount":3,"bookingCount":6,"bookingReferenceFingerprint":null,"linkedBookingCount":null,"cinemaTables":[],"bookingColumns":[]}`. The isolated database had NOT yet applied B2.4's `0003`, so `bookings.reference` did not exist at baseline; that migration was applied together with `0004` in this rehearsal. The baseline reference comparison in AC7 is therefore evidenced by the B2.4 backfill plus post-migration stability, not by a pre-existing reference value.
- `npm run db:migrate` (first run): `Using '@neondatabase/serverless' driver for database querying` → `migrations applied successfully!` (the driver's websocket advisory warning was informational).
- Post-migration: `serviceCount 3`, `bookingCount 6` unchanged; `bookingReferenceFingerprint 07e8871688388623909a1efe4f0c89e6`, `reference` `isNullable NO`; `showtime_id` `dataType uuid`, `isNullable YES`, `linkedBookingCount 0`; `cinemaTables ["auditoriums","films","seats","showtimes"]`; `cinemaData` all four counts `0` and `showtimeStartsAtType "timestamp with time zone"`.
- Retry: second `npm run db:generate` → `No schema changes, nothing to migrate 😴`; second `npm run db:migrate` → `migrations applied successfully!` with the final check identical to the post-migration output. No duplicate or extra migration was created.
- How prototype rows are handled: all 3 services and 6 bookings are untouched; `showtime_id` is NULL on every existing booking; the B2.4 reference column is backfilled by `0003` with a unique value; the new cinema tables start empty; no existing column was made NOT NULL or retyped.

**Verification:** `npm --prefix apps/api run verify` passed on 2026-11-23 (lint, typecheck, 50 tests in 8 files, build); `npm --prefix apps/web run verify` passed (three pre-existing advisory fast-refresh warnings, typecheck, 7 tests, build); `git diff --check` exit 0 with only the usual LF→CRLF normalization warnings. No Playwright (known B0 E2E gap), no other database, no commit or PR.

**Risk review (focused pass, base `6f75135`):** this is a schema change, so `review-booking-change` was used. No separate reviewer delegation tool was available in this subagent context, so this was a focused self-review of the diff against the criteria. One finding was **confirmed and fixed**: the Cairo helper's JSDoc said ambiguous fall-back times choose the earlier instant, but the two-pass algorithm resolves 2026-10-29 23:00 Cairo to the *later* UTC instant (`2026-10-29T21:00Z`); the comment was corrected and a regression test added, then API verify re-run (50 tests pass). Confirmed: all new tables are empty so their NOT NULL columns need no backfill; `bookings.showtime_id` is nullable with an index and a no-action FK; no booking route, auth guard, guest-link behavior, or existing response contract changed; the migration uses `timestamptz` for every new instant and `jsonb` with a concrete TS interface for the snapshot; generation is idempotent. Recovery: reverting application code leaves empty tables and a NULL booking column, so prototype rows and B2.4 links keep working; rolling back the migration would drop the new tables/column and is not done here.

**Unresolved findings / deferred to later tasks (not B3.1 failures):**
- `showtimes.status`, `pricePiastres` and `layoutSnapshot` are permissive at the storage boundary: B3.3 must validate a published showtime has a positive price and a snapshot, and must restrict status transitions. B3.1 deliberately adds no publish route or price validation.
- Overlap enforcement, including simultaneous publish attempts, is still pure-calculation only; B3.3 must enforce the half-open interval in Postgres.
- Guest-link expiry still uses `bookings.startsAt` as the surrogate; B4 must derive it from `showtime.starts_at` when it populates `showtime_id`.
- Seat labels are case-sensitive in the `(auditorium_id, row_label, seat_number)` unique index; the B3.2 editor should normalise row labels.

## Next action

Start **B3.2** in the [films, auditoriums and showtimes checklist](build-plan.md#b3--films-auditoriums-and-showtimes): build the admin screens for film details and numbered seat rows, aisle gaps and out-of-service seats. Reuse `apps/api/src/db/cinema-schema.ts` and the pure Cairo/occupancy helpers; add any new migration if the editor needs extra columns. Keep the known B0 Playwright gap in view; do not run the old E2E until B3/B4 replace the home page.
