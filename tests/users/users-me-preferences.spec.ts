jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { firebaseAuth } from "../support/firebase-mock";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

type StoredUser = {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: Role;
  isBlocked: boolean;
  nickname: string | null;
  notifyCollectionAlerts: boolean;
  notifyMonthlyReports: boolean;
  allowCooperativeContact: boolean;
  cooperativeContactConsentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const citizenId = users[Role.CITIZEN].id;
let rows: Map<string, StoredUser>;

function storedUser(role: Role, overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    ...users[role],
    name: "Maria Souza",
    phone: "33988887777",
    city: "Manhuaçu",
    isBlocked: false,
    nickname: null,
    notifyCollectionAlerts: true,
    notifyMonthlyReports: true,
    allowCooperativeContact: false,
    cooperativeContactConsentAt: null,
    createdAt: new Date("2026-10-01T12:00:00.000Z"),
    updatedAt: new Date("2026-10-01T12:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  rows = new Map(Object.values(Role).map((role) => [users[role].id, storedUser(role)]));

  prisma.user.findUnique.mockImplementation(
    async ({ where }: { where: { id?: string; firebaseUid?: string } }) => {
      const found = [...rows.values()].find(
        (row) => row.id === where.id || row.firebaseUid === where.firebaseUid,
      );
      return found ? { ...found } : null;
    },
  );
  prisma.user.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: Partial<StoredUser> }) => {
      const defined = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      );
      const updated = { ...rows.get(where.id)!, ...defined, updatedAt: new Date() };
      rows.set(where.id, updated);
      return { ...updated };
    },
  );
  prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => Promise<unknown>) =>
    work(prisma),
  );
  firebaseAuth.deleteUser.mockImplementation(async () => undefined);
});

const profile = { name: "Maria da Silva", phone: "33999999999", city: "Manhuaçu" };
const patch = (body: object) =>
  request(app)
    .patch("/users/me")
    .set(bearer(Role.CITIZEN))
    .send({ ...profile, ...body });

describe("PATCH /users/me: nickname", () => {
  it("saves the nickname with inner spaces collapsed and returns it", async () => {
    const response = await patch({ nickname: "  Mari   Souza " });

    expect(response.status).toBe(200);
    expect(response.body.nickname).toBe("Mari Souza");
    expect(rows.get(citizenId)?.nickname).toBe("Mari Souza");
  });

  it.each([
    ["an empty string", ""],
    ["blank spaces", "   "],
    ["null", null],
  ])("clears the nickname when it is %s", async (_label, nickname) => {
    rows.set(citizenId, { ...rows.get(citizenId)!, nickname: "Mari" });

    const response = await patch({ nickname });

    expect(response.status).toBe(200);
    expect(response.body.nickname).toBeNull();
    expect(rows.get(citizenId)?.nickname).toBeNull();
  });

  it("keeps the nickname when the field is not sent", async () => {
    rows.set(citizenId, { ...rows.get(citizenId)!, nickname: "Mari" });

    const response = await patch({});

    expect(response.body.nickname).toBe("Mari");
  });

  it.each([
    ["longer than 60 characters", "a".repeat(61), "O apelido pode ter no máximo 60 caracteres"],
    ["with digits", "Mari 2", "O apelido deve conter apenas letras"],
    ["not a string", 42, "O apelido deve ser um texto"],
  ])("rejects a nickname %s with 400", async (_label, nickname, message) => {
    const response = await patch({ nickname });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(message);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /users/me: preferences", () => {
  it("returns the preferences object on every profile response", async () => {
    const response = await patch({});

    expect(response.body.preferences).toEqual({
      collectionAlerts: true,
      monthlyReports: true,
      cooperativeContact: false,
    });
    expect(response.body).not.toHaveProperty("notifyMonthlyReports");
    expect(response.body).not.toHaveProperty("cooperativeContactConsentAt");
  });

  it("updates only the preferences that are sent", async () => {
    const response = await patch({ preferences: { monthlyReports: false } });

    expect(response.status).toBe(200);
    expect(response.body.preferences).toEqual({
      collectionAlerts: true,
      monthlyReports: false,
      cooperativeContact: false,
    });
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.notifyMonthlyReports).toBe(false);
    expect(data.notifyCollectionAlerts).toBeUndefined();
    expect(data.allowCooperativeContact).toBeUndefined();
  });

  it("records when the cooperative contact consent was given", async () => {
    const before = Date.now();

    const response = await patch({ preferences: { cooperativeContact: true } });

    expect(response.body.preferences.cooperativeContact).toBe(true);
    const consentAt = rows.get(citizenId)?.cooperativeContactConsentAt;
    expect(consentAt).toBeInstanceOf(Date);
    expect(consentAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("keeps the original consent date when the consent is confirmed again", async () => {
    const original = new Date("2026-11-01T10:00:00.000Z");
    rows.set(citizenId, {
      ...rows.get(citizenId)!,
      allowCooperativeContact: true,
      cooperativeContactConsentAt: original,
    });

    await patch({ preferences: { cooperativeContact: true } });

    expect(rows.get(citizenId)?.cooperativeContactConsentAt).toEqual(original);
  });

  it("clears the consent date when the consent is withdrawn", async () => {
    rows.set(citizenId, {
      ...rows.get(citizenId)!,
      allowCooperativeContact: true,
      cooperativeContactConsentAt: new Date("2026-11-01T10:00:00.000Z"),
    });

    const response = await patch({ preferences: { cooperativeContact: false } });

    expect(response.body.preferences.cooperativeContact).toBe(false);
    expect(rows.get(citizenId)).toMatchObject({
      allowCooperativeContact: false,
      cooperativeContactConsentAt: null,
    });
  });

  it.each([
    ["an unknown preference", { newsletter: true }],
    ["a non-boolean value", { monthlyReports: "sim" }],
  ])("rejects %s with 400", async (_label, preferences) => {
    const response = await patch({ preferences });

    expect(response.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("still requires name, phone and city", async () => {
    const response = await request(app)
      .patch("/users/me")
      .set(bearer(Role.CITIZEN))
      .send({ preferences: { monthlyReports: false } });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /users/me: new profile data", () => {
  it("clears the nickname and the cooperative contact consent", async () => {
    rows.set(citizenId, {
      ...rows.get(citizenId)!,
      nickname: "Mari",
      allowCooperativeContact: true,
      cooperativeContactConsentAt: new Date("2026-11-01T10:00:00.000Z"),
    });

    const response = await request(app).delete("/users/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(204);
    expect(rows.get(citizenId)).toMatchObject({
      nickname: null,
      allowCooperativeContact: false,
      cooperativeContactConsentAt: null,
      isBlocked: true,
    });
  });
});
