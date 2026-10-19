import type { Weekday } from "../../../../generated/prisma/enums";
import type { OperatingHours } from "../entities/OperatingHours";

export interface CreateOperatingHoursData {
  collectionPointId: string;
  weekday: Weekday;
  openTime: string;
  closeTime: string;
}

export interface UpdateOperatingHoursData {
  weekday?: Weekday;
  openTime?: string;
  closeTime?: string;
}

export interface IOperatingHoursRepository {
  create(data: CreateOperatingHoursData): Promise<OperatingHours>;
  findById(id: string): Promise<OperatingHours | null>;
  findByCollectionPointId(collectionPointId: string): Promise<OperatingHours[]>;
  update(id: string, data: UpdateOperatingHoursData): Promise<OperatingHours>;
  delete(id: string): Promise<void>;
  markOutdatedBefore(date: Date): Promise<number>;
}
