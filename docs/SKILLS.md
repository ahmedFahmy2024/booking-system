# Available project skills

## Introduction

Project skills live in [`.agents/skills`](../.agents/skills). Each skill is a folder containing a `SKILL.md` (optionally with extra reference files under `references/`, `templates/`, etc.).

The agent loads a skill automatically when the task matches the **description** at the top of its `SKILL.md`. You normally do not need to invoke one by hand — but knowing what each one does and when it loads helps you write clear requests and get the most out of them.

> Note: skill sources and versions are recorded in [`skills-lock.json`](../skills-lock.json).

---

## Quick reference

| Skill | When to use it (short version) |
| --- | --- |
| `agent-browser` | Any browser interaction: open a page, fill a form, click a button, take a screenshot, scrape data, or test a web/Electron app (VS Code, Slack, ...). |
| `drizzle` | Writing or changing Drizzle schemas and queries: tables, indexes, relations, joins, inferred types. |
| `feature-sliced-design` | Organizing frontend structure per FSD v2.1: layers, slices, public APIs, import boundaries, moving code between layers. |
| `hono` | Building Hono apps: routing, middleware, validation, JSX, and testing with Hono CLI. |
| `hono-jsx` | Building UI with `hono/jsx` (pages, layouts, forms) instead of React, with SSR and client components. |
| `hono-void` | Checking and testing Void apps built on Hono (pages, page actions, API routes) with Hono CLI. |
| `neon-drizzle` | Setting up Drizzle on Neon from scratch or adding it to an existing app: install, connection setup, schema generation, migrations. |
| `neon-postgres` | Working with an existing Neon/Lakebase Postgres database: connections, migrations, branching, billing, search (vector/full-text/hybrid). |
| `tanstack-cli` | Scaffolding TanStack Start projects with ready-made integrations and an MCP server (not currently used in this project). |
| `tanstack-config` | Tooling for building, versioning, and publishing JS/TS packages (not used here — we do not publish a package). |
| `tanstack-devtools` | Unified devtools panel for Query, Router, and more, with a Vite plugin and extensible plugins. |
| `tanstack-query` | Server state: fetching, caching, mutations, `queryOptions`, Suspense. |
| `tanstack-router` | Type-safe routing: file-based routes, loaders, search params, integration with TanStack Query. |
| `vite` | Vite configuration: config, plugins, SSR, library builds, and the Vite 8 Rolldown migration. |
| `vitest` | Writing tests with Vitest: API, mocking, coverage, filtering, fixtures. |
| `react-hook-form` | Building and optimizing client-side forms with `useForm`, `useWatch`, `useController`, `useFieldArray`, and validation integration. |
| `zod` | Zod schema validation best practices: type safety, parsing, error handling, `z.infer`. |
| [`verify-booking-system`](../.agents/skills/verify-booking-system/SKILL.md) | Run the booking flow in Playwright and save frontend/API verification evidence. |
| [`review-booking-change`](../.agents/skills/review-booking-change/SKILL.md) | Risk-based review of booking changes; verify findings before fixing them. |
| [`deliver-booking-pr`](../.agents/skills/deliver-booking-pr/SKILL.md) | Prepare the PR description, open a draft when asked, and monitor CI until handoff. |
| [`takeover-booking-work`](../.agents/skills/takeover-booking-work/SKILL.md) | Save a checkpoint or pick up unfinished work from another chat. |
| [`review-booking-workflow`](../.agents/skills/review-booking-workflow/SKILL.md) | Find one reusable workflow improvement after observed rework or a stall. |

---

## Skill details

### 1. `agent-browser`

- **What it does:** A browser automation CLI using Chrome/Chromium over CDP, with accessibility-tree snapshots and `@eN` element refs for reliable interaction.
- **When to use it:**
  - Open a site, navigate, fill a form, click a button, or take a screenshot.
  - Scrape data or test a web app (QA / exploratory / bug hunting).
  - Automate Electron apps such as VS Code, Slack, Discord, Figma, Notion.
  - Check Slack unreads, send messages, or search conversations.
  - Run a browser inside Vercel Sandbox or AWS Bedrock AgentCore.
