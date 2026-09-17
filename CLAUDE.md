# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product context

This repo (`ecoponto-api`) is the **backend** for **EcoPonto Digital**, a system (academic project, UniFacig ADS course) for mapping and credentialing recyclable/e-waste collection points in Manhuaçu–MG. Full product scope per the project's C4 architecture documentation (`ECOPONTO_Documentacao_de_Software_Modelo_C4.pdf`, supplied by the professor/orientador — summarized here so it doesn't need to be re-read):

- **Three actor profiles** (matches `Role` enum: `CITIZEN`/`COLLECTOR`/`ADMIN`):
  - **Cidadão** (`CITIZEN`): browses the map (public, no login required), filters by waste type/proximity/city, traces routes, requests collection, accumulates gamification points, rates collection points.
  - **Coletor/Cooperativa** (`COLLECTOR`): registers and manages their own collection point(s), updates hours, receives requests, logs received materials, exposes a WhatsApp contact button.
  - **Administrador** (`ADMIN`): approves/moderates collection points before they appear on the map, moderates reviews/content, manages users, publishes educational content.
- **MVP functional scope**: georeferenced map of collection points, filters, detailed point info, route tracing, user registration/login, point credentialing+approval workflow, WhatsApp contact channel, environmental education content module, gamification (points/ranking/badges for disposals), point reviews/ratings, Google Maps integration.
- This backend currently implements only a slice of that: health-check, auth/RBAC (register, login, me). `src/modules/collection-points/`, `disposals/`, `reports/` are empty placeholders for the corresponding future features below — the rest (map UI, mobile app, gamification, notifications, WhatsApp, education content) is **not yet built** in this repo.

### Business rules to honor when building those modules

- Registration (name, email, phone, city) is required only for _active_ interactions (requesting collection, logging a disposal, gamification). **Public map browsing and educational content must never require login.**
- A collection point is invisible on the map until an `ADMIN` approves it (checks address, accepted waste types, hours, contact info).
- A collection point must have valid GPS coordinates or a verifiable full address — reject registration without one.
- A collection point must declare its accepted waste categories from a standard taxonomy (min. set: plastic, paper, metals, glass, used cooking oil, general electronics, batteries, cell phones, computers, printers, televisions). No categories → cannot be approved.
- A collection point must declare operating hours at registration; if not updated in 60+ days, auto-flag it on the map as "possibly outdated."
- Search/filter combines waste type + proximity radius (km) + city, plus route tracing to the selected point, plus a deep link that opens the route directly in Google Maps.
- WhatsApp contact button on a point's detail page only if the collector opted in to show their number.
- Disposal logging converts to gamification points (rules consider waste type, quantity, frequency) feeding a ranking/badges/seals system.
- Educational content is per waste category, public, no login needed.
- Authenticated users can rate/comment on collection points; admin can moderate reviews.
- Non-functional targets called out in the docs: search/filter responses <2s, LGPD-compliant data handling (explicit consent, anonymization where possible, right to erasure, access-restricted + audited logs).

## Commands

- `npm run dev` — start the API with hot-reload (`ts-node-dev`), reads `.env` via `dotenv/config` inside `src/config/env.ts`
- `npm run build` — type-check and compile to `dist/` (`tsc`)
- `npm start` — run the compiled build (`node dist/server.js`)
- `npx tsc --noEmit` — type-check only, no output (fastest way to verify changes compile)
- `npx prisma generate` — regenerate the Prisma client after editing `prisma/schema.prisma` (required — it is not run automatically on install)
- `npx prisma migrate dev --name <name>` — create/apply a migration against `DATABASE_URL`
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, `eslint.config.js`, TypeScript-only via `typescript-eslint`)
- `npm run format` / `npm run format:check` — Prettier
- No test runner is configured yet (`npm test` is a placeholder). The project docs call for Jest — not set up in this repo yet.

### Lint/format enforcement (Husky + lint-staged)

`npm install` runs the `prepare` script, which activates Husky and points `core.hooksPath` at `.husky/`. The `.husky/pre-commit` hook runs `npx lint-staged`, which applies `eslint --fix` + `prettier --write` (see the `lint-staged` key in `package.json`) only to staged files — auto-fixable issues get silently corrected and re-staged, but a real lint error (e.g. an unused variable) blocks the commit until fixed by hand. `eslint.config.js` scopes `typescript-eslint`'s recommended rules to `**/*.ts` only (via the `extends`-inside-`files` pattern) so the flat-config file itself and other non-TS files aren't linted with TS-specific rules; `src/generated/**` and `dist/**` are excluded entirely.

