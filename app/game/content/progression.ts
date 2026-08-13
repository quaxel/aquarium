import type { Decor, DecorId, SpeciesId, Synergy, Tank } from "../types";

// Prestige with a theme. You do not "reset the run" — you sell the tank and move the
// whole operation into a bigger one, which is the same maths dressed as a promotion
// and gives the player a picture of where they are instead of a counter.

/** The geometric backbone of the tank ladder. */
const TANK_BASE = 25000;
const TANK_RATIO = 200;

/**
 * Late-game income grows faster than the geometric backbone because large rosters,
 * stacked synergies, upgrades and breeding levels compound during the extra time a
 * run is given. These are progression-bar multipliers, not time multipliers: values
 * in the thousands are needed to turn a two-minute late run into seven minutes.
 */
const TANK_PACING: Partial<Record<number, number>> = {
  3: 3e3, // Restaurant
  4: 3e4, // Public aquarium
  5: 5e5, // Research center
  6: 3e4, // Underwater habitat
};

export function tankPacing(index: number): number {
  return TANK_PACING[Math.max(0, index)] ?? 1;
}

/**
 * The run's yardstick for a given tank. Unlike `moveRequirement` it stays finite on
 * the last tank, which has no bar left to clear.
 */
export function tankBar(index: number): number {
  const safeIndex = Math.max(0, index);
  return TANK_BASE * Math.pow(TANK_RATIO, safeIndex) * tankPacing(safeIndex);
}

// Eight places, not one place with eight labels. Each tank paints its own water
// gradient, floor and horizon silhouette in the same flat-vector language the
// painted backdrop uses, so moving up the chain visibly changes where you are.

/**
 * Painted backdrops that exist in /public/assets, by tank index. Anything not
 * listed here stays on its procedural environment.
 *
 * This is a list rather than a field on each tank so the game never requests an
 * image that is not there — a hopeful path would 404 in the console on every load
 * for every tank still waiting on art. Drop the PNG in, add one line here.
 * See assets/BACKGROUND-PROMPTS.md for the prompts and the composition rules.
 */
const PAINTED_BACKDROPS: Record<number, string> = {
  0: "/assets/tank-0-bowl-room-clean-v3.png",
  1: "/assets/tank-1-desk.png",
  2: "/assets/tank-2-tropical.png",
  3: "/assets/tank-3-restaurant.png",
  4: "/assets/tank-4-public.png",
  5: "/assets/tank-5-research.png",
  6: "/assets/tank-6-habitat.png",
  7: "/assets/tank-7-space.png",
};

