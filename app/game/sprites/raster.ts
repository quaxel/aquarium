export type RGBA = number; // 0xRRGGBBAA

export function hex(color: string): RGBA {
  const s = color.replace("#", "");
  const v = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return ((v << 8) >>> 0) | 0xff;
}

export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  const k = Math.max(0, Math.min(1, t));
  const ar = (a >>> 24) & 255, ag = (a >>> 16) & 255, ab = (a >>> 8) & 255, aa = a & 255;
  const br = (b >>> 24) & 255, bg = (b >>> 16) & 255, bb = (b >>> 8) & 255, ba = b & 255;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  const al = Math.round(aa + (ba - aa) * k);
  return ((r << 24) | (g << 16) | (bl << 8) | al) >>> 0;
}

export function alpha(color: RGBA, a: number): RGBA {
  return ((color & 0xffffff00) | Math.round(Math.max(0, Math.min(1, a)) * 255)) >>> 0;
}

/** A tiny integer raster target. Everything is plotted on whole pixels — no AA. */
export class Pix {
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
