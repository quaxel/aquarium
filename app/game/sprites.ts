import { SPECIES_ORDER, SPECIES } from "./content/species";
import type { FishArt, SpeciesId } from "./types";

// The tank needs fifteen visually distinct creatures and the project ships art for
// two. Rather than fake it with emoji, everything is rasterised here at true pixel
// resolution (44×30 per creature) and blown up 4× with nearest sampling, so the
// result is honest chunky pixel art rather than a smooth vector shape pretending.

const CELL_W = 44;
const CELL_H = 30;
const SCALE = 4;
const COLS = 4;

export const FISH_CELL = { w: CELL_W * SCALE, h: CELL_H * SCALE };

type RGBA = number; // 0xRRGGBBAA

function hex(color: string): RGBA {
  const s = color.replace("#", "");
  const v = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return ((v << 8) >>> 0) | 0xff;
}

function mix(a: RGBA, b: RGBA, t: number): RGBA {
  const k = Math.max(0, Math.min(1, t));
  const ar = (a >>> 24) & 255, ag = (a >>> 16) & 255, ab = (a >>> 8) & 255, aa = a & 255;
  const br = (b >>> 24) & 255, bg = (b >>> 16) & 255, bb = (b >>> 8) & 255, ba = b & 255;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  const al = Math.round(aa + (ba - aa) * k);
  return ((r << 24) | (g << 16) | (bl << 8) | al) >>> 0;
}

function alpha(color: RGBA, a: number): RGBA {
  return ((color & 0xffffff00) | Math.round(Math.max(0, Math.min(1, a)) * 255)) >>> 0;
}

/** A tiny integer raster target. Everything is plotted on whole pixels — no AA. */
class Pix {
  w: number;
  h: number;
  buf: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint32Array(w * h);
  }

  set(x: number, y: number, c: RGBA) {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const sa = (c & 255) / 255;
    if (sa === 0) return;
    const i = yi * this.w + xi;
    const dst = this.buf[i];
    if (sa >= 1 || dst === 0) {
      // Over empty space a soft touch keeps its alpha, which is how glows read.
      this.buf[i] = c;
      return;
    }
    // Source-over, so translucent spots and stripes shade the body underneath
    // instead of punching a hole in it.
    const da = (dst & 255) / 255;
    const outA = sa + da * (1 - sa);
    const blend = (shift: number) => {
      const s = (c >>> shift) & 255;
      const d = (dst >>> shift) & 255;
      return Math.round((s * sa + d * da * (1 - sa)) / outA);
    };
    this.buf[i] = ((blend(24) << 24) | (blend(16) << 16) | (blend(8) << 8) | Math.round(outA * 255)) >>> 0;
  }

  get(x: number, y: number): RGBA {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.buf[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA) {
    if (rx <= 0 || ry <= 0) return;
    const y0 = Math.ceil(cy - ry), y1 = Math.floor(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const t = (y - cy) / ry;
      const dx = rx * Math.sqrt(Math.max(0, 1 - t * t));
      for (let x = Math.round(cx - dx); x <= Math.round(cx + dx); x++) this.set(x, y, c);
    }
  }

  poly(points: [number, number][], c: RGBA) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if (y1 === y2) continue;
        if ((y >= Math.min(y1, y2)) && (y < Math.max(y1, y2))) {
          xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) this.set(x, y, c);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGBA, thick = 1) {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2 + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (thick <= 1) this.set(x, y, c);
      else this.ellipse(x, y, thick / 2, thick / 2, c);
    }
  }

  /** Vertical countershading over everything already drawn. */
  shade(top: RGBA, bottom: RGBA, topAmount: number, bottomAmount: number) {
    let minY = this.h, maxY = 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.buf[y * this.w + x] !== 0) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); break; }
      }
    }
    if (maxY <= minY) return;
    for (let y = minY; y <= maxY; y++) {
      const t = (y - minY) / (maxY - minY);
      const target = t < 0.5 ? top : bottom;
      const amount = t < 0.5
        ? topAmount * (1 - t * 2) * (1 - t * 2)
        : bottomAmount * Math.pow((t - 0.5) * 2, 1.5);
      if (amount <= 0.001) continue;
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.buf[i] === 0) continue;
        this.buf[i] = mix(this.buf[i], target, amount);
      }
    }
  }

  /** One-pixel border drawn on the empty side of every silhouette edge. */
  outline(c: RGBA) {
    const additions: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.buf[y * this.w + x] !== 0) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) {
          additions.push(y * this.w + x);
        }
      }
    }
    for (const i of additions) this.buf[i] = c;
  }

  blitTo(target: ImageData, ox: number, oy: number, scale: number, atlasW: number) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = this.buf[y * this.w + x];
        if (v === 0) continue;
        const r = (v >>> 24) & 255, g = (v >>> 16) & 255, b = (v >>> 8) & 255, a = v & 255;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = ox + x * scale + sx;
            const py = oy + y * scale + sy;
            const i = (py * atlasW + px) * 4;
            target.data[i] = r; target.data[i + 1] = g; target.data[i + 2] = b; target.data[i + 3] = a;
          }
        }
      }
    }
  }
}