export const TANKS: Tank[] = ([
  {
    index: 0, name: "Fanus", short: "FANUS", emoji: "🥣",
    fishCap: 4, halfWidth: 3.1,
    tint: [0.16, 0.62, 0.78],
    scenery: {
      // Shallow, warm and almost empty: a bowl on a sunny desk.
      waterTop: [0.42, 0.9, 0.95], waterBottom: [0.2, 0.66, 0.82],
      floor: [0.86, 0.79, 0.6], ink: [0.22, 0.5, 0.62], glow: [1, 0.92, 0.7],
      ridge: [0.13, 9, 0.1, 0.8],
      features: [0, 0, 0, 0],
    },
    blurb: "Bir masa lambasının yanında, tek Japon balığıyla.",
  },
  {
    index: 1, name: "Masaüstü Akvaryumu", short: "MASAÜSTÜ", emoji: "🪟",
    fishCap: 9, halfWidth: 4.2,
    tint: [0.14, 0.66, 0.8],
    scenery: {
      // Planted tank: tall thin blades crowding both ends of the glass.
      waterTop: [0.3, 0.82, 0.86], waterBottom: [0.11, 0.5, 0.66],
      floor: [0.62, 0.62, 0.5], ink: [0.13, 0.4, 0.36], glow: [0.85, 1, 0.7],
      ridge: [0.34, 15, 0.7, 0.45],
      features: [0, 0, 0, 0],
    },
    blurb: "Gerçek bir filtre, gerçek bir kapak, gerçek bir hobi.",
  },
  {
    index: 2, name: "Tropikal Tank", short: "TROPİKAL", emoji: "🌴",
    fishCap: 15, halfWidth: 5.3,
    tint: [0.1, 0.7, 0.72],
    scenery: {
      // Reef: dense rounded coral heads all the way across, warm turquoise water.
      waterTop: [0.24, 0.88, 0.85], waterBottom: [0.07, 0.55, 0.72],
      floor: [0.85, 0.8, 0.55], ink: [0.11, 0.36, 0.55], glow: [1, 0.75, 0.5],
      ridge: [0.24, 11, 0.1, 0.35],
      features: [0, 0, 0, 0],
    },
    blurb: "Isıtıcı, mercan, renk. Artık koleksiyon yapıyorsun.",
  },
  {
    index: 3, name: "Restoran Akvaryumu", short: "RESTORAN", emoji: "🍽️",
    fishCap: 24, halfWidth: 6.4,
    tint: [0.12, 0.58, 0.86],
    scenery: {
      // Wall-set display: darker water, a framing arch and warm lamps above.
      waterTop: [0.09, 0.42, 0.66], waterBottom: [0.04, 0.2, 0.4],
      floor: [0.5, 0.44, 0.42], ink: [0.05, 0.13, 0.26], glow: [1, 0.76, 0.38],
      ridge: [0.12, 7, 0.2, 0.75],
      features: [0.75, 0, 0, 0.5],
    },
    blurb: "Duvara gömülü dev cam. İnsanlar yemek yerken balıklarına bakıyor.",
  },
  {
    index: 4, name: "Halka Açık Akvaryum", short: "HALKA AÇIK", emoji: "🎟️",
    fishCap: 36, halfWidth: 7.5,
    tint: [0.08, 0.5, 0.9],
    scenery: {
      // The tunnel: one huge arch, open blue water, distant viewing glow.
      waterTop: [0.1, 0.55, 0.92], waterBottom: [0.03, 0.22, 0.55],
      floor: [0.55, 0.6, 0.62], ink: [0.04, 0.14, 0.34], glow: [0.6, 0.9, 1],
      ridge: [0.1, 5, 0.15, 0.9],
      features: [1, 0, 0, 0.35],
    },
    blurb: "Bilet satıyorsun. Tünelden geçen çocuklar köpekbalığına bakıyor.",
  },
  {
    index: 5, name: "Okyanus Araştırma Merkezi", short: "ARAŞTIRMA", emoji: "🔬",
    fishCap: 52, halfWidth: 8.6,
    tint: [0.06, 0.42, 0.88],
    scenery: {
      // Clinical: a steel panel wall behind the water and instrument lights.
      waterTop: [0.12, 0.52, 0.78], waterBottom: [0.04, 0.24, 0.46],
      floor: [0.42, 0.48, 0.55], ink: [0.06, 0.16, 0.3], glow: [0.5, 1, 0.95],
      ridge: [0.16, 26, 0.95, 0.15],
      features: [0.25, 0, 0, 0.9],
    },
    blurb: "Artık balık beslemiyorsun; bir ekosistemi finanse ediyorsun.",
  },
  {
    index: 6, name: "Denizaltı Habitatı", short: "HABİTAT", emoji: "🛟",
    fishCap: 72, halfWidth: 9.8,
    tint: [0.05, 0.3, 0.8],
    scenery: {
      // Deep sea: jagged rock spires, near-black water, glowing vents.
      waterTop: [0.05, 0.24, 0.5], waterBottom: [0.01, 0.07, 0.2],
      floor: [0.24, 0.26, 0.34], ink: [0.02, 0.06, 0.15], glow: [0.4, 1, 0.85],
      ridge: [0.34, 8, 0.95, 0.25],
      features: [0, 0, 0, 1],
    },
    blurb: "Camın diğer tarafı da su. Kimin akvaryumda olduğu tartışmalı.",
  },
  {
    index: 7, name: "Uzay Akvaryumu", short: "UZAY", emoji: "🛰️",
    fishCap: 100, halfWidth: 11.2,
    tint: [0.24, 0.28, 0.92],
    scenery: {
      // Orbit: starfield above the waterline and a planet's limb behind it.
      waterTop: [0.16, 0.14, 0.44], waterBottom: [0.05, 0.04, 0.18],
      floor: [0.3, 0.26, 0.44], ink: [0.03, 0.02, 0.12], glow: [0.75, 0.7, 1],
      ridge: [0.14, 6, 0.85, 0.7],
      features: [0, 1, 1, 0.3],
    },
    blurb: "Yörüngede dönen bir su küresi. Buradan sonrası sadece daha fazlası.",
  },
] as Omit<Tank, "moveRequirement">[]).map((tank, index, all) => ({
  ...tank,
  background: PAINTED_BACKDROPS[index],
  // The last tank has nowhere to move on to.
  moveRequirement: index === all.length - 1 ? Infinity : tankBar(index),
}));

