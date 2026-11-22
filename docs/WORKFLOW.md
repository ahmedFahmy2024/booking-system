# Booking system development workflow

## Before implementation

1. Write each acceptance criterion as **starting state → user action or HTTP request → expected result → evidence**. Include the relevant failure or retry case and list the boundaries the change must preserve. Put the criteria in the task or the working PR draft before editing.
2. For a bug, record the failing observation and reproduce it where practical. For performance work, record the exact measurement command, fixture, baseline, and numeric target. Repeat the measurement under the same conditions after the change.
3. Identify the affected paths in the [verification map](../.agents/skills/verify-booking-system/features/README.md). For example, if the first booking POST returns 503, the form keeps its values and the list stays unchanged. A successful retry appears after reload and a fresh API read returns exactly one matching row. The Playwright trace proves the sequence.

## Implement and verify

1. Make the smallest change that satisfies the criteria. For a recurring problem, identify its cause and encode the invariant at the layer that owns it. Re-run the failing case to prove the fix. For example, the Playwright config requires the isolated database and starts dedicated servers, so inherited dev settings cannot redirect the booking test.
2. Start with the checks closest to the change. Before handing off application changes, run the corresponding CI command from the repository root. Run both for changes that cross the web/API boundary.

   ```powershell
   npm --prefix apps/web run verify
   npm --prefix apps/api run verify
   ```

   Each command runs lint, typecheck, Vitest, and build. [GitHub Actions](../.github/workflows/ci.yml) uses the same commands. API route tests mock the database boundary.
3. For changes to booking creation, service selection, or list persistence, run the [Playwright booking flow](../.agents/skills/verify-booking-system/SKILL.md). For other visible changes, exercise the affected behavior in the browser and capture the resulting state. Use traces or screenshots where they clarify the result. The same journey is available as a manual `Booking flow — Playwright` CI job (`workflow_dispatch`); it needs the `E2E_DATABASE_URL` secret pointing at a dedicated Neon database named `booking_system_test` and uploads its trace as an artifact. It is not part of the push/PR checks.
4. For a frontend modernization, follow the [web platform audit](WEB-AUDIT.md) before changing the implementation.
5. For React changes, run React Doctor from the repository root before handoff. Compare against the task's base branch, using `origin/main` when targeting main.

   ```powershell
   npm --prefix apps/web run doctor -- --scope changed --base origin/main --include-untracked
   ```

   Use `npm --prefix apps/web run doctor` for a full baseline. Review confirmed findings and report unresolved ones with their rule and file. The Web CI job uses the PR's base commit to report introduced findings in the job log. Findings are advisory and use the same pinned CLI as local verification.

## Review and handoff

- Review the diff against the criteria. For booking writes, schema, or the web/API contract, run [the risk-based review](../.agents/skills/review-booking-change/SKILL.md).
- Use the [PR template](../.github/pull_request_template.md) to capture the visible result, exact commands and outcomes, evidence paths, and any unverified path. Include recovery for stored-data or deployment changes.
- When asked to prepare or monitor a PR, use [the delivery skill](../.agents/skills/deliver-booking-pr/SKILL.md). The maintainer owns the merge.

## Between sessions

- When work pauses or moves to another chat, save or resume the checkpoint with [the takeover skill](../.agents/skills/takeover-booking-work/SKILL.md).
- After repeated rework, a verification stall, or avoidable user intervention, use [the workflow review](../.agents/skills/review-booking-workflow/SKILL.md) to capture one reusable improvement and how to evaluate it.
