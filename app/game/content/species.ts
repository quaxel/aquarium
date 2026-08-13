import type { Species, SpeciesId } from "../types";

// Fish are machines. Every one of them turns something in the tank into coins in a
// visibly different way, so buying one changes what the water looks like — not just
// what a number does.
//
// ── The ladder ───────────────────────────────────────────────────────────────
// The numbers below are not hand-picked. Each species sits on a geometric ladder of
// raw throughput, `production = baseValue / chew` coins per second per fish:
//
//     production(k) = 5.5 × 4^k          k = the species' rung, 0..14
//     baseCost(k)   = production(k) × 120 → a flat 120-second payback at every rung
//
// A constant payback is what keeps every tier of the game feeling the same to buy
// into, and a ×4 rung is the genre's usual unlock cadence. Species whose real value
// is an ability rather than throughput (collectors, cleaners, diggers, the eel's
// buff) are discounted off the ladder on both sides — they produce less and cost
// less, and you buy them for what they do.
//
// `costGrowth` is 1.12 for everything — inside the genre's 1.07–1.15 band, at the
// low end because the tank caps the count. The previous 1.28–1.40 was so far outside
// it that a third fish of any species was already unaffordable, which is what
// flattened the whole economy. The low end matters more than it looks: filling an
// N-slot tank costs base×(g^N−1)/(g−1), which is exponential in N, and the caps grow
// 4 → 100. At 1.15 the last tanks cost an order of magnitude more to stock than the
// income ladder grows, which showed up as a single 34-minute tank in testing.

