# Cinema booking journey (B4.6)

The Playwright spec drives one anonymous Arabic visitor through the current
public journey: catalogue → published showtime → seat selection → confirmation.
It uses the real Vite app, the real Hono API and the isolated Neon database; no
API responses are stubbed.

## Sub-features and checks

- **Set up.** The Playwright API `webServer` runs `npm run seed:booking-e2e`
  before Hono starts, which ensures an active admin in `booking_system_test`.
  The spec signs in through `/api/auth/sign-in/email`, then creates a uniquely
  titled film, a two-seat auditorium and a published showtime through the real
  `/admin/*` routes.
- **Browse.** `/` renders Arabic RTL (`lang="ar-EG"`, `dir="rtl"`) and the
  uniquely titled film card; its `عرض المقاعد` link opens the showtime page.
- **Select and retry.** `A1` is selected with the keyboard and `A2` by click;
  the guest email is entered. The first `POST /api/bookings/confirm` is
  intercepted with a 503 at the browser HTTP boundary. The localized alert
  appears, both seats stay selected and the email is preserved. Clicking confirm
  again falls through to the real API and shows the confirmation card with the
  film, Cairo time, auditorium, frozen seat labels, base64url reference and
  venue-payment instruction.
- **Persist.** Reloading the showtime page shows both seats as booked and
  disabled. A staff `GET /api/bookings` contains exactly one row for the unique
  email; an anonymous request receives 401 `authentication_required`.
- **Claim invariants.** `npm --prefix apps/api run verify:booking-live` drives
  the same Hono route concurrently against the isolated database: competing
  claims, a multi-seat conflict with zero partial writes, the exact 15-minute
  cutoff, concurrent idempotency replay, and the price window. Its JSON output
  is the evidence; the fixture removes itself before and after the run.

## Running it

From the repository root:

```powershell
npm --prefix apps/web run test:e2e -- --trace on
npm --prefix apps/api run verify:booking-live
```

Ports default to API 3000 and web 5173. If 3000 is occupied by an unrelated
service, set `E2E_API_PORT` and `E2E_WEB_PORT` (for example 3100 and 5273); the
Vite dev proxy follows `E2E_API_TARGET` supplied by the Playwright config.
Never point these at a production database — the `.env.test` guard still
requires a database named `booking_system_test`.

## Gotchas

- Each run leaves a synthetic film, auditorium and booking in the isolated
  database; unique stamps keep runs independent. There is no delete route.
- The old service-based B0 journey no longer exists: the home page is the film
  catalogue and `GET /api/bookings` is staff-only.
- Capture the Playwright trace under `apps/web/test-results/` and the rehearsal
  JSON before another run overwrites them.
