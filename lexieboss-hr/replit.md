# LEXIEBOSS

Internal HR and attendance management web app for Lexiewood. Employees clock in/out with photo proof; admins manage records, rules, and daily summaries.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/lexieboss run dev` — run the frontend (port 19184, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit Auth (OIDC via `@workspace/replit-auth-server` / `@workspace/replit-auth-web`)
- Storage: Replit Object Storage (`@workspace/object-storage-web`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/` — all API route handlers
- `artifacts/lexieboss/src/pages/` — all frontend pages
- `artifacts/lexieboss/src/components/` — shared UI components
- `lib/db/src/schema/` — Drizzle ORM table definitions (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for API shape)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas

## Architecture decisions

- Contract-first: OpenAPI spec drives Zod validation on the server and React Query hooks on the client. Run `codegen` after any spec change.
- Replit Auth (OIDC) — on first login `upsertUser` in `auth.ts` creates an `app_users` row with default role `"employee"`. Promote to admin via direct DB update.
- Photo proof for clock-in/out is stored in Replit Object Storage; signed URLs are requested client-side via `/api/storage/upload-url` before the webcam capture is uploaded.
- Profile query (`useGetMyProfile`) is gated on `isAuthenticated` to avoid hanging on the loading screen when unauthenticated.

## Product

- Admin: dashboard, employee CRUD, attendance rules, attendance logs with filters
- Employee: clock in/out with webcam photo, attendance history with stats

## User preferences

_Populate as you build._

## Gotchas

- Express 5 types `req.params.*` as `string | string[]` — always cast: `String(req.params.id)`.
- Orval generates `zod.coerce.date()` for `format: date` fields. When inserting into Drizzle `date()` columns, convert: `date instanceof Date ? date.toISOString().split("T")[0] : date`.
- Shared libs (`lib/replit-auth-web`, `lib/object-storage-web`) must not reference `vite/client` types — they are composite libs, not Vite apps.
- TanStack Query v5 `UseQueryOptions` requires `queryKey`. When passing inline `query` options to Orval-generated hooks, include `queryKey: getXxxQueryKey(...)`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
