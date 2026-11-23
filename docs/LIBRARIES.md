# Installed libraries

## Introduction

The libraries below are already installed in the `package.json` files of [`apps/web`](../apps/web/package.json) and [`apps/api`](../apps/api/package.json). The goal of this document is so the agent knows **what already exists** and uses it instead of reinventing it or adding an alternative — e.g. hand-rolling routing, adding Express, bringing in Axios instead of the current `fetch`, or adding Jest alongside Vitest.

> **Golden rule:** Before adding any dependency or writing a custom solution, check here first. If the library exists, use it the way this project documents. If it does not exist and there is no clear alternative, ask before installing.

Versions were taken from `package.json` when this file was written. For exact library behavior, check the installed version's source with [`opensrc`](ARCHITECTURE.md#source-verification-in-code-review-opensrc).

---

## Quick reference

| Library | Version | Where | When to use it (short version) |
| --- | --- | --- | --- |
| `react` | 19.3.1 | web | Building all UI components. |
| `i18next` / `react-i18next` | ^27.2.4 / ^18.0.3 | web | UI messages, Arabic plurals, and React translation hooks. |
| `i18next-browser-languagedetector` | ^8.3.1 | web | Restores and saves the selected locale in browser storage. |
| `react-dom` | 19.3.1 | web | Rendering the app into the DOM (`main.tsx`). |
| `tailwindcss` | 4.3.5 | web | Tailwind CSS v4 utility styles (CSS-first config, no `tailwind.config.*`). |
| `@tailwindcss/vite` | 4.3.5 | web | Vite plugin that compiles Tailwind v4 CSS. |
| `shadcn` | 4.23.0 | web | shadcn/ui CLI and runtime styles; configured by `components.json`. |
| `@base-ui/react` | 1.9.0 | web | Primitive library behind shadcn components (`base`, not `radix`). |
| `cn` | 0.5.2 | web | `cn()` class-name merger used by generated components. |
| `class-variance-authority` | 0.7.1 | web | `cva` for component variants. |
| `lucide-react` | 1.77.0 | web | Icons for shadcn components. |
| `tw-animate-css` | 1.4.0 | web | Animation utilities imported by the shadcn theme. |
| `@fontsource-variable/geist` | 5.3.0 | web | Geist variable font selected by the shadcn preset. |
| `@tanstack/react-router` | 1.170.46 | web | All routing, loaders, and search params. |
| `@tanstack/react-query` | 5.108.2 | web | All API data: fetching/caching/mutations. |
| `react-hook-form` | 7.92.0 | web | Form state, submission, and errors. |
| `@hookform/resolvers` | 7.0.8 | web | Wiring a Zod schema into the form (`zodResolver`). |
| `zod` | 4.6.7 | web + api | Defining and validating schemas in both apps. |
| `hono` | 4.13.16 | api | Building the API and every route group. |
| `@hono/node-server` | 2.1.3 | api | Running the Hono app on Node. |
| `@hono/zod-validator` | 0.9.1 | api | Validating request bodies with a Zod middleware. |
| `better-auth` | 1.7.27 | api | Staff email/password sign-in, sessions, invitations, and password reset. |
| `@better-auth/drizzle-adapter` | 1.7.27 | api | Drizzle-backed persistence for Better Auth. |
| `drizzle-orm` | 0.45.4 | api | Schema and queries (SELECT/INSERT/...). |
| `@neondatabase/serverless` | 1.2.1 | api | The Neon HTTP connection. |
| `drizzle-kit` | 0.31.11 | api (dev) | Generating/running migrations, `db:push`, `studio`. |
| `vite` | 8.3.6 | web (dev) | Dev server and production build. |
| `@vitejs/plugin-react` | 6.1.2 | web (dev) | React and Fast Refresh support in Vite. |
| `@tanstack/router-plugin` | 1.169.0 | web (dev) | Generating routes and `routeTree.gen.ts`. |
| `@tanstack/devtools*` | 0.8.7–5.108.2 (see §8) | web (dev) | Devtools panels for Query and Router. |
| `typescript` | ~7.0.2 / 7.0.2 | web + api (dev) | Types and typechecking for all code. |
| `oxlint` | 1.90.0 / 1.94.0 | web + api (dev) | Linting instead of ESLint. |
| `react-doctor` | 0.9.23 | web (dev) | Advisory static review for React changes. See the [development workflow](WORKFLOW.md). |
| `vitest` | 5.1.1 | web + api (dev) | All unit and integration tests. |
| `@testing-library/react` | 16.3.3 | web (dev) | Testing React components. |
| `jsdom` | 31.0.1 | web (dev) | DOM environment for Vitest. |
| `@playwright/test` | 1.65.1 | web (dev) | End-to-end tests. |
| `tsx` | 4.23.0 | api (dev) | Running TypeScript scripts (`dev`, `db:seed`, E2E). |
| `dotenv` | 18.0.10 | api (dev) | Loading `.env` / `.env.test`. |
| `@types/*` | — | web + api (dev) | Type definitions for React and Node. |

