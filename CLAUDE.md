# CLAUDE.md — CareCircle

> Working name, to be replaced once the final name is chosen.

## The project

A shared planning app to organise a child's care (Wednesdays, school holidays, appointments) between the parents and invited people (grandparents, nanny…).

Core principle: **each person only sees what has been shared with them.** Parents (admins) see everything; invited members only see the events and notes visible to their group or to them directly.

The detailed architecture, data model and access rules live in [`ARCHITECTURE.md`](./ARCHITECTURE.md). **Read it before any change that touches data, access rights or the layer structure.**

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: NestJS + Prisma + PostgreSQL (Neon) — **hexagonal architecture**
- **Web**: Next.js (App Router) + TypeScript + Tailwind — **Clean Architecture**
- **Mobile**: React Native + Expo (Expo Router) — **Clean Architecture**
- **Shared**: TypeScript types and Zod validation schemas
- **Tests**: Jest (API, mobile), Vitest + Testing Library (web), Supertest (API e2e)

## Structure

```
apps/
  api/            NestJS API — single source of truth, the only thing that talks to the database
  web/            Next.js site — API client, no direct database access
  mobile/         Expo app — API client, no direct database access
packages/
  shared/         API contract: types, Zod schemas, constants (used by api, web, mobile)
  client-core/    Client domain + application layers, shared by web and mobile
  ui-tokens/      Design tokens (colours, typography, spacing) for Tailwind and React Native
docs/
  ux/             UX specs produced by the ux-ui agent
.claude/
  agents/         Specialised agents (ux-ui, backend, web, mobile, test, security)
```

## Commands

```bash
pnpm install                 # install dependencies
pnpm dev                     # run api + web locally
pnpm --filter api dev        # run the API only
pnpm --filter mobile start   # run the mobile app (Expo)
pnpm test                    # all tests
pnpm --filter api test:e2e   # API e2e tests (access rights)
pnpm lint                    # lint the whole monorepo
pnpm typecheck               # TypeScript checks
pnpm --filter api prisma migrate dev   # create/apply a migration locally
```

> To be adjusted as soon as the real scripts exist.

## Expected workflow

1. **Explore**: read the relevant code and `ARCHITECTURE.md` before changing anything.
2. **Plan**: propose a short plan and wait for approval for any non-trivial task.
3. **Code** in small steps, one concern at a time.
4. **Test**: every API feature ships with its tests, including access-rights tests.
5. **Verify**: `pnpm lint`, `pnpm typecheck` and `pnpm test` must pass before proposing a commit.

## Available agents

| Agent      | When to use it                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ux-ui`    | Before building a screen or flow (journey, states, copy, layout), and to review an implemented screen. Writes specs in `docs/ux/`, no app code |
| `backend`  | Anything in `apps/api`: domain, use cases, ports, adapters, Prisma, access rules                                                               |
| `web`      | Anything in `apps/web` and `packages/client-core`: pages, components, use cases, API calls                                                     |
| `mobile`   | Anything in `apps/mobile` (and `packages/client-core` when shared logic is needed): screens, navigation, native features, offline              |
| `test`     | Writing or completing tests, especially access-rights tests                                                                                    |
| `security` | Reviewing a finished feature, before every merge into `main`                                                                                   |

For a full feature: `ux-ui` (spec) → `backend` → `test` → `web` and/or `mobile` → `ux-ui` (review) → `security`.

Shared design tokens live in `packages/ui-tokens`: web (Tailwind) and mobile use the same colours, typography and spacing.

## Conventions

- Strict TypeScript everywhere, no `any`.
- Types and schemas exchanged between the API and clients live in `packages/shared`. Never duplicate them.
- Code (variables, functions, files, comments) in English; user-facing text in French.
- Respect the dependency rule of each architecture (see `ARCHITECTURE.md`): **inner layers never import outer layers.**
- Commits follow Conventional Commits: `feat(api): ...`, `fix(mobile): ...`, `test(api): ...`.
- One branch per feature, merged into `main` through a pull request only.

## Non-negotiable rules

- **Access rights are enforced in the API, never only in the UI.** Hiding something on screen is not protection.
- **No secrets in the code** (keys, tokens, passwords, database URLs). They live in `.env` (ignored by Git) and in the hosting providers' environment variables.
- **Never deploy to production.** Deployment goes through the GitHub Actions pipeline with manual approval.
- **Never push directly to `main`**, never use `git push --force`.
- **Never modify a Prisma migration that has already been applied.** Create a new one.
- **Never disable or delete a test** to make CI pass. Fix the code or report the problem.
- The data concerns a child: never log the content of notes, events or any personal data.
