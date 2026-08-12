import {
  DECOR, FOODS, REPUTATION_UNLOCKS, SPECIES, SPECIES_ORDER, STAGES, SYNERGIES, TANKS,
  UPGRADES, reputationFor, reputationMultiplier, schoolCost, schoolMultiplier,
  speciesCost, stageFor, tankBar, upgradeCost,
} from "./content";
import type {
  Derived, DecorId, FishSave, FoodId, GameState, SpeciesId, SynergyFlag, UpgradeId,
} from "./types";

const SAVE_KEY = "fish-tank-empire/v2";
// Bumped with the economy rewrite: every price and value on the ladder moved, so a
// v1 save would load a tank whose fish cost a tenth of what they now produce.
const SAVE_VERSION = 2;

/**
 * Turns one round of tank output into an upgrade-pricing anchor. Set so a fresh bowl
 * (a single stage-zero goldfish) prices the cheapest upgrade at a couple of hundred
 * coins — about a minute of hand-feeding.
 */
const OUTPUT_TO_ANCHOR = 8000;

/**
 * Generous on purpose, but still under 1 so buy-then-sell can never be an income
 * loop: selling the Nth fish refunds 0.7× the (N−1)th price while the next one costs
 * 1.12× it, so a round trip always loses money.
 *
 * It has to be generous because trading the roster up is the main way income keeps
 * pace with the tank ladder. At 0.4 the mid-game could not afford to modernise, ran
 * on first-minute goldfish, and then jumped several hundred× the moment reputation
 * made the top species affordable — which is what collapsed the last three tanks.
 */
const SELL_REFUND = 0.7;

export type LogEntry = {
  id: number;
  kind: "unlock" | "synergy" | "milestone" | "warn" | "reward";
  title: string;
  body?: string;
  at: number;
};

export function createInitialState(): GameState {
  return {
    version: SAVE_VERSION,
    coins: 0,
    runCoins: 0,
    allTimeCoins: 0,
    reputation: 0,
    allTimeReputation: 0,
    tankIndex: 0,
    fish: [{ species: "goldfish", xp: 0, stage: 0, bonus: 1, variant: false }],
    schoolLevels: {},
    upgrades: {},
    decor: [],
    foodId: "flake",
    unlockedFoods: ["flake"],
    unlockedSpecies: ["goldfish"],
    seenSynergies: [],
    dirt: 0,
    sharkDiet: true,
    autoFeedOn: true,
    stats: {
      pelletsDropped: 0, pelletsEaten: 0, coinsCollected: 0, frenzies: 0,
      bestCombo: 0, popCount: 0, devoured: 0, digs: 0, mutations: 0, playTime: 0,
    },
    cpsEstimate: 0,
    lastSeen: Date.now(),
    runStart: Date.now(),
  };
}

function lvl(state: GameState, id: UpgradeId): number {
  return state.upgrades[id] ?? 0;
}

/**
 * Everything the simulation and the UI are allowed to read. Recomputed whenever
 * anything is bought, sold, eaten or unlocked — never inside the frame loop.
 */
