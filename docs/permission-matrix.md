# Staff and guest permission matrix

B2.1 defines who may do what before staff sign-in (B2.2), API enforcement (B2.3), and guest booking links (B2.4) are implemented. The matrix follows the accepted booking and operating rules and the approved decisions [D1–D8](build-plan.md#approved-implementation-decisions) in [the build plan](build-plan.md), plus the terms in [the glossary](../GLOSSARY.md). The build plan is authoritative for implementation details; this document is the derived access reference. Anything not listed is denied.

## Actors

| Actor | How they are identified | Scope |
| --- | --- | --- |
| Public visitor | No credential | Public catalogue and guest checkout only |
| Guest link holder | A valid private link for one booking | One booking; view and permitted cancellation |
| Operations staff | Staff session with the `operations` role | Existing bookings, arrivals, payments, no-shows |
| Admin | Staff session with the `admin` role | Staff, catalogue, seating, showtimes, prices, plus operations |

An admin also holds the operations capabilities. There are no custom roles in the first release.

## Matrix

`Allow` means the API permits the action for this actor; `Deny` means the API refuses it. UI hiding is not access control.

| Capability | Public visitor | Guest link holder | Operations staff | Admin |
| --- | --- | --- | --- | --- |
| Browse films and published showtimes | Allow | Allow | Allow | Allow |
| Read a published showtime's seat map and availability | Allow | Allow | Allow | Allow |
| Create a booking as a guest (email and seats) | Allow | Allow | Allow | Allow |
| View own booking through the private link | Deny | Allow through 7 days after the showtime | Deny via link; use staff view | Deny via link; use staff view |
| Cancel own whole booking through the link | Deny | Allow until 2 hours before the showtime | Deny via link | Deny via link |
| Sign in, sign out, and maintain a staff session | Sign-in endpoint only | Deny | Allow | Allow |
| View the staff booking list, search, filters, and occupancy | Deny | Deny | Allow | Allow |
| View a booking's staff detail view | Deny | Deny | Allow | Allow |
| Record arrival and at-venue payment | Deny | Deny | Allow | Allow |
| Mark an unattended booking as a no-show from showtime start | Deny | Deny | Allow | Allow |
| Cancel a booking on the guest's request before showtime start, with actor and reason | Deny | Deny | Allow | Allow |
| View delivery status and resend the confirmation link to the original email | Deny | Deny | Allow | Allow |
| List and provision staff; assign or change role; deactivate or reactivate staff | Deny | Deny | Deny | Allow |
| Enter and change film data | Deny | Deny | Deny | Allow |
| Create auditoriums and configure seat maps (numbered rows, seats, aisles, out-of-service seats) | Deny | Deny | Deny | Allow |
| Create, price, and publish showtimes; change a price | Deny | Deny | Deny | Allow |
| Cancel a showtime with bookings, preserve history, and notify guests | Deny | Deny | Deny | Allow |
| Change the time or auditorium of a showtime that already has bookings | Deny | Deny | Deny | Deny — cancel the original showtime and publish a new one |
| Film imports and drag-and-drop seat editor | Out of scope for the first release | Out of scope | Out of scope | Out of scope |

A booking reference alone is not a credential. Staff may search by reference inside the staff area; a guest who only knows the reference gets no details.

## Staff provisioning and removal

- Only an admin provisions staff and assigns exactly one role, `admin` or `operations`. There is no self-service staff sign-up.
- Bootstrap the first admin using a one-time server command. For later staff, an admin creates the account with an email and role. The staff member chooses a password through a one-time email invitation that expires after 24 hours. Use Better Auth for email-and-password sign-in and password reset. [Approved sign-in decision](build-plan.md#d1--staff-sign-in-and-provisioning)
- A role change takes effect on the next request. Sessions must be re-evaluated or revoked when a role changes.
- Password reset revokes existing sessions. Sign-out revokes the current session.
- Removal is **deactivation, not deletion**, so the actor recorded on significant staff actions (B6.3) stays attributable. Deactivation revokes existing sessions immediately, prevents new sign-ins, records the time and the acting admin, and keeps the staff record. An admin may reactivate a staff member.
- An admin cannot deactivate or downgrade themselves, and cannot deactivate or downgrade the last active admin. A rejected deactivation leaves the record and sessions unchanged.
- Guest booking links are independent of staff accounts. Deactivating staff does not change bookings, seats, or guest links.
- **Invariant and recovery:** the last-active-admin rule is enforced at both the API and the Postgres boundary (`drizzle/0002_enforce_last_active_admin.sql`), and deactivated accounts are rejected by the API middleware even if session revocation fails. If an incident still leaves no active admin, an operator with direct Neon access can reactivate one with `UPDATE "user" SET banned = false, ban_reason = NULL WHERE id = '<admin-id>' AND role = 'admin';` on the direct (non-pooled) connection, then record the actor, time, and reason in the activity log (B6.3).

## Enforcement

- Default deny. Every protected API route checks the role on the server and scopes data to the actor (B2.3). A request with no session returns 401; a request with the wrong role returns 403. Neither response includes booking fields. This closes the current `GET /bookings` contact-detail exposure.
- The guest booking link is a bearer secret scoped to one booking and valid through seven days after its showtime (B2.4). Invalid, expired, and wrong-booking links receive the same generic denial so a caller cannot probe which bookings exist.
- Staff resends reuse the unexpired link and go to the booking's original email. A resend does not extend expiry. [Approved link decision](build-plan.md#d2--guest-link-and-checkout-access)
- Guest cancellation keeps the two-hour cutoff. A failed email delivery leaves the booking confirmed and does not grant extra access.
- Significant staff actions record actor, time, and outcome (B6.3); staff cancellations also record the reason.

## B2.1 acceptance criteria and evidence

| ID | Starting state → action → expected result | Evidence |
| --- | --- | --- |
| AC1 | No canonical permissions and `GET /bookings` exposes contact details → open this document → every B2–B7 capability has an explicit actor decision and default deny is stated. | This file, checked against the build plan's accepted rules. |
| AC2 | Matrix published → compare the operations row with the accepted operating rules → operations can find bookings, record arrival and payment, mark no-shows, cancel on request before start, and resend the link, but cannot manage staff, films, auditoriums, showtimes, prices, or cancel a showtime. | This file; API role tests in B2.3. |
| AC3 | A staff member has audit entries → admin deactivates them → no hard delete, sessions revoked, audit attribution kept, last-admin guard enforced; a rejected deactivation changes nothing. | Staff provisioning and removal section; sign-in and role tests in B2.2/B2.3, audit checks in B6.3. |
| AC4 | Only a booking reference is known, then an invalid link → request booking details → no contact details for the reference, generic denial for the invalid link, and the valid link works through seven days after the showtime. | Guest link section; verification in B2.4 and B5.1. |

**Boundaries preserved:** the accepted booking and operating rules in `build-plan.md`, the terms in `GLOSSARY.md`, and the existing prototype behavior until B2.2–B2.4 implement this matrix. B2.1 changes documentation only; no application code or verification commands change.
