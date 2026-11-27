# Staff cancellation (B5.3)

A staff member cancels a whole booking on the guest's request before the showtime starts. Unlike the guest link, this is a staff-authenticated write with a mandatory reason and a recorded actor.

## Sub-features and checks

- **API write.** `POST /bookings/:id/cancel` requires an active `admin`/`operations` session and a JSON body `{ reason }` (trimmed, 1–500 characters). The booking's stored (or frozen) showtime instant is the cutoff: one millisecond before start succeeds; at and after start returns `409 { error: 'showtime_started' }`. A successful write sets `status = 'cancelled'`, `cancelled_at`, `cancelled_by_user_id` and `cancellation_reason`, and deletes every claim for the booking in one `db.batch` (one Neon transaction). The response is a fixed field set with no guest credential and no contact detail.
- **Idempotency and races.** Repeating a cancellation returns the original stored actor, reason and timestamp byte-identically without a second write. A compare-and-swap `WHERE status = 'confirmed'` arbitrates against a guest cancellation or another staff member; a losing request re-reads and reports the winner's outcome rather than overwriting its attribution.
- **Live path.** `npm --prefix apps/api run verify:booking-live` signs in the isolated-only admin and operations staff, cancels real fixture bookings, asserts the stored actor/reason/timestamp and zero claims, checks the seat map, retries with a different reason, checks a started showtime is refused, and races cancellations by two **different** staff members so an actor overwrite would be detected. The fixture and its extra past showtime are removed after the run.

## Running it

```powershell
npm --prefix apps/api run seed:booking-e2e   # isolated-only staff account prerequisite
npm --prefix apps/api run verify:booking-live
```

Migrations through `0010_colorful_brother_voodoo.sql` must be applied to the isolated database before the live rehearsal.

## Gotchas

- The staff cutoff is the showtime start, not the guest's two-hour cutoff; staff can cancel inside the last two hours.
- `cancelled_by_user_id` is the Better Auth user id from the session; staff are deactivated rather than deleted, so attribution survives deactivation. The FK uses `ON DELETE SET NULL` only as an out-of-band safety valve.
- No email is sent by this route: notification delivery is B7. A code-only revert is safe only before any cancellation has been accepted; after an accepted cancellation, restoring an active booking also requires rebuilding its claims from `idempotencyResponse.seatIds` or rebooking.
- B6.1 will add the staff booking list/detail screen that exposes this action; there is no browser UI to exercise here.
