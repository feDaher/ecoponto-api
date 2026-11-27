jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const cooperative = {
  cooperativeName: "Cooperativa Recicla Manhuaçu",
  cnpj: "11.222.333/0001-81",
  street: "Avenida Getúlio Vargas",
  streetNumber: "120",
  neighborhood: "Centro",
  state: "MG",
  postalCode: "36900-000",
  email: "contato@cooperativa.org.br",
};

const point = {
  id: "point-1",
  collectorId: users[Role.COLLECTOR].id,
  name: "Eco Ponto Centro",
  description: "Entrada pela rua lateral.",
  city: "Manhuaçu",
  address: "Avenida Getúlio Vargas, 120",
  latitude: -20.258,
  longitude: -42.0336,
  locationSource: "GPS_COORDINATES",
  placeId: null,
  whatsappContact: "33999990000",
  showWhatsappContact: true,
  status: "PENDING",
  hoursConfirmedAt: new Date("2026-11-22T12:00:00.000Z"),
  isOutdated: false,
  createdAt: new Date("2026-11-22T12:00:00.000Z"),
  updatedAt: new Date("2026-11-22T12:00:00.000Z"),
  categories: [{ category: { name: "PLASTIC" } }],
  hours: [],
};

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  prisma.$transaction.mockImplementation(
    async (callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma),
  );
});

it("persists cooperative details with a new point in one transaction", async () => {
  prisma.wasteCategory.findMany.mockResolvedValue([
    { id: "category-plastic", name: "PLASTIC", active: true },
  ]);
  prisma.collectionPoint.create.mockResolvedValue(point);
  prisma.collectionPointConfiguration.create.mockResolvedValue({
    collectionPointId: point.id,
    street: cooperative.street,
    streetNumber: cooperative.streetNumber,
    neighborhood: cooperative.neighborhood,
    state: cooperative.state,
    postalCode: "36900000",
    createdAt: new Date("2026-11-22T12:00:00.000Z"),
    updatedAt: new Date("2026-11-22T12:00:00.000Z"),
  });
  prisma.cooperativeProfile.upsert.mockResolvedValue({
    collectorId: point.collectorId,
    cooperativeName: cooperative.cooperativeName,
    cnpj: "11222333000181",
    email: cooperative.email,
    createdAt: new Date("2026-11-22T12:00:00.000Z"),
    updatedAt: new Date("2026-11-22T12:00:00.000Z"),
  });

  const response = await request(app)
    .post("/collection-points")
    .set(bearer(Role.COLLECTOR))
    .send({
      name: point.name,
      description: point.description,
      city: point.city,
      address: point.address,
      latitude: point.latitude,
      longitude: point.longitude,
      whatsappContact: point.whatsappContact,
      showWhatsappContact: true,
      wasteCategories: ["PLASTIC"],
      operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
      cooperative,
    });

  expect(response.status).toBe(201);
  expect(response.body.cooperative).toMatchObject({
    ...cooperative,
    cnpj: "11222333000181",
    postalCode: "36900000",
  });
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.collectionPointConfiguration.create).toHaveBeenCalledWith({
    data: {
      collectionPointId: point.id,
      street: cooperative.street,
      streetNumber: cooperative.streetNumber,
      neighborhood: cooperative.neighborhood,
      state: cooperative.state,
      postalCode: "36900000",
    },
  });
  expect(prisma.cooperativeProfile.upsert).toHaveBeenCalledWith({
    where: { collectorId: point.collectorId },
    create: {
      collectorId: point.collectorId,
      cooperativeName: cooperative.cooperativeName,
      cnpj: "11222333000181",
      email: cooperative.email,
    },
    update: {
      cooperativeName: cooperative.cooperativeName,
      cnpj: "11222333000181",
      email: cooperative.email,
    },
  });
});

it("rejects an invalid CNPJ before creating any database record", async () => {
  const response = await request(app)
    .post("/collection-points")
    .set(bearer(Role.COLLECTOR))
    .send({
      name: point.name,
      city: point.city,
      address: point.address,
      latitude: point.latitude,
      longitude: point.longitude,
      showWhatsappContact: false,
      wasteCategories: ["PLASTIC"],
      operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
      cooperative: { ...cooperative, cnpj: "11.222.333/0001-82" },
    });

  expect(response.status).toBe(400);
  expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  expect(prisma.collectionPointConfiguration.create).not.toHaveBeenCalled();
});

