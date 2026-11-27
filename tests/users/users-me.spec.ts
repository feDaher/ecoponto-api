jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { firebaseAuth } from "../support/firebase-mock";
import { bearer, installIdentities, tokenFor, users } from "../support/identities";
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
  createdAt: Date;
  updatedAt: Date;
};

const flushAudit = () => new Promise((resolve) => setImmediate(resolve));

let rows: Map<string, StoredUser>;

function fullUser(role: Role): StoredUser {
  const identity = users[role];
  return {
    ...identity,
    name: "Maria Souza",
    phone: "33988887777",
    city: "Manhuaçu",
    isBlocked: false,
    createdAt: new Date("2026-10-01T12:00:00.000Z"),
    updatedAt: new Date("2026-10-01T12:00:00.000Z"),
  };
}

function installUserStore() {
  rows = new Map(Object.values(Role).map((role) => [users[role].id, fullUser(role)]));

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
      const updated = { ...rows.get(where.id)!, ...data, updatedAt: new Date() };
      rows.set(where.id, updated);
      return { ...updated };
    },
  );

  prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => Promise<unknown>) => {
    const snapshot = new Map([...rows].map(([id, row]) => [id, { ...row }]));
    try {
      return await work(prisma);
    } catch (error) {
      rows = snapshot;
      throw error;
    }
  });

  prisma.$queryRaw.mockImplementation(async () =>
    [...rows.values()]
      .filter((row) => row.role === Role.ADMIN && !row.isBlocked)
      .map(({ id }) => ({ id })),
  );
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  installUserStore();
  firebaseAuth.deleteUser.mockImplementation(async () => undefined);
});

const validProfile = {
  name: "  Maria   da Silva ",
  phone: "(33) 99999-9999",
  city: " Manhuaçu ",
};

describe("PATCH /users/me", () => {
  it.each([Role.CITIZEN, Role.COLLECTOR, Role.ADMIN])(
    "lets a %s update their own profile, normalizing the phone",
    async (role) => {
      const response = await request(app).patch("/users/me").set(bearer(role)).send(validProfile);

      expect(response.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: users[role].id },
        data: { name: "Maria da Silva", phone: "33999999999", city: "Manhuaçu" },
      });
      expect(response.body).toMatchObject({
        id: users[role].id,
        firebaseUid: users[role].firebaseUid,
        email: users[role].email,
        role,
        name: "Maria da Silva",
        phone: "33999999999",
        city: "Manhuaçu",
        isBlocked: false,
      });
      expect(Object.keys(response.body).sort()).toEqual(
        [
          "city",
          "createdAt",
          "email",
          "firebaseUid",
          "id",
          "isBlocked",
          "name",
          "phone",
          "role",
          "updatedAt",
        ].sort(),
      );
    },
  );

  it("accepts a phone without mask and a 10-digit landline", async () => {
    const response = await request(app)
      .patch("/users/me")
      .set(bearer(Role.CITIZEN))
      .send({ ...validProfile, phone: "3333311111" });

    expect(response.status).toBe(200);
    expect(response.body.phone).toBe("3333311111");
  });

  it.each([
    ["a single-word name", { name: "Maria" }, "Informe nome e sobrenome"],
    ["a name with digits", { name: "Maria 2 Silva" }, "apenas letras"],
    ["a phone with 8 digits", { phone: "9999-9999" }, "10 ou 11 dígitos"],
    ["a phone with letters", { phone: "33 9999A-9999" }, "Telefone inválido"],
    ["a one-letter city", { city: "M" }, "Informe a cidade"],
    ["an email field", { email: "outro@ecoponto.dev" }, ""],
    ["a role field", { role: "ADMIN" }, ""],
    ["an isBlocked field", { isBlocked: false }, ""],
  ])("rejects %s with 400", async (_label, change, message) => {
    const response = await request(app)
      .patch("/users/me")
      .set(bearer(Role.CITIZEN))
      .send({ ...validProfile, ...change });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(message);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a missing field with 400", async () => {
    const response = await request(app)
      .patch("/users/me")
      .set(bearer(Role.CITIZEN))
      .send({ name: "Maria da Silva", phone: "33999999999" });

    expect(response.status).toBe(400);
  });

  it("answers 401 without a token", async () => {
    const response = await request(app).patch("/users/me").send(validProfile);

    expect(response.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("answers 404 when the token's user is gone from the database", async () => {
    const lookup = prisma.user.findUnique.getMockImplementation()!;
    prisma.user.findUnique.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id ? null : lookup(args),
    );

    const response = await request(app)
      .patch("/users/me")
      .set(bearer(Role.CITIZEN))
      .send(validProfile);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Usuário não encontrado");
  });

  it("records the change in the audit trail with the user's own id as resource", async () => {
    await request(app).patch("/users/me").set(bearer(Role.CITIZEN)).send(validProfile);
    await flushAudit();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: users[Role.CITIZEN].id,
        action: "RESOURCE_CHANGED",
        method: "PATCH",
        route: "/users/me",
        resourceId: users[Role.CITIZEN].id,
        statusCode: 200,
      }),
    });
  });
});