export const DECOR: Record<DecorId, Decor> = {
  anemone: {
    id: "anemone", name: "Deniz Şakayığı", emoji: "🪸", cost: 4e4, tier: 1,
    blurb: "Palyaço balığının evi. Yanına bir palyaço koy, gerisini o halleder.",
    effect: { kind: "globalMul", mul: 1.08 },
  },
  coral: {
    id: "coral", name: "Mercan Bahçesi", emoji: "🌺", cost: 1.2e6, tier: 2,
    blurb: "Bütün tankın üretimini yükseltir.",
    effect: { kind: "globalMul", mul: 1.18 },
  },
  wreck: {
    id: "wreck", name: "Batık Gemi", emoji: "⚓", cost: 2e8, tier: 3,
    blurb: "Sikkeler batıktan çıkmış gibi görünüyor — ve daha çok ediyor.",
    effect: { kind: "coinValue", mul: 1.3 },
  },
  helmet: {
    id: "helmet", name: "Dalgıç Kaskı", emoji: "🪖", cost: 4e10, tier: 4,
    blurb: "İçinden kabarcık çıkıyor. Bütün üretim yükseliyor.",
    effect: { kind: "globalMul", mul: 1.35 },
  },
  amphora: {
    id: "amphora", name: "Antik Amfora", emoji: "🏺", cost: 8e12, tier: 5,
    blurb: "İçi dolu. Toplanan her şey daha değerli.",
    effect: { kind: "coinValue", mul: 1.6 },
  },
  chest: {
    id: "chest", name: "Hazine Sandığı", emoji: "💎", cost: 1.6e15, tier: 6,
    blurb: "Kapağı açık duruyor ve kapanmıyor.",
    effect: { kind: "globalMul", mul: 1.9 },
  },
};

export const DECOR_ORDER: DecorId[] = ["anemone", "coral", "wreck", "helmet", "amphora", "chest"];

