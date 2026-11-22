---
name: verify-booking-system
description: Verify booking-system changes through the React booking screen, Vite proxy, Hono API, and isolated Postgres database. Use for changes to booking creation, service selection, list persistence, and browser regression checks.
---

# Verify booking system

## Launch

Run from the repository root with Node 24 and both apps' dependencies installed. Install Chromium once with `npm --prefix apps/web exec -- playwright install chromium`. Use a migrated, seeded, dedicated Postgres database named `booking_system_test` and set its URL in `apps/api/.env.test`. The booking spec expects service ID `1`.

Playwright starts its own Hono server on port 3000 and Vite server on port 5173 for the run. The browser reaches Hono through Vite's `/api` proxy. Parallel runs require a checkout or environment with separate ports and data.

## Doctor

From the root, run `npm --prefix apps/web run test:e2e -- --list` to check discovery and the test-database configuration. Confirm ports are free before launching. On Windows, `Get-NetTCPConnection -State Listen -LocalPort 3000,5173 -ErrorAction SilentlyContinue` should return no listeners. Playwright also rejects occupied ports.

## Drive

Read the relevant entry in the [feature map](features/README.md). Run the booking journey with the existing spec.

```powershell
npm --prefix apps/web run test:e2e -- --trace on
```

## Evidence

Capture the Playwright pass/fail output and the trace under `apps/web/test-results/`. Open the trace with the web app's Playwright `show-trace` command. The test returns a 503 at the browser HTTP boundary for the first submit and verifies the form and list after the error. The retry goes through Hono and the test confirms persistence after reload and exactly one booking via a read-only API request. For a targeted check beyond the existing spec, record the user action, visible result, and side effect where applicable. Report a missing prerequisite or any untested path in the handoff.

## Cleanup

Playwright stops both servers after the run. Check the ports again if the run was interrupted. The spec writes a synthetic row with a unique `e2e-…@example.com` address into the dedicated test database. The app has no delete route. Keep the trace until the handoff and copy it before running Playwright again if it needs to survive another run.
