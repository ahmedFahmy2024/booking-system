---
name: deliver-booking-pr
description: Prepare a booking-system pull request, open an authorized draft, and monitor its GitHub Actions checks while leaving the merge to the maintainer.
---

# Deliver a booking pull request

1. Read the [workflow](../../../docs/WORKFLOW.md). Use the [PR template](../../../.github/pull_request_template.md) to write the title and body locally. Fill it with acceptance criteria, exact verification results, and remaining risks. Review the diff for changes outside the task. Keep this as a local draft when asked to prepare the PR only.
2. When asked to publish, confirm the target repository, compare branch, and base. Check `gh auth status` and use `gh pr view <branch> --repo <owner/repo> --json url,state,body` to find a PR already opened for the branch. For an existing open PR, preserve its unrelated content and use `gh pr edit <url> --body-file <path>` to refresh the evidence when authorized. For a new PR, push only the task branch and run `gh pr create --repo <owner/repo> --draft --base <base> --head <branch> --title "<title>" --body-file <path>`. Check the URL and head branch. Check again for an existing PR before retrying creation after an unclear error.
3. Watch the active PR with `gh pr checks <url> --watch`. If checks have yet to register, check again after a short delay. A pending check remains pending in the handoff. When a check fails, read the failed job with `gh run view <run-id> --repo <owner/repo> --log-failed`, fix confirmed in-scope failures when authorized, and watch the new head. Confirm the Web and API checks on the final head before reporting success. If a manual `Booking flow` run was requested, confirm its outcome and trace artifact as well; a manual-only check may legitimately stay pending, as long as the handoff records that.
4. Return the PR URL, check outcomes, and unresolved findings. Leave the PR at the handoff for the maintainer's merge decision.
