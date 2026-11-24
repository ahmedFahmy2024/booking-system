# Cinema seat booking build plan

## Product goal

Build a cinema website where customers browse films, choose a showtime, select specific seats, and confirm a booking. Cinema staff manage films, auditoriums, showtimes, and bookings. The website gives customers the showtime, seat labels, and a booking reference. Booking changes follow the agreed cinema policy.

The existing prototype lists seeded services, accepts a requested date and time, and stores a booking. The cinema journey will use scheduled showtimes and seats instead of a customer-entered time. Use the [progress tracker](progress-tracker.md) for status and evidence, and the [code standards](code-standards.md) and [workflow](WORKFLOW.md) during implementation.

Use the [cinema glossary](../GLOSSARY.md) for the terms in the plan and code.

## Milestones

| ID | Capability | Completion criteria |
| --- | --- | --- |
| B0 | Booking foundation | Select a seeded service, create a booking, and see it after reload. The form preserves input after a simulated failed save, and a successful retry appears in the list. |
| B1 | Cinema booking rules | Confirm checkout, seat reservation, scheduling, and booking-change policies. Record the decisions that affect the first release. |
| B2 | Identity and access | Staff can sign in and manage cinema data. Customers can access their own bookings through the agreed mechanism. The API refuses unauthorized access to another booking or to the staff booking list. |
| B3 | Films, auditoriums, and showtimes | Staff can configure films and seat layouts, schedule and publish showtimes, and avoid conflicting showtimes in the same auditorium. Customers can browse films and published showtimes and read the seat map for their selection. |
| B4 | Seat selection and confirmation | Customers can choose available seats and confirm them together, then see the film, showtime, auditorium, seat labels, and booking reference. Two competing requests for the same showtime and seat cannot both succeed. If any selected seat is unavailable, the request leaves no partial booking. A retry after a lost response follows the agreed retry contract. |
| B5 | Booking retrieval and cancellation | Guests can retrieve and cancel their whole booking within policy. Staff can cancel a booking on request, and admins can cancel a showtime while preserving booking history. |
| B6 | Staff operations | Staff can find bookings by film, showtime, reference, and status, review a show's occupancy, and resolve permitted cases. Significant changes record the actor, time, and outcome. |
| B7 | Communication | The customer can retrieve confirmation and the latest booking details. Deliver any agreed messages and surface failures to staff. Retrying a message leaves the booking unchanged. |
| B8 | Release and operations | Exercise the full journey from publishing a showtime to confirmation and supported changes in a release-like environment. Verify access controls, concurrent seat claims, migration impact, production signals, and backup and recovery. |

Build a first working cinema journey across B2–B4, then expand with B5–B7. Before using real customer data, close the access gap in B2. The current prototype list returns names and emails without an access check.

## Accepted launch scope

- Launch for real customers at one cinema branch with multiple auditoriums.
- Customers book as guests using email and pay at the cinema.
- Staff manage showtimes and bookings. Counter sales are deferred from the first release.
- The customer website starts in Arabic with right-to-left layout. Showtimes and cutoffs use Cairo time and prices are in Egyptian pounds.

## Accepted booking rules

- Show a booking reference on confirmation and email a private link for retrieving or cancelling the booking. The reference alone grants no guest access to booking details.
- Seat selection creates no hold. The first confirmation that successfully claims the selected seats wins. If any requested seat is taken, save none, refresh availability, and let the guest revise the selection.
- A booking defaults to a maximum of six seats. The cinema can change that limit.
- Each showtime has one price per seat. Show the total before confirmation and retain the accepted price on the booking. Seat price tiers are deferred.
- A guest can cancel the whole booking through the private link until two hours before the showtime. An accepted cancellation releases all seats. Changing seats or showtimes requires cancellation and a new booking.
- Online booking closes 15 minutes before the showtime. Seats remain reserved until at least the start of the showtime unless the booking is cancelled. Staff record arrival and at-venue payment. From the showtime start onward, staff can mark an unattended booking as a no-show.

## Accepted operating rules

