import { FOODS, SPECIES, STAGES, stageFor } from "./content";
import { Game, fishValue } from "./game";
import type { PropKey } from "./sprites";
import type { Ability, FishSave, FoodId, SpeciesId } from "./types";

// The live tank. Everything here is mutable, pooled and frame-rate independent;
// nothing here touches React or Three.js. The renderer reads these arrays, the HUD
// reads `game.live`, and the two never argue about who owns the truth.

let nextId = 1;
const FISH_TURN_COOLDOWN = 3;
/** Currency pickups rest on the same horizontal plane as the fish shadows. */
const PICKUP_SHADOW_LEVEL = 0.42;

export type FishEntity = {
  id: number;
  species: SpeciesId;
  xp: number;
  bonus: number;
  variant: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number;
  heading: number;
  speed: number;
  facing: number;
  nextTurnAt: number;
  beat: number;
  thrust: number;
  burstAt: number;
  phase: number;
  depth: number;
  targetDepth: number;
  targetX: number; targetY: number;
  thinkAt: number;
  searchAt: number;
  chewUntil: number;
  restUntil: number;
  pellet: Pellet | null;
  pickup: Pickup | null;
  prey: FishEntity | null;
  /** Puffer only: 0..1 toward bursting, plus the coins banked in the swelling. */
  inflate: number;
  banked: number;
  nextAbility: number;
  boostUntil: number;
  boostMul: number;
  rageUntil: number;
  passiveAccum: number;
  size: number;
  stage: number;
  flash: number;
  /** Set the frame a fish is eaten so the renderer can play the vanish. */
  dying: number;
};

export type Pellet = {
  id: number;
  food: FoodId;
  x: number; y: number; z: number;
  vx: number; vy: number;
  age: number;
  settled: number;
  /** Which fish has dibs, and until when — a lapsed claim frees the pellet again. */
  claim: number;
  claimUntil: number;
  splitAt: number;
  gone: boolean;
};

export type Pickup = {
  id: number;
  kind: PropKey;
  value: number;
  x: number; y: number; z: number;
  vx: number; vy: number;
  age: number;
  spin: number;
  claim: number;
  collected: boolean;
};

export type Particle = {
  x: number; y: number; z: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: [number, number, number];
  kind: "spark" | "dot";
  spin: number;
};

export type Bubble = {
  x: number; y: number; z: number;
  speed: number;
  drift: number;
  scale: number;
  /** Coins riding this bubble, paid out when it reaches the surface. */
  carry: number;
};

export type Popup = {
  x: number; y: number;
  text: string;
  life: number;
  color: string;
  big: boolean;
};

export type Shock = { x: number; y: number; r: number; life: number };

export type Bounds = { halfWidth: number; top: number; bottom: number };

/**
 * Active play is a bonus, not the economy. At ×16 the combo alone outweighed a full
 * tier of species and every other decision in the game rounded to noise next to
 * "click faster"; the genre keeps the active-vs-automatic gap in the low single digits.
 */
const COMBO_TIERS = [
  { at: 0, mul: 1 },
  { at: 5, mul: 1.4 },
  { at: 14, mul: 1.8 },
  { at: 30, mul: 2.4 },
  { at: 55, mul: 3.2 },
];
const FRENZY_AT = 90;
/**
 * Without this the combo bar refills during the frenzy itself and the tank simply
 * never leaves it — which turns the game's biggest moment into its baseline.
 */
const FRENZY_COOLDOWN = 25;
const CURSOR_MAGNET_SPEED = 7;

export function comboMultiplier(combo: number): number {
  let mul = 1;
  for (const tier of COMBO_TIERS) if (combo >= tier.at) mul = tier.mul;
  return mul;
}

export function comboTierProgress(combo: number): { mul: number; next: number; progress: number } {
  let index = 0;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (combo >= COMBO_TIERS[i].at) index = i;
  const mul = COMBO_TIERS[index].mul;
  const from = COMBO_TIERS[index].at;
  const to = index + 1 < COMBO_TIERS.length ? COMBO_TIERS[index + 1].at : FRENZY_AT;
  return { mul, next: to, progress: Math.min(1, (combo - from) / Math.max(1, to - from)) };
}

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

