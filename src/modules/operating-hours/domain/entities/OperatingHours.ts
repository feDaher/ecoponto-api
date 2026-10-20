import type { Weekday } from "../../../../generated/prisma/enums";

export interface OperatingHours {
  id: string;
  collectionPointId: string;
  weekday: Weekday;
  openTime: string;
  closeTime: string;
  isActive: boolean;
}