---

## Details

### A) Web UI — `apps/web`

#### 1. `react` (^19.3.1)

- **What it does:** The UI library. Components live in `src/pages/**` and `src/app/**`.
- **When to use it:** Use the [React feature guide](REACT-FEATURES.md) to choose APIs for components, state, Effects, Actions, transitions, and rendering. API server state goes through TanStack Query (#4), and validated forms use React Hook Form (#5).

#### 2. `react-dom` (^19.3.1)

- **What it does:** Renders the React tree in the browser.
- **In this project:** `src/app/main.tsx` renders the app with `createRoot` and `<StrictMode>`.
- **Rule:** Do not add another rendering library, and do not modify the entry file without a clear reason.

#### 3. `@tanstack/react-router` (^1.170.46)

- **What it does:** Type-safe routing with file-based routes, loaders, and search params.
- **When to use it:** Adding or changing a route in `src/app/routes/`.
- **In this project:** Enabled by `@tanstack/router-plugin` (#9) with `autoCodeSplitting`. `routeTree.gen.ts` is generated — **never edit it by hand**. The router is created in `src/app/router.tsx` and takes the `queryClient` from its context.
- **Rule:** Do not write a custom routing system, and do not add `react-router-dom` alongside it. Full guide in the `tanstack-router` skill.

#### 4. `@tanstack/react-query` (^5.108.2)

- **What it does:** Server-state management: fetching, caching, background refetching, mutations, and Suspense.
- **When to use it:** Any read from or write to the API.
- **In this project:**
  - `queryOptions` are defined in `pages/bookings/api/bookings.queries.ts` and shared between the loader and the component.
  - The loader calls `queryClient.query({ ...options, staleTime: 'static' })`; the component reads with `useSuspenseQuery`.
  - `ensureQueryData` and `prefetchQuery` are **deprecated** — do not use them.
  - An error component must call `useQueryErrorResetBoundary().reset()` and retry via `router.invalidate()` (see `src/app/ui/route-error.tsx`).
- **Rule:** Do not replace it with SWR, Redux Toolkit Query, or `useState` + `fetch`. Full guide in the `tanstack-query` skill.

#### 5. `react-hook-form` (^7.92.0)

- **What it does:** Form state (values, touched, errors, submitting) without excess re-renders.
- **When to use it:** Any form, e.g. `pages/bookings/ui/BookingForm.tsx`.
- **In this project:** We use `useForm<Values, unknown, Output>` with `register`, `handleSubmit`, and `setError('root.serverError', ...)`. The form is reset after the submit transition commits, not inside the handler (see the comment in the file).
- **Rule:** Do not build per-field form state with `useState`, and do not add Formik. Guide in the `react-hook-form` skill.

#### 6. `@hookform/resolvers` (^7.0.8)

- **What it does:** A bridge between validation libraries and React Hook Form.
- **In this project:** Used as `zodResolver(bookingFormSchema)` in `BookingForm.tsx` — Zod is the only supported resolver.
- **Rule:** Do not hand-write a resolver, and do not use `yupResolver`/`joiResolver` (Yup and Joi are not installed).

#### 7. `zod` (^4.6.7 — shared between web and api)

- **What it does:** Defining and validating schemas and inferring types.
- **When to use it:** Form schemas in `pages/bookings/model/booking.ts` and request-body schemas in API routes.
- **In this project:**
  - Use `z.input<typeof schema>` for raw form values and `z.output<typeof schema>` for transformed values.
  - In Zod 4 use the modern APIs: `z.email()`, `z.iso.datetime()`, `z.coerce.number()`, `.pipe()`, `.transform()`.
  - Keep the Zod version in sync across both apps. Film and auditorium forms use the shared request schemas in [`packages/cinema-contracts`](../packages/cinema-contracts/index.js) and derive payload types from them.
- **Rule:** Do not add Yup, Joi, or Valibot, and do not hand-write validation (regex/ if) where Zod can do it. Guide in the `zod` skill.

#### 8. `@tanstack/devtools` + `@tanstack/devtools-vite` + `@tanstack/react-devtools` + `@tanstack/react-query-devtools` + `@tanstack/react-router-devtools`

- **What they do:** One unified devtools panel combining Query and Router during development.
- **Installed versions:** `@tanstack/devtools` 0.17.0, `@tanstack/devtools-vite` 0.8.7, `@tanstack/react-devtools` 0.10.15, `@tanstack/react-query-devtools` 5.108.2, `@tanstack/react-router-devtools` 1.167.4.
- **In this project:**
  - `devtools()` in `vite.config.ts` strips devtools code from the production build.
  - `src/app/providers/app-providers.tsx` mounts `TanStackDevtools` with `ReactQueryDevtoolsPanel` and `TanStackRouterDevtoolsPanel`, visible only when `import.meta.env.MODE === 'development'`.
- **Rule:** Do not add other devtools, and never let devtools code reach production. Guide in the `tanstack-devtools` skill.

### B) API and database — `apps/api`

#### 9. `hono` (^4.13.16)

- **What it does:** The API framework: routing, middleware, validation, and JSON responses.
- **When to use it:** Any new route group in `src/features/<name>`, mounted in `src/app.ts` via `app.route()`.
- **In this project:** `app.ts` defines `AppType = typeof app` and mounts `bookingsRoutes` and `servicesRoutes`.
- **Rule:** Do not use Express, Fastify, or Koa, and do not write raw Node `http` handlers. Full guide in the `hono` skill.

#### 10. `@hono/node-server` (^2.1.3)

- **What it does:** Runs the Hono app (`app.fetch`) on Node.
- **In this project:** Used in `src/index.ts` with `serve(...)` on the port from `PORT` or 3000.
- **Rule:** Do not swap in `@hono/bun` or `@hono/vercel` unless the deployment target changes.

#### 11. `@hono/zod-validator` (^0.9.1)

- **What it does:** Middleware that binds a Zod schema to Hono, validates the request, and exposes the result at `c.req.valid('json')`.
- **In this project:** `bookingsRoutes.post('/', zValidator('json', createBookingSchema), ...)` in `features/bookings/index.ts`.
- **Rule:** Do not hand-write `schema.parse(await c.req.json())` — the middleware gives you types and a 422 automatically.

#### 11a. `better-auth` (^1.7.27) and `@better-auth/drizzle-adapter` (^1.7.27)

- **What they do:** Staff authentication: email/password sign-in, HTTP-only cookie sessions, sign-out, password reset, and the admin plugin used for staff provisioning. The Drizzle adapter stores users, sessions, accounts, and verification tokens in Neon.
- **In this project:** Configured in `apps/api/src/auth.ts` and mounted at `/api/auth/*` in `app.ts`. `src/auth/permissions.ts` defines the `admin` and `operations` roles; `src/auth/middleware.ts` reads the session and guards staff routes. The generated schema lives in `src/db/auth-schema.ts` and is re-exported by `src/db/schema.ts`. The first admin comes from `npm run admin:bootstrap`; later staff are invited by an admin with a 24-hour setup link. `src/features/mail/index.ts` is the local mail adapter until B7.1 adds Resend.
- **Rule:** Do not build hand-rolled sessions, password hashing, or invitation tokens. Regenerate the Drizzle schema with `npx auth@latest generate` after changing auth options or plugins, and include the generated migration. Keep guest bookings account-free.

#### 12. `drizzle-orm` (^0.45.4)

- **What it does:** Type-safe ORM for the schema and queries.
- **When to use it:** Defining tables in `src/db/schema.ts` and `.select()` / `.insert()` queries with `.innerJoin()` and `eq()`.
- **In this project:** We use the `drizzle-orm/neon-http` adapter. All queries live in route groups via `getDb()`.
- **Rule:** Do not write raw SQL with `db.execute(...)` except when necessary, and do not add Prisma or Knex. Guide in the `drizzle` skill.

#### 13. `@neondatabase/serverless` (^1.2.1)

- **What it does:** Neon's official client for Postgres over HTTP (suited to serverless).
- **In this project:** `neon(connectionString)` in `src/db/index.ts` inside `createDatabase()`, with lazy `getDb()` so route tests run without `DATABASE_URL`.
- **Rule:** **Server-only** — never import this package, `drizzle-orm`, or anything from `apps/api/src/db` into `apps/web` (blocked by `no-restricted-imports` in `.oxlintrc.json`). Do not add `pg` or `postgres.js`. Guide in the `neon-postgres` skill.

#### 14. `drizzle-kit` (^0.31.11 — dev)

- **What it does:** Schema tooling: generating and running migrations, `push`, and `studio`.
- **In this project:** `drizzle.config.ts` points at `src/db/schema.ts` and outputs to `drizzle/`. Scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`.
- **Rule:** After any schema change run `npm run db:generate` and commit the generated SQL. Do not hand-write migration files. Guide in the `neon-drizzle` skill.

### C) Build and quality

#### 15. `vite` (^8.3.6 — dev)

- **What it does:** Dev server and production build for `apps/web`.
- **In this project:** `vite.config.ts` has `tanstackRouter()` before `react()`, the `@` alias → `./src`, and a `/api` proxy → `http://localhost:3000` with the prefix stripped (dev only).
- **Rule:** Always use TypeScript config and ESM. Do not add Webpack or Parcel. Guide in the `vite` skill.

#### 16. `@vitejs/plugin-react` (^6.1.2 — dev)

- **What it does:** JSX and Fast Refresh for React inside Vite.
- **Rule:** Follows `vite` — do not swap in `@vitejs/plugin-react-swc` without a reason. Plugin order in `vite.config.ts` matters.

#### 17. `@tanstack/router-plugin` (^1.169.0 — dev)

- **What it does:** Generates the route tree from `src/app/routes/` and performs code splitting.
- **In this project:** Configured in `vite.config.ts`: `target: 'react'`, `autoCodeSplitting: true`, output `src/app/routeTree.gen.ts`.
- **Rule:** Never edit `routeTree.gen.ts` by hand, and do not define routes manually alongside file-based routing.

#### 18. `typescript` (~7.0.2 in web / ^7.0.2 in api — dev)

- **What it does:** Types and typechecking.
- **In this project:** `npm run build` in web runs `tsc -b && vite build`; both apps have a `typecheck` script.
- **Rule:** Keep versions close across apps and write explicit types at feature boundaries. Do not use `any` as a quick fix.

#### 19. `oxlint` (1.90.0 in web / 1.94.0 in api — dev)

- **What it does:** The fast linter — used instead of ESLint.
- **In this project:** Each app has its own `.oxlintrc.json` and `lint` script. `apps/web/.oxlintrc.json` blocks server-only imports in the frontend.
- **Rule:** Do not add ESLint or Prettier as a linter alongside it. See **Import boundaries** in `AGENTS.md`.

#### 20. `tsx` (^4.23.0 — dev)

- **What it does:** Runs TypeScript files directly without a build.
- **In this project:** `npm run dev` and `npm run db:seed` in the API; E2E starts the API with `--import tsx`.
- **Rule:** Do not swap in `ts-node`, and do not write separate JS scripts now that `tsx` exists.

#### 21. `dotenv` (^18.0.10 — dev)

- **What it does:** Loads variables from `.env` / `.env.test` into `process.env`.
- **In this project:** `import 'dotenv/config'` in `src/index.ts` and `drizzle.config.ts`. E2E also uses `node --env-file=.env.test`.
- **Rule:** `DATABASE_URL` stays on the API side only — never in code or in `apps/web`.

### D) Tests

#### 22. `vitest` (^5.1.1 — dev, in both apps)

- **What it does:** The fast test framework, Vitest-API compatible.
- **When to use it:** All unit and integration tests in both apps (`*.test.ts` / `*.test.tsx`).
- **In this project:**
  - `apps/web/vitest.config.ts` merges `vite.config.ts` and sets `environment: 'jsdom'` plus `setupFiles`.
  - API route tests mock `getDb()`, so they **do not need** `DATABASE_URL`.
- **Rule:** Do not add Jest or Mocha. Use `vi.fn()` / `vi.mock()` for Zod, drizzle, and `fetch` mocks. Guide in the `vitest` skill.

#### 23. `@testing-library/react` (^16.3.3 — dev)

- **What it does:** Testing React components from the user's perspective (`render`, `screen`, user-style queries).
- **In this project:** `cleanup()` in `src/test/setup.ts` after each test, plus `window.scrollTo = () => {}` for jsdom.
- **Rule:** Test behavior, not implementation details; do not use Enzyme (not installed).

#### 24. `jsdom` (^31.0.1 — dev)

- **What it does:** A mock DOM environment for Vitest in the web app.
- **Rule:** Follows Vitest — do not swap in happy-dom without a reason.

#### 25. `@playwright/test` (^1.65.1 — dev)

- **What it does:** Real-browser end-to-end tests.
- **In this project:** `playwright.config.ts` starts the API and web servers itself (`webServer`) using `.env.test` on port 5173; specs live in `e2e/*.spec.ts` on Chromium.
- **Rule:** Playwright is for the full flow only (e.g. creating a booking). Do not move unit tests into Playwright. See the `agent-browser` skill for manual/exploratory QA.

### E) Types (dev)

#### 26. `@types/react`, `@types/react-dom`, `@types/node`

- **What they do:** TypeScript definitions for libraries without bundled types.
- **In this project:** `@types/node` is installed in both apps at slightly different versions (24 in web / 26 in api) — this is fine as long as typechecking passes.
- **Rule:** Do not add `@types/*` for a library that ships its own types (e.g. Zod, Hono, TanStack).

### F) Styling — Tailwind CSS v4 + shadcn/ui — `apps/web`

Tailwind and shadcn/ui are installed and initialized in `apps/web` (not at the monorepo root):

- **Config:** `apps/web/components.json` (`style: base-nova`, `base: base` → Base UI primitives, `tailwind.css: src/app/styles/index.css`, `rsc: false`). CSS variables, the `@theme inline` block, dark variant, and `@layer base` live in that same CSS file; there is no `tailwind.config.*`.
- **Vite:** `@tailwindcss/vite` is registered in `vite.config.ts` after `react()`.
- **TypeScript aliases:** `@/*` → `./src/*` is declared in both `tsconfig.app.json` and the root `tsconfig.json` (the shadcn CLI reads the latter). shadcn aliases in `components.json` point at `src/shared`: `@/shared/ui` for components, `@/shared/lib/utils` for `cn`, `@/shared/hooks` for hooks. Generated components land in `src/shared/ui/`, matching the FSD `shared/` layer.
- **Rule:** Add UI with `npx shadcn@latest add <component>` from `apps/web` rather than hand-rolling styled markup. Prefer semantic tokens (`bg-primary`, `text-muted-foreground`) over raw colors, and the component's built-in variants/sizes over custom overrides. `npm run verify` from `apps/web` still lints, typechecks, tests, and builds the app.
- **npm note:** If `npm` 11 reports `EALLOWSCRIPTS` while the shadcn CLI installs dependencies because a user/global `.npmrc` sets `allow-scripts`, run the CLI with a clean `npm_config_userconfig` instead of changing the project's dependencies by hand.

---

## How libraries map to this project's structure

As stated in [`AGENTS.md`](../AGENTS.md): React + Vite in `apps/web`, a Hono API in `apps/api`, and Neon Postgres behind the API.

| Project area | Approved libraries | Do not add an alternative |
| --- | --- | --- |
| `apps/web` UI | `react`, `react-dom`, `@vitejs/plugin-react` | Preact / Solid / custom DOM |
| `apps/web` routing | `@tanstack/react-router`, `@tanstack/router-plugin` | `react-router-dom` / hand-rolled routing |
| `apps/web` server state | `@tanstack/react-query` | SWR / Redux / `fetch` in `useEffect` |
| `apps/web` forms | `react-hook-form`, `@hookform/resolvers`, `zod` | Formik / Yup / per-field `useState` |
| `apps/api` | `hono`, `@hono/node-server`, `@hono/zod-validator` | Express / Fastify / manual validation |
| Staff identity | `better-auth`, `@better-auth/drizzle-adapter` | hand-rolled sessions, password hashing, or JWT auth |
| Database | `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` | Prisma / `pg` / raw SQL |
| Unit tests | `vitest`, `@testing-library/react`, `jsdom` | Jest / Enzyme / happy-dom |
| E2E tests | `@playwright/test` | Cypress / Puppeteer |
| Build and quality | `vite`, `typescript`, `oxlint`, `tsx`, `dotenv` | Webpack / ESLint / ts-node |
| Styling / UI components | `tailwindcss`, `@tailwindcss/vite`, `shadcn`, `@base-ui/react`, `cn` | hand-rolled CSS design systems, Radix or another component library |
| UI animation | React 19.3 built-in `ViewTransition` / `addTransitionType` | third-party animation libraries without a reason |

---

## Note on skills

Libraries and skills are linked: skills come from `.agents/skills` and are catalogued in [`SKILLS.md`](SKILLS.md), while this file is the inventory of **actually installed packages**. For example:

- `tanstack-query` / `tanstack-router` / `vite` / `vitest` / `zod` / `react-hook-form` / `drizzle` → skills explaining **how** to use these libraries.
- `neon-postgres` / `neon-drizzle` → skills for managing the database that `@neondatabase/serverless` and `drizzle-kit` connect to.
- `hono` → skill for the framework used in `apps/api`.
- `agent-browser` → UI QA tool, complementary to `@playwright/test`.
- `react-doctor` → advisory static review of changed React code, run from `apps/web` and in the Web CI job. It complements `npm run verify`; it is not a replacement for lint, typecheck, tests, or build.

A skill being installed does **not** mean its library is installed:

- `shadcn` and `tailwind-design-system` are installed in `apps/web`: `components.json` exists, Tailwind v4 + shadcn components live under `apps/web/src/app/styles/` and `apps/web/src/shared/ui/`. See section F for the setup and rules.
- `vercel-react-view-transitions` needs no new package: React 19.3.1 already ships `<ViewTransition>` and `addTransitionType`. Browser support is Chromium 125+, Firefox 144+, Safari 18.2+, with graceful degradation.
- `vercel-composition-patterns` and `vercel-react-best-practices` are advisory. Their Next.js/SWR/RSC rules do not apply to this React + Vite + TanStack Query app; where they conflict with this repository's conventions, [`AGENTS.md`](../AGENTS.md) and this file win.