export class World {
  game: Game;
  fish: FishEntity[] = [];
  pellets: Pellet[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  bubbles: Bubble[] = [];
  popups: Popup[] = [];
  shocks: Shock[] = [];

  elapsed = 0;
  bounds: Bounds = { halfWidth: 3.1, top: 3.2, bottom: -2.4 };

  combo = 0;
  comboUntil = 0;
  frenzyUntil = 0;
  frenzyReadyAt = 0;
  frenzyFlash = 0;
  /** Rises with the combo and drives the screen shake / colour push. */
  intensity = 0;

  pointerX = 0;
  pointerY = 0;
  pointerInside = false;

  private lastFeed = -99;
  private autoFeedAccum = 0;
  private frenzyRainAccum = 0;
  private breedAccum = 0;
  private earnWindow = 0;
  private earnAccum = 0;
  private syncPending = false;
  private bubbleCheck = 2;

  constructor(game: Game) {
    this.game = game;
    this.rebuild();
  }

  // ── Construction ───────────────────────────────────────────────────────────
  rebuild() {
    this.fish = [];
    this.pellets = [];
    this.pickups = [];
    this.particles = [];
    this.popups = [];
    this.shocks = [];
    this.combo = 0;
    this.frenzyUntil = 0;
    // Bubbles survive a rebuild for continuity, but their cargo must not: a coin
    // minted in the old tank would otherwise be banked in the new one.
    for (const bubble of this.bubbles) bubble.carry = 0;
    for (const save of this.game.state.fish) this.spawnFish(save.species, save);
    this.seedBubbles();
    this.syncFish();
  }

  seedBubbles() {
    const target = Math.round(26 * this.game.derived.bubbleDensity);
    for (let i = this.bubbles.length - 1; i >= 0 && this.bubbles.length > target; i--) {
      // Never cull a bubble that is carrying coins to the surface.
      if (this.bubbles[i].carry === 0) this.bubbles.splice(i, 1);
    }
    while (this.bubbles.length < target) {
      this.bubbles.push({
        x: rand(-this.bounds.halfWidth, this.bounds.halfWidth),
        y: rand(this.bounds.bottom - 1, this.bounds.top),
        z: rand(1.2, 2.4),
        speed: rand(0.35, 0.95),
        drift: rand(0, 6.28),
        scale: rand(0.5, 1.4),
        carry: 0,
      });
    }
  }

  spawnFish(species: SpeciesId, save?: FishSave): FishEntity {
    const def = SPECIES[species];
    const xp = save?.xp ?? 0;
    const stage = stageFor(xp);
    const depth = def.floorDweller ? rand(0.02, 0.25) : rand(0.1, 0.95);
    const phase = rand(0, 6.28);
    const fish: FishEntity = {
      id: nextId++,
      species,
      xp,
      bonus: save?.bonus ?? 1,
      variant: save?.variant ?? false,
      x: rand(-this.bounds.halfWidth * 0.8, this.bounds.halfWidth * 0.8),
      y: def.floorDweller ? this.bounds.bottom + 0.15 : rand(this.bounds.bottom, this.bounds.top),
      z: 0,
      vx: 0, vy: 0,
      heading: Math.random() < 0.5 ? 0 : Math.PI,
      speed: 0,
      facing: 1,
      nextTurnAt: 0,
      beat: phase,
      thrust: 0.5,
      burstAt: 0,
      phase,
      depth,
      targetDepth: depth,
      targetX: 0, targetY: 0,
      thinkAt: 0,
      searchAt: rand(0, 0.3),
      chewUntil: 0,
      restUntil: 0,
      pellet: null,
      pickup: null,
      prey: null,
      inflate: 0,
      banked: 0,
      nextAbility: rand(2, 10),
      boostUntil: 0,
      boostMul: 1,
      rageUntil: 0,
      passiveAccum: 0,
      size: def.length * STAGES[stage].scale,
      stage,
      flash: 0,
      dying: 0,
    };
    fish.facing = Math.cos(fish.heading) >= 0 ? 1 : -1;
    this.fish.push(fish);
    return fish;
  }

  toSave(): FishSave[] {
    const saved: FishSave[] = this.fish
      .filter((f) => f.dying === 0)
      .map((f) => ({ species: f.species, xp: f.xp, stage: f.stage, bonus: f.bonus, variant: f.variant }));
    // Fish bought this frame have not been spawned yet. A save triggered by the tab
    // closing between the click and the next frame would otherwise eat them.
    for (const species of this.game.pendingSpawns) {
      saved.push({ species, xp: 0, stage: 0, bonus: 1, variant: false });
    }
    return saved;
  }

  /** Batched because several things in one frame can change the roster. */
  private syncFish() {
    this.syncPending = true;
  }

  private flushSync() {
    if (!this.syncPending) return;
    this.syncPending = false;
    this.game.syncFish(this.toSave());
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  /** Returns true when food actually left the player's hand. */
  feedAt(x: number, y: number, manual = true): boolean {
    const d = this.game.derived;
    if (manual && this.elapsed - this.lastFeed < d.feedInterval) return false;
    const count = manual ? d.feedCount : d.autoFeedCount;
    let foodId = this.game.state.foodId;
    const total = this.game.foodCost(foodId) * count;
    if (total > 0 && !this.game.spend(total)) {
      // Falling back to free flakes rather than refusing: premium food stays
      // selected after a tank move, when the player has exactly zero coins, and
      // "cannot feed" there would be an unrecoverable dead end.
      foodId = "flake";
      if (manual) this.pushPopup(x, y, "Para yok → normal yem", "#ffb3a0", false);
    }
    if (manual) this.lastFeed = this.elapsed;
    const spread = 0.35 + (d.feedCount - 1) * 0.16;
    for (let i = 0; i < count; i++) {
      this.spawnPellet(
        x + rand(-spread, spread),
        y + rand(-0.18, 0.28),
        foodId,
      );
    }
    this.game.state.stats.pelletsDropped += count;
    return true;
  }

  spawnPellet(x: number, y: number, food: FoodId): Pellet {
    const pellet: Pellet = {
      id: nextId++,
      food,
      x: Math.max(-this.bounds.halfWidth, Math.min(this.bounds.halfWidth, x)),
      y: Math.min(y, this.bounds.top + 0.4),
      // Kept near the plane the pointer maps to, so food lands where it was dropped;
      // the pool's own mesh offset is what decides which fish it draws behind.
      z: rand(-0.2, 0.2),
      vx: rand(-0.12, 0.12),
      vy: rand(-0.05, 0.12),
      age: 0,
      settled: 0,
      claim: 0,
      claimUntil: 0,
      splitAt: FOODS[food].effect === "split" ? rand(0.35, 0.8) : 0,
      gone: false,
    };
    this.pellets.push(pellet);
    return pellet;
  }

  /** A click in the water: collect anything under it, then feed. */
  clickAt(x: number, y: number): boolean {
    let collected = false;
    const reach = 0.75;
    for (const pickup of this.pickups) {
      if (pickup.collected) continue;
      const dx = pickup.x - x, dy = pickup.y - y;
      if (dx * dx + dy * dy < reach * reach) {
        this.collect(pickup, 1 + this.game.derived.freshBonus, true);
        collected = true;
      }
    }
    return collected;
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  step(dt: number) {
    const game = this.game;
    this.elapsed += dt;
    game.state.stats.playTime += dt;

    while (game.pendingSpawns.length) {
      const species = game.pendingSpawns.shift()!;
      const fish = this.spawnFish(species);
      this.burst(fish.x, fish.y, 14, [0.6, 1, 0.9]);
      this.syncFish();
    }

    while (game.pendingRemovals.length) {
      const species = game.pendingRemovals.shift()!;
      // The least grown one goes: selling should never cost the player the fish they
      // have spent the run feeding.
      let victim: FishEntity | null = null;
      for (const f of this.fish) {
        if (f.species !== species || f.dying > 0) continue;
        if (!victim || f.xp < victim.xp) victim = f;
      }
      if (victim) {
        victim.dying = 0.3;
        victim.pellet = null;
        this.burst(victim.x, victim.y, 16, [0.6, 0.85, 1], 0.12);
        this.pushPopup(victim.x, victim.y + 0.3, "SATILDI", "#8fd8ff", false);
      }
    }

    this.updateCombo(dt);
    this.autoFeed(dt);
    this.updatePellets(dt);
    this.updateFish(dt);
    this.updatePickups(dt);
    this.updateBubbles(dt);
    this.updateParticles(dt);
    this.updateEnvironment(dt);
    this.flushSync();
    this.publish(dt);
  }

  private updateCombo(dt: number) {
    const inFrenzy = this.elapsed < this.frenzyUntil;
    if (inFrenzy) {
      this.frenzyRainAccum += dt * 11;
      while (this.frenzyRainAccum >= 1) {
        this.frenzyRainAccum -= 1;
        this.spawnPellet(rand(-this.bounds.halfWidth, this.bounds.halfWidth), this.bounds.top, "flake");
      }
    } else if (this.frenzyUntil > 0) {
      // The frame the frenzy lapses. This has to be its own branch: folding it into
      // the "not in frenzy" case below means the reset never runs and the combo
      // count carries over, re-triggering a frenzy forever.
      this.frenzyUntil = 0;
      this.combo = 0;
      this.comboUntil = 0;
      this.frenzyReadyAt = this.elapsed + FRENZY_COOLDOWN;
      this.frenzyFlash = 0.6;
      this.pushPopup(0, 0.6, "FRENZY BİTTİ", "#8fd8ff", true);
    } else {
      if (this.elapsed > this.comboUntil && this.combo > 0) {
        // Bleed rather than snap: losing a 40-chain to one slow second feels unfair.
        this.combo = Math.max(0, this.combo - dt * 26);
      }
      if (this.combo >= FRENZY_AT) {
        if (this.elapsed >= this.frenzyReadyAt) this.startFrenzy();
        // Still cooling down: the chain holds at the top tier but cannot tip over.
        else this.combo = FRENZY_AT - 0.01;
      }
    }
    const target = inFrenzy ? 1 : Math.min(1, this.combo / FRENZY_AT);
    this.intensity += (target - this.intensity) * Math.min(1, dt * 3.2);
    this.frenzyFlash = Math.max(0, this.frenzyFlash - dt);
  }

  private startFrenzy() {
    const d = this.game.derived;
    this.frenzyUntil = this.elapsed + d.frenzyLength;
    this.frenzyFlash = 1.4;
    this.game.state.stats.frenzies++;
    this.game.notice("reward", "🔥 FEEDING FRENZY", `${Math.round(d.frenzyLength)} saniye boyunca ×${Math.round(d.frenzyPower)} üretim.`);
    this.pushPopup(0, 1.2, "FEEDING FRENZY!", "#ffd93d", true);
    for (let i = 0; i < 90; i++) {
      this.particles.push({
        x: rand(-this.bounds.halfWidth, this.bounds.halfWidth),
        y: rand(this.bounds.bottom, this.bounds.top),
        z: 2.4,
        vx: rand(-2, 2), vy: rand(0.5, 3.5),
        life: rand(0.5, 1.4), maxLife: 1.4,
        size: rand(0.12, 0.3),
        color: [1, 0.85, 0.3],
        kind: "spark",
        spin: rand(0, 6.3),
      });
    }
    for (const fish of this.fish) { fish.restUntil = 0; fish.thinkAt = 0; }
  }

  get frenzyActive() { return this.elapsed < this.frenzyUntil; }

  /** The multiplier every coin is minted with right now. */
  get liveMultiplier(): number {
    return this.frenzyActive ? this.game.derived.frenzyPower : comboMultiplier(this.combo);
  }

  private autoFeed(dt: number) {
    const d = this.game.derived;
    if (d.autoFeedRate <= 0 || !this.game.state.autoFeedOn) return;
    this.autoFeedAccum += dt * d.autoFeedRate;
    while (this.autoFeedAccum >= 1) {
      this.autoFeedAccum -= 1;
      let x = rand(-this.bounds.halfWidth * 0.9, this.bounds.halfWidth * 0.9);
      let y = this.bounds.top - 0.2;
      if (d.autoFeedSmart) {
        // Aim at whichever fish has nothing to chew, so nothing rots on the sand.
        const idle = this.fish.filter((f) => !f.pellet && this.elapsed > f.chewUntil && f.dying === 0);
        if (idle.length) {
          const pick = idle[Math.floor(Math.random() * idle.length)];
          x = pick.x + rand(-0.3, 0.3);
          y = Math.min(this.bounds.top, pick.y + rand(0.5, 1.1));
        }
      }
      this.feedAt(x, y, false);
    }
  }

  private updatePellets(dt: number) {
    const d = this.game.derived;
    const sink = d.sinkRate;
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      p.age += dt;
      if (p.gone) { this.pellets.splice(i, 1); continue; }

      if (p.splitAt > 0 && p.age > p.splitAt) {
        p.splitAt = 0;
        const twin = this.spawnPellet(p.x + rand(-0.25, 0.25), p.y + 0.1, p.food);
        twin.splitAt = 0;
        this.burst(p.x, p.y, 4, [1, 0.6, 0.8], 0.06);
      }

      if (p.settled > 0) {
        p.settled += dt;
        // Left on the sand long enough and it rots, which is what dirties the water.
        if (p.settled > 9) {
          this.game.state.dirt = Math.min(1, this.game.state.dirt + 0.005);
          this.burst(p.x, p.y, 3, [0.4, 0.6, 0.25], 0.05);
          this.pellets.splice(i, 1);
        }
        continue;
      }

      p.vy -= sink * dt * 1.4;
      p.vy = Math.max(p.vy, -sink);
      p.vx *= Math.pow(0.6, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const shadowLevel = this.bounds.bottom - PICKUP_SHADOW_LEVEL;
      if (p.y <= shadowLevel) {
        p.y = shadowLevel;
        p.settled = 0.001;
        p.vx = 0; p.vy = 0;
      }
    }
  }

  private removePellet(pellet: Pellet) {
    pellet.gone = true;
    const i = this.pellets.indexOf(pellet);
    if (i >= 0) this.pellets.splice(i, 1);
    for (const f of this.fish) if (f.pellet === pellet) f.pellet = null;
  }

  // ── Fish ───────────────────────────────────────────────────────────────────
  private updateFish(dt: number) {
    const game = this.game;
    const d = game.derived;
    const bounds = this.bounds;
    const frenzy = this.frenzyActive;

    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      if (f.dying > 0) {
        f.dying -= dt;
        if (f.dying <= 0) { this.fish.splice(i, 1); this.syncFish(); }
        continue;
      }
      const def = SPECIES[f.species];
      const stage = STAGES[f.stage];
      f.flash = Math.max(0, f.flash - dt * 2.5);
      if (this.elapsed > f.boostUntil) f.boostMul = 1;

      const raging = this.elapsed < f.rageUntil;
      const speedScale = d.metabolism * (frenzy ? 1.55 : 1) * (raging ? 2.2 : 1) * (1 + this.intensity * 0.35);
      const sense = def.senseRadius * d.senseMul * (1 + this.intensity * 0.3);

      this.retarget(f, def, sense, dt);
      this.runAbilities(f, def, dt);

      // ── Steering: heading only, so a fish can never sidestep or reverse ──
      let steerX = 0, steerY = 0;
      let goalX = f.targetX, goalY = f.targetY;
      let urgency = 1;

      if (f.pellet && !f.pellet.gone) { goalX = f.pellet.x; goalY = f.pellet.y; urgency = 1.7; }
      else if (f.pickup && !f.pickup.collected) { goalX = f.pickup.x; goalY = f.pickup.y; urgency = 1.5; }
      else if (f.prey && f.prey.dying === 0) { goalX = f.prey.x; goalY = f.prey.y; urgency = 2.2; }

      const dx = goalX - f.x, dy = goalY - f.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      steerX = dx / distance;
      steerY = dy / distance;
      steerX += Math.sin(this.elapsed * 0.37 + f.phase * 2.1) * 0.2;
      steerY += Math.cos(this.elapsed * 0.29 + f.phase * 1.7) * 0.14;

      // Personal space, scaled by how big the two bodies are.
      for (let j = 0; j < this.fish.length; j++) {
        if (j === i) continue;
        const other = this.fish[j];
        if (other.dying > 0) continue;
        const ax = f.x - other.x, ay = f.y - other.y;
        const room = (f.size + other.size) * 0.45;
        const gap = Math.hypot(ax, ay);
        if (gap < room && gap > 0.0001) {
          const push = (room - gap) / room;
          steerX += (ax / gap) * push * 0.9;
          steerY += (ay / gap) * push * 0.9;
        }
      }

      // Look-ahead off the glass so they peel away instead of pinning to an edge.
      const lookX = f.x + Math.cos(f.heading) * 1.5;
      const lookY = f.y + Math.sin(f.heading) * 1.5;
      const edge = bounds.halfWidth;
      if (lookX > edge) steerX -= (lookX - edge) * 1.1;
      if (lookX < -edge) steerX -= (lookX + edge) * 1.1;
      const floor = def.floorDweller ? bounds.bottom - 0.3 : bounds.bottom;
      if (lookY > bounds.top) steerY -= (lookY - bounds.top) * 1.2;
      if (lookY < floor) steerY -= (lookY - floor) * 1.2;
      steerY *= def.floorDweller ? 0.9 : 0.6;

      const wanted = Math.atan2(steerY, steerX);
      let off = wanted - f.heading;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      const turnRate = (4.5 - Math.min(def.length, 3) * 0.55) * (1 + urgency * 0.45);
      const agility = turnRate * (1.25 - 0.5 * Math.min(f.speed / (def.swimSpeed || 1), 1));
      f.heading += Math.max(-agility * dt, Math.min(agility * dt, off));

      // Burst-and-glide: a tail beat spikes thrust, drag bleeds it away.
      const chewing = this.elapsed < f.chewUntil;
      const resting = this.elapsed < f.restUntil;
      if (this.elapsed > f.burstAt) {
        f.thrust = resting ? rand(0.12, 0.24) : rand(0.7, 1.15) * urgency;
        f.burstAt = this.elapsed + (resting ? rand(1.1, 2.5) : rand(0.35, 1.0));
      }
      f.thrust *= Math.exp(-dt * 2.2);
      const arrive = Math.max(0.12, Math.min(1, distance / 1.4));
      const turnDrag = 1 - 0.45 * Math.min(Math.abs(off), 1.2) / 1.2;
      const wantedSpeed = def.swimSpeed * speedScale * (0.28 + f.thrust * 1.35)
        * arrive * turnDrag * (chewing ? 0.32 : 1);
      f.speed += (wantedSpeed - f.speed) * Math.min(dt * 3.6, 1);

      f.vx = Math.cos(f.heading) * f.speed;
      f.vy = Math.sin(f.heading) * f.speed;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (def.floorDweller) {
        // Bottom dwellers crawl: keep them pinned to the sand with a small bob.
        const rest = bounds.bottom - 0.22 + Math.sin(this.elapsed * 2 + f.phase) * 0.05;
        f.y += (rest - f.y) * Math.min(1, dt * 3.5);
      }
      f.x = Math.max(-bounds.halfWidth - 0.4, Math.min(bounds.halfWidth + 0.4, f.x));
      f.y = Math.max(bounds.bottom - 0.6, Math.min(bounds.top + 0.3, f.y));

      f.beat += dt * (2.2 + 8.4 * Math.min(f.speed / (def.swimSpeed || 1), 1.6));
      const horizontalFacing = Math.cos(f.heading) >= 0 ? 1 : -1;
      if (
        Math.abs(Math.cos(f.heading)) > 0.4
        && horizontalFacing !== f.facing
        && this.elapsed >= f.nextTurnAt
      ) {
        f.facing = horizontalFacing;
        f.nextTurnAt = this.elapsed + FISH_TURN_COOLDOWN;
      }
      f.targetDepth = def.floorDweller
        ? 0.12
        : Math.max(0.04, Math.min(0.98, def.depthBias + Math.sin(this.elapsed * 0.19 + f.phase) * 0.32));
      f.depth += (f.targetDepth - f.depth) * dt * 0.5;
      const inflateScale = def.abilities.some((a) => a.kind === "inflate") ? 1 + f.inflate * 0.65 : 1;
      f.size = def.length * stage.scale * (f.variant ? 1.12 : 1) * inflateScale;

      this.tryEat(f, def, dt);
    }
  }

  private retarget(f: FishEntity, def: (typeof SPECIES)[SpeciesId], sense: number, dt: number) {
    void dt;
    const chewing = this.elapsed < f.chewUntil;

    // Drop stale targets first, then look for something better.
    if (f.pellet && (f.pellet.gone || f.pellet.claim !== f.id)) f.pellet = null;
    if (f.pickup && f.pickup.collected) f.pickup = null;
    if (f.prey && f.prey.dying > 0) f.prey = null;
    // Renew the claim while still chasing, so a distracted fish releases the pellet
    // instead of reserving it forever.
    if (f.pellet) f.pellet.claimUntil = this.elapsed + 2;

    if (!chewing && this.elapsed > f.searchAt) {
      f.searchAt = this.elapsed + rand(0.14, 0.28);
      const collector = def.abilities.find((a) => a.kind === "collector") as Extract<Ability, { kind: "collector" }> | undefined;

      if (!f.pellet) {
        let best: Pellet | null = null;
        let bestDistance = sense * sense;
        for (const p of this.pellets) {
          if (p.gone) continue;
          if (p.claim !== 0 && p.claim !== f.id && p.claimUntil > this.elapsed) continue;
          const dx = p.x - f.x, dy = p.y - f.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDistance) { bestDistance = d2; best = p; }
        }
        if (best) {
          best.claim = f.id;
          best.claimUntil = this.elapsed + 2;
          f.pellet = best;
          f.pickup = null;
        }
      }

      // Collectors go for loose coins whenever there is no food worth chasing.
      if (!f.pellet && collector && !f.pickup) {
        let best: Pickup | null = null;
        let bestDistance = collector.radius * collector.radius;
        for (const p of this.pickups) {
          if (p.collected || (p.claim !== 0 && p.claim !== f.id)) continue;
          const dx = p.x - f.x, dy = p.y - f.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDistance) { bestDistance = d2; best = p; }
        }
        if (best) { best.claim = f.id; f.pickup = best; }
      }
    }

    if (!f.pellet && !f.pickup && !f.prey && this.elapsed > f.thinkAt) {
      const b = this.bounds;
      f.targetX = rand(-b.halfWidth * 0.92, b.halfWidth * 0.92);
      f.targetY = def.floorDweller ? b.bottom - 0.2 : rand(b.bottom + 0.2, b.top - 0.2);
      f.thinkAt = this.elapsed + rand(2.4, 6.5);
      f.restUntil = Math.random() < 0.22 ? this.elapsed + rand(1.2, 2.8) : 0;
    }
  }

