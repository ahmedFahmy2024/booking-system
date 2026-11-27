# Cinema seat booking progress tracker

Status follows the [build plan](build-plan.md). Update this file when a slice is accepted, its verification changes, or a decision unblocks the next slice.

## Milestones

| ID | Status | Current state |
| --- | --- | --- |
| B0 | Implemented | The generic prototype has a booking form and list, a service catalogue, Hono endpoints, and a Drizzle migration. It saves a service and a requested time. |
| B1 | Complete | The user approved the launch scope, booking rules, operating policies, and [D1–D8 implementation decisions](build-plan.md#approved-implementation-decisions). |
| B2 | Complete | B2.1 defined the [permission matrix](permission-matrix.md), B2.2 added Better Auth staff sign-in, sessions, invitations, and password reset, B2.3 enforced default-deny in the Hono API including the staff booking list, and B2.4 added scoped private guest-link credentials, read-only guest access, staff resend and rate limiting. The prototype list no longer exposes contact details without an access check; the guest-facing page and cancellation remain in B5. |
| B3 | Complete | Arabic localization and RTL are wired into the current web shell, and admins can manage films and seat maps (B3.2) plus create, price and publish showtimes with an overlap-safe snapshot (B3.3). The public Arabic catalogue, showtime list and keyboard-operable seat map (B3.4) are live; B3.5 added a repeatable isolated seed and exercised the publish and browse paths against it, including a showtime with no available seats. |
| B4 | Complete | B4.1 added seat selection, the EGP unit price and total, guest email collection, the six-seat limit and the shared checkout request schema. B4.2 added the confirmation write, atomic seat claims and server-side validation. B4.3 added detailed seat/price conflicts, seat-map refresh, pruned selections, explicit revised-price acceptance and localized error codes. B4.4 persisted the accepted quoted price and reference and added a confirmation screen with the film, showtime, auditorium, frozen seat labels, reference, total and venue payment instructions. B4.5 added a stable confirmation key, exact outcome replay and a payload-mismatch conflict. B4.6 verified the real browser journey and the claim/idempotency invariants against the isolated database. |
| B5 | In progress | B5.1 added the read-only guest booking-details page behind the private link and verified that a reference alone reveals no contact details. B5.2 added guest cancellation with an atomic seat release, the two-hour closing instant and an idempotent repeat. B5.3–B5.5 (staff/showtime cancellation and the cancellation race) remain. |
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
| Public catalogue and seat map | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:ui`, React Doctor, agent-browser screenshots and axe audit | B3.4 passed on 2026-11-23: 103 API tests in 11 files and 41 web tests in 12 files; 11/11 Chromium UI scenarios (heading-visible loading, section retry, catalogue route-error retry, warm-cache navigation, and three named poster-transition cases); zero axe violations on both public screens; React Doctor clean. No migration, no live DB, no B0 E2E. Full detail in the B3.4 and poster-transition sections below. |
| Isolated cinema seed and path exercise | `npm --prefix apps/api run db:seed:cinema`, `npm --prefix apps/api run verify:cinema-paths`, both verify commands, `git diff --check`, agent-browser screenshots and axe audit | B3.5 passed on 2026-11-23: repeatable isolated fixture (1 film, 2 auditoriums, 10 seats, 2 drafts); 401/403 publish denials left drafts unchanged; both showtimes published through the real admin route; public reads correct on the mixed and all-out-of-service screens; 103 API and 41 web tests pass; 0 axe violations on three browser pages. Prototype rows unchanged. No migration, no production DB, no B0 E2E, no commit. Full detail below. |
| Seat selection and checkout schema | `npm --prefix apps/web run verify`, `npm --prefix apps/api run verify`, `npm --prefix apps/web run test:ui`, React Doctor, `git diff --check`, agent-browser screenshots and axe audit | B4.1 passed on 2026-11-23: 57 web tests in 14 files and 103 API tests in 11 files pass; 17/17 Chromium UI scenarios (four new seat-selection cases); axe 0 violations on the Arabic showtime screen. The shared checkout schema enforces 1–6 unique seats, a UUID showtime and a guest email. No booking write, migration, live database, B0 E2E or commit. Full detail in the B4.1 section below. |
| Atomic seat claims at confirmation | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:ui`, React Doctor, `git diff --check`, independent risk review | B4.2 passed on 2026-11-24: 118 API tests in 12 files and 58 web tests in 14 files pass; 18/18 Chromium UI scenarios including confirmation and conflict retry; React Doctor clean. One `db.batch` transaction writes the booking and all claims, arbitrated by a Postgres unique `(showtime_id, seat_id)` index; migration `0007_careful_the_enforcers.sql` generated. No live database, no B0 E2E, no commit. Full detail in the B4.2 section below. |
| Availability refresh and revised total | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:ui`, React Doctor, `git diff --check`, independent risk review | B4.3 passed on 2026-11-24: 121 API tests in 12 files and 75 web tests in 15 files pass; 19/19 Chromium UI scenarios including seat pruning and explicit revised-price acceptance; React Doctor clean. Conflicts return the current unit price and the still-available subset; the web invalidates both reads, prunes taken seats, maps codes to localized messages and clears a confirmed selection. No schema change, migration applied, live database, B0 E2E or commit. Full detail in the B4.3 section below. |
| Confirmation screen | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:ui`, React Doctor, agent-browser screenshots and axe audit, `git diff --check`, independent risk review | B4.4 passed on 2026-11-25: 123 API tests in 12 files and 79 web tests in 16 files pass; 20/20 Chromium UI scenarios including the Arabic RTL confirmation screen; axe 0 violations; React Doctor clean. The confirm write returns the frozen film, auditorium and seat labels with the persisted reference and accepted price, and the web shows them with venue payment instructions. No schema change, migration, live database, B0 E2E or commit. Full detail in the B4.4 section below. |
| Confirmation idempotency | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:ui`, React Doctor, `git diff --check`, independent risk review | B4.5 passed on 2026-11-25: 130 API tests in 12 files and 86 web tests in 17 files pass; 22/22 Chromium scenarios including stable-key and reload-replay cases; React Doctor clean. A UUID key in a header, a SHA-256 canonical-payload fingerprint and the original response are stored with the booking in one batch; replay is byte-identical, skips writes and email, and key reuse with another payload conflicts. The key survives a page reload in tab storage and malformed keys do not consume the checkout budget. Migration `0008_clear_puff_adder.sql` generated but not applied; no live database, old B0 E2E or commit. Full detail in the B4.5 section below. |
| Live booking verification | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:e2e`, `npm --prefix apps/api run verify:booking-live`, React Doctor, `git diff --check`, independent risk review | B4.6 passed on 2026-11-27: 132 API tests in 12 files and 86 web tests in 17 files; Playwright 1/1 against the real Hono API and isolated Neon; all live claim/idempotency/cutoff/price checks pass. The isolated database was migrated through `0008`. Full detail in the B4.6 section below. |
| Guest booking details | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `npm --prefix apps/web run test:ui`, `npm --prefix apps/web run test:e2e`, `npm --prefix apps/api run verify:booking-live`, React Doctor, `git diff --check`, independent risk review | B5.1 passed on 2026-11-27: 135 API tests in 12 files and 92 web tests in 19 files; 27/27 Chromium UI scenarios and 1/1 real Playwright journey; live guest detail 200 with no reflected token and reference-only 404. No migration, schema change, production database or commit. Full detail in the B5.1 section below. |
| Guest cancellation | same gates plus migration `0009` applied to the isolated database | B5.2 passed on 2026-11-27: 143 API tests in 12 files and 97 web tests in 19 files; 31/31 Chromium UI scenarios and 1/1 real Playwright journey; live cancellation 200, status cancelled, zero remaining claims, seat available again, identical repeated body, cutoff 409, reference-only 404; prototype rows unchanged. Full detail in the B5.2 section below. |

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

## Poster view transition and animation evidence (2026-11-23 follow-up)

Two follow-ups to B3.4 were completed after the B3.4 checkpoint:

1. **Suspense animation evidence.** `e2e-ui/catalogue-loading.spec.ts` now patches `document.startViewTransition` the same way as the admin specs and asserts that both `suspense-fade-out` and `suspense-fade-in` marks are recorded when the seat map resolves. This closes the evidence gap between the public seat map and the existing `AsyncSection` / `AnimatedSuspense` pattern.
2. **Named poster shared-element transition.** The deferred frontend-technique row in `build-plan.md` is now implemented and verified. Verification against the installed TanStack Router source (`Transitioner.tsx:31-37`, `load-client.ts:1903`) showed that route commits go through an external store, so React's own `<ViewTransition>` does **not** activate on navigation (no `startViewTransition` call was observed). The implementation therefore uses TanStack Router's native `viewTransition` prop on the catalogue and back Links together with a film-scoped `view-transition-name` on the poster (`shared/ui/poster-transition.tsx`), plus a 320 ms morph and reduced-motion opt-out in `shared/ui/poster-transition.css`. React `<ViewTransition>` remains the mechanism for Suspense reveals. `GET /showtimes/:id` now also returns `filmId` so the two posters share one name.

**Verification (from the repository root):**

```powershell
npm --prefix apps/api run verify                 # 103 tests in 11 files, lint/typecheck/build clean
npm --prefix apps/web run verify                 # 41 tests in 12 files, lint/typecheck/build clean
npm --prefix apps/web run test:ui                # 11/11 Chromium scenarios passed
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# 7 files scanned: "No issues found!"
git diff --check                                 # exit 0 (LF→CRLF warnings only)
```

`e2e-ui/poster-transition.spec.ts` asserts: the `poster-film-1` group/old/new pseudo-elements animate on forward navigation and on the back Link; `dir="rtl"` is preserved; keyboard focus is not stranded on the removed link (Tab reaches the back link); reduced motion yields zero-duration animations; and a browser with `startViewTransition` removed renders both screens instantly. No new dependency, schema change, migration, live database or B0 E2E was used.

## B3.5 — Isolated cinema seed and path exercise (2026-11-23)

Acceptance criteria were written to `.booking-work/handoffs/b3-5-isolated-cinema-seed.md` before editing. Each is starting state → action → expected result → evidence.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | Script invoked with a pooled URL or a non-isolated database name → throw before any SQL, print only the database name and pooled flag. | Guard rehearsal in `.booking-work/evidence/b3-5/execution-log.md`: both attempts exited 1 with the refusal message. |
| AC2 | Isolated DB with 3 services, 6 bookings and no cinema rows; seed twice → exactly 1 film, 2 auditoriums, 10 seats, 2 draft showtimes with NULL snapshots; prototype rows unchanged. | Both `db:seed:cinema` runs returned the same fixture summary; `verify-cinema-schema.ts` was not needed because the counts are asserted inside the script. |
| AC3 | Two drafts and a dedicated test admin → real `POST /admin/showtimes/:id/publish` → 200 for both with price 2500 and frozen snapshots; anonymous/operations → 401/403 and drafts unchanged; admin retry succeeds. | `verify-cinema-paths.ts` asserts status, snapshot, `getDb` state and prototype counts. |
| AC4 | Two published showtimes → anonymous `GET /films`, `GET /showtimes/:id`, `GET /showtimes/:id/seat-map` → both showtimes listed with frozen auditorium names; mixed screen 5 available / A2 unavailable; sold-out screen 0 available; draft and unknown ids return the same generic 404. | Assertions and JSON summary from `verify-cinema-paths.ts`. |
| AC5 | Seeded rows served by the real API → Arabic browser opens the catalogue and both showtime pages → `dir="rtl"`, two `عرض المقاعد` links, labelled seat buttons, sold-out status message; screenshots and axe audit. | `.booking-work/evidence/b3-5/catalogue-ar.png`, `showtime-mixed-ar.png`, `showtime-sold-out-ar.png` and three `*-a11y.json` files with `violations: 0`. |
| AC6 | Complete change → both verify commands, `git diff --check`, risk review → all green; no migration, production DB, B0 E2E or commit; B3.5 ticked and next action recorded. | Command outputs and risk review below. |

**Changed files:** new `apps/api/scripts/seed-cinema.ts` and `apps/api/scripts/verify-cinema-paths.ts`; two script entries in `apps/api/package.json`; new checkpoint `.booking-work/handoffs/b3-5-isolated-cinema-seed.md` and evidence folder `.booking-work/evidence/b3-5/`; this tracker and the build plan. No web source, schema, migration or existing route changed.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run db:seed:cinema        # twice: identical fixture, prototype rows 3/6
npm --prefix apps/api run verify:cinema-paths   # after a seed reset
npm --prefix apps/api run verify                # lint; typecheck; 103 tests in 11 files; build
npm --prefix apps/web run verify                # three pre-existing advisory fast-refresh warnings;
                                                # typecheck; 41 tests in 12 files; build
git diff --check                                # exit 0 (LF→CRLF warnings only)
```

React Doctor was not run because no web source changed. `npm run test:e2e` was deliberately not run (known B0 gap). The rehearsal left the fixture published in the isolated database for repeatable browsing; re-running `db:seed:cinema` resets it to drafts.

**Risk review (independent reviewer, fresh context, base `c2243f7`):** **no blocking code issue.** The reviewer confirmed the isolation guards validate the exact connection strings the scripts use, the fixed-ID delete/insert is idempotent (seat rows cascade), the rehearsal drives the real Hono routes against the isolated database, denials precede writes, and no schema, migration, production database, web/API source or B0 E2E is involved. One blocking documentation gap was reported — the milestone table and next action still described B3.5 as unstarted; both have been corrected and this section added. Non-blocking outcomes: the rehearsal requires a fresh `db:seed:cinema` before each run and a seed after a mid-run failure (now stated in the script header, evidence log and above); the synthetic test staff accounts use an isolated-only password and are re-enabled by the rehearsal because `verify-auth-flow` bans them (documented in the script header); prototype-row preservation is asserted as before/after equality rather than fixed 3/6 values so later booking tasks are not falsely failed; the fixture dates are fixed in 2030 and need re-seeding after then; and the guard's exact database-name and `-pooler` heuristics are intentionally strict for this isolated setup. The rehearsal guard was re-run with a wrong database name and exited 1 before any route call. Recovery: re-run `db:seed:cinema` to reset drafts and prototype rows are untouched.

## B4.1 — Seat selection and checkout request (2026-11-23)

Acceptance criteria were written to `.booking-work/handoffs/b4-1-seat-selection.md` before editing. Each is starting state → action → expected result → evidence.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | No checkout contract exists → add `checkoutRequestSchema` and `MAX_BOOKING_SEATS = 6` to `packages/cinema-contracts` and derive the web form schema from it → a UUID showtime id, 1–6 unique UUID seat ids and a guest email parse; empty, seventh, duplicate, malformed UUID and bad email payloads fail; a corrected payload parses. Both apps install the refreshed `file:` package with `npm ci`. | `apps/web/src/pages/showtime/model/checkout.test.ts`; both verify gates pass. |
| AC2 | Informational seat buttons → click or press Enter on an available seat → `aria-pressed` toggles, the seat enters the form's `seatIds`, the accessible name still states label and availability, and deselecting works; unavailable seats cannot be toggled. | `SeatMapSection.test.tsx`; `e2e-ui/seat-selection.spec.ts` keyboard case; agent-browser snapshot. |
| AC3 | Fewer than six seats selected → select a seventh → the selection and total stay at six and a visible status states the limit; removing a seat clears it. The shared schema rejects seven seats too. | Component test and `seat-limit-ar.png`; `checkout.test.ts` limit case. |
| AC4 | The showtime detail carries integer piastres → select or deselect seats → the EGP unit price and a live total of N × price render in Arabic RTL through the shared `formatEgp` helper. | `CheckoutForm.test.tsx`, `seat-selection-ar.png`, Chromium cases. |
| AC5 | Empty or invalid email → submit → localized field error, no ready-selection status, and the seats and typed value remain; correcting the email and resubmitting shows a status with count, total and email while the labels stay on the map. | `CheckoutForm.test.tsx` failure-then-retry case; Chromium retry case. |
| AC6 | New checkout copy is needed in both locales → add `catalogue` keys to `ar-EG` and `en` → all text comes from `useTranslation`; RTL, labelled seats, focus order and selection state are preserved with zero axe violations. | Locale files, component/browser tests, `.booking-work/evidence/b4-1/seat-selection-a11y.json`. |
| AC7 | Base `409246b` → both verify commands, `test:ui`, React Doctor, `git diff --check` and an independent risk review → all green; no booking write, migration, live DB, old B0 E2E or commit; build plan and tracker updated. | Command outputs below and review outcome. |

**Changed files:** `packages/cinema-contracts/index.js`; new `apps/web/src/pages/showtime/model/{checkout.ts,checkout.test.ts}`, `ui/{CheckoutForm.tsx,CheckoutForm.test.tsx}`, `apps/web/e2e-ui/seat-selection.spec.ts`; edited `apps/web/src/pages/showtime/ui/{SeatMapSection.tsx,SeatMapSection.test.tsx,ShowtimePage.tsx}`, both `app/providers/locale/locales/*/catalogue.ts`, these docs and the checkpoint. No API source, schema, migration or existing route changed.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm ci                                      # separately in apps/web and apps/api; refreshes the file: dependency copy
npm --prefix apps/web run verify             # lint (3 pre-existing advisory fast-refresh warnings); typecheck;
                                             # 57 tests in 14 files; Vite build clean
npm --prefix apps/api run verify             # lint; typecheck; 103 tests in 11 files; build clean
npm --prefix apps/web run test:ui            # 17/17 Chromium scenarios passed, including 4 new seat-selection cases
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
                                             # scanned 10 files: "No issues found!"
git diff --check                             # exit 0; only the usual LF→CRLF normalization notices
```

**Browser evidence:** a local stub answered the public reads through the real Vite `/api` proxy on `127.0.0.1:5173` (script and log under `.booking-work/evidence/b4-1/`), so no live database was touched. `seat-selection-ar.png` shows the selected seats, EGP price and total, and the ready-selection status; `seat-limit-ar.png` shows the six-seat limit message with the seventh seat unselected. Axe-core 4.12.1 reported **0 violations, 0 incomplete, 39 passes**; two further scoped audits also reported 0 violations.

**Risk review (independent reviewer, fresh context, base `409246b`):** **no blocking issues.** The reviewer re-ran `git diff --check`, both verify gates, React Doctor and the installed contract copies, and checked the spec count. Five non-blocking findings were reported. Four were confirmed and fixed, after which the web gate and `test:ui` were re-run (57 web tests, 17/17 Chromium): (1) `key={showtimeId}` on `<CheckoutForm>` clears the draft on params-only route navigation — preventive, since no same-route showtime link exists yet and the browser path is therefore unverified; (2) the ready-selection status is cleared when the email or seats change after a valid submit, with a regression test; (3) the email error node has an id and the input uses `aria-describedby` so a screen reader announces it; (4) `checkout.test.ts` now pins the distinct schema messages `no_seat_selected` / `seat_limit` / `duplicate_seat` so B4.2 can map `issue.message`. The fifth finding was documentation-only: the reviewer did not re-run Playwright or axe and saw a transient stale tracker state, now corrected. Follow-ups for B4.2: map `issue.message` rather than the generic `issue.code`, and decide whether the shared schema should trim emails as the web form does. Recovery: reverting removes only additive code and contract exports; no stored data or existing response contract is affected.

## B4.2 — Atomic seat claims at confirmation (2026-11-24)

Acceptance criteria were written to `.booking-work/handoffs/b4-2-seat-claims-at-confirmation.md` before editing. Each is starting state → action → expected result → evidence, with a failure/retry case.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | No cinema confirmation endpoint → add `POST /bookings/confirm` with `checkoutRequestSchema` and the shared checkout rate limiter → a UUID showtime, 1–6 unique UUID seats and a guest email are accepted; empty, seven-seat, duplicate, bad-UUID and bad-email payloads get 400 with no DB work; a corrected payload retries to 201. | `apps/api/src/features/bookings/confirmation.test.ts` malformed-payload and rate-limit cases. |
| AC2 | A published showtime has a frozen layout and a piastre price → submit a selection → the server reads the showtime, verifies `published`, a snapshot and auditorium consistency, snapshots `unitPricePiastres` and `totalPiastres`, generates a reference and emails the private credential with expiry from `showtime.starts_at`. The response has no credential, verifier or ciphertext. | API test asserting both inserts, batch composition, captured mail and response shape. |
| AC3 | Cutoff is `startsAt − 15 min` → submit at the exact cutoff, after it and 1 ms before → 409 `booking_closed` with no write at or after, 201 before. Unknown/draft/cancelled/past showtimes are denied before any write. | `schedule.test.ts` boundary cases and confirmation route cases with a controlled clock. |
| AC4 | A selected seat is outside the frozen layout or out of service → submit → 400 `invalid_seat` with no write; removing it and retrying succeeds. | API Vitest denial-plus-retry cases. |
| AC5 | No claim exists for a seat → two confirmations for the same seat → one 201, one 409 `seat_unavailable` with no partial booking. Invariant is a unique `(showtime_id, seat_id)` index; booking and all claims are written in one `db.batch` transaction. | Migration `0007_careful_the_enforcers.sql`; API test mapping a wrapped `23505` to 409 and asserting no email. Live two-request rehearsal deferred to B4.6. |
| AC6 | The seat map derived availability only from the out-of-service flag → after a claim, read the map → the claimed seat reports `available: false`; `bookingClosed` and confirmation share one cutoff helper. | `catalogue/index.test.ts` claim case and `schedule.test.ts` helper cases. |
| AC7 | The B4.1 form showed only a local summary → submit a valid selection → the form posts the shared payload, shows a success status with the reference and total, refreshes cached reads, and keeps seats/email with a localized error on denial. | `CheckoutForm.test.tsx` mutation cases and 18/18 Chromium scenarios, including a 409-then-201 retry. |
| AC8 | Base `c4f0f41` → both verify gates, `test:ui`, React Doctor, `git diff --check` and an independent risk review → all green; build plan and tracker ticked; no migration applied, no live DB, no old E2E, no commit. | Command outputs below, evidence log and review outcome. |

**Changed files:** new `apps/api/src/features/bookings/{confirmation.ts,confirmation.test.ts,guest-link.ts}`; edited `apps/api/src/db/schema.ts`, generated `apps/api/drizzle/0007_careful_the_enforcers.sql` + snapshot + journal, `apps/api/src/features/bookings/index.ts` (+ test), `apps/api/src/features/guest/index.ts` (+ test), `apps/api/src/features/catalogue/index.ts` (+ test), `apps/api/src/features/showtimes/schedule.ts` (+ test); new `apps/web/src/pages/showtime/model/useConfirmBooking.ts`; edited `apps/web/src/pages/showtime/{api,model,ui}`, `apps/web/src/pages/bookings/model/booking.ts` (nullable `serviceName`) and both `catalogue.ts` locales; this tracker, the build plan, the checkpoint and `.booking-work/evidence/b4-2/`. No prior B2/B3/B4.1 content was overwritten.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify
# lint clean; typecheck clean; 118 tests in 12 files passed; build clean (baseline 103 in 11)
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings; typecheck clean;
# 58 tests in 14 files passed; Vite build clean (baseline 57 in 14)
npm --prefix apps/web run test:ui
# 18/18 Chromium scenarios passed (baseline 17/18)
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# scanned 8 files: "No issues found!"
git diff --check
# exit 0; only the usual LF→CRLF normalization notices
```

`npm run db:generate` produced migration `0007` from the schema change; it was not applied to any database. The old B0 `test:e2e` journey remains deliberately unrun (known gap). A standalone browser stub experiment was abandoned; the Chromium scenarios stub the API with `page.route` through the real Vite `/api` path, so no live Neon database was touched. No separate axe run was needed for two status paragraphs and a button label; the B4.1 axe-clean audit still covers the seat map's names, focus order and RTL flow.

**Risk review (independent reviewer, fresh context, base `c4f0f41`):** **no blocking code issue.** The reviewer independently confirmed that the installed `drizzle-orm/neon-http` `db.batch` calls `client.transaction(builtQueries, queryConfig)`, i.e. one non-interactive Neon transaction, so a losing seat claim rolls the booking back with no partial rows. Also confirmed: validation precedes every DB call; the cutoff helper is shared by read and write; the guest credential is only emailed; prototype rows keep their staff/guest contract through `leftJoin`; price and quantity come from the server; read-side claims use the same availability rule; the migration is additive and its snapshot matches `0006`. One blocking **documentation** finding was fixed by ticking the plan, adding this section and updating the checkpoint. Nine non-blocking follow-ups were recorded and are carried into B4.3/B4.4/B4.6: map API error codes to localized text, invalidate the seat map on a denial, clear a confirmed selection that the refreshed map marks unavailable, close the read/commit TOCTOU on showtime state, type `serviceName` as nullable in the legacy web model, narrow the `23505` mapping to the seat constraint, surface mail failure after commit, review the pre-existing rate-limit key trust, and remove the redundant seat-limit check. Recovery: reverting the code leaves an additive migration unapplied; if it has been applied, reverting code alone leaves an empty `booking_seats` table and nullable columns, and prototype rows keep working.

## B4.3 — Availability refresh and revised total (2026-11-24)

Acceptance criteria were written to `.booking-work/handoffs/b4-3-availability-and-price-refresh.md` before editing. Each is starting state → action → expected result → evidence, with a failure/retry case.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | Confirmation accepted only the shared checkout shape → add an optional `quotedUnitPricePiastres` and a structured conflict schema to `packages/cinema-contracts`, refreshed with `npm ci` in both apps → an absent or matching quote books at the server price; a different quote returns 409 `price_changed` with `{ error, unitPricePiastres, availableSeatIds }`, no write and no email; the corrected retry succeeds and a zero/non-numeric quote is rejected before any DB work. | API Vitest cases; `checkout.test.ts` contract cases; both verify gates. |
| AC2 | A claimed seat previously produced only a generic 409 → read the frozen-layout claim set before the write → a taken seat returns 409 `seat_unavailable` with the current unit price and the subset of requested seats still available, no booking/claim/email; retrying with the remaining seat succeeds. A competing `23505` re-reads claims to return the same detailed conflict; the unique index stays the arbiter. | API Vitest claim, retry and wrapped-`23505` cases; migration `0007` unchanged. |
| AC3 | `request()` threw a plain `Error` with the raw code → add `ApiRequestError` carrying status, code and details in `shared/api` → the showtime slice reads a conflict's price and available ids without parsing UI text; unknown codes and non-API errors stay generic. | `client.test.ts` and new `model/confirmation.test.ts`. |
| AC4 | A conflict kept the whole selection and refreshed nothing → on a detailed `seat_unavailable`, prune only the taken seats, keep the other seats and email, invalidate the seat map and detail queries, and show a localized reason; retry succeeds. A conflict without details keeps the selection. | `CheckoutForm.test.tsx` case and a Chromium stub scenario. |
| AC5 | The total came only from the cached detail → on `price_changed`, show the server's revised unit price and total plus an explicit "confirm new total" action; the ordinary submit is disabled so it cannot accept the new price implicitly; the explicit action resubmits with the revised quote and succeeds. Known codes map to localized Arabic/English messages. | `CheckoutForm.test.tsx` cases, Chromium price-change scenario, both locale files. |
| AC6 | A confirmed selection stayed selected although the refreshed map marks it unavailable → clear the selection on success while keeping the reference and total status; name a claimed seat "booked" rather than "out of service". | Component tests, `SeatMapSection.test.tsx`, Chromium case. |
| AC7 | Base `067fc98` → both verify commands, `test:ui`, React Doctor, `git diff --check` and an independent risk review → all green; no schema change, migration applied, live database, old E2E or commit; build plan ticked and B4.4 recorded as next action. | Command outputs below and review outcome. |

**Changed files:** `packages/cinema-contracts/index.js`; `apps/api/src/features/bookings/{confirmation.ts,confirmation.test.ts}`; `apps/web/src/shared/api/{client.ts,client.test.ts,index.ts}`; new `apps/web/src/pages/showtime/model/{confirmation.ts,confirmation.test.ts}`; `apps/web/src/pages/showtime/model/{checkout.ts,checkout.test.ts,useConfirmBooking.ts}`, `ui/{CheckoutForm.tsx,CheckoutForm.test.tsx,SeatMapSection.tsx,SeatMapSection.test.tsx}`, `apps/web/e2e-ui/seat-selection.spec.ts`; both `locales/*/catalogue.ts`; this tracker, the build plan and the checkpoint. No schema, migration, auth, guest-link, staff route or B4.1/B4.2 committed content was overwritten.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm ci                                      # separately in apps/web and apps/api; refreshes the file: dependency copy
npm --prefix apps/api run verify
# lint clean; typecheck clean; 121 tests in 12 files passed; build clean (baseline 118 in 12)
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings; typecheck clean;
# 75 tests in 15 files passed; Vite build clean (baseline 58 in 14)
npm --prefix apps/web run test:ui
# 19/19 Chromium scenarios passed (baseline 18/18), including seat pruning and revised-price cases
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# scanned 15 files: "No issues found!"
git diff --check
# exit 0; only the usual LF→CRLF normalization notices
```

No `db:generate`, migration, live database, production build outside `verify`, old B0 E2E or commit. Browser evidence is the 19 Chromium runs through the real Vite `/api` proxy with a stubbed public API; no live Neon database was touched. The `ApiRequestError` name appears in console output from the pre-existing deliberate failure stubs in other UI specs; those scenarios still pass unchanged. Recovery: omitting the optional quote keeps older clients booking at the server price; a rejected conflict writes nothing, and reverting the code restores the previous generic-confirmation behavior without rolling back data.

**Risk review (independent reviewer, fresh context, base `067fc98`):** one **blocking issue was confirmed and fixed**: the "confirm revised total" action was not disabled while `isPending`, so a double-click could send two confirmations, one succeed and email the guest link, and the losing response overwrite the success status with "seats taken". The button now carries `disabled={isPending}` and a component test pins it; both verify gates, `test:ui`, React Doctor and `git diff --check` were re-run (121 API tests, 75 web tests, 19/19 Chromium, no issues). One accessibility finding was also fixed: `role="alert"` now sits on the revised-price message text rather than wrapping the interactive button. Confirmed: the optional quote keeps old clients working, old conflict bodies degrade to a generic message with the selection kept, the `db.batch` transaction and unique `(showtime_id, seat_id)` arbiter are unchanged, no verifier/ciphertext is returned, both new locales are registered, and the claim read does not replace the storage invariant. Non-blocking follow-ups carried forward: a second non-price failure after a price revision leaves the revision pending (B4.4 UX), conflict ids must be UUIDs to be parsed so a partial API response loses pruning details (B4.5), the API's own read→write price window and a generic `23505` mapping remain TOCTOU/constraint-labelling concerns (B4.5/B4.6), the catch-block claim re-read cannot guarantee which competing seat lost (B4.6), and pruning is only true at conflict time before the map refetch (B4.6). Recovery remains a code-only revert; no schema, migration or stored data changed.

## B4.4 — Confirmation screen (2026-11-25)

Acceptance criteria were written to `.booking-work/handoffs/b4-4-confirmation-screen.md` before editing. Each is starting state → action → expected result → evidence, with a failure/retry case.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | The confirm write already snapshotted the price and reference in `bookings` → confirm a valid selection → the same `reference`, `unitPricePiastres` and `totalPiastres` are written in the one `db.batch` and returned in the 201 body; no new column or migration. | `apps/api/src/features/bookings/confirmation.test.ts` first case asserts the insert values and the exact response. |
| AC2 | The confirm response carried only ids and prices → join `films` and `auditoriums` and derive labels from the frozen snapshot → 201 also returns `filmTitle`, `auditoriumName` (frozen name preferred) and `seatLabels` in the requested seat order; denials and credential secrecy are unchanged. | API Vitest cases, including a reversed-seat-order case and an assertion that the renamed live auditorium name never appears. |
| AC3 | Success showed only a paragraph → render a confirmation card with the film, Cairo-formatted showtime, auditorium, seat labels, reference, accepted total, venue-payment instruction and emailed-link note → Arabic RTL and English show every field with no private token and the `role="status"` line is retained. | New `BookingConfirmation.test.tsx`, updated `CheckoutForm.test.tsx`, two Chromium scenarios, screenshot and axe audit. |
| AC4 | After a `price_changed` revision a second non-price failure left the revision pending → clear it on any other failure, keep the selection and email, show the localized error and re-enable the normal submit; the retry confirms at the reviewed price. | `CheckoutForm.test.tsx` failure-then-retry case. |
| AC5 | Stubbed confirm responses lacked the display fields → update every stub and exercise the details through the normal form path → no parsing failure or regression in the pruning/revised-price scenarios, and axe reports no violations. | `seat-selection.spec.ts`, `CheckoutForm.test.tsx`, `.booking-work/evidence/b4-4/`. |
| AC6 | Base `258f848` → both verify commands, `test:ui`, React Doctor, `git diff --check`, `git diff --stat` review and `review-booking-change` → all green; build plan ticked, B4.5 recorded as next action; no migration, live database, old E2E or commit. | Command outputs below and the review outcome. |

**Changed files:** `apps/api/src/features/bookings/{confirmation.ts,confirmation.test.ts}`; new `apps/web/src/pages/showtime/ui/{BookingConfirmation.tsx,BookingConfirmation.test.tsx}`; `apps/web/src/pages/showtime/model/checkout.ts`, `ui/{CheckoutForm.tsx,CheckoutForm.test.tsx}`, `e2e-ui/seat-selection.spec.ts`; both `app/providers/locale/locales/*/catalogue.ts`; this tracker, the build plan, the checkpoint and `.booking-work/evidence/b4-4/`. No schema, migration, auth, guest-link, staff route or B4.1–B4.3 committed content was overwritten.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify
# lint clean; typecheck clean; 123 tests in 12 files passed; build clean (baseline 121 in 12)
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings; typecheck clean;
# 79 tests in 16 files passed (baseline 75 in 15); Vite build clean
npm --prefix apps/web run test:ui
# 20/20 Chromium scenarios passed (baseline 19/20), including the Arabic RTL confirmation case
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# scanned 8 files: "No issues found!"
git diff --check
# exit 0; only the usual LF→CRLF normalization notices
```

No `db:generate`, migration, live database, production build outside `verify`, old B0 E2E or commit. Browser evidence used the real Vite app with a local stub API on port 3000 so no Neon database was touched: `.booking-work/evidence/b4-4/confirmation-ar.png` shows the Arabic RTL confirmation card with the film, Cairo showtime, auditorium, seat labels, reference, total and venue-payment instruction; `confirmation-a11y.json` reports axe 4.12.1 with **0 violations, 0 incomplete, 36 passes**. Recovery: reverting the code restores the inline success paragraph; the booking write already stores the price and reference, so no stored data or migration needs rolling back.

**Risk review (independent reviewer, fresh context, base `258f848`):** **no blocking issue.** The reviewer re-ran both verify gates, `test:ui`, React Doctor and `git diff --check`, and confirmed the single batch still writes the reference and accepted price, frozen seat labels follow the request order, denials and credential secrecy are untouched, older clients omitting the quote still book, and reverting is code-only. Five non-blocking findings were reported: (1) deploying this web bundle against an older API response would make `seatLabels.join` throw — accepted because D8 serves web and API from one origin; carry a parsed response contract if independent rollout is ever needed; (2) the empty-snapshot-name fallback was untested — **fixed** with a focused API case and the gate re-run (123 API tests); (3) `filmTitle` intentionally comes from the live film row because D3 freezes only auditorium, time and seat labels; (4) the email field is intentionally absent while the confirmation card is shown, per AC3; (5) evidence-quality notes — the axe JSON and screenshot were reviewed rather than re-run, and the checkpoint's arrow characters are valid UTF-8 when read with the correct encoding.

## B4.5 — Confirmation idempotency (2026-11-25)

Acceptance criteria were written to `.booking-work/handoffs/b4-5-confirmation-idempotency.md` before editing. Each is starting state → request/action → expected result → evidence, with a failure/retry case.

| ID | Starting state → request/action → expected result | Evidence |
| --- | --- | --- |
| AC1 | No idempotency key existed → `POST /bookings/confirm` with an `Idempotency-Key` UUID header → the key, a SHA-256 fingerprint of `canonicalCheckoutPayload` and the original 201 body (without contact details) are stored in the same `db.batch`; an identical retry returns the same 201 body with one batch, one claim set and one email. | `apps/api/src/features/bookings/confirmation.test.ts` first two cases assert the insert values, exact body equality on replay, batch call count and captured mail count. |
| AC2 | Key K succeeded with payload P → retry K with a changed seat, email or quote → 409 `{ error: 'idempotency_key_conflict' }`, no write, no second email and the original booking untouched. | API Vitest key-conflict case. |
| AC3 | A confirmation failed before the write (seat taken) → retry with the same key after availability recovers → 201; a failed attempt does not reserve the key. | API Vitest denial-then-retry case. |
| AC4 | Two confirmations race with the same key → unique index `bookings_idempotency_key_unique` arbitrates and the loser replays the winner without a second email; a seat-constraint `23505` still maps to `seat_unavailable`. | Migration `0008_clear_puff_adder.sql`, API race case with a named constraint, and `it.each` seat-conflict cases with and without a constraint name. |
| AC5 | Missing/malformed key → 400 before any DB work; the web mutation generates one UUID per attempt, reuses it for an unchanged retry, rotates it on a changed payload (including an accepted revised total) and after success; the conflict code is localized in Arabic and English. | API header-validation case; `useConfirmBooking.test.tsx`; `CheckoutForm.test.tsx`; both `catalogue.ts` locales; Chromium stable-key scenario. |
| AC6 | Base `f791536` → `npm ci` in both apps, both verify gates, `test:ui`, React Doctor, `git diff --check` and an independent risk review → all green; migration generated but not applied, no live database, no commit. | Command outputs below and review outcome. |

**Changed files:** `packages/cinema-contracts/index.js`; `apps/api/src/db/schema.ts` + generated `apps/api/drizzle/0008_clear_puff_adder.sql`, `meta/0008_snapshot.json` and journal entry; `apps/api/src/features/bookings/{confirmation.ts,confirmation.test.ts}`; web `pages/showtime/api/showtime.ts`, `model/{checkout.ts,checkout.test.ts,confirmation.ts,confirmation.test.ts,confirmation-key.ts,useConfirmBooking.ts,useConfirmBooking.test.tsx}`, `ui/{CheckoutForm.tsx,CheckoutForm.test.tsx}` and `e2e-ui/seat-selection.spec.ts`; both `app/providers/locale/locales/*/catalogue.ts`; this tracker, the build plan and the checkpoint. No B2–B4.4 content was overwritten.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm ci                                       # separately in apps/web and apps/api; refreshes the file: contract copy
npm --prefix apps/api run verify              # lint clean; typecheck clean; 130 tests in 12 files passed; build clean (baseline 123 in 12)
npm --prefix apps/web run verify              # three pre-existing advisory fast-refresh warnings; typecheck clean;
                                              # 86 tests in 17 files passed; Vite build clean (baseline 79 in 16)
npm --prefix apps/web run test:ui             # 22/22 Chromium scenarios passed, including stable-key and reload-replay cases (baseline 20/22)
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
                                              # scanned 11 files: "No issues found!"
git diff --check                             # exit 0; only the usual LF→CRLF normalization notices
```

`npm --prefix apps/api run db:generate` produced `0008_clear_puff_adder.sql` (three nullable columns and the unique index); it was not applied to any database. Browser evidence is the 21 Chromium runs through the real Vite `/api` proxy with a stubbed API, so no Neon database was touched. The old B0 `test:e2e` journey remains deliberately unrun (known gap). Recovery: reverting the code leaves unused nullable columns and a unique index on an isolated migration; existing prototype rows have NULL keys and are unaffected. To remove the migration, drop the index and the three columns before reverting `0008`.

**Risk review (independent reviewer, fresh context, base `f791536`):** **no blocking issue.** The reviewer verified the constraint-aware `23505` handling against the installed `@neondatabase/serverless` source, confirmed the replay projection reproduces every public field (including frozen seat order and auditorium name) and that the credential is never stored or returned, and confirmed the test mocks genuinely exercise replay and race paths. Seven non-blocking findings were recorded. A follow-up pass in the same task addressed six of them, with every gate re-run (130 API tests, 86 web tests, 22/22 Chromium, React Doctor clean): the ref-based key lifecycle moved into the mutation hook and persisted in tab storage so a lost response survives a page reload; both the original and replayed 201 bodies are built by one helper in a fixed field order, making them byte-identical despite `jsonb` key normalization; a same-key/different-payload race that trips the seat constraint now reports the key conflict; header validation runs before rate limiting so malformed keys do not consume the checkout budget; and the retention comment now states that the legacy `customer_name` also holds the guest email. A second and third independent review found no new blocking issue after the refactor and the follow-up fixes. Two findings remain deliberately open: migration `0008` takes an `ACCESS EXCLUSIVE` lock and the Neon migrator is non-transactional, so staging rehearsal belongs to B8; after D7 clears `customer_email`, a replay would return the cleared value, which needs an explicit retention decision in B7.

## B4.6 — Live booking verification (2026-11-27)

Acceptance criteria were written to `.booking-work/handoffs/b4-6-live-booking-verification.md` before editing. Each is starting state → action → expected result → evidence, with a failure/retry case.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | Anonymous Arabic visitor, isolated DB with a freshly published showtime created through the real admin API → open `/`, find the unique film, open its showtime, select A1 by keyboard and A2 by click, enter a unique email, first confirm intercepted with a 503 at the browser HTTP boundary → localized error, seats and email preserved, no confirmation card; retry through Hono → 201 card with film, Cairo time, auditorium, frozen labels, reference and venue payment. | `apps/web/e2e/booking.spec.ts`; 1/1 Playwright pass, trace in `.booking-work/evidence/b4-6/playwright-trace.zip`. |
| AC2 | After AC1 → reload the showtime page and read bookings with a staff session → both seats render as booked and disabled, staff `GET /api/bookings` has exactly one row for the unique email; an anonymous read is 401 `authentication_required`. | Spec assertions; trace and `playwright-run.log`. |
| AC3 | Published showtime, free A1 → two concurrent confirmations with distinct keys/emails → one 201 and one 409 `seat_unavailable` with `availableSeatIds` excluding A1; DB holds one booking and one claim for A1, one guest email. | `.booking-work/evidence/b4-6/live-rehearsal.json`, `competingClaims`. |
| AC4 | A1 claimed, A4 free → confirm `[A1,A4]` → 409 listing only A4, counts unchanged, no A4 claim and no email; retry `[A4]` → 201. | Same JSON, `multiSeatConflict`. |
| AC5 | Showtimes starting 14 and 16 minutes away → confirm → 409 `booking_closed` before the cutoff, 201 after; `isBookingClosed` at the exact boundary is true and 1 ms earlier is false. | Same JSON, `bookingCutoff`. |
| AC6 | Same UUID key and identical payload → two concurrent confirmations → both 201 with byte-identical bodies, one booking/claim set and one email; replay returns the same body; the same key with a changed seat → 409 `idempotency_key_conflict` with no new row or email. | Same JSON, `idempotency`. |
| AC7 | Public detail read at 2500, price changed to 3000 at storage → stale quote → 409 `price_changed` with 3000 and available seats, unquoted confirm writes 3000; an overlapping race reports conflict details consistent with stored claims. | Same JSON, `priceWindow` and `catchBlockReread`. |
| AC8 | Complete change → both verify gates, Playwright, live rehearsal, React Doctor, `git diff --check`, independent risk review → all green; isolated DB only, no commit; plan and tracker ticked, next action B5.1. | Command outputs and risk review below. |

**Changed files:** new `apps/api/scripts/verify-booking-live.ts` and `seed-booking-e2e.ts`; new `apps/web/e2e/booking.spec.ts` content replacing the obsolete B0 scenario; `apps/web/playwright.config.ts` (admin seed chain plus `E2E_API_PORT`/`E2E_WEB_PORT` overrides), `apps/web/vite.config.ts` (`E2E_API_TARGET` proxy override), `apps/api/src/features/bookings/confirmation.ts` (late idempotency re-check) and its test (two regression cases), `apps/api/package.json` (two scripts); the verification skill and feature map, CI comment, this tracker, the build plan and the checkpoint. No schema change was generated.

**Prerequisite and migration:** the isolated `booking_system_test` database had migrations `0000`–`0006` applied. Migrations `0007_careful_the_enforcers.sql` (`booking_seats`) and `0008_clear_puff_adder.sql` (idempotency columns and unique index) were applied to that isolated database with the pooled/unpooled target guard and no credential output. Post-check at migration time: migration IDs 1–9, three idempotency columns, `booking_seats` present, prototype rows still 3 services and 6 bookings. The later Playwright runs left synthetic `e2e-b46-…` bookings; the final rehearsal compared before/after equality (3 services and the same booking count on both sides), so no rehearsal row was left behind. No production database was touched.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify
# lint clean; typecheck clean; 132 tests in 12 files passed (baseline 130); build clean
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings; typecheck clean;
# 86 tests in 17 files passed; Vite build clean
$env:E2E_API_PORT='3100'; $env:E2E_WEB_PORT='5273'
npm --prefix apps/web run test:e2e -- --trace on
# 1/1 Chromium scenario passed against the real Hono API, not stubs
npm --prefix apps/api run verify:booking-live
# all live invariant assertions passed; JSON evidence captured
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# scanned 3 files: "No issues found!"
git diff --check
# exit 0; only the usual LF→CRLF normalization notices
```

Port overrides were needed because an unrelated service already listened on 3000; no process belonging to another project was stopped. A first parallel run of all gates hit Vitest fork-worker timeouts under resource contention; re-running `npm --prefix apps/web run verify` alone passed with all 86 tests.

**Bug found and fixed:** the live idempotency race initially returned `seat_unavailable` for one of two identical concurrent confirmations. The losing request's replay read preceded the winner's commit, then its claim read saw the committed claim; the catch block was never reached. `confirmation.ts` now re-reads the idempotency row immediately before both read-side conflict responses (seat and price) and replays the original 201 when the same key and fingerprint have won. Two Vitest regression cases pin both paths; the live rehearsal then reported `[201,201]`, byte-identical bodies, one booking/claim and one email.

**Residual follow-ups carried forward:** the API still reads then writes the price in one window, so an older client that omits the quote can book at the pre-change price; the web always sends the reviewed quote, which closes the guest-visible gap. The `23505` catch-block re-read is only exercised when both requests read claims before either writes, so the live overlapping-race case verifies consistency when it happens but does not force that path every run. The seeder's password and fixed account exist only in the isolated database. Successful Playwright runs leave synthetic film/auditorium/showtime/booking rows because there is no delete route; unique stamps keep runs independent.

**Risk review (independent reviewer, fresh context, base `027e842`):** **no blocking issue.** The reviewer traced the late-replay helper through same-payload races, different-payload reuse, failed-before-write and failed-during-batch attempts, repricing and legacy rows with null idempotency fields, and confirmed the additive early returns cannot reserve a key or write twice. It verified the rehearsal's pooled/unpooled guards, fixed-ID fixture cleanup and before/after prototype counts, and confirmed the Playwright spec reaches real Hono routes through the Vite proxy with only the one-shot 503 intercepted. Six non-blocking follow-ups were reported. One was **fixed in this task**: the seeder and Playwright config accepted any database named `booking_system_test`, so both now require the pooled `-pooler` host before creating/elevating the test admin; lint, typecheck and Playwright 1/1 were re-run after the change. The remaining findings are documented rather than fixed: the live race cases do not deterministically force the new replay branches (the two mocked Vitest cases do), the exact-cutoff API case is in `confirmation.test.ts` while the rehearsal uses 14/16-minute starts, catch-path coverage is probabilistic, successful Playwright runs accumulate synthetic rows, and the assertion helper reads the response body eagerly in its message (harmless because Playwright caches bodies). Recovery is a code-only revert: no migration, schema change or stored-data path was added.

## B5.1 — Guest booking details (2026-11-27)

Acceptance criteria were written to `.booking-work/handoffs/b5-1-guest-booking-details.md` before editing. Each is starting state → action → expected result → evidence, with a failure/retry case. Base `027e842`; the uncommitted B4.6 work was preserved.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | Cinema booking with a frozen confirmation outcome → `GET /guest/bookings/:reference?token=…` → 200 with the frozen film, Cairo showtime, auditorium, seat labels in request order, reference, accepted unit/total price and the guest's own email; no verifier, ciphertext or token in body/headers; no-store and no-referrer headers. Only the fixed public field set of the stored outcome is reflected. | `apps/api/src/features/guest/index.test.ts` cinema cases; `verify-booking-live.ts` `guestDetail` result. |
| AC2 | Same booking with no token, a wrong token, an expired token or another booking's token → identical 404 `{ error: 'guest_link_invalid' }`, no contact details; reference-only performs no DB read; headers stay no-store/no-referrer. | Guest suite denial cases; live rehearsal `referenceOnlyStatus: 404`; three Chromium denial cases. |
| AC3 | Legacy prototype booking without a snapshot → valid link → 200 with the unchanged legacy shape (`customerName`, `serviceName`, etc.). | Existing exact-equality guest tests pass unchanged; component test for the legacy card. |
| AC4 | Valid emailed link → Arabic RTL page shows the frozen details, reference, EGP total and venue-payment note; the token never appears in rendered text or link targets; the document sets `Referrer-Policy: no-referrer` through the router head. | `GuestBookingPage.test.tsx`; `e2e-ui/guest-booking.spec.ts` valid-link case. |
| AC5 | Missing or wrong token → generic localized alert, no card and no contact details; retry refetches without a document reload and a successful response renders the card. | Chromium reference-only, wrong-token and gated retry cases. |
| AC6 | Guest response → no credential in body, DOM, links, Referer or API/dev logs; rate limiting and generic denials from B2.4 unchanged. | API console-spy assertions, browser `body.textContent`/`href`/Referer/console assertions (dev route-match logs show only a token fingerprint), live `tokenReflected: false`. |
| AC7 | Complete change → both verify gates, `test:ui`, `test:e2e`, live rehearsal, React Doctor, `git diff --check`, risk review → all green; no migration, production DB or commit; next action B5.2 recorded. | Command outputs and review outcome below. |

**Changed files:** `apps/api/src/features/guest/{index.ts,index.test.ts}`; `apps/api/scripts/verify-booking-live.ts`; new web slice `pages/guest-booking/{index.ts,model/guest-booking.ts,model/useGuestBooking.ts,api/guest-booking.ts,api/guest-booking.queries.ts,ui/GuestBookingPage.tsx,ui/GuestBookingPage.test.tsx}`; new route `app/routes/guest/bookings.$reference.tsx` and adapter `app/ui/guest-booking-route.tsx`; `app/ui/root-layout.tsx` (HeadContent for route head), generated `app/routeTree.gen.ts`; `app/providers/locale/messages.ts` plus both `locales/*/guestBooking.ts`; `e2e-ui/guest-booking.spec.ts`; the verification map and these docs. No schema, migration, auth, booking write, or existing route contract changed.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify             # lint/typecheck clean; 135 tests in 12 files; build clean (baseline 132)
npm --prefix apps/web run verify             # three pre-existing advisory fast-refresh warnings; typecheck;
                                             # 92 tests in 19 files (baseline 86); Vite build clean
npm --prefix apps/web run test:ui            # 27/27 Chromium scenarios, including five new guest-page cases
npm --prefix apps/web run test:e2e -- --trace on
                                             # 1/1 real Hono + isolated Neon booking journey
npm --prefix apps/api run verify:booking-live
                                             # guestDetail status 200, frozen labels, tokenReflected false,
                                             # referenceOnlyStatus 404, prototype rows unchanged
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
                                             # scanned 19 files: "No issues found!"
git diff --check                             # exit 0 (LF→CRLF notices only)
```

The first `npm --prefix apps/web run verify` attempt hit the known Vitest fork-worker timeout under concurrent load; re-running `npm test` alone and then the full `verify` command passed with 88 tests. Browser UI evidence uses a stubbed API on the real Vite proxy, so no live guest link or contact data was used; the live rehearsal uses the isolated database and the in-process mail adapter without printing the credential. React Doctor was clean. No migration, schema change, production database, commit or PR. Recovery is a code-only revert: the API read is additive, the new route/slice/locale namespace are unused elsewhere, and no stored data or existing response shape changed.

**Risk review (independent reviewer, fresh context, base `027e842`):** **no blocking issue.** The reviewer confirmed the credential is verified before the frozen snapshot is returned, reference-only requests are denied before any DB call, the legacy response shape is unchanged, no cross-page import or new dependency exists, and all gates pass. Eight non-blocking findings were reported; five were fixed in this task and the gates re-run (135 API tests, 92 web tests, 27/27 Chromium, React Doctor clean): (1) the raw token was replaced by a non-reversible fingerprint in `loaderDeps`, so dev-only route-match warnings and router devtools no longer show the credential — a Chromium case now asserts no `gl_` value reaches the console; (2) the guest fetch sets `referrerPolicy: 'no-referrer'`, closing the gap where the loader request started before the route head committed — a Chromium case captures the request headers; (3) duplicated or non-string token query values are normalised before validation instead of producing a raw Zod error, with a Chromium case; (4) `too_many_requests` is now localized in both guest locales; (5) direct Vitest cases cover the zod boundary schemas and the token fingerprint. Three findings remain documented rather than fixed: `staleTime: 'static'` will hide a future cancelled state after B5.2 adds the write (B5.2 must invalidate or change the loader), a migrated cinema row with a NULL frozen snapshot is presented by the legacy fallback, and reverting B5.1 must be done per-hunk because B4.6 evidence shares several files. Recovery is otherwise code-only: no schema, migration, stored-data path or existing response contract changed.

## B5.2 — Guest cancellation (2026-11-27)

Acceptance criteria were written to `.booking-work/handoffs/b5-2-guest-cancellation.md` before editing. Each is starting state → request/action → expected result → evidence, with a failure/retry case. Base `027e842`; the uncommitted B4.6 and B5.1 work was preserved.

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | Confirmed cinema booking with claims, valid token, more than two hours out → `POST /guest/bookings/:reference/cancel` with `X-Guest-Token` → 200 cancelled detail with no credential; in one `db.batch` the status becomes `cancelled`, `cancelled_at` is set and every claim for the booking is deleted; the seat map reports the seat available again. | `apps/api/src/features/guest/index.test.ts` cancellation case asserting one batch of two statements and no credential; live rehearsal `guestCancellation` with `claimsAfterCancel: 0` and `seatAvailableAgain: true`. |
| AC2 | Exactly two hours before start, 1 ms before and after → cancellation → 409 `cancellation_closed` with no write at or after the boundary, 200 one millisecond earlier. The cutoff is measured from the stored instant like the 15-minute checkout rule. | `apps/api/src/features/showtimes/schedule.test.ts` exact-boundary cases; API cases with a controlled clock; live rehearsal `cutoffStatus: 409`, `cutoffStoredStatus: confirmed`. |
| AC3 | Already-cancelled booking → repeat the write → byte-identical 200 with no second batch, timestamp change or email, so a lost response is safe to retry. | API repeated-cancellation case; live rehearsal `repeatedStatus: 200`, `repeatedBodyIdentical: true`. |
| AC4 | Missing, wrong, expired or wrong-booking token, or reference only → cancellation → the identical generic 404 `guest_link_invalid`, no DB write, no-store/no-referrer headers, no credential in body/headers/logs; the shared guest limiter still returns 429 after 20 attempts. | Guest cancellation denial cases with console and DB spies; live `referenceOnlyStatus: 404`. |
| AC5 | Legacy prototype row with no frozen snapshot → cancellation → whole-booking cancellation using its stored start instant, with no cinema claims to release; the legacy read shape stays unchanged. | API legacy cancellation case; existing exact-equality detail cases still pass. |
| AC6 | Arabic guest page for a confirmed, open booking → explicit two-step confirmation → success invalidates the `staleTime: 'static'` detail query and the shared showtime query root, shows the cancelled note, hides the action, never renders or links the token; closed/cancelled hides the action and a failed write shows a localized error with retry. Both locales registered; axe clean in B5.1 still covers the layout. | `GuestBookingPage.test.tsx`, `useGuestCancellation.test.tsx`, `guest-booking.test.ts`; `e2e-ui/guest-booking.spec.ts` three new Chromium cases. |
| AC7 | Complete change → both verify gates, `test:ui`, `test:e2e`, live rehearsal, React Doctor, `git diff --check`, risk review → all green; migration generated, applied only to the isolated database; no production database or commit; next action recorded. | Command outputs below and review outcome. |

**Evidence files:** `.booking-work/evidence/b5-2/` holds `live-rehearsal.json`, `playwright-run.log`, `playwright-trace.zip` and `execution-log.md`; the 31 Chromium UI scenarios are reproducible with `npm --prefix apps/web run test:ui`.

**Changed files:** `apps/api/src/db/schema.ts` and generated `apps/api/drizzle/0009_calm_roxanne_simpson.sql` + snapshot + journal; `apps/api/src/features/showtimes/{schedule.ts,schedule.test.ts}`; `apps/api/src/features/guest/{index.ts,index.test.ts}`; `apps/api/scripts/verify-booking-live.ts`; new `apps/web/src/shared/api/query-keys.ts`; `apps/web/src/shared/api/index.ts`; `apps/web/src/pages/showtime/api/showtime.queries.ts`; `apps/web/src/pages/guest-booking/**` (model, api, hook, `ui/CancellationPanel.tsx`, `ui/GuestBookingPage.tsx`, tests, index); both `app/providers/locale/locales/*/guestBooking.ts`; `apps/web/e2e-ui/guest-booking.spec.ts`; the build plan, this tracker, the checkpoint and the verification map. No production database, no existing route contract removed, no new dependency.

**Verification (exact commands and outcomes, from the repository root):**

```powershell
npm --prefix apps/api run verify
# lint clean; typecheck clean; 143 tests in 12 files passed (baseline 135); build clean
npm --prefix apps/web run verify
# three pre-existing advisory fast-refresh warnings; typecheck clean;
# 97 tests in 19 files passed (baseline 92); Vite build clean
npm --prefix apps/web run test:ui
# 31/31 Chromium scenarios passed (baseline 27/31), including four new cancellation cases
npm --prefix apps/web run test:e2e -- --trace on
# 1/1 real Hono + isolated Neon booking journey
npm --prefix apps/api run verify:booking-live
# guestCancellation: status 200, storedStatus cancelled, claimsAfterCancel 0,
# seatAvailableAgain true, repeatedStatus 200, repeatedBodyIdentical true,
# cutoffStatus 409, cutoffStoredStatus confirmed, referenceOnlyStatus 404
npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
# scanned 24 files: "No issues found!"
git diff --check
# exit 0; only the usual LF→CRLF normalization notices
```

Migration `0009` was applied to the isolated `booking_system_test` database through the pooled/unpooled target guard; no credential was printed. The rehearsal adds a dedicated third auditorium so the two-hour fixture does not overlap its existing showtimes; it removes the whole fixture before and after, and prototype rows stayed at 3 services / 13 bookings on both sides. The browser UI checks use a stubbed API on the real Vite proxy, so no live guest link or contact data was used; the live rehearsal uses the isolated database and in-process mail adapter without printing the credential. `staleTime: 'static'` is now explicitly invalidated after a write, closing the B5.1 follow-up. Recovery is a code-only revert plus an unapplied/additive migration: existing rows keep `status = confirmed`, `cancelled_at = NULL`, and no cancelled booking is produced by older code.

**Risk review (independent reviewer, fresh context, base `027e842`):** **no blocking issue.** The reviewer confirmed against the installed Drizzle and Neon source that `db.batch` maps to one non-interactive Neon transaction, that the `status = 'confirmed'` compare-and-swap plus the claim delete leaves a consistent final state under a race, that the credential is never reflected or logged, and that prototype rows stay valid after `0009`. One non-blocking UX finding was **fixed**: after a 409 refresh marks the booking closed, the confirmation panel stayed visible; it is now derived from `canCancel` as well as local state, and a Chromium case pins it. The reviewer also noted residual items recorded below; gates were re-run after the fix (143 API tests, 97 web tests, 31/31 Chromium).

**Non-blocking residuals carried forward (not B5.2 failures):**
- The read link still carries the credential in its query string and the Query key contains it, so browser history and dev-only devtools can see it; the write deliberately uses a header instead. A fingerprint-only key is a future hardening option (D2).
- The custom `X-Guest-Token` header would need CORS configuration if the API were ever served cross-origin; D8 serves both apps from one origin, so no preflight occurs today.
- Deploy the API and migration before the web bundle: the new web schema requires the additive `status`/`canCancel` fields that an older API does not return. One-origin deployment in D8 keeps these in lockstep.
- The two-hour cutoff is an absolute duration from the stored instant, matching the existing 15-minute checkout rule; if the policy ever means Cairo wall-clock hours across a DST change, both helpers need revisiting together.
- The check-then-write window is negligible (a batch can commit just after the boundary), and the shared in-memory limiter still trusts `x-forwarded-for`; both are pre-existing designs.
- A code-only revert is safe **only before any cancellation has been accepted**. After a real cancellation, reverting code would show an active booking with no claims; recovery requires restoring the status and rebuilding claims from `idempotencyResponse.seatIds` (or rebooking), and there is no down migration.
- The six guest-page Chromium cases run via `test:ui` locally; CI's manual Playwright job runs only `e2e/`. A CI step for `test:ui` is a separate workflow improvement.
- No cancellation email is sent; guest notification delivery is B7.2/B7.3, and the rehearsal asserts the email count is unchanged.

## Next action

Start **B5.3** in the [booking retrieval and cancellation checklist](build-plan.md#b5--booking-retrieval-and-cancellation): add staff cancellation on a guest's request before showtime start, require and record the reason with the staff actor, and keep it distinct from the guest write in B5.2.
