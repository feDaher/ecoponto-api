jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const flushAudit = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("audit trail", () => {
  it("records access denied with user, route pattern and resource id", async () => {
    await request(app)
      .patch("/collection-points/point-42/review")
      .set(bearer(Role.COLLECTOR))
      .send({ status: "APPROVED" });
    await flushAudit();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: users[Role.COLLECTOR].id,
        action: "ACCESS_DENIED",
        method: "PATCH",
        route: "/collection-points/:id/review",
        resourceId: "point-42",
        statusCode: 403,
      },
    });
  });

  it("records successful changes made by authenticated users", async () => {
    prisma.wasteCategory.findUnique.mockResolvedValue(null);
    prisma.wasteCategory.create.mockResolvedValue({ id: "cat-1", name: "WOOD", active: true });

    const response = await request(app)
      .post("/waste-categories")
      .set(bearer(Role.ADMIN))
      .send({ name: "WOOD" });
    await flushAudit();

    expect(response.status).toBe(201);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: users[Role.ADMIN].id,
        action: "RESOURCE_CHANGED",
        method: "POST",
        route: "/waste-categories",
        statusCode: 201,
      }),
    });
  });

  it("never stores request bodies or headers", async () => {
    await request(app)
      .patch("/collection-points/point-42/review")
      .set(bearer(Role.CITIZEN))
      .send({ status: "REJECTED", rejectionReason: "secret-reason" });
    await flushAudit();

    const recorded = JSON.stringify(prisma.auditLog.create.mock.calls);
    expect(recorded).not.toContain("secret-reason");
    expect(recorded).not.toContain("token-");
  });

  it("does not record reads or anonymous requests", async () => {
    await request(app).get("/auth/me").set(bearer(Role.CITIZEN));
    await request(app).post("/waste-categories").send({ name: "WOOD" });
    await flushAudit();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("keeps serving the response when the audit store fails", async () => {
    prisma.auditLog.create.mockRejectedValue(new Error("db down"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(app).get("/admin").set(bearer(Role.CITIZEN));
    await flushAudit();

    expect(response.status).toBe(403);
    expect(consoleError).toHaveBeenCalledWith(
      "[audit-trail] failed to record entry",
      expect.objectContaining({ action: "ACCESS_DENIED", error: "db down" }),
    );
  });
});
