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

- [ ] **B2.1** Define the admin and operations permission matrix, including staff provisioning and removal.
- [ ] **B2.2** Add staff sign-in, sign-out, and session handling for the staff area.
- [ ] **B2.3** Enforce permissions in the Hono API, including the booking list. Verify unauthenticated, operations, and admin requests against the matrix.
- [ ] **B2.4** Add private booking-link credentials scoped to one booking, valid through seven days after its showtime. Verify invalid, expired, and wrong-booking credentials, and reference-only requests.

### B3 — Films, auditoriums, and showtimes

- [ ] **B3.1** Add the Drizzle schema and migration for films, auditoriums, seats, and showtimes. Rehearse on an isolated database with existing prototype rows and record how they are handled.
- [ ] **B3.2** Build admin screens to enter film details and configure numbered seat rows, aisles, and out-of-service seats.
- [ ] **B3.3** Add showtime creation, pricing, and publishing. Reject overlapping showtimes in one auditorium, including simultaneous admin submissions. Allow screenings in different auditoriums at the same time.
- [ ] **B3.4** Build the public Arabic RTL film catalogue, showtime list with Cairo time, and seat map for a published showtime. Expose labelled seats and availability through keyboard and screen-reader controls.
- [ ] **B3.5** Seed an isolated film, auditorium, and showtime for repeatable verification. Exercise the staff publish and customer browse paths, including a showtime with no available seats.

### B4 — Seat selection and confirmation

- [ ] **B4.1** Build multi-seat selection, show the EGP unit price and total, and collect the guest email. Enforce the configured seat limit, defaulting to six.
- [ ] **B4.2** Claim all seats together at confirmation. Verify the showtime, auditorium, availability, accepted price, quantity, and 15-minute booking cutoff on the server.
- [ ] **B4.3** Refresh availability when a seat is taken and keep the available selections. When a price changes before confirmation, show the revised total and ask the guest to confirm it.
- [ ] **B4.4** Persist the quoted price and booking reference. Show the film, showtime, auditorium, seat labels, and venue payment instructions on confirmation.
- [ ] **B4.5** Make retrying the same confirmation after a lost response return the original outcome without creating a second booking.
- [ ] **B4.6** Verify the booking path in Playwright and the seat claims against the isolated database. Cover two competing requests for the same seat, a multi-seat conflict with zero partial writes, and the exact booking cutoff.

### B5 — Booking retrieval and cancellation

- [ ] **B5.1** Build the guest booking-details page and permitted actions behind the private link. Verify that the reference alone reveals no contact details.
- [ ] **B5.2** Add guest cancellation before the two-hour cutoff. Cancel the whole booking and release all seats together. Verify the cutoff and a repeated cancellation.
- [ ] **B5.3** Add staff cancellation on guest request before the showtime starts. Require and record the reason with the staff actor.
- [ ] **B5.4** Add admin showtime cancellation, preserving booking history and blocking new bookings. For time or auditorium changes after bookings exist, direct the admin through cancellation and publishing a new showtime.
- [ ] **B5.5** Verify that a confirmation racing with a showtime cancellation cannot leave an active booking for the cancelled showtime. Connect guest notification delivery in B7.

### B6 — Staff operations

- [ ] **B6.1** Build the staff booking list and detail view, with search by reference, filters by film, showtime and status, and an occupancy view.
- [ ] **B6.2** Let operations staff record arrivals and at-venue payments. From showtime start, let staff mark unattended bookings as no-shows.
- [ ] **B6.3** Record significant staff actions, including actor, time, and outcome. Verify staff workflows and role restrictions through the staff UI and API.

### B7 — Communication

- [ ] **B7.1** Send confirmation email with the booking reference and private link after a booking commits.
- [ ] **B7.2** Notify affected guests after a showtime is cancelled and record the delivery outcome for each.
- [ ] **B7.3** Let staff see delivery status and resend confirmation to the original email address. Verify that failed email delivery and a resend leave booking and seat state intact.

### B8 — Release and operations

- [ ] **B8.1** Configure production secrets, database, and sender settings. Rehearse migrations, backup and restore, and recovery from a failed release.
- [ ] **B8.2** Run the full journey in a release-like environment, from staff publishing a showtime through guest booking, retrieval, cancellation, and staff arrival or payment recording. Verify Arabic layout and keyboard use.
- [ ] **B8.3** Verify the public catalogue, staff and guest access boundaries, simultaneous seat claims, and notification failures before using real customer data.
- [ ] **B8.4** Establish production signals and a response checklist for booking failures and email delivery problems. Record launch verification in the progress tracker.
