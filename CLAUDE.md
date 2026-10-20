# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product context

This repo (`ecoponto-api`) is the **backend** for **EcoPonto Digital**, a system (academic project, UniFacig ADS course) for mapping and credentialing recyclable/e-waste collection points in Manhuaçu–MG. Full product scope per the project's C4 architecture documentation (`ECOPONTO_Documentacao_de_Software_Modelo_C4.pdf`, supplied by the professor/orientador — summarized here so it doesn't need to be re-read):

- **Three actor profiles** (matches `Role` enum: `CITIZEN`/`COLLECTOR`/`ADMIN`):
  - **Cidadão** (`CITIZEN`): browses the map (public, no login required), filters by waste type/proximity/city, traces routes, requests collection, accumulates gamification points, rates collection points.
  - **Coletor/Cooperativa** (`COLLECTOR`): registers and manages their own collection point(s), updates hours, receives requests, logs received materials, exposes a WhatsApp contact button.
  - **Administrador** (`ADMIN`): approves/moderates collection points before they appear on the map, moderates reviews/content, manages users, publishes educational content.
- **MVP functional scope**: georeferenced map of collection points, filters, detailed point info, route tracing, user registration/login, point credentialing+approval workflow, WhatsApp contact channel, environmental education content module, gamification (points/ranking/badges for disposals), point reviews/ratings, Google Maps integration.
- This backend currently implements: health-check, auth/RBAC (register, login, me, per-role `/admin` `/collector` `/citizen`), the Google Places proxy (`src/modules/places/`), collection points with admin approval and public search by city/waste type/radius (`collection-points/`), waste categories CRUD (`waste-categories/`), operating hours CRUD plus the daily outdated-hours job (`operating-hours/`), and public educational content per category (`educational-content/`). `disposals/` and `reports/` (gamification, dashboards) are **not yet built**, nor are reviews, notifications or WhatsApp.

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
- `npm run db:seed` — seeds the three dev accounts (see "Shared Firebase project & seed" below)
- `npm run load-test` — autocannon load test (`src/scripts/load-test.ts`) against an already-running API; exits non-zero on any non-2xx/error/timeout. Start the API with a high `RATE_LIMIT_MAX` first, or the global rate limiter turns the run into 429s
- `npm test` — Jest + ts-jest + supertest (`jest.config.js`, specs in `tests/`, own `tests/tsconfig.json`). Tests never touch Firebase or MySQL: each spec `jest.mock`s `src/config/firebase` and `src/config/prisma` with `tests/support/*-mock.ts`, and `tests/support/identities.ts` provides one token per role. `npx tsc -p tests --noEmit` type-checks the specs. `npm run test:coverage` for coverage of the security code.

### Lint/format enforcement (Husky + lint-staged)

`npm install` runs the `prepare` script, which activates Husky and points `core.hooksPath` at `.husky/`. The `.husky/pre-commit` hook runs `npx lint-staged`, which applies `eslint --fix` + `prettier --write` (see the `lint-staged` key in `package.json`) only to staged files — auto-fixable issues get silently corrected and re-staged, but a real lint error (e.g. an unused variable) blocks the commit until fixed by hand. `eslint.config.js` scopes `typescript-eslint`'s recommended rules to `**/*.ts` only (via the `extends`-inside-`files` pattern) so the flat-config file itself and other non-TS files aren't linted with TS-specific rules; `src/generated/**` and `dist/**` are excluded entirely.

## Current implementation (this repo)

Express 5 + TypeScript API, organized as **Clean Architecture applied per feature module**, not as global top-level layers. Each business feature under `src/modules/<name>/` has its own:

- `domain/` — entities, repository interfaces, use-cases (framework-agnostic business logic)
- `infra/` — concrete implementations (Prisma repositories, external HTTP clients)
- `presentation/` — Express routes/controllers, Zod validators

