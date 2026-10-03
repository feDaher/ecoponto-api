import { prisma } from "../../../../config/prisma";
import type {
  CreateEducationalContentData,
  IEducationalContentRepository,
  UpdateEducationalContentData,
} from "../../domain/repositories/IEducationalContentRepository";

export class PrismaEducationalContentRepository implements IEducationalContentRepository {
  create(data: CreateEducationalContentData) {
    return prisma.educationalContent.create({ data });
  }
  findById(id: string) {
    return prisma.educationalContent.findUnique({ where: { id } });
  }
  findMany() {
    return prisma.educationalContent.findMany();
  }
  update(id: string, data: UpdateEducationalContentData) {
    return prisma.educationalContent.update({
      where: { id },
      data,
    });
  }
  delete(id: string) {
    return prisma.educationalContent.delete({
      where: { id },
    });
  }
}