it("updates point details, cooperative data, and hours together", async () => {
  prisma.collectionPoint.findUnique.mockResolvedValue({
    id: point.id,
    collectorId: point.collectorId,
    status: "APPROVED",
  });
  prisma.wasteCategory.findMany.mockResolvedValue([
    { id: "category-plastic", name: "PLASTIC", active: true },
  ]);
  prisma.collectionPoint.update.mockResolvedValue(point);
  prisma.collectionPointConfiguration.upsert.mockResolvedValue({
    collectionPointId: point.id,
    street: cooperative.street,
    streetNumber: cooperative.streetNumber,
    neighborhood: cooperative.neighborhood,
    state: cooperative.state,
    postalCode: "36900000",
    createdAt: new Date("2026-11-22T12:00:00.000Z"),
    updatedAt: new Date("2026-11-22T12:00:00.000Z"),
  });
  prisma.cooperativeProfile.upsert.mockResolvedValue({
    collectorId: point.collectorId,
    cooperativeName: cooperative.cooperativeName,
    cnpj: "11222333000181",
    email: cooperative.email,
    createdAt: new Date("2026-11-22T12:00:00.000Z"),
    updatedAt: new Date("2026-11-22T12:00:00.000Z"),
  });

  const response = await request(app)
    .put(`/collection-points/${point.id}`)
    .set(bearer(Role.COLLECTOR))
    .send({
      name: point.name,
      description: point.description,
      city: point.city,
      address: point.address,
      latitude: point.latitude,
      longitude: point.longitude,
      whatsappContact: point.whatsappContact,
      showWhatsappContact: true,
      wasteCategories: ["PLASTIC"],
      operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
      cooperative,
    });

  expect(response.status).toBe(200);
  expect(response.body.cooperative).toMatchObject({
    ...cooperative,
    cnpj: "11222333000181",
    postalCode: "36900000",
  });
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.collectionPointConfiguration.upsert).toHaveBeenCalledWith({
    where: { collectionPointId: point.id },
    create: {
      collectionPointId: point.id,
      street: cooperative.street,
      streetNumber: cooperative.streetNumber,
      neighborhood: cooperative.neighborhood,
      state: cooperative.state,
      postalCode: "36900000",
    },
    update: {
      street: cooperative.street,
      streetNumber: cooperative.streetNumber,
      neighborhood: cooperative.neighborhood,
      state: cooperative.state,
      postalCode: "36900000",
    },
  });
  expect(prisma.cooperativeProfile.upsert).toHaveBeenCalledWith({
    where: { collectorId: point.collectorId },
    create: {
      collectorId: point.collectorId,
      cooperativeName: cooperative.cooperativeName,
      cnpj: "11222333000181",
      email: cooperative.email,
    },
    update: {
      cooperativeName: cooperative.cooperativeName,
      cnpj: "11222333000181",
      email: cooperative.email,
    },
  });
});

it("returns the saved cooperative details with the collector's points", async () => {
  prisma.collectionPoint.findMany.mockResolvedValue([point]);
  prisma.collectionPointConfiguration.findMany.mockResolvedValue([
    {
      collectionPointId: point.id,
      street: cooperative.street,
      streetNumber: cooperative.streetNumber,
      neighborhood: cooperative.neighborhood,
      state: cooperative.state,
      postalCode: "36900000",
      createdAt: new Date("2026-11-22T12:00:00.000Z"),
      updatedAt: new Date("2026-11-22T12:00:00.000Z"),
    },
  ]);
  prisma.cooperativeProfile.findMany.mockResolvedValue([
    {
      collectorId: point.collectorId,
      cooperativeName: cooperative.cooperativeName,
      cnpj: "11222333000181",
      email: cooperative.email,
      createdAt: new Date("2026-11-22T12:00:00.000Z"),
      updatedAt: new Date("2026-11-22T12:00:00.000Z"),
    },
  ]);

  const response = await request(app).get("/collection-points/mine").set(bearer(Role.COLLECTOR));

  expect(response.status).toBe(200);
  expect(response.body[0].cooperative).toMatchObject({
    ...cooperative,
    cnpj: "11222333000181",
    postalCode: "36900000",
  });
  expect(prisma.collectionPointConfiguration.findMany).toHaveBeenCalledWith({
    where: { collectionPointId: { in: [point.id] } },
  });
});
