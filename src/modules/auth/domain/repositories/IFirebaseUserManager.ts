export interface IFirebaseUserManager {
  setDisabled(firebaseUid: string, disabled: boolean): Promise<void>;
  deleteUser(firebaseUid: string): Promise<void>;
  updatePassword(firebaseUid: string, password: string): Promise<void>;
  revokeSessions(firebaseUid: string): Promise<void>;
}