export function computeDerived(
  state: GameState,
  fishCounts: Partial<Record<SpeciesId, number>>,
): Derived {
  const tank = TANKS[Math.min(state.tankIndex, TANKS.length - 1)];
  const speciesMul: Partial<Record<SpeciesId, number>> = {};
  const flags = new Set<SynergyFlag>();
  const activeSynergies: string[] = [];
  let globalMul = reputationMultiplier(state.reputation);
  let coinValueMul = 1;

  for (const id of state.decor) {
    const effect = DECOR[id].effect;
    if (effect.kind === "globalMul") globalMul *= effect.mul;
    if (effect.kind === "coinValue") coinValueMul *= effect.mul;
    if (effect.kind === "speciesMul") speciesMul[effect.species] = (speciesMul[effect.species] ?? 1) * effect.mul;
  }

  for (const synergy of SYNERGIES) {
    const speciesOk = Object.entries(synergy.req.species ?? {})
      .every(([id, need]) => (fishCounts[id as SpeciesId] ?? 0) >= (need ?? 0));
    const decorOk = (synergy.req.decor ?? []).every((d) => state.decor.includes(d));
    if (!speciesOk || !decorOk) continue;
    activeSynergies.push(synergy.id);
    for (const effect of synergy.effects) {
      if (effect.kind === "globalMul") globalMul *= effect.mul;
      else if (effect.kind === "coinValue") coinValueMul *= effect.mul;
      else if (effect.kind === "speciesMul") speciesMul[effect.species] = (speciesMul[effect.species] ?? 1) * effect.mul;
      else flags.add(effect.flag);
    }
  }

  const schoolMul: Partial<Record<SpeciesId, number>> = {};
  for (const id of SPECIES_ORDER) {
    const level = state.schoolLevels[id] ?? 0;
    if (level > 0) schoolMul[id] = schoolMultiplier(level);
  }

  const filterLevel = lvl(state, "filter");
  const breedLevel = lvl(state, "breeding");
  const bubbleLevel = lvl(state, "bubbleCollector");
  const offlineLevel = lvl(state, "offlineBucket");
  // Muck is the tax on careless feeding: it never stops production outright, but at
  // full strength it takes more than half of it.
  const dirtPenalty = state.dirt * 0.45 * (flags.has("calmWater") ? 0.55 : 1);

  return {
    fishCap: tank.fishCap,
    feedCount: 1 + lvl(state, "doubleFeed") + lvl(state, "scatterFeed") * 2,
    feedInterval: 0.15 * Math.pow(0.87, lvl(state, "feedSpeed")),
    sinkRate: 0.62 * Math.pow(0.84, lvl(state, "sinkSlow")),
    senseMul: 1 + lvl(state, "hungryFish") * 0.18,
    chewMul: Math.pow(0.88, lvl(state, "wideMouth")) * Math.pow(0.93, lvl(state, "heater")),
    growthMul: (1 + lvl(state, "growthHormone") * 0.3) * (1 + lvl(state, "heater") * 0.2),
    valueMul: globalMul * (1 - dirtPenalty),
    coinValueMul,
    goldChance: lvl(state, "goldenPoop") * 0.03,
    autoCollect: Math.max(1.2, 5 - lvl(state, "glassPolish") * 1),
    magnetRadius: lvl(state, "coinMagnet") > 0 ? 0.7 + lvl(state, "coinMagnet") * 0.55 : 0,
    freshBonus: lvl(state, "freshCatch") * 0.18,
    autoFeedRate: lvl(state, "autoFeeder") > 0 ? 0.55 * Math.pow(1.2, lvl(state, "feederRate")) : 0,
    autoFeedCount: lvl(state, "autoFeeder") > 0 ? 1 + lvl(state, "feederSpread") : 0,
    autoFeedSmart: lvl(state, "smartFeeder") > 0,
    filterRate: filterLevel * 0.012,
    metabolism: 1 + lvl(state, "metabolism") * 0.13,
    bubbleValue: bubbleLevel * 1.4 * (flags.has("bubbleBoost") ? 2.5 : 1),
    bubbleDensity: 1 + lvl(state, "airStone") * 0.5,
    breedRate: breedLevel > 0 ? breedLevel / 150 : 0,
    comboGrace: 1.9 + lvl(state, "comboGrace") * 0.32,
    comboRamp: 1 + lvl(state, "comboRamp") * 0.2,
    frenzyLength: 20 + lvl(state, "frenzyLength") * 5,
    frenzyPower: 6 * (1 + lvl(state, "frenzyPower") * 0.35),
    offlineHours: 2 + offlineLevel * 2,
    offlineEfficiency: 0.4 + offlineLevel * 0.08,
    reputationMul: reputationMultiplier(state.reputation),
    dirtPenalty,
    speciesMul,
    schoolMul,
    flags,
    activeSynergies,
    halfWidth: tank.halfWidth,
  };
}

/**
 * The yardstick premium food prices are quoted against: the raw output of the best
 * fish in the tank. Tying prices to this keeps a worm meaningful in the space
 * aquarium instead of rounding to free.
 */
export function pelletBaseline(state: GameState, fishCounts: Partial<Record<SpeciesId, number>>): number {
  let best = 3;
  for (const id of SPECIES_ORDER) {
    if ((fishCounts[id] ?? 0) === 0) continue;
    // The breeding level counts: without it, food prices stop tracking income the
    // moment the player starts levelling and every premium pellet rounds to free.
    best = Math.max(best, SPECIES[id].baseValue * schoolMultiplier(state.schoolLevels[id] ?? 0));
  }
  return best;
}

