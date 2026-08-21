import * as THREE from "three";
import { DECOR_ORDER, SPECIES, SPECIES_ORDER, TANKS } from "../content";
import type { Game } from "../game";
import { buildPropAtlas, type PropKey } from "../sprites";
import type { DecorId, SpeciesId } from "../types";
import type { World } from "../world";
import { atlasSprite } from "./atlasSprite";
import { DECOR_REGIONS, DECOR_SLOTS, FISH_ATLAS, MID_SIZE, PLANT_ATLAS } from "./constants";
import { EntityPools } from "./pools";
import { fishFragment, fishVertex, plantFragment, plantVertex, SCENERY_FRAGMENT } from "./shaders";

// The renderer. It owns Three.js and nothing else: it reads the world's entity
// arrays every frame and never writes to them. Shaders live in ./shaders, the
// instanced entity pools in ./pools, and the static layout tables in ./constants.

type FishVisual = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  species: SpeciesId;
};

type PlantVisual = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  x: number;
  lift: number;
  size: number;
};

export class TankScene {
  private mount: HTMLElement;
  private world: World;
  private game: Game;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  /** Everything measured in tank units; scaled so a bigger tank reads as zoomed out. */
  private stage = new THREE.Group();
  private backdrop = new THREE.Group();
  private foreground = new THREE.Group();
  private plantGroup = new THREE.Group();
  private decorGroup = new THREE.Group();
  private fishGroup = new THREE.Group();

