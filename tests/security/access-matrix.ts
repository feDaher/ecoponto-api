import { Role } from "../../src/generated/prisma/enums";

export const PUBLIC = "PUBLIC";
export const ANY_AUTHENTICATED = "ANY_AUTHENTICATED";

type Access = typeof PUBLIC | typeof ANY_AUTHENTICATED | readonly Role[];

const { ADMIN, COLLECTOR, CITIZEN } = Role;

export const ACCESS_MATRIX: Record<string, Access> = {
  "GET /health": PUBLIC,

  "POST /auth/register": PUBLIC,
  "POST /auth/login": PUBLIC,
  "GET /auth/me": ANY_AUTHENTICATED,

  "GET /admin": [ADMIN],
  "GET /collector": [COLLECTOR],
  "GET /citizen": [CITIZEN],
  "GET /users": [ADMIN],

  "GET /collection-points": PUBLIC,
  "GET /collection-points/:id": PUBLIC,
  "GET /collection-points/mine": [COLLECTOR],
  "GET /collection-points/admin/pending": [ADMIN],
  "POST /collection-points": [COLLECTOR],
  "PUT /collection-points/:id": [COLLECTOR],
  "PATCH /collection-points/:id/review": [ADMIN],

  "GET /collection-points/:collectionPointId/operating-hours": PUBLIC,
  "POST /collection-points/:collectionPointId/operating-hours": [COLLECTOR, ADMIN],
  "PUT /operating-hours/:id": [COLLECTOR, ADMIN],
  "DELETE /operating-hours/:id": [COLLECTOR, ADMIN],

  "GET /waste-categories": PUBLIC,
  "POST /waste-categories": [ADMIN],
  "PUT /waste-categories/:id": [ADMIN],
  "DELETE /waste-categories/:id": [ADMIN],

  "GET /educational-content": PUBLIC,
  "GET /educational-content/category/:categoryId": PUBLIC,
  "GET /educational-content/:id": PUBLIC,
  "POST /educational-content": [ADMIN],
  "PATCH /educational-content/:id": [ADMIN],
  "DELETE /educational-content/:id": [ADMIN],

  "GET /places/autocomplete": PUBLIC,
  "GET /places/:placeId": PUBLIC,
};

export const PUBLIC_WRITE_ALLOWLIST = new Set(["POST /auth/register", "POST /auth/login"]);
