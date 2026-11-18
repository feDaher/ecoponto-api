import { AppError } from "../../../../shared/errors/AppError";

// // Manhuaçu opera em UTC-3, a meia noite equivale às 03:00 UTC.
const BRASILIA_OFFSET_HOURS = 3;
const MAX_PERIOD_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

export function toUtcRange(from: string, to: string): { gte: Date; lt: Date } {
  const start = parseIsoDate(from);
  const endExclusive = new Date(parseIsoDate(to).getTime() + DAY_MS);
  const offsetMs = BRASILIA_OFFSET_HOURS * 60 * 60 * 1000;

  return {
    gte: new Date(start.getTime() + offsetMs),
    lt: new Date(endExclusive.getTime() + offsetMs),
  };
}

export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const start = parseIsoDate(from).getTime();
  const end = parseIsoDate(to).getTime();
  const days = Math.round((end - start) / DAY_MS) + 1;

  const previousEnd = new Date(start - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * DAY_MS);

  return { from: toIsoDate(previousStart), to: toIsoDate(previousEnd) };
}

export function assertValidPeriod(from: string, to: string): void {
  const start = parseIsoDate(from).getTime();
  const end = parseIsoDate(to).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new AppError("Invalid report period.", 400);
  }

  if (start > end) {
    throw new AppError("Invalid report period: 'from' must be on or before 'to'.", 400);
  }

  const days = Math.round((end - start) / DAY_MS) + 1;
  if (days > MAX_PERIOD_DAYS) {
    throw new AppError(`Report period cannot exceed ${MAX_PERIOD_DAYS} days.`, 400);
  }
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
