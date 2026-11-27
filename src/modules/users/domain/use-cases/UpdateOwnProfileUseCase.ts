import type {
  IUserRepository,
  UpdateProfileData,
} from "../../../auth/domain/repositories/IUserRepository";
import type { User } from "../../../auth/domain/entities/User";
import { AppError } from "../../../../shared/errors/AppError";

export interface OwnPreferencesInput {
  collectionAlerts?: boolean;
  monthlyReports?: boolean;
  cooperativeContact?: boolean;
}

export interface UpdateOwnProfileInput {
  name: string;
  phone: string;
  city: string;
  nickname?: string | null;
  preferences?: OwnPreferencesInput;
}

function consentChange(user: User, cooperativeContact: boolean | undefined, now: Date) {
  if (cooperativeContact === undefined) return {};
  if (!cooperativeContact) {
    return { allowCooperativeContact: false, cooperativeContactConsentAt: null };
  }
  return {
    allowCooperativeContact: true,
    ...(user.cooperativeContactConsentAt === null && { cooperativeContactConsentAt: now }),
  };
}

export class UpdateOwnProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string, input: UpdateOwnProfileInput, now: Date = new Date()) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }

    const { preferences = {} } = input;
    const data: UpdateProfileData = {
      name: input.name,
      phone: input.phone,
      city: input.city,
      ...(input.nickname !== undefined && { nickname: input.nickname }),
      ...(preferences.collectionAlerts !== undefined && {
        notifyCollectionAlerts: preferences.collectionAlerts,
      }),
      ...(preferences.monthlyReports !== undefined && {
        notifyMonthlyReports: preferences.monthlyReports,
      }),
      ...consentChange(user, preferences.cooperativeContact, now),
    };

    return this.userRepository.updateProfile(user.id, data);
  }
}