/**
 * What the whole tank yields from one round of bites — every fish counted, at its
 * current growth stage and breeding level. This is the anchor upgrades are priced
 * against, and it has to be the *whole* tank rather than the best fish in it: a run
 * always opens with one goldfish, so a best-fish anchor leaves the entire upgrade
 * board costing a few hundred coins until the roster improves, and it gets maxed out
 * long before that happens. Summing the tank makes the price climb continuously as
 * you buy fish, level them and let them grow.
 */
export function tankOutput(state: GameState): number {
  let total = 0;
  for (const f of state.fish) {
    total += SPECIES[f.species].baseValue
      * STAGES[stageFor(f.xp)].mul
      * schoolMultiplier(state.schoolLevels[f.species] ?? 0);
  }
  return Math.max(3, total);
}

export type Snapshot = {
  version: number;
  state: GameState;
  derived: Derived;
  fishCounts: Partial<Record<SpeciesId, number>>;
  log: LogEntry[];
  live: LiveStats;
};

/** Read-only frame data the HUD needs but that never belongs in the save file. */
export type LiveStats = {
  combo: number;
  comboMul: number;
  comboProgress: number;
  frenzy: number;
  frenzyLeft: number;
  /** Seconds until the next frenzy can trigger; 0 when it is armed. */
  frenzyCooldown: number;
  cps: number;
  pellets: number;
  pickups: number;
  fishAlive: number;
  shockActive: boolean;
};

export class Game {
  state: GameState;
  derived: Derived;
  fishCounts: Partial<Record<SpeciesId, number>> = {};
  log: LogEntry[] = [];
  live: LiveStats = {
    combo: 0, comboMul: 1, comboProgress: 0, frenzy: 0, frenzyLeft: 0, frenzyCooldown: 0,
    cps: 0, pellets: 0, pickups: 0, fishAlive: 0, shockActive: false,
  };
  /** Species the world has been told to add but has not spawned yet. */
  pendingSpawns: SpeciesId[] = [];
  /** Species the world has been told to remove but has not yet. */
  pendingRemovals: SpeciesId[] = [];
  /** Set by the world after a tank move so it can rebuild from scratch. */
  rebuildRequested = false;
  offlineReport: { seconds: number; coins: number } | null = null;

  private listeners = new Set<() => void>();
  private version = 0;
  private logId = 0;
  /** Coalesces the many small mutations a frame makes into one React update. */
  private dirtyFlush = false;

  constructor(state?: GameState) {
    this.state = state ?? createInitialState();
    this.fishCounts = countFish(this.state.fish);
    this.derived = computeDerived(this.state, this.fishCounts);
  }

  // ── Store plumbing ─────────────────────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getSnapshot = () => this.version;

  /** Marks the UI stale; the actual notify happens once per animation frame. */
  touch() {
    this.dirtyFlush = true;
  }

  /** Called by the render loop at a fixed cadence so React re-renders ~12×/s. */
  flush() {
    if (!this.dirtyFlush) return;
    this.dirtyFlush = false;
    // Toasts expire here rather than in the component, so rendering stays pure.
    const cutoff = Date.now() - 7000;
    if (this.log.length && this.log[this.log.length - 1].at < cutoff) {
      this.log = this.log.filter((entry) => entry.at >= cutoff);
    }
    this.version++;
    for (const fn of this.listeners) fn();
  }

  toggleAutoFeed() {
    this.state.autoFeedOn = !this.state.autoFeedOn;
    this.touch();
  }

  toggleSharkDiet() {
    this.state.sharkDiet = !this.state.sharkDiet;
    this.touch();
  }

  recompute() {
    this.derived = computeDerived(this.state, this.fishCounts);
    this.touch();
  }

  notice(kind: LogEntry["kind"], title: string, body?: string) {
    this.log = [{ id: ++this.logId, kind, title, body, at: Date.now() }, ...this.log].slice(0, 40);
    this.touch();
  }

