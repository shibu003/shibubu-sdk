/**
 * Contract tests for BuddyClient.
 *
 * These run against a stub fetch, not the live service, so they check the
 * client's half of the contract: what it sends, how it reacts to each failure
 * shape, and that retries stay safe. The stub's responses are copied from what
 * shibubu.ai actually returns — the 401 body below is the real one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { BuddyClient, PARAM_KEYS, PARAM_LABELS, ShibubuError } from "../dist/index.js";

const REF = { tenantId: "t1", petId: "p1" };

interface Call { url: string; init: RequestInit }

/** A fetch stub that replays a queue of responses and records every call. */
function stub(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = queue.shift();
    if (!next) throw new Error(`stub ran out of responses after ${calls.length} calls`);
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetchImpl, calls };
}

const client = (responses: Array<{ status: number; body: unknown }>, opts = {}) => {
  const s = stub(responses);
  return {
    c: new BuddyClient({ token: "tok", fetch: s.fetchImpl, maxRetries: 2, ...opts }),
    calls: s.calls,
  };
};

const STATE = {
  pet_id: "p1", tenant_id: "t1", version: 7, stage: "CHILD",
  stats: { hunger: 0.5, mood: 0.8, energy: 0.6, hygiene: 0.9, friendship: 0.4 },
  health: "normal", xp: 120,
  params: { a: 10, b: 0, c: -5, d: 3, e: 0, f: 1, g: 2, h: 0, i: 4 },
  seed: "s",
};

// -- the happy path ---------------------------------------------------------

test("getState sends a bearer token and returns the parsed state", async () => {
  const { c, calls } = client([{ status: 200, body: STATE }]);
  const state = await c.getState(REF);

  assert.equal(state.version, 7);
  assert.equal(state.stage, "CHILD");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v1\/pet\/t1\/p1\/state$/);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer tok");
});

test("ids are URL-encoded, so a slash in an id cannot forge a path", async () => {
  const { c, calls } = client([{ status: 200, body: STATE }]);
  await c.getState({ tenantId: "t/1", petId: "../admin" });
  assert.match(calls[0].url, /\/v1\/pet\/t%2F1\/\.\.%2Fadmin\/state$/);
});

test("applyAction sends the version it was given", async () => {
  const { c, calls } = client([{ status: 200, body: { ...STATE, version: 8 } }]);
  const next = await c.applyAction(REF, { type: "feed" }, 7);

  assert.equal(next.version, 8);
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    action: { type: "feed" }, version: 7,
  });
});

test("health needs no token", async () => {
  const s = stub([{ status: 200, body: { ok: true, service: "shibubu" } }]);
  const c = new BuddyClient({ fetch: s.fetchImpl });
  assert.equal((await c.health()).ok, true);
  const headers = s.calls[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, undefined);
});

// -- failures ---------------------------------------------------------------

test("a 401 becomes a typed auth error and is not retried", async () => {
  const { c, calls } = client([
    { status: 401, body: { error: { code: "AUTH_REQUIRED", message: "Authentication required" } } },
  ]);
  const err = await c.getState(REF).then(() => null, (e) => e as ShibubuError);

  assert.ok(err instanceof ShibubuError);
  assert.equal(err!.code, "AUTH_REQUIRED");
  assert.equal(err!.status, 401);
  assert.equal(err!.isAuth, true);
  assert.equal(err!.isRetryable, false);
  assert.equal(calls.length, 1, "an auth failure must not be retried");
});

test("a 403 tenant mismatch is reported as forbidden, not auth", async () => {
  const { c } = client([
    { status: 403, body: { error: { code: "FORBIDDEN", message: "Tenant mismatch" } } },
  ]);
  const err = await c.getState(REF).then(() => null, (e) => e as ShibubuError);
  assert.equal(err!.isForbidden, true);
  assert.equal(err!.isRetryable, false);
});

test("a 400 is not retried — the server refused it on its merits", async () => {
  const { c, calls } = client([
    { status: 400, body: { error: { code: "INVALID_ACTION", message: "unknown action" } } },
  ]);
  await c.applyAction(REF, { type: "feed" }, 1).catch(() => {});
  assert.equal(calls.length, 1);
});

