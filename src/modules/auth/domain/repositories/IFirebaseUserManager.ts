export interface IFirebaseUserManager {
  setDisabled(firebaseUid: string, disabled: boolean): Promise<void>;
}
