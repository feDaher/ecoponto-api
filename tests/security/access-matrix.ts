import { Role } from "../../src/generated/prisma/enums";

export const PUBLIC = "PUBLIC";
export const ANY_AUTHENTICATED = "ANY_AUTHENTICATED";

type Access = typeof PUBLIC | typeof ANY_AUTHENTICATED | readonly Role[];

const { ADMIN, COLLECTOR, CITIZEN } = Role;

export const ACCESS_MATRIX: Record<string, Access> = {
  "GET /health": PUBLIC,
  "GET /health/ready": PUBLIC,

  "POST /auth/register": PUBLIC,
  "POST /auth/login": PUBLIC,
  "POST /auth/refresh": PUBLIC,
  "GET /auth/me": ANY_AUTHENTICATED,

  "GET /admin": [ADMIN],
  "GET /admin/audit-logs": [ADMIN],
  "GET /collector": [COLLECTOR],
  "GET /citizen": [CITIZEN],
  "GET /users": [ADMIN],
  "PATCH /users/me": [CITIZEN, COLLECTOR, ADMIN],
  "DELETE /users/me": [CITIZEN, COLLECTOR, ADMIN],
  "PATCH /users/:id/block": [ADMIN],
  "PATCH /users/:id/unblock": [ADMIN],
  "PATCH /users/:id/role": [ADMIN],

  // Avaliações: ficha pública do ponto + moderação (BE-09)
  "GET /collection-points/:id/reviews": PUBLIC,
  "POST /collection-points/:id/reviews": [CITIZEN],
  "GET /admin/reviews": [ADMIN],
  "PATCH /admin/reviews/:id/hide": [ADMIN],
  "PATCH /admin/reviews/:id/unhide": [ADMIN],
  "DELETE /admin/reviews/:id": [ADMIN],

  // Descartes / histórico de reciclagem (FE-16)
  "POST /disposals": [CITIZEN],
  "GET /disposals/me": [CITIZEN],
  "GET /disposals/me/summary": [CITIZEN],
  "GET /disposals/received": [COLLECTOR],
  // Dono do descarte, dono do ponto ou admin; os demais recebem 404 (regra no use-case).
  "GET /disposals/:id": ANY_AUTHENTICATED,
  "PATCH /disposals/:id/status": [COLLECTOR, ADMIN],

  // Ranking da gamificação (RB09): público sem ids; a posição própria exige login
  "GET /ranking": PUBLIC,
  "GET /ranking/me": [CITIZEN],

  "GET /collection-points": PUBLIC,
  "GET /collection-points/:id": PUBLIC,
  "GET /collection-points/mine": [COLLECTOR],
  "GET /collection-points/admin/pending": [ADMIN],
  "POST /collection-points": [COLLECTOR],
  "PUT /collection-points/:id": [COLLECTOR],
  "PATCH /collection-points/:id/review": [ADMIN],
  "PATCH /collection-points/:id/materials/:categoryId": ANY_AUTHENTICATED,

  "GET /collection-points/admin/pending-categories": [ADMIN],
  "PUT /collection-points/:id/categories": [COLLECTOR, ADMIN],
  "PATCH /collection-points/:id/categories/:categoryId/review": [ADMIN],

  "GET /collection-points/:collectionPointId/operating-hours": PUBLIC,
  "POST /collection-points/:collectionPointId/operating-hours": [COLLECTOR, ADMIN],
  "PUT /operating-hours/:id": [COLLECTOR, ADMIN],
  "DELETE /operating-hours/:id": [COLLECTOR, ADMIN],

  "GET /waste-categories": PUBLIC,
  "POST /waste-categories": [ADMIN],
  "PUT /waste-categories/:id": [ADMIN],
  "DELETE /waste-categories/:id": [ADMIN],

  "GET /educational-content": PUBLIC,
  "GET /educational-content/featured": PUBLIC,
  "GET /educational-content/category/:categoryId": PUBLIC,
  "GET /educational-content/:id": PUBLIC,
  "POST /educational-content": [ADMIN],
  "PATCH /educational-content/:id": [ADMIN],
  "DELETE /educational-content/:id": [ADMIN],
  "GET /admin/educational-content": [ADMIN],
  "GET /admin/educational-content/stats": [ADMIN],
  "GET /admin/educational-content/:id": [ADMIN],

  "GET /places/autocomplete": PUBLIC,
  "GET /places/usage": [ADMIN],
  "GET /places/:placeId": PUBLIC,

  "GET /reports/summary": [ADMIN, COLLECTOR],
  "GET /reports/by-category": [ADMIN, COLLECTOR],
  "GET /reports/by-point": [ADMIN, COLLECTOR],
  "GET /reports/manifests": [ADMIN, COLLECTOR],
  "GET /reports/filter-options": [ADMIN, COLLECTOR],
  "GET /reports/export": [ADMIN, COLLECTOR],
};

export const PUBLIC_WRITE_ALLOWLIST = new Set([
  "POST /auth/register",
  "POST /auth/login",
  "POST /auth/refresh",
]);
