const tx = {
  educationalContent: {
    updateMany: jest.fn(async () => ({ count: 1 })),
    create: jest.fn(async ({ data }: { data: object }) => ({ id: "content-new", ...data })),
    update: jest.fn(async ({ data }: { data: object }) => ({ id: "content-1", ...data })),
  },
};

const client = {
  $transaction: jest.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
  educationalContent: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../src/config/prisma", () => ({ prisma: client, prismaRead: client }));

import { ContentStatus } from "../../src/generated/prisma/enums";
import { PrismaEducationalContentRepository } from "../../src/modules/educational-content/infra/repositories/PrismaEducationalContentRepository";

const repository = new PrismaEducationalContentRepository();

const data = {
  categoryId: "category-plastic",
  title: "Pilhas",
  slug: "pilhas",
  summary: "Resumo",
  content: "Conteúdo",
  format: "DISPOSAL_GUIDE" as const,
  level: "ESSENTIAL" as const,
  readingTimeMinutes: 3,
  xpReward: 0,
  coverImageUrl: null,
  status: ContentStatus.PUBLISHED,
  publishedAt: new Date(),
};

describe("single featured content", () => {
  it("unfeatures the current highlight in the same transaction that creates the new one", async () => {
    await repository.create({ ...data, featured: true });

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.educationalContent.updateMany).toHaveBeenCalledWith({
      where: { featured: true },
      data: { featured: false },
    });
    expect(tx.educationalContent.create).toHaveBeenCalled();
    expect(client.educationalContent.create).not.toHaveBeenCalled();
  });

  it("unfeatures every other content when featuring an existing one", async () => {
    await repository.update("content-1", { featured: true });

    expect(tx.educationalContent.updateMany).toHaveBeenCalledWith({
      where: { featured: true, id: { not: "content-1" } },
      data: { featured: false },
    });
    expect(tx.educationalContent.update).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { featured: true },
    });
  });

  it("skips the transaction when the content is not featured", async () => {
    await repository.create({ ...data, featured: false });

    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.educationalContent.create).toHaveBeenCalled();
  });
});
