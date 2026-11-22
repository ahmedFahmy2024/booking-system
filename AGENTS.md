# Booking system — agent rules

This repository contains a React + Vite web app in `apps/web` and a Hono API in `apps/api`. The web app reaches Neon Postgres through the API.

- **Feature or fix.** Check the [approved decisions and phase tasks](docs/build-plan.md#approved-implementation-decisions), then follow [the development workflow](docs/WORKFLOW.md) for acceptance criteria and verification. Use the [progress tracker](docs/progress-tracker.md) to pick up the current task.
- **Architecture or local setup.** Read [the architecture reference](docs/ARCHITECTURE.md) for slice and import boundaries, web/API integration, database commands, and dependency-source review.
- **Project skills.** Load the relevant [listed skills](docs/SKILLS.md). Check the [dependency inventory](docs/LIBRARIES.md) before adding a library.
- **Booking behavior.** Use [`verify-booking-system`](.agents/skills/verify-booking-system/SKILL.md) for browser evidence.
- **Risk and delivery.** Use [`review-booking-change`](.agents/skills/review-booking-change/SKILL.md) for changes that affect stored data or the web/API contract. Use [`deliver-booking-pr`](.agents/skills/deliver-booking-pr/SKILL.md) when asked to prepare a PR or monitor its CI.
- **Handoff and friction.** Use [`takeover-booking-work`](.agents/skills/takeover-booking-work/SKILL.md) when pausing or resuming unfinished work. Use [`review-booking-workflow`](.agents/skills/review-booking-workflow/SKILL.md) after a task with repeated rework, a verification stall, or avoidable user intervention.
