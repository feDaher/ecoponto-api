jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { FirebaseAuthRestClient } from "../../src/modules/auth/infra/http/FirebaseAuthRestClient";
import { AppError } from "../../src/shared/errors/AppError";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";
import { Role } from "../../src/generated/prisma/enums";

const SECURE_TOKEN_OK = {
  id_token: "new-id-token",
  refresh_token: "new-refresh-token",
  expires_in: "3600",
  user_id: "uid-citizen",
};

function mockFetch(response: Response | Error) {
  return jest.spyOn(global, "fetch").mockImplementation(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

function firebaseError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), { status });
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("FirebaseAuthRestClient.refreshIdToken", () => {
  const client = new FirebaseAuthRestClient();

  it("translates the secure token response into the sign-in shape", async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify(SECURE_TOKEN_OK), { status: 200 }));

    await expect(client.refreshIdToken("old-refresh-token")).resolves.toEqual({
      idToken: "new-id-token",
      refreshToken: "new-refresh-token",
      expiresIn: "3600",
      localId: "uid-citizen",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      grant_type: "refresh_token",
      refresh_token: "old-refresh-token",
    });
  });

  it.each(["TOKEN_EXPIRED", "INVALID_REFRESH_TOKEN", "USER_DISABLED", "USER_NOT_FOUND"])(
    "maps %s to 401 so the client logs in again",
    async (code) => {
      mockFetch(firebaseError(400, code));

      const promise = client.refreshIdToken("old-refresh-token");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 401,
        message: "Session expired, log in again",
      });
    },
  );

  it("answers 503 when Firebase is unreachable", async () => {
    mockFetch(new TypeError("fetch failed"));

    await expect(client.refreshIdToken("old-refresh-token")).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});

describe("POST /auth/refresh", () => {
  it("returns a new session for a registered, unblocked user", async () => {
    mockFetch(new Response(JSON.stringify(SECURE_TOKEN_OK), { status: 200 }));

    const response = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "old-refresh-token" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      idToken: "new-id-token",
      refreshToken: "new-refresh-token",
      expiresIn: "3600",
      user: expect.objectContaining({ id: "user-citizen", role: "CITIZEN" }),
    });
  });

  it("refuses to renew the session of a blocked user", async () => {
    mockFetch(new Response(JSON.stringify(SECURE_TOKEN_OK), { status: 200 }));
    prisma.user.findUnique.mockResolvedValueOnce({ ...users[Role.CITIZEN], isBlocked: true });

    const response = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "old-refresh-token" });

    expect(response.status).toBe(403);
  });

  it("rejects a body without the refresh token", async () => {
    const response = await request(app).post("/auth/refresh").send({});
    expect(response.status).toBe(400);
  });
});

describe("GET /auth/me", () => {
  it("returns the whole profile so the apps can restore a session", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      ...users[Role.CITIZEN],
      name: "Maria da Silva",
      phone: "33999990003",
      city: "Manhuaçu",
      isBlocked: false,
      nickname: "Mari",
      notifyCollectionAlerts: true,
      notifyMonthlyReports: false,
      allowCooperativeContact: true,
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
    });

    const response = await request(app).get("/auth/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: "user-citizen",
      firebaseUid: "uid-citizen",
      email: "citizen@test.dev",
      role: "CITIZEN",
      name: "Maria da Silva",
      phone: "33999990003",
      city: "Manhuaçu",
      createdAt: "2026-11-01T12:00:00.000Z",
      nickname: "Mari",
      preferences: { collectionAlerts: true, monthlyReports: false, cooperativeContact: true },
    });
  });
});
