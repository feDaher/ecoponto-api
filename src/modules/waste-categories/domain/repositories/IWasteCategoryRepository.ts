import type { WasteClass } from "../../../../generated/prisma/enums";
import type { WasteCategory } from "../entities/WasteCategory";

export interface CreateWasteCategoryData {
  name: string;
  label?: string | null;
  wasteClass?: WasteClass | null;
}

export interface UpdateWasteCategoryData {
  name?: string;
  label?: string | null;
  wasteClass?: WasteClass | null;
  active?: boolean;
}

export interface IWasteCategoryRepository {
  create(data: CreateWasteCategoryData): Promise<WasteCategory>;
  findById(id: string): Promise<WasteCategory | null>;
  findByName(name: string): Promise<WasteCategory | null>;
  findActiveByNames(names: string[]): Promise<WasteCategory[]>;
  findMany(): Promise<WasteCategory[]>;
  update(id: string, data: UpdateWasteCategoryData): Promise<WasteCategory>;
  deactivate(id: string): Promise<void>;
}