// ── Shape painters ───────────────────────────────────────────────────────────
// All creatures are drawn facing right. The simulation mirrors the mesh in X when
// a fish turns, which is why nothing here may be asymmetric top-to-bottom in a way
// that would look wrong flipped.

type Paint = { dark: RGBA; body: RGBA; light: RGBA; accent: RGBA; art: FishArt };

function eye(p: Pix, x: number, y: number, dark: RGBA, size = 1) {
  p.ellipse(x, y, size + 0.9, size + 0.9, hex("#ffffff"));
  p.ellipse(x + 0.4, y, size, size, dark);
  p.set(x - size * 0.6, y - size * 0.6, hex("#ffffff"));
}

function applyPattern(p: Pix, c: Paint, cx: number, cy: number, rx: number, ry: number) {
  const { art } = c;
  switch (art.pattern) {
    case "stripes":
      for (let i = -1; i <= 1; i++) {
        const x = cx + i * rx * 0.52;
        p.ellipse(x, cy, rx * 0.11, ry * 0.98, alpha(c.dark, 0.55));
      }
      break;
    case "bands":
      for (const [ox, w] of [[-0.45, 0.13], [0.05, 0.16], [0.6, 0.1]] as const) {
        p.ellipse(cx + ox * rx * 1.6, cy, rx * w, ry * 1.02, alpha(c.accent, 0.92));
      }
      break;
    case "spots":
      for (const [ox, oy, r] of [[-0.4, -0.3, 1.5], [0.1, 0.32, 1.3], [0.45, -0.25, 1.2], [-0.05, -0.05, 1.1]] as const) {
        p.ellipse(cx + ox * rx, cy + oy * ry, r, r, alpha(c.dark, 0.5));
      }
      break;
    case "neon":
      p.ellipse(cx, cy - ry * 0.22, rx * 0.92, ry * 0.2, alpha(hex("#5ff2ff"), 0.95));
      p.ellipse(cx - rx * 0.35, cy + ry * 0.34, rx * 0.55, ry * 0.22, alpha(c.accent, 0.95));
      break;
    case "koi":
      p.ellipse(cx - rx * 0.42, cy - ry * 0.3, rx * 0.3, ry * 0.42, alpha(c.accent, 0.95));
      p.ellipse(cx + rx * 0.28, cy + ry * 0.18, rx * 0.26, ry * 0.4, alpha(c.accent, 0.9));
      p.ellipse(cx + rx * 0.62, cy - ry * 0.42, rx * 0.16, ry * 0.24, alpha(hex("#1b1b28"), 0.7));
      break;
    default:
      break;
  }
}

function paintTail(p: Pix, c: Paint, x: number, cy: number, span: number, fin: RGBA) {
  switch (c.art.tail) {
    case "fork":
      p.poly([[x, cy - 1.5], [x - span, cy - 7], [x - span * 0.55, cy], [x - span, cy + 7], [x, cy + 1.5]], fin);
      break;
    case "veil":
      p.poly([[x, cy - 2], [x - span * 1.15, cy - 9], [x - span * 0.8, cy - 1], [x - span * 1.2, cy + 8], [x, cy + 2]], fin);
      break;
    case "crescent":
      p.poly([[x, cy - 1], [x - span * 0.9, cy - 9], [x - span * 0.35, cy - 0.5], [x - span * 0.75, cy + 5.5], [x, cy + 1]], fin);
      break;
    case "point":
      p.poly([[x, cy - 2.5], [x - span, cy - 3.5], [x - span * 1.1, cy], [x - span, cy + 3.5], [x, cy + 2.5]], fin);
      break;
    default:
      p.poly([[x, cy - 2], [x - span, cy - 7.5], [x - span * 0.9, cy], [x - span, cy + 7.5], [x, cy + 2]], fin);
      break;
  }
}