## Current implementation (this repo)

Express 5 + TypeScript API, organized as **Clean Architecture applied per feature module**, not as global top-level layers. Each business feature under `src/modules/<name>/` has its own:

- `domain/` — entities, repository interfaces, use-cases (framework-agnostic business logic)
- `infra/` — concrete implementations (Prisma repositories, external HTTP clients)
- `presentation/` — Express routes/controllers, Zod validators

`src/modules/auth/` is the reference implementation of this pattern — follow its shape (`domain/{entities,repositories,use-cases}`, `infra/{repositories,http}`, `presentation/{*.controller,*.routes,*.validators}`) when adding new modules. `src/modules/health/` and `src/modules/users/` are intentionally thin (no domain/infra layers) since they don't have real business logic yet. `collection-points/`, `disposals/`, `reports/` are still empty — future tasks (see business rules above for what they need to cover).

### Request pipeline (`src/app.ts`)

Middleware order matters: `helmet` → `cors` → `express-rate-limit` (100 req/15min global) → `express.json()` → `/docs` (Swagger UI) → feature routes → `notFound` → `errorHandler` (must stay last).

Route handlers are plain async functions — **do not wrap them in a try/catch-to-next helper**. Express 5's router natively forwards rejected promises to the error middleware (verified in `node_modules/router/lib/layer.js`), so throwing an `AppError` (`src/shared/errors/AppError.ts`) from anywhere in a request, sync or async, reaches `errorHandler` automatically.

### Auth & RBAC

Firebase is the identity provider; there is no separately-issued JWT — **the Firebase ID Token itself is the bearer token** used on protected routes (this matches the project docs, which also specify Firebase Auth + JWT-based sessions).

- **Register** (`POST /auth/register`): backend creates the Firebase user via Admin SDK (`RegisterUserUseCase`), then mirrors it into the local `User` table (`PrismaUserRepository`) keyed by `firebaseUid`. Required fields are `name`, `email`, `password`, `phone`, `city` — matches the docs' "Cadastro obrigatório" rule (name/email/phone/city). Self-registration is restricted to `CITIZEN`/`COLLECTOR` (see `auth.validators.ts`) — there is no endpoint to self-register as `ADMIN`; promote a user by updating `role` directly in the database.
- **Login** (`POST /auth/login`): the Admin SDK cannot verify passwords, so `LoginUserUseCase` calls the Firebase Identity Toolkit REST API directly (`FirebaseAuthRestClient`, needs `FIREBASE_API_KEY`, the Web API key — different from the Admin SDK service-account credentials) to exchange email/password for an ID token. (Docs also mention social login via Google/Facebook — not implemented yet.)
- **Protected routes**: `authenticate` middleware (`src/middlewares/authenticate.middleware.ts`) verifies the `Authorization: Bearer <idToken>` header via `firebaseAuth.verifyIdToken`, then loads the local `User` row by `firebaseUid` and attaches it to `req.user`. A valid Firebase token for a user with no local `User` row is rejected (401) — Firebase and the local DB must stay in sync through `/auth/register`.
- **RBAC**: `authorize(...roles)` (`src/middlewares/authorize.middleware.ts`) checks `req.user.role` against an allow-list, e.g. `authorize(Role.ADMIN)` on `GET /users`. Always chain it after `authenticate`.
- `req.user` typing is added via module augmentation in `src/types/express/index.d.ts`.

### Prisma client generation

`prisma/schema.prisma` uses the newer `prisma-client` generator (TypeScript source, not the classic `@prisma/client` codegen), with `output = "../src/generated/prisma"`. It **must** be generated inside `src/`, not at the project root — `tsconfig.json` has `rootDir: "src"` + `include: ["src/**/*"]`, and since the generated files are plain `.ts` that gets compiled with the rest of the app (imported via relative paths, e.g. `src/config/prisma.ts`), anything outside `src` would fail with TS6059 (`rootDir` violation). `src/generated/` is gitignored (matched by the `generated/` rule) and regenerated via `npx prisma generate`.

