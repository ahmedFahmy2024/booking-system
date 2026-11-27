# Task checkpoint

## Goal and acceptance

- Acceptance criteria in `starting state → action → expected result → evidence` form, with a failure/retry case and preserved boundaries.
- One criterion requires **durable evidence** under `.booking-work/evidence/<task>/`, or states explicitly why no browser or live-database check applies. Console output and `apps/web/test-results/` are not sufficient.

## Checkout and change state

- Checkout, branch, and HEAD
- Task files and pre-existing changes
- PR URL, if opened

## Progress and evidence

- Completed work
- Last verification command and exact outcome
- Evidence paths — durable files in `.booking-work/evidence/<task>/`, cited here and in the progress tracker. Never write "printed above" or `apps/web/test-results/` as the evidence path.
- Running checks, unverified paths, or blockers

## Next action

