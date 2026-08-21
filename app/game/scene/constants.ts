import type { DecorId } from "../types";

export const MID_SIZE = { w: 1536, h: 1024 };
export const FISH_ATLAS = { w: 704, h: 480, cellW: 176, cellH: 120, cols: 4 };
export const PLANT_ATLAS = { cols: 3, rows: 2 };

export const DECOR_REGIONS: Record<DecorId, { x: number; y: number; w: number; h: number }> = {
  anemone: { x: 520, y: 525, w: 430, h: 390 },
  coral: { x: 45, y: 565, w: 430, h: 330 },
  wreck: { x: 985, y: 175, w: 465, h: 315 },
  helmet: { x: 42, y: 85, w: 420, h: 410 },
  amphora: { x: 990, y: 585, w: 465, h: 320 },
  chest: { x: 485, y: 180, w: 445, h: 315 },
};

/** Where each decoration sits, as a fraction of the swim box. */
export const DECOR_SLOTS: Record<DecorId, { x: number; y: number; scale: number; z: number }> = {
  anemone: { x: -0.62, y: 0.06, scale: 0.9, z: -1.1 },
  coral: { x: 0.58, y: 0.02, scale: 0.85, z: -0.9 },
  wreck: { x: -0.18, y: 0.02, scale: 1.25, z: -1.6 },
  helmet: { x: 0.86, y: 0.05, scale: 0.8, z: -0.7 },
  amphora: { x: -0.88, y: 0.02, scale: 0.7, z: 0.3 },
  chest: { x: 0.2, y: 0.01, scale: 0.9, z: 0.45 },
};

export const FOOD_COLORS: Record<string, [number, number, number]> = {
  flake: [0.79, 0.54, 0.27],
  shrimpPellet: [1, 0.48, 0.36],
  worm: [0.88, 0.42, 0.63],
  starFood: [1, 0.85, 0.24],
  explosive: [1, 0.34, 0.13],
  rainbow: [0.56, 0.94, 1],
  mutant: [0.62, 1, 0.24],
  krill: [1, 0.84, 0],
};
