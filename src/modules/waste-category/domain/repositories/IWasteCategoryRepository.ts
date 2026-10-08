import type { WasteCategory } from "../entities/WasteCategory";

export interface IWasteCategoryRepository {
  findById(id: string): Promise<WasteCategory | null>;
}