- **Important:** This file is only a "discovery stub". Before any command, load the real guide from the CLI:
  ```bash
  agent-browser skills get core
  ```
  Specialized guides include `electron`, `slack`, `dogfood`, and `derive-client`.

### 2. `drizzle`

- **What it does:** Style guide for Drizzle schemas and queries (tables, columns, indexes, relations, joins, inferred types).
- **When to use it:**
  - Adding or changing a table/column in the schema.
  - Writing relations, joins, and Drizzle queries.
  - Naming tables and columns consistently with the existing project.
- **Note:** This skill covers **style and shape only**. Publishing and running migrations belongs to `neon-drizzle` / `neon-postgres`. (Its description mentions `db-migrations`, which is not installed here — the local equivalent is `neon-drizzle`.)

### 3. `feature-sliced-design`

- **What it does:** The official Feature-Sliced Design v2.1 methodology for the frontend.
- **When to use it:**
  - Deciding where new code goes (which layer and slice): `app/`, `pages/`, `features/`, `entities/`, `shared/`.
  - Defining a slice's public API and import boundaries (preventing cross-imports).
  - Placing static assets (images, icons, fonts, PDFs).
  - Deciding whether to create or remove an entity, or drop the discouraged `widgets/` layer.
  - Migrating from FSD v2.0 or a non-FSD structure, or integrating FSD with Vite/React Router/Next/Nuxt.
  - Applying common patterns such as authentication, an API layer, Redux, and TanStack Query inside FSD.
- **Golden rule:** "Start simple, extract when needed" — code goes in `pages/` first; extract only when it is used in 2+ places now, has an independent reason to change, and has a focused responsibility.
- **In this project:** We use the minimum `app/` + `pages/` + `shared/`. The bookings screen lives in `pages/bookings` (single consumer); there is no `features/`, `entities/`, `widgets/`, or general `assets` folder. Route files in `app/routes/` are thin adapters delegating to the page through its public API.

### 4. `hono`

- **What it does:** Complete reference for building Hono apps, using Hono CLI for inspection/testing instead of ad-hoc scripts or a dev server.
- **When to use it:**
  - Building a Hono API or app (constructs, routing, middleware, JSX, validation, streaming).
  - When code imports from `hono` or `hono/*`.
  - When the user mentions "Hono" explicitly.
  - Inspecting routes and responses:
    ```bash
    npx hono routes
    npx hono request /path
    npx hono batch -
    npx hono snapshot
    ```

### 5. `hono-jsx`

- **What it does:** Building UI for a Hono app with `hono/jsx` — SSR first, with only the interactive parts shipped to the browser.
- **When to use it:**
  - Creating pages, layouts, forms, or interactive fragments in a Hono project.
  - When `tsconfig` has `"jsxImportSource": "hono/jsx"`, or code imports from `hono/jsx`, `hono/jsx/dom`, `hono/jsx-renderer`, or `vite-ssr-components`.
- **Strict rule:** **No React here** — do not install `react` or `react-dom`, and use `class`, not `className`. (Not applicable in this project, where the frontend is React/Vite.)

### 6. `hono-void`

- **What it does:** Checking and testing Void apps (a Hono-based framework with file-based routes and no entry file).
- **When to use it:**
  - When `package.json` depends on `void`, a `void.config.ts` exists, or the user mentions Void.
  - Testing pages, page actions, and API routes with Hono CLI:
    ```bash
    npx hono routes --exclude /__void
    npx hono request /
    npx hono browse /
    ```
- **Note:** A page-action validation failure returns 200, not 422 — inspect `body.errors`. (Not currently used in this project.)

### 7. `neon-drizzle`

- **What it does:** Full Drizzle-on-Neon setup — installing packages, preparing connection info, configuring the connection, generating the schema, and running migrations. Produces working code that connects immediately.
- **When to use it:**
  - Creating a new Drizzle project (Next.js, Vite, Express, ...).
  - Adding Drizzle to an existing app.
  - Creating or changing a database schema.
  - Solving migration problems.
