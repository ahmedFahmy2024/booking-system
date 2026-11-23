# Booking system web app

The web app uses React and Vite. In development, Vite proxies `/api` requests to the Hono API. See the [architecture reference](../../docs/ARCHITECTURE.md#frontend--api) for proxy configuration.

From `apps/web`, run `npm run dev` to start Vite or `npm run verify` to run lint, type checking, tests, and the production build.

Run `npm run test:ui` for Chromium tests with intercepted API responses. These tests start Vite on port 5187 and need no database. Install Chromium with `npx playwright install chromium` if needed.

Use the [React feature guide](../../docs/REACT-FEATURES.md) to choose React APIs and the [development workflow](../../docs/WORKFLOW.md) to verify behavior changes.