function paintFish(p: Pix, c: Paint, cfg: { rx: number; ry: number; cx?: number; dorsal?: number }) {
  const cy = CELL_H / 2;
  const cx = cfg.cx ?? 25;
  const { rx, ry } = cfg;
  const fin = mix(c.body, c.accent, 0.42);

  paintTail(p, c, cx - rx + 1, cy, 9, fin);
  // Dorsal and anal fins, sized off the body so a tall fish gets a tall sail.
  const dorsal = cfg.dorsal ?? 5.5;
  p.poly([[cx - rx * 0.5, cy - ry + 1], [cx - rx * 0.1, cy - ry - dorsal], [cx + rx * 0.45, cy - ry + 1.5]], fin);
  p.poly([[cx - rx * 0.4, cy + ry - 1], [cx - rx * 0.05, cy + ry + dorsal * 0.6], [cx + rx * 0.3, cy + ry - 1]], fin);

  p.ellipse(cx, cy, rx, ry, c.body);
  applyPattern(p, c, cx, cy, rx, ry);
  // Pectoral fin sits in front of the body so it reads as nearer the viewer.
  p.poly([[cx + rx * 0.15, cy + 0.5], [cx - rx * 0.15, cy + ry * 0.95], [cx + rx * 0.4, cy + ry * 0.55]], mix(fin, c.dark, 0.2));
  p.shade(c.dark, c.light, 0.5, 0.42);
  // Gill slit and mouth, the two details that make a blob read as a fish.
  p.line(cx + rx * 0.45, cy - ry * 0.5, cx + rx * 0.38, cy + ry * 0.55, alpha(c.dark, 0.5));
  p.line(cx + rx * 0.93, cy + ry * 0.32, cx + rx * 0.75, cy + ry * 0.45, alpha(c.dark, 0.75));
  eye(p, cx + rx * 0.66, cy - ry * 0.3, hex("#141020"), 1.1);
  p.outline(mix(c.dark, hex("#05060f"), 0.45));
}

/**
 * The starter fish gets its own silhouette: a compact fancy goldfish with a
 * split fan tail, round belly and a handful of deliberate scale glints. Keeping
 * these marks on the 44×30 source grid makes them read cleanly at every zoom.
 */
function paintGoldfish(p: Pix, c: Paint) {
  const cx = 26;
  const cy = CELL_H / 2;
  const finDark = mix(c.dark, c.body, 0.35);
  const fin = mix(c.body, c.accent, 0.38);
  const finLight = mix(c.body, c.light, 0.55);

  // A broad, two-lobed fantail gives the starter fish an unmistakable profile.
  p.poly([[17, 12], [11, 6], [3, 4], [6, 12], [14, 15]], finDark);
  p.poly([[14, 15], [6, 18], [3, 26], [11, 24], [17, 18]], fin);
  p.line(15, 14, 6, 8, alpha(finLight, 0.88));
  p.line(14, 17, 6, 22, alpha(finLight, 0.82));

  // Tall but tidy fins match the chunky, jewel-like aquarium art.
  p.poly([[20, 10], [22, 5], [25, 2], [29, 9]], fin);
  p.line(23, 8, 25, 4, alpha(finLight, 0.8));
  p.poly([[20, 20], [20, 25], [25, 27], [29, 21]], finDark);

  // Plump body, slightly raised forehead and pale belly.
  p.ellipse(cx, cy, 11.2, 7.2, c.body);
  p.ellipse(32, 14.2, 6.2, 5.8, mix(c.body, c.light, 0.1));
  p.ellipse(27.5, 18.2, 8.2, 3.1, mix(c.body, c.light, 0.58));
  p.ellipse(24, 10.7, 5.8, 2.1, mix(c.body, c.light, 0.32));
  p.shade(c.dark, c.light, 0.43, 0.28);

  // A near pectoral fin and sparse, hand-placed scales keep the sprite legible.
  p.poly([[28, 16], [24, 22], [31, 20]], mix(fin, c.dark, 0.2));
  p.line(28, 17, 26, 20, alpha(finLight, 0.9));
  for (const [x, y] of [[20, 13], [23, 12], [26, 13], [22, 16], [25, 17], [29, 16]] as const) {
    p.set(x, y, alpha(c.light, 0.92));
    p.set(x + 1, y + 1, alpha(c.dark, 0.45));
  }
  p.line(31, 10.5, 30.5, 18.5, alpha(c.dark, 0.48));
  p.line(37, 17, 35, 18, alpha(c.dark, 0.78));
  eye(p, 34, 12.7, hex("#141020"), 1.15);
  p.set(32, 9, c.accent);
  p.set(29, 10, c.accent);
  p.outline(mix(c.dark, hex("#05060f"), 0.42));
}

