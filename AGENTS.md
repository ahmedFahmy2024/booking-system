# Booking system — agent rules

Single repository. React + Vite frontend in `apps/web`, Hono API in `apps/api`, Neon Postgres behind the API only.

## Layout

```text
apps/web/src/
  app/        # entry point, router, providers — composes features
  features/   # feature UI, hooks, HTTP calls (one folder per feature)
  shared/     # reusable UI and utilities
apps/api/src/
  app.ts      # creates the Hono app and mounts route groups with app.route()
  features/   # route groups, business logic, calls into db/
  db/         # Neon connection, schema, migrations
drizzle/      # generated SQL migrations (apps/api)
```

## Import boundaries

- `@/` is scoped to `apps/web/src` only (configured in `vite.config.ts` and `tsconfig.app.json`). Use `@/features/<name>` only through that feature's public `index.ts`.
- Inside a feature, use relative imports. A feature may import from `shared/`, but never from another feature's internals.
- `app/` composes feature-to-feature interactions first. Move shared code into `shared/` only when it has a genuinely reusable purpose.
- `shared/` may import other shared modules and external libraries, never `app/` or `features/`.
- React reaches Hono over HTTP. Never import `@neondatabase/serverless`, `drizzle-orm`, or anything from `apps/api/src/db` into `apps/web`. `DATABASE_URL` stays on the API side.
- API route groups live under `apps/api/src/features/<name>` and expose a Hono router; `app.ts` mounts them.

## Commands

Run from each app directory:

```powershell
# apps/web
npm run dev
npm run build
npm run lint

# apps/api
npm run dev
npm run build
npm run db:generate   # generate SQL migration after schema changes
npm run db:migrate    # apply migrations (needs DATABASE_URL)
npm run db:push       # quick schema sync for local development
```

Copy `apps/api/.env.example` to `apps/api/.env` and set the Neon `DATABASE_URL` before running DB commands.
