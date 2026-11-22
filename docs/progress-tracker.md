# Cinema seat booking progress tracker

Status follows the [build plan](build-plan.md). Update this file when a slice is accepted, its verification changes, or a decision unblocks the next slice.

## Milestones

| ID | Status | Current state |
| --- | --- | --- |
| B0 | Implemented | The generic prototype has a booking form and list, a service catalogue, Hono endpoints, and a Drizzle migration. It saves a service and a requested time. |
| B1 | Complete | The user approved the launch scope, booking rules, operating policies, and [D1–D8 implementation decisions](build-plan.md#approved-implementation-decisions). |
| B2 | In progress | B2.1 defined the [permission matrix](permission-matrix.md) and B2.2 added Better Auth staff sign-in, sessions, invitations, and password reset. API permission enforcement and guest booking links remain; the prototype list still exposes contact details without an access check. |
| B3 | Partial | Arabic localization and RTL are wired into the current web shell. Film catalogue, auditoriums, seats, published showtimes, and seat-map reads remain. |
| B4 | Planned | Multi-seat booking and confirmation, atomic seat claims, and retry behavior. B0 covers only generic booking persistence. |
| B5 | Planned | Guest booking retrieval, guest and staff cancellation, and admin showtime cancellation. |
| B6 | Planned | Show occupancy and staff booking management, including an activity record. |
| B7 | Planned | Confirmation and change communication through agreed channels. |
| B8 | Planned | End-to-end release verification, deployment, monitoring, and recovery. |

## Evidence

| Area | Evidence | Scope and latest check |
| --- | --- | --- |
| Web | `npm --prefix apps/web run verify` | Passed locally on 2026-11-22, including seven Vitest tests and Arabic locale behavior. |
| API | `npm --prefix apps/api run verify` | Passed locally on 2026-11-22, including four Vitest tests. The route suite mocks the database. |
| Booking journey | [Playwright scenario](../apps/web/e2e/booking.spec.ts) | Passed in Chromium on 2026-11-22 using the isolated database. Covers Arabic RTL, failure before the write, a successful retry, one matching booking after reload, and Cairo time displayed from a UTC browser. |
| Delivery workflow | [CI](../.github/workflows/ci.yml) and [workflow](WORKFLOW.md) | Web and API checks, advisory React Doctor on PRs, and an on-demand Playwright job using an isolated test database. |
| Access policy | [Permission matrix](permission-matrix.md) | B2.1 definition recorded on 2026-11-22. API enforcement and guest link verification are pending B2.3/B2.4. |
| Staff authentication | `npm --prefix apps/api run verify`, `npm --prefix apps/web run verify`, `auth check schema`, Hono CLI, and `npm --prefix apps/api run auth:verify-flow` on the isolated `booking_system_test` Neon database | B2.2 passed on 2026-11-22: 14 API tests, Web verify, `GET /api/auth/ok` 200, schema check, Hono route list, and the live flow (sign-in, 24-hour invite TTL from the stored token, password reset, role guard, deactivation, sign-out, last-admin trigger, concurrent deactivation). Migrations `0001` and `0002` were applied to the isolated database via `db:migrate` with `DATABASE_URL_UNPOOLED`. An independent review found two blocking issues (banned session escape and last-admin race); both were fixed and re-verified live. |

## Next action

Start **B2.3** in the [identity and access checklist](build-plan.md#b2--identity-and-access). Enforce the [permission matrix](permission-matrix.md) in the Hono API, including the booking list, and verify unauthenticated, operations, and admin requests.
