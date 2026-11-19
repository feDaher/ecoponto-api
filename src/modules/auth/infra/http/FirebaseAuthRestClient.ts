import { env } from "../../../../config/env";
import { AppError } from "../../../../shared/errors/AppError";

export interface SignInWithPasswordResult {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
}

/** Same shape as the sign-in result, so both flows hand the client the same session fields. */
export type RefreshIdTokenResult = SignInWithPasswordResult;

interface SecureTokenResponse {
  id_token: string;
  refresh_token: string;
  expires_in: string;
  user_id: string;
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

// Refresh token codes that mean "this session is over": the client must log in again.
const INVALID_REFRESH_CODES = new Set([
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "INVALID_REFRESH_TOKEN",
  "INVALID_GRANT_TYPE",
  "MISSING_REFRESH_TOKEN",
]);

// Firebase sometimes appends details, e.g. "TOO_MANY_ATTEMPTS_TRY_LATER : Access ...".
function firebaseErrorCode(body: FirebaseErrorResponse): string {
  return body.error?.message?.split(" ")[0] ?? "";
}

async function postToFirebase(url: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppError("Authentication service unavailable", 503);
  }
}

export class FirebaseAuthRestClient {
  private readonly signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`;
  private readonly refreshUrl = `https://securetoken.googleapis.com/v1/token?key=${env.FIREBASE_API_KEY}`;

  async signInWithPassword(email: string, password: string): Promise<SignInWithPasswordResult> {
    const response = await postToFirebase(this.signInUrl, {
      email,
      password,
      returnSecureToken: true,
    });

    const body = (await response.json().catch(() => ({}))) as SignInWithPasswordResult &
      FirebaseErrorResponse;

    if (!response.ok) {
      const code = firebaseErrorCode(body);

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

  /**
   * Exchanges a refresh token for a new ID token (they last one hour). Lives on the server for
   * the same reason as sign-in: the Web API key never has to ship inside the apps.
   */
  async refreshIdToken(refreshToken: string): Promise<RefreshIdTokenResult> {
    const response = await postToFirebase(this.refreshUrl, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const body = (await response.json().catch(() => ({}))) as SecureTokenResponse &
      FirebaseErrorResponse;

    if (!response.ok) {
      const code = firebaseErrorCode(body);

      if (INVALID_REFRESH_CODES.has(code)) {
        throw new AppError("Session expired, log in again", 401);
      }

      // Logs only Firebase's status/code, never the token or API key.
      console.error(`[auth] Firebase token refresh failed: ${response.status} ${code}`);
      throw new AppError("Authentication service unavailable", 502);
    }

    return {
      idToken: body.id_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in,
      localId: body.user_id,
    };
  }
}
