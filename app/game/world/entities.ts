import type { FoodId, SpeciesId } from "../types";
import type { PropKey } from "../sprites";

// Entity shapes for the live tank. These are the pooled, mutable records the
// simulation owns and the renderer reads; nothing here touches React or Three.js.

export let nextId = 1;

/** Monotonic entity id, shared by every pool. */
export function nextEntityId(): number {
  return nextId++;
}

export type FishEntity = {
  id: number;
  species: SpeciesId;
  xp: number;
  bonus: number;
  variant: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number;
  heading: number;
  speed: number;
  facing: number;
  nextTurnAt: number;
  beat: number;
  thrust: number;
  burstAt: number;
  phase: number;
  depth: number;
  targetDepth: number;
  targetX: number; targetY: number;
  thinkAt: number;
  searchAt: number;
  chewUntil: number;
  restUntil: number;
  pellet: Pellet | null;
  pickup: Pickup | null;
  prey: FishEntity | null;
  /** Puffer only: 0..1 toward bursting, plus the coins banked in the swelling. */
  inflate: number;
  banked: number;
  nextAbility: number;
  boostUntil: number;
  boostMul: number;
  rageUntil: number;
  passiveAccum: number;
  size: number;
  stage: number;
  flash: number;
  /** Set the frame a fish is eaten so the renderer can play the vanish. */
  dying: number;
};

export type Pellet = {
  id: number;
  food: FoodId;
  x: number; y: number; z: number;
  vx: number; vy: number;
  age: number;
  settled: number;
  /** Which fish has dibs, and until when — a lapsed claim frees the pellet again. */
  claim: number;
  claimUntil: number;
  splitAt: number;
  gone: boolean;
};

export type Pickup = {
  id: number;
  kind: PropKey;
  value: number;
  x: number; y: number; z: number;
  vx: number; vy: number;
  age: number;
  spin: number;
  claim: number;
  collected: boolean;
};

export type Particle = {
  x: number; y: number; z: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: [number, number, number];
  kind: "spark" | "dot";
  spin: number;
};

export type Bubble = {
  x: number; y: number; z: number;
  speed: number;
  drift: number;
  scale: number;
  /** Coins riding this bubble, paid out when it reaches the surface. */
  carry: number;
};

export type Popup = {
  x: number; y: number;
  text: string;
  life: number;
  color: string;
  big: boolean;
};

export type Shock = { x: number; y: number; r: number; life: number };

export type Bounds = { halfWidth: number; top: number; bottom: number };

export function rand(a: number, b: number) { return a + Math.random() * (b - a); }