`src/modules/auth/` is the reference implementation of this pattern — follow its shape (`domain/{entities,repositories,use-cases}`, `infra/{repositories,http}`, `presentation/{*.controller,*.routes,*.validators}`) when adding new modules. `src/modules/health/` and `src/modules/users/` are intentionally thin (no domain/infra layers) since they don't have real business logic yet. `collection-points/` still talks to Prisma straight from its routes (pending refactor into use-cases); `waste-categories/`, `operating-hours/` and `educational-content/` already follow the layered shape. `waste-categories/` is the single module for the category taxonomy — reuse its repository instead of creating another one.

### Collection point data that exists in two places

`CollectionPoint` still carries `wasteCategories` and `operatingHours` as JSON (written by `POST/PUT /collection-points` and used by the public search filter `wasteType` via `array_contains`), while the normalized `PointCategory` and `OperatingHours` tables are written by the `operating-hours/` module. Until they are unified, keep both in mind: the search reads the JSON, the per-point hours endpoint reads the table.

### Collection point location (BE-04, RN04)

`POST`/`PUT /collection-points` never trust the client location as-is: the handler passes `latitude`/`longitude`/`placeId` through `ResolveLocationUseCase` (`src/modules/geolocation/`) before writing. Accepted inputs: GPS coordinates (both fields, inside the Brazil bounding box in `location-rules.ts` — this rejects `0,0`, swapped lat/long and other countries), a `placeId` from `GET /places/autocomplete` (the server calls Google itself and uses the confirmed coordinates), or both (then the pin must be within `MAX_DISTANCE_FROM_ADDRESS_KM` = 1 km of the verified address). Missing/semantically invalid location → **422**; malformed body (e.g. latitude as a string, `placeId` outside `[A-Za-z0-9_-]{1,512}`) → 400 from Zod. Ownership is checked before any Google call on `PUT`. Address verification fails closed: Google unavailable or no `GOOGLE_MAPS_API_KEY` → 503 and nothing is stored (students without a key can still register with coordinates). `CollectionPoint.locationSource` (`GPS_COORDINATES` | `VERIFIED_ADDRESS`) and `placeId` record how each location was established, for the admin approval step. The bounding box approximates Brazil (it also covers e.g. parts of Paraguay); real address verification comes from the `placeId` path. Governance caveat: Google's terms allow storing `placeId` indefinitely but Places-derived lat/long only for 30 days — before any production use, refresh coordinates from the stored `placeId`. Distance math lives in `src/shared/geo/distance.ts` (also used by the search radius filter).

### Outdated hours flag (BE-05)

`CollectionPoint.hoursConfirmedAt` is reset to now (and `isOutdated` to false) whenever the collector creates/updates/deletes operating hours or resubmits the point via `PUT /collection-points/:id`. `startOutdatedHoursJob()` (`node-cron`, started from `server.ts`, daily 03:00 America/Sao_Paulo) flags points with `hoursConfirmedAt` older than 60 days as `isOutdated = true`; the flag is returned by the public collection-point endpoints. Only the point owner or an ADMIN may change a point's hours (`ensureCanManageCollectionPoint`).

### Request pipeline (`src/app.ts`)

Middleware order matters: `helmet` → `cors` → `express-rate-limit` (`RATE_LIMIT_MAX` req/15min per IP, default 100) → `express.json()` → `/docs` (Swagger UI) → feature routes → `notFound` → `errorHandler` (must stay last).

Route handlers are plain async functions — **do not wrap them in a try/catch-to-next helper**. Express 5's router natively forwards rejected promises to the error middleware (verified in `node_modules/router/lib/layer.js`), so throwing an `AppError` (`src/shared/errors/AppError.ts`) from anywhere in a request, sync or async, reaches `errorHandler` automatically.

### Auth & RBAC

Firebase is the identity provider; there is no separately-issued JWT — **the Firebase ID Token itself is the bearer token** used on protected routes (this matches the project docs, which also specify Firebase Auth + JWT-based sessions).

