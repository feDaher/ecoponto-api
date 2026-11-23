import { UpdatePointCategoriesUseCase } from "../../src/modules/collection-points/domain/use-cases/UpdatePointCategoriesUseCase";
import { PointCategory } from "../../src/modules/collection-points/domain/entities/PointCategory";
import type { ICollectionPointRepository } from "../../src/modules/collection-points/domain/repositories/ICollectionPointRepository";

const owner = { id: "u1", role: "COLLECTOR" };

function makeRepo(current: PointCategory[]) {
  return {
    findSummaryById: jest
      .fn()
      .mockResolvedValue({ id: "p1", collectorId: "u1", status: "APPROVED" }),
    findActiveCategoriesByNames: jest.fn(),
    findCategoriesByPointId: jest.fn().mockResolvedValue(current),
    applyCategoryChanges: jest.fn().mockResolvedValue(undefined),
  };
}

const asRepository = (repo: ReturnType<typeof makeRepo>) =>
  repo as unknown as ICollectionPointRepository;

describe("UpdatePointCategoriesUseCase", () => {
  it("remove categoria na hora", async () => {
    const repo = makeRepo([
      new PointCategory("p1", "c1", "PLASTIC", "APPROVED"),
      new PointCategory("p1", "c2", "GLASS", "APPROVED"),
    ]);
    repo.findActiveCategoriesByNames.mockResolvedValue([{ id: "c1", name: "PLASTIC" }]);

    await new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
      pointId: "p1",
      actor: owner,
      wasteCategories: ["PLASTIC"],
    });

    expect(repo.applyCategoryChanges).toHaveBeenCalledWith("p1", {
      removeIds: ["c2"],
      addIds: [],
    });
  });

  it("adiciona categoria (vai como pendente no repositório)", async () => {
    const repo = makeRepo([new PointCategory("p1", "c1", "PLASTIC", "APPROVED")]);
    repo.findActiveCategoriesByNames.mockResolvedValue([
      { id: "c1", name: "PLASTIC" },
      { id: "c2", name: "GLASS" },
    ]);

    await new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
      pointId: "p1",
      actor: owner,
      wasteCategories: ["PLASTIC", "GLASS"],
    });

    expect(repo.applyCategoryChanges).toHaveBeenCalledWith("p1", {
      removeIds: [],
      addIds: ["c2"],
    });
  });

  it("422 se o ponto ficar sem categoria aprovada", async () => {
    const repo = makeRepo([new PointCategory("p1", "c1", "PLASTIC", "APPROVED")]);
    repo.findActiveCategoriesByNames.mockResolvedValue([{ id: "c2", name: "GLASS" }]);

    await expect(
      new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
        pointId: "p1",
        actor: owner,
        wasteCategories: ["GLASS"],
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("403 para outro coletor", async () => {
    const repo = makeRepo([]);
    await expect(
      new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
        pointId: "p1",
        actor: { id: "outro", role: "COLLECTOR" },
        wasteCategories: ["PLASTIC"],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("admin pode alterar ponto de outro coletor", async () => {
    const repo = makeRepo([
      new PointCategory("p1", "c1", "PLASTIC", "APPROVED"),
      new PointCategory("p1", "c2", "GLASS", "APPROVED"),
    ]);
    repo.findActiveCategoriesByNames.mockResolvedValue([{ id: "c1", name: "PLASTIC" }]);

    await new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
      pointId: "p1",
      actor: { id: "admin-1", role: "ADMIN" },
      wasteCategories: ["PLASTIC"],
    });

    expect(repo.applyCategoryChanges).toHaveBeenCalled();
  });

  it("reenviar uma categoria que já está pendente não muda nada", async () => {
    const repo = makeRepo([
      new PointCategory("p1", "c1", "PLASTIC", "APPROVED"),
      new PointCategory("p1", "c2", "GLASS", "PENDING"),
    ]);
    repo.findActiveCategoriesByNames.mockResolvedValue([
      { id: "c1", name: "PLASTIC" },
      { id: "c2", name: "GLASS" },
    ]);

    await new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
      pointId: "p1",
      actor: owner,
      wasteCategories: ["PLASTIC", "GLASS"],
    });

    expect(repo.applyCategoryChanges).toHaveBeenCalledWith("p1", {
      removeIds: [],
      addIds: [],
    });
  });

  it("remover uma categoria pendente é permitido", async () => {
    const repo = makeRepo([
      new PointCategory("p1", "c1", "PLASTIC", "APPROVED"),
      new PointCategory("p1", "c2", "GLASS", "PENDING"),
    ]);
    repo.findActiveCategoriesByNames.mockResolvedValue([{ id: "c1", name: "PLASTIC" }]);

    await new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
      pointId: "p1",
      actor: owner,
      wasteCategories: ["PLASTIC"],
    });

    expect(repo.applyCategoryChanges).toHaveBeenCalledWith("p1", {
      removeIds: ["c2"],
      addIds: [],
    });
  });

  it("422 se sobrar só categoria pendente (nenhuma aprovada)", async () => {
    const repo = makeRepo([
      new PointCategory("p1", "c1", "PLASTIC", "APPROVED"),
      new PointCategory("p1", "c2", "GLASS", "PENDING"),
    ]);
    repo.findActiveCategoriesByNames.mockResolvedValue([{ id: "c2", name: "GLASS" }]);

    await expect(
      new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
        pointId: "p1",
        actor: owner,
        wasteCategories: ["GLASS"],
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.applyCategoryChanges).not.toHaveBeenCalled();
  });

  it("404 se o ponto não existe", async () => {
    const repo = makeRepo([]);
    repo.findSummaryById.mockResolvedValue(null);

    await expect(
      new UpdatePointCategoriesUseCase(asRepository(repo)).execute({
        pointId: "p1",
        actor: owner,
        wasteCategories: ["PLASTIC"],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
