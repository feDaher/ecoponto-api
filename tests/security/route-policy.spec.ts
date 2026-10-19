jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import { app } from "../../src/app";
import { authenticate } from "../../src/middlewares/authenticate.middleware";
import { AUTHORIZED_ROLES, isRoleGuard } from "../../src/middlewares/authorize.middleware";
import { listRoutes } from "../support/route-inventory";
import { ACCESS_MATRIX, ANY_AUTHENTICATED, PUBLIC, PUBLIC_WRITE_ALLOWLIST } from "./access-matrix";

const routes = listRoutes(app);
const routeKeys = routes.map((route) => route.key);

describe("route access policy (governance)", () => {
  it("declares every registered route in the access matrix", () => {
    const undeclared = routeKeys.filter((key) => !(key in ACCESS_MATRIX));
    expect(undeclared).toEqual([]);
  });

  it("has no stale entries in the access matrix", () => {
    const stale = Object.keys(ACCESS_MATRIX).filter((key) => !routeKeys.includes(key));
    expect(stale).toEqual([]);
  });

  it("never exposes a write route publicly unless it is explicitly allowlisted", () => {
    const publicWrites = routes
      .filter((route) => route.method !== "GET" && !route.handlers.includes(authenticate))
      .map((route) => route.key)
      .filter((key) => !PUBLIC_WRITE_ALLOWLIST.has(key));

    expect(publicWrites).toEqual([]);
  });

  describe.each(routes.map((route) => [route.key, route] as const))("%s", (key, route) => {
    const expected = ACCESS_MATRIX[key];

    if (expected === PUBLIC) {
      it("is public and carries no auth guards", () => {
        expect(route.handlers).not.toContain(authenticate);
        expect(route.handlers.some(isRoleGuard)).toBe(false);
      });
      return;
    }

    it("runs authenticate as the first handler", () => {
      expect(route.handlers[0]).toBe(authenticate);
    });

    if (expected === ANY_AUTHENTICATED) {
      it("does not restrict roles", () => {
        expect(route.handlers.some(isRoleGuard)).toBe(false);
      });
      return;
    }

    it("enforces exactly the roles from the access matrix", () => {
      const guards = route.handlers.filter(isRoleGuard);
      expect(guards).toHaveLength(1);
      expect([...guards[0][AUTHORIZED_ROLES]].sort()).toEqual([...expected].sort());
    });

    it("authorizes right after authenticating, before validation or business logic", () => {
      expect(isRoleGuard(route.handlers[1])).toBe(true);
    });
  });
});
