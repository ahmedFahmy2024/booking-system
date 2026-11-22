# Cinema seat booking progress tracker

Status follows the [build plan](build-plan.md). Update this file when a slice is accepted, its verification changes, or a decision unblocks the next slice.

## Milestones

| ID | Status | Current state |
| --- | --- | --- |
| B0 | Implemented | The generic prototype has a booking form and list, a service catalogue, Hono endpoints, and a Drizzle migration. It saves a service and a requested time. |
| B1 | Complete | The user approved the launch scope, booking rules, and operating policies. The [phase checklists](build-plan.md#phase-checklists) are ready for implementation. |
| B2 | Next | Staff sign-in, customer booking access, and API authorization. The prototype list exposes contact details without an access check. |
| B3 | Planned | Film catalogue, auditoriums, seats, published showtimes, and seat-map reads. |
| B4 | Planned | Multi-seat booking and confirmation, atomic seat claims, and retry behavior. B0 covers only generic booking persistence. |
| B5 | Planned | Guest booking retrieval, guest and staff cancellation, and admin showtime cancellation. |
| B6 | Planned | Show occupancy and staff booking management, including an activity record. |
| B7 | Planned | Confirmation and change communication through agreed channels. |
| B8 | Planned | End-to-end release verification, deployment, monitoring, and recovery. |

## Evidence

| Area | Evidence | Scope and latest check |
| --- | --- | --- |
| Web | `npm --prefix apps/web run verify` | Passed locally on 2026-11-22, including five Vitest tests. |
| API | `npm --prefix apps/api run verify` | Passed locally on 2026-11-22, including four Vitest tests. The route suite mocks the database. |
| Booking journey | [Playwright scenario](../apps/web/e2e/booking.spec.ts) | Covers a simulated failure before the write, a successful retry, and one matching booking after reload. Test discovery passed on 2026-11-22. Live browser execution was outside this baseline check. |
| Delivery workflow | [CI](../.github/workflows/ci.yml) and [workflow](WORKFLOW.md) | Web and API checks, advisory React Doctor on PRs, and an on-demand Playwright job using an isolated test database. |

## Next action

Start **B2.1** in the [identity and access checklist](build-plan.md#b2--identity-and-access). Establish the admin and operations permission matrix before implementing staff sign-in and protecting booking data.
