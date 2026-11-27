import type { WasteClass } from "../../../../generated/prisma/enums";

export interface WasteCategory {
  id: string;
  name: string;
  label: string | null;
  wasteClass: WasteClass | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
