/**
 * @shibubu/sdk — typed client for the Shibubu API.
 *
 * The Shibubu server is proprietary; this SDK is MIT. It describes the
 * boundary, nothing behind it.
 */
export { BuddyClient } from "./client.js";
export type { BuddyClientOptions, BuddyRef } from "./client.js";
export { ShibubuError } from "./errors.js";
export type { KnownErrorCode } from "./errors.js";
export {
  ACTIONS,
  EGG_ACTIONS,
  PARAM_KEYS,
  PARAM_LABELS,
  STAGES,
} from "./types.js";
export type {
  Action,
  ActionType,
  ApiErrorBody,
  BuddyState,
  EggActionType,
  Health,
  ParamKey,
  Params,
  Signal,
  Stage,
  Stats,
} from "./types.js";
