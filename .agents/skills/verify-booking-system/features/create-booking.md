# Create a booking

A user submits a service, name, email, and date and time to save a booking.

## Sub-features

- Submit a valid booking.
- Show field errors when input is invalid.
- Preserve input when the save fails and let the user retry.

## How to get to it (user POV)

- Open `/` and use the `New booking` form.

## Driving it with Playwright

Run `npm --prefix apps/web run test:e2e -- --trace on` from the repository root. The spec selects `Service`, fills `Customer name`, `Email`, and `Date and time`, then clicks `Create booking`. The first POST returns 503. The spec checks the visible error, preserved fields, and absence of a list entry. The retry goes to Hono and the booking appears.

For changes to validation, submit the form with the affected field invalid and check its visible error. The existing `BookingForm.test.tsx` also exercises form validation.

## Gotchas

- Each successful run writes a synthetic row in the dedicated test database.
