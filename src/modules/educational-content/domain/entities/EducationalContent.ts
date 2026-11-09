import type {
  ContentFormat,
  ContentLevel,
  ContentStatus,
} from "../../../../generated/prisma/enums";

export interface EducationalContent {
  categoryId: string;
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  format: ContentFormat;
  level: ContentLevel;
  readingTimeMinutes: number;
  xpReward: number;
  coverImageUrl: string | null;
  status: ContentStatus;
  featured: boolean;
  viewCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 191)
    .replace(/^-+|-+$/g, "");
}
