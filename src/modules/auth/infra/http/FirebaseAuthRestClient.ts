import { env } from "../../../../config/env";
import { AppError } from "../../../../shared/errors/AppError";

export interface SignInWithPasswordResult {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
}

interface FirebaseErrorResponse {
  error?: { message?: string };
}

const REQUEST_TIMEOUT_MS = 5000;

// Firebase error codes that mean "wrong email/password". They all collapse into one generic
// message so the response never tells whether the email exists (no account enumeration).
const INVALID_CREDENTIAL_CODES = new Set([
  "INVALID_LOGIN_CREDENTIALS",
  "EMAIL_NOT_FOUND",
  "INVALID_PASSWORD",
  "INVALID_EMAIL",
  "USER_DISABLED",
]);

export class FirebaseAuthRestClient {
  private readonly signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`;

  async signInWithPassword(email: string, password: string): Promise<SignInWithPasswordResult> {
    let response: Response;

    try {
      response = await fetch(this.signInUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new AppError("Authentication service unavailable", 503);
    }

    const body = (await response.json().catch(() => ({}))) as SignInWithPasswordResult &
      FirebaseErrorResponse;

    if (!response.ok) {
      // Firebase sometimes appends details, e.g. "TOO_MANY_ATTEMPTS_TRY_LATER : Access ...".
      const code = body.error?.message?.split(" ")[0] ?? "";

      if (INVALID_CREDENTIAL_CODES.has(code)) {
        throw new AppError("Invalid credentials", 401);
      }

      if (code.startsWith("TOO_MANY_ATTEMPTS")) {
        throw new AppError("Too many login attempts, try again later", 429);
      }

      // Logs only Firebase's status/code, never the email, password or API key.
      console.error(`[auth] Firebase sign-in failed: ${response.status} ${code}`);
      throw new AppError("Authentication service unavailable", 502);
    }

    return body;
  }
}
