jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { ContentFormat, ContentStatus, Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const admin = bearer(Role.ADMIN);

function storedContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    categoryId: "category-plastic",
    title: "Como descartar plástico",
    slug: "como-descartar-plastico",
    summary: "Resumo",
    content: "Conteúdo",
    format: ContentFormat.DISPOSAL_GUIDE,
    level: "ESSENTIAL",
    readingTimeMinutes: 3,
    xpReward: 0,
    coverImageUrl: null,
    status: ContentStatus.PUBLISHED,
    featured: false,
    viewCount: 4,
    publishedAt: new Date("2026-11-01T12:00:00Z"),
    createdAt: new Date("2026-11-01T12:00:00Z"),
    updatedAt: new Date("2026-11-01T12:00:00Z"),
    ...overrides,
  };
}

const newContent = {
  categoryId: "category-plastic",
  title: "Como descartar plástico",
  summary: "Resumo",
  content: "Conteúdo",
};

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  prisma.wasteCategory.findFirst.mockResolvedValue({
    id: "category-plastic",
    name: "PLASTIC",
    active: true,
  });
});

describe("public educational content routes", () => {
  it("lists only published content, filtered by format, newest first", async () => {
    prisma.educationalContent.findMany.mockResolvedValue([storedContent()]);

    const response = await request(app).get("/educational-content?format=QUICK_FACT");

    expect(response.status).toBe(200);
    expect(prisma.educationalContent.findMany).toHaveBeenCalledWith({
      where: { status: ContentStatus.PUBLISHED, categoryId: undefined, format: "QUICK_FACT" },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    });
  });

  it("rejects an unknown format with 400", async () => {
    const response = await request(app).get("/educational-content?format=VIDEO");

    expect(response.status).toBe(400);
    expect(prisma.educationalContent.findMany).not.toHaveBeenCalled();
  });

  it("counts a view when a published content is opened", async () => {
    prisma.educationalContent.findFirst.mockResolvedValue(storedContent());

    const response = await request(app).get("/educational-content/content-1");

    expect(response.status).toBe(200);
    expect(response.body.viewCount).toBe(5);
    expect(prisma.educationalContent.findFirst).toHaveBeenCalledWith({
      where: { id: "content-1", status: ContentStatus.PUBLISHED },
    });
    expect(prisma.educationalContent.update).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { viewCount: { increment: 1 } },
    });
  });

  it("answers 404 for a draft without counting a view", async () => {
    const response = await request(app).get("/educational-content/content-1");

    expect(response.status).toBe(404);
    expect(prisma.educationalContent.update).not.toHaveBeenCalled();
  });
});

describe("admin educational content routes", () => {
  it("paginates with a stable order and returns the page metadata", async () => {
    prisma.educationalContent.findMany.mockResolvedValue([storedContent()]);
    prisma.educationalContent.count.mockResolvedValue(11);

    const response = await request(app)
      .get("/admin/educational-content?sort=views&page=3&pageSize=5&search=pet&status=DRAFT")
      .set(admin);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 11, page: 3, pageSize: 5 });
    expect(prisma.educationalContent.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: "DRAFT",
        OR: [{ title: { contains: "pet" } }, { slug: { contains: "pet" } }],
      }),
      orderBy: [{ viewCount: "desc" }, { id: "asc" }],
      skip: 10,
      take: 5,
    });
  });

  it.each([
    ["page size above 50", "pageSize=51"],
    ["page zero", "page=0"],
    ["unknown status", "status=ARCHIVED"],
    ["unknown sort", "sort=random"],
  ])("rejects %s with 400", async (_label, query) => {
    const response = await request(app).get(`/admin/educational-content?${query}`).set(admin);

    expect(response.status).toBe(400);
  });

  it("opens a draft by id without counting a view", async () => {
    prisma.educationalContent.findUnique.mockResolvedValue(
      storedContent({ status: ContentStatus.DRAFT }),
    );

    const response = await request(app).get("/admin/educational-content/content-1").set(admin);

    expect(response.status).toBe(200);
    expect(prisma.educationalContent.update).not.toHaveBeenCalled();
  });

  it("reports every format in the stats, including those without content", async () => {
    prisma.educationalContent.count.mockResolvedValue(3);
    prisma.educationalContent.aggregate.mockResolvedValue({ _sum: { viewCount: null } });
    prisma.educationalContent.groupBy.mockResolvedValue([
      { format: ContentFormat.QUICK_FACT, _count: { _all: 3 } },
    ]);

    const response = await request(app).get("/admin/educational-content/stats").set(admin);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 3, totalViews: 0 });
    expect(response.body.byFormat).toEqual({
      DISPOSAL_GUIDE: 0,
      DIY_TUTORIAL: 0,
      QUICK_FACT: 3,
      COMMUNITY_EVENT: 0,
    });
  });

  it("creates a draft by default", async () => {
    prisma.educationalContent.create.mockImplementation(async ({ data }) => storedContent(data));

    const response = await request(app).post("/educational-content").set(admin).send(newContent);

    expect(response.status).toBe(201);
    expect(prisma.educationalContent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: "como-descartar-plastico",
        status: ContentStatus.DRAFT,
        featured: false,
        publishedAt: null,
      }),
    });
  });

  it("turns a unique-slug race lost in the database into 409", async () => {
    prisma.educationalContent.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const response = await request(app).post("/educational-content").set(admin).send(newContent);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Slug already in use");
  });

  it.each([
    ["a javascript: cover URL", { coverImageUrl: "javascript:alert(1)" }],
    ["an uppercase slug", { slug: "Guia Rapido" }],
    ["a reading time above 60 minutes", { readingTimeMinutes: 61 }],
    ["an XP reward above 100", { xpReward: 101 }],
  ])("rejects %s with 400", async (_label, overrides) => {
    const response = await request(app)
      .post("/educational-content")
      .set(admin)
      .send({ ...newContent, ...overrides });

    expect(response.status).toBe(400);
    expect(prisma.educationalContent.create).not.toHaveBeenCalled();
  });
});
