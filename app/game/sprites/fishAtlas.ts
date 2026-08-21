import { SPECIES_ORDER } from "../content/species";
import type { SpeciesId } from "../types";
import { CELL_H, CELL_W, paintSpecies } from "./painters";

const SCALE = 4;
const COLS = 4;

export const FISH_CELL = { w: CELL_W * SCALE, h: CELL_H * SCALE };

export type Atlas = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Pixel rect of a species cell inside the atlas. */
  region(id: SpeciesId): { x: number; y: number; w: number; h: number };
};

export function buildFishAtlas(): Atlas {
  const rows = Math.ceil(SPECIES_ORDER.length / COLS);
  const width = COLS * CELL_W * SCALE;
  const height = rows * CELL_H * SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  SPECIES_ORDER.forEach((id, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    paintSpecies(id).blitTo(image, col * CELL_W * SCALE, row * CELL_H * SCALE, SCALE, width);
  });
  ctx.putImageData(image, 0, 0);
  const index = new Map(SPECIES_ORDER.map((id, i) => [id, i]));
  return {
    canvas,
    width,
    height,
    region(id) {
      const i = index.get(id) ?? 0;
      return {
        x: (i % COLS) * CELL_W * SCALE,
        y: Math.floor(i / COLS) * CELL_H * SCALE,
        w: CELL_W * SCALE,
        h: CELL_H * SCALE,
      };
    },
  };
}

/** Small standalone portrait for the shop list, as a data URL. */
export function speciesPortrait(id: SpeciesId, scale = 3): string {
  const pix = paintSpecies(id);
  const canvas = document.createElement("canvas");
  canvas.width = CELL_W * scale;
  canvas.height = CELL_H * scale;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(canvas.width, canvas.height);
  pix.blitTo(image, 0, 0, scale, canvas.width);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}
