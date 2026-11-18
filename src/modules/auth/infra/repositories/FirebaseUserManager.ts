import { firebaseAuth } from "../../../../config/firebase";
import type { IFirebaseUserManager } from "../../domain/repositories/IFirebaseUserManager";

export class FirebaseUserManager implements IFirebaseUserManager {
  async setDisabled(firebaseUid: string, disabled: boolean): Promise<void> {
    await firebaseAuth.updateUser(firebaseUid, { disabled });
  }
}