function paintRound(p: Pix, c: Paint) {
  const cy = CELL_H / 2;
  const cx = 23;
  const r = 9.5;
  const fin = mix(c.body, c.accent, 0.35);
  paintTail(p, c, cx - r + 1, cy, 6, fin);
  // Spines all the way round: this is a puffer at rest, one bite from inflating.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    p.line(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), cx + Math.cos(a) * (r + 2.4), cy + Math.sin(a) * (r + 2.4), c.accent);
  }
  p.ellipse(cx, cy, r, r * 0.94, c.body);
  applyPattern(p, c, cx, cy, r, r);
  p.poly([[cx + 2, cy + 2], [cx - 2, cy + r], [cx + 5, cy + r * 0.7]], fin);
  p.shade(c.dark, c.light, 0.45, 0.4);
  eye(p, cx + r * 0.55, cy - r * 0.28, hex("#141020"), 1.4);
  p.ellipse(cx + r * 0.94, cy + r * 0.3, 1.4, 1.1, alpha(c.dark, 0.85));
  p.outline(mix(c.dark, hex("#05060f"), 0.4));
}

function paintShark(p: Pix, c: Paint) {
  const cy = CELL_H / 2;
  const fin = mix(c.body, c.dark, 0.25);
  paintTail(p, c, 8, cy, 8, fin);
  p.poly([[20, cy - 4], [24, cy - 12], [29, cy - 3]], fin);
  p.poly([[20, cy + 4], [22, cy + 9], [27, cy + 3]], fin);
  // Long tapered body with a pointed snout — the silhouette does all the work here.
  p.poly([[9, cy - 3.5], [20, cy - 6.5], [32, cy - 5], [40, cy - 0.6], [40, cy + 1.4], [30, cy + 5.5], [18, cy + 6], [9, cy + 3.5]], c.body);
  p.ellipse(24, cy + 2.6, 12, 3.2, c.light);
  p.poly([[26, cy + 4], [22, cy + 10], [31, cy + 5]], fin);
  p.shade(c.dark, c.light, 0.5, 0.3);
  p.line(36, cy + 2, 30, cy + 3.4, alpha(hex("#0d0d16"), 0.9), 1);
  for (let i = 0; i < 5; i++) p.line(28 - i * 1.8, cy - 1.5, 28 - i * 1.8, cy + 2, alpha(c.dark, 0.45));
  eye(p, 35, cy - 1.6, hex("#0b0b14"), 0.9);
  p.outline(mix(c.dark, hex("#04060c"), 0.5));
}

function paintEel(p: Pix, c: Paint) {
  const cy = CELL_H / 2;
  // A sine-swept spine of overlapping discs: cheap, and it reads as a body that is
  // already mid-undulation before the vertex shader adds its own wave.
  for (let x = 4; x <= 38; x++) {
    const t = (x - 4) / 34;
    const y = cy + Math.sin(t * Math.PI * 2.1) * 4.2 * (1 - t * 0.25);
    const r = 1.4 + Math.sin(t * Math.PI) * 2.5 - t * 0.5;
    p.ellipse(x, y, r * 0.8, r, c.body);
    if (x % 3 === 0) p.ellipse(x, y - r * 0.8, 0.6, 0.9, alpha(c.accent, 0.75));
  }
  const headY = cy + Math.sin(Math.PI * 2.1) * 3.15;
  p.ellipse(37, headY, 3.4, 2.9, c.body);
  p.shade(c.dark, c.light, 0.45, 0.35);
  eye(p, 38.4, headY - 0.8, hex("#0b1408"), 0.9);
  p.line(39.6, headY + 1.2, 37.2, headY + 1.8, alpha(c.dark, 0.8));
  p.outline(mix(c.dark, hex("#04120a"), 0.45));
}

