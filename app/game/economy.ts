import {
  DECOR, SPECIES, SPECIES_ORDER, STAGES, SYNERGIES, TANKS,
  reputationMultiplier, schoolMultiplier, stageFor,
} from "./content";
import type {
  Derived, GameState, SpeciesId, SynergyFlag, UpgradeId,
} from "./types";

// The economy math: everything the simulation and the UI are allowed to read about
// prices and production. Pure functions over state — the Game class owns the state
// and calls into these whenever anything is bought, sold, eaten or unlocked, never
// inside the frame loop.

export function lvl(state: GameState, id: UpgradeId): number {
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
 * The yardstick premium food prices are quoted against: the average current value
 * of one bite in the tank. Growth, permanent fish bonuses, breeding and species
 * synergies all count. Using the average keeps food affordable in a mixed roster;
 * using the strongest fish made every bite eaten by a weaker fish a guaranteed loss.
 */
export function pelletBaseline(
  state: GameState,
  speciesMul: Partial<Record<SpeciesId, number>> = {},
): number {
  if (!state.fish.length) return 3;
  let total = 0;
  for (const fish of state.fish) {
    total += SPECIES[fish.species].baseValue
      * STAGES[stageFor(fish.xp)].mul
      * fish.bonus
      * schoolMultiplier(state.schoolLevels[fish.species] ?? 0)
      * (speciesMul[fish.species] ?? 1);
  }
  return Math.max(3, total / state.fish.length);
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

/** Coins a single pellet is worth to a given fish, before combo and frenzy. */
export function fishValue(
  game: import("./game").Game,
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
