/**
 * Shibubu wire types.
 *
 * These mirror what `shibubu.ai` actually sends and accepts. They describe the
 * boundary only — how a buddy grows, how the nine axes move, and what the
 * server does with a signal all live on the server and are not modelled here.
 */

/** The four life stages a buddy moves through. */
export const STAGES = ["EGG", "BABY", "CHILD", "ADULT"] as const;
export type Stage = (typeof STAGES)[number];

/**
 * The nine psychological axes, addressed by key.
 *
 * Keys are deliberately opaque single letters on the wire so the server can
 * retune what each one means without breaking clients. Use {@link PARAM_LABELS}
 * when showing them to a person.
 */
export const PARAM_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

/** English display names for the nine axes. */
export const PARAM_LABELS: Record<ParamKey, string> = {
  a: "Curiosity",
  b: "Diligence",
  c: "Sociability",
  d: "Kindness",
  e: "Calm",
  f: "Purpose",
  g: "Courage",
  h: "Identity",
  i: "Compassion",
};

/** A full nine-axis snapshot. */
export type Params = Record<ParamKey, number>;

/** Care stats. */
export interface Stats {
  hunger: number;
  mood: number;
  energy: number;
  hygiene: number;
  friendship: number;
}

/** `sick` blocks evolution until the buddy recovers. */
export type Health = "normal" | "sick";

/** Care actions available from BABY onward. */
export const ACTIONS = ["feed", "play", "clean", "sleep", "train", "talk", "use_medicine"] as const;
export type ActionType = (typeof ACTIONS)[number];

/** EGG-stage interactions. A buddy that has not hatched accepts only these. */
export const EGG_ACTIONS = ["warm", "sing", "shake", "watch"] as const;
export type EggActionType = (typeof EGG_ACTIONS)[number];

/** What `POST /action` accepts. */
export interface Action {
  type: ActionType | EggActionType;
}

/**
 * A buddy as the server reports it.
 *
 * Unknown fields are preserved rather than stripped: the server adds fields
 * ahead of this SDK, and dropping them would make a read-modify-write cycle
 * lose data.
 */
export interface BuddyState {
  pet_id: string;
  tenant_id: string;
  /** Optimistic-concurrency counter. Send it back on writes. */
  version: number;
  stage: Stage;
  variant?: string;
  stats: Stats;
  health: Health;
  xp: number;
  params: Params;
  seed: string;
  [extra: string]: unknown;
}

/** One observed behaviour, offered to the server as evidence. */
export interface Signal {
  /** Signal identifier, e.g. "asked_followup". Defined by the server. */
  type: string;
  /** How many times it was observed in this batch. Defaults to 1. */
  count?: number;
  /** Free-form context. Do not put credentials or personal data here. */
  meta?: Record<string, unknown>;
}

/** Every error the API returns has this shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
