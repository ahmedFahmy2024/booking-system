# Booking system — agent rules

This repository contains a React + Vite web app in `apps/web` and a Hono API in `apps/api`. The web app reaches Neon Postgres through the API.

- **Feature or fix.** Start with the acceptance criteria and verification steps in [the development workflow](docs/WORKFLOW.md).
- **Architecture or local setup.** Read [the architecture reference](docs/ARCHITECTURE.md) for slice and import boundaries, web/API integration, database commands, and dependency-source review.
- **Project skills.** Load the relevant [listed skills](docs/SKILLS.md). Check the [dependency inventory](docs/LIBRARIES.md) before adding a library.
- **Booking behavior.** Use [`verify-booking-system`](.agents/skills/verify-booking-system/SKILL.md) for browser evidence.
- **Risk and delivery.** Use [`review-booking-change`](.agents/skills/review-booking-change/SKILL.md) for changes that affect stored data or the web/API contract. Use [`deliver-booking-pr`](.agents/skills/deliver-booking-pr/SKILL.md) when asked to prepare a PR or monitor its CI.
