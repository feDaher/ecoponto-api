jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));

jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

const flushAudit = () => new Promise((resolve) => setImmediate(resolve));

describe("GET /admin/audit-logs", () => {
  it("allows ADMIN to list audit logs", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app).get("/admin/audit-logs").set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("denies access to CITIZEN", async () => {
    const response = await request(app).get("/admin/audit-logs").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("denies access to COLLECTOR", async () => {
    const response = await request(app).get("/admin/audit-logs").set(bearer(Role.COLLECTOR));

    expect(response.status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("denies access without authentication", async () => {
    const response = await request(app).get("/admin/audit-logs");

    expect(response.status).toBe(401);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("records AUDIT_LOG_VIEWED when ADMIN lists audit logs", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app).get("/admin/audit-logs").set(bearer(Role.ADMIN));

    await flushAudit();

    expect(response.status).toBe(200);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "AUDIT_LOG_VIEWED",
        method: "GET",
        route: "/admin/audit-logs",
        statusCode: 200,
      }),
    });
  });

  it("requests one extra record to detect the next page", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ limit: 2 })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      }),
    );
  });

  it("returns a nextCursor when more records exist", async () => {
    const logs = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        createdAt: new Date("2026-11-14T15:00:00.000Z"),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: new Date("2026-11-14T14:00:00.000Z"),
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        createdAt: new Date("2026-11-14T13:00:00.000Z"),
      },
    ];

    prisma.auditLog.findMany.mockResolvedValue(logs);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ limit: 2 })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].id).toBe(logs[0].id);
    expect(response.body.items[1].id).toBe(logs[1].id);
    expect(typeof response.body.nextCursor).toBe("string");

    const decodedCursor = JSON.parse(
      Buffer.from(response.body.nextCursor, "base64url").toString("utf8"),
    );

    expect(decodedCursor).toEqual({
      createdAt: "2026-11-14T14:00:00.000Z",
      id: logs[1].id,
    });
  });

  it("uses the cursor to fetch the next page", async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        createdAt: "2026-11-14T14:00:00.000Z",
        id: "22222222-2222-4222-8222-222222222222",
      }),
    ).toString("base64url");

    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ limit: 2, cursor })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                {
                  createdAt: {
                    lt: new Date("2026-11-14T14:00:00.000Z"),
                  },
                },
                {
                  createdAt: new Date("2026-11-14T14:00:00.000Z"),
                  id: {
                    lt: "22222222-2222-4222-8222-222222222222",
                  },
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });

  it("filters audit logs by action", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ action: "ACCESS_DENIED" })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              action: "ACCESS_DENIED",
            }),
          ]),
        }),
      }),
    );
  });

  it("filters audit logs by userId", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";

    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ userId })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              userId,
            }),
          ]),
        }),
      }),
    );
  });

  it("filters audit logs by route", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ route: "/admin/audit-logs" })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              route: "/admin/audit-logs",
            }),
          ]),
        }),
      }),
    );
  });

  it("filters audit logs by date range", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({
        from: "2026-11-01T00:00:00-03:00",
        to: "2026-11-14T23:59:59-03:00",
      })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              createdAt: {
                gte: new Date("2026-11-01T00:00:00-03:00"),
                lte: new Date("2026-11-14T23:59:59-03:00"),
              },
            }),
          ]),
        }),
      }),
    );
  });

  it("rejects date ranges exceeding 90 days", async () => {
    const response = await request(app)
      .get("/admin/audit-logs")
      .query({
        from: "2026-07-01T00:00:00-03:00",
        to: "2026-11-14T23:59:59-03:00",
      })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);

    expect(response.body.message).toContain("Date range cannot exceed 90 days");

    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("rejects limit greater than 100", async () => {
    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ limit: 101 })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);

    expect(response.body.message).toContain("Too big");

    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid cursor", async () => {
    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ cursor: "cursor-invalido" })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("rejects unknown query parameters", async () => {
    const response = await request(app)
      .get("/admin/audit-logs")
      .query({ parametroInvalido: "teste" })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("combines multiple audit log filters", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";

    prisma.auditLog.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/admin/audit-logs")
      .query({
        action: "ACCESS_DENIED",
        userId,
        route: "/admin/audit-logs",
      })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              action: "ACCESS_DENIED",
              userId,
              route: "/admin/audit-logs",
            }),
          ]),
        }),
      }),
    );
  });
});
