---
name: takeover-booking-work
description: Save a local checkpoint when booking-system work pauses or moves to another chat, and resume from the actual checkout and verification state.
---

# Take over booking work

## Pause

1. Record the absolute checkout path, branch, and HEAD. Run `git status --short --branch`, then inspect staged, unstaged, and relevant untracked files to distinguish task changes from pre-existing edits. Include the PR URL if one exists.
2. Write `.booking-work/handoffs/<task>.md` using the [checkpoint template](checkpoint.md) and a short task-specific filename. Record the last completed check and its outcome, any check still running, and the next concrete action. Keep credentials, environment values, and customer data out of the note.
3. Give the next chat the absolute checkpoint path. Uncommitted work stays in its checkout, so give the checkout path too. For a separate checkout, direct the next chat to the source checkout or to the branch and commits that actually contain the work.

## Resume

1. Read the named checkpoint. If none was named, inspect `.booking-work/handoffs/` in the current checkout and match by task and branch. If several match, identify the intended checkpoint before editing. Treat the note as a description of prior state and confirm its scope against the current request.
2. Compare the checkpoint with current HEAD, status, diff, and any PR or job status relevant to the next step. Resolve discrepancies before editing the affected files. Preserve changes made since the checkpoint.
3. Repeat the closest relevant completed check if it is safe to rerun. For a write-heavy or external check, inspect its last evidence and choose a safe test entry point. Continue from the first unmet acceptance criterion and update the checkpoint if work pauses again.
