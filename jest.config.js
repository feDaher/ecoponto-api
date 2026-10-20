/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tests/tsconfig.json" }],
  },
  setupFiles: ["<rootDir>/tests/support/setup-env.ts"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/middlewares/**/*.ts",
    "src/shared/security/**/*.ts",
    "src/modules/audit/**/*.ts",
  ],
};
