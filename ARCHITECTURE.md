# ARCHITECTURE.md — CareCircle

## 1. Overview

```
            ┌───────────────────────────┐
            │         NestJS API        │  authentication, access rules,
            │ (only one to talk to DB)  │  business logic — hexagonal
            └─────────────┬─────────────┘
                          │ Prisma
                   ┌──────▼──────┐
                   │ PostgreSQL  │  (Neon)
                   └─────────────┘
          ┌───────────────┴───────────────┐
   ┌──────▼──────┐                 ┌──────▼──────┐
   │ Web Next.js │                 │ Mobile Expo │   Clean Architecture,
   │  (parents)  │                 │ (everyone)  │   sharing client-core
   └─────────────┘                 └─────────────┘
```

- **The API is the single source of truth.** Web and mobile are two clients at the same level; neither accesses the database directly.
- **Web**: mainly used by parents (month view, organisation, groups, invitations).
- **Mobile**: daily use by everyone (upcoming events, notes, reminders).
- A future wall display will be a third client of the same API.

## 2. Domain concepts

| Concept        | Description                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Planning**   | An isolated space (e.g. "[first name]'s care"). Nothing leaks from one planning to another. |
| **Member**     | A user inside a planning, with the role `ADMIN` (parents) or `MEMBER` (invited people).     |
| **Group**      | A set of members of a planning (e.g. "Parents", "Grandparents").                            |
| **Invitation** | A single-use, time-limited link that brings a person into a planning and a group.           |
| **Event**      | A dated slot (Wednesday care, holidays, appointment), optionally recurring.                 |
| **Note**       | A text attached to an event, with its own visibility.                                       |
| **Visibility** | The list of groups and/or members allowed to see an event or a note.                        |

## 3. Backend — hexagonal architecture (ports & adapters)

### Principle

The **domain** (business rules) sits at the centre and depends on nothing technical: no NestJS, no Prisma, no HTTP. It communicates with the outside world only through **ports** (TypeScript interfaces it defines). **Adapters** implement those ports with a real technology.

```
        HTTP (NestJS controllers)            ← driving adapters (inbound)
                   │
                   ▼
   ┌────────────────────────────────────┐
   │  Application: use cases            │
   │   ┌────────────────────────────┐   │
   │   │ Domain: entities, policies │   │  pure TypeScript
   │   └────────────────────────────┘   │
   │  Ports: EventRepository,           │
   │         CodeSender, TokenHasher,   │
   │         Clock…                     │
   └────────────────────────────────────┘
                   │
                   ▼
   Prisma, email provider, crypto, system clock   ← driven adapters (outbound)
```

**Dependency rule:** `domain` ← `application` ← `infrastructure` / `interface`. Arrows point inward: the domain imports nothing from the other layers.

### Folder structure

```
apps/api/src/
  modules/
    events/
      domain/
        event.ts                    entity + invariants (endsAt > startsAt…)
        visibility.policy.ts        pure function: can this viewer see this event / note?
      application/
        ports/
          event.repository.ts       interface (port)
        use-cases/
          list-visible-events.ts
          create-event.ts
      infrastructure/
        prisma-event.repository.ts  adapter implementing the port
      interface/
        http/
          events.controller.ts      NestJS controller (inbound adapter)
          events.presenter.ts       domain → response DTO
      events.module.ts              wires ports to adapters (NestJS DI)
    plannings/ groups/ invitations/ notes/ auth/ users/
  common/
    guards/                         AuthGuard, PlanningMemberGuard, AdminGuard
    prisma/                         PrismaService
    config/                         validated environment variables
```

- Ports are injected by NestJS through injection tokens; the module binds each port to its adapter.
- Use cases receive an explicit `Viewer` (`planningId`, `memberId`, `role`, `groupIds`) built by the guards — never the raw HTTP request. A `Viewer` is scoped to one planning: the policy denies any resource whose `planningId` differs, even to an admin, and denies access when an id is missing or blank. The guard only puts in `groupIds` the groups of that planning.
- Lint rule (e.g. `eslint-plugin-boundaries`): files in `domain/` and `application/` cannot import `@nestjs/*`, `@prisma/*` or anything in `infrastructure/` or `interface/`.