  private tryEat(f: FishEntity, def: (typeof SPECIES)[SpeciesId], dt: number) {
    void dt;
    const reach = 0.22 + f.size * 0.42;

    if (f.pellet && !f.pellet.gone && this.elapsed > f.chewUntil) {
      const dx = f.pellet.x - f.x, dy = f.pellet.y - f.y;
      if (dx * dx + dy * dy < reach * reach) this.eatPellet(f, def, f.pellet);
    }

    if (f.pickup && !f.pickup.collected) {
      const dx = f.pickup.x - f.x, dy = f.pickup.y - f.y;
      if (dx * dx + dy * dy < reach * reach * 1.6) {
        this.collect(f.pickup, 1, false);
        f.pickup = null;
      }
    }

    if (f.prey && f.prey.dying === 0) {
      const dx = f.prey.x - f.x, dy = f.prey.y - f.y;
      if (dx * dx + dy * dy < reach * reach * 1.4) this.devour(f, f.prey);
    }
  }

  private eatPellet(f: FishEntity, def: (typeof SPECIES)[SpeciesId], pellet: Pellet) {
    const game = this.game;
    const d = game.derived;
    const food = FOODS[pellet.food];
    const frenzy = this.frenzyActive;

    this.removePellet(pellet);
    f.chewUntil = this.elapsed + def.chew * d.chewMul * (frenzy ? 0.45 : 1);
    f.flash = 1;
    game.state.stats.pelletsEaten++;

    // Combo first: the multiplier this bite earns includes the bite itself, which is
    // what makes a fast chain feel like it is accelerating. During a frenzy the
    // counter is frozen — the multiplier is already maxed, and letting it climb only
    // inflates the record and refills the bar the moment the frenzy ends.
    if (!frenzy) {
      this.combo += d.comboRamp * (1 + food.comboBonus);
      this.comboUntil = this.elapsed + d.comboGrace;
      if (this.combo > game.state.stats.bestCombo) game.state.stats.bestCombo = Math.floor(this.combo);
    }

    const xpGain = food.xpMul * d.growthMul * (f.variant ? 1.35 : 1);
    f.xp += xpGain;
    const newStage = stageFor(f.xp);
    if (newStage !== f.stage) {
      f.stage = newStage;
      this.burst(f.x, f.y, 22, [1, 0.9, 0.4], 0.14);
      this.pushPopup(f.x, f.y + 0.4, `${STAGES[newStage].name}!`, "#ffd93d", false);
      this.syncFish();
    }

    const schooling = this.schoolBonus(f, def);
    const value = fishValue(game, f.species, f.xp, f.bonus, schooling)
      * food.valueMul * this.liveMultiplier * f.boostMul
      * (this.elapsed < f.rageUntil ? 5 : 1);

    const inflate = def.abilities.find((a) => a.kind === "inflate") as Extract<Ability, { kind: "inflate" }> | undefined;
    if (inflate) {
      f.banked += value;
      f.inflate = Math.min(1, f.inflate + 1 / inflate.bites);
      this.burst(f.x, f.y, 3, [1, 0.95, 0.5], 0.05);
      if (f.inflate >= 0.999) this.pop(f, inflate);
    } else {
      this.dropReward(f, value, food);
    }

    this.applyFoodEffect(f, food.effect, pellet);
    this.game.touch();
  }

