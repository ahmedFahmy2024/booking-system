# Booking system code standards

Read the [architecture reference](ARCHITECTURE.md) for file placement and imports, the [dependency inventory](LIBRARIES.md) for library choices, and the [workflow](WORKFLOW.md) for verification and handoff.

## Web

- Load [Feature-Sliced Design](../.agents/skills/feature-sliced-design/SKILL.md) before placing code for a new screen or changing slice boundaries. Route files compose the screen through its public entry point. Put screen-specific UI, state, and requests in its page slice. Extract a focused module when it has multiple current consumers and an independent reason to change.
- Keep server state in TanStack Query. Reuse the page query keys and options from its loader, components, and mutations. After a successful mutation, refresh affected queries and preserve the existing route error and retry behavior.
- Use React Hook Form and Zod for forms. Derive raw and parsed form types from the schema. Give fields accessible labels and preserve the user's input when a request fails. Verify visible behavior through the relevant form or browser path.
- Use `useTranslation` for UI text and user-facing errors. The [i18next bootstrap](../apps/web/src/app/providers/locale/i18n.ts) initializes the app instance once and restores the saved language. Keep messages in named namespaces. Format showtimes with `Africa/Cairo` and prices with `EGP` through `Intl`. Render domain data such as film titles and seat labels from the API.

## API and storage

- Keep Hono route groups under `apps/api/src/features/` and mount them in `app.ts`. Use Zod to parse request data before database work. Preserve the response fields and status codes existing clients rely on unless the task changes the contract.
- Keep Drizzle, Neon, and `DATABASE_URL` on the API side. Return only fields the caller needs and enforce access and data scope server-side when introducing restricted resources.
- Use timezone-aware timestamps for instants. Convert at the boundary and document which time zone defines a business rule when adding scheduling. Represent retries, conflicts, and other expected failures deliberately in the API contract.
- Include the generated migration when changing the schema. Consider existing rows and what reverting application code means for rows already written. If an invariant must survive concurrent writes, enforce it at the storage or transaction boundary and verify it against the database.

## Cinema booking rules

- Model film, auditorium, seat, showtime, and booking separately. Identify a seat by a stable ID and scope a seat claim to its showtime. Verify that each requested seat belongs to the showtime's auditorium.
- Compute seat availability from the same rules used at confirmation. Claim all selected seats atomically at the storage boundary. Exercise two concurrent claims for the same seat against the database, and verify that a failed multi-seat request leaves no partial booking.
- Keep seat maps operable by keyboard and expose each seat's label and selection or availability state without relying on color alone.
- Define allowed booking state transitions and actors before adding changes. Apply reservation effects atomically and preserve the original claim if a supported change fails. When temporary holds are part of checkout, define expiry and its effect on both reads and writes.
- Keep communication delivery separate from the stored booking state. Verify what a retry does at each boundary, including the case where a write succeeded and the client did not receive its response.

## Types and evidence

- Parse untrusted network or configuration data at the boundary. Derive types from the authoritative schema where practical. Model distinct outcomes explicitly when callers need to handle them differently.
- Read immediate callers before changing a shared contract. Reuse existing behavior and helpers where they satisfy the requirement, and name types and files for their domain role.
- Test the affected behavior through its normal entry point. Use the existing Vitest and Playwright coverage when it fits, and add targeted regression coverage when an existing check cannot establish the change. Use the isolated database described in the [verification skill](../.agents/skills/verify-booking-system/SKILL.md) for browser writes.
