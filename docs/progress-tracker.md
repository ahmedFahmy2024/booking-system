# Cinema seat booking progress tracker

Status follows the [build plan](build-plan.md). Update this file when a slice is accepted, its verification changes, or a decision unblocks the next slice.

## Milestones

| ID | Status | Current state |
| --- | --- | --- |
| B0 | Implemented | The generic prototype has a booking form and list, a service catalogue, Hono endpoints, and a Drizzle migration. It saves a service and a requested time. |
| B1 | Complete | The user approved the launch scope, booking rules, operating policies, and [D1–D8 implementation decisions](build-plan.md#approved-implementation-decisions). |
| B2 | Complete | B2.1 defined the [permission matrix](permission-matrix.md), B2.2 added Better Auth staff sign-in, sessions, invitations, and password reset, B2.3 enforced default-deny in the Hono API including the staff booking list, and B2.4 added scoped private guest-link credentials, read-only guest access, staff resend and rate limiting. The prototype list no longer exposes contact details without an access check; the guest-facing page and cancellation remain in B5. |
| B3 | Partial | Arabic localization and RTL are wired into the current web shell, and admins can manage films and seat maps (B3.2) plus create, price and publish showtimes with an overlap-safe snapshot (B3.3). The public Arabic catalogue, showtime list and keyboard-operable seat map (B3.4) are live; the repeatable cinema seed (B3.5) remains. |
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
| Admin cinema screens | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, React Doctor, `git diff --check`, agent-browser screenshots and axe a11y audit | B3.2 passed on 2026-11-23: 65 API tests in 9 files and 19 web tests in 6 files; browser evidence under `.booking-work/evidence/b3-2/`; zero a11y violations on both admin screens. No migration, no live DB, no E2E, no commit. Full detail in the B3.2 section below. |
| Showtime publishing | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm run db:generate`, `npm run db:migrate` and `npx tsx scripts/verify-showtime-overlap.ts` on the isolated `booking_system_test` database | B3.3 passed on 2026-11-23: 86 API tests in 10 files and 32 web tests in 8 files; migrations `0005` and `0006` applied to the isolated unpooled database and the real exclusion constraint verified with overlapping, back-to-back, separate-auditorium, two concurrent, publish-UPDATE and cancelled-release cases; prototype rows unchanged. An independent review found no blocking issues. No production DB, no E2E, no commit. Full detail in the B3.3 section below. |
| Public catalogue and seat map | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:ui`, React Doctor, agent-browser screenshots and axe audit | B3.4 passed on 2026-11-23: 103 API tests in 11 files and 41 web tests in 12 files; 8/8 Chromium UI scenarios (including heading-visible loading, section retry, catalogue route-error retry and warm-cache navigation); zero axe violations on both public screens; 32 files scanned by React Doctor with no issues. No migration, no live DB, no B0 E2E, no commit. Full detail in the B3.4 section below. |

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

## B3.2 — Admin cinema screens (2026-11-23)

Acceptance criteria were written to `.booking-work/handoffs/b3-2-admin-cinema-screens.md` before editing. Each is starting state → request/action → expected result → evidence, with a failure/retry case. No existing verification-map path changed (the map covers only the three B0 booking journeys), so browser evidence is captured under the checkpoint.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | No session / operations / banned admin / unknown role → `GET,POST,PATCH` on `/admin/films` and `/admin/auditoriums` → 401 / 403 / 403 / 403 with no DB call or leaked fields; an active admin succeeds. Retry after signing in as admin → success. | `apps/api/src/features/cinema-admin/index.test.ts` access-control cases (assert `getDb` not called on denial). |
| AC2 | No films → `POST /admin/films` valid title, positive integer duration, synopsis, empty/omitted/null poster → 201 with `posterUrl: null`; `GET` lists it; `PATCH /:id` 200; malformed data → 400 with no INSERT; unknown id → 404. Retry with corrected data → 201. | API suite film cases (including explicit `posterUrl: null` from the web form). |
| AC3 | No auditorium → `POST /admin/auditoriums` with lowercase row labels `a`/`B`, numbered seats, aisle and out-of-service flags → 201; labels normalised to uppercase before write; duplicate seat, non-positive seat number or blank label → 400 with no write. Retry after fixing → 201. | API suite auditorium cases; direct `auditoriumWriteSchema.parse` assertion on uppercase labels; browser POST body observed with `A`/`B`. |
| AC4 | Existing auditorium → `PUT /admin/auditoriums/:id` → name and entire seat list replaced in one `db.batch([update, delete, insert/read])` non-interactive Neon transaction; insert failure rolls the delete back; missing auditorium → 404 before the batch. Retry with a corrected map → 200. | API suite batch-composition, failure and 404 cases; driver source verified (`neon-http` has no interactive transactions but `db.batch` maps to a single HTTP transaction). |
| AC5 | Admin opens `/admin/films` → enter/edit film details → RHF + Zod form, accessible labels and validation, TanStack Query save and list refresh; failed save keeps values and shows an error. | `apps/web/src/pages/cinema-admin/ui/FilmAdmin.test.tsx`; browser screenshot + form/list state. |
| AC6 | Admin opens `/admin/auditoriums` → add rows and seats, toggle aisle-after and out-of-service → grid editor with text-labelled native checkboxes (keyboard-operable, not colour-only), uppercase labels, atomic save and refreshed list; duplicate row/seat blocks save with a visible message. | `apps/web/src/pages/cinema-admin/ui/AuditoriumAdmin.test.tsx`, `model/cinema.test.ts`; browser screenshots, raw saved JSON and axe audit. |
| AC7 | Both locales → open the admin screens in `ar-EG` and `en` → new `cinemaAdmin` namespace registered for both; all text via `useTranslation`; Arabic RTL copy renders. | `messages.ts`, both `locales/<locale>/cinemaAdmin.ts`, browser snapshot in Arabic. |
| AC8 | Complete change → both verify commands, React Doctor, `git diff --check`, browser exercise, risk review → all green, no migration/live DB/E2E/commit; docs ticked; next action B3.3. | Command outcomes below; risk review below; `git status` shows no commit. |

**Changed files:** new `apps/api/src/features/cinema-admin/{index.ts,index.test.ts}`; new `apps/web/src/pages/cinema-admin/{index.ts,model/cinema.ts,model/cinema.test.ts,model/useCinemaAdmin.ts,api/cinema-admin.ts,api/cinema-admin.queries.ts,ui/FilmAdmin.tsx,ui/FilmAdmin.test.tsx,ui/AuditoriumAdmin.tsx,ui/AuditoriumAdmin.test.tsx,ui/SeatMapEditor.tsx,ui/FilmsAdminPage.tsx,ui/AuditoriumsAdminPage.tsx}`; new routes `apps/web/src/app/routes/admin/{films.tsx,auditoriums.tsx}`; new locale files `apps/web/src/app/providers/locale/locales/{ar-EG,en}/cinemaAdmin.ts`; edited `apps/api/src/app.ts`, `apps/web/src/app/providers/locale/messages.ts`, generated `apps/web/src/app/routeTree.gen.ts`, these docs and the checkpoint. No prior B2.3/B2.4/B3.1 content was overwritten (those changes were already committed at `fdbb2f8` in this checkout).

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify
# lint clean; typecheck clean; 65 tests in 9 files passed; tsc build clean
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings (button.tsx, direction.tsx, badge.tsx);
# typecheck clean; 19 tests in 6 files passed; Vite build clean
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# scanned 19 files: "No issues found!"
git diff --check
# exit 0; only the usual LF→CRLF normalization warnings
```

`routeTree.gen.ts` was regenerated by `@tanstack/router-plugin` via `npx vite build` and `npm run verify`; it was never edited by hand. No `db:generate` was run — the existing `films`/`auditoriums`/`seats` tables suffice. `npm run test:e2e` was deliberately not run (known B0 gap, progress tracker lines 25/81).

**Browser evidence:** real browser via `agent-browser` (named session `b32-admin-qa`), real Vite app at `http://127.0.0.1:5173`. Because the new routes are admin-only and no live/production database may be touched, an in-memory API stub served the `/admin/*` contract on port 3000 through the real Vite proxy. Screenshots: `.booking-work/evidence/b3-2/screenshot-1795435970554.png` (films screen), `...5995481.png` (saved film in list), `...6020932.png` (auditorium saved: 20 seats, 1 out of service), `...6077482.png` (auditoriums editor, full page), `...6077848.png` (films screen, full page). Observed: lowercase `a` typed into the row field was saved as `A`; seat 1 had `aisleAfter: true` and `isOutOfService: true` in the raw saved JSON from `GET /admin/auditoriums`; editing reloaded two rows A/B and the toggles; axe a11y audits on both screens returned **0 violations** after one fix (below).

**Risk review (focused self-review, base `fdbb2f8`):** this change affects stored data, a new web/API contract and admin access, so `review-booking-change` was used. No separate reviewer delegation tool was available in this subagent context, so this was a focused self-review rather than an independent one. Three rounds were used. **Two findings were confirmed and fixed:** (1) the web form sends `posterUrl: null` for an empty field, but the API schema only accepted a string or an omitted value, so a valid empty-poster save would have returned 400 — the schema now unions `z.null()` and a regression test covers it; (2) `PUT /auditoriums/:id` with seats on a missing auditorium would have hit an FK violation (500) instead of 404 — an existence check now rejects before the batch, and the test asserts no batch is attempted. A third issue found in the browser was **confirmed and fixed**: the shadcn `destructive` variant on "remove row" failed WCAG contrast (3.98:1); switching that button to `outline` brought both admin screens to 0 axe violations. Confirmed: all six routes carry `requireAdmin`; denial precedes any DB call; validation happens before writes; row-label normalization is enforced both in the form/API payload and at the API boundary; the seat replacement is one `db.batch` transaction so a failed insert rolls back the delete; empty-seat maps keep the same batch shape; no schema, migration, booking, guest-link, auth or existing response contract changed; the FSD slice imports only `shared/`, and no server-only import reached the web. Recovery: a rejected save leaves stored data unchanged; a rolled-back batch preserves the previous seat map; a bad auditorium edit can be re-saved from the editor. **Limitation:** the `db.batch` rollback was verified against the installed driver source and mocked route tests, not against a live Neon transaction; no isolated-DB rehearsal was performed here to avoid changing that database's state.

## B3.3 — Showtime creation, pricing and publishing (2026-11-23)

Acceptance criteria were written to `.booking-work/handoffs/b3-3-showtime-publishing.md` before editing. Each is starting state → request/action → expected result → evidence.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | No session / operations / banned admin / unknown role / active admin → `GET`, `POST`, `POST /:id/publish`, `PATCH /:id/price` on `/admin/showtimes` → 401 / 403 / 403 / 403 / success; denial precedes any DB call and leaks no showtime fields. Retry after admin sign-in succeeds. | `apps/api/src/features/showtimes/index.test.ts` access-control cases asserting status, body and `getDb()` not called. |
| AC2 | A film (120 min) and auditorium exist → `POST /admin/showtimes` with a Cairo wall clock `2026-07-15T19:00` → 201 draft, `startsAt` stored as `16:00Z`, `occupancyEndsAt` `18:15Z`, draft price defaults to 0, snapshot NULL. A spring-forward gap, negative price, bad UUID or unknown film/auditorium → 400/404 with no INSERT; corrected retry → 201. | API creation cases asserting `insert().values()` and error paths; existing `schedule.test.ts` cases. |
| AC3 | An unpriced draft with no snapshot → `POST /:id/publish` with price 0 → 400 with no write; with price 2500 → 200 published with the ordered seat snapshot and occupancy recomputed from the film's current duration. An auditorium with no seats → 409 with no write. | API publishing cases asserting the exact `update().set()` payload and no-write denials. |
| AC4 | Published, cancelled and unknown showtimes → publish or price-change requests → publish from a non-draft → 409; unknown → 404; price change on published → 200; on cancelled → 409. B3.3 owns only `draft → published`; cancellation is B5.4. | API transition cases; the publish `WHERE id AND status = 'draft'` guard returns 409 when a competing publish wins. |
| AC5 | Published showtime `[S, S+D+15)` → an early same-auditorium showtime → 409 `showtime_overlap`; a showtime at the exact end → success; the same interval in another auditorium → success; two concurrent same-auditorium claims → exactly one wins. A publish UPDATE that recomputes an overlapping end is rejected, and a cancelled showtime releases its slot. | Custom migration `0006_showtime_no_overlap.sql`; API case mapping `23P01` (direct, Drizzle-wrapped and nested causes) to 409; isolated-database rehearsal output below. |
| AC6 | Schema without an occupancy end column → add `occupancy_ends_at timestamptz` + check, generate `0005`, add custom `0006` for `btree_gist` and the partial exclusion constraint, generate again → no changes; apply both to the isolated DB → 3 services and 6 bookings preserved. | Generated SQL, journal, rehearsal output below. |
| AC7 | Complete change → both verify commands, `git diff --check`, browser-independent evidence and risk review → all green; no web changes, no E2E, no production DB, no commit; build plan ticked, next action B3.4. | Command outputs and risk review below. |

**Changed files:** new `apps/api/src/features/showtimes/{index.ts,index.test.ts}` and `apps/api/scripts/verify-showtime-overlap.ts`; edited `apps/api/src/db/cinema-schema.ts` and `apps/api/src/app.ts`; generated `apps/api/drizzle/0005_zippy_ultimatum.sql` + snapshot and custom `0006_showtime_no_overlap.sql` + snapshot + journal entries; this checkpoint and both docs. No existing B2/B3.1/B3.2 content was overwritten.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify
# lint clean; typecheck clean; 86 tests in 10 files passed; tsc build clean
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings; typecheck clean;
# 32 tests in 8 files passed; Vite build clean
npm --prefix apps/api run db:generate
# first run: 0005_zippy_ultimatum.sql; second run: "No schema changes, nothing to migrate"
git diff --check
# exit 0; only the usual LF→CRLF normalization warnings
```

No React changes, so React Doctor was not needed. No web source changed. `npm run test:e2e` was deliberately not run (known B0 gap, progress tracker lines 25/82).

### Isolated migration and concurrency rehearsal (exact commands and outcomes)

Run from `apps/api` in PowerShell. The guard printed only the database name and unpooled flag; no credential was printed at any point.

```powershell
Get-Content '.env.test' | ForEach-Object { if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
$u = [Uri]$env:DATABASE_URL_UNPOOLED
if ($u.AbsolutePath.TrimStart('/') -ne 'booking_system_test' -or $u.Host.Contains('-pooler')) { throw 'Refusing: not the isolated unpooled booking_system_test database' }
npx drizzle-kit migrate
npx tsx scripts/verify-showtime-overlap.ts
npx tsx scripts/verify-cinema-schema.ts
```

- Target guard: `booking_system_test`, unpooled `True`. Migrations applied successfully with the driver's informational websocket warning.
- Rehearsal: `btreeGistAvailable true`; baseline `fulfilled`; overlapping `rejected`; back-to-back at the exact occupancy end `fulfilled`; same instant in another auditorium `fulfilled`; two concurrent identical claims `["fulfilled","rejected"]`; overlapping publish UPDATE `rejected`; non-overlapping publish UPDATE `fulfilled`; cancelled showtime releases its slot (`fulfilled`); prototype rows before and after both `services 3, bookings 6`.
- Post-check: `filmCount 0`, `auditoriumCount 0`, `seatCount 0`, `showtimeCount 0`, `showtimeStartsAtType "timestamp with time zone"`, booking reference fingerprint unchanged. Every rehearsal row was removed by the script's `finally` block.

**Risk review (independent reviewer, fresh context, base `e9b5477`):** this change affects stored data and adds a web/API contract, so `review-booking-change` was used with delegation to a separate reviewer. **No blocking issues.** Confirmed: `requireAdmin` precedes every database call and `showtimeView` is a fixed field set; the publish guard `WHERE id AND status = 'draft'` is a correct compare-and-swap; the partial GiST constraint is half-open, per-auditorium and excludes cancelled rows; `23P01` is mapped through the Drizzle/Neon cause chain on both INSERT and UPDATE; generation is idempotent (`drizzle-kit check` clean) and no existing route, response shape, web file or dependency changed.

Nine non-blocking findings were reported. Seven were confirmed and fixed in this task, then the API gate and rehearsal were re-run (86 tests; all rehearsal checks pass): the publish `WHERE` now has an explicit SQL assertion so removing the status guard fails a test; corrected-retry pairs cover a bad wall clock and a zero price; publish is tested with a changed film duration (180 min → 19:15Z end) so a stale reused end fails; the cancelled-release predicate is exercised on the isolated database; denial bodies are asserted per role; the nested-cause error mapping is covered; and the rehearsal now pre-cleans leftover fixtures because auditorium names are unique. Two findings remain as documented follow-ups, not defects: route unit tests mock the database, so end-to-end persistence of column names and the view mapping should be exercised with a real staff session in B8; `PATCH /:id/price` also permits a draft price change, which is harmless because B4 snapshots the accepted price on the booking. Recovery: a rejected payload or conflicting write changes nothing; a wrongly published showtime can be cancelled and republished under B5.4/B3.3 rules; rolling back `0006` drops the constraint and `0005` drops the column, and B3.3 is the first writer so there are no showtime rows to lose.

## B3.4 — Public catalogue, showtime list and seat map (2026-11-23)

Acceptance criteria were written to `.booking-work/handoffs/b3-4-public-catalogue.md` before editing. Each is starting state → action → expected result → evidence, with a failure/retry case.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | Published upcoming showtimes alongside a draft, a cancelled and a past showtime; anonymous `GET /films` → 200 with only films that have published showtimes starting after now, projected fields only, no contact, booking or snapshot data; a failed read is retriable from the route error. | `apps/api/src/features/catalogue/index.test.ts`: grouping/projection case with compiled status + future-instant filter, and a failed-read-then-retry case; `e2e-ui/catalogue-loading.spec.ts` route-error retry case. |
| AC2 | A published showtime with a frozen layout, a draft and an unknown id; `GET /showtimes/:id` and `GET /showtimes/:id/seat-map` → heading fields with a server-computed `bookingClosed`, the auditorium name frozen at publish, and labelled seats with `available = !outOfService`; draft/past/unknown/bad id → the same generic `404 { error: 'showtime_not_found' }`; a missing snapshot → 409. | API Vitest cases for exact-cutoff closure, frozen name and future-instant filters, seat mapping, all generic denials, missing snapshot and no-session reads. |
| AC3 | `ar-EG` visitor opens `/` → Arabic RTL films with Cairo-formatted showtimes and EGP prices from a new `catalogue` namespace registered in both locales; empty state; locale switch works. | `App.test.tsx`, `CataloguePage.test.tsx`, `cinema-format.test.ts`, browser screenshots in `.booking-work/evidence/b3-4/`. |
| AC4 | Published showtime with an aisle, an out-of-service seat and available seats → every seat is a focusable button whose accessible name carries its label and state; heading stays visible while the map loads or fails; section retry works; warm navigation has no fallback. | `SeatMapSection.test.tsx`, `showtime.test.ts`, `e2e-ui/catalogue-loading.spec.ts` (4 Chromium cases), agent-browser snapshot, Tab navigation and axe audit. |
| AC5 | Checkpoint before edits; base `2a4c959` → both verify gates, React Doctor, `git diff --check`, independent risk review → all green; no migration, live DB, B0 E2E, commit or PR; build plan ticked and next action B3.5. | Command outputs and this section. |

**Changed files:** new `apps/api/src/features/catalogue/{index.ts,index.test.ts}` and two mounts in `apps/api/src/app.ts`; new web slices `pages/catalogue/{api,model,ui,index.ts}` and `pages/showtime/{api,model,ui,index.ts}`; routes `app/routes/index.tsx` (replaced the B0 home) and `app/routes/showtimes.$showtimeId.tsx`; `app/ui/{showtime-route.tsx,route-error.tsx}`; `shared/lib/{cinema-format.ts,index.ts,cinema-format.test.ts}`; locale `catalogue` files and `messages.ts`; `App.test.tsx`; generated `routeTree.gen.ts`; `e2e-ui/catalogue-loading.spec.ts`; these docs and the checkpoint. No B2/B3.1–B3.3 content was overwritten.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify
# lint clean; typecheck clean; 103 tests in 11 files passed; build clean (baseline 86 in 10 files)
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings; typecheck clean;
# 41 tests in 12 files passed; Vite build clean (baseline 32 in 8 files)
npm --prefix apps/web run test:ui
# 8/8 Chromium scenarios passed on 127.0.0.1:5187 with a stubbed public API
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# scanned 32 files: "No issues found!"
git diff --check
# exit 0; only the usual LF→CRLF normalization warnings
```

**Browser evidence:** a local stub served the public API on port 3000 through the real Vite proxy so no live database was touched. `agent-browser` captured `.booking-work/evidence/b3-4/catalogue-ar.png` and `showtime-ar.png` at `http://127.0.0.1:5187`. Axe reported **0 violations** on both screens after one fix: the film card's showtime subheading was an `h3` directly under the page's `h1` and was changed to `h2`. The accessibility snapshot exposed `button "المقعد A1 — متاح"` and `button "المقعد A2 — خارج الخدمة"`; pressing Tab from the first seat focused the second, whose label and state were announced. No production or isolated database was used for browser evidence.

**Risk review (independent reviewer, fresh context, base `2a4c959`):** **no blocking issues.** The reviewer verified both verify gates, React Doctor and `git diff --check` itself. Four non-blocking findings were reported. Three were confirmed and fixed in this task, then the gates re-run (103 API tests, 41 web tests, 8/8 Chromium): (1) AC1's route-error retry path had no browser evidence, so a failing-then-succeeding `/api/films` scenario was added; (2) a past published showtime was still readable by direct id, so both showtime reads now require `startsAt > now` and return the same generic 404 otherwise; (3) `auditoriumName` used the live auditorium row, so all three public views now prefer the name frozen in `layoutSnapshot` (D3) with the live name only as a fallback for older rows. The remaining finding is documentation-only: this checkpoint was stale relative to the tracker and has been updated. Recovery: reverting the code removes the two public read routes and restores the prototype home; no stored data, migration, or existing response contract changed, and no booking write was added.

## Next action

Start **B3.5** in the [films, auditoriums and showtimes checklist](build-plan.md#b3--films-auditoriums-and-showtimes): seed an isolated film, auditorium and showtime for repeatable verification. Exercise the staff publish path and the customer browse path from B3.4, including a showtime whose seats are all out of service. Keep the known B0 Playwright gap in view; do not run the old E2E until B4 replaces the booking journey and B5 adds the guest-link page.
