import * as THREE from "three";
import type { PropKey } from "../sprites";
import type { World } from "../world";
import { FOOD_COLORS } from "./constants";
import { propFragment, propVertex } from "./shaders";

export type Pool = {
  mesh: THREE.InstancedMesh;
  color: THREE.InstancedBufferAttribute;
  alpha: THREE.InstancedBufferAttribute;
  cell: THREE.InstancedBufferAttribute;
  capacity: number;
};

type PoolsConfig = {
  propTexture: THREE.Texture;
  coinTexture: THREE.Texture;
  propCols: number;
  propRows: number;
  propIndex: (key: PropKey) => number;
};

/**
 * The instanced pools for everything that is not a fish: pellets, pickups, coins,
 * particles and bubbles. Each is one InstancedMesh fed from the world arrays every
 * frame; the renderer never stores per-entity state for any of them.
 */
export class EntityPools {
  pellets!: Pool;
  pickups!: Pool;
  coins!: Pool;
  particles!: Pool;
  bubbles!: Pool;

  private dummy = new THREE.Object3D();
  private cfg: PoolsConfig;

  constructor(cfg: PoolsConfig) {
    this.cfg = cfg;
  }

  build(stage: THREE.Group) {
    this.pellets = this.makePool(this.cfg.propTexture, 512, false, 1);
    this.pickups = this.makePool(this.cfg.propTexture, 256, false, 1);
    this.coins = this.makePool(this.cfg.coinTexture, 256, false, 1, 7, 1, 1.65);
    this.particles = this.makePool(this.cfg.propTexture, 900, true, 1);
    this.bubbles = this.makePool(this.cfg.propTexture, 220, true, 1);
    stage.add(this.pellets.mesh, this.pickups.mesh, this.coins.mesh, this.bubbles.mesh, this.particles.mesh);
    // No renderOrder on the three "in the water" pools. An instanced mesh sorts as a
    // single object at its own position, so parking each pool at a representative
    // depth lets the fish weave in front of and behind the food and the coins —
    // forcing a renderOrder instead pastes all of it over every fish in the tank.
    this.pellets.mesh.position.z = 0.6;
    this.pickups.mesh.position.z = 0.85;
    this.coins.mesh.position.z = 0.85;
    this.bubbles.mesh.position.z = 1.5;
    this.particles.mesh.renderOrder = 20;
  }

  cellFor(key: PropKey): [number, number] {
    const index = this.cfg.propIndex(key);
    const col = index % this.cfg.propCols;
    const row = Math.floor(index / this.cfg.propCols);
    return [col / this.cfg.propCols, 1 - (row + 1) / this.cfg.propRows];
  }