function paintRay(p: Pix, c: Paint) {
  const cy = CELL_H / 2;
  // Seen from above and behind: a broad diamond with a whip tail trailing back.
  p.line(16, cy, 3, cy - 1.5, mix(c.dark, c.body, 0.5), 1.6);
  p.poly([[38, cy], [26, cy - 10], [14, cy - 5], [10, cy + 0.5], [16, cy + 6], [28, cy + 9]], c.body);
  p.ellipse(31, cy - 0.5, 6, 4.5, mix(c.body, c.light, 0.3));
  applyPattern(p, c, 27, cy - 0.5, 9, 6);
  p.shade(c.dark, c.light, 0.4, 0.4);
  eye(p, 34, cy - 3.2, hex("#0b0e18"), 0.85);
  eye(p, 34.5, cy + 1.6, hex("#0b0e18"), 0.85);
  p.outline(mix(c.dark, hex("#04060c"), 0.5));
}

function paintJelly(p: Pix, c: Paint) {
  const cx = 22, top = 9;
  // Tentacles first so the bell overlaps them.
  for (let i = 0; i < 7; i++) {
    const x = cx - 6 + i * 2;
    const sway = Math.sin(i * 1.4) * 2.2;
    p.line(x, top + 5, x + sway, top + 17 - Math.abs(i - 3) * 1.4, alpha(c.light, 0.85));
  }
  p.ellipse(cx, top + 2, 9, 7.5, c.body);
  p.rect(cx - 9, top + 2, 19, 4, c.body);
  p.ellipse(cx, top + 6, 9, 2.4, mix(c.body, c.dark, 0.3));
  p.ellipse(cx - 2.5, top - 0.5, 4, 3, alpha(c.light, 0.6));
  for (let i = 0; i < 4; i++) p.ellipse(cx - 4.5 + i * 3, top + 4.5, 1.4, 1.8, alpha(c.accent, 0.7));
  p.shade(c.dark, c.light, 0.3, 0.45);
  p.outline(alpha(mix(c.dark, hex("#1a0a2e"), 0.4), 0.85));
}

function paintOctopus(p: Pix, c: Paint) {
  const cx = 22, cy = 12;
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const x = cx - 9 + i * 2.6;
    const curl = Math.sin(i * 1.9) * 3.4;
    const len = 9 + Math.sin(t * Math.PI) * 4;
    p.line(x, cy + 4, x + curl, cy + len, c.body, 1.8);
    p.ellipse(x + curl, cy + len, 1, 1, mix(c.body, c.light, 0.4));
  }
  p.ellipse(cx, cy, 9.5, 8.5, c.body);
  applyPattern(p, c, cx, cy, 9, 8);
  p.shade(c.dark, c.light, 0.4, 0.45);
  eye(p, cx + 4.4, cy - 0.5, hex("#170618"), 1.6);
  eye(p, cx - 3.6, cy - 0.8, hex("#170618"), 1.4);
  p.outline(mix(c.dark, hex("#12021a"), 0.45));
}

function paintCrab(p: Pix, c: Paint) {
  const cy = 17, cx = 22;
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      p.line(cx + s * 4, cy + 2, cx + s * (9 + i * 2.4), cy + 6 + i * 1.4, mix(c.body, c.dark, 0.25), 1.4);
    }
  }
  // Claws held up and forward — the pose is the whole personality.
  for (const s of [-1, 1]) {
    p.line(cx + s * 6, cy - 1, cx + s * 12, cy - 5, c.body, 1.8);
    p.ellipse(cx + s * 13.5, cy - 6.5, 3.4, 2.8, c.body);
    p.line(cx + s * 15, cy - 8, cx + s * 11.5, cy - 6.6, alpha(c.accent, 0.9));
  }
  p.ellipse(cx, cy, 9, 6.2, c.body);
  p.ellipse(cx, cy - 1.5, 7.5, 3.4, mix(c.body, c.light, 0.35));
  p.shade(c.dark, c.light, 0.4, 0.4);
  eye(p, cx - 3, cy - 4.2, hex("#180404"), 1);
  eye(p, cx + 3, cy - 4.2, hex("#180404"), 1);
  p.outline(mix(c.dark, hex("#180404"), 0.45));
}

