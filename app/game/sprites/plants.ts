import { Pix, hex, type RGBA } from "./raster";

const PLANT_W = 32;
const PLANT_H = 48;
const PLANT_SCALE = 2;
export const PLANT_VARIANTS = 6;

function stem(p: Pix, points: [number, number][], dark: RGBA, body: RGBA, width = 2) {
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    p.line(x0, y0, x1, y1, dark, width + 2);
    p.line(x0, y0, x1, y1, body, width);
  }
}

function leaf(p: Pix, x: number, y: number, rx: number, ry: number, dark: RGBA, body: RGBA, light: RGBA) {
  p.ellipse(x, y, rx + 1, ry + 1, dark);
  p.ellipse(x, y, rx, ry, body);
  p.ellipse(x - rx * 0.25, y - ry * 0.3, Math.max(1, rx * 0.35), Math.max(1, ry * 0.28), light);
}

/** Six hand-rasterised silhouettes, deliberately unlike the repeated round leaves
 * that used to be baked into the bowl background. */
function paintPlant(variant: number): Pix {
  const p = new Pix(PLANT_W, PLANT_H);
  const ink = hex("#075b62");
  const deep = hex("#087b6b");
  const green = hex("#18a86f");
  const lime = hex("#6bd13e");
  const pale = hex("#b8e84c");
  const red = hex("#a84062");
  const coral = hex("#e56b77");

  if (variant === 0) {
    for (const [x, top, lean] of [[7, 10, -3], [12, 3, 2], [17, 14, -1], [22, 6, 4], [26, 17, 1]] as const) {
      p.poly([[x - 2, 45], [x + 1, 45], [x + lean + 1, top + 5], [x + lean, top]], ink);
      p.poly([[x - 1, 44], [x, 44], [x + lean, top + 4], [x + lean, top + 1]], green);
    }
  } else if (variant === 1) {
    stem(p, [[16, 45], [16, 8]], ink, deep, 2);
    for (let y = 15; y <= 38; y += 6) {
      const reach = 9 - (y - 15) * 0.12;
      p.poly([[15, y + 2], [15 - reach, y - 2], [12, y + 4]], ink);
      p.poly([[17, y], [17 + reach, y - 4], [19, y + 4]], ink);
      p.poly([[15, y + 1], [16 - reach, y - 2], [13, y + 3]], lime);
      p.poly([[17, y], [16 + reach, y - 4], [18, y + 3]], green);
    }
    leaf(p, 16, 8, 3, 5, ink, green, pale);
  } else if (variant === 2) {
    stem(p, [[15, 45], [14, 9]], ink, deep, 2);
    for (const [x, y, side] of [[10, 35, -1], [21, 30, 1], [9, 24, -1], [20, 18, 1], [12, 12, -1]] as const) {
      stem(p, [[15, y + 3], [x, y]], ink, deep, 1);
      leaf(p, x + side, y, 4, 3, ink, red, coral);
    }
    leaf(p, 15, 8, 3, 5, ink, coral, hex("#ffb06b"));
  } else if (variant === 3) {
    for (const [tipX, tipY, width] of [[5, 16, 4], [11, 5, 5], [17, 11, 5], [23, 3, 5], [28, 17, 4]] as const) {
      p.poly([[14, 45], [18, 45], [tipX + width, tipY + 8], [tipX, tipY]], ink);
      p.poly([[15, 43], [17, 43], [tipX + width - 1, tipY + 7], [tipX + 1, tipY + 2]], green);
      p.line(16, 42, tipX + width * 0.5, tipY + 4, lime, 1);
    }
  } else if (variant === 4) {
    for (const [x, y, bend, rx] of [[7, 20, -2, 5], [13, 9, 1, 6], [21, 16, 2, 5], [26, 28, -1, 4]] as const) {
      stem(p, [[16, 45], [16 + bend, y + 5], [x, y + 2]], ink, deep, 1);
      leaf(p, x, y, rx, 3, ink, lime, pale);
      p.line(x, y, x + rx - 1, y + 1, deep, 1);
    }
  } else {
    for (const [x, y, rx, ry] of [[5, 39, 5, 3], [10, 32, 5, 7], [16, 37, 6, 4], [21, 29, 5, 8], [27, 38, 5, 4]] as const) {
      leaf(p, x, y, rx, ry, ink, x % 2 ? green : deep, x % 2 ? pale : lime);
    }
  }

  p.ellipse(15, 45, 8, 2, ink);
  p.ellipse(14, 44, 6, 1, deep);
  return p;
}

export type PlantAtlas = { canvas: HTMLCanvasElement; cols: number; rows: number };

export function buildPlantAtlas(): PlantAtlas {
  const cols = PLANT_VARIANTS;
  const width = PLANT_W * PLANT_SCALE * cols;
  const height = PLANT_H * PLANT_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < cols; i++) {
    paintPlant(i).blitTo(image, i * PLANT_W * PLANT_SCALE, 0, PLANT_SCALE, width);
  }
  ctx.putImageData(image, 0, 0);
  return { canvas, cols, rows: 1 };
}