export const SPECIES: Record<SpeciesId, Species> = {
  goldfish: {
    id: "goldfish",
    name: "Japon Balığı",
    emoji: "🐟",
    tier: 0,
    baseCost: 670,
    costGrowth: 1.12,
    baseValue: 3,
    chew: 0.55,
    senseRadius: 3.2,
    swimSpeed: 1.05,
    length: 1.05,
    depthBias: 0.5,
    prey: true,
    abilities: [],
    blurb: "Yem yer, para çıkarır. Her imparatorluk bir fanusta başlar.",
    art: { shape: "fish", palette: ["#8a3a06", "#f5811d", "#ffd27a"], accent: "#fff0c0", tail: "fan" },
  },

  tetra: {
    id: "tetra",
    name: "Neon Tetra",
    emoji: "🐠",
    tier: 0,
    baseCost: 2700,
    costGrowth: 1.12,
    baseValue: 4.8,
    chew: 0.22,
    senseRadius: 4.4,
    swimSpeed: 1.75,
    length: 0.6,
    depthBias: 0.62,
    prey: true,
    abilities: [{ kind: "school", radius: 3.1, per: 0.22, max: 6 }],
    blurb: "Küçük ve hızlı. Yanındaki her tetra için +%22 üretim — sürü kur.",
    art: { shape: "fish", palette: ["#0b3a63", "#1f9ede", "#8ff6ff"], accent: "#ff4d6d", pattern: "neon", tail: "fork" },
  },

  snail: {
    id: "snail",
    name: "Salyangoz",
    emoji: "🐌",
    tier: 1,
    baseCost: 5900,
    costGrowth: 1.12,
    baseValue: 56,
    chew: 1.6,
    senseRadius: 1.6,
    swimSpeed: 0.22,
    length: 0.5,
    visualScale: 1.55,
    depthBias: 0.02,
    floorDweller: true,
    abilities: [{ kind: "cleaner", rate: 0.02 }],
    blurb: "Camı ve dibi yalar. Suyu temiz tutar; kirli su bütün üretimi düşürür.",
    art: { shape: "snail", palette: ["#4a3016", "#a5742f", "#e8bd77"], accent: "#7fe0a0", pattern: "bands" },
  },

  shrimp: {
    id: "shrimp",
    name: "Temizlikçi Karides",
    emoji: "🦐",
    tier: 1,
    baseCost: 23000,
    costGrowth: 1.12,
    baseValue: 84,
    chew: 0.6,
    senseRadius: 2.4,
    swimSpeed: 0.85,
    length: 0.45,
    visualScale: 1.65,
    depthBias: 0.12,
    floorDweller: true,
    abilities: [
      { kind: "collector", radius: 2.6, capacity: 1, speed: 1.5 },
      { kind: "cleaner", rate: 0.006 },
    ],
    blurb: "Dibe düşen paraları toplar. Köpekbalığını temizlerse üretimi ×3 olur.",
    art: { shape: "shrimp", palette: ["#8c1f2a", "#e2604b", "#ffb9a2"], accent: "#fff1e0" },
  },

  clownfish: {
    id: "clownfish",
    name: "Palyaço Balığı",
    emoji: "🤡",
    tier: 2,
    baseCost: 168000,
    costGrowth: 1.12,
    baseValue: 700,
    chew: 0.5,
    senseRadius: 3.6,
    swimSpeed: 1.2,
    length: 0.72,
    depthBias: 0.35,
    prey: true,
    abilities: [],
    blurb: "Deniz şakayığıyla aynı tanktaysa evindedir: üretimi ×2.6 olur.",
    art: { shape: "fish", palette: ["#8a3400", "#ff8420", "#ffd08a"], accent: "#ffffff", pattern: "bands", tail: "fan" },
  },

  angelfish: {
    id: "angelfish",
    name: "Melek Balığı",
    emoji: "👼",
    tier: 2,
    baseCost: 675000,
    costGrowth: 1.12,
    baseValue: 8400,
    chew: 1.5,
    senseRadius: 3.0,
    swimSpeed: 0.7,
    length: 1.15,
    depthBias: 0.6,
    abilities: [],
    blurb: "Yavaş çiğner ama lokması ağırdır. Berrak suda değeri ikiye katlanır.",
    art: { shape: "fish", palette: ["#2b2b57", "#cdd9ff", "#ffffff"], accent: "#ffd54a", pattern: "stripes", tail: "veil" },
  },

  pufferfish: {
    id: "pufferfish",
    name: "Kirpi Balığı",
    emoji: "🐡",
    tier: 3,
    baseCost: 1.9e6,
    costGrowth: 1.12,
    baseValue: 7000,
    chew: 0.7,
    senseRadius: 3.4,
    swimSpeed: 0.62,
    length: 0.95,
    depthBias: 0.45,
    abilities: [{ kind: "inflate", bites: 12, popMul: 3.4 }],
    blurb: "Yedikçe şişer. 12 lokmada PATLAR ve biriktirdiğinin 3.4 katını saçar.",
    art: { shape: "round", palette: ["#6b5a12", "#dcc74e", "#fff5ad"], accent: "#3a3320", pattern: "spots" },
  },

  crab: {
    id: "crab",
    name: "Yengeç",
    emoji: "🦀",
    tier: 3,
    baseCost: 5.9e6,
    costGrowth: 1.12,
    baseValue: 32400,
    chew: 0.9,
    senseRadius: 2.2,
    swimSpeed: 0.75,
    length: 0.7,
    visualScale: 1.35,
    depthBias: 0.02,
    floorDweller: true,
    abilities: [
      { kind: "collector", radius: 2.2, capacity: 2, speed: 1.2 },
      { kind: "dig", interval: 20, luck: 0.55 },
    ],
    blurb: "Kumu eşeler, dipteki her şeyi toplar. Vatozla birlikte iki kat kazı.",
    art: { shape: "crab", palette: ["#7a1608", "#dd4a2c", "#ff9a70"], accent: "#2b0b06" },
  },

  stingray: {
    id: "stingray",
    name: "Vatoz",
    emoji: "🥏",
    tier: 4,
    baseCost: 2.6e7,
    costGrowth: 1.12,
    baseValue: 130000,
    chew: 0.8,
    senseRadius: 3.2,
    swimSpeed: 0.68,
    length: 1.5,
    depthBias: 0.08,
    floorDweller: true,
    abilities: [{ kind: "dig", interval: 13, luck: 1 }],
    blurb: "Kumu süpürerek gömülü hazine çıkarır. Sandıklar tek başına bir gelir kalemi.",
    art: { shape: "ray", palette: ["#2b3550", "#63789e", "#b3c7e6"], accent: "#141a28", pattern: "spots" },
  },

  eel: {
    id: "eel",
    name: "Elektrikli Yılan Balığı",
    emoji: "⚡",
    tier: 4,
    baseCost: 1.04e8,
    costGrowth: 1.12,
    baseValue: 390000,
    chew: 0.6,
    senseRadius: 3.8,
    swimSpeed: 0.95,
    length: 1.9,
    depthBias: 0.3,
    abilities: [{ kind: "shock", interval: 9, radius: 4.2, mul: 3, duration: 5 }],
    blurb: "9 saniyede bir çevresini şoklar: menzildeki balıklar 5 saniye ×3 üretir.",
    art: { shape: "eel", palette: ["#123a1f", "#33a055", "#95ffab"], accent: "#ccff5e", glow: "#9dff6a" },
  },

  jellyfish: {
    id: "jellyfish",
    name: "Denizanası",
    emoji: "🎐",
    tier: 5,
    baseCost: 4.8e8,
    costGrowth: 1.12,
    baseValue: 3.2e6,
    chew: 1.1,
    senseRadius: 2.6,
    swimSpeed: 0.4,
    length: 0.9,
    depthBias: 0.8,
    abilities: [
      { kind: "bubbler", rate: 1.1, value: 2.5e5 },
      { kind: "passive", perSecond: 4.3e5 },
    ],
    blurb: "Yükselen baloncukları paraya çevirir ve hiç durmadan pasif gelir üretir.",
    art: { shape: "jelly", palette: ["#3d1f66", "#a862e6", "#f4ccff"], accent: "#ffd7f5", glow: "#c98cff" },
  },

  octopus: {
    id: "octopus",
    name: "Ahtapot",
    emoji: "🐙",
    tier: 5,
    baseCost: 1.65e9,
    costGrowth: 1.12,
    baseValue: 7.8e6,
    chew: 0.75,
    senseRadius: 4.6,
    swimSpeed: 0.85,
    length: 1.35,
    depthBias: 0.2,
    abilities: [{ kind: "collector", radius: 5.2, capacity: 8, speed: 2.4 }],
    blurb: "Sekiz kolla aynı anda sekiz nesne toplar. Toplama sorununu tamamen bitirir.",
    art: { shape: "octopus", palette: ["#4a0f3a", "#ab2d83", "#f486c6"], accent: "#ffd0ea", pattern: "spots" },
  },

  anglerfish: {
    id: "anglerfish",
    name: "Fener Balığı",
    emoji: "🏮",
    tier: 6,
    baseCost: 1.1e10,
    costGrowth: 1.12,
    baseValue: 8.3e7,
    chew: 0.9,
    senseRadius: 6.5,
    swimSpeed: 0.6,
    length: 1.25,
    depthBias: 0.18,
    abilities: [{ kind: "lure", radius: 5.5, force: 2.6 }],
    blurb: "Feneriyle yemleri kendine çeker. Etrafındaki her şey ona doğru akar.",
    art: { shape: "fish", palette: ["#0d1526", "#2b3d58", "#6b83a3"], accent: "#ffe066", tail: "point", glow: "#ffe066" },
  },

  shark: {
    id: "shark",
    name: "Köpekbalığı",
    emoji: "🦈",
    tier: 6,
    baseCost: 4.4e10,
    costGrowth: 1.12,
    baseValue: 1.48e8,
    chew: 0.4,
    senseRadius: 7.5,
    swimSpeed: 1.35,
    length: 2.6,
    depthBias: 0.45,
    abilities: [{ kind: "predator", interval: 26, gain: 1 }],
    blurb: "Küçük balıkları yer. Yediği her balığın değerini kalıcı olarak devralır.",
    art: { shape: "shark", palette: ["#1e2b38", "#63809a", "#c3d6e6"], accent: "#ffffff", tail: "crescent" },
  },

  koi: {
    id: "koi",
    name: "Altın Koi",
    emoji: "🎏",
    tier: 7,
    baseCost: 1.41e11,
    costGrowth: 1.12,
    baseValue: 8.9e8,
    chew: 1.0,
    senseRadius: 4.2,
    swimSpeed: 0.75,
    length: 1.8,
    depthBias: 0.55,
    abilities: [{ kind: "passive", perSecond: 1.8e8 }],
    blurb: "Uğur getirir: hiç yemeden basar. İki koi birbirini %90 güçlendirir.",
    art: { shape: "fish", palette: ["#8a1c0a", "#fff6ee", "#ffffff"], accent: "#ff5722", pattern: "koi", tail: "veil" },
  },
};

