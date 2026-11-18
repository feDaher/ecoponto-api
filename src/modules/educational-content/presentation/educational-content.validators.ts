import { z } from "zod";
import { ContentFormat, ContentLevel, ContentStatus } from "../../../generated/prisma/enums";

const contentFields = {
  categoryId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(191),
  slug: z
    .string()
    .trim()
    .max(191)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase words separated by hyphens"),
  summary: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1),
  format: z.enum(ContentFormat),
  level: z.enum(ContentLevel),
  readingTimeMinutes: z.number().int().min(1).max(60),
  xpReward: z.number().int().min(0).max(100),
  coverImageUrl: z
    .string()
    .trim()
    .max(1000)
    .regex(/^https?:\/\/\S+$/i, "coverImageUrl must be an http(s) URL")
    .nullable(),
  status: z.enum(ContentStatus),
  featured: z.boolean(),
};

export const createEducationalContentSchema = z.object({
  categoryId: contentFields.categoryId,
  title: contentFields.title,
  slug: contentFields.slug.optional(),
  summary: contentFields.summary,
  content: contentFields.content,
  format: contentFields.format.default(ContentFormat.DISPOSAL_GUIDE),
  level: contentFields.level.default(ContentLevel.ESSENTIAL),
  readingTimeMinutes: contentFields.readingTimeMinutes.default(3),
  xpReward: contentFields.xpReward.default(0),
  coverImageUrl: contentFields.coverImageUrl.default(null),
  status: contentFields.status.default(ContentStatus.DRAFT),
  featured: contentFields.featured.default(false),
});

export const updateEducationalContentSchema = z
  .object(contentFields)
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export const listEducationalContentsQuerySchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  format: z.enum(ContentFormat).optional(),
});

export const listManagedEducationalContentsQuerySchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  format: z.enum(ContentFormat).optional(),
  status: z.enum(ContentStatus).optional(),
  level: z.enum(ContentLevel).optional(),
  search: z.string().trim().min(1).max(191).optional(),
  sort: z.enum(["recent", "views", "title"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