function paintShrimp(p: Pix, c: Paint) {
  const cy = 16;
  // Segmented arc, thickest at the shoulder, tucking into a tail fan.
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 12 + i * 2.6;
    const y = cy - Math.sin(t * Math.PI * 0.85) * 4;
    const r = 1.6 + Math.sin(t * Math.PI) * 2.2;
    p.ellipse(x, y, r * 0.85, r, i % 2 === 0 ? c.body : mix(c.body, c.light, 0.25));
  }
  p.poly([[13, cy - 1], [6, cy - 5], [8, cy], [6, cy + 4]], mix(c.body, c.accent, 0.4));
  p.line(35, cy - 4, 42, cy - 9, alpha(c.accent, 0.85));
  p.line(35, cy - 3, 43, cy - 4, alpha(c.accent, 0.7));
  for (let i = 0; i < 4; i++) p.line(20 + i * 3, cy - 1.5, 19 + i * 3, cy + 4, alpha(c.dark, 0.6));
  p.shade(c.dark, c.light, 0.35, 0.4);
  eye(p, 34.5, cy - 4.5, hex("#1a0308"), 0.9);
  p.outline(mix(c.dark, hex("#1a0308"), 0.45));
}

function paintSnail(p: Pix, c: Paint) {
  const cy = 19, cx = 21;
  p.ellipse(cx + 3, cy + 2, 11, 3.4, mix(c.body, c.dark, 0.35));
  p.ellipse(cx + 12, cy - 1, 4, 3.4, mix(c.body, c.light, 0.3));
  p.line(cx + 14, cy - 3.5, cx + 16.5, cy - 9, mix(c.body, c.light, 0.2));
  p.line(cx + 11, cy - 3.8, cx + 12, cy - 9.5, mix(c.body, c.light, 0.2));
  p.ellipse(cx + 16.5, cy - 9.5, 1, 1, hex("#141020"));
  p.ellipse(cx + 12, cy - 10, 1, 1, hex("#141020"));
  // Spiral shell: two and a bit turns of a shrinking arc.
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 4.4;
    const r = 8.4 * (1 - i / 105);
    p.ellipse(cx - 1 + Math.cos(a) * r, cy - 4 + Math.sin(a) * r * 0.86, 1.7, 1.7, i % 18 < 9 ? c.body : c.accent);
  }
  p.shade(c.dark, c.light, 0.4, 0.35);
  p.outline(mix(c.dark, hex("#100c04"), 0.5));
}

function paintSpecies(id: SpeciesId): Pix {
  const p = new Pix(CELL_W, CELL_H);
  const art = SPECIES[id].art;
  const c: Paint = {
    dark: hex(art.palette[0]),
    body: hex(art.palette[1]),
    light: hex(art.palette[2]),
    accent: hex(art.accent),
    art,
  };
  switch (art.shape) {
    case "round": paintRound(p, c); break;
    case "shark": paintShark(p, c); break;
    case "eel": paintEel(p, c); break;
    case "ray": paintRay(p, c); break;
    case "jelly": paintJelly(p, c); break;
    case "octopus": paintOctopus(p, c); break;
    case "crab": paintCrab(p, c); break;
    case "shrimp": paintShrimp(p, c); break;
    case "snail": paintSnail(p, c); break;
    default: {
      if (id === "goldfish") {
        paintGoldfish(p, c);
        break;
      }
      // Body proportions per species so a tetra is not a small goldfish.
      const profile: Partial<Record<SpeciesId, { rx: number; ry: number; dorsal: number }>> = {
        tetra: { rx: 9.5, ry: 4.2, dorsal: 3.2 },
        clownfish: { rx: 10, ry: 6, dorsal: 4.4 },
        angelfish: { rx: 8.5, ry: 8.6, dorsal: 8 },
        anglerfish: { rx: 10.5, ry: 7.4, dorsal: 3 },
        koi: { rx: 12, ry: 6.2, dorsal: 4.6 },
      };
      paintFish(p, c, profile[id] ?? { rx: 10.5, ry: 6.4, dorsal: 5 });
      if (id === "anglerfish") {
        // The lantern hangs out in FRONT of the snout — that is the whole point of
        // the animal, and behind the head it just reads as a bug.
        p.line(31.5, 8.5, 38.5, 4.5, hex("#2b2118"));
        p.ellipse(40, 3.6, 2.2, 2.2, hex("#ffe066"));
        p.ellipse(40, 3.6, 3.6, 3.6, alpha(hex("#ffe066"), 0.26));
        for (let i = 0; i < 3; i++) p.set(34.5 - i * 2, 18.4, hex("#ffffff"));
      }
      break;
    }
  }
  return p;
}

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

// ── Props: pellets, coins, particles ─────────────────────────────────────────

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

// ── Cursor ───────────────────────────────────────────────────────────────────

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
