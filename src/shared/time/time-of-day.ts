export const toTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);
export const fromTime = (value: Date) => value.toISOString().slice(11, 16);