### Why hexagonal here

- The **visibility policy** is the heart of the product. As a pure function, it is tested exhaustively in milliseconds, without a database.
- Swapping the database, the email provider or the hosting (Vercel → VPS) only touches adapters.
- Use cases can be tested with in-memory adapters.

Hexagonal is applied **pragmatically**: modules with almost no logic (e.g. `users`) keep a thin structure; we do not create ports nobody needs.

## 4. Frontend (web + mobile) — Clean Architecture

### Principle

Same idea as the backend: business logic in the centre, UI and technical details on the outside, dependencies pointing inward.

```
   ┌──────────────────────────────────────────────┐
   │ Presentation  — screens, components, hooks    │  web: Next.js / mobile: Expo
   │  ┌────────────────────────────────────────┐  │
   │  │ Infrastructure — HTTP client, storage  │  │  web: cookies / mobile: SecureStore
   │  │  ┌──────────────────────────────────┐  │  │
   │  │  │ Application — use cases, ports   │  │  │  packages/client-core
   │  │  │  ┌────────────────────────────┐  │  │  │
   │  │  │  │ Domain — models, pure logic│  │  │  │  packages/client-core
   │  │  │  └────────────────────────────┘  │  │  │
   │  │  └──────────────────────────────────┘  │  │
   │  └────────────────────────────────────────┘  │
   └──────────────────────────────────────────────┘
```

### Layers

| Layer              | Content                                                                                                                       | Where                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Domain**         | Client-side models (built from `shared` types), pure logic: grouping events by day, expanding recurrences for display, labels | `packages/client-core/src/domain`                               |
| **Application**    | Use cases (`getUpcomingEvents`, `addNote`, `acceptInvitation`) and ports (`EventGateway`, `SessionStore`)                     | `packages/client-core/src/application`                          |
| **Infrastructure** | Adapters: HTTP API client, session storage (cookies on web, `expo-secure-store` on mobile)                                    | `apps/web/src/infrastructure`, `apps/mobile/src/infrastructure` |
| **Presentation**   | Screens, components, view hooks, TanStack Query for caching and loading states                                                | `apps/web/src/presentation`, `apps/mobile/src/presentation`     |

### The concrete benefit here

Web and mobile **share the domain and application layers** through `packages/client-core`. A use case such as "list the upcoming events visible to me" is written and tested once; only the infrastructure (how the session is stored) and the presentation (Next.js vs React Native) differ.

### Design system

- `packages/ui-tokens` holds the design tokens (colours, typography, spacing, radii, light and dark themes) as plain TypeScript.
- The web app feeds them into the Tailwind configuration; the mobile app uses them in its styles. Same concepts, same colours on both platforms.
- UX specs for each feature live in `docs/ux/` (written by the `ux-ui` agent) and are the reference for the web and mobile implementation.

### Rules

- `client-core` imports neither React, nor Next.js, nor React Native, nor `fetch` directly: it goes through ports.
- Components never call `fetch` directly: they go through a use case (via a hook).
- The client **never** decides access rights. Hiding a button is UX, not security.

## 5. Data model (V1)

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  createdAt   DateTime @default(now())
  memberships Member[]
}

model Planning {
  id          String       @id @default(cuid())
  name        String
  timezone    String       @default("Europe/Paris")  // recurrences are expanded in this time zone
  createdAt   DateTime     @default(now())
  members     Member[]
  groups      Group[]
  events      Event[]
  invitations Invitation[]
}

enum Role { ADMIN MEMBER }

model Member {
  id         String        @id @default(cuid())
  planningId String
  userId     String
  role       Role
  planning   Planning      @relation(fields: [planningId], references: [id], onDelete: Cascade)
  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  groups     GroupMember[]
  @@unique([planningId, userId])
}

model Group {
  id         String        @id @default(cuid())
  planningId String
  name       String
  planning   Planning      @relation(fields: [planningId], references: [id], onDelete: Cascade)
  members    GroupMember[]
}

