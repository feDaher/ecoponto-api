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

export class FirebaseAuthRestClient {
  private readonly signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`;

  async signInWithPassword(email: string, password: string): Promise<SignInWithPasswordResult> {
    const response = await fetch(this.signInUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const body = (await response.json()) as SignInWithPasswordResult & FirebaseErrorResponse;

    if (!response.ok) {
      throw new AppError(body.error?.message ?? "Invalid credentials", 401);
    }

    return body;
  }
}