- **Register** (`POST /auth/register`): backend creates the Firebase user via Admin SDK (`RegisterUserUseCase`), then mirrors it into the local `User` table (`PrismaUserRepository`) keyed by `firebaseUid`. Required fields are `name`, `email`, `password`, `phone`, `city` — matches the docs' "Cadastro obrigatório" rule (name/email/phone/city). Self-registration is restricted to `CITIZEN`/`COLLECTOR` (see `auth.validators.ts`) — there is no endpoint to self-register as `ADMIN`; promote a user by updating `role` directly in the database.
- **Login** (`POST /auth/login`): the Admin SDK cannot verify passwords, so `LoginUserUseCase` calls the Firebase Identity Toolkit REST API directly (`FirebaseAuthRestClient`, needs `FIREBASE_API_KEY`, the Web API key — different from the Admin SDK service-account credentials) to exchange email/password for an ID token. (Docs also mention social login via Google/Facebook — not implemented yet.)
- **Protected routes**: `authenticate` middleware (`src/middlewares/authenticate.middleware.ts`) verifies the `Authorization: Bearer <idToken>` header via `firebaseAuth.verifyIdToken`, then loads the local `User` row by `firebaseUid` and attaches it to `req.user`. A valid Firebase token for a user with no local `User` row is rejected (401) — Firebase and the local DB must stay in sync through `/auth/register`.
- **authenticate** verifies the token with `verifyIdToken(token, true)` (revoked tokens and disabled accounts are rejected) and accepts the `Bearer` scheme case-insensitively. Only Firebase `auth/*` errors become 401; anything else (network, DB) propagates as 500 so outages are not disguised as "invalid token". It also snapshots `req.params` into `res.locals.requestParams` for the audit trail.
- **RBAC**: `authorize(...roles)` (`src/middlewares/authorize.middleware.ts`) checks `req.user.role` against an allow-list, e.g. `authorize(Role.ADMIN)` on `GET /users`. It throws at boot if called with no roles, and exposes its frozen role list under the `AUTHORIZED_ROLES` symbol so tests can inspect it. Route order is enforced by tests: `authenticate` first, `authorize` second, then `validate`/handler — never validate before authorizing.
- **ABAC (ownership)**: attribute rules live in `src/shared/security/access-policy.ts` (`isOwner`, `isOwnerOrAdmin`, `assertOwner`, `assertOwnerOrAdmin` → 403). `PUT /collection-points/:id` is owner-only; operating hours are owner-or-admin (`ensureCanManageCollectionPoint`). Reuse these helpers instead of inline `if (x.ownerId !== req.user.id)` checks.
- **Access matrix (governance)**: `tests/security/access-matrix.ts` is the reviewed source of truth for who may call every route (`PUBLIC`, `ANY_AUTHENTICATED` or a role list). `route-policy.spec.ts` introspects the real Express router and fails if a route is missing from the matrix, a matrix entry is stale, the roles in code differ, the guard order is wrong, or a write route is public outside `PUBLIC_WRITE_ALLOWLIST`. `rbac-matrix.spec.ts` then hits every protected route over HTTP with no token, malformed/forged/revoked tokens, an unregistered user and each of the 3 roles. **Adding or changing a route means updating the matrix** — that diff is what reviewers check.
- **Audit trail**: `auditTrail` (global, right after `express.json()`) writes an `AuditLog` row on `res.finish` for every 403 by an authenticated user (`ACCESS_DENIED`) and every successful POST/PUT/PATCH/DELETE by one (`RESOURCE_CHANGED`), with userId, method, route **pattern** (never the raw URL), resource id param and status. Bodies, headers and tokens are never stored. Recording is fire-and-forget: a failing audit store logs `[audit-trail] failed to record entry` but never breaks the response. `AuditLog.userId` is nullable with `onDelete: SetNull`, so deleting a user (LGPD erasure) anonymizes their log rows instead of being blocked.
- `req.user` typing is added via module augmentation in `src/types/express/index.d.ts`.
- **Firebase ↔ DB consistency on register**: `RegisterUserUseCase` creates the Firebase user first; if the local `User` insert then fails, it deletes the Firebase user (compensation) before rethrowing. Without that, the email would be stuck as "already registered" (409) while having no local row (401 on every protected route). Keep this compensation pattern in any future flow that writes to both Firebase and the DB.

