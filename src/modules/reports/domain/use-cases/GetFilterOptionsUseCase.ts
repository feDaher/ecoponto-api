import { enrich } from "../catalog/CategoryCatalog";
import type { FilterOptions } from "../entities/Report";
import { DisposalStatus } from "../../../../generated/prisma/enums";
import type { IReportRepository } from "../repositories/IReportRepository";

export class GetFilterOptionsUseCase {
  constructor(private readonly repository: IReportRepository) {}

  async execute(): Promise<FilterOptions> {
    const [categories, regions] = await Promise.all([
      this.repository.listCategories(),
      this.repository.listRegions(),
    ]);

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        displayName: enrich(category.name).displayName,
      })),
      regions: [...new Set(regions)].sort(),
      statuses: [
        { value: DisposalStatus.CONFIRMED, label: "Confirmado" },
        { value: DisposalStatus.PENDING, label: "Pendente" },
        { value: DisposalStatus.CANCELLED, label: "Cancelado" },
      ],
    };
  }
}
