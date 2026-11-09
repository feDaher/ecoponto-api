import { Role } from "../../src/generated/prisma/enums";
import type { User } from "../../src/modules/auth/domain/entities/User";
import type { IFirebaseUserManager } from "../../src/modules/auth/domain/repositories/IFirebaseUserManager";
import type { IUserRepository } from "../../src/modules/auth/domain/repositories/IUserRepository";
import { BlockUserUseCase } from "../../src/modules/users/domain/use-cases/BlockUserUseCase";
import { UpdateUserRoleUseCase } from "../../src/modules/users/domain/use-cases/UpdateUserRoleUseCase";
import { updateUserRoleSchema } from "../../src/modules/users/presentation/validators/UpdateUserRoleValidator";

const target: User = {
  id: "user-1",
  firebaseUid: "firebase-1",
  name: "Usuario Teste",
  email: "teste@example.com",
  phone: "31999999999",
  city: "Manhuacu",
  role: Role.CITIZEN,
  isBlocked: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repositoryWith(user: User | null) {
  return {
    create: jest.fn(),
    findByFirebaseUid: jest.fn(),
    findById: jest.fn(async () => user),
    findMany: jest.fn(),
    updateBlockedStatus: jest.fn(async (_id: string, isBlocked: boolean) => ({
      ...target,
      isBlocked,
    })),
    updateRole: jest.fn(async (_id: string, role: Role) => ({ ...target, role })),
  } as unknown as jest.Mocked<IUserRepository>;
}

const firebaseManager = () =>
  ({
    setDisabled: jest.fn(async (_firebaseUid: string, _disabled: boolean) => undefined),
  }) as jest.Mocked<IFirebaseUserManager>;

describe("UpdateUserRoleUseCase", () => {
  it("changes another user's role", async () => {
    const repository = repositoryWith(target);

    const updated = await new UpdateUserRoleUseCase(repository).execute(
      "admin-1",
      target.id,
      Role.COLLECTOR,
    );

    expect(updated.role).toBe(Role.COLLECTOR);
    expect(repository.updateRole).toHaveBeenCalledWith(target.id, Role.COLLECTOR);
  });

  it("refuses to change the admin's own role", async () => {
    const repository = repositoryWith(target);

    await expect(
      new UpdateUserRoleUseCase(repository).execute("admin-1", "admin-1", Role.CITIZEN),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown user", async () => {
    const repository = repositoryWith(null);

    await expect(
      new UpdateUserRoleUseCase(repository).execute("admin-1", "missing", Role.ADMIN),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.updateRole).not.toHaveBeenCalled();
  });
});

describe("BlockUserUseCase", () => {
  it("refuses to block the admin's own account, without touching Firebase", async () => {
    const repository = repositoryWith(target);
    const firebase = firebaseManager();

    await expect(
      new BlockUserUseCase(repository, firebase).execute("admin-1", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(firebase.setDisabled).not.toHaveBeenCalled();
    expect(repository.updateBlockedStatus).not.toHaveBeenCalled();
  });

  it("disables the Firebase account and marks the user as blocked", async () => {
    const repository = repositoryWith(target);
    const firebase = firebaseManager();

    const blocked = await new BlockUserUseCase(repository, firebase).execute("admin-1", target.id);

    expect(firebase.setDisabled).toHaveBeenCalledWith(target.firebaseUid, true);
    expect(blocked.isBlocked).toBe(true);
  });
});

describe("updateUserRoleSchema", () => {
  it("accepts every existing role", () => {
    for (const role of Object.values(Role)) {
      expect(updateUserRoleSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it("rejects unknown roles and extra fields", () => {
    expect(updateUserRoleSchema.safeParse({ role: "ROOT" }).success).toBe(false);
    expect(updateUserRoleSchema.safeParse({ role: Role.CITIZEN, isBlocked: true }).success).toBe(
      false,
    );
  });
});
