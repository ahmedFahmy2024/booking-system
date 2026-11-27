# Guest booking details (B5.1)

The private link emailed at confirmation is the only way an anonymous visitor can read a booking. The reference alone is a support identifier, not a credential.

## Sub-features and checks

- **API detail.** `GET /guest/bookings/:reference?token=…` returns the frozen confirmation outcome (film, showtime, auditorium, seat labels, accepted price and total) only for a valid unexpired credential scoped to that booking. Invalid, expired, wrong-booking and reference-only requests all receive the identical `404 { error: 'guest_link_invalid' }`; reference-only performs no database read. Every branch sets `Cache-Control: no-store` and `Referrer-Policy: no-referrer` and never reflects the token, verifier or ciphertext.
- **Web page.** `/guest/bookings/:reference?token=…` renders an Arabic RTL read-only card with the frozen fields, reference, EGP total and venue-payment note. The token is never rendered or placed in a link, the document asks browsers not to send a Referer, and a denied link shows a generic localized alert with a working retry.
- **Live path.** `npm --prefix apps/api run verify:booking-live` creates a real cinema booking against the isolated database, reads the credential from the in-process mail adapter, exercises the guest detail route, and asserts the reference-only denial. No credential is printed and the fixture removes itself.

## Running it

```powershell
npm --prefix apps/web run test:ui        # stubbed Chromium guest-page scenarios
npm --prefix apps/api run verify:booking-live
```

The stubbed browser spec uses a synthetic token and reference; no live database or real guest link is involved. The live rehearsal requires the isolated `booking_system_test` database from the main verification skill.

## Gotchas

- The query key includes the token so a denied link cannot reuse a successful cached read for the same reference; the router's loader dep carries only a non-reversible fingerprint, so dev-only route-match warnings never print the credential. Devtools are stripped from production bundles.
- The guest fetch sets `referrerPolicy: 'no-referrer'` because the route head commits after the loader starts; the Chromium case asserts no `Referer` carries the token.
- Cancellation is B5.2 ([feature map](guest-cancellation.md)): the page now offers an explicit write and invalidates the pinned query after success; the `staleTime: 'static'` follow-up is closed.
