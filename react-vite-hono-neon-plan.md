# React, Vite, Hono, and Neon project plan

Build a React and TypeScript frontend with Vite, a separate Hono API, and Neon Postgres. Start with a single repository, feature-based folders, and Biome for linting and formatting. Use Vitest for component and API tests and Playwright for the first end-to-end flow.

## Codex skills

Install these from the app repository root once it exists. The commands install skills for the project.

```powershell
npx skills add vercel-labs/agent-skills --skill vercel-composition-patterns -a codex
npx skills add antfu/skills --skill vite -a codex
npx skills add honojs/skills --skill hono -a codex
npx skills add antfu/skills --skill vitest -a codex
```

| Skill | Use it for |
| --- | --- |
| `vercel-composition-patterns` | Reusable React components, state ownership, and component APIs. [Skill](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) |
| `vite` | Frontend configuration, aliases, development proxy, and builds. [Skill](https://github.com/antfu/skills/tree/main/skills/vite) |
| `hono` | Routing, middleware, validation, and route testing. [Hono docs](https://hono.dev/docs/agents) |
| `vitest` | Test configuration, fixtures, and mocking. Check examples against the version installed in the app. [Skill](https://github.com/antfu/skills/tree/main/skills/vitest) |

Already available in Codex are `$architect`, `$typescript-best-practices`, `vercel:react-best-practices`, and the `neon-postgres:neon` and `neon-postgres:neon-postgres` skills. Use `$architect` before scaffolding to sketch the module boundaries and API contract. Use the Neon skills for connections, migrations, and branches. [Neon skills](https://github.com/neondatabase/agent-skills)

## Repository structure

```text
apps/
  web/
    src/
      app/        # App entry point, router, and providers
      features/   # Feature UI, hooks, and HTTP calls
      shared/     # Reusable UI and utilities
  api/
    src/
      app.ts      # Creates the Hono app and mounts route groups
      features/   # Feature routes, business logic, and queries
      db/         # Neon connection and database setup
```

Use Bulletproof React as the frontend reference. Keep feature-specific code together, and move code into `shared/` when it has a reusable purpose. Mount Hono route groups with `app.route()`. [Bulletproof React structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) · [Hono best practices](https://hono.dev/docs/guides/best-practices)

If the frontend adopts formal Feature-Sliced Design conventions, add its skill with `npx skills add feature-sliced/skills --skill feature-sliced-design -a codex`. Its pages-first layout starts with `app/`, `pages/`, and `shared/`. [Feature-Sliced Design skill](https://github.com/feature-sliced/skills)

## Import boundaries

- `app/` composes features through explicit public entry points such as `@/features/projects`. A feature owns its internal files and can import from `shared/`. Compose feature-to-feature interactions in `app/` first. `shared/` can use other shared modules and external libraries. [Public entry points](https://feature-sliced.design/docs/reference/public-api)
- Use relative imports inside a feature. Scope `@/` to `apps/web/src` and configure the alias for both Vite and TypeScript. [Vite aliases](https://vite.dev/config/shared-options.html#resolve-alias) · [TypeScript paths](https://www.typescriptlang.org/tsconfig/paths.html)
- React calls Hono over HTTP. If you choose Hono RPC, expose `AppType` through a public entry point and consume it with `import type`. Keep Neon credentials, database drivers, and queries on the API side. [Hono RPC](https://hono.dev/docs/guides/rpc)
- Record these placement and import rules in the app repo’s `AGENTS.md`. Enforce known server-only imports and private import patterns in CI where the linter can express them.

## Linting and CI

Start with Biome for formatting, React Hooks checks, and explicit import restrictions. Scope the web rules to `apps/web` so they can block imports such as `@neondatabase/serverless` there. Run `biome ci .`, a separate TypeScript typecheck for both apps, and `vitest run` in CI. [Biome CI](https://biomejs.dev/recipes/continuous-integration/) · [Biome rule sources](https://biomejs.dev/linter/javascript/sources/) · [Restricted imports](https://biomejs.dev/linter/rules/no-restricted-imports/javascript/)

Choose ESLint upfront if you need React’s official compiler diagnostics or folder boundaries based on where imports resolve across aliases and relative paths. For that setup, use React’s hooks plugin, `typescript-eslint`’s `recommendedTypeChecked`, and `import/no-restricted-paths` with a TypeScript resolver for the directory rules. [React ESLint plugin](https://react.dev/reference/eslint-plugin-react-hooks) · [TypeScript ESLint presets](https://typescript-eslint.com/users/configs/) · [ESLint import zones](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md)

## Testing

| Scope | Tool | First test |
| --- | --- | --- |
| React components | Vitest + React Testing Library | Submit a form and assert that the user sees the validation message. [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) |
| Hono routes | Vitest + `app.request()` | Exercise valid and invalid requests and check the response status and body. [Hono testing](https://hono.dev/docs/guides/testing) |
| End-to-end | Playwright | Create a record through the browser, reload, and verify it persisted through Hono to an isolated test database. [Playwright best practices](https://playwright.dev/docs/best-practices) |

Once Playwright Test is set up, `npx playwright init-agents --loop=codex` is optional for planning and authoring browser tests with Codex. [Playwright Test agents](https://playwright.dev/docs/test-agents)