  private makePool(
    texture: THREE.Texture,
    capacity: number,
    additive: boolean,
    size: number,
    cols = this.cfg.propCols,
    rows = this.cfg.propRows,
    brightness = 1,
  ): Pool {
    const geometry = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(size, size);
    geometry.index = plane.index;
    geometry.attributes.position = plane.attributes.position;
    geometry.attributes.uv = plane.attributes.uv;
    geometry.attributes.normal = plane.attributes.normal;

    const color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1);
    const cell = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    color.setUsage(THREE.DynamicDrawUsage);
    alpha.setUsage(THREE.DynamicDrawUsage);
    cell.setUsage(THREE.DynamicDrawUsage);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uCellSize: { value: new THREE.Vector2(1 / cols, 1 / rows) },
        uBrightness: { value: brightness },
      },
      vertexShader: propVertex,
      fragmentShader: propFragment,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    geometry.setAttribute("aColor", color);
    geometry.setAttribute("aAlpha", alpha);
    geometry.setAttribute("aCell", cell);
    // The plane is deliberately not disposed: its attribute buffers are now owned by
    // the instanced geometry above, and disposing would evict them from the cache.
    return { mesh, color, alpha, cell, capacity };
  }

  syncAll(world: World, elapsed: number, scale: number, autoCollect: number) {
    this.syncPellets(world, elapsed);
    this.syncPickups(world, autoCollect);
    this.syncParticles(world);
    this.syncBubbles(world, elapsed, scale);
  }

  private syncPellets(world: World, elapsed: number) {
    const pool = this.pellets;
    const [cu, cv] = this.cellFor("pellet");
    let n = 0;
    for (const p of world.pellets) {
      if (n >= pool.capacity) break;
      const food = FOOD_COLORS[p.food] ?? [1, 1, 1];
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.z = p.id * 0.7 + p.age * 1.4;
      const pulse = p.settled > 0 ? 0.82 : 1 + Math.sin(elapsed * 9 + p.id) * 0.06;
      this.dummy.scale.setScalar(0.1 * pulse);
      this.dummy.updateMatrix();
      pool.mesh.setMatrixAt(n, this.dummy.matrix);
      pool.color.setXYZ(n, food[0], food[1], food[2]);
      pool.alpha.setX(n, p.settled > 0 ? 0.6 : 1);
      pool.cell.setXY(n, cu, cv);
      n++;
    }
    this.commit(pool, n);
  }

  private syncPickups(world: World, autoCollect: number) {
    const pool = this.pickups;
    let n = 0;
    let coinN = 0;
    for (const p of world.pickups) {
      if (p.collected) continue;
      const fadeIn = Math.min(1, p.age * 8);
      const nearExpiry = Math.max(0, 1 - Math.max(0, p.age - (autoCollect - 0.6)) * 2);

      if (p.kind === "coin") {
        if (coinN >= this.coins.capacity) continue;
        // Horizontal foreshortening is authored directly into all seven frames;
        // runtime scaling and rotation stay neutral so the pixel art is never
        // distorted by a second, conflicting spin animation.
        const frame = Math.floor(p.spin * 2.2) % 7;
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.rotation.z = 0;
        const pop = Math.min(1, p.age * 6);
        this.dummy.scale.setScalar(0.2 * pop);
        this.dummy.updateMatrix();
        this.coins.mesh.setMatrixAt(coinN, this.dummy.matrix);
        this.coins.color.setXYZ(coinN, 1, 1, 1);
        this.coins.alpha.setX(coinN, fadeIn * (0.5 + nearExpiry * 0.5));
        this.coins.cell.setXY(coinN, frame / 7, 0);
        coinN++;
        continue;
      }

      if (n >= pool.capacity) continue;
      const [cu, cv] = this.cellFor(p.kind);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.z = Math.sin(p.spin) * 0.25;
      // Coins spin about their vertical axis by squashing in X — the cheap trick
      // that reads unmistakably as a spinning coin.
      const spin = Math.abs(Math.cos(p.spin));
      const pop = Math.min(1, p.age * 6);
      const size = (p.kind === "chest" ? 0.44 : 0.32) * pop;
      this.dummy.scale.set(size * (0.25 + spin * 0.75), size, 1);
      this.dummy.updateMatrix();
      pool.mesh.setMatrixAt(n, this.dummy.matrix);
      pool.color.setXYZ(n, 1, 1, 1);
      pool.alpha.setX(n, fadeIn * (0.5 + nearExpiry * 0.5));
      pool.cell.setXY(n, cu, cv);
      n++;
    }
    this.commit(pool, n);
    this.commit(this.coins, coinN);
  }

  private syncParticles(world: World) {
    const pool = this.particles;
    let n = 0;
    for (const p of world.particles) {
      if (n >= pool.capacity) break;
      const [cu, cv] = this.cellFor(p.kind === "spark" ? "spark" : "dot");
      const t = Math.max(0, p.life / p.maxLife);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.z = p.spin;
      this.dummy.scale.setScalar(p.size * (0.4 + t * 1.4));
      this.dummy.updateMatrix();
      pool.mesh.setMatrixAt(n, this.dummy.matrix);
      pool.color.setXYZ(n, p.color[0], p.color[1], p.color[2]);
      pool.alpha.setX(n, t);
      pool.cell.setXY(n, cu, cv);
      n++;
    }
    this.commit(pool, n);
  }

  private syncBubbles(world: World, elapsed: number, scale: number) {
    const pool = this.bubbles;
    const [cu, cv] = this.cellFor("dot");
    // The first tanks zoom the stage in to fill the glass. Keep that zoom from
    // enlarging air bubbles as aggressively as fish and scenery.
    const zoomCompensation = Math.min(1, 1 / scale);
    let n = 0;
    for (const b of world.bubbles) {
      if (n >= pool.capacity) break;
      this.dummy.position.set(b.x + Math.sin(elapsed * 1.5 + b.drift) * 0.06, b.y, b.z);
      this.dummy.rotation.z = 0;
      this.dummy.scale.setScalar(b.scale * (b.carry > 0 ? 0.34 : 0.16) * zoomCompensation);
      this.dummy.updateMatrix();
      pool.mesh.setMatrixAt(n, this.dummy.matrix);
      if (b.carry > 0) pool.color.setXYZ(n, 1, 0.85, 0.3);
      else pool.color.setXYZ(n, 0.7, 1, 0.98);
      pool.alpha.setX(n, b.carry > 0 ? 0.9 : 0.34);
      pool.cell.setXY(n, cu, cv);
      n++;
    }
    this.commit(pool, n);
  }

  private commit(pool: Pool, count: number) {
    pool.mesh.count = count;
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.color.needsUpdate = true;
    pool.alpha.needsUpdate = true;
    pool.cell.needsUpdate = true;
  }
}
