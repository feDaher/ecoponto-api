import { AppError } from "../../../../shared/errors/AppError";
import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
export async function ensureActiveWasteCategories(
  repository: IWasteCategoryRepository,
  codes: string[],
) {
  const categories = await repository.findActiveByNames(codes);
  const activeCodes = new Set(categories.map(({ name }) => name));
  const invalidCodes = codes.filter((code) => !activeCodes.has(code));
  if (invalidCodes.length > 0) {
    throw new AppError(
      `Categorias de resíduos inexistentes ou inativas: ${invalidCodes.join(", ")}`,
      400,
    );
  }
  return categories.map(({ id }) => id);
}
