import type {
  ContentFormat,
  ContentLevel,
  ContentStatus,
} from "../../../../generated/prisma/enums";
import type { EducationalContent } from "../entities/EducationalContent";

export interface CreateEducationalContentData {
  categoryId: string;
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
  publishedAt: Date | null;
}

export type UpdateEducationalContentData = Partial<CreateEducationalContentData>;

export interface PublishedContentFilter {
  categoryId?: string;
  format?: ContentFormat;
}

export type ContentSort = "recent" | "views" | "title";

export interface ManagedContentFilter extends PublishedContentFilter {
  status?: ContentStatus;
  level?: ContentLevel;
  search?: string;
  sort: ContentSort;
  page: number;
  pageSize: number;
}

export interface ContentPage {
  items: EducationalContent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EducationalContentStats {
  total: number;
  published: number;
  drafts: number;
  pendingReview: number;
  addedThisMonth: number;
  totalViews: number;
  byFormat: Record<ContentFormat, number>;
}

export interface IEducationalContentRepository {
  create(data: CreateEducationalContentData): Promise<EducationalContent>;
  findById(id: string): Promise<EducationalContent | null>;
  findBySlug(slug: string): Promise<EducationalContent | null>;
  findPublished(filter: PublishedContentFilter): Promise<EducationalContent[]>;
  findPublishedById(id: string): Promise<EducationalContent | null>;
  findFeatured(): Promise<EducationalContent | null>;
  findManaged(filter: ManagedContentFilter): Promise<ContentPage>;
  getStats(monthStart: Date): Promise<EducationalContentStats>;
  update(id: string, data: UpdateEducationalContentData): Promise<EducationalContent>;
  incrementViews(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