- **It picks the right guide automatically** based on context: `guides/new-project.md`, `existing-project.md`, `schema-only.md`, or `troubleshooting.md`, and chooses between the HTTP and WebSocket adapters.

### 8. `neon-postgres`

- **What it does:** Best practices for Lakebase Postgres on Neon (the database this project uses).
- **When to use it:**
  - A `DATABASE_URL` is present, or you are working with SQL / schema / inspect / search.
  - Choosing a connection type: pooled for web and serverless, direct for migrations.
  - Managing branches (schema-only branch, reset-from-parent, branch-per-PR).
  - Autoscaling, scale-to-zero, instant restore, read replicas.
  - Reducing billing and egress, or fixing a suspended compute (SQLSTATE 53000 / HTTP 402).
  - Optimizing `SELECT *` and reducing overfetching.
  - Search: vector, full-text, BM25, and hybrid search.
- **Heads-up:** With no `DATABASE_URL` or a new project, the skill falls back to the parent `neon` (not installed here — get it with `neon skills -s neon -y`). Auth goes to `neon-auth` and realtime to `neon-realtime`.

### 9. `tanstack-cli`

- **What it does:** Scaffolding CLI for TanStack Start with 30+ integrations, an MCP server for agents, and custom templates.
- **When to use it:** Creating a new TanStack Start project or preparing a team template.
- **Note:** **Not used in this project** — the frontend is React + Vite, not TanStack Start. For a new scaffold: `npx @tanstack/cli create <name> --integrations tanstack-query,...`.

### 10. `tanstack-config`

- **What it does:** Toolkit for building, versioning, and publishing high-quality JS/TS packages.
- **When to use it:** Preparing a package for publication (build, versioning, publishing).
- **Note:** **Not used in this project** — this app is not an npm package.

### 11. `tanstack-devtools`

- **What it does:** A single devtools panel combining Query, Router, and more, with a plugin system and Vite plugin for automatic setup.
- **When to use it:**
  - Inspecting the Query cache and Router state during development.
  - Adding a custom plugin to track application state.
- **In this project:** `@tanstack/react-devtools` exposes two panels: `ReactQueryDevtoolsPanel` and `TanStackRouterDevtoolsPanel`. They appear only in `development`, and `@tanstack/devtools-vite` strips devtools code from the production build.

### 12. `tanstack-query`

- **What it does:** Server-state management (API data): fetching, caching, background refetching, mutations, optimistic updates, pagination/infinite queries.
- **When to use it:**
  - Replacing `useState`/`useEffect` data fetching with `useQuery` / `useSuspenseQuery`.
  - Defining shared query keys and `queryOptions`, and invalidating after mutations.
  - Changing caching strategy (staleTime, gcTime, retry, refetch).
- **Important notes for the current version (verified against source via opensrc):**
  - `queryClient.ensureQueryData` and `queryClient.prefetchQuery` are **deprecated** — use `queryClient.query(options)` and `queryClient.query({ ...options, staleTime: 'static' })` respectively.
  - Use `queryOptions` so the key and fn are shared between `useSuspenseQuery` and the route loader.
  - An error component using suspense must call `useQueryErrorResetBoundary().reset()`.

### 13. `tanstack-router`

- **What it does:** Fully type-safe routing: file-based routes, route loaders, search-param validation, code splitting, and TanStack Query integration.
- **When to use it:**
  - Adding or changing a route or layout in `apps/web/src/app/routes/`.
  - Changing router setup (preloading, scroll restoration, notFound, error components).
  - Integrating the router with Query via router context and loaders.
- **In this project:** File-based routing is enabled via `tanstackRouter()` in `vite.config.ts` (before `react()`), with `autoCodeSplitting: true`. `src/app/routeTree.gen.ts` is generated and must never be edited by hand.
- **Query integration:** The loader calls `queryClient.query({ ...options, staleTime: 'static' })` from context; the component reads the same `queryOptions` via `useSuspenseQuery`.

### 14. `vite`

