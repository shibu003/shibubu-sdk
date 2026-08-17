/**
 * Typed errors.
 *
 * The API always fails as `{ error: { code, message } }`. Codes are what you
 * branch on; messages are for humans and may change. The union below is not
 * exhaustive — the server defines more than eighty codes and adds new ones —
 * so `ShibubuError.code` stays a `string` and the union exists to make the
 * common branches autocomplete rather than to constrain them.
 */

/** Codes a client is most likely to handle explicitly. */
export type KnownErrorCode =
  // auth
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "UNAUTHORIZED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  // access
  | "FORBIDDEN"
  | "FREE_TIER_DISABLED"
  // input
  | "VALIDATION"
  | "VALIDATION_ERROR"
  | "INVALID_REQUEST"
  | "INVALID_BODY"
  | "INVALID_ACTION"
  // state
  | "NOT_FOUND"
  | "PET_NOT_FOUND"
  | "NO_PET"
  | "CONFLICT"
  // limits
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  // server
  | "INTERNAL"
  | "INTERNAL_ERROR";

/** Anything the API rejects, plus transport failures, arrives as this. */
export class ShibubuError extends Error {
  /** Server error code, or a synthetic one for transport failures. */
  readonly code: string;
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number;
  /** How many attempts were made in total, including the first. */
  readonly attempts: number;

  constructor(code: string, message: string, status: number, attempts = 1) {
    super(message);
    this.name = "ShibubuError";
    this.code = code;
    this.status = status;
    this.attempts = attempts;
  }

  /** The caller's credentials are missing, wrong, or expired. */
  get isAuth(): boolean {
    return this.status === 401 || this.code.startsWith("AUTH") || this.code.startsWith("TOKEN");
  }

  /** Authenticated, but not allowed — usually a tenant mismatch. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** Slow down. `retryAfterMs` on the client tells you how long it waited. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /**
   * Retrying the identical request could plausibly succeed.
   *
   * True for network failures, 429, and 5xx. False for anything the server
   * refused on its merits — retrying a 400 just spends another request.
   */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}
