import type { Weekday } from "../../../../generated/prisma/enums";
import { fromTime } from "../../../../shared/time/time-of-day";
import type { PublicOperatingHour } from "../../domain/repositories/ICollectionPointSearchRepository";

export const activeHoursInclude = {
  hours: {
    where: { isActive: true },
    orderBy: [{ weekday: "asc" as const }, { openTime: "asc" as const }],
  },
};

interface StoredOperatingHour {
  id: string;
  weekday: Weekday;
  openTime: Date;
  closeTime: Date;
  isActive: boolean;
}

export function formatHours(hours: StoredOperatingHour[]): PublicOperatingHour[] {
  return hours.map(({ id, weekday, openTime, closeTime, isActive }) => ({
    id,
    weekday,
    openTime: fromTime(openTime),
    closeTime: fromTime(closeTime),
    isActive,
  }));
}