The Prisma client is instantiated with the `@prisma/adapter-mariadb` driver adapter (`PrismaMariaDb(env.DATABASE_URL)`), not the classic connection-string-in-schema approach — see `src/config/prisma.ts`.

### Config (`src/config/`)

`env.ts` validates `process.env` with Zod at import time and throws immediately if anything is missing/invalid — this is the first thing that runs (imported transitively by nearly everything), so a missing env var fails fast at boot rather than surfacing as a runtime error deep in a request. `firebase.ts` and `prisma.ts` both depend on `env` being valid. `swagger.ts` builds the OpenAPI spec from JSDoc `@openapi` comments in `src/modules/**/presentation/*.routes.ts` (glob path is relative to `process.cwd()`, i.e. only works when run from the project root — this only picks up routes documented with `@openapi` blocks, and only from `.ts` source, so it will not find routes after a production `dist/` build; acceptable for now since Swagger is a dev-time contract tool).

### Path alias

`tsconfig.json` defines `@/*` → `./src/*`, but **no runtime resolver (e.g. `tsconfig-paths`) is wired into `ts-node-dev` or the build**, so this alias only works for type-checking, not at runtime. Use relative imports in actual code; don't import via `@/...` until a resolver is added.

## Target architecture (per project docs — beyond this repo)

This repo is only the `API Backend` container in the project's C4 model. The documented full system also includes, elsewhere (separate repos, presumably):

- **Web app**: Next.js (App Router) + Tailwind CSS — admin/institutional panel.
- **Mobile app**: React Native + NativeWind + Expo (Managed Workflow) — end-user (citizen/collector) app.
- **Push notifications**: Expo Push API (delivers via APNs/FCM).
- **Geolocation/maps**: Google Maps Platform (geocoding, map rendering, route opening).
- **DB infra (documented target, not yet set up here)**: MySQL/InnoDB with Master-Slave replication for HA, `mysqldump` scheduled backups, connection pooling, query optimization — this repo currently just points `DATABASE_URL` at a single MySQL instance via `@prisma/adapter-mariadb`.
- **Testing**: Jest is the documented choice for unit/integration tests (not set up in this repo yet).
- **PM process**: Scrum + Jira (sprints, backlog, burndown) — not tooling relevant to this codebase.
- Possible future backend migration to **NestJS** if complexity grows (explicitly called out as optional, not a current requirement — stick with Express/Clean-Architecture-by-module as-is unless asked).

### Data model reference (from the docs' ER/class diagrams)

Only `User` exists in `prisma/schema.prisma` so far. When implementing `collection-points`/`disposals`/`reports`, the documented relational model (Portuguese names translated here to this project's English-identifier convention) is:

- **CollectionPoint** (`PONTO_COLETA`): id, collectorId (FK → User), name, city, latitude (decimal 10,8), longitude (decimal 11,8), whatsappContact, approvalStatus, credentialedAt, updatedAt, deletedAt (soft delete). Many-to-many with waste categories via a join table (`PONTO_CATEGORIA`).
- **OperatingHours** (`HORARIO_FUNCIONAMENTO`): id, collectionPointId (FK), weekday, openTime, closeTime.
- **WasteCategory** (`CATEGORIA_RESIDUO`): id, name, description, updatedAt, deletedAt.
- **DisposalRecord** (`REGISTRO_DESCARTE`): id, citizenId (FK → User), collectionPointId (FK), categoryId (FK), weightAmount (decimal), pointsEarned (int), disposedAt, updatedAt. This is what feeds gamification.
- **Review** (`AVALIACAO`): id, citizenId (FK), collectionPointId (FK), rating, comment, moderationStatus (enum), reviewedAt, updatedAt.
- **Achievement** / **UserAchievement** (`CONQUISTA` / `CONQUISTA_USUARIO`): badge/seal definitions (title, description, pointsRequired) and the join of which user earned which, when.
- **Notification** (`NOTIFICACAO`): id, title, message, sentAt, read.

The docs' class diagram also implies these role-specific behaviors (useful as a checklist of use-cases when scoping each module): Admin approves points, moderates content/reviews, manages users, publishes education content; Collector registers/updates their point and logs collected materials; Citizen browses/filters points, requests collection, logs disposals, rates points.
