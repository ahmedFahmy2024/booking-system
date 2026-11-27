# Booking system verification map

Use the [verification skill](../SKILL.md) for launch, doctor, evidence, and cleanup. The browser spec and the live claim invariants are separate commands.

- [Cinema booking journey](cinema-booking.md) — catalogue, seat selection, confirmation retry, persistence, and isolated-database claim invariants.
- [Guest booking details](guest-booking-details.md) — private-link read, generic denials, no credential in the DOM, and the live guest-detail path.
- [Guest cancellation](guest-cancellation.md) — explicit write, atomic seat release, two-hour cutoff, idempotent repeat, and cache invalidation.
