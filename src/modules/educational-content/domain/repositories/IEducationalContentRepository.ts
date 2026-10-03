import type { EducationalContent } from "../entities/EducationaContent";

export interface CreateEducationalContentData {
  title: string;
  content: string;
}

export interface UpdateEducationalContentData {
  title?: string;
  content?: string;
}

export interface IEducationalContentRepository {
  create(data: CreateEducationalContentData): Promise<EducationalContent>;
  findById(id: string): Promise<EducationalContent | null>;
  findMany(): Promise<EducationalContent[]>;
  update(id: string, data: UpdateEducationalContentData): Promise<EducationalContent>;
  delete(id: string): Promise<EducationalContent> | null;
}