### Shared Firebase project & seed

This is a class project: the professor (orientador) owns a single **dev** Firebase project, and every student gets its credentials (`FIREBASE_*` in `.env`) through a private channel — students do not create their own Firebase project. Each student runs their **own** local MySQL (Docker). Consequences:

- Firebase Auth users are shared across the whole class; `User` rows are per-machine. A user registered on one student's machine exists in Firebase but not in another student's DB: re-registering that email → 409, logging in works but protected routes → 401. This is expected, not a bug.
- `npm run db:seed` (`src/database/seed.ts`) seeds `admin@ecoponto.dev` (ADMIN), `coletor@ecoponto.dev` (COLLECTOR), `cidadao@ecoponto.dev` (CITIZEN), all with password `Ecoponto@123`. It is **find-or-create** in Firebase: it only sets the password when creating the account, and never updates existing Firebase accounts — so one student running it can't change the shared accounts for everyone. It then upserts the local `User` row by email (refreshing `firebaseUid`), and upserts the 11 standard waste categories (`PLASTIC`, `PAPER`, … — same codes the collection-point `wasteCategories` JSON uses). Idempotent; refuses to run with `NODE_ENV=production`.
- The seed is the only way to get an `ADMIN` in a fresh environment (no admin self-registration).
- Never commit credentials, and a production deployment must use a separate Firebase project.

### Prisma client generation

`prisma/schema.prisma` uses the newer `prisma-client` generator (TypeScript source, not the classic `@prisma/client` codegen), with `output = "../src/generated/prisma"`. It **must** be generated inside `src/`, not at the project root — `tsconfig.json` has `rootDir: "src"` + `include: ["src/**/*"]`, and since the generated files are plain `.ts` that gets compiled with the rest of the app (imported via relative paths, e.g. `src/config/prisma.ts`), anything outside `src` would fail with TS6059 (`rootDir` violation). `src/generated/` is gitignored (matched by the `generated/` rule) and regenerated via `npx prisma generate`.