export const SPECIES_ORDER: SpeciesId[] = [
  "goldfish", "tetra", "snail", "shrimp", "clownfish", "angelfish",
  "pufferfish", "crab", "stingray", "eel", "jellyfish", "octopus",
  "anglerfish", "shark", "koi",
];

/**
 * Growth stages. A fish visibly gets bigger as it eats and its output climbs with
 * it, which is what makes the first ten minutes of hand-feeding feel like it went
 * somewhere. This is a *free* multiplier paid for in time, so the thresholds are
 * deliberately long — a fish reaching Efsane is a milestone, not a formality.
 */
export const STAGES = [
  { name: "Yavru", xp: 0, scale: 0.5, mul: 1 },
  { name: "Genç", xp: 25, scale: 0.72, mul: 2.1 },
  { name: "Yetişkin", xp: 120, scale: 0.94, mul: 4.6 },
  { name: "Kıdemli", xp: 400, scale: 1.14, mul: 10 },
  { name: "Efsane", xp: 1200, scale: 1.36, mul: 24 },
] as const;

export function stageFor(xp: number): number {
  let stage = 0;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (xp >= STAGES[i].xp) { stage = i; break; }
  }
  return stage;
}

/** Progress toward the next stage, 0..1 (1 when already maxed). */
export function stageProgress(xp: number): number {
  const stage = stageFor(xp);
  if (stage >= STAGES.length - 1) return 1;
  const from = STAGES[stage].xp;
  const to = STAGES[stage + 1].xp;
  return Math.min(1, (xp - from) / (to - from));
}

