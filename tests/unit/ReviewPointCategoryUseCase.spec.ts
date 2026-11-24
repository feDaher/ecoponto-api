import { ReviewPointCategoryUseCase } from "../../src/modules/collection-points/domain/use-cases/ReviewPointCategoryUseCase";
import { PointCategory } from "../../src/modules/collection-points/domain/entities/PointCategory";
import type { ICollectionPointRepository } from "../../src/modules/collection-points/domain/repositories/ICollectionPointRepository";

function makeRepo(current: PointCategory[]) {
  return {
    findCategoriesByPointId: jest.fn().mockResolvedValue(current),
    reviewCategory: jest.fn().mockResolvedValue(true),
  };
}

const asRepository = (repo: ReturnType<typeof makeRepo>) =>
  repo as unknown as ICollectionPointRepository;

const pending = new PointCategory("p1", "c2", "GLASS", "PENDING");

describe("ReviewPointCategoryUseCase", () => {
  it("aprova categoria pendente", async () => {
    const repo = makeRepo([pending]);

    await new ReviewPointCategoryUseCase(asRepository(repo)).execute({
      pointId: "p1",
      categoryId: "c2",
      adminId: "admin-1",
      status: "APPROVED",
    });

    expect(repo.reviewCategory).toHaveBeenCalledWith("p1", "c2", {
      decision: "APPROVED",
      reason: null,
      reviewedById: "admin-1",
    });
  });

  it("rejeita categoria pendente com motivo", async () => {
    const repo = makeRepo([pending]);

    await new ReviewPointCategoryUseCase(asRepository(repo)).execute({
      pointId: "p1",
      categoryId: "c2",
      adminId: "admin-1",
      status: "REJECTED",
      rejectionReason: "  Categoria não atendida pelo ponto  ",
    });

    // The reason is persisted (trimmed) together with who decided.
    expect(repo.reviewCategory).toHaveBeenCalledWith("p1", "c2", {
      decision: "REJECTED",
      reason: "Categoria não atendida pelo ponto",
      reviewedById: "admin-1",
    });
  });

  it("400 ao rejeitar sem motivo", async () => {
    const repo = makeRepo([pending]);

    await expect(
      new ReviewPointCategoryUseCase(asRepository(repo)).execute({
        pointId: "p1",
        categoryId: "c2",
        adminId: "admin-1",
        status: "REJECTED",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.reviewCategory).not.toHaveBeenCalled();
  });

  it("404 se a categoria não está no ponto", async () => {
    const repo = makeRepo([]);

    await expect(
      new ReviewPointCategoryUseCase(asRepository(repo)).execute({
        pointId: "p1",
        categoryId: "c2",
        adminId: "admin-1",
        status: "APPROVED",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409 se a categoria já está aprovada", async () => {
    const repo = makeRepo([new PointCategory("p1", "c2", "GLASS", "APPROVED")]);

    await expect(
      new ReviewPointCategoryUseCase(asRepository(repo)).execute({
        pointId: "p1",
        categoryId: "c2",
        adminId: "admin-1",
        status: "APPROVED",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