- Admins manage staff, films, auditoriums, showtimes, and prices. Operations staff can find bookings, record arrival and payment, mark no-shows, and cancel a booking on the guest's request before the showtime starts. Staff cancellations record the actor and reason.
- The guest link allows viewing through seven days after the showtime. Guest cancellation retains its two-hour cutoff. An email failure leaves the booking confirmed. Staff can resend the link to the booking's original email, and the system records delivery status.
- Admins can cancel a showtime with bookings. The system keeps the booking history and notifies affected guests. If the venue changes the time or auditorium after a booking exists, cancel the original showtime and publish a new one. Guests book their seats again.
- Admins enter film data manually and configure seat maps by numbered rows and seats, with aisles and out-of-service seats. Film imports and a drag-and-drop layout editor are deferred.

## Approved implementation decisions

D1–D8 were approved on 2026-11-22. Use them with the launch, booking, and operating rules above and the [permission matrix](permission-matrix.md). Each phase lists the decisions it implements.

### D1 — Staff sign-in and provisioning

- Use Better Auth with Hono, Drizzle, and Neon. Serve the browser and API from the same origin, with auth under `/api/auth` and staff pages under `/staff`. Use secure, HTTP-only session cookies in production. [Hono integration](https://better-auth.com/docs/integrations/hono)
- Bootstrap the first admin using a one-time server command. An admin provisions later staff members and sends a one-time email link to set their password. A link expires after 24 hours. Staff sign in with email and password and can request an email password reset. Guest bookings create no account.
- Check the active staff role on protected API requests. Sign-out, deactivation, and a password reset revoke the relevant sessions. Apply the existing self-removal and last-active-admin rules in the permission matrix within the same write that changes the account.

### D2 — Guest link and checkout access

- Generate an opaque booking reference for customer support. Send a separate, unguessable private credential by email. Store a verifier for that credential and scope it to one booking. It expires exactly seven days after the showtime start.
- Opening the link is read-only. Cancellation requires an explicit confirmation and a write request. Keep the credential out of logs and referrers. Invalid, expired, and wrong-booking credentials get the same generic response.
- Staff resend the same unexpired link to the recorded email. Keep the credential encrypted where it must be recoverable for delivery. A resend never extends expiry. Rate-limit public checkout and guest-link attempts. Use generic responses where an endpoint could reveal private booking data.

### D3 — Films, seat maps, and showtimes

- Admins enter title, duration in minutes, synopsis, and an optional poster URL. Customers browse published upcoming showtimes. Draft and cancelled showtimes cannot accept bookings; an upcoming showtime whose booking window closed can still show its time.
- Build a grid editor for row labels, seat numbers, aisle gaps, and out-of-service seats. Capture the auditorium's layout when publishing a showtime. Edits affect future showtimes. With bookings on a showtime, preserve its auditorium, time, and seat labels throughout its history.
- Schedule in Cairo time and persist the instant as a timezone-aware timestamp. An auditorium is occupied from the showtime start through film duration plus a 15-minute turnaround. The next showtime can start exactly when that interval ends. Enforce overlaps even for simultaneous publish attempts.

### D4 — Booking, prices, and retries

- Guests select seats from one showtime and provide their email. Treat the six-seat default as a configurable cinema-wide maximum. Selection makes no hold. The server confirms only a published showtime before its 15-minute cutoff and claims all selected seats together.
- Store prices in integer piastres and snapshot the confirmed unit price and total. A price or availability conflict returns a clear reason and current details. Keep any seats still available in the selection and require confirmation of the revised total if the price changed.
- Use a stable idempotency key for each confirmation attempt. The same key and payload identify the same booking through a lost response. A reused key with a different payload returns a conflict. Retain successful keys with their bookings. Use a Drizzle Neon connection that supports interactive transactions for operations that require them, and enforce seat and auditorium invariants in Postgres. [Drizzle and Neon](https://orm.drizzle.team/docs/connect-neon)

### D5 — Cancellation, attendance, and venue payments

- Treat the two-hour guest cutoff and the 15-minute online cutoff as closing instants in Cairo time. The action is refused at the exact cutoff and after it. Operations staff can cancel on request before showtime start, with a recorded reason.
- Keep booking status, arrival, and venue payment distinct. Start confirmed, unpaid, and not arrived. Record arrival and payment independently with timestamps and actor attribution. Staff can mark a confirmed booking as a no-show at or after start only when no arrival has been recorded.
- Admins can cancel an upcoming showtime with a reason. In one operation, close bookings for that showtime and cancel its active bookings while preserving history and recorded payments. Staff handle any venue payment adjustments outside the website for this release. Cancellation requests and racing confirmations must leave consistent state.

### D6 — Email delivery

- Use Resend with a verified sender domain in production and a local or test mail adapter for development and CI. Send Arabic confirmations, staff account setup and reset messages, and showtime cancellation emails. [Resend domains](https://resend.com/docs/dashboard/domains/introduction)
- Record outgoing messages durably in Postgres and deliver them after the booking or cancellation commits. Use stable delivery IDs for automatic retries, track delivery status and failures, and let staff trigger a separate resend. An email or retry failure leaves the booking and seats intact. Treat provider acceptance and delivery as different statuses. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)

### D7 — Web behavior and records

- Use Egyptian Arabic and RTL for the initial customer and staff screens. Keep the established i18next page namespaces, existing React/Vite layout, and API identifiers. Treat a seat's physical position and label as auditorium data when rendering the map.
- Use the home page for films and upcoming showtimes, a showtime page for seat selection and checkout, and a guest booking page for retrieval and cancellation. Keep checkout on one page and show a confirmation screen with the reference and venue payment instructions. Show clear empty, sold-out, closed, and failed-request states.
- Build paginated staff booking search and filters by reference, film, showtime, and status. Default to upcoming showtimes. Record staff actions that change a booking, delivery, staff access, or showtime with actor, time, and outcome.
- Use 90 days after showtime as the configurable guest contact retention default. Remove guest email and related link credentials after it expires while keeping non-contact booking history and operational audit records. Confirm the production retention setting with the venue owner before launch.

### D8 — Release and execution defaults

- Target a single always-on Node 24 web service on Render with Neon Postgres. Serve the built Vite app and Hono API on one HTTPS domain. Keep development, staging, and production databases separate. CI verifies changes, and production deploys with an explicit release approval. [Render web services](https://render.com/docs/web-services)
- Verify migration and restore in staging, check readiness and booking and email failures, and keep operational logs free of guest links and contact details. Production domain, sender verification, service credentials, and release approval are provisioning inputs. The code and staging workflows use configuration while those inputs are pending.
- Start each task from its approved decisions. Choose reversible details such as file names, component composition, and query names using the existing [code standards](code-standards.md). Record new decisions with user-visible, access, or data effects in this plan. Escalate only when a new requirement conflicts with approved rules or an external action requires authorization.

## Frontend techniques by phase

Use the [React feature guide](REACT-FEATURES.md) to check browser support, state ownership, and verification for these techniques.

| When | Technique and verification |
| --- | --- |
| [B3.4](#b3--films-auditoriums-and-showtimes) | Use the shared `AsyncSection` for the seat map if its request can resolve independently of the showtime heading. Keep the heading visible on a slow response or a failed map request. Verify loading, section retry, and a warm-cache navigation in Chromium. |
| After [B3.4](#b3--films-auditoriums-and-showtimes), once both screens show the same poster | Prototype a named React `ViewTransition` between the catalogue poster and the showtime page. Verify forward and back navigation, RTL, focus, reduced motion, and an instant fallback when the browser lacks support. Implemented 2026-11-23 with TanStack Router's native `viewTransition` Link prop and a film-scoped `view-transition-name`; React's own `<ViewTransition>` only activates for Suspense reveals here because router commits use an external store. Evidence in `docs/progress-tracker.md#poster-view-transition-and-animation-evidence-2026-11-23-follow-up`. |
| [B6.1](#b6--staff-operations) | Store staff list filters and pagination in TanStack Router search params with `validateSearch` and `loaderDeps`. Include them in the Query key. Keep the current results visible while a replacement loads and verify back, forward, and reload. |
| When an editor has tabs and an unsaved draft must survive switching tabs | Consider React `Activity`. Verify that the draft survives and that Effects clean up while its tab is hidden. |
| When a small, independent form can own its Action state | Consider `useActionState` and `useFormStatus` for the result and submit status. Verify errors, retry, and input preservation. Validated booking and admin forms continue to use React Hook Form and Zod. |
| When an interaction has a reversible, local pending state | Consider `useOptimistic`. Use TanStack Query for shared cached records and show a confirmed seat claim only after the API succeeds. Verify reconciliation on failure. |

## Phase checklists

Mark a task complete when its stated behavior is implemented and its relevant check has passed. Use the [progress tracker](progress-tracker.md) for the result and evidence.

### B0 — Booking foundation

- [x] **B0.1** Build the prototype booking form and list with seeded services, Hono endpoints, and database persistence.
- [x] **B0.2** Add form validation and a retry path that preserves input after a failed save.
- [x] **B0.3** Add a browser scenario for retry and persistence after reload, and establish Web and API verification commands.

### B1 — Cinema booking rules

- [x] **B1.1** Agree on the launch scope, guest checkout, venue payment, Arabic locale, and Cairo time.
- [x] **B1.2** Agree on seat claims, price and seat limits, booking and cancellation cutoffs, and attendance rules.
- [x] **B1.3** Agree on staff permissions, guest-link recovery, showtime cancellation, and manual catalogue and seating administration.
- [x] **B1.4** Record domain terms and the [seat confirmation decision](adr/0001-seat-claims-at-confirmation.md).

### B2 — Identity and access

Applies [D1](#d1--staff-sign-in-and-provisioning) and [D2](#d2--guest-link-and-checkout-access).

- [x] **B2.1** Define the admin and operations permission matrix, including staff provisioning and removal.
- [x] **B2.2** Set up Better Auth with Hono and Drizzle. Implement first-admin bootstrap, staff invitation and password reset, sign-in, sign-out, and sessions. Add a local mail adapter to verify the 24-hour invitation limit and session revocation.
- [x] **B2.3** Enforce permissions in the Hono API, including the booking list. Verify unauthenticated, operations, and admin requests against the matrix.
- [x] **B2.4** Add private booking-link credentials scoped to one booking, valid through seven days after its showtime. Verify invalid, expired, and wrong-booking credentials, and reference-only requests.

### B3 — Films, auditoriums, and showtimes

Applies [D3](#d3--films-seat-maps-and-showtimes) and [D7](#d7--web-behavior-and-records).

- [x] **B3.1** Add the Drizzle schema and migration for films, auditoriums, seats, and showtimes. Rehearse on an isolated database with existing prototype rows and record how they are handled.
- [x] **B3.2** Build admin screens to enter film details and configure numbered seat rows, aisles, and out-of-service seats.
- [x] **B3.3** Add showtime creation, pricing, and publishing with a seating snapshot. Reject overlapping same-auditorium showtimes, including the 15-minute turnaround and simultaneous publish attempts. Allow simultaneous screenings in separate auditoriums.
- [x] **B3.4** Build the public Arabic RTL film catalogue, showtime list with Cairo time, and seat map for a published showtime. Expose labelled seats and availability through keyboard and screen-reader controls.
- [x] **B3.5** Seed an isolated film, auditorium, and showtime for repeatable verification. Exercise the staff publish and customer browse paths, including a showtime with no available seats.

### B4 — Seat selection and confirmation

Applies [D2](#d2--guest-link-and-checkout-access), [D4](#d4--booking-prices-and-retries), and [D7](#d7--web-behavior-and-records).

- [x] **B4.1** Build multi-seat selection, show the EGP unit price and total, and collect the guest email. Enforce the configured seat limit, defaulting to six. Define the cinema checkout request schema in [`packages/cinema-contracts`](../packages/cinema-contracts/index.js) for the web form and the confirmation API to use. Verified 2026-11-23; evidence in `docs/progress-tracker.md#b41--seat-selection-and-checkout-request-2026-11-23`.
- [x] **B4.2** Claim all seats together at confirmation. Verify the showtime, auditorium, availability, accepted price, quantity, and 15-minute booking cutoff on the server. Verified 2026-11-24; evidence in `docs/progress-tracker.md#b42--atomic-seat-claims-at-confirmation-2026-11-24`.
- [ ] **B4.3** Refresh availability when a seat is taken and keep the available selections. When a price changes before confirmation, show the revised total and ask the guest to confirm it.
- [ ] **B4.4** Persist the quoted price and booking reference. Show the film, showtime, auditorium, seat labels, and venue payment instructions on confirmation.
- [ ] **B4.5** Persist the confirmation idempotency key with the booking. Replay the original outcome for the same request, and return a conflict when the same key is reused with different input.
- [ ] **B4.6** Verify the booking path in Playwright and the seat claims against the isolated database. Cover two competing requests for the same seat, a multi-seat conflict with zero partial writes, and the exact booking cutoff.

### B5 — Booking retrieval and cancellation

Applies [D2](#d2--guest-link-and-checkout-access) and [D5](#d5--cancellation-attendance-and-venue-payments).

- [ ] **B5.1** Build the guest booking-details page and permitted actions behind the private link. Verify that the reference alone reveals no contact details.
- [ ] **B5.2** Add guest cancellation before the two-hour cutoff. Cancel the whole booking and release all seats together. Verify the cutoff and a repeated cancellation.
- [ ] **B5.3** Add staff cancellation on guest request before the showtime starts. Require and record the reason with the staff actor.
- [ ] **B5.4** Add admin showtime cancellation, preserving booking history and blocking new bookings. For time or auditorium changes after bookings exist, direct the admin through cancellation and publishing a new showtime.
- [ ] **B5.5** Verify that a confirmation racing with a showtime cancellation cannot leave an active booking for the cancelled showtime. Connect guest notification delivery in B7.

### B6 — Staff operations

Applies [D5](#d5--cancellation-attendance-and-venue-payments) and [D7](#d7--web-behavior-and-records).

- [ ] **B6.1** Build the paginated staff booking list and detail view, with search by reference, filters by film, showtime and status, and an occupancy view. Default to upcoming showtimes.
- [ ] **B6.2** Record arrivals and at-venue payments independently with timestamps and staff attribution. From showtime start, let staff mark unattended confirmed bookings as no-shows.
- [ ] **B6.3** Record significant staff actions, including actor, time, and outcome. Verify staff workflows and role restrictions through the staff UI and API.

### B7 — Communication

Applies [D2](#d2--guest-link-and-checkout-access) and [D6](#d6--email-delivery).

- [ ] **B7.1** Add a durable mail queue and a Resend production adapter to the mail interface started in B2.2. Send Arabic booking confirmations, staff invitations, and password-reset messages. Keep local or test delivery for development and CI.
- [ ] **B7.2** Notify affected guests after a showtime is cancelled and record the delivery outcome for each.
- [ ] **B7.3** Show delivery status and let staff resend the same unexpired confirmation link to the original email address. Verify that a failed delivery and a resend leave booking, seat state, and link expiry intact.

### B8 — Release and operations

Applies [D7](#d7--web-behavior-and-records) and [D8](#d8--release-and-execution-defaults).

- [ ] **B8.1** Configure the same-origin Node 24 deployment on Render, separate databases, runtime secrets, and the verified sender. Rehearse migrations, backup and restore, and recovery from a failed release.
- [ ] **B8.2** Run the full journey in a release-like environment, from staff publishing a showtime through guest booking, retrieval, cancellation, and staff arrival or payment recording. Verify Arabic layout and keyboard use.
- [ ] **B8.3** Verify the public catalogue, staff and guest access boundaries, simultaneous seat claims, and notification failures before using real customer data.
- [ ] **B8.4** Configure and verify contact-data expiry with the venue owner's production setting. Establish production signals and a response checklist for booking failures and email delivery problems. Record launch verification in the progress tracker.