  // ── Economy ────────────────────────────────────────────────────────────────
  earn(amount: number) {
    if (!(amount > 0)) return;
    this.state.coins += amount;
    this.state.runCoins += amount;
    this.state.allTimeCoins += amount;
    this.state.stats.coinsCollected += amount;
    this.touch();
  }

  spend(amount: number): boolean {
    if (this.state.coins < amount) return false;
    this.state.coins -= amount;
    this.touch();
    return true;
  }

  /** Coin price of a single pellet of the active food. */
  foodCost(id: FoodId = this.state.foodId): number {
    const food = FOODS[id];
    if (food.cost <= 0) return 0;
    return food.cost * pelletBaseline(this.state, this.fishCounts) * this.derived.valueMul;
  }

  // ── Purchases ──────────────────────────────────────────────────────────────
  fishCost(id: SpeciesId): number {
    return speciesCost(id, this.fishCounts[id] ?? 0);
  }

  canBuyFish(id: SpeciesId): boolean {
    if (!this.state.unlockedSpecies.includes(id)) return false;
    if (this.totalFish() >= this.derived.fishCap) return false;
    return this.state.coins >= this.fishCost(id);
  }

  totalFish(): number {
    return this.pendingSpawns.length + Object.values(this.fishCounts).reduce((a, b) => a + (b ?? 0), 0);
  }

  /** Refunds do not count toward the run — selling must not inflate the prestige bar. */
  private refund(amount: number) {
    if (!(amount > 0)) return;
    this.state.coins += amount;
    this.touch();
  }

  buyFish(id: SpeciesId): boolean {
    if (!this.canBuyFish(id)) return false;
    if (!this.spend(this.fishCost(id))) return false;
    this.pendingSpawns.push(id);
    this.touch();
    return true;
  }

  /** Refund for selling one back — deliberately under the marginal buy price. */
  sellRefund(id: SpeciesId): number {
    const owned = this.fishCounts[id] ?? 0;
    if (owned <= 0) return 0;
    return Math.floor(speciesCost(id, owned - 1) * SELL_REFUND);
  }

  /**
   * Sells one fish and frees its slot.
   *
   * Without this the tank is a trap: the slots fill with whatever was affordable in
   * the first minute of a run, and since nothing can leave, the roster you happened
   * to start with is the roster you finish with. Measured, that alone stalled a run
   * at 15 goldfish in a tank where two far better species were already unlocked, and
   * pushed 90% of all spending into levelling those goldfish. It also makes the
   * design's central question — which fish do I put together — actually answerable,
   * because you can change your mind.
   */
  sellFish(id: SpeciesId): boolean {
    const owned = this.fishCounts[id] ?? 0;
    if (owned <= 0) return false;
    const refund = this.sellRefund(id);
    this.pendingRemovals.push(id);
    // Counted straight away so a double click cannot sell the same fish twice.
    this.fishCounts[id] = owned - 1;
    this.refund(refund);
    this.recompute();
    return true;
  }

  schoolLevel(id: SpeciesId): number {
    return this.state.schoolLevels[id] ?? 0;
  }

  schoolCost(id: SpeciesId): number {
    return schoolCost(id, this.schoolLevel(id));
  }

  /**
   * The breeding programme. Unlike buying a fish this has no ceiling, which is the
   * whole point: it is the purchase the player can always make, and the one whose
   * price outruns its payoff a little more every time.
   */
  buySchoolLevel(id: SpeciesId): boolean {
    if (!this.state.unlockedSpecies.includes(id)) return false;
    if (!this.spend(this.schoolCost(id))) return false;
    this.state.schoolLevels[id] = this.schoolLevel(id) + 1;
    this.recompute();
    return true;
  }

  /**
   * The anchor upgrade prices scale with.
   *
   * The tank's bar is the right yardstick for a run as a whole, but on its own it
   * jumps 200× the moment you move tanks — and you arrive with no coins and one
   * goldfish, so the whole board is out of reach for the first minutes. Following the
   * tank's own output instead fixes the opening but never catches up later, and the
   * board gets maxed out before the roster improves.
   *
   * Taking the lower of the two gives each one the half of the run it is right for:
   * output while you are restocking, the bar once you have.
   */
  upgradeAnchor(): number {
    return Math.min(tankOutput(this.state) * OUTPUT_TO_ANCHOR, tankBar(this.state.tankIndex));
  }

