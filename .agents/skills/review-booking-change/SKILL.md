---
name: review-booking-change
description: Review a booking-system diff against acceptance criteria. Use an independent reviewer for booking writes, schema changes, and changes to the web/API contract.
---

# Review booking changes

1. Record the base, changed files, acceptance criteria, and existing verification evidence. For an ordinary change, review the affected path against its criteria and report the result.
2. For a booking write, schema change, or web/API contract change, if delegation is authorized, send the diff, base, and criteria to a reviewer in a fresh context. Ask for file and line references, a concrete failure scenario, and a way to verify each finding. Ask them to cover retries, persistence, backward compatibility, and recovery. If a separate reviewer is unavailable, do a focused pass and report that limitation.
3. Confirm each finding against the code or a focused check before changing the implementation. Re-run the affected gate and record whether the finding was confirmed and fixed.
4. Cap the review and fix cycle at three rounds for the same change. If a blocking issue remains, reassess the approach and report it in the handoff. Summarize the review outcome in the [PR template](../../../.github/pull_request_template.md).
