import { FirebaseAuthRestClient } from "../../src/modules/auth/infra/http/FirebaseAuthRestClient";
import { loginSchema, registerSchema } from "../../src/modules/auth/presentation/auth.validators";
import { AppError } from "../../src/shared/errors/AppError";

const SIGN_IN_OK = {
  idToken: "id-token",
  refreshToken: "refresh-token",
  expiresIn: "3600",
  localId: "firebase-uid",
};

function mockFetch(response: Response | Error) {
  return jest.spyOn(global, "fetch").mockImplementation(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

function firebaseError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), { status });
}

const expectAppError = async (promise: Promise<unknown>, statusCode: number, message: string) => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ statusCode, message });
};

describe("FirebaseAuthRestClient.signInWithPassword", () => {
  const client = new FirebaseAuthRestClient();

  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it("returns Firebase's tokens on success", async () => {
    mockFetch(new Response(JSON.stringify(SIGN_IN_OK), { status: 200 }));

    await expect(client.signInWithPassword("a@b.dev", "secret1")).resolves.toEqual(SIGN_IN_OK);
  });

  it.each(["INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "USER_DISABLED"])(
    "maps %s to a generic 401 that does not reveal whether the email exists",
    async (code) => {
      mockFetch(firebaseError(400, code));

      await expectAppError(
        client.signInWithPassword("a@b.dev", "secret1"),
        401,
        "Invalid credentials",
      );
    },
  );

  it("maps Firebase's lockout to 429", async () => {
    mockFetch(
      firebaseError(400, "TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been disabled"),
    );

    await expectAppError(
      client.signInWithPassword("a@b.dev", "secret1"),
      429,
      "Too many login attempts, try again later",
    );
  });

  it("answers 502 for unexpected Firebase errors without leaking them", async () => {
    mockFetch(firebaseError(400, "API key not valid. Please pass a valid API key."));

    await expectAppError(
      client.signInWithPassword("a@b.dev", "secret1"),
      502,
      "Authentication service unavailable",
    );
  });

  it("answers 503 when Firebase is unreachable or times out", async () => {
    mockFetch(new TypeError("fetch failed"));

    await expectAppError(
      client.signInWithPassword("a@b.dev", "secret1"),
      503,
      "Authentication service unavailable",
    );
  });
});

describe("auth validators", () => {
  const validRegister = {
    name: "  Maria Silva ",
    email: " Maria@Email.COM ",
    password: "secret1",
    phone: " 33999990000 ",
    city: " Manhuaçu ",
  };

  it("trims fields, lowercases the email and defaults the role to CITIZEN", () => {
    expect(registerSchema.parse(validRegister)).toEqual({
      name: "Maria Silva",
      email: "maria@email.com",
      password: "secret1",
      phone: "33999990000",
      city: "Manhuaçu",
      role: "CITIZEN",
    });
    expect(loginSchema.parse({ email: " A@B.dev", password: "secret1" }).email).toBe("a@b.dev");
  });

  it("rejects blank or oversized fields", () => {
    expect(registerSchema.safeParse({ ...validRegister, name: "   " }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, city: "x".repeat(192) }).success).toBe(
      false,
    );
    expect(registerSchema.safeParse({ ...validRegister, phone: "1".repeat(21) }).success).toBe(
      false,
    );
  });

  it("never allows self-registration as ADMIN", () => {
    expect(registerSchema.safeParse({ ...validRegister, role: "ADMIN" }).success).toBe(false);
  });
});
