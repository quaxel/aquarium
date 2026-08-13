// Shared vocabulary for the whole game. Content files declare data against these
// shapes, the simulation reads them, and the UI renders them — nothing here knows
// about Three.js or React.

export type SpeciesId =
  | "goldfish" | "tetra" | "snail" | "shrimp" | "clownfish"
  | "angelfish" | "pufferfish" | "crab" | "stingray" | "eel"
  | "jellyfish" | "octopus" | "anglerfish" | "shark" | "koi";

export type FoodId =
  | "flake" | "shrimpPellet" | "worm" | "starFood"
  | "rainbow" | "explosive" | "mutant" | "krill";

export type DecorId =
  | "anemone" | "coral" | "wreck" | "helmet" | "amphora" | "chest";

export type UpgradeId =
  | "doubleFeed" | "scatterFeed" | "feedSpeed" | "sinkSlow"
  | "hungryFish" | "wideMouth" | "metabolism" | "growthHormone"
  | "goldenPoop" | "bubbleCollector" | "coinMagnet" | "freshCatch"
  | "autoFeeder" | "feederRate" | "feederSpread" | "smartFeeder"
  | "filter" | "heater" | "airStone" | "breeding"
  | "comboGrace" | "comboRamp" | "frenzyLength" | "frenzyPower"
  | "glassPolish";

/** What a fish does beyond turning food into coins. */
export type Ability =
  /** Picks pickups up off the water instead of waiting for the auto-collect timer. */
  | { kind: "collector"; radius: number; capacity: number; speed: number }
  /** Eats the muck that uneaten food leaves behind. */
  | { kind: "cleaner"; rate: number }
  /** Swells while eating, then bursts and showers everything it banked. */
  | { kind: "inflate"; bites: number; popMul: number }
  /** Roots through the sand and turns up buried pickups. */
  | { kind: "dig"; interval: number; luck: number }
  /** Periodic AoE production buff. */
  | { kind: "shock"; interval: number; radius: number; mul: number; duration: number }
  /** Gains a stacking bonus for every same-species neighbour. */
  | { kind: "school"; radius: number; per: number; max: number }
  /** Drags loose pellets toward itself. */
  | { kind: "lure"; radius: number; force: number }
  /** Hunts smaller fish, converting them into permanent value. */
  | { kind: "predator"; interval: number; gain: number }
  /** Earns without eating. */
  | { kind: "passive"; perSecond: number }
  /** Turns rising bubbles into coins. */
  | { kind: "bubbler"; rate: number; value: number };

export type FishShape =
  | "fish" | "round" | "eel" | "ray" | "jelly"
  | "octopus" | "crab" | "shrimp" | "snail" | "shark";

export type FishArt = {
  shape: FishShape;
  /** shadow, body, highlight — in that order. */
  palette: [string, string, string];
  accent: string;
  pattern?: "none" | "stripes" | "spots" | "bands" | "neon" | "koi";
  tail?: "fan" | "fork" | "point" | "veil" | "crescent";
  glow?: string;
};

export type Species = {
  id: SpeciesId;
  name: string;
  emoji: string;
  /** Lowest tank index where the species shows up in the shop. */
  tier: number;
  baseCost: number;
  costGrowth: number;
  /** Coins produced by a single pellet, before every multiplier. */
  baseValue: number;
  /** Seconds spent chewing one pellet. */
  chew: number;
  senseRadius: number;
  swimSpeed: number;
  /** Adult body length in world units. */
  length: number;
  /** Renderer-only multiplier for silhouettes that read smaller than their body length. */
  visualScale?: number;
  /** 0 hugs the sand, 1 hangs at the surface. */
  depthBias: number;
  floorDweller?: boolean;
  /** Small fish can be eaten by predators. */
  prey?: boolean;
  abilities: Ability[];
  blurb: string;
  art: FishArt;
};

export type FoodEffect =
  | "none"
  /** Splits into two smaller pellets on the way down. */
  | "split"
  /** Detonates into a ring of free pellets when eaten. */
  | "explode"
  /** Can permanently upgrade the eater into a rare variant. */
  | "mutate"
  /** Sends the eater into a personal speed/production rush. */
  | "enrage"
  /** Always drops a high-value gold coin. */
  | "gold";

export type Food = {
  id: FoodId;
  name: string;
  emoji: string;
  /** Coins burned per pellet. Free food is the whole early game. */
  cost: number;
  unlockCost: number;
  /** Tank index at which the food appears in the shop. */
  tier: number;
  valueMul: number;
  xpMul: number;
  /** Extra combo counts granted per pellet eaten. */
  comboBonus: number;
  effect: FoodEffect;
  color: string;
  glow: string;
  blurb: string;
};

export type UpgradeCategory = "feed" | "fish" | "collect" | "auto" | "frenzy" | "tank";

