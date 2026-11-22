# Create a booking

A user submits a service, name, email, and date and time to save a booking.

## Sub-features

- Submit a valid booking.
- Show field errors when input is invalid.
- Preserve input when the save fails and let the user retry.

## How to get to it (user POV)

- Open `/` and use the `حجز جديد` form.

## Driving it with Playwright

Run `npm --prefix apps/web run test:e2e -- --trace on` from the repository root. The spec selects `الخدمة`, fills `اسم العميل`, `البريد الإلكتروني`, and `التاريخ والوقت بتوقيت جهازك`, then clicks `تأكيد الحجز`. The first POST returns 503. The spec checks the Arabic error, preserved fields, and absence of a list entry. The retry goes to Hono and the booking appears with a Cairo time.

For changes to validation, submit the form with the affected field invalid and check its visible error. The existing `BookingForm.test.tsx` also exercises form validation.

## Gotchas

- Each successful run writes a synthetic row in the dedicated test database.
