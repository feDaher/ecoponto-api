import type { EducationalContent } from "../entities/EducationaContent";

export interface CreateEducationalContentData {
  categoryId: string;
  title: string;
  content: string;
}

export interface UpdateEducationalContentData {
  categoryId?: string;
  title?: string;
  content?: string;
}

export interface IEducationalContentRepository {
  create(data: CreateEducationalContentData): Promise<EducationalContent>;
  findById(id: string): Promise<EducationalContent | null>;
  findByCategory(categoryId: string): Promise<EducationalContent[]>;
  findMany(): Promise<EducationalContent[]>;
  update(id: string, data: UpdateEducationalContentData): Promise<EducationalContent>;
  delete(id: string): Promise<EducationalContent> | null;
}
