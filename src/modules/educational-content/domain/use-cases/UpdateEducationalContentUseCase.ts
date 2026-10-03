import { AppError } from "../../../../shared/errors/AppError";
import type {
  IEducationalContentRepository,
  UpdateEducationalContentData,
} from "../repositories/IEducationalContentRepository";

export class UpdateEducationalContentUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  async execute(id: string, data: UpdateEducationalContentData) {
    const content = await this.educationalContentRepository.findById(id);
    if (!content) {
      throw new AppError("Content not found", 404);
    }
    const update = await this.educationalContentRepository.update(id, data);
    return update;
  }
}
