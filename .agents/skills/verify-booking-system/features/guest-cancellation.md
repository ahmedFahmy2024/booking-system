# Guest cancellation (B5.2)

The private link is a bearer credential, so a cancellation is an explicit write with a deliberate confirmation step. The page is still read-only until the guest confirms; the reference alone grants nothing.

## Sub-features and checks

- **API write.** `POST /guest/bookings/:reference/cancel` accepts the credential in an `X-Guest-Token` header, never in the URL. A valid unexpired credential for the same booking changes `bookings.status` to `cancelled`, sets `cancelled_at` and deletes every `booking_seats` row for that booking in one `db.batch` (one Neon transaction). Missing, invalid, expired, wrong-booking and reference-only attempts all receive the identical `404 { error: 'guest_link_invalid' }`; at or after the two-hour closing instant the response is `409 { error: 'cancellation_closed' }`. A repeat of an accepted cancellation is an idempotent 200 with no second write.
- **Web page.** The Arabic RTL page offers a two-step confirmation only while `status === 'confirmed'` and `canCancel` is true. A success invalidates the pinned detail query (the loader uses `staleTime: 'static'`) and the shared `showtime` query root so the seat map refreshes. Failures show localized codes only; the raw error may contain the private URL and is never rendered. The token is never in the DOM, a link target, a Referer or a console log.
- **Live path.** `npm --prefix apps/api run verify:booking-live` cancels a real fixture booking against the isolated database, asserts the stored status and zero claims, checks the seat map reports the seat available again, repeats the write for an identical body, and verifies the cutoff and reference-only denials. The fixture uses its own auditorium so it cannot overlap the B4.6 showtimes. The credential travels in a header and is never printed.

## Running it

```powershell
npm --prefix apps/web run test:ui        # stubbed Chromium cancellation scenarios
npm --prefix apps/api run verify:booking-live
```

Migration `0009_calm_roxanne_simpson.sql` must be applied to the isolated database before the live rehearsal.

## Gotchas

- The mutation invalidates the detail query; a stubbed browser test must return the cancelled shape on the refetch or it will look as if the cancellation did not render.
- `X-Guest-Token` is deliberately not the query form used by the read link. Do not move the credential back into the URL: access logs and history would retain it.
- The two-hour cutoff is measured from the stored showtime instant, matching the 15-minute checkout rule; exact-boundary cases use a controlled clock in Vitest because real elapsed time makes a live exact-boundary assertion unreliable.
- Guest self-cancellation records no actor or reason; staff cancellation with an actor and reason is [B5.3](staff-cancellation.md).