export function speciesCost(id: SpeciesId, owned: number): number {
  const s = SPECIES[id];
  return Math.ceil(s.baseCost * Math.pow(s.costGrowth, owned));
}

// ── Breeding programme (the continuous coin sink) ────────────────────────────
//
// The tank caps how many fish you can own, which means that without this the shop
// runs dry two minutes into every run and the rest of the run is spent waiting. A
// breeding level is the missing exponential sink: unbounded, priced at 1.15× per
// level, and paying a strictly *linear* +25% to that species' output.
//
// Exponential cost against linear income is the seesaw the whole genre is built on
// — it is what makes each next purchase take a little longer than the last.

export const SCHOOL_GAIN = 0.25;
export const SCHOOL_GROWTH = 1.15;
export const SCHOOL_MILESTONE = 30;
export const SCHOOL_MILESTONE_MUL = 1.35;
const SCHOOL_BASE_FACTOR = 0.75;

export function schoolCost(id: SpeciesId, level: number): number {
  return Math.ceil(SPECIES[id].baseCost * SCHOOL_BASE_FACTOR * Math.pow(SCHOOL_GROWTH, level));
}

/**
 * Linear in the level, with a ×1.35 milestone every thirty. Pure linear stalls
 * dead once the level is high — the next +25% is a fraction of a percent while the
 * price is still climbing 15% a step — and the run flatlines into a wait. The
 * milestones are the genre's answer to that: they keep the track alive and give the
 * run its "bump of rapid purchases" rhythm.
 *
 * The size of the bump is delicate, and it is the tail of the game that pays for
 * getting it wrong. The linear term is self-limiting on its own (over 230 levels it
 * is ×58 against a ×1.5e14 price), but the milestone is superlinear, and a fixed
 * ×200 tank bar cannot absorb a superlinear term forever. Measured: ×2 every 20
 * snowballed to a ×2.6M species multiplier and dropped the last two tanks to two
 * minutes each; ×1.5 every 25 still left the last three at 6.6, 5.6 and 2.3.
 */
export function schoolMultiplier(level: number): number {
  return (1 + level * SCHOOL_GAIN) * Math.pow(SCHOOL_MILESTONE_MUL, Math.floor(level / SCHOOL_MILESTONE));
}

/** Levels remaining until the next ×2, for the shop readout. */
export function schoolToMilestone(level: number): number {
  return SCHOOL_MILESTONE - (level % SCHOOL_MILESTONE);
}