- **What it does:** Vite setup and configuration — config, plugin API, SSR, library builds, and the Vite 8 migration (Rolldown + Oxc instead of esbuild + Rollup).
- **When to use it:**
  - Editing `vite.config.ts` (e.g. the `@` alias or plugins).
  - Writing a Vite plugin or handling virtual modules and plugin order.
  - Using `import.meta.glob`, `import.meta.env`, asset queries (`?raw`, `?url`), or HMR APIs.
  - Building a library or SSR middleware.
  - Upgrading to Vite 8 and understanding the changes.
- **Preferences:** Always use TypeScript (`vite.config.ts`) and ESM.

### 15. `vitest`

- **What it does:** Fast Vite-powered test framework with a Jest-compatible API, TypeScript and ESM support, and JSX.
- **When to use it:**
  - Unit or integration tests (`test` / `it` / `describe` / `expect`).
  - Mocking, spies, and fake timers via `vi`.
  - Coverage with V8 or Istanbul.
  - Filtering tests by name or tags, and using fixtures with `test.extend`.
  - Type tests (`expectTypeOf`), benchmarks, and multi-project setups.
- **Note:** Vitest shares Vite's config and plugins, so changes to `vite.config.ts` affect tests too.

### 16. `react-hook-form`

- **What it does:** Performance-focused client-side form validation with `useForm`, `useWatch`, `useController`, `useFieldArray`, the `subscribe()` API, and the Watch / FormStateSubscribe / FieldArray render-prop components. Covers RHF 7.82 additions such as `resetDefaultValues()` and the disabled field-array option.
- **When to use it:**
  - Building or optimizing a client-side controlled form (`pages/bookings/ui/BookingForm.tsx`).
  - Choosing between `useWatch` and `useController` to limit re-renders.
  - Integrating validation with Zod via `@hookform/resolvers`.
- **Scope:** Client-side forms only. React 19 Server Actions, `useActionState`, and server-side form handling belong to the `react-19` skill (not installed here).

### 17. `zod`

- **What it does:** Zod schema validation best practices: type safety, parsing, error handling, and `z.infer`.
- **When to use it:**
  - Defining `z.object` schemas, adding validations, and using `safeParse`.
  - Inferring types with `z.infer` / `z.input` / `z.output` at feature boundaries.
  - Writing form schemas (`pages/bookings/model/booking.ts`) and API request schemas.
- **Scope:** Schema definition and validation only. React Hook Form integration belongs to `react-hook-form`; OpenAPI client generation is out of scope.

---

## How skills map to this project's structure

As stated in [`AGENTS.md`](../AGENTS.md): React + Vite in `apps/web`, a Hono API in `apps/api`, and Neon Postgres behind the API. The closest skills per area:

| Project area | Related skills |
| --- | --- |
| `apps/web` (React + Vite) | `vite`, `feature-sliced-design`, `vitest`, `react-hook-form`, `zod`, `agent-browser` for UI testing |
| Frontend routing and server state | `tanstack-router`, `tanstack-query`, `tanstack-devtools` |
| `apps/api` (Hono) | `hono`, plus `drizzle` + `neon-drizzle` + `neon-postgres` for the database layer |
| Database (Neon Postgres) | `neon-postgres` for management and queries, `neon-drizzle` for setup and migrations |
| Testing | `vitest` for unit tests, `agent-browser` for manual/E2E QA, Hono CLI (inside `hono`) for API testing |
| Library usage review | `opensrc` (a tool, not a skill — see the next section) |

`hono-jsx` and `hono-void` are **not used in the current setup**; they load only if the frontend switches from React to `hono/jsx` or we adopt Void. `tanstack-cli` and `tanstack-config` are also unused because we are not scaffolding TanStack Start or publishing a package.

---

## Helper tool: opensrc

`opensrc` is not a skill, but a tool that caches any package's source locally (`~/.opensrc/`) so we can review its implementation and docs rather than only its types. The full rules for code review are in [`AGENTS.md`](../AGENTS.md), under **Source verification in code review (opensrc)**.

```powershell
opensrc path @tanstack/react-query
opensrc path @tanstack/react-router
# if the npm registry lookup fails: opensrc path TanStack/query
```