describe("DELETE /users/me", () => {
  it("drops the cooperative profile (contact e-mail, CNPJ) inside the anonymization", async () => {
    const response = await request(app).delete("/users/me").set(bearer(Role.COLLECTOR));

    expect(response.status).toBe(204);
    expect(prisma.cooperativeProfile.deleteMany).toHaveBeenCalledWith({
      where: { collectorId: users[Role.COLLECTOR].id },
    });
  });

  it("anonymizes the user, blocks it and deletes the Firebase login", async () => {
    const response = await request(app).delete("/users/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(rows.get(users[Role.CITIZEN].id)).toMatchObject({
      name: "Usuário removido",
      email: `removido-${users[Role.CITIZEN].id}@anonimo.ecoponto.invalid`,
      phone: "",
      city: "",
      isBlocked: true,
      firebaseUid: users[Role.CITIZEN].firebaseUid,
    });
    expect(firebaseAuth.deleteUser).toHaveBeenCalledWith(users[Role.CITIZEN].firebaseUid);
  });

  it("anonymizes in the database before deleting in Firebase, inside one transaction", async () => {
    await request(app).delete("/users/me").set(bearer(Role.COLLECTOR));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update.mock.invocationCallOrder[0]).toBeLessThan(
      firebaseAuth.deleteUser.mock.invocationCallOrder[0],
    );
  });

  it("does not check the admin count for a citizen", async () => {
    await request(app).delete("/users/me").set(bearer(Role.CITIZEN));

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("goes on when the Firebase account no longer exists", async () => {
    firebaseAuth.deleteUser.mockRejectedValue(
      Object.assign(new Error("no user"), { code: "auth/user-not-found" }),
    );

    const response = await request(app).delete("/users/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(204);
    expect(rows.get(users[Role.CITIZEN].id)?.isBlocked).toBe(true);
  });

  it("keeps the database untouched when Firebase fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    firebaseAuth.deleteUser.mockRejectedValue(
      Object.assign(new Error("network down"), { code: "app/network-error" }),
    );
    const before = { ...rows.get(users[Role.CITIZEN].id)! };

    const response = await request(app).delete("/users/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(502);
    expect(response.body.message).toBe("Não foi possível excluir a conta agora. Tente novamente.");
    expect(rows.get(users[Role.CITIZEN].id)).toEqual(before);
  });

  it("refuses to delete the last active administrator with 409", async () => {
    const response = await request(app).delete("/users/me").set(bearer(Role.ADMIN));

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Você é o último administrador ativo. Promova outro administrador antes de excluir sua conta.",
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(firebaseAuth.deleteUser).not.toHaveBeenCalled();
  });

  it("ignores blocked administrators when counting the remaining ones", async () => {
    rows.set("user-admin-blocked", {
      ...fullUser(Role.ADMIN),
      id: "user-admin-blocked",
      firebaseUid: "uid-admin-blocked",
      isBlocked: true,
    });

    const response = await request(app).delete("/users/me").set(bearer(Role.ADMIN));

    expect(response.status).toBe(409);
  });

  it("lets an administrator leave when another active administrator remains", async () => {
    rows.set("user-admin-2", {
      ...fullUser(Role.ADMIN),
      id: "user-admin-2",
      firebaseUid: "uid-admin-2",
    });

    const response = await request(app).delete("/users/me").set(bearer(Role.ADMIN));

    expect(response.status).toBe(204);
    expect(rows.get(users[Role.ADMIN].id)?.isBlocked).toBe(true);
  });

  it("answers 401 without a token", async () => {
    const response = await request(app).delete("/users/me");

    expect(response.status).toBe(401);
    expect(firebaseAuth.deleteUser).not.toHaveBeenCalled();
  });

  it("records the deletion in the audit trail with the user's own id as resource", async () => {
    await request(app).delete("/users/me").set(bearer(Role.CITIZEN));
    await flushAudit();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: users[Role.CITIZEN].id,
        action: "RESOURCE_CHANGED",
        method: "DELETE",
        route: "/users/me",
        resourceId: users[Role.CITIZEN].id,
        statusCode: 204,
      }),
    });
  });

  it("rejects the old token afterwards: 401 once Firebase no longer knows the user", async () => {
    await request(app).delete("/users/me").set(bearer(Role.CITIZEN));
    firebaseAuth.verifyIdToken.mockImplementation(async (token: string) => {
      if (token === tokenFor(Role.CITIZEN)) {
        throw Object.assign(new Error("deleted"), { code: "auth/user-not-found" });
      }
      return { uid: users[Role.ADMIN].firebaseUid };
    });

    const response = await request(app).get("/auth/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(401);
  });

  it("rejects the old token with 403 even if Firebase still accepted it, because the row is blocked", async () => {
    await request(app).delete("/users/me").set(bearer(Role.CITIZEN));

    const response = await request(app).get("/auth/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(403);
  });
});