model GroupMember {
  groupId  String
  memberId String
  group    Group  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  member   Member @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@id([groupId, memberId])
}

model Invitation {
  id         String    @id @default(cuid())
  planningId String
  groupId    String
  role       Role      @default(MEMBER)
  tokenHash  String    @unique   // the raw token is never stored
  expiresAt  DateTime
  usedAt     DateTime?
  revokedAt  DateTime?
  createdBy  String
  planning   Planning  @relation(fields: [planningId], references: [id], onDelete: Cascade)
}

model Event {
  id         String       @id @default(cuid())
  planningId String
  title      String
  startsAt   DateTime
  endsAt     DateTime
  recurrence String?      // iCalendar RRULE, e.g. FREQ=WEEKLY;BYDAY=WE
  createdBy  String
  planning   Planning     @relation(fields: [planningId], references: [id], onDelete: Cascade)
  notes      Note[]
  visibility Visibility[]
}

model Note {
  id         String       @id @default(cuid())
  eventId    String
  authorId   String
  content    String
  createdAt  DateTime     @default(now())
  event      Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  visibility Visibility[]
}

// One row = "this target is visible to this group OR to this member"
model Visibility {
  id       String  @id @default(cuid())
  eventId  String?
  noteId   String?
  groupId  String?
  memberId String?
  event    Event?  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  note     Note?   @relation(fields: [noteId], references: [id], onDelete: Cascade)
}
```

> Invariant: each `Visibility` has exactly one target (`eventId` xor `noteId`) and exactly one recipient (`groupId` xor `memberId`). Enforced in the domain, and ideally by a database `CHECK` constraint.

## 6. Access rules

The most important part of the project. **Always enforced in the API.**

### Rule 1 — Planning membership

Every request on a planning or its content checks that the authenticated user is a `Member` of that planning. Otherwise: **404** (the planning's existence is not revealed).

### Rule 2 — Event visibility

A user can see an event if:

- they are `ADMIN` of the planning, **or**
- the event has a `Visibility` targeting one of their groups, **or**
- the event has a `Visibility` targeting them directly.

Otherwise: **404**.

### Rule 3 — Note visibility

A user can see a note if they can see the parent event **and** the note is visible to them (same logic: admin, group or direct member). Seeing an event does not grant access to all its notes.

### Rule 4 — Admin-only actions

Creating, updating or deleting groups, invitations, events and visibilities: `ADMIN` only. A `MEMBER` can add a note to an event they can see; by default the note is visible to admins and to the author's groups.

### Rule 5 — One policy, enforced twice, kept in sync

- The rule is defined **once** in the domain: `visibility.policy.ts` (pure function, used for single-resource checks and exhaustively unit-tested).
- For lists, filtering happens **inside the database query**, never by loading everything and filtering in memory. The repository port exposes `findVisibleEvents(viewer, range)`; the Prisma adapter translates the policy into a `where` clause.
- **Contract tests** run the same scenarios against the policy and against the Prisma adapter to prove they agree.
- Every query is scoped by `planningId`.

### Rule 6 — No mass assignment

`planningId`, `role`, `createdBy`, `authorId` are never read from the request body: they come from the context (route parameters, authenticated user).

### NestJS implementation

- `AuthGuard`: verifies the token and attaches the user.
- `PlanningMemberGuard`: enforces rule 1 and builds the `Viewer`.
- `AdminGuard`: enforces rule 4.
- Use cases: enforce rules 2, 3 and 5 through the domain policy and the repository ports. **No query on `Event` or `Note` may bypass them.**

## 7. Authentication

- **Passwordless** login: the user enters their email and receives a 6-digit code valid for 10 minutes (suited to grandparents).
- After verification: a short **access token** (15 min) and a long **refresh token** (30 days), revocable, stored hashed.
- **Web**: tokens in `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- **Mobile**: tokens in `expo-secure-store`, never in AsyncStorage.
- Rate limiting on code requests and code verification.

## 8. Invitations