  upgradeCost(id: UpgradeId): number {
    return upgradeCost(id, this.state.upgrades[id] ?? 0, this.upgradeAnchor());
  }

  buyUpgrade(id: UpgradeId): boolean {
    const upgrade = UPGRADES[id];
    const level = lvl(this.state, id);
    if (level >= upgrade.maxLevel) return false;
    if (!this.upgradeAvailable(id)) return false;
    const cost = this.upgradeCost(id);
    if (!this.spend(cost)) return false;
    this.state.upgrades[id] = level + 1;
    if (level === 0) this.notice("unlock", `${upgrade.emoji} ${upgrade.name}`, upgrade.blurb);
    this.recompute();
    return true;
  }

  upgradeAvailable(id: UpgradeId): boolean {
    const requires = UPGRADES[id].requires;
    if (!requires) return true;
    if (requires.upgrade && lvl(this.state, requires.upgrade[0]) < requires.upgrade[1]) return false;
    if (requires.species && (this.fishCounts[requires.species] ?? 0) < 1) return false;
    return true;
  }

  buyFood(id: FoodId): boolean {
    if (this.state.unlockedFoods.includes(id)) { this.selectFood(id); return true; }
    const food = FOODS[id];
    if (!this.spend(food.unlockCost)) return false;
    this.state.unlockedFoods.push(id);
    this.state.foodId = id;
    this.notice("unlock", `${food.emoji} ${food.name} açıldı`, food.blurb);
    this.recompute();
    return true;
  }

  selectFood(id: FoodId) {
    if (!this.state.unlockedFoods.includes(id)) return;
    this.state.foodId = id;
    this.touch();
  }

  buyDecor(id: DecorId): boolean {
    if (this.state.decor.includes(id)) return false;
    const decor = DECOR[id];
    if (!this.spend(decor.cost)) return false;
    this.state.decor.push(id);
    this.notice("unlock", `${decor.emoji} ${decor.name}`, decor.blurb);
    this.recompute();
    this.checkSynergies();
    return true;
  }

  // ── Progression ────────────────────────────────────────────────────────────
  canMoveTank(): boolean {
    const tank = TANKS[this.state.tankIndex];
    return this.state.tankIndex < TANKS.length - 1 && this.state.runCoins >= tank.moveRequirement;
  }

  moveTankReward(): number {
    return reputationFor(this.state.runCoins);
  }

  /**
   * Prestige, themed. The tank is sold, the run resets, and the reputation earned
   * is permanent — every future run starts faster and with more species available.
   */
  moveTank(): boolean {
    if (!this.canMoveTank()) return false;
    const gained = this.moveTankReward();
    const next = this.state.tankIndex + 1;
    const tank = TANKS[next];
    const keptSpecies = new Set<SpeciesId>(this.state.unlockedSpecies);
    keptSpecies.add("goldfish");
    for (const id of SPECIES_ORDER) if (SPECIES[id].tier <= next) keptSpecies.add(id);

    const carried = {
      reputation: this.state.reputation + gained,
      allTimeReputation: this.state.allTimeReputation + gained,
      allTimeCoins: this.state.allTimeCoins,
      unlockedFoods: this.state.unlockedFoods,
      seenSynergies: this.state.seenSynergies,
      stats: this.state.stats,
    };

    this.state = {
      ...createInitialState(),
      ...carried,
      tankIndex: next,
      unlockedSpecies: [...keptSpecies],
      foodId: this.state.unlockedFoods.includes(this.state.foodId) ? this.state.foodId : "flake",
      runStart: Date.now(),
    };
    this.fishCounts = {};
    this.pendingSpawns = [];
    this.pendingRemovals = [];
    this.rebuildRequested = true;
    this.applyReputationUnlocks();
    this.recompute();
    this.notice(
      "milestone",
      `${tank.emoji} ${tank.name}`,
      `+${gained} ün kazandın. Yeni tank ${tank.fishCap} balık alıyor. ${tank.blurb}`,
    );
    return true;
  }