// The real end-game question this design is aiming at: "which fish do I put in the
// same tank so the system breaks?" Synergies are deliberately discoverable — the
// panel shows the requirement before you own the pieces.
export const SYNERGIES: Synergy[] = [
  {
    id: "cleanShark", name: "Temizlik Anlaşması", emoji: "🦐🦈",
    blurb: "Karides köpekbalığını temizler; köpekbalığı üç kat üretir.",
    req: { species: { shrimp: 1, shark: 1 } },
    effects: [{ kind: "speciesMul", species: "shark", mul: 3 }],
  },
  {
    id: "popCollect", name: "Patlat ve Topla", emoji: "🐡🐙",
    blurb: "Kirpi patlayınca ahtapot bütün parayı anında toplar (+%60 değer).",
    req: { species: { pufferfish: 1, octopus: 1 } },
    effects: [{ kind: "flag", flag: "instantPop" }, { kind: "coinValue", mul: 1.6 }],
  },
  {
    id: "massShock", name: "Toplu Elektrik", emoji: "⚡🐠",
    blurb: "Yılan balığının şoku beş tetralık sürüde zincirlenir: tüm tank frenzy'e girer.",
    req: { species: { eel: 1, tetra: 5 } },
    effects: [{ kind: "flag", flag: "massFrenzy" }],
  },
  {
    id: "clownHome", name: "Ev Sahibi", emoji: "🤡🪸",
    blurb: "Palyaço balığı şakayığa yerleşti: üretimi ×2.6.",
    req: { species: { clownfish: 1 }, decor: ["anemone"] },
    effects: [{ kind: "speciesMul", species: "clownfish", mul: 2.6 }],
  },
  {
    id: "sandCrew", name: "Kum Ekibi", emoji: "🥏🦀",
    blurb: "Vatoz ve yengeç birlikte kazınca her kazı iki hazine çıkarır.",
    req: { species: { stingray: 1, crab: 1 } },
    effects: [{ kind: "flag", flag: "doubleDig" }],
  },
  {
    id: "bubbleChoir", name: "Baloncuk Korosu", emoji: "🎐🫧",
    blurb: "İki denizanası bütün baloncukları para taşıyıcısına çevirir.",
    req: { species: { jellyfish: 2 } },
    effects: [{ kind: "flag", flag: "bubbleBoost" }],
  },
  {
    id: "koiPair", name: "Koi Çifti", emoji: "🎏🎏",
    blurb: "İki koi birbirinin uğurunu besler: koi üretimi ×1.9.",
    req: { species: { koi: 2 } },
    effects: [{ kind: "speciesMul", species: "koi", mul: 1.9 }],
  },
  {
    id: "calmWater", name: "Berrak Su", emoji: "👼🐌",
    blurb: "İki salyangozun temiz tuttuğu suda melek balığı ×2.4 üretir.",
    req: { species: { angelfish: 1, snail: 2 } },
    effects: [{ kind: "speciesMul", species: "angelfish", mul: 2.4 }, { kind: "flag", flag: "calmWater" }],
  },
  {
    id: "classicSchool", name: "Klasik Sürü", emoji: "🐟🐟",
    blurb: "Dört Japon balığı eski usul düzeni kurar: tüm tank +%15.",
    req: { species: { goldfish: 4 } },
    effects: [{ kind: "globalMul", mul: 1.15 }],
  },
  {
    id: "deepHunters", name: "Derin Su Avcıları", emoji: "🦈🏮",
    blurb: "Fener balığı sürüyü toplar, köpekbalığı işi bitirir: tüm tank ×1.6.",
    req: { species: { shark: 1, anglerfish: 1 } },
    effects: [{ kind: "globalMul", mul: 1.6 }],
  },
  {
    id: "treasureHunter", name: "Hazine Avcısı", emoji: "🐙💎",
    blurb: "Ahtapot sandığın başına yerleşti: toplanan her şey ×2.2.",
    req: { species: { octopus: 1 }, decor: ["chest"] },
    effects: [{ kind: "coinValue", mul: 2.2 }],
  },
];

/**
 * Reputation banked by selling the current tank.
 *
 * This follows the genre's standard shape — a root of the run's earnings feeding a
 * *linear* permanent multiplier — for a specific reason. Stacking a sub-linear
 * exponent on top of a sub-linear multiplier (the previous `^0.33` into `rep^0.7`)
 * made the multiplier compound faster than the tank ladder could absorb, so every
 * run came out shorter than the last and the whole game collapsed in twenty
 * minutes. With a linear multiplier, doubling it costs roughly six times the
 * earnings, which is the self-limiting property the design needs.
 *
 * REP_ANCHOR is the first tank's bar: clearing it exactly is worth 3 reputation.
 */
const REP_ANCHOR = 25000;
const REP_SCALE = 3;
// Chosen against TANK_RATIO: 200^0.35 ≈ 6.5, so the permanent multiplier grows a
// little slower than the bar it has to clear (×16 species, ×1.5 cap, ×6.5 here is
// ~156 against a ×200 bar). That margin is what makes each tank take slightly
// longer than the last instead of slightly less.
const REP_EXPONENT = 0.35;
const REP_VALUE = 0.12;

export function reputationFor(runCoins: number): number {
  if (runCoins < REP_ANCHOR * 0.1) return 0;
  return Math.floor(REP_SCALE * Math.pow(runCoins / REP_ANCHOR, REP_EXPONENT));
}

/** Permanent multiplier the banked reputation buys. */
export function reputationMultiplier(reputation: number): number {
  return 1 + Math.max(0, reputation) * REP_VALUE;
}

/** Species unlocked purely by reputation, independent of the current tank. */
export const REPUTATION_UNLOCKS: { rep: number; species: SpeciesId }[] = [
  { rep: 30, species: "snail" },
  { rep: 90, species: "shrimp" },
  { rep: 260, species: "clownfish" },
  { rep: 700, species: "angelfish" },
];
