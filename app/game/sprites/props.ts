import { Pix, alpha, hex } from "./raster";

export const PROP_KEYS = ["pellet", "coin", "nugget", "gem", "pearl", "chest", "spark", "dot"] as const;
export type PropKey = (typeof PROP_KEYS)[number];

const PROP_CELL = 16;
const PROP_SCALE = 4;
const PROP_COLS = 4;

function paintProp(key: PropKey): Pix {
  const p = new Pix(PROP_CELL, PROP_CELL);
  const c = 7.5;
  switch (key) {
    case "pellet":
      // Left white so the instance colour can tint it to any food.
      p.ellipse(c, c, 4.2, 4.2, hex("#ffffff"));
      p.ellipse(c + 1, c + 1, 3.4, 3.4, hex("#d8d8d8"));
      p.ellipse(c - 1.2, c - 1.4, 1.6, 1.6, hex("#ffffff"));
      p.outline(alpha(hex("#5a4a34"), 0.75));
      break;
    case "coin":
      p.ellipse(c, c, 5.4, 5.4, hex("#c98a10"));
      p.ellipse(c, c, 4.3, 4.3, hex("#ffd93d"));
      p.ellipse(c - 1.3, c - 1.6, 1.7, 1.4, hex("#fff6c2"));
      p.rect(c - 1, c - 2.5, 2, 5, hex("#e8a916"));
      p.outline(hex("#6d4708"));
      break;
    case "nugget":
      p.poly([[3, 10], [5, 5], [11, 4], [13, 9], [10, 12], [5, 12]], hex("#ffcc33"));
      p.poly([[5, 5], [11, 4], [10, 7], [6, 8]], hex("#fff0a8"));
      p.poly([[6, 10], [11, 9], [10, 12], [6, 12]], hex("#d18f0d"));
      p.outline(hex("#6d4708"));
      break;
    case "gem":
      p.poly([[8, 2], [13, 7], [8, 14], [3, 7]], hex("#49e3ff"));
      p.poly([[8, 2], [13, 7], [8, 7]], hex("#c2f7ff"));
      p.poly([[3, 7], [8, 7], [8, 14]], hex("#1c9dc4"));
      p.outline(hex("#0b4a63"));
      break;
    case "pearl":
      p.ellipse(c, c, 5, 5, hex("#e8e2f5"));
      p.ellipse(c - 1.4, c - 1.6, 2, 1.8, hex("#ffffff"));
      p.ellipse(c + 1.6, c + 1.8, 2, 1.6, hex("#b9aed4"));
      p.outline(hex("#6d6488"));
      break;
    case "chest":
      p.rect(2, 8, 12, 6, hex("#8a5a24"));
      p.rect(2, 5, 12, 3, hex("#a8712e"));
      p.rect(2, 7, 12, 1, hex("#5c3a13"));
      p.rect(7, 6, 2, 6, hex("#ffd93d"));
      p.rect(3, 3, 10, 2, hex("#ffe98a"));
      p.outline(hex("#3a2408"));
      break;
    case "spark":
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        p.line(c, c, c + Math.cos(a) * 6, c + Math.sin(a) * 6, hex("#ffffff"));
      }
      p.ellipse(c, c, 2, 2, hex("#ffffff"));
      break;
    case "dot":
      p.ellipse(c, c, 5, 5, alpha(hex("#ffffff"), 0.55));
      p.ellipse(c, c, 3, 3, hex("#ffffff"));
      break;
  }
  return p;
}

export type PropAtlas = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  cols: number;
  rows: number;
  index(key: PropKey): number;
};

export function buildPropAtlas(): PropAtlas {
  const rows = Math.ceil(PROP_KEYS.length / PROP_COLS);
  const width = PROP_COLS * PROP_CELL * PROP_SCALE;
  const height = rows * PROP_CELL * PROP_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  PROP_KEYS.forEach((key, i) => {
    const col = i % PROP_COLS;
    const row = Math.floor(i / PROP_COLS);
    paintProp(key).blitTo(image, col * PROP_CELL * PROP_SCALE, row * PROP_CELL * PROP_SCALE, PROP_SCALE, width);
  });
  ctx.putImageData(image, 0, 0);
  return {
    canvas,
    width,
    height,
    cols: PROP_COLS,
    rows,
    index: (key) => PROP_KEYS.indexOf(key),
  };
}
