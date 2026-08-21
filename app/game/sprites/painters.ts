import { SPECIES_ORDER, SPECIES } from "../content/species";
import type { FishArt, SpeciesId } from "../types";
import { Pix, alpha, hex, mix, type RGBA } from "./raster";

export const CELL_W = 44;
export const CELL_H = 30;

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

export function paintSpecies(id: SpeciesId): Pix {
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
