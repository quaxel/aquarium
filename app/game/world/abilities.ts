import { SPECIES } from "../content/species";
import { fishValue } from "../economy";
import type { PropKey } from "../sprites";
import type { SpeciesId } from "../types";
import { rand, type FishEntity } from "./entities";
import type { World } from "./index";

export const DIG_REWARD_BITES = 10;

// Species abilities. Split into the always-on pass (cleaner, lure, passive income)
// and the timed triggers (shock, dig, predator, bubbler). These read and mutate the
// world through its public surface only; `import type` keeps this module free of a
// runtime cycle with ./index.

export function runAbilities(w: World, f: FishEntity, def: (typeof SPECIES)[SpeciesId], dt: number) {
  for (const ability of def.abilities) {
    switch (ability.kind) {
      case "cleaner":
        w.game.state.dirt = Math.max(0, w.game.state.dirt - ability.rate * dt);
        break;
      case "lure": {
        // Pull loose food toward the lantern; this is what makes the anglerfish
        // visibly change the flow of the tank rather than just earning more.
        for (const p of w.pellets) {
          if (p.settled > 0) continue;
          const dx = f.x - p.x, dy = f.y - p.y;
          const distance = Math.hypot(dx, dy);
          if (distance > ability.radius || distance < 0.05) continue;
          const pull = (1 - distance / ability.radius) * ability.force * dt;
          p.vx += (dx / distance) * pull;
          p.vy += (dy / distance) * pull;
        }
        break;
      }
      case "passive": {
        f.passiveAccum += ability.perSecond * w.game.derived.valueMul
          * (w.game.derived.speciesMul[f.species] ?? 1)
          * (w.game.derived.schoolMul[f.species] ?? 1) * f.bonus * dt
          * (w.frenzyActive ? 3 : 1);
        const threshold = ability.perSecond * w.game.derived.valueMul * 1.6;
        if (f.passiveAccum > threshold) {
          w.spawnPickup(f.x, f.y - 0.2, f.passiveAccum, "coin");
          f.passiveAccum = 0;
        }
        break;
      }
      default:
        break;
    }
  }

  if (w.elapsed < f.nextAbility) return;

  for (const ability of def.abilities) {
    switch (ability.kind) {
      case "shock": {
        f.nextAbility = w.elapsed + ability.interval;
        const mass = w.game.derived.flags.has("massFrenzy");
        const radius = mass ? 99 : ability.radius;
        let hit = 0;
        for (const other of w.fish) {
          if (other === f || other.dying > 0) continue;
          if (Math.hypot(other.x - f.x, other.y - f.y) > radius) continue;
          other.boostUntil = w.elapsed + ability.duration;
          other.boostMul = Math.max(other.boostMul, ability.mul);
          other.thrust = 1.4;
          hit++;
        }
        w.shocks.push({ x: f.x, y: f.y, r: 0.3, life: 0.5 });
        w.burst(f.x, f.y, 20, [0.8, 1, 0.4], 0.18);
        if (mass && hit > 0) w.combo += 6;
        break;
      }
      case "dig": {
        f.nextAbility = w.elapsed + ability.interval * rand(0.8, 1.2);
        const digs = w.game.derived.flags.has("doubleDig") ? 2 : 1;
        for (let i = 0; i < digs; i++) {
          if (Math.random() > ability.luck * 0.85) continue;
          w.game.state.stats.digs++;
          const value = fishValue(w.game, f.species, f.xp, f.bonus) * DIG_REWARD_BITES * w.liveMultiplier;
          const kind: PropKey = Math.random() < 0.28 ? "chest" : Math.random() < 0.5 ? "pearl" : "gem";
          const pickup = w.spawnPickup(f.x + rand(-0.4, 0.4), w.bounds.bottom - 0.2, value * (kind === "chest" ? 3 : 1), kind);
          pickup.vy = 1.4;
          w.burst(pickup.x, pickup.y, 12, [0.85, 0.7, 0.4], 0.12);
        }
        break;
      }
      case "predator": {
        f.nextAbility = w.elapsed + ability.interval;
        if (!w.game.state.sharkDiet) break;
        const candidates = w.fish.filter((other) =>
          other !== f && other.dying === 0 && SPECIES[other.species].prey && other.size < f.size * 0.6);
        if (!candidates.length) break;
        f.prey = candidates[Math.floor(Math.random() * candidates.length)];
        break;
      }
      case "bubbler": {
        f.nextAbility = w.elapsed + 1 / ability.rate;
        const value = ability.value * w.game.derived.valueMul * f.bonus * w.liveMultiplier;
        w.bubbles.push({
          x: f.x, y: f.y, z: 2.1,
          speed: rand(0.7, 1.2), drift: rand(0, 6.28), scale: 1.3,
          carry: value,
        });
        break;
      }
      default:
        break;
    }
  }
  if (w.elapsed >= f.nextAbility) f.nextAbility = w.elapsed + 3;
}