test("no token set fails before any request goes out", async () => {
  const s = stub([]);
  const c = new BuddyClient({ fetch: s.fetchImpl });
  const err = await c.getState(REF).then(() => null, (e) => e as ShibubuError);
  assert.equal(err!.code, "AUTH_REQUIRED");
  assert.equal(s.calls.length, 0);
});

test("recordSignals rejects an empty batch without calling the server", async () => {
  const s = stub([]);
  const c = new BuddyClient({ token: "tok", fetch: s.fetchImpl });
  await assert.rejects(() => c.recordSignals(REF, []), /at least one signal/);
  assert.equal(s.calls.length, 0);
});

// -- retry ------------------------------------------------------------------

test("a 500 is retried and the eventual success is returned", async () => {
  const { c, calls } = client([
    { status: 500, body: { error: { code: "INTERNAL", message: "boom" } } },
    { status: 200, body: STATE },
  ], { maxRetries: 2, timeoutMs: 2000 });

  const state = await c.getState(REF);
  assert.equal(state.version, 7);
  assert.equal(calls.length, 2);
});

test("retries stop at maxRetries and surface the last error", async () => {
  const fail = { status: 503, body: { error: { code: "INTERNAL", message: "down" } } };
  const { c, calls } = client([fail, fail, fail, fail], { maxRetries: 2 });

  const err = await c.getState(REF).then(() => null, (e) => e as ShibubuError);
  assert.equal(calls.length, 3, "one attempt plus two retries");
  assert.equal(err!.attempts, 3);
});

test("a retried write reuses one idempotency key, so it cannot double-apply", async () => {
  const { c, calls } = client([
    { status: 429, body: { error: { code: "RATE_LIMITED", message: "slow down" } } },
    { status: 200, body: { ...STATE, version: 8 } },
  ]);
  await c.applyAction(REF, { type: "feed" }, 7);

  assert.equal(calls.length, 2);
  const keyOf = (i: number) =>
    (calls[i].init.headers as Record<string, string>)["idempotency-key"];
  assert.ok(keyOf(0), "writes must carry an idempotency key");
  assert.equal(keyOf(0), keyOf(1), "the retry must reuse the first key");
});

test("two separate writes get different idempotency keys", async () => {
  const { c, calls } = client([
    { status: 200, body: STATE },
    { status: 200, body: STATE },
  ]);
  await c.applyAction(REF, { type: "feed" }, 7);
  await c.applyAction(REF, { type: "play" }, 8);

  const keyOf = (i: number) =>
    (calls[i].init.headers as Record<string, string>)["idempotency-key"];
  assert.notEqual(keyOf(0), keyOf(1));
});

test("reads carry no idempotency key", async () => {
  const { c, calls } = client([{ status: 200, body: STATE }]);
  await c.getState(REF);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["idempotency-key"], undefined);
});

test("onRetry reports each retry", async () => {
  const seen: number[] = [];
  const { c } = client([
    { status: 500, body: { error: { code: "INTERNAL", message: "x" } } },
    { status: 200, body: STATE },
  ], { onRetry: (i: { attempt: number }) => seen.push(i.attempt) });

  await c.getState(REF);
  assert.deepEqual(seen, [1]);
});

// -- malformed responses ----------------------------------------------------

test("a non-JSON body is reported rather than thrown raw", async () => {
  const fetchImpl = (async () =>
    new Response("<html>gateway</html>", { status: 502 })) as unknown as typeof globalThis.fetch;
  const c = new BuddyClient({ token: "tok", fetch: fetchImpl, maxRetries: 0 });

  const err = await c.getState(REF).then(() => null, (e) => e as ShibubuError);
  assert.equal(err!.code, "INVALID_RESPONSE");
  assert.equal(err!.status, 502);
});

test("a network failure is retryable and reported as status 0", async () => {
  let n = 0;
  const fetchImpl = (async () => {
    if (++n === 1) throw new TypeError("fetch failed");
    return new Response(JSON.stringify(STATE), { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  const c = new BuddyClient({ token: "tok", fetch: fetchImpl, maxRetries: 1 });

  const state = await c.getState(REF);
  assert.equal(state.version, 7);
  assert.equal(n, 2);
});

// -- constants --------------------------------------------------------------

test("every parameter key has a display label", () => {
  assert.equal(PARAM_KEYS.length, 9);
  for (const k of PARAM_KEYS) assert.ok(PARAM_LABELS[k], `no label for ${k}`);
});
