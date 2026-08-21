import { Pix, hex } from "./raster";

// Hand-authored rather than generated: at cursor size every pixel is load-bearing
// and a rasterised polygon comes out mushy on the diagonal. `#` is the outline,
// `.` the white body, ` ` transparent.
const ARROW = [
  "#          ",
  "##         ",
  "#.#        ",
  "#..#       ",
  "#...#      ",
  "#....#     ",
  "#.....#    ",
  "#......#   ",
  "#.......#  ",
  "#........# ",
  "#.........#",
  "#......####",
  "#...#..#   ",
  "#..##..#   ",
  "#.#  #..#  ",
  "##   #..#  ",
  "#     #..# ",
  "      #..# ",
  "       ##  ",
];

export type CursorSprite = { url: string; hotspotX: number; hotspotY: number };

/**
 * The in-tank pointer. A crosshair disappears against caustics and moving fish;
 * a chunky outlined arrow stays readable over bright sand and dark water alike,
 * and matches everything else on screen being pixel art.
 */
export function buildCursor(scale = 3): CursorSprite {
  const w = ARROW[0].length;
  const h = ARROW.length;
  const pix = new Pix(w, h);
  const outline = hex("#101a4d");
  const body = hex("#ffffff");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = ARROW[y][x];
      if (ch === "#") pix.set(x, y, outline);
      else if (ch === ".") pix.set(x, y, body);
    }
  }
  // A cool tint down the right edge so the arrow reads as lit from the surface,
  // the same direction as every other sprite in the tank.
  pix.shade(hex("#ffffff"), hex("#a9d8ff"), 0, 0.35);

  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(canvas.width, canvas.height);
  pix.blitTo(image, 0, 0, scale, canvas.width);
  ctx.putImageData(image, 0, 0);
  // The hotspot is the arrow's tip, which is the top-left pixel scaled up.
  return { url: canvas.toDataURL(), hotspotX: Math.floor(scale / 2), hotspotY: Math.floor(scale / 2) };
}
