// env.ts parses process.env at import time, so each case loads a fresh copy of it.
function loadEnv(overrides: Record<string, string | undefined>) {
  const saved = { ...process.env };
  Object.assign(process.env, overrides);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
  }

  try {
    let env: typeof import("../../src/config/env").env | undefined;
    jest.isolateModules(() => {
      env = jest.requireActual("../../src/config/env").env;
    });
    return env!;
  } finally {
    process.env = saved;
  }
}

describe("TRUST_PROXY", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["1", 1],
    ["2", 2],
    ["loopback, 10.0.0.0/8", "loopback, 10.0.0.0/8"],
  ])("parses %p as %p", (raw, expected) => {
    expect(loadEnv({ TRUST_PROXY: raw }).TRUST_PROXY).toEqual(expected);
  });

  it('rejects "true", which would let clients spoof their IP past the rate limiters', () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => loadEnv({ TRUST_PROXY: "true" })).toThrow("Invalid environment variables");
    errorSpy.mockRestore();
  });
});

describe("CORS_ORIGINS", () => {
  it("is undefined (any origin) when unset or blank", () => {
    expect(loadEnv({ CORS_ORIGINS: undefined }).CORS_ORIGINS).toBeUndefined();
    expect(loadEnv({ CORS_ORIGINS: "  " }).CORS_ORIGINS).toBeUndefined();
  });

  it("splits and trims a comma separated list", () => {
    expect(
      loadEnv({ CORS_ORIGINS: "https://a.example, https://b.example ," }).CORS_ORIGINS,
    ).toEqual(["https://a.example", "https://b.example"]);
  });
});
