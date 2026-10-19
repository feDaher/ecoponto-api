Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "mysql://test:test@localhost:3306/test",
  FIREBASE_PROJECT_ID: "test-project",
  FIREBASE_CLIENT_EMAIL: "test@test-project.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "test-private-key",
  FIREBASE_API_KEY: "test-api-key",
  RATE_LIMIT_MAX: "1000000",
});