  private schoolBonus(f: FishEntity, def: (typeof SPECIES)[SpeciesId]): number {
    const school = def.abilities.find((a) => a.kind === "school") as Extract<Ability, { kind: "school" }> | undefined;
    if (!school) return 1;
    let neighbours = 0;
    for (const other of this.fish) {
      if (other === f || other.species !== f.species || other.dying > 0) continue;
      if (Math.hypot(other.x - f.x, other.y - f.y) < school.radius) neighbours++;
      if (neighbours >= school.max) break;
    }
    return 1 + neighbours * school.per;
  }

  private dropReward(f: FishEntity, value: number, food: (typeof FOODS)[FoodId]) {
    const d = this.game.derived;
    const gold = food.effect === "gold" || Math.random() < d.goldChance;
    // Deliberately one coin per bite. Splitting the payout looked generous on paper
    // and in practice buried the fish — and watching the fish is the game.
    this.spawnPickup(f.x, f.y, gold ? value * 9 : value, gold ? "nugget" : "coin");
  }

  private applyFoodEffect(f: FishEntity, effect: (typeof FOODS)[FoodId]["effect"], pellet: Pellet) {
    switch (effect) {
      case "explode": {
        // The chain reaction the design is built around: one bite feeds five more.
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + rand(-0.3, 0.3);
          const p = this.spawnPellet(f.x + Math.cos(a) * 0.5, f.y + Math.sin(a) * 0.5, "flake");
          p.vx = Math.cos(a) * 2.4;
          p.vy = Math.sin(a) * 2.4 + 0.6;
        }
        this.burst(f.x, f.y, 26, [1, 0.45, 0.15], 0.2);
        this.shocks.push({ x: f.x, y: f.y, r: 0.4, life: 0.45 });
        break;
      }
      case "mutate": {
        if (!f.variant && Math.random() < 0.12) {
          f.variant = true;
          f.bonus *= 2.5;
          this.game.state.stats.mutations++;
          this.burst(f.x, f.y, 40, [0.6, 1, 1], 0.22);
          this.pushPopup(f.x, f.y + 0.5, "NADİR VARYANT!", "#8ef0ff", true);
          this.game.notice("reward", "🌈 Nadir Varyant", `${SPECIES[f.species].name} kalıcı olarak ×2.5 üretiyor.`);
          this.syncFish();
        }
        break;
      }
      case "enrage": {
        f.rageUntil = this.elapsed + 8;
        this.burst(f.x, f.y, 24, [0.6, 1, 0.2], 0.16);
        this.pushPopup(f.x, f.y + 0.4, "ÇILDIRDI", "#9dff3d", false);
        break;
      }
      default:
        break;
    }
    void pellet;
  }

  private pop(f: FishEntity, inflate: Extract<Ability, { kind: "inflate" }>) {
    const total = f.banked * inflate.popMul;
    f.banked = 0;
    f.inflate = 0;
    this.game.state.stats.popCount++;
    this.shocks.push({ x: f.x, y: f.y, r: 0.5, life: 0.6 });
    this.burst(f.x, f.y, 48, [1, 0.95, 0.3], 0.3);
    this.pushPopup(f.x, f.y + 0.6, "POP!", "#ffd93d", true);
    const instant = this.game.derived.flags.has("instantPop");
    const shards = 8;
    for (let i = 0; i < shards; i++) {
      const a = (i / shards) * Math.PI * 2;
      const pickup = this.spawnPickup(
        f.x + Math.cos(a) * 0.35,
        f.y + Math.sin(a) * 0.35,
        total / shards,
        i % 3 === 0 ? "gem" : "coin",
      );
      pickup.vx = Math.cos(a) * 3.2;
      pickup.vy = Math.sin(a) * 3.2;
      if (instant) this.collect(pickup, 1, false);
    }
    // Being next to a bursting puffer is a jolt for everyone.
    for (const other of this.fish) {
      if (other === f) continue;
      const distance = Math.hypot(other.x - f.x, other.y - f.y);
      if (distance < 2.6) { other.thrust = 1.6; other.restUntil = 0; }
    }
  }

  private devour(shark: FishEntity, prey: FishEntity) {
    const preyValue = fishValue(this.game, prey.species, prey.xp, prey.bonus);
    const predator = SPECIES[shark.species].abilities
      .find((a) => a.kind === "predator") as Extract<Ability, { kind: "predator" }>;
    shark.bonus += predator.gain * (0.35 + prey.stage * 0.2);
    shark.flash = 1;
    prey.dying = 0.35;
    prey.pellet = null;
    this.game.state.stats.devoured++;
    this.burst(prey.x, prey.y, 30, [1, 0.25, 0.3], 0.2);
    this.pushPopup(shark.x, shark.y + 0.6, `×${shark.bonus.toFixed(2)} DEĞER`, "#ff6b6b", false);
    this.spawnPickup(prey.x, prey.y, preyValue * 10 * this.liveMultiplier, "gem");
    this.game.notice(
      "warn",
      "🦈 Avlandı",
      `${SPECIES[prey.species].name} yendi. Köpekbalığının kalıcı değeri ×${shark.bonus.toFixed(2)}.`,
    );
    shark.prey = null;
    this.syncFish();
  }

  private runAbilities(f: FishEntity, def: (typeof SPECIES)[SpeciesId], dt: number) {
    for (const ability of def.abilities) {
      switch (ability.kind) {
        case "cleaner":
          this.game.state.dirt = Math.max(0, this.game.state.dirt - ability.rate * dt);
          break;
        case "lure": {
          // Pull loose food toward the lantern; this is what makes the anglerfish
          // visibly change the flow of the tank rather than just earning more.
          for (const p of this.pellets) {
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
          f.passiveAccum += ability.perSecond * this.game.derived.valueMul
            * (this.game.derived.speciesMul[f.species] ?? 1)
            * (this.game.derived.schoolMul[f.species] ?? 1) * f.bonus * dt
            * (this.frenzyActive ? 3 : 1);
          const threshold = ability.perSecond * this.game.derived.valueMul * 1.6;
          if (f.passiveAccum > threshold) {
            this.spawnPickup(f.x, f.y - 0.2, f.passiveAccum, "coin");
            f.passiveAccum = 0;
          }
          break;
        }
        default:
          break;
      }
    }

    if (this.elapsed < f.nextAbility) return;

    for (const ability of def.abilities) {
      switch (ability.kind) {
        case "shock": {
          f.nextAbility = this.elapsed + ability.interval;
          const mass = this.game.derived.flags.has("massFrenzy");
          const radius = mass ? 99 : ability.radius;
          let hit = 0;
          for (const other of this.fish) {
            if (other === f || other.dying > 0) continue;
            if (Math.hypot(other.x - f.x, other.y - f.y) > radius) continue;
            other.boostUntil = this.elapsed + ability.duration;
            other.boostMul = Math.max(other.boostMul, ability.mul);
            other.thrust = 1.4;
            hit++;
          }
          this.shocks.push({ x: f.x, y: f.y, r: 0.3, life: 0.5 });
          this.burst(f.x, f.y, 20, [0.8, 1, 0.4], 0.18);
          if (mass && hit > 0) this.combo += 6;
          break;
        }
        case "dig": {
          f.nextAbility = this.elapsed + ability.interval * rand(0.8, 1.2);
          const digs = this.game.derived.flags.has("doubleDig") ? 2 : 1;
          for (let i = 0; i < digs; i++) {
            if (Math.random() > ability.luck * 0.85) continue;
            this.game.state.stats.digs++;
            const value = fishValue(this.game, f.species, f.xp, f.bonus) * 26 * this.liveMultiplier;
            const kind: PropKey = Math.random() < 0.28 ? "chest" : Math.random() < 0.5 ? "pearl" : "gem";
            const pickup = this.spawnPickup(f.x + rand(-0.4, 0.4), this.bounds.bottom - 0.2, value * (kind === "chest" ? 3 : 1), kind);
            pickup.vy = 1.4;
            this.burst(pickup.x, pickup.y, 12, [0.85, 0.7, 0.4], 0.12);
          }
          break;
        }
        case "predator": {
          f.nextAbility = this.elapsed + ability.interval;
          if (!this.game.state.sharkDiet) break;
          const candidates = this.fish.filter((other) =>
            other !== f && other.dying === 0 && SPECIES[other.species].prey && other.size < f.size * 0.6);
          if (!candidates.length) break;
          f.prey = candidates[Math.floor(Math.random() * candidates.length)];
          break;
        }
        case "bubbler": {
          f.nextAbility = this.elapsed + 1 / ability.rate;
          const value = ability.value * this.game.derived.valueMul * f.bonus * this.liveMultiplier;
          this.bubbles.push({
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
    if (this.elapsed >= f.nextAbility) f.nextAbility = this.elapsed + 3;
  }

  // ── Pickups ────────────────────────────────────────────────────────────────
  spawnPickup(x: number, y: number, value: number, kind: PropKey): Pickup {
    // Coins still pop up out of a fish, but now fan out through a wide upward arc
    // instead of stacking into a single vertical stream.
    const launchAngle = Math.PI / 2 + rand(-0.95, 0.95);
    const launchSpeed = rand(1.2, 2.25);
    const pickup: Pickup = {
      id: nextId++,
      kind,
      value,
      x, y,
      z: rand(-0.2, 0.2),
      vx: Math.cos(launchAngle) * launchSpeed,
      vy: Math.sin(launchAngle) * launchSpeed,
      age: 0,
      spin: rand(0, 6.28),
      claim: 0,
      collected: false,
    };
    this.pickups.push(pickup);
    // A tank that has stopped being collected should not become a slideshow: the
    // oldest coin is banked rather than dropped, so nothing is ever lost silently.
    if (this.pickups.length > 150) {
      const oldest = this.pickups.shift();
      if (oldest) this.collect(oldest, 1, false);
    }
    return pickup;
  }

  private updatePickups(dt: number) {
    const d = this.game.derived;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.collected) { this.pickups.splice(i, 1); continue; }
      p.age += dt;
      p.spin += dt * 3.4;
      p.vy -= 1.9 * dt;
      p.vy = Math.max(p.vy, -0.55);
      p.vx *= Math.pow(0.25, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const shadowLevel = this.bounds.bottom - PICKUP_SHADOW_LEVEL;
      if (p.y < shadowLevel) { p.y = shadowLevel; p.vy = 0; }

      // Direct contact is always enough to collect a pickup. The magnet upgrade
      // remains valuable because it pulls coins in from much farther away.
      if (this.pointerInside) {
        const dx = this.pointerX - p.x, dy = this.pointerY - p.y;
        if (dx * dx + dy * dy < 0.36 * 0.36) {
          this.collect(p, 1 + d.freshBonus, true);
          continue;
        }
      }

      if (d.magnetRadius > 0 && this.pointerInside) {
        const dx = this.pointerX - p.x, dy = this.pointerY - p.y;
        const distance = Math.hypot(dx, dy);
        if (distance < d.magnetRadius) {
          const pull = (1 - distance / d.magnetRadius) * CURSOR_MAGNET_SPEED * dt;
          p.x += dx * pull;
          p.y += dy * pull;
          if (distance < 0.3) { this.collect(p, 1 + d.freshBonus * 0.5, true); continue; }
        }
      }

      if (p.age > d.autoCollect) this.collect(p, 1, false);
    }
  }

  collect(pickup: Pickup, multiplier: number, manual: boolean) {
    if (pickup.collected) return;
    pickup.collected = true;
    for (const f of this.fish) if (f.pickup === pickup) f.pickup = null;
    this.bank(pickup.value * multiplier * this.game.derived.coinValueMul, pickup.x, pickup.y, manual);
  }

  private bank(value: number, x: number, y: number, manual: boolean) {
    this.game.earn(value);
    this.earnAccum += value;
    this.pushPopup(x, y, `+${short(value)}`, manual ? "#ffe066" : "#c8f5ff", manual);
    this.burst(x, y, manual ? 7 : 4, [1, 0.85, 0.35], 0.08);
  }

  // ── Ambience ───────────────────────────────────────────────────────────────
  private updateBubbles(dt: number) {
    const d = this.game.derived;
    const top = this.bounds.top + 0.2;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y += b.speed * dt * (1 + this.intensity * 0.8);
      b.x += Math.sin(this.elapsed * 1.4 + b.drift) * 0.14 * dt;
      if (b.y > top) {
        if (b.carry > 0) {
          this.bank(b.carry, b.x, top - 0.1, false);
          this.bubbles.splice(i, 1);
          continue;
        }
        b.y = this.bounds.bottom - 0.5;
        b.x = rand(-this.bounds.halfWidth, this.bounds.halfWidth);
        // The Bubble Collector upgrade is what turns ambience into income.
        if (d.bubbleValue > 0 && Math.random() < 0.22) {
          b.carry = d.bubbleValue * 4 * this.pelletScale() * this.liveMultiplier;
        }
      }
    }
  }

  /** A value scale that keeps ambient income relevant at every tank size. */
  private pelletScale(): number {
    let best = 3;
    for (const f of this.fish) best = Math.max(best, SPECIES[f.species].baseValue * STAGES[f.stage].mul);
    return best * this.game.derived.valueMul;
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy -= 0.9 * dt;
      p.vx *= Math.pow(0.35, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 4;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y += dt * 0.75;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.life -= dt;
      s.r += dt * 7;
      if (s.life <= 0) this.shocks.splice(i, 1);
    }
  }

  private updateEnvironment(dt: number) {
    const game = this.game;
    const d = game.derived;
    // The air stone changes the bubble count, so the population is re-checked
    // occasionally rather than only at construction.
    this.bubbleCheck -= dt;
    if (this.bubbleCheck <= 0) { this.bubbleCheck = 2; this.seedBubbles(); }
    // Filters plus a slow natural breakdown, so a tidy tank drifts back to clear
    // instead of pinning at maximum muck the first time the player over-feeds.
    const cleaning = d.filterRate + 0.008;
    if (game.state.dirt > 0) {
      game.state.dirt = Math.max(0, game.state.dirt - cleaning * dt);
    }
    if (d.breedRate > 0 && this.fish.length < d.fishCap && this.fish.length > 0) {
      this.breedAccum += d.breedRate * dt;
      if (this.breedAccum >= 1) {
        this.breedAccum = 0;
        const parent = this.fish[Math.floor(Math.random() * this.fish.length)];
        const child = this.spawnFish(parent.species);
        child.x = parent.x; child.y = parent.y;
        this.burst(parent.x, parent.y, 14, [1, 0.8, 0.9], 0.1);
        this.pushPopup(parent.x, parent.y + 0.4, "YAVRU!", "#ffb3d4", false);
        this.syncFish();
      }
    }
  }

  private publish(dt: number) {
    const game = this.game;
    this.earnWindow += dt;
    if (this.earnWindow >= 1) {
      const instant = this.earnAccum / this.earnWindow;
      game.live.cps = instant;
      this.earnAccum = 0;
      this.earnWindow = 0;
    }
    const tier = comboTierProgress(this.combo);
    game.live.combo = this.combo;
    game.live.comboMul = this.frenzyActive ? game.derived.frenzyPower : tier.mul;
    game.live.comboProgress = this.frenzyActive
      ? Math.max(0, (this.frenzyUntil - this.elapsed) / game.derived.frenzyLength)
      : Math.min(1, this.combo / FRENZY_AT);
    game.live.frenzy = this.frenzyActive ? 1 : 0;
    game.live.frenzyLeft = Math.max(0, this.frenzyUntil - this.elapsed);
    game.live.frenzyCooldown = Math.max(0, this.frenzyReadyAt - this.elapsed);
    game.live.pellets = this.pellets.length;
    game.live.pickups = this.pickups.length;
    game.live.fishAlive = this.fish.length;
    game.live.shockActive = this.shocks.length > 0;
    game.touch();
  }

  // ── Effects ────────────────────────────────────────────────────────────────
  burst(x: number, y: number, count: number, color: [number, number, number], size = 0.1) {
    if (this.particles.length > 900) return;
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(0.4, 2.6);
      this.particles.push({
        x, y, z: 2.3,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed + 0.5,
        life: rand(0.28, 0.85),
        maxLife: 0.85,
        size: size * rand(0.7, 1.5),
        color,
        kind: Math.random() < 0.4 ? "spark" : "dot",
        spin: rand(0, 6.28),
      });
    }
  }

  pushPopup(x: number, y: number, text: string, color: string, big: boolean) {
    if (this.popups.length > 26) this.popups.shift();
    const baseLife = big ? 1.6 : 1.05;
    const life = text.startsWith("+") ? baseLife * 0.5 : baseLife;
    this.popups.push({ x, y, text, color, life, big });
  }
}

function short(value: number): string {
  if (value < 1000) return value < 10 ? value.toFixed(1) : Math.round(value).toString();
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  const tier = Math.min(Math.floor(Math.log10(value) / 3), units.length);
  return (value / Math.pow(1000, tier)).toFixed(1) + units[tier - 1];
}