1. An admin creates an invitation for a group → the API generates a random token (32 bytes), stores its **hash**, and returns the link only once.
2. The link is valid for **48 h** and **single-use**.
3. The person opens the link, signs in (or creates an account), and becomes a `Member` of the planning in the target group.
4. An admin can revoke an unused invitation and remove a member at any time.

## 9. API routes (V1)

```
POST   /auth/request-code            { email }
POST   /auth/verify-code             { email, code }
POST   /auth/refresh
POST   /auth/logout

GET    /me
GET    /me/export                     export my data (GDPR)
DELETE /me                            delete my account

GET    /plannings                     plannings I belong to
POST   /plannings
GET    /plannings/:planningId

GET    /plannings/:planningId/groups                         (admin)
POST   /plannings/:planningId/groups                         (admin)
PATCH  /plannings/:planningId/groups/:groupId                (admin)
DELETE /plannings/:planningId/members/:memberId              (admin)

POST   /plannings/:planningId/invitations                    (admin)
DELETE /plannings/:planningId/invitations/:invitationId      (admin)
POST   /invitations/accept            { token }

GET    /plannings/:planningId/events?from=&to=
POST   /plannings/:planningId/events                         (admin)
GET    /plannings/:planningId/events/:eventId
PATCH  /plannings/:planningId/events/:eventId                (admin)
DELETE /plannings/:planningId/events/:eventId                (admin)

GET    /plannings/:planningId/events/:eventId/notes
POST   /plannings/:planningId/events/:eventId/notes
DELETE /plannings/:planningId/events/:eventId/notes/:noteId  (author or admin)
```

## 10. Deployment

- **API** and **web**: two Vercel projects on the same repo (Root Directory `apps/api` and `apps/web`), with `turbo-ignore` to skip unaffected builds.
- **Database**: local PostgreSQL (Docker) for development and tests; Neon for preview and production, using the pooled connection URL (see below).
- **Mobile**: EAS Build + EAS Submit (TestFlight, Android internal testing).
- **CI**: GitHub Actions (`.github/workflows` at the repo root) — lint, typecheck and tests on every pull request; production deployment only after manual approval.
- Secrets only in GitHub, Vercel and EAS.

### Database environments

| Environment        | Database                                        | Notes                                                              |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| Development        | Local PostgreSQL (Docker, `docker-compose.yml`) | Free, offline, can be reset at will                                |
| Tests (local + CI) | Separate local PostgreSQL database              | Recreated for each e2e run; CI uses a PostgreSQL service container |
| Preview            | Neon (preview branch)                           | Used by Vercel preview deployments                                 |
| Production         | Neon (main branch)                              | Real data — its URL never appears on a developer machine           |

- `.env.example` points to the local Docker database only.
- Development and test databases use different names and credentials from preview and production.
- No Neon configuration is needed until the first deployment.

## 11. Decisions

| Decision                                                              | Reason                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Separate API (NestJS) rather than Next.js routes                      | Mobile does not depend on the website; all access rules in one place; VPS migration possible    |
| Hexagonal backend                                                     | The visibility policy is testable in isolation; technical choices stay replaceable              |
| Clean Architecture on clients + `client-core`                         | Use cases shared between web and mobile; UI stays thin                                          |
| Shared design tokens + UX specs before code                           | Consistent web and mobile experience; usability and accessibility decided before implementation |
| Dates stored in UTC, recurrences expanded in the planning's time zone | "Wednesday 8:00" stays at 8:00 across daylight-saving changes                                   |
| 404 rather than 403 for a non-visible resource                        | Do not reveal that an event or planning exists                                                  |
| Passwordless email-code login                                         | Simple for grandparents, no password to store                                                   |
| Invitation tokens stored hashed                                       | A database leak does not yield valid invitation links                                           |
| Visibility by group + by member                                       | Groups cover most cases, direct members cover exceptions                                        |

## 12. Out of V1 scope

- Automatic school holidays (French Ministry of Education open data)
- Notifications and reminders
- Personal notes hidden from the other admin
- User-enabled temporary support access, admin audit log
- End-to-end encryption of notes
- Wall display (kiosk)
- API migration to a VPS (Docker image built with `turbo prune`)
