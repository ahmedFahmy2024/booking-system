# Admin showtime cancellation (B5.4/B5.5)

An admin cancels an upcoming showtime with a reason. The showtime status change, the cancellation of every active booking for it and the release of every claim happen in one Neon transaction; booking history and recorded payments are preserved, never deleted.

## Sub-features and checks

- **API write.** `POST /admin/showtimes/:id/cancel` requires an active `admin` session (not operations) and `{ reason }` (trimmed, 1–500 characters). One `db.batch` sets `status = 'cancelled'`, `cancelled_at`, `cancelled_by_user_id` and `cancellation_reason` on the showtime, cancels every `confirmed` booking for that showtime with the same actor/reason/instant, and deletes all claims for the showtime. The frozen `idempotency_response` is untouched, so replay and guest detail keep working. The response is a fixed five-field set with no contact detail or credential.
- **Cutoff and retry.** Only an upcoming showtime can be cancelled: one millisecond before the stored start succeeds; at and after the start returns `409 { error: 'showtime_started' }`. Repeating a cancellation returns the original stored outcome byte-identically, so a lost response is safe to retry.
- **Blocking new bookings.** Public reads and confirmation already require `status = 'published'`. A Postgres trigger now closes the race: before every booking insert with a non-null `showtime_id` it takes `FOR SHARE` on the showtime row and re-reads the committed status, refusing a cancelled or unpublished showtime with SQLSTATE `P0001` and constraint `showtimes_booking_requires_published`. The confirmation route maps that to the generic `404 { error: 'showtime_not_found' }` without sending email.
- **Live path.** `npm --prefix apps/api run verify:booking-live` confirms a booking on a fixture showtime, then cancels it as admin and checks the stored actor/reason/instant, the cancelled booking with preserved history, zero claims, the public read 404, an identical repeat and a blocked fresh-key confirm. It also asserts that the original idempotency key still replays its frozen 201 after cancellation, refuses a started showtime, attempts a direct SQL insert that the trigger must refuse, races a confirmation against a cancellation (zero active bookings), and races two admins with distinct reasons and sessions so one stored actor/reason and byte-identical bodies are required.

## Running it

```powershell
npm --prefix apps/api run seed:booking-e2e   # isolated-only staff accounts prerequisite
npm --prefix apps/api run verify:booking-live
```

Migrations through `0012_showtime_booking_status.sql` must be applied to the isolated database before the live rehearsal.

## Gotchas

- There is no time or auditorium edit route: after bookings exist, the admin cancels the original showtime and publishes a new one. A cancelled showtime releases its auditorium slot through the existing partial exclusion constraint.
- The trigger's `FOR SHARE` serializes booking writes on the showtime row; confirmations for different seats in one showtime share that lock, which is acceptable because seat claims are already arbitrated by a unique index.
- No email is sent by this route: affected-guest notification is B7.2. A code-only revert is safe only before any showtime cancellation has been accepted; afterwards, restoring active bookings requires restoring status/columns and rebuilding claims from `idempotencyResponse.seatIds` or rebooking.
- There is no admin showtime screen yet, so no browser UI exercises this action; the live rehearsal drives the real Hono route.
- Evidence limit: the `P0001` → 404 application mapping is pinned by Vitest with realistic cause-chain shapes, and the live rehearsal proves the trigger raises via a direct SQL insert, but no live request deterministically forces the confirm-after-read/cancel-before-write window. The start cutoff is evaluated at request time, as in staff booking cancellation, not at commit time.
