---
name: verify-booking-system
description: Verify booking-system changes through the React booking screens, Vite proxy, Hono API, and isolated Postgres database. Use for changes to booking creation, seat confirmation, guest-link retrieval, list persistence, and browser regression checks.
---

# Verify booking system

## Launch

Run from the repository root with Node 24 and both apps' dependencies installed. Install Chromium once with `npm --prefix apps/web exec -- playwright install chromium`. Use a dedicated Postgres database named `booking_system_test`, migrated through `0010_colorful_brother_voodoo` (seat claims, idempotency, booking cancellation status and staff cancellation actor/reason), with its pooled URL in `apps/api/.env.test`. Playwright seeds an isolated test admin before starting Hono; the spec creates its own film, auditorium and showtime, so service ID `1` is no longer required. The live staff-cancellation checks also need that isolated-only admin (`npm --prefix apps/api run seed:booking-e2e`).

Playwright starts its own Hono server on port 3000 and Vite server on port 5173 for the run. The browser reaches Hono through Vite's `/api` proxy. If an unrelated service occupies 3000, set `E2E_API_PORT` and `E2E_WEB_PORT` (for example 3100 and 5273); the Vite proxy target follows `E2E_API_TARGET` from the Playwright config. Parallel runs require separate ports and data.

CI also exposes this journey as a manual `workflow_dispatch` job named `Booking flow — Playwright`. It writes `apps/api/.env.test` from the `E2E_DATABASE_URL` repository secret, migrates that dedicated Neon database, runs the spec with `--trace on`, and uploads `apps/web/test-results/` as an artifact. It does not run on push or pull request.

## Doctor

From the root, run `npm --prefix apps/web run test:e2e -- --list` to check discovery and the test-database configuration. Confirm the chosen ports are free before launching. On Windows, `Get-NetTCPConnection -State Listen -LocalPort 3000,5173 -ErrorAction SilentlyContinue` should return no listeners (or use the overridden ports). Playwright also rejects occupied ports.

## Drive

Read the [feature map](features/README.md). The browser journey and the live claim invariants are separate commands:

```powershell
npm --prefix apps/web run test:e2e -- --trace on
npm --prefix apps/api run verify:booking-live
```

For stubbed browser checks of individual screens (including the guest booking page), use `npm --prefix apps/web run test:ui`; see the [feature map](features/README.md).

The rehearsal drives the real confirmation route against the isolated database for competing seats, multi-seat conflicts, the exact cutoff, concurrent idempotency replay and the price window; it removes its fixture before and after the run and prints only a JSON summary.

## Evidence

Capture the Playwright pass/fail output and the trace under `apps/web/test-results/`, and the rehearsal JSON. **Immediately after each run, copy the artifacts that must survive into `.booking-work/evidence/<task>/`** (for example `playwright-run.log`, `playwright-trace.zip`, `live-rehearsal.json`, screenshots and axe JSON) and cite those durable paths in the task checkpoint and progress tracker. `apps/web/test-results/` is overwritten by later Playwright runs and console output is ephemeral — neither counts as durable evidence. If a task ran no browser check or no live rehearsal, state that explicitly in the handoff with the reason instead of leaving the evidence section blank.

Open the trace with the web app's Playwright `show-trace` command. The browser test returns a 503 at the HTTP boundary for the first confirm and verifies that the seats and email survive; the retry goes through Hono, and a staff list read confirms exactly one matching booking while an anonymous read is denied. For a targeted check beyond the existing spec, record the user action, visible result, and side effect where applicable. Report a missing prerequisite or any untested path in the handoff.

## Cleanup

Playwright stops both servers after the run. Check the ports again if the run was interrupted. The spec leaves a synthetic `e2e-b46-…@example.com` booking with its film, auditorium and showtime in the dedicated test database; there is no delete route. The rehearsal removes its own fixture and leaves prototype rows untouched. The trace and rehearsal JSON are kept in `.booking-work/evidence/<task>/`, so copy them there before running Playwright or the rehearsal again — the next run replaces `apps/web/test-results/`.