  applyReputationUnlocks() {
    let changed = false;
    for (const unlock of REPUTATION_UNLOCKS) {
      if (this.state.reputation >= unlock.rep && !this.state.unlockedSpecies.includes(unlock.species)) {
        this.state.unlockedSpecies.push(unlock.species);
        changed = true;
      }
    }
    for (const id of SPECIES_ORDER) {
      if (SPECIES[id].tier <= this.state.tankIndex && !this.state.unlockedSpecies.includes(id)) {
        this.state.unlockedSpecies.push(id);
        changed = true;
      }
    }
    if (changed) this.recompute();
  }

  /** Surfaces a synergy the first time its pieces are in the same tank. */
  checkSynergies() {
    for (const id of this.derived.activeSynergies) {
      if (this.state.seenSynergies.includes(id)) continue;
      this.state.seenSynergies.push(id);
      const synergy = SYNERGIES.find((s) => s.id === id)!;
      this.notice("synergy", `${synergy.emoji} ${synergy.name}`, synergy.blurb);
    }
  }

  /** Called by the world whenever a fish is added, removed or grown. */
  syncFish(fish: FishSave[]) {
    this.state.fish = fish;
    this.fishCounts = countFish(fish);
    this.recompute();
    this.applyReputationUnlocks();
    this.checkSynergies();
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  save() {
    if (typeof localStorage === "undefined") return;
    this.state.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      // A full quota is not worth interrupting play over.
    }
  }

  static load(): Game {
    if (typeof localStorage === "undefined") return new Game();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return new Game();
      const parsed = JSON.parse(raw) as GameState;
      if (parsed.version !== SAVE_VERSION) return new Game();
      const merged: GameState = { ...createInitialState(), ...parsed };
      merged.stats = { ...createInitialState().stats, ...parsed.stats };
      const game = new Game(merged);
      game.grantOffline();
      return game;
    } catch {
      return new Game();
    }
  }

  /** Pays out a fraction of the recent earning rate for the time the tab was shut. */
  grantOffline() {
    const seconds = Math.max(0, (Date.now() - this.state.lastSeen) / 1000);
    this.grantIdle(seconds);
  }

  /**
   * The same payout for time the tab spent open but frozen. Browsers suspend
   * requestAnimationFrame in background tabs, so without this a player who leaves
   * the page open in another window earns nothing at all — the worst of both worlds.
   */
  grantIdle(seconds: number) {
    if (seconds < 60 || this.state.cpsEstimate <= 0) return;
    const capped = Math.min(seconds, this.derived.offlineHours * 3600);
    const coins = capped * this.state.cpsEstimate * this.derived.offlineEfficiency;
    this.state.lastSeen = Date.now();
    if (coins < 1) return;
    this.earn(coins);
    this.offlineReport = { seconds: capped, coins };
    this.touch();
  }

  reset() {
    if (typeof localStorage !== "undefined") localStorage.removeItem(SAVE_KEY);
    this.state = createInitialState();
    // Counted from the starting roster, not emptied: the cap check runs before the
    // world has had a frame to spawn anything.
    this.fishCounts = countFish(this.state.fish);
    this.pendingSpawns = [];
    this.pendingRemovals = [];
    this.rebuildRequested = true;
    this.log = [];
    this.offlineReport = null;
    this.live = {
      combo: 0, comboMul: 1, comboProgress: 0, frenzy: 0, frenzyLeft: 0, frenzyCooldown: 0,
      cps: 0, pellets: 0, pickups: 0, fishAlive: 0, shockActive: false,
    };
    this.recompute();
  }
}

function countFish(fish: FishSave[]): Partial<Record<SpeciesId, number>> {
  const counts: Partial<Record<SpeciesId, number>> = {};
  for (const f of fish) counts[f.species] = (counts[f.species] ?? 0) + 1;
  return counts;
}

/** Coins a single pellet is worth to a given fish, before combo and frenzy. */
export function fishValue(
  game: Game,
  species: SpeciesId,
  xp: number,
  bonus: number,
  extra = 1,
): number {
  const def = SPECIES[species];
  const stage = STAGES[stageFor(xp)];
  const synergy = game.derived.speciesMul[species] ?? 1;
  const school = game.derived.schoolMul[species] ?? 1;
  return def.baseValue * stage.mul * bonus * synergy * school * game.derived.valueMul * extra;
}
