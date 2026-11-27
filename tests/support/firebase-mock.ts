export const firebaseAuth = {
  verifyIdToken: jest.fn(),
  deleteUser: jest.fn(async (_uid: string) => undefined),
};
