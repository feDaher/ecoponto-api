import type { WasteCategory } from "../entities/WasteCategory";

export interface CreateWasteCategoryData {
  name: string;
}

export interface UpdateWasteCategoryData {
  name?: string;
  active?: boolean;
}

export interface IWasteCategoryRepository {
  create(data: CreateWasteCategoryData): Promise<WasteCategory>;
  findById(id: string): Promise<WasteCategory | null>;
  findByName(name: string): Promise<WasteCategory | null>;
  findMany(): Promise<WasteCategory[]>;
  update(id: string, data: UpdateWasteCategoryData): Promise<WasteCategory>;
  deactivate(id: string): Promise<void>;
}
