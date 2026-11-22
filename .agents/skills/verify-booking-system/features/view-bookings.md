# View saved bookings

The booking list shows stored bookings when the page loads.

## Sub-features

- See a new booking after creation.
- See the same booking after a page reload.

## How to get to it (user POV)

- Open `/`. The booking list appears on the same page as the form.

## Driving it with Playwright

Run `npm --prefix apps/web run test:e2e -- --trace on` from the repository root. The spec reloads after creating a booking, checks that the unique email still appears, and looks for that same email in a fresh `GET /api/bookings` response.

## Gotchas

- Match the unique email for the current run. Earlier test rows may still be visible.