  private waterMaterial!: THREE.ShaderMaterial;
  private sceneryMaterial!: THREE.ShaderMaterial;
  private sceneryMesh!: THREE.Mesh;
  /** Painted backdrops keyed by path; `null` marks one that failed to load. */
  private backgroundCache = new Map<string, THREE.Texture | null>();
  private rayMaterial!: THREE.ShaderMaterial;
  private dirtMaterial!: THREE.MeshBasicMaterial;
  private frenzyMaterial!: THREE.MeshBasicMaterial;
  private background!: THREE.Mesh;
  private waterMesh!: THREE.Mesh;
  private rayMesh!: THREE.Mesh;
  private dirtMesh!: THREE.Mesh;
  private frenzyMesh!: THREE.Mesh;
  private causticSprites: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];

  private fishTexture!: THREE.Texture;
  private plantTexture!: THREE.Texture;
  private propTexture!: THREE.Texture;
  private coinTexture!: THREE.Texture;
  private propCols = 4;
  private propRows = 2;
  private fishRegions = new Map<SpeciesId, { x: number; y: number; w: number; h: number }>();
  private atlasSize = { w: 1, h: 1 };
  private propIndex: (key: PropKey) => number = () => 0;

  private pools!: EntityPools;
  private fishVisuals = new Map<number, FishVisual>();
  private plantVisuals: PlantVisual[] = [];
  private shocks: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private shadowPool: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];

  private decorMeshes = new Map<DecorId, THREE.Mesh>();
  private currentDecor = new Set<DecorId>();
  private currentTank = -1;

  private scale = 1;
  private viewHalfWidth = 9;
  private viewHalfHeight = 5;
  private elapsed = 0;
  private shake = 0;
  private waterColor = new THREE.Color();

  ready = false;

  constructor(mount: HTMLElement, world: World, game: Game) {
    this.mount = mount;
    this.world = world;
    this.game = game;

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    this.camera.position.set(0, 0, 14);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(this.renderer.domElement);

    this.scene.add(this.backdrop, this.stage, this.foreground);
    this.stage.add(this.plantGroup, this.decorGroup, this.fishGroup);

    this.buildTextures();
    this.buildBackdrop();
    this.buildPlantLayer();
    this.buildPools();
    this.resize();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  private buildTextures() {
    this.atlasSize = { w: FISH_ATLAS.w, h: FISH_ATLAS.h };
    SPECIES_ORDER.forEach((id, i) => {
      this.fishRegions.set(id, {
        x: (i % FISH_ATLAS.cols) * FISH_ATLAS.cellW,
        y: Math.floor(i / FISH_ATLAS.cols) * FISH_ATLAS.cellH,
        w: FISH_ATLAS.cellW,
        h: FISH_ATLAS.cellH,
      });
    });
    this.fishTexture = new THREE.TextureLoader().load("/assets/fish-species-atlas.png");
    this.fishTexture.colorSpace = THREE.SRGBColorSpace;
    this.fishTexture.magFilter = THREE.NearestFilter;
    this.fishTexture.minFilter = THREE.NearestFilter;
    this.fishTexture.generateMipmaps = false;

    this.plantTexture = new THREE.TextureLoader().load("/assets/bowl-plants-atlas-v2.png");
    this.plantTexture.colorSpace = THREE.SRGBColorSpace;
    this.plantTexture.magFilter = THREE.NearestFilter;
    this.plantTexture.minFilter = THREE.NearestFilter;
    this.plantTexture.generateMipmaps = false;

    const props = buildPropAtlas();
    this.propCols = props.cols;
    this.propRows = props.rows;
    this.propTexture = new THREE.CanvasTexture(props.canvas);
    this.propTexture.colorSpace = THREE.SRGBColorSpace;
    this.propTexture.magFilter = THREE.NearestFilter;
    this.propTexture.minFilter = THREE.LinearFilter;
    this.propTexture.generateMipmaps = true;

    this.coinTexture = new THREE.TextureLoader().load("/assets/coin-spin.png");
    this.coinTexture.colorSpace = THREE.SRGBColorSpace;
    this.coinTexture.magFilter = THREE.NearestFilter;
    this.coinTexture.minFilter = THREE.NearestFilter;
    this.coinTexture.generateMipmaps = false;
    this.propIndex = props.index;
  }

  private buildBackdrop() {
    let pending = 1;
    const done = () => { if (--pending <= 0) this.ready = true; };

    // Two layers, in this order:
    //   −6.0  the procedural environment, one per tank
    //   −5.9  an optional painted backdrop that covers it when the art exists
    // Painting is therefore additive: drop `tank-N-*.png` into /public/assets and
    // that tank switches over, with no code change and no broken tanks meanwhile.
    this.sceneryMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaterTop: { value: new THREE.Color(0.3, 0.85, 0.9) },
        uWaterBottom: { value: new THREE.Color(0.1, 0.5, 0.7) },
        uFloor: { value: new THREE.Color(0.8, 0.76, 0.55) },
        uInk: { value: new THREE.Color(0.1, 0.35, 0.55) },
        uGlow: { value: new THREE.Color(1, 0.9, 0.6) },
        uRidge: { value: new THREE.Vector4(0.2, 10, 0.2, 0.6) },
        uFeature: { value: new THREE.Vector4(0, 0, 0, 0) },
      },
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: SCENERY_FRAGMENT,
    });
    this.sceneryMesh = new THREE.Mesh(new THREE.PlaneGeometry(28.2, 15.9), this.sceneryMaterial);
    this.sceneryMesh.position.z = -6;
    this.backdrop.add(this.sceneryMesh);

    this.background = new THREE.Mesh(
      new THREE.PlaneGeometry(28.2, 15.9),
      new THREE.MeshBasicMaterial({ depthWrite: false, transparent: true, opacity: 0 }),
    );
    this.background.position.z = -5.9;
    this.background.visible = false;
    this.backdrop.add(this.background);

    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTint: { value: new THREE.Color(0.16, 0.62, 0.78) },
        uHeat: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uTint; uniform float uHeat; varying vec2 vUv;

        // Caustic web: bright lines along the zero crossings of two waves that warp
        // each other, so the cells drift and pinch like light through a rippled
        // surface. Sampled in floor space, one unit of q is one cell.
        float caustic(vec2 q, float t, float blur) {
          // Slow domain warp: the sample point drifts through a second wave field
          // before the web is evaluated, so cell sizes and line spacing vary and
          // the pattern reads as rippling light rather than a stamped grid.
          q += vec2(sin(q.y * .47 + t * .31) + sin(q.y * 1.31 - t * .17) * .35,
                    cos(q.x * .53 - t * .27) + sin(q.x * 1.13 + t * .21) * .35) * .8;
          float w1 = sin(q.x + t * 1.05 + sin(q.y * .8 + t * .9) * 1.15);
          float w2 = sin(q.y * 1.05 - t * .85 - sin(q.x * .9 - t * .7) * 1.15);
          float web = 1.0 - min(abs(w1), abs(w2));
          // Slow brightness drift: a low-frequency field lets some cells burn
          // brighter than others, so the web reads as uneven focused light.
          float glow = 1.0 + .32 * sin(q.x * .23 + t * .21) * sin(q.y * .19 - t * .17);
          return pow(clamp(web, 0.0, 1.0), mix(6.5, 2.4, blur)) * mix(1.0, .6, blur) * glow;
        }
        float posterize(float value) {
          return floor(clamp(value, 0.0, 1.0) * 8.0 + .5) / 8.0;
        }
        void main(){
          vec3 lightColor = mix(uTint * vec3(1.1, 1.6, 1.5), vec3(1.0, .72, .35), uHeat * .7);
          // A fixed low-resolution sampling grid keeps every caustic edge crisp
          // and stable regardless of the canvas resolution.
          const vec2 PIXEL_GRID = vec2(448.0, 252.0);
          vec2 pixelUv = (floor(vUv * PIXEL_GRID) + .5) / PIXEL_GRID;
          // Project each pixel onto the painted sand plane before sampling, so the
          // cells foreshorten with the floor instead of tiling flat up the screen.
          const float SAND_LINE = .356;
          float run = clamp(pixelUv.y / SAND_LINE, 0.0, 1.14);
          float depth = 1.0 / mix(1.0 / 10.0, 1.0 / 20.0, run);
          vec2 ground = vec2((pixelUv.x - .5) * depth * 1.44, depth) * 3.4;
          ground.y -= uTime * .3;
          float blur = smoothstep(.5, 1.1, run) * .6;
          float reach = (1.0 - .45 * smoothstep(.65, 1.05, run)) * (1.0 - smoothstep(1.0, 1.13, run));
          float pool = .58 + .42 * (1.0 - smoothstep(.08, .6, abs(pixelUv.x - .5)));

          // Offset red and blue by two low-res texels in opposite directions.
          // Sampling the caustic itself (rather than tinting one mask) creates the
          // little cyan/red fringes of chromatic aberration around bright cells.
          vec2 split = vec2(2.0, .75) / PIXEL_GRID;
          vec2 groundDx = vec2(split.x * depth * 1.44, split.y * depth) * 3.4;
          vec3 caustics;
          caustics.r = caustic(ground + groundDx, uTime, blur) * .9
                     + caustic((ground + groundDx) * vec2(.62, .74) + 11.3, -uTime * .73, blur) * .55;
          caustics.g = caustic(ground, uTime, blur) * .9
                     + caustic(ground * vec2(.62, .74) + 11.3, -uTime * .73, blur) * .55;
          caustics.b = caustic(ground - groundDx, uTime, blur) * .9
                     + caustic((ground - groundDx) * vec2(.62, .74) + 11.3, -uTime * .73, blur) * .55;
          caustics = vec3(posterize(caustics.r), posterize(caustics.g), posterize(caustics.b)) * reach * pool * .63;

          float surfaceMask = smoothstep(.86, .985, pixelUv.y);
          float wave = sin(pixelUv.x * 47.0 + uTime * 2.3) + sin(pixelUv.x * 81.0 - uTime * 1.65) * .55;
          float surface = pow(.5 + .5 * sin((pixelUv.y - .895) * 175.0 + wave * 2.2), 8.0) * surfaceMask;
          surface += pow(.5 + .5 * sin(pixelUv.x * 29.0 - uTime * 1.25 + pixelUv.y * 22.0), 10.0) * surfaceMask * .65;
          surface = posterize(surface);

          vec3 color = lightColor * caustics * (1.0 + uHeat * .6);
          color += lightColor * surface * .58;
          float alpha = clamp(max(caustics.r, max(caustics.g, caustics.b)) * .92 + surface * .72, 0.0, .96);
          gl_FragColor = vec4(color, alpha);
        }`,
    });
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(28, 15.75), this.waterMaterial);
    this.waterMesh.position.z = -5.5;
    this.backdrop.add(this.waterMesh);

    this.rayMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(0.3, 1, 0.93) }, uHeat: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uTint; uniform float uHeat; varying vec2 vUv;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(41.0, 289.0))) * 43758.5453);
        }
        float beam(vec2 uv, float source, float spread, float lean, float phase) {
          float down = 1.0 - uv.y;
          float speed = .19 + mod(phase, 1.7) * .075;
          float sway = sin(uTime * speed + phase) * .038 * down;
          sway += sin(uTime * speed * .57 + phase * 1.8) * .018 * down;
          float center = source + lean * down + sway;
          float widthPulse = .92 + .08 * sin(uTime * (speed * .8) + phase * 2.1);
          float width = mix(.025, spread * widthPulse, down);
          float edge = abs(uv.x - center) / width;

          // Keep the original painted, stepped cone, but use finer steps so it
          // reads as a light beam before it reads as pixel art.
          float body = 1.0 - smoothstep(.16, 1.0, edge);
          body = floor(body * 8.0) / 8.0;
          float reach = 1.0 - smoothstep(.5, .84, down);
          float pulse = .76 + .24 * sin(uTime * (.4 + speed * .35) + phase);
          return body * reach * pulse;
        }
        void main() {
          // This is finer than the original 160×90 grid, while retaining the
          // slight texture that makes the rays fit the rest of the aquarium.
          vec2 grid = vec2(224.0, 126.0);
          vec2 uv = (floor(vUv * grid) + .5) / grid;
          // Preserve the original fan angles, but vary source spacing, width,
          // brightness and phase so the left and right halves do not mirror.
          float beams = beam(uv,.285,.05,-.38,.2) * .9
                      + beam(uv,.36,.12,-.25,1.75) * 1.05
                      + beam(uv,.435,.067,-.12,4.1) * .82
                      + beam(uv,.505,.14,0.0,2.6) * 1.08
                      + beam(uv,.565,.085,.12,5.4) * .93
                      + beam(uv,.648,.098,.25,.85)
                      + beam(uv,.72,.06,.38,3.9) * .78;

          float down = 1.0 - uv.y;
          float topGlow = 1.0 - smoothstep(0.0, .22, down);
          vec2 cell = floor(uv * grid);
          float grain = .86 + hash(cell + floor(uTime * .7)) * .14;
          float strength = beams * grain * (.38 + topGlow * .13 + uHeat * .22);
          vec3 lightColor = mix(uTint, vec3(1.0), .7);
          gl_FragColor = vec4(lightColor * strength, min(.62, strength * .7));
        }`,
    });
    this.rayMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.2), this.rayMaterial);
    this.rayMesh.position.z = -5.3;
    this.backdrop.add(this.rayMesh);

    // Muck: a green wash that grows with the dirt level. It is the only negative
    // feedback in the game, so it has to be legible before it is expensive.
    this.dirtMaterial = new THREE.MeshBasicMaterial({ color: 0x3f5a1e, transparent: true, opacity: 0, depthWrite: false });
    this.dirtMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.2), this.dirtMaterial);
    this.dirtMesh.position.z = 4.2;
    this.foreground.add(this.dirtMesh);

    this.frenzyMaterial = new THREE.MeshBasicMaterial({
      color: 0xff9a1f, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.frenzyMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.2), this.frenzyMaterial);
    this.frenzyMesh.position.z = 4.4;
    this.foreground.add(this.frenzyMesh);

    const midBase = new THREE.TextureLoader().load("/assets/aquarium-mid-atlas-v3.png", (loaded) => {
      for (const t of (loaded.userData.atlasClones ?? []) as THREE.Texture[]) {
        t.image = loaded.image; t.needsUpdate = true;
      }
      done();
    });
    midBase.colorSpace = THREE.SRGBColorSpace;
    this.midBase = midBase;

    // The frontmost layer carries no foliage: the edge and floor plant clusters that
    // used to sit in front of the glass were cropping the swim box and hiding fish.
  }

  private midBase!: THREE.Texture;

  private buildPlantLayer() {
    const configs = [
      { x: -1.13, lift: -0.01, size: 0.7, angle: -0.11, variant: 3, phase: 1.7, speed: 0.66, sway: 0.075, mirror: false, hue: -0.58, tint: [0.9, 1.02, 0.95] },
      { x: -0.98, lift: 0.015, size: 1.22, angle: 0.015, variant: 0, phase: 0.3, speed: 0.72, sway: 0.08, mirror: false, hue: 0.2, tint: [0.94, 1.02, 0.96] },
      { x: -0.82, lift: -0.005, size: 0.88, angle: 0.075, variant: 4, phase: 2.1, speed: 0.92, sway: 0.1, mirror: true, hue: 0.42, tint: [0.92, 1.02, 0.94] },
      { x: -0.64, lift: 0.01, size: 1.04, angle: -0.065, variant: 2, phase: 4.7, speed: 0.64, sway: 0.075, mirror: false, hue: -0.3, tint: [0.95, 1.0, 0.98] },
      { x: -0.47, lift: -0.015, size: 0.63, angle: 0.09, variant: 1, phase: 1.4, speed: 0.78, sway: 0.085, mirror: true, hue: 0.34, tint: [0.9, 1.0, 0.94] },
      { x: -0.31, lift: 0.005, size: 0.47, angle: -0.045, variant: 5, phase: 5.5, speed: 0.58, sway: 0.065, mirror: false, hue: -0.47, tint: [0.94, 1.03, 0.92] },
      { x: 0.32, lift: -0.01, size: 0.57, angle: 0.065, variant: 5, phase: 3.3, speed: 0.67, sway: 0.065, mirror: true, hue: 0.26, tint: [0.94, 1.03, 0.92] },
      { x: 0.49, lift: 0.012, size: 0.8, angle: -0.085, variant: 1, phase: 0.8, speed: 0.7, sway: 0.085, mirror: false, hue: -0.18, tint: [0.9, 1.0, 0.94] },
      { x: 0.68, lift: -0.008, size: 0.72, angle: 0.035, variant: 3, phase: 4.0, speed: 0.84, sway: 0.075, mirror: true, hue: 0.52, tint: [0.95, 1.0, 0.98] },
      { x: 0.83, lift: 0.018, size: 1.18, angle: -0.025, variant: 4, phase: 2.8, speed: 0.6, sway: 0.1, mirror: false, hue: -0.4, tint: [0.92, 1.02, 0.94] },
      { x: 1.0, lift: -0.012, size: 0.94, angle: 0.08, variant: 0, phase: 5.9, speed: 0.76, sway: 0.08, mirror: true, hue: 0.16, tint: [0.94, 1.02, 0.96] },
      { x: 1.14, lift: 0.006, size: 0.66, angle: 0.13, variant: 3, phase: 4.9, speed: 0.69, sway: 0.075, mirror: true, hue: -0.52, tint: [0.9, 1.02, 0.95] },
    ] as const;

    for (const config of configs) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: config.phase },
          uSpeed: { value: config.speed },
          uSway: { value: config.sway },
          uDirt: { value: 0 },
          uMap: { value: this.plantTexture },
          uOffset: { value: new THREE.Vector2(
            (config.variant % PLANT_ATLAS.cols) / PLANT_ATLAS.cols,
            config.variant < PLANT_ATLAS.cols ? 0.5 : 0,
          ) },
          uRepeat: { value: new THREE.Vector2(1 / PLANT_ATLAS.cols, 1 / PLANT_ATLAS.rows) },
          uWater: { value: this.waterColor.clone() },
          uHue: { value: config.hue },
          uTint: { value: new THREE.Color(config.tint[0], config.tint[1], config.tint[2]) },
        },
        vertexShader: plantVertex,
        fragmentShader: plantFragment,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5, 4, 10), material);
      const plantScale = config.size * 1.3;
      mesh.scale.set(config.mirror ? -plantScale : plantScale, plantScale, 1);
      mesh.rotation.z = config.angle;
      mesh.position.z = -1.2 + this.plantVisuals.length * 0.006;
      mesh.frustumCulled = false;
      this.plantGroup.add(mesh);
      this.plantVisuals.push({ mesh, x: config.x, lift: config.lift, size: config.size });
    }
  }

  private placePlants() {
    const b = this.world.bounds;
    // The painted sand line is screen-locked while the simulation bounds change
    // with aspect ratio. Anchor the visible roots in projected screen space so
    // resizing cannot make the plants float above (or sink below) the backdrop.
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    for (const plant of this.plantVisuals) {
      plant.mesh.position.x = plant.x * b.halfWidth;
      // The bowl's rear sand ridge curves downward toward both glass edges.
      // Match that ellipse instead of placing every root on one horizontal line.
      const edgeCurve = 0.12 * Math.pow(Math.abs(plant.x), 1.7);
      const rootNdcY = -0.4 - edgeCurve;
      const worldZ = plant.mesh.position.z * this.scale;
      const halfHeightAtPlant = tanHalfFov * (this.camera.position.z - worldZ);
      const rootY = rootNdcY * halfHeightAtPlant / this.scale;
      // Imagegen left about 11% transparent padding below each sprite; 0.58 is
      // the measured centre-to-visible-root distance after that padding.
      plant.mesh.position.y = rootY + plant.lift + plant.size * 0.58;
    }
  }

  private buildPools() {
    this.pools = new EntityPools({
      propTexture: this.propTexture,
      coinTexture: this.coinTexture,
      propCols: this.propCols,
      propRows: this.propRows,
      propIndex: this.propIndex,
    });
    this.pools.build(this.stage);

    const ringGeometry = new THREE.RingGeometry(0.85, 1, 36);
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color: 0xbdfcff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      mesh.visible = false;
      mesh.renderOrder = 22;
      this.stage.add(mesh);
      this.shocks.push(mesh);
    }

    // Pixel-clustered oval matching the tank backdrop: hard cells and stepped
    // values keep the shadow grounded without introducing a smooth blurred layer.
    const shadowGeometry = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 110; i++) {
      const material = new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          varying vec2 vUv; uniform float uOpacity;
          void main(){
            vec2 grid = vec2(32.0, 16.0);
            vec2 cell = (floor(vUv * grid) + .5) / grid;
            float d = length((cell - .5) * 2.0);
            if (d >= 1.0) discard;

            // Three solid pixel-art value bands instead of a soft falloff.
            float band = d < .42 ? .72 : (d < .72 ? .46 : .24);
            vec2 pixel = floor(vUv * grid);
            float checker = mod(pixel.x + pixel.y, 2.0);
            if (d > .72 && checker > .5) discard;

            vec3 color = d < .42 ? vec3(.025, .16, .19) : vec3(.035, .22, .23);
            gl_FragColor = vec4(color, band * uOpacity);
          }`,
      });
      const mesh = new THREE.Mesh(shadowGeometry, material);
      mesh.visible = false;
      this.stage.add(mesh);
      this.shadowPool.push(mesh);
    }
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  resize() {
    const w = this.mount.clientWidth || 1;
    const h = this.mount.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * this.camera.position.z;
    this.viewHalfHeight = visibleHeight * 0.5;
    this.viewHalfWidth = this.viewHalfHeight * aspect;

    const cover = (mesh: THREE.Mesh, planeW: number, planeH: number) => {
      const distance = Math.abs(this.camera.position.z - mesh.position.z);
      const vh = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * distance;
      const vw = vh * aspect;
      mesh.scale.setScalar(Math.max(vw / planeW, vh / planeH) * 1.04);
    };
    cover(this.background, 28.2, 15.9);
    cover(this.sceneryMesh, 28.2, 15.9);
    cover(this.waterMesh, 28, 15.75);
    cover(this.rayMesh, 18, 10.2);
    cover(this.dirtMesh, 18, 10.2);
    cover(this.frenzyMesh, 18, 10.2);

    this.applyTank();
  }

  /**
   * The swim box always occupies the same rectangle of screen, and the tank's own
   * half-width sets the world scale. A bigger tank therefore reads as zoomed out:
   * the same glass now holds far more, smaller fish. That is the physical growth the
   * design asks for, without the fish ever swimming off-screen.
   */
  private applyTank() {
    const tank = TANKS[Math.min(this.game.state.tankIndex, TANKS.length - 1)];
    const usableHalfWidth = this.viewHalfWidth - 0.45;
    this.scale = THREE.MathUtils.clamp(usableHalfWidth / tank.halfWidth, 0.42, 2.6);
    this.stage.scale.setScalar(this.scale);

    this.world.bounds.halfWidth = usableHalfWidth / this.scale;
    this.world.bounds.top = (this.viewHalfHeight - 0.75) / this.scale;
    this.world.bounds.bottom = (-this.viewHalfHeight + 1.55) / this.scale;

    this.waterColor.setRGB(tank.tint[0], tank.tint[1], tank.tint[2]);
    (this.waterMaterial.uniforms.uTint.value as THREE.Color).copy(this.waterColor);
    (this.rayMaterial.uniforms.uTint.value as THREE.Color).copy(this.waterColor).multiplyScalar(1.5);
    for (const sprite of this.causticSprites) {
      (sprite.material.uniforms.uWater.value as THREE.Color).copy(this.waterColor);
    }
    for (const plant of this.plantVisuals) {
      (plant.mesh.material.uniforms.uWater.value as THREE.Color).copy(this.waterColor);
    }

    const s = tank.scenery;
    const u = this.sceneryMaterial.uniforms;
    (u.uWaterTop.value as THREE.Color).setRGB(...s.waterTop);
    (u.uWaterBottom.value as THREE.Color).setRGB(...s.waterBottom);
    (u.uFloor.value as THREE.Color).setRGB(...s.floor);
    (u.uInk.value as THREE.Color).setRGB(...s.ink);
    (u.uGlow.value as THREE.Color).setRGB(...s.glow);
    (u.uRidge.value as THREE.Vector4).fromArray(s.ridge);
    (u.uFeature.value as THREE.Vector4).fromArray(s.features);
    this.applyBackground(tank.background);
    this.plantGroup.visible = tank.index === 0;
    this.placePlants();

    this.currentTank = this.game.state.tankIndex;
    this.syncDecor(true);
  }

  /**
   * Shows the tank's painted backdrop if the file exists, and quietly stays on the
   * procedural one if it does not. Missing art is a normal state here, not an
   * error: the eight images are meant to arrive one at a time.
   */
  private applyBackground(path: string | undefined) {
    const material = this.background.material as THREE.MeshBasicMaterial;
    if (!path) {
      this.background.visible = false;
      return;
    }
    const cached = this.backgroundCache.get(path);
    if (cached !== undefined) {
      material.map = cached;
      material.opacity = cached ? 1 : 0;
      material.needsUpdate = true;
      this.background.visible = cached !== null;
      return;
    }
    this.background.visible = false;
    new THREE.TextureLoader().load(
      path,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        this.backgroundCache.set(path, texture);
        // The player may have moved on while this was in flight.
        if (TANKS[this.game.state.tankIndex]?.background === path) this.applyBackground(path);
      },
      undefined,
      () => { this.backgroundCache.set(path, null); },
    );
  }

  private syncDecor(force = false) {
    const owned = new Set(this.game.state.decor);
    if (!force) {
      let same = owned.size === this.currentDecor.size;
      if (same) for (const id of owned) if (!this.currentDecor.has(id)) { same = false; break; }
      if (same) return;
    }
    this.currentDecor = owned;
    for (const id of DECOR_ORDER) {
      const has = owned.has(id);
      let mesh = this.decorMeshes.get(id);
      if (has && !mesh) {
        const slot = DECOR_SLOTS[id];
        mesh = atlasSprite(this.midBase, DECOR_REGIONS[id], MID_SIZE, 2.4 * slot.scale, slot.z);
        this.decorMeshes.set(id, mesh);
        this.decorGroup.add(mesh);
        this.causticSprites.push(mesh as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>);
        (mesh.material as THREE.ShaderMaterial).uniforms.uWater.value = this.waterColor.clone();
      }
      if (mesh) mesh.visible = has;
    }
    this.placeDecor();
  }

  private placeDecor() {
    const b = this.world.bounds;
    for (const [id, mesh] of this.decorMeshes) {
      const slot = DECOR_SLOTS[id];
      const height = (mesh.geometry as THREE.PlaneGeometry).parameters.height;
      mesh.position.set(slot.x * b.halfWidth, b.bottom - 0.35 + height * 0.5 * 0.85, slot.z);
    }
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  render(dt: number) {
    this.elapsed += dt;
    const world = this.world;
    const game = this.game;

    if (this.currentTank !== game.state.tankIndex) this.applyTank();
    this.syncDecor();

    const heat = world.intensity;
    this.sceneryMaterial.uniforms.uTime.value = this.elapsed;
    this.waterMaterial.uniforms.uTime.value = this.elapsed;
    this.waterMaterial.uniforms.uHeat.value = heat;
    this.rayMaterial.uniforms.uTime.value = this.elapsed;
    this.rayMaterial.uniforms.uHeat.value = heat;
    for (const plant of this.plantVisuals) {
      plant.mesh.material.uniforms.uTime.value = this.elapsed;
      plant.mesh.material.uniforms.uDirt.value = game.state.dirt;
    }
    this.dirtMaterial.opacity = game.state.dirt * 0.42;
    this.frenzyMaterial.opacity = heat * 0.1 + world.frenzyFlash * 0.18;
    for (const sprite of this.causticSprites) {
      sprite.material.uniforms.uTime.value = this.elapsed;
      sprite.material.uniforms.uDirt.value = game.state.dirt;
    }
    this.syncFish(dt);
    this.pools.syncAll(world, this.elapsed, this.scale, game.derived.autoCollect);
    this.syncShocks();

    // Camera shake rides the combo: move the viewpoint so the whole tank rattles
    // together instead of making the stage (and especially the plants) look like
    // it is being shaken independently.
    const shakeTarget = heat * 0.034 + world.frenzyFlash * 0.036;
    this.shake += (shakeTarget - this.shake) * Math.min(1, dt * 6);
    this.stage.position.x = 0;
    this.stage.position.y = 0;
    this.foreground.position.x = 0;
    this.foreground.position.y = 0;
    this.camera.position.x = Math.sin(this.elapsed * 37) * this.shake;
    this.camera.position.y = Math.cos(this.elapsed * 31) * this.shake * 0.7;

    if (this.ready) this.renderer.render(this.scene, this.camera);
  }

  private makeFishMesh(species: SpeciesId): FishVisual {
    const region = this.fishRegions.get(species)!;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: Math.random() * 6.28 },
        uBeat: { value: 0 },
        uEffort: { value: 0.6 },
        uTurn: { value: 0 },
        uFar: { value: 0.4 },
        uFlash: { value: 0 },
        uDirt: { value: 0 },
        uGoldfish: { value: species === "goldfish" ? 1 : 0 },
        uBlink: { value: 0 },
        uWater: { value: this.waterColor.clone() },
        uTint: { value: new THREE.Color(1, 1, 1) },
        uMap: { value: this.fishTexture },
        uOffset: { value: new THREE.Vector2(region.x / this.atlasSize.w, 1 - (region.y + region.h) / this.atlasSize.h) },
        uRepeat: { value: new THREE.Vector2(region.w / this.atlasSize.w, region.h / this.atlasSize.h) },
      },
      vertexShader: fishVertex,
      fragmentShader: fishFragment,
      transparent: true,
      depthWrite: false,
    });
    const aspect = region.h / region.w;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, aspect, 20, 6), material);
    mesh.frustumCulled = false;
    this.fishGroup.add(mesh);
    return { mesh, species };
  }

  private syncFish(dt: number) {
    const world = this.world;
    const dirt = this.game.state.dirt;
    const seen = new Set<number>();
    let shadowIndex = 0;

    for (const f of world.fish) {
      seen.add(f.id);
      let visual = this.fishVisuals.get(f.id);
      if (!visual) {
        visual = this.makeFishMesh(f.species);
        this.fishVisuals.set(f.id, visual);
      }
      const { mesh } = visual;
      const def = SPECIES[f.species];
      const fade = f.dying > 0 ? Math.max(0, f.dying / 0.35) : 1;
      // Keep every fish on one visual plane. With a perspective camera, changing
      // z alone also changes the on-screen size even when mesh scale is constant.
      mesh.position.set(f.x, f.y, 0);
      // Depth still controls layering and haze, but must not change a fish's
      // apparent size while it swims through the tank.
      const visualScale = f.size * (def.visualScale ?? 1) * fade;
      const targetX = f.facing * visualScale;
      mesh.scale.x += (targetX - mesh.scale.x) * Math.min(1, dt * 9);
      mesh.scale.y = visualScale * (1 + Math.sin(this.elapsed * 3 + f.phase) * 0.014);
      // Nose follows the swim direction; mirrored fish need the pitch mirrored too.
      const pitch = Math.sin(f.heading) * 0.42 * f.facing;
      mesh.rotation.z += (pitch - mesh.rotation.z) * Math.min(1, dt * 6.2);

      const u = mesh.material.uniforms;
      u.uTime.value = this.elapsed;
      u.uBeat.value = f.beat;
      u.uEffort.value = 0.3 + Math.min(f.thrust, 1.2) * 0.95;
      const turnDelta = targetX - mesh.scale.x;
      u.uTurn.value = THREE.MathUtils.clamp(turnDelta / Math.max(visualScale, 0.001) * 2.4, -1, 1);
      u.uFar.value = 0;
      u.uFlash.value = f.flash;
      u.uDirt.value = dirt;
      if (f.species === "goldfish") {
        const blink = (this.elapsed + f.phase * 1.37) % 1.8;
        // Three discrete frames make the lids meet and separate cleanly while
        // preserving the deliberately stepped pixel-art motion.
        u.uBlink.value = blink < 0.07 ? 0.55 : blink < 0.19 ? 1 : blink < 0.27 ? 0.55 : 0;
      }
      (u.uWater.value as THREE.Color).copy(this.waterColor);
      const tint = u.uTint.value as THREE.Color;
      if (f.variant) {
        // Rainbow mutants cycle hue so they are findable in a crowded tank.
        tint.setHSL((this.elapsed * 0.12 + f.phase) % 1, 0.75, 0.72);
      } else if (this.elapsed < f.rageUntil) {
        tint.setRGB(1.4, 0.8, 0.6);
      } else if (f.boostMul > 1) {
        tint.setRGB(0.9, 1.35, 0.8);
      } else {
        tint.setRGB(1, 1, 1);
      }

      // A soft blob on the sand under every fish; it is what stops them looking
      // like stickers floating in front of the background.
      if (!def.floorDweller && shadowIndex < this.shadowPool.length) {
        const shadow = this.shadowPool[shadowIndex++];
        const height = THREE.MathUtils.clamp((f.y - world.bounds.bottom) / 4, 0, 1);
        shadow.visible = true;
        shadow.position.set(f.x + f.vx * 0.1, world.bounds.bottom - 0.42, -1.25);
        const spread = f.size * (1.5 + height * 0.7);
        shadow.scale.set(spread, spread * 0.45, 1);
        shadow.material.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.5, 0.1, height) * fade;
      }
    }

    for (const [id, visual] of this.fishVisuals) {
      if (seen.has(id)) continue;
      this.fishGroup.remove(visual.mesh);
      visual.mesh.geometry.dispose();
      visual.mesh.material.dispose();
      this.fishVisuals.delete(id);
    }
    for (let i = shadowIndex; i < this.shadowPool.length; i++) this.shadowPool[i].visible = false;
  }

  private syncShocks() {
    this.world.shocks.forEach((shock, i) => {
      if (i >= this.shocks.length) return;
      const mesh = this.shocks[i];
      mesh.visible = true;
      mesh.position.set(shock.x, shock.y, 2.6);
      mesh.scale.setScalar(shock.r);
      mesh.material.opacity = Math.max(0, shock.life) * 0.8;
    });
    for (let i = this.world.shocks.length; i < this.shocks.length; i++) this.shocks[i].visible = false;
  }

  // ── Coordinates ────────────────────────────────────────────────────────────
  /** Client pixels → tank coordinates on the plane the food lives on. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width - 0.5;
    const ny = 0.5 - (clientY - rect.top) / rect.height;
    return {
      x: (nx * this.viewHalfWidth * 2 - this.stage.position.x) / this.scale,
      y: (ny * this.viewHalfHeight * 2 - this.stage.position.y) / this.scale,
    };
  }

  /** Tank coordinates → percentage position inside the canvas, for DOM overlays. */
  worldToScreen(x: number, y: number): { left: number; top: number } {
    const sx = x * this.scale + this.stage.position.x;
    const sy = y * this.scale + this.stage.position.y;
    return {
      left: (sx / (this.viewHalfWidth * 2) + 0.5) * 100,
      top: (0.5 - sy / (this.viewHalfHeight * 2)) * 100,
    };
  }

  dispose() {
    for (const [, visual] of this.fishVisuals) {
      visual.mesh.geometry.dispose();
      visual.mesh.material.dispose();
    }
    this.fishVisuals.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.mount) {
      this.mount.removeChild(this.renderer.domElement);
    }
  }
}
