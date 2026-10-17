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
- **Tests**: Vitest (API, packages), Vitest + Testing Library (web), Jest (`jest-expo`) + React Native Testing Library (mobile), Supertest (API e2e)
- **Tooling**: Node 24 LTS (`.nvmrc`), TypeScript 6.0, ESLint 9 (flat config), Prettier, tsdown (builds the shared packages)

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
  typescript-config/  Shared tsconfig presets (base, nestjs, nextjs, react-native, library)
  eslint-config/      Shared ESLint flat configs (base, nest, next, react-native, library)
docs/
  ux/             UX specs produced by the ux-ui agent
.claude/
  agents/         Specialised agents (ux-ui, backend, web, mobile, test, security)
```

## Commands

```bash
nvm use                      # Node 24 (from .nvmrc)
pnpm install                 # install dependencies
cp .env.example .env         # then replace every "change-me"
pnpm db:up                   # start the local dev + test PostgreSQL databases (Docker)
pnpm db:down                 # stop them
pnpm dev                     # run api + web locally
pnpm --filter api dev        # run the API only
pnpm --filter mobile start   # run the mobile app (Expo)
pnpm build                   # build every app and package
pnpm test                    # all tests
pnpm test:e2e                # e2e tests (API access rights)
pnpm lint                    # lint the whole monorepo
pnpm typecheck               # TypeScript checks
pnpm format                  # format with Prettier (format:check to verify)
```

> Prisma is not installed yet: `pnpm --filter api prisma migrate dev` will be added with the first data module.

Mobile dependencies are added with `pnpm --filter mobile exec expo install <package>` so versions match the Expo SDK.

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
- Test names (describe/it) are written in English, phrased as specifications. Only user-facing text is in French.
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
