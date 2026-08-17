/**
 * BuddyClient — a typed client for the Shibubu REST API.
 *
 * Zero dependencies: uses the global `fetch`, so Node 18+, Deno, Bun, Workers
 * and browsers all work unmodified.
 *
 * What this handles so callers do not have to: bearer auth, timeouts, retry
 * with backoff on the failures that are actually retryable, idempotency keys
 * on writes, and turning every failure into one typed error.
 */
import { ShibubuError } from "./errors.js";
import type { Action, ApiErrorBody, BuddyState, Params, Signal } from "./types.js";

export interface BuddyClientOptions {
  /** Bearer token. Required for every endpoint except `health`. */
  token?: string;
  /** Defaults to `https://shibubu.ai`. */
  baseUrl?: string;
  /** Per-attempt timeout in ms. Default 10000. */
  timeoutMs?: number;
  /** Extra attempts after the first, for retryable failures. Default 2. */
  maxRetries?: number;
  /** Injectable for tests and for runtimes with a non-global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Called before each retry. Useful for logging; must not throw. */
  onRetry?: (info: { attempt: number; delayMs: number; error: ShibubuError }) => void;
}

/** A buddy is addressed by the pair of ids; the token must match the tenant. */
export interface BuddyRef {
  tenantId: string;
  petId: string;
}

const DEFAULT_BASE_URL = "https://shibubu.ai";
const RETRY_BASE_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Random id for the Idempotency-Key header. */
function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export class BuddyClient {
  readonly baseUrl: string;
  #token?: string;
  #timeoutMs: number;
  #maxRetries: number;
  #fetch: typeof globalThis.fetch;
  #onRetry?: BuddyClientOptions["onRetry"];

  constructor(options: BuddyClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#token = options.token;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxRetries = options.maxRetries ?? 2;
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new TypeError(
        "No fetch available. Use Node 18+, or pass one as `fetch` in the options.",
      );
    }
    this.#fetch = f;
    this.#onRetry = options.onRetry;
  }

  /** Replace the bearer token in place, e.g. after a refresh. */
  setToken(token: string | undefined): void {
    this.#token = token;
  }

  // -- endpoints ---------------------------------------------------------

  /** Liveness. The only endpoint that needs no token. */
  async health(): Promise<{ ok: boolean; service?: string; transport?: string }> {
    return this.#request("GET", "/health", { auth: false });
  }

  /** Current buddy state, including the nine-axis snapshot. */
  async getState(ref: BuddyRef): Promise<BuddyState> {
    return this.#request("GET", `/v1/pet/${enc(ref.tenantId)}/${enc(ref.petId)}/state`);
  }

  /** The nine axes on their own. */
  async getParams(ref: BuddyRef): Promise<Params> {
    return this.#request("GET", `/v1/pet/${enc(ref.tenantId)}/${enc(ref.petId)}/params`);
  }

  /**
   * Apply a care action.
   *
   * `version` is the optimistic-concurrency counter from {@link getState};
   * pass the one you based the decision on and the server rejects the write
   * if the buddy moved on without you. Sent with an idempotency key, so a
   * retried request cannot feed the same buddy twice.
   */
  async applyAction(ref: BuddyRef, action: Action, version: number): Promise<BuddyState> {
    return this.#request(
      "POST",
      `/v1/pet/${enc(ref.tenantId)}/${enc(ref.petId)}/action`,
      { body: { action, version }, idempotent: true },
    );
  }

  /**
   * Record behavioural signals.
   *
   * Signals are evidence, not instructions: the server decides what, if
   * anything, they do to the nine axes. Nothing here moves a parameter
   * directly, by design.
   */
  async recordSignals(ref: BuddyRef, signals: Signal[]): Promise<{ accepted: number } & Record<string, unknown>> {
    if (!Array.isArray(signals) || signals.length === 0) {
      throw new ShibubuError("INVALID_BODY", "recordSignals needs at least one signal", 0);
    }
    return this.#request(
      "POST",
      `/v1/pet/${enc(ref.tenantId)}/${enc(ref.petId)}/signals`,
      { body: { signals }, idempotent: true },
    );
  }

  // -- transport ---------------------------------------------------------

  async #request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; auth?: boolean; idempotent?: boolean } = {},
  ): Promise<T> {
    const { body, auth = true, idempotent = false } = opts;
    if (auth && !this.#token) {
      throw new ShibubuError("AUTH_REQUIRED", "No token set on the client", 401);
    }

    const headers: Record<string, string> = { accept: "application/json" };
    if (auth) headers.authorization = `Bearer ${this.#token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    // The same key across retries is what makes a retried write safe.
    if (idempotent) headers["idempotency-key"] = newIdempotencyKey();

    let lastError: ShibubuError | undefined;
    for (let attempt = 1; attempt <= this.#maxRetries + 1; attempt++) {
      try {
        return await this.#attempt<T>(method, path, headers, body, attempt);
      } catch (err) {
        const e = err as ShibubuError;
        if (!(e instanceof ShibubuError) || !e.isRetryable || attempt > this.#maxRetries) {
          throw e;
        }
        lastError = e;
        const delayMs = RETRY_BASE_MS * 2 ** (attempt - 1);
        this.#onRetry?.({ attempt, delayMs, error: e });
        await sleep(delayMs);
      }
    }
    /* istanbul ignore next — the loop either returns or throws */
    throw lastError;
  }

  async #attempt<T>(
    method: string,
    path: string,
    headers: Record<string, string>,
    body: unknown,
    attempt: number,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    let res: Response;
    try {
      res = await this.#fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      // Network failure or timeout: status 0 marks "never got an answer",
      // which is what makes it retryable.
      const msg = (err as Error)?.name === "AbortError"
        ? `Request timed out after ${this.#timeoutMs}ms`
        : `Network error: ${(err as Error)?.message ?? String(err)}`;
      throw new ShibubuError("NETWORK", msg, 0, attempt);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new ShibubuError(
        "INVALID_RESPONSE",
        `Expected JSON, got ${res.status} ${truncate(text)}`,
        res.status,
        attempt,
      );
    }

    if (!res.ok) {
      const e = (parsed as ApiErrorBody | null)?.error;
      throw new ShibubuError(
        e?.code ?? `HTTP_${res.status}`,
        e?.message ?? `Request failed with ${res.status}`,
        res.status,
        attempt,
      );
    }
    return parsed as T;
  }
}

const enc = encodeURIComponent;
const truncate = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);
