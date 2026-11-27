import { toUserPreferences, type User } from "../domain/entities/User";

export function toUserResponse(user: User) {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    name: user.name,
    email: user.email,
    phone: user.phone,
    city: user.city,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    nickname: user.nickname,
    preferences: toUserPreferences(user),
  };
}
