# Staff booking list, detail and occupancy (B6.1)

Staff (`admin` and `operations`) can find bookings without a guest credential. The reference alone is never an access grant; every read goes through `requireStaff` and denies before any database work.

## Sub-features and checks

- **List.** `GET /staff/bookings` accepts `reference` (case-insensitive fragment), `filmId`, `showtimeId`, `status`, `period` (default `upcoming`) and `page`/`pageSize` (default 1/20). It returns `{ items, total, page, pageSize, pageCount }` with a fixed projection: no verifier, ciphertext, token or other credential. Filters are ANDed in SQL, ordering is stable, and an out-of-range page returns an empty slice with the unchanged total.
- **Detail.** `GET /staff/bookings/:id` returns the frozen cinema confirmation (film, Cairo showtime, frozen auditorium, seat labels in request order, accepted prices) with cancellation actor/reason/instant when present, or the unchanged legacy shape for a prototype row. Unknown id is 404; a malformed UUID is 400.
- **Occupancy.** `GET /staff/showtimes/:id/occupancy` counts the frozen layout's seats, out-of-service seats, active claims from `booking_seats`, available seats and the rounded percentage. Cancelled bookings have released claims, so their seats count as available. A draft without a snapshot is 409 `showtime_not_ready`; unknown id is 404.
- **Filters payload.** `GET /staff/bookings/filters` supplies the dropdown values (films and showtimes) to both staff roles.
- **Live path.** `npm --prefix apps/api run verify:booking-live` signs in the isolated staff account, reads a real confirmed booking through list and detail, checks occupancy against its claim, verifies an anonymous read is 401 and a missing id is 404. It uses the isolated `booking_system_test` database and prints no guest link.
- **Browser path.** `npm --prefix apps/web run test:ui -- staff-bookings` drives the Arabic/English screens with a stubbed API on the real Vite proxy: defaults in the URL, back/forward/reload restoration, current rows kept visible during a gated refetch, detail link preserving filters, occupancy panel and a localized not-found retry. No live database or staff session is involved.

## Running it

```powershell
npm --prefix apps/api run seed:booking-e2e   # isolated-only staff account prerequisite
npm --prefix apps/api run verify:booking-live
npm --prefix apps/web run test:ui -- staff-bookings
```

Migrations through `0012_showtime_booking_status.sql` must be applied to the isolated database before the live rehearsal.

## Gotchas

- The web app has no staff sign-in screen or route guard yet (D1's browser portion is out of B6.1); the API rejects anonymous reads with 401 and the route shows a localized error with retry.
- Detail and list share the same validated search schema. The detail route file uses the `bookings_.$bookingId.tsx` name so it is a sibling, not a child, of the list route; its generated route id is `/staff/bookings_/$bookingId` while its URL path is `/staff/bookings/$bookingId`.
- Filters and pagination live in TanStack Router search params, `loaderDeps` and the Query key. Stale rows stay visible through `placeholderData` while a replacement loads.
- No schema change or migration belongs to B6.1. Arrival/payment writes are B6.2 and the activity log is B6.3.