export type Upgrade = {
  id: UpgradeId;
  name: string;
  emoji: string;
  category: UpgradeCategory;
  /**
   * Level-1 price as a fraction of the current tank's bar, not an absolute number.
   * Income multiplies ~200× per tank while upgrades are re-bought every run, so a
   * fixed price is a real decision in the bowl and a rounding error by the public
   * aquarium — which is exactly what happened: all 26 maxed out on 0.4% of income.
   */
  share: number;
  costGrowth: number;
  maxLevel: number;
  tier: number;
  blurb: string;
  /** Player-facing description of what the next level buys. */
  detail: (level: number) => string;
  requires?: { upgrade?: [UpgradeId, number]; species?: SpeciesId };
};

export type RGB = [number, number, number];

/**
 * The look of one environment, in the flat-vector language the painted backdrop
 * already speaks: two-stop water gradient, a floor colour, and a small set of
 * silhouette features drawn in a single ink tone.
 */
export type Scenery = {
  waterTop: RGB;
  waterBottom: RGB;
  floor: RGB;
  /** Silhouette colour for everything standing on the horizon. */
  ink: RGB;
  /** Emissive colour for lamps, vents, stars and the planet. */
  glow: RGB;
  /** height, frequency, jaggedness (0 blobs → 1 spikes), edge bias (0 even → 1 sides only). */
  ridge: [number, number, number, number];
  /** arch, stars, planet, vents — each 0..1. */
  features: [number, number, number, number];
};

export type Tank = {
  index: number;
  name: string;
  short: string;
  emoji: string;
  fishCap: number;
  /** Half-width of the swimmable water, in world units. */
  halfWidth: number;
  /** Lifetime coins needed in the current run before the move unlocks. */
  moveRequirement: number;
  /** Hue applied to the water so each tank reads as a different place. */
  tint: RGB;
  scenery: Scenery;
  /**
   * Optional painted backdrop under /public/assets. When the file is absent the
   * renderer silently keeps the shared one, so art can be dropped in one tank at a
   * time without touching code. See assets/BACKGROUND-PROMPTS.md.
   */
  background?: string;
  blurb: string;
};

export type Decor = {
  id: DecorId;
  name: string;
  emoji: string;
  cost: number;
  tier: number;
  blurb: string;
  effect: SynergyEffect;
};

export type SynergyEffect =
  | { kind: "speciesMul"; species: SpeciesId; mul: number }
  | { kind: "globalMul"; mul: number }
  | { kind: "coinValue"; mul: number }
  | { kind: "flag"; flag: SynergyFlag };

export type SynergyFlag =
  | "instantPop" | "massFrenzy" | "doubleDig" | "bubbleBoost" | "calmWater";

export type Synergy = {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  req: { species?: Partial<Record<SpeciesId, number>>; decor?: DecorId[] };
  effects: SynergyEffect[];
};

export type FishSave = {
  species: SpeciesId;
  xp: number;
  stage: number;
  /** Permanent value multiplier earned from rainbow food / devouring. */
  bonus: number;
  variant: boolean;
};

export type GameStats = {
  pelletsDropped: number;
  pelletsEaten: number;
  coinsCollected: number;
  frenzies: number;
  bestCombo: number;
  popCount: number;
  devoured: number;
  digs: number;
  mutations: number;
  playTime: number;
};

export type GameState = {
  version: number;
  coins: number;
  /** Coins earned since the last tank move — the prestige yardstick. */
  runCoins: number;
  allTimeCoins: number;
  reputation: number;
  /** Reputation banked across every run, for permanent unlock thresholds. */
  allTimeReputation: number;
  tankIndex: number;
  fish: FishSave[];
  /** Breeding-programme level per species — the run's unbounded coin sink. */
  schoolLevels: Partial<Record<SpeciesId, number>>;
  upgrades: Partial<Record<UpgradeId, number>>;
  decor: DecorId[];
  foodId: FoodId;
  unlockedFoods: FoodId[];
  unlockedSpecies: SpeciesId[];
  seenSynergies: string[];
  /** 0 clean, 1 opaque green soup. */
  dirt: number;
  sharkDiet: boolean;
  autoFeedOn: boolean;
  stats: GameStats;
  runStart: number;
};

/** Everything recomputed whenever the state changes; the sim reads only this. */
export type Derived = {
  fishCap: number;
  feedCount: number;
  feedInterval: number;
  sinkRate: number;
  senseMul: number;
  chewMul: number;
  growthMul: number;
  valueMul: number;
  coinValueMul: number;
  goldChance: number;
  autoCollect: number;
  magnetRadius: number;
  freshBonus: number;
  autoFeedRate: number;
  autoFeedCount: number;
  autoFeedSmart: boolean;
  filterRate: number;
  metabolism: number;
  bubbleValue: number;
  bubbleDensity: number;
  breedRate: number;
  comboGrace: number;
  comboRamp: number;
  frenzyLength: number;
  frenzyPower: number;
  reputationMul: number;
  dirtPenalty: number;
  /** From synergies and decor. */
  speciesMul: Partial<Record<SpeciesId, number>>;
  /** From the breeding programme, kept separate so the shop can show both. */
  schoolMul: Partial<Record<SpeciesId, number>>;
  flags: Set<SynergyFlag>;
  activeSynergies: string[];
  halfWidth: number;
};