The Prisma client is instantiated with the `@prisma/adapter-mariadb` driver adapter, not the classic connection-string-in-schema approach — see `src/config/prisma.ts`. The adapter always creates a `mariadb` connection pool; `prisma.ts` passes it the `DATABASE_URL` string with pool options (`connectionLimit`, `acquireTimeout`, `idleTimeout`, `connectTimeout`) appended as query params from `DB_POOL_*`/`DB_CONNECT_TIMEOUT_MS` env vars, only when the URL doesn't already set them (URL wins). Keep passing the URL string rather than a parsed host/user/password object, so other driver options in the URL query aren't silently dropped. Default pool size 20 was chosen from load tests (throughput plateaus above ~20 connections; see README). That adapter wraps the `mariadb` npm package (MariaDB Corp.'s connector), which despite the name talks to plain MySQL servers fine over the MySQL wire protocol — including MySQL 8's default `caching_sha2_password` auth plugin, but the first login after a server start without TLS needs the server's RSA key, so `prisma.ts` adds `allowPublicKeyRetrieval=true` outside production (verified in `node_modules/mariadb/lib/cmd/handshake/auth/caching-sha2-password-auth.js`; production must use TLS instead). The URL-building logic lives in `src/config/database-url.ts` (`buildConnectionUrl`) and is shared by both clients below.

**Primary/replica split (BD-06)**: `prisma.ts` exports two clients. `prisma` → primary (`DATABASE_URL`), for every write and all normal reads. `prismaRead` → read-only replica (`DATABASE_REPLICA_URL`, falls back to `prisma` when empty), typed as `ReadOnlyPrismaClient` (only `find*`/`count`/`aggregate`/`groupBy`/`$queryRaw` compile). Use `prismaRead` **only** for heavy report/dashboard queries that tolerate replication lag — never for read-after-write. Each client has its own pool with the same `DB_POOL_*` limits. Writes are blocked three ways: the type, the replica user `ecoponto_reader` (SELECT only), and `super_read_only` on the replica. `tests/support/prisma-mock.ts` exports `prismaRead = prisma`.

### Local database (`docker-compose.yml`)

`npm run db:up` (`docker compose up -d --wait`) starts two MySQL containers: the primary `mysql` (port `${MYSQL_PORT:-3306}`, database/user/password baked into its `environment` block, matching `DATABASE_URL` in `.env.example`, data in the `ecoponto_mysql_data` volume) and the GTID replica `mysql-replica` (port `${MYSQL_REPLICA_PORT:-3308}`, volume `ecoponto_mysql_replica_data`). The `--wait` flag blocks until both healthchecks pass: the primary's `mysqladmin ping` over TCP (`-h 127.0.0.1`, so the init-time temp server doesn't count) and the replica's check that both replication threads (IO and SQL) are running — so there's no race with `prisma migrate dev`, and broken replication fails `db:up` loudly. Init scripts run only on a fresh volume: `docker/mysql/init/` creates the `replicator` and `ecoponto_reader` users on the primary (replicated to the replica), and `docker/mysql-replica/init/` points the replica at the primary and sets `super_read_only`. The replica has no `MYSQL_DATABASE`/`MYSQL_USER` on purpose: they arrive through replication, and creating them locally would conflict with the replicated `CREATE USER`. Migrations run only against the primary. Volumes created before BD-06 lack those users and the GTID history → `npm run db:reset`. `npm run db:replica:status` shows `SHOW REPLICA STATUS`. `npm run db:reset` drops the volume (all data) and recreates it — destructive, dev-only.

### Config (`src/config/`)

`env.ts` validates `process.env` with Zod at import time and throws immediately if anything is missing/invalid — this is the first thing that runs (imported transitively by nearly everything), so a missing env var fails fast at boot rather than surfacing as a runtime error deep in a request. `firebase.ts` and `prisma.ts` both depend on `env` being valid. `swagger.ts` builds the OpenAPI spec from JSDoc `@openapi` comments in `src/modules/**/presentation/*.routes.ts` (glob path is relative to `process.cwd()`, i.e. only works when run from the project root — this only picks up routes documented with `@openapi` blocks, and only from `.ts` source, so it will not find routes after a production `dist/` build; acceptable for now since Swagger is a dev-time contract tool).

### Places / Google Maps (`src/modules/places/`)

Public proxy to **Places API (New)** for the address search box of the web and mobile apps, so the Google key only exists on the server (the apps keep only their platform-restricted map-rendering keys).

- `GET /places/autocomplete?input=&sessionToken=&latitude=&longitude=` → `[{ placeId, title, subtitle }]`
- `GET /places/:placeId?sessionToken=` → `{ label, latitude, longitude, viewport?: { southWest, northEast } }`

Rules worth keeping when touching it:

