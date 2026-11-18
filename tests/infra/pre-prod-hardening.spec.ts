jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { createShutdownHandler } from "../../src/shared/lifecycle/graceful-shutdown";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("body parsing errors", () => {
  it("answers 400 (not 500) to malformed JSON", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Malformed JSON body" });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("answers 413 (not 500) to a body over the limit", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.com", password: "x".repeat(200_000) }));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Request body too large" });
  });

  it("still hides unexpected errors behind a generic 500", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.wasteCategory.findMany.mockRejectedValue(
      Object.assign(new Error("boom"), { status: 404, expose: false }),
    );

    const res = await request(app).get("/waste-categories");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error" });
    errorSpy.mockRestore();
  });

  it("keeps validating authenticated JSON bodies after the change", async () => {
    const res = await request(app)
      .post("/waste-categories")
      .set(bearer(Role.ADMIN))
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
  });
});

describe("GET /health/ready", () => {
  it("answers 200 when the database responds", async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up" });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("answers 503 when the database is down", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.$queryRaw.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "unavailable", database: "down" });
    errorSpy.mockRestore();
  });

  it("keeps /health as a liveness check that never touches the database", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("CORS default", () => {
  it("still allows any origin and exposes X-Total-Count when CORS_ORIGINS is unset", async () => {
    const res = await request(app).get("/health").set("Origin", "https://qualquer.exemplo");

    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-expose-headers"]).toBe("X-Total-Count");
  });
});

describe("trust proxy default", () => {
  it("is off unless TRUST_PROXY is set", () => {
    expect(app.get("trust proxy")).toBe(false);
  });
});

describe("graceful shutdown", () => {
  const silent = { log: jest.fn(), error: jest.fn() };

  function fakeServer(closeError?: Error) {
    return {
      close: jest.fn((cb: (err?: Error) => void): void => {
        setImmediate(() => cb(closeError));
      }),
      closeIdleConnections: jest.fn(),
    };
  }

  it("stops jobs, drains the server, closes resources, then exits 0 (in that order)", async () => {
    const order: string[] = [];
    const server = fakeServer();
    server.close.mockImplementation((cb) => {
      order.push("close");
      setImmediate(() => cb());
    });
    const exit = jest.fn();

    const shutdown = createShutdownHandler({
      server,
      stopJobs: () => order.push("jobs"),
      closeResources: async () => {
        order.push("resources");
      },
      exit,
      logger: silent,
    });
    await shutdown("SIGTERM");

    expect(order).toEqual(["jobs", "close", "resources"]);
    expect(server.closeIdleConnections).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("runs only once when signals repeat", async () => {
    const server = fakeServer();
    const exit = jest.fn();
    const shutdown = createShutdownHandler({ server, exit, logger: silent });

    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("exits 1 when closing fails", async () => {
    const exit = jest.fn();
    const shutdown = createShutdownHandler({
      server: fakeServer(new Error("not running")),
      exit,
      logger: silent,
    });

    await shutdown("SIGTERM");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("forces exit 1 when draining exceeds the timeout", async () => {
    jest.useFakeTimers();
    const exit = jest.fn();
    const shutdown = createShutdownHandler({
      server: { close: jest.fn() }, // never calls back: a request that never ends
      exit,
      timeoutMs: 1_000,
      logger: silent,
    });

    void shutdown("SIGTERM");
    await Promise.resolve();
    jest.advanceTimersByTime(1_000);

    expect(exit).toHaveBeenCalledWith(1);
    jest.useRealTimers();
  });
});
