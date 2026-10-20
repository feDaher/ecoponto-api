jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { firebaseAuth } from "../support/firebase-mock";
import {
  REVOKED_TOKEN,
  ROLES,
  UNREGISTERED_TOKEN,
  bearer,
  installIdentities,
} from "../support/identities";
import { resetPrismaMock } from "../support/prisma-mock";
import { listRoutes, samplePath } from "../support/route-inventory";
import { ACCESS_MATRIX, ANY_AUTHENTICATED, PUBLIC } from "./access-matrix";

const protectedRoutes = listRoutes(app).filter((route) => ACCESS_MATRIX[route.key] !== PUBLIC);

const send = (method: string, path: string, headers: Record<string, string> = {}) =>
  request(app)
    [method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete"](samplePath(path))
    .set(headers)
    .send({});

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("RBAC matrix over every protected route", () => {
  it("covers the critical admin panel routes", () => {
    const keys = protectedRoutes.map((route) => route.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "GET /users",
        "GET /collection-points/admin/pending",
        "PATCH /collection-points/:id/review",
        "POST /waste-categories",
        "DELETE /educational-content/:id",
      ]),
    );
  });

  describe.each(protectedRoutes.map((route) => [route.key, route] as const))(
    "%s",
    (_key, route) => {
      const access = ACCESS_MATRIX[route.key];
      const allowed = (role: (typeof ROLES)[number]) =>
        access === ANY_AUTHENTICATED || (Array.isArray(access) && access.includes(role));

      it("rejects requests without a token with 401", async () => {
        const response = await send(route.method, route.path);
        expect(response.status).toBe(401);
      });

      it("rejects a malformed Authorization header with 401", async () => {
        const response = await send(route.method, route.path, { Authorization: "Basic abc" });
        expect(response.status).toBe(401);
      });

      it("rejects an invalid token with 401", async () => {
        const response = await send(route.method, route.path, { Authorization: "Bearer forged" });
        expect(response.status).toBe(401);
      });

      it("rejects a revoked token with 401", async () => {
        const response = await send(route.method, route.path, {
          Authorization: `Bearer ${REVOKED_TOKEN}`,
        });
        expect(response.status).toBe(401);
      });

      it("rejects a valid token of an unregistered user with 401", async () => {
        const response = await send(route.method, route.path, {
          Authorization: `Bearer ${UNREGISTERED_TOKEN}`,
        });
        expect(response.status).toBe(401);
      });

      it.each(ROLES)("%s gets the expected access decision", async (role) => {
        const response = await send(route.method, route.path, bearer(role));

        if (allowed(role)) {
          expect([401, 403]).not.toContain(response.status);
        } else {
          expect(response.status).toBe(403);
          expect(response.body).toEqual({
            message: "You do not have permission to access this resource",
          });
        }
      });
    },
  );
});

describe("token verification", () => {
  it("asks Firebase to check token revocation and disabled accounts", async () => {
    await send("GET", "/auth/me", bearer("ADMIN"));
    expect(firebaseAuth.verifyIdToken).toHaveBeenCalledWith("token-ADMIN", true);
  });

  it("accepts the Bearer scheme case-insensitively", async () => {
    const response = await send("GET", "/auth/me", { Authorization: "bearer token-ADMIN" });
    expect(response.status).toBe(200);
  });

  it("does not disguise infrastructure failures as authentication errors", async () => {
    firebaseAuth.verifyIdToken.mockRejectedValueOnce(new Error("network down"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await send("GET", "/auth/me", bearer("ADMIN"));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Internal server error" });
  });
});