- `GOOGLE_MAPS_API_KEY` is **optional** in `env.ts` (so classmates without a key can still boot); `GooglePlacesClient` answers 503 when it is missing. It is sent only in the `X-Goog-Api-Key` header, never in a URL, and the key should be restricted in Google Cloud to Places API (New) + the server's IP.
- Every input is validated with `z.strictObject` before any Google call (unknown/repeated params rejected, `input` 3–200 chars without control chars, `sessionToken`/`placeId` limited to `[A-Za-z0-9_-]`, latitude/longitude parsed from strict decimal strings, both or neither). `validate(schema, "query" | "params")` replaces `req.query`/`req.params` with the parsed values via `Object.defineProperty`, since Express 5's `req.query` is a getter.
- Google's response is also validated with Zod. Google errors never reach the client: details 400/404 → 404, timeout (5s)/network/429 → 503, anything else → 502. Logs carry only Google's status code, never the key or the query text.
- Per-IP limiters on top of the global one: autocomplete 30/min, details 15/min. Responses are `Cache-Control: no-store` (Google's terms forbid caching Places content).
- Fixed `languageCode: pt-BR`, `regionCode`/`includedRegionCodes: br`; results are biased to a 30 km circle around the client's coordinates, or around Manhuaçu when none are sent.

### Path alias

`tsconfig.json` defines `@/*` → `./src/*`, but **no runtime resolver (e.g. `tsconfig-paths`) is wired into `ts-node-dev` or the build**, so this alias only works for type-checking, not at runtime. Use relative imports in actual code; don't import via `@/...` until a resolver is added.

## Target architecture (per project docs — beyond this repo)

This repo is only the `API Backend` container in the project's C4 model. The documented full system also includes, elsewhere (separate repos, presumably):

- **Web app**: Next.js (App Router) + Tailwind CSS — admin/institutional panel.
- **Mobile app**: React Native + NativeWind + Expo (Managed Workflow) — end-user (citizen/collector) app.
- **Push notifications**: Expo Push API (delivers via APNs/FCM).
- **Geolocation/maps**: Google Maps Platform (geocoding, map rendering, route opening).
- **DB infra (documented target, not yet set up here)**: MySQL/InnoDB with Master-Slave replication for HA, `mysqldump` scheduled backups, connection pooling, query optimization — this repo has a primary + one read replica for reports (BD-06, see Prisma section) with app-level pooling; routing is explicit in code (`prisma` vs `prismaRead`), so ProxySQL is not used. Automatic failover/HA is not set up.
- **Testing**: Jest is the documented choice for unit/integration tests (not set up in this repo yet).
- **PM process**: Scrum + Jira (sprints, backlog, burndown) — not tooling relevant to this codebase.
- Possible future backend migration to **NestJS** if complexity grows (explicitly called out as optional, not a current requirement — stick with Express/Clean-Architecture-by-module as-is unless asked).

### Data model reference (from the docs' ER/class diagrams)

Most of the tables below already exist in `prisma/schema.prisma` (some still unused by any route, e.g. `Geolocation`, `Collection`, `DisposalRecord`, `Review`). The documented relational model (Portuguese names translated here to this project's English-identifier convention) is:

- **CollectionPoint** (`PONTO_COLETA`): id, collectorId (FK → User), name, city, latitude (decimal 10,8), longitude (decimal 11,8), whatsappContact, approvalStatus, credentialedAt, updatedAt, deletedAt (soft delete). Many-to-many with waste categories via a join table (`PONTO_CATEGORIA`).
- **OperatingHours** (`HORARIO_FUNCIONAMENTO`): id, collectionPointId (FK), weekday, openTime, closeTime.
- **WasteCategory** (`CATEGORIA_RESIDUO`): id, name, description, updatedAt, deletedAt.
- **DisposalRecord** (`REGISTRO_DESCARTE`): id, citizenId (FK → User), collectionPointId (FK), categoryId (FK), weightAmount (decimal), pointsEarned (int), disposedAt, updatedAt. This is what feeds gamification.
- **Review** (`AVALIACAO`): id, citizenId (FK), collectionPointId (FK), rating, comment, moderationStatus (enum), reviewedAt, updatedAt.
- **Achievement** / **UserAchievement** (`CONQUISTA` / `CONQUISTA_USUARIO`): badge/seal definitions (title, description, pointsRequired) and the join of which user earned which, when.
- **Notification** (`NOTIFICACAO`): id, title, message, sentAt, read.

The docs' class diagram also implies these role-specific behaviors (useful as a checklist of use-cases when scoping each module): Admin approves points, moderates content/reviews, manages users, publishes education content; Collector registers/updates their point and logs collected materials; Citizen browses/filters points, requests collection, logs disposals, rates points.
