import type { Weekday } from "../../../../generated/prisma/enums";
import { fromTime } from "../../../../shared/time/time-of-day";
import type { PublicOperatingHour } from "../../domain/repositories/ICollectionPointSearchRepository";

// Horários vêm sempre da tabela OperatingHours (somente os ativos).
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

export function withFormattedHours<T extends { hours: StoredOperatingHour[] }>(
  point: T,
): Omit<T, "hours"> & { hours: PublicOperatingHour[] } {
  return {
    ...point,
    hours: point.hours.map(({ id, weekday, openTime, closeTime, isActive }) => ({
      id,
      weekday,
      openTime: fromTime(openTime),
      closeTime: fromTime(closeTime),
      isActive,
    })),
  };
}
