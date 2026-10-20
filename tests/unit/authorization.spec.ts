import type { NextFunction, Request, Response } from "express";
import { Role } from "../../src/generated/prisma/enums";
import { AUTHORIZED_ROLES, authorize } from "../../src/middlewares/authorize.middleware";
import { AppError } from "../../src/shared/errors/AppError";
import {
  assertOwner,
  assertOwnerOrAdmin,
  isOwnerOrAdmin,
} from "../../src/shared/security/access-policy";

const run = (guard: ReturnType<typeof authorize>, user?: Request["user"]) => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  guard({ user } as Request, {} as Response, next);
  return next.mock.calls[0]?.[0];
};

const userWith = (role: Role) => ({ id: "u1", firebaseUid: "f1", email: "a@b.c", role });

describe("authorize()", () => {
  it("refuses to be configured without roles", () => {
    expect(() => authorize()).toThrow("authorize() requires at least one role");
  });

  it("exposes its roles as frozen, de-duplicated metadata", () => {
    const guard = authorize(Role.ADMIN, Role.ADMIN, Role.COLLECTOR);
    expect(guard[AUTHORIZED_ROLES]).toEqual([Role.ADMIN, Role.COLLECTOR]);
    expect(Object.isFrozen(guard[AUTHORIZED_ROLES])).toBe(true);
  });

  it("answers 401 when no user was authenticated", () => {
    const error = run(authorize(Role.ADMIN));
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 401 });
  });

  it("answers 403 for a role outside the allow-list", () => {
    expect(run(authorize(Role.ADMIN), userWith(Role.CITIZEN))).toMatchObject({ statusCode: 403 });
  });

  it("calls next() without error for an allowed role", () => {
    expect(run(authorize(Role.ADMIN, Role.COLLECTOR), userWith(Role.COLLECTOR))).toBeUndefined();
  });
});

describe("access policy", () => {
  const owner = { id: "owner", role: Role.COLLECTOR };
  const stranger = { id: "stranger", role: Role.COLLECTOR };
  const admin = { id: "admin", role: Role.ADMIN };

  it("grants owners and admins, denies strangers", () => {
    expect(isOwnerOrAdmin(owner, "owner")).toBe(true);
    expect(isOwnerOrAdmin(admin, "owner")).toBe(true);
    expect(isOwnerOrAdmin(stranger, "owner")).toBe(false);
  });

  it("throws 403 with the given message when the check fails", () => {
    expect(() => assertOwnerOrAdmin(stranger, "owner", "nope")).toThrow(
      expect.objectContaining({ statusCode: 403, message: "nope" }),
    );
  });

  it("does not let admins bypass owner-only rules", () => {
    expect(() => assertOwner(admin, "owner")).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(() => assertOwner(owner, "owner")).not.toThrow();
  });
});
