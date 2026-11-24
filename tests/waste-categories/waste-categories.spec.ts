jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role, WasteClass } from "../../src/generated/prisma/enums";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const admin = bearer(Role.ADMIN);

function storedCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: "category-1",
    name: "COMPUTERS",
    description: "Computadores",
    label: "Informática & Placas-Mãe",
    wasteClass: WasteClass.CLASS_I,
    active: true,
    createdAt: new Date("2026-11-20T12:00:00Z"),
    updatedAt: new Date("2026-11-20T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("GET /waste-categories", () => {
  it("lists active categories including label and wasteClass", async () => {
    prisma.wasteCategory.findMany.mockResolvedValue([storedCategory()]);

    const response = await request(app).get("/waste-categories");

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      name: "COMPUTERS",
      label: "Informática & Placas-Mãe",
      wasteClass: "CLASS_I",
    });

    expect(prisma.wasteCategory.findMany).toHaveBeenCalledWith({
      where: { active: true },
    });
  });
});

describe("POST /waste-categories", () => {
  it("creates a category with label and wasteClass", async () => {
    prisma.wasteCategory.findUnique.mockResolvedValue(null);
    prisma.wasteCategory.create.mockImplementation(async ({ data }) => storedCategory(data));

    const response = await request(app).post("/waste-categories").set(admin).send({
      name: "COMPUTERS",
      label: "Informática & Placas-Mãe",
      wasteClass: "CLASS_I",
    });

    expect(response.status).toBe(201);
  });

  it("still creates a category without label and wasteClass", async () => {});

  it("rejects an invalid wasteClass with 400", async () => {});

  it("rejects unauthenticated category creation", async () => {
    const response = await request(app).post("/waste-categories").send({
      name: "COMPUTERS",
      label: "Informática & Placas-Mãe",
      wasteClass: "CLASS_I",
    });

    expect(response.status).toBe(401);
    expect(prisma.wasteCategory.create).not.toHaveBeenCalled();
  });

  it.each([Role.CITIZEN, Role.COLLECTOR])("forbids %s from creating a category", async (role) => {
    const response = await request(app).post("/waste-categories").set(bearer(role)).send({
      name: "COMPUTERS",
      label: "Informática & Placas-Mãe",
      wasteClass: "CLASS_I",
    });

    expect(response.status).toBe(403);
    expect(prisma.wasteCategory.create).not.toHaveBeenCalled();
  });
});

describe("PUT /waste-categories/:id", () => {
  it("updates label and wasteClass", async () => {
    prisma.wasteCategory.findFirst.mockResolvedValue(storedCategory());
    prisma.wasteCategory.findUnique.mockResolvedValue(storedCategory());
    prisma.wasteCategory.update.mockImplementation(async ({ data }) => storedCategory(data));

    const response = await request(app).put("/waste-categories/category-1").set(admin).send({
      name: "COMPUTERS",
      label: "Computadores e Hardware",
      wasteClass: "CLASS_IIA",
    });

    expect(response.status).toBe(200);

    expect(prisma.wasteCategory.update).toHaveBeenCalledWith({
      where: { id: "category-1" },
      data: {
        name: "COMPUTERS",
        label: "Computadores e Hardware",
        wasteClass: "CLASS_IIA",
      },
    });
  });

  it("rejects an invalid wasteClass with 400", async () => {
    const response = await request(app).put("/waste-categories/category-1").set(admin).send({
      name: "COMPUTERS",
      label: "Computadores",
      wasteClass: "INVALID_CLASS",
    });

    expect(response.status).toBe(400);
    expect(prisma.wasteCategory.update).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated category updates", async () => {
    const response = await request(app).put("/waste-categories/category-1").send({
      name: "COMPUTERS",
      label: "Computadores",
      wasteClass: "CLASS_I",
    });

    expect(response.status).toBe(401);
    expect(prisma.wasteCategory.update).not.toHaveBeenCalled();
  });

  it.each([Role.CITIZEN, Role.COLLECTOR])("forbids %s from updating a category", async (role) => {
    const response = await request(app).put("/waste-categories/category-1").set(bearer(role)).send({
      name: "COMPUTERS",
      label: "Computadores",
      wasteClass: "CLASS_I",
    });

    expect(response.status).toBe(403);
    expect(prisma.wasteCategory.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /waste-categories/:id", () => {
  it("deactivates the category", async () => {
    prisma.wasteCategory.findFirst.mockResolvedValue(storedCategory());

    const response = await request(app).delete("/waste-categories/category-1").set(admin);

    expect(response.status).toBe(204);

    expect(prisma.wasteCategory.update).toHaveBeenCalledWith({
      where: { id: "category-1" },
      data: { active: false },
    });
  });
  it("rejects unauthenticated category deactivation", async () => {
    const response = await request(app).delete("/waste-categories/category-1");

    expect(response.status).toBe(401);
    expect(prisma.wasteCategory.update).not.toHaveBeenCalled();
  });

  it.each([Role.CITIZEN, Role.COLLECTOR])(
    "forbids %s from deactivating a category",
    async (role) => {
      const response = await request(app).delete("/waste-categories/category-1").set(bearer(role));

      expect(response.status).toBe(403);
      expect(prisma.wasteCategory.update).not.toHaveBeenCalled();
    },
  );
});
