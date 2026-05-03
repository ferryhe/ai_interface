# ai_interface

A **pnpm monorepo** starter for building type-safe, full-stack TypeScript applications with an OpenAPI-driven workflow. It combines an Express 5 API server, a PostgreSQL database layer, auto-generated React Query hooks and Zod validators, and a React frontend sandbox — all wired together through a single OpenAPI specification.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Key Commands](#key-commands)
- [Package Reference](#package-reference)
- [Adding a New API Endpoint](#adding-a-new-api-endpoint)
- [Database Schema](#database-schema)
- [Security](#security)
- [License](#license)

---

## Architecture Overview

```
OpenAPI Spec  ──►  Orval codegen  ──►  React Query hooks  (@workspace/api-client-react)
     │                              └►  Zod validators    (@workspace/api-zod)
     │
     └──► API Server  (@workspace/api-server)
               │
               └──► DB layer  (@workspace/db)  ──►  PostgreSQL (Drizzle ORM)
```

The OpenAPI specification (`lib/api-spec/openapi.yaml`) is the **single source of truth** for the entire API contract. All client-side types, React Query hooks, and Zod validators are generated from it automatically — meaning the frontend, server validation, and API documentation are always in sync.

---

## Repository Structure

```
.
├── lib/
│   ├── api-spec/          # OpenAPI specification + Orval codegen config
│   ├── api-client-react/  # Generated React Query hooks (+ custom fetch)
│   ├── api-zod/           # Generated Zod schemas & TypeScript types
│   └── db/                # Drizzle ORM client, schema definitions, migrations
├── artifacts/
│   ├── api-server/        # Express 5 API server (bundled via esbuild)
│   └── mockup-sandbox/    # React + Vite frontend sandbox (shadcn/ui + Tailwind)
├── scripts/               # Utility / maintenance scripts
├── pnpm-workspace.yaml    # Workspace definition, catalog versions, npmrc settings
├── tsconfig.base.json     # Shared TypeScript compiler options
└── package.json           # Root scripts (build, typecheck)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9 |
| Runtime | Node.js 24 |
| API Framework | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 (`zod/v4`), `drizzle-zod` |
| API Codegen | Orval (from OpenAPI spec) |
| Client Data Fetching | TanStack React Query v5 |
| Frontend Build | Vite 7 |
| Frontend UI | React 19, shadcn/ui, Tailwind CSS v4, Radix UI |
| Server Build | esbuild (CJS bundle) |
| Logging | Pino + pino-http |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 24
- **pnpm** (install via `npm install -g pnpm`)
- **PostgreSQL** database (set `DATABASE_URL` environment variable)

### Installation

```bash
# Clone the repository
git clone https://github.com/ferryhe/ai_interface.git
cd ai_interface

# Install all workspace dependencies
pnpm install
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/mydb` |

---

## Development Workflow

### 1. Push the database schema

After modifying `lib/db/src/schema/`, apply changes to your local database:

```bash
pnpm --filter @workspace/db run push
```

### 2. Start the API server

```bash
pnpm --filter @workspace/api-server run dev
```

The server will be available at `http://localhost:<PORT>/api`.

### 3. Start the frontend sandbox

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

### 4. Regenerate API client code (after editing the OpenAPI spec)

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates:
- `lib/api-client-react/src/generated/` — React Query hooks
- `lib/api-zod/src/generated/` — Zod schemas and TypeScript types

---

## Key Commands

| Command | Description |
|---|---|
| `pnpm run build` | Typecheck + build all packages |
| `pnpm run typecheck` | Full TypeScript typecheck across all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from OpenAPI spec |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |
| `pnpm --filter @workspace/db run push-force` | Force-push DB schema changes (destructive, dev only) |
| `pnpm --filter @workspace/api-server run dev` | Build and run API server locally |
| `pnpm --filter @workspace/api-server run build` | Build API server production bundle |
| `pnpm --filter @workspace/mockup-sandbox run dev` | Start frontend dev server |
| `pnpm --filter @workspace/mockup-sandbox run build` | Build frontend for production |

---

## Package Reference

### `@workspace/api-spec` — `lib/api-spec/`

Contains the OpenAPI 3.1 specification (`openapi.yaml`) and the Orval codegen configuration (`orval.config.ts`). Running `codegen` in this package writes generated files into `api-client-react` and `api-zod`.

### `@workspace/api-client-react` — `lib/api-client-react/`

Auto-generated TanStack React Query hooks for each API operation. Also contains `custom-fetch.ts`, which provides the underlying fetch implementation used by every hook. Import hooks from this package in frontend code.

### `@workspace/api-zod` — `lib/api-zod/`

Auto-generated Zod schemas and TypeScript types for all API request/response shapes. Used in the API server for runtime validation (e.g. `HealthCheckResponse.parse(...)`).

### `@workspace/db` — `lib/db/`

Database access layer. Exports:
- `db` — Drizzle ORM client connected via `DATABASE_URL`
- `pool` — raw `pg.Pool` instance
- All table definitions and types from `src/schema/`

Define new tables in `lib/db/src/schema/` and re-export them from `src/schema/index.ts`.

### `@workspace/api-server` — `artifacts/api-server/`

Express 5 HTTP server. Routes are defined under `src/routes/` and mounted at `/api`. Built to a single ESM bundle via esbuild for deployment.

### `@workspace/mockup-sandbox` — `artifacts/mockup-sandbox/`

Vite-powered React 19 frontend used for UI prototyping. Pre-loaded with all shadcn/ui components, Tailwind CSS v4, Radix UI primitives, and Framer Motion. Intended as a sandbox for building and iterating on UI features.

### `scripts` — `scripts/`

Standalone utility scripts runnable with `pnpm --filter @workspace/scripts run <script>`.

---

## Adding a New API Endpoint

1. **Define the endpoint** in `lib/api-spec/openapi.yaml` — add a path, operation, and any new component schemas.

2. **Run codegen** to update client hooks and Zod schemas:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```

3. **Implement the route** in `artifacts/api-server/src/routes/`. Use the generated Zod schema for request/response validation:
   ```ts
   import { MyResponseSchema } from "@workspace/api-zod";

   router.get("/my-endpoint", (_req, res) => {
     const data = MyResponseSchema.parse({ ... });
     res.json(data);
   });
   ```

4. **Register the router** in `artifacts/api-server/src/routes/index.ts`.

5. **Use the hook** in the frontend sandbox:
   ```ts
   import { useMyEndpointQuery } from "@workspace/api-client-react";
   ```

---

## Database Schema

Database tables are defined using Drizzle ORM in `lib/db/src/schema/`. Each model file should export:
- A `pgTable` definition
- An insert schema via `createInsertSchema` from `drizzle-zod`
- TypeScript `Insert*` and select types

Example:

```ts
// lib/db/src/schema/posts.ts
import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
```

Re-export from `lib/db/src/schema/index.ts`, then apply with:

```bash
pnpm --filter @workspace/db run push
```

---

## Security

The workspace enforces a **minimum package release age of 1,440 minutes (1 day)** for all npm dependencies via pnpm's `minimumReleaseAge` setting. This provides a meaningful buffer against supply-chain attacks, as malicious package versions are typically identified and revoked within hours of publication.

Only packages from explicitly trusted publishers (e.g. `@replit/*`) are exempted from this restriction.

---

## License

MIT
