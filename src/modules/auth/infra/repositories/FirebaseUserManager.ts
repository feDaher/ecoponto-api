import { firebaseAuth } from "../../../../config/firebase";
import type { IFirebaseUserManager } from "../../domain/repositories/IFirebaseUserManager";

function isUserNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "auth/user-not-found"
  );
}

export class FirebaseUserManager implements IFirebaseUserManager {
  async setDisabled(firebaseUid: string, disabled: boolean): Promise<void> {
    await firebaseAuth.updateUser(firebaseUid, { disabled });
  }

  async deleteUser(firebaseUid: string): Promise<void> {
    try {
      await firebaseAuth.deleteUser(firebaseUid);
    } catch (error) {
      if (!isUserNotFound(error)) {
        throw error;
      }
    }
  }
}
