export const firebaseAuth = {
  verifyIdToken: jest.fn(),
  deleteUser: jest.fn(async (_uid: string) => undefined),
  updateUser: jest.fn(async (_uid: string, _properties: object) => ({})),
  revokeRefreshTokens: jest.fn(async (_uid: string) => undefined),
};
