jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { firebaseAuth } from "../support/firebase-mock";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const CURRENT = "SenhaAtual1";
const NEXT = "NovaSenha2";
const citizen = users[Role.CITIZEN];

const storedCitizen = {
  ...citizen,
  name: "Maria Souza",
  phone: "33988887777",
  city: "Manhuaçu",
  isBlocked: false,
  nickname: "Mari",
  notifyCollectionAlerts: true,
  notifyMonthlyReports: false,
  allowCooperativeContact: true,
  cooperativeContactConsentAt: new Date("2026-11-01T10:00:00.000Z"),
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
  updatedAt: new Date("2026-10-01T12:00:00.000Z"),
};

const flushAudit = () => new Promise((resolve) => setImmediate(resolve));

function signIn(idToken: string) {
  return new Response(
    JSON.stringify({
      idToken,
      refreshToken: `${idToken}-refresh`,
      expiresIn: "3600",
      localId: citizen.firebaseUid,
    }),
    { status: 200 },
  );
}

function firebaseError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), { status });
}

let fetchMock: jest.SpyInstance;

function mockFirebaseResponses(...responses: Response[]) {
  fetchMock = jest.spyOn(global, "fetch");
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
}

const sentPasswords = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).password);

const changePassword = (body: object) =>
  request(app).post("/auth/change-password").set(bearer(Role.CITIZEN)).send(body);

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  prisma.user.findUnique.mockImplementation(
    async ({ where }: { where: { firebaseUid?: string; id?: string } }) =>
      where.firebaseUid === citizen.firebaseUid || where.id === citizen.id
        ? { ...storedCitizen }
        : null,
  );
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("POST /auth/login", () => {
  it("returns the nickname and the preferences with the user", async () => {
    mockFirebaseResponses(signIn("login-token"));

    const response = await request(app)
      .post("/auth/login")
      .send({ email: citizen.email, password: CURRENT });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: citizen.id,
      email: citizen.email,
      role: "CITIZEN",
      isBlocked: false,
      nickname: "Mari",
      preferences: { collectionAlerts: true, monthlyReports: false, cooperativeContact: true },
    });
    expect(response.body.user).not.toHaveProperty("cooperativeContactConsentAt");
  });
});

describe("POST /auth/change-password", () => {
  it("changes the password, revokes old sessions and returns a new session", async () => {
    mockFirebaseResponses(signIn("check-token"), signIn("new-session-token"));

    const response = await changePassword({ currentPassword: CURRENT, newPassword: NEXT });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      idToken: "new-session-token",
      refreshToken: "new-session-token-refresh",
      expiresIn: "3600",
      user: { id: citizen.id, nickname: "Mari", preferences: { cooperativeContact: true } },
    });
    expect(sentPasswords()).toEqual([CURRENT, NEXT]);
    expect(firebaseAuth.updateUser).toHaveBeenCalledWith(citizen.firebaseUid, { password: NEXT });
    expect(firebaseAuth.revokeRefreshTokens).toHaveBeenCalledWith(citizen.firebaseUid);
    expect(firebaseAuth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      firebaseAuth.revokeRefreshTokens.mock.invocationCallOrder[0],
    );
  });

  it("answers 422 for a wrong current password without changing anything", async () => {
    mockFirebaseResponses(firebaseError(400, "INVALID_LOGIN_CREDENTIALS"));

    const response = await changePassword({ currentPassword: "Errada123", newPassword: NEXT });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: "A senha atual está incorreta." });
    expect(firebaseAuth.updateUser).not.toHaveBeenCalled();
    expect(firebaseAuth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("answers 429 when Firebase locks the account for too many attempts", async () => {
    mockFirebaseResponses(firebaseError(400, "TOO_MANY_ATTEMPTS_TRY_LATER"));

    const response = await changePassword({ currentPassword: CURRENT, newPassword: NEXT });

    expect(response.status).toBe(429);
    expect(firebaseAuth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["shorter than 8 characters", { newPassword: "Abc1234" }, "pelo menos 8 caracteres"],
    ["without a number", { newPassword: "SomenteLetras" }, "pelo menos um número"],
    ["without a letter", { newPassword: "12345678" }, "pelo menos uma letra"],
    ["equal to the current one", { newPassword: CURRENT }, "diferente da senha atual"],
    ["longer than 128 characters", { newPassword: `A1${"a".repeat(127)}` }, "no máximo 128"],
    ["with an unknown field", { email: "outro@test.dev" }, "Unrecognized key"],
  ])("rejects a new password %s with 400", async (_label, change, message) => {
    fetchMock = jest.spyOn(global, "fetch");

    const response = await changePassword({
      currentPassword: CURRENT,
      newPassword: NEXT,
      ...change,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(message);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(firebaseAuth.updateUser).not.toHaveBeenCalled();
  });

  it("answers 401 without a token", async () => {
    fetchMock = jest.spyOn(global, "fetch");

    const response = await request(app)
      .post("/auth/change-password")
      .send({ currentPassword: CURRENT, newPassword: NEXT });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 502 and changes nothing when Firebase refuses the update", async () => {
    mockFirebaseResponses(signIn("check-token"));
    firebaseAuth.updateUser.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: "auth/internal-error" }),
    );

    const response = await changePassword({ currentPassword: CURRENT, newPassword: NEXT });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe(
      "Não foi possível trocar a senha agora. Nenhuma alteração foi feita.",
    );
    expect(firebaseAuth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("still returns the new session when revoking the old ones fails", async () => {
    mockFirebaseResponses(signIn("check-token"), signIn("new-session-token"));
    firebaseAuth.revokeRefreshTokens.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: "auth/internal-error" }),
    );

    const response = await changePassword({ currentPassword: CURRENT, newPassword: NEXT });

    expect(response.status).toBe(200);
    expect(response.body.idToken).toBe("new-session-token");
  });

  it("never writes a password to the logs or to the audit trail", async () => {
    mockFirebaseResponses(signIn("check-token"));
    firebaseAuth.updateUser.mockRejectedValueOnce(
      Object.assign(new Error(`could not set ${NEXT}`), { code: "auth/internal-error" }),
    );

    await changePassword({ currentPassword: CURRENT, newPassword: NEXT });
    await flushAudit();

    const logged = JSON.stringify((console.error as jest.Mock).mock.calls);
    const audited = JSON.stringify(prisma.auditLog.create.mock.calls);
    for (const text of [logged, audited]) {
      expect(text).not.toContain(CURRENT);
      expect(text).not.toContain(NEXT);
    }
  });

  it("records the change in the audit trail with the user's own id", async () => {
    mockFirebaseResponses(signIn("check-token"), signIn("new-session-token"));

    await changePassword({ currentPassword: CURRENT, newPassword: NEXT });
    await flushAudit();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: citizen.id,
        action: "RESOURCE_CHANGED",
        method: "POST",
        route: "/auth/change-password",
        resourceId: citizen.id,
        statusCode: 200,
      }),
    });
  });
});
