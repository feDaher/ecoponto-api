import { UnblockUserUseCase } from "../../src/modules/users/domain/use-cases/UnblockUserUseCase";
import type {
  IUserRepository,
  CreateUserData,
  UpdateProfileData,
  AnonymizedUserData,
  AnonymizeOptions,
  AnonymizeResult,
} from "../../src/modules/auth/domain/repositories/IUserRepository";
import type { IFirebaseUserManager } from "../../src/modules/auth/domain/repositories/IFirebaseUserManager";
import type { User } from "../../src/modules/auth/domain/entities/User";
import { Role } from "../../src/generated/prisma/enums";

describe("UnblockUserUseCase", () => {
  it("should report an error when Firebase fails after MySQL unblock", async () => {
    const user: User = {
      id: "user-123",
      firebaseUid: "firebase-123",
      name: "Usuario Teste",
      email: "teste@example.com",
      phone: "31999999999",
      city: "Manhuacu",
      role: Role.CITIZEN,
      isBlocked: true,
      nickname: null,
      notifyCollectionAlerts: true,
      notifyMonthlyReports: true,
      allowCooperativeContact: false,
      cooperativeContactConsentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedUser: User = {
      ...user,
      isBlocked: false,
    };

    const userRepository = {
      create: jest.fn(async (_data: CreateUserData) => user),

      findByFirebaseUid: jest.fn(async (_firebaseUid: string): Promise<User | null> => null),

      findById: jest.fn(async (_id: string) => user),

      findMany: jest.fn(async () => [user]),

      updateBlockedStatus: jest.fn(async (_id: string, _isBlocked: boolean) => updatedUser),

      updateRole: jest.fn(async (_id: string, _role: Role) => user),

      updateProfile: jest.fn(async (_id: string, _data: UpdateProfileData) => user),

      anonymize: jest.fn(
        async (
          _id: string,
          _data: AnonymizedUserData,
          _options: AnonymizeOptions,
        ): Promise<AnonymizeResult> => "ANONYMIZED",
      ),
    } satisfies IUserRepository;

    const firebaseUserManager = {
      setDisabled: jest.fn(async (_firebaseUid: string, _disabled: boolean): Promise<void> => {
        throw new Error("Simulated Firebase failure");
      }),
      deleteUser: jest.fn(async (_firebaseUid: string) => {}),
      updatePassword: jest.fn(async (_firebaseUid: string, _password: string) => {}),
      revokeSessions: jest.fn(async (_firebaseUid: string) => {}),
    } satisfies IFirebaseUserManager;

    const useCase = new UnblockUserUseCase(userRepository, firebaseUserManager);

    await expect(useCase.execute("admin-123", "user-123")).rejects.toMatchObject({
      statusCode: 500,
      message: "User unblock incomplete. Please retry the operation.",
    });

    expect(userRepository.updateBlockedStatus).toHaveBeenCalledWith("user-123", false);

    expect(firebaseUserManager.setDisabled).toHaveBeenCalledWith("firebase-123", false);
  });
});
