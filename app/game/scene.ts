import * as THREE from "three";
import { DECOR_ORDER, SPECIES, SPECIES_ORDER, TANKS } from "./content";
import type { Game } from "./game";
import { buildPropAtlas, type PropKey } from "./sprites";
import type { World } from "./world";
import type { DecorId, SpeciesId } from "./types";

// The renderer. It owns Three.js and nothing else: it reads the world's entity
// arrays every frame and never writes to them. The water, caustics, god rays and
// fish undulation are the shaders the ambient version of this project already had —
// the game layer is the pooled instancing added on top.

const MID_SIZE = { w: 1536, h: 1024 };
const FISH_ATLAS = { w: 704, h: 480, cellW: 176, cellH: 120, cols: 4 };

const DECOR_REGIONS: Record<DecorId, { x: number; y: number; w: number; h: number }> = {
  anemone: { x: 520, y: 525, w: 430, h: 390 },
  coral: { x: 45, y: 565, w: 430, h: 330 },
  wreck: { x: 985, y: 175, w: 465, h: 315 },
  helmet: { x: 42, y: 85, w: 420, h: 410 },
  amphora: { x: 990, y: 585, w: 465, h: 320 },
  chest: { x: 485, y: 180, w: 445, h: 315 },
};

/** Where each decoration sits, as a fraction of the swim box. */
const DECOR_SLOTS: Record<DecorId, { x: number; y: number; scale: number; z: number }> = {
  anemone: { x: -0.62, y: 0.06, scale: 0.9, z: -1.1 },
  coral: { x: 0.58, y: 0.02, scale: 0.85, z: -0.9 },
  wreck: { x: -0.18, y: 0.02, scale: 1.25, z: -1.6 },
  helmet: { x: 0.86, y: 0.05, scale: 0.8, z: -0.7 },
  amphora: { x: -0.88, y: 0.02, scale: 0.7, z: 0.3 },
  chest: { x: 0.2, y: 0.01, scale: 0.9, z: 0.45 },
};

const fishVertex = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uBeat;
  uniform float uEffort;
  uniform vec2 uOffset;
  uniform vec2 uRepeat;
  varying vec2 vUv;
  void main() {
    vUv = uOffset + uv * uRepeat;
    vec3 p = position;
    // Undulation travels head to tail and grows toward it, so the body throws the
    // tail rather than the whole sprite wobbling.
    float along = 1.0 - uv.x;
    float wave = sin(uBeat - along * 3.6);
    p.y += wave * pow(along, 1.7) * 0.115 * uEffort;
    p.x += cos(uBeat) * 0.016 * uEffort;
    p.y += sin(uTime * 1.6 + uPhase) * 0.012;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fishFragment = `
  uniform sampler2D uMap;
  uniform float uFar;
  uniform float uFlash;
  uniform float uDirt;
  uniform vec3 uWater;
  uniform vec3 uTint;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.06) discard;
    c.rgb *= uTint;
    // Water haze, held off until the fish is genuinely deep in the tank.
    float far = smoothstep(.5, 1.0, uFar);
    float grey = dot(c.rgb, vec3(.299, .587, .114));
    c.rgb = mix(c.rgb, vec3(grey), far * .18);
    c.rgb = mix(c.rgb, uWater, far * .32);
    c.rgb *= mix(1.02, .84, far);
    c.rgb = mix(c.rgb, c.rgb * vec3(.72, .88, .6), uDirt * .55);
    // A bite flashes the whole body white for a beat — the feedback that tells you
    // which fish just earned you something.
    c.rgb = mix(c.rgb, vec3(1.0), uFlash * .7);
    gl_FragColor = c;
  }
`;

/**
 * The procedural environment behind the water.
 *
 * It speaks the painted backdrop's language deliberately: flat colour, no outlines,
 * a two-stop water gradient, a pool of light on the sand and silhouette shapes
 * standing on the horizon in a single ink tone. Everything that differs between the
 * eight tanks is a uniform, so the whole chain is one shader and one data table.
 *
 * HORIZON matches the water shader's SAND_LINE, which is what keeps the caustics
 * landing on the same floor this layer draws.
 */
const SCENERY_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uWaterTop, uWaterBottom, uFloor, uInk, uGlow;
  uniform vec4 uRidge;    // height, frequency, jaggedness, edge bias
  uniform vec4 uFeature;  // arch, stars, planet, vents
  varying vec2 vUv;

  const float HORIZON = 0.356;
  // The quad is 28.2 × 15.9, so one unit of u covers 1.77× the world a unit of v
  // does. Anything meant to be round has to be measured in this corrected space.
  const float AR = 1.77;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.0, 289.0))) * 43758.5453); }

  void main() {
    float x = vUv.x, y = vUv.y;

    // ── Open water above, lit sand below ────────────────────────────────────
    // One soft light pool straddling the horizon lifts both the water and the sand,
    // which is the painted backdrop's actual structure — not a gradient per band.
    // Grading them separately leaves a dark seam along the sand line.
    float pool = 1.0 - smoothstep(0.06, 0.78, length(vec2((x - 0.5) * 1.12, (y - 0.24))));
    float up = clamp((y - HORIZON) / (1.0 - HORIZON), 0.0, 1.0);

    vec3 water = mix(uWaterBottom, uWaterTop, pow(up, 0.6));
    water = mix(water, water * 1.22 + uGlow * 0.1, pool * 0.45);

    vec3 sand = mix(uFloor * 0.6, uFloor, pool);
    sand += uGlow * pool * pool * 0.32;
    // Broad soft mottling instead of a hash grid, which reads as square blocks.
    sand *= 1.0 + sin(x * 21.0 + sin(y * 15.0) * 1.6) * sin(y * 17.0) * 0.025;

    vec3 col = mix(sand, water, smoothstep(HORIZON - 0.02, HORIZON + 0.02, y));

    // ── Stars, only in the open water. Drawn before the planet so its disc
    //    occludes them rather than being speckled through.
    if (uFeature.y > 0.0) {
      vec2 g = vec2(x * AR * 55.0, y * 55.0);
      vec2 id = floor(g);
      float s = hash(id);
      if (s > 0.968) {
        vec2 c = id + 0.5 + (vec2(hash(id + 1.3), hash(id + 3.7)) - 0.5) * 0.7;
        float twinkle = 0.45 + 0.55 * sin(uTime * 1.3 + s * 60.0);
        col += vec3(smoothstep(0.34, 0.0, length(g - c))) * twinkle * uFeature.y
             * smoothstep(HORIZON, HORIZON + 0.12, y);
      }
    }

    // ── Planet limb ──────────────────────────────────────────────────────────
    if (uFeature.z > 0.0) {
      vec2 pc = vec2(0.82, 1.02);
      float d = length((vec2(x, y) - pc) * vec2(AR, 1.0));
      // Lit from the left, so the limb curves away into shadow on the right.
      float lit = smoothstep(0.46, 0.04, d + (x - pc.x) * AR * 0.5);
      vec3 planet = mix(uGlow * 0.22, uGlow * 1.15, lit);
      col = mix(col, planet, smoothstep(0.46, 0.44, d) * uFeature.z);
    }

    // ── Tunnel mouth: solid ink outside a big rounded opening ────────────────
    if (uFeature.x > 0.0) {
      float r = length(vec2((x - 0.5) * 1.02, (y - HORIZON) * 0.66));
      col = mix(col, uInk, smoothstep(0.46, 0.485, r) * uFeature.x);
    }

    // ── The horizon ridge ────────────────────────────────────────────────────
    // One shape function covers the whole chain: a triangle wave shaped either into
    // domes (coral) or spikes (kelp, rock, pipework) by the jaggedness term, with a
    // per-cell height so the line never looks stamped.
    // Two rows, the far one drawn first: a single row of shapes on a flat horizon
    // reads as a comb, and the second row behind it is what turns the line into a
    // place. Jaggedness both sharpens and *narrows* the shape — a wide triangle
    // reads as a mountain, a narrow one as a plant.
    float bias = mix(1.0, pow(clamp(abs(x - 0.5) * 2.0, 0.0, 1.0), 3.0), uRidge.w);
    for (int pass = 0; pass < 2; pass++) {
      float back = 1.0 - float(pass);
      float freq = uRidge.y * mix(1.0, 0.63, back);
      float u = x * freq + back * 0.37;
      float t = abs(fract(u) * 2.0 - 1.0);
      float dome = sqrt(max(0.0, 1.0 - t * t));
      float blade = pow(max(0.0, 1.0 - t), mix(1.0, 4.5, uRidge.z));
      float shape = mix(dome, blade, uRidge.z);
      float rnd = hash(vec2(floor(u), 7.0 + back * 13.0));
      float h = HORIZON + uRidge.x * bias * mix(1.0, 0.6, back) * (0.45 + 0.55 * rnd) * shape;
      // Bounded below by the horizon as well as above by the shape: filling the slab
      // from the sand upwards turns separate plants into one dark band.
      float m = smoothstep(h, h - 0.006, y) * smoothstep(HORIZON - 0.03, HORIZON + 0.01, y);
      col = mix(col, mix(uInk, water, 0.12 + back * 0.3), m);
    }

    // ── Lamps and vents sitting on the horizon ───────────────────────────────
    if (uFeature.w > 0.0) {
      float c = floor(x * 13.0);
      float r1 = hash(vec2(c, 21.0));
      vec2 p = vec2((c + 0.5 + (r1 - 0.5) * 0.5) / 13.0, HORIZON + 0.015 + r1 * 0.03);
      float d = length((vec2(x, y) - p) * vec2(AR, 1.0));
      float pulse = 0.5 + 0.5 * sin(uTime * 1.5 + r1 * 30.0);
      col += uGlow * smoothstep(0.05, 0.0, d) * step(0.5, r1) * pulse * uFeature.w;
    }

    // Corner falloff, the same vignette the painted backdrop has.
    col *= 1.0 - smoothstep(0.45, 1.0, length(vec2((x - 0.5) * 1.15, (y - 0.5) * 0.95))) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const propVertex = `
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute vec2 aCell;
  uniform vec2 uCellSize;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vUv = aCell + uv * uCellSize;
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const propFragment = `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.04) discard;
    gl_FragColor = vec4(c.rgb * vColor, c.a * vAlpha);
  }
`;

function atlasSprite(
  base: THREE.Texture,
  r: { x: number; y: number; w: number; h: number },
  atlas: { w: number; h: number },
  width: number,
  z: number,
) {
  const texture = base.clone();
  const clones = (base.userData.atlasClones ??= []) as THREE.Texture[];
  clones.push(texture);
  texture.repeat.set(r.w / atlas.w, r.h / atlas.h);
  texture.offset.set(r.x / atlas.w, 1 - (r.y + r.h) / atlas.h);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uWater: { value: new THREE.Color(0.16, 0.6, 0.78) },
      uDirt: { value: 0 },
      uNear: { value: THREE.MathUtils.smoothstep(z, -2.4, 1.2) },
      uOffset: { value: new THREE.Vector2(r.x / atlas.w, 1 - (r.y + r.h) / atlas.h) },
      uRepeat: { value: new THREE.Vector2(r.w / atlas.w, r.h / atlas.h) },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform vec2 uOffset; uniform vec2 uRepeat;
      varying vec2 vUv; varying vec2 vWorld;
      void main(){
        vUv=uOffset+uv*uRepeat;
        vec4 world=modelMatrix*vec4(position,1.);
        vWorld=world.xy;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime; uniform float uNear;
      uniform vec3 uWater; uniform float uDirt;
      varying vec2 vUv; varying vec2 vWorld;
      float caustic(vec2 p,float t){
        float a=sin(p.x*2.1+t*1.18+sin(p.y*1.7-t*.72));
        float b=sin(p.y*2.45-t*.96+sin(p.x*1.45+t*.51));
        return pow(1.-clamp(abs(a+b)*.5,0.,1.),5.2);
      }
      void main(){
        vec4 c=texture2D(uMap,vUv);
        if(c.a<.035) discard;
        // Atmospheric perspective: distance eats contrast and pulls colour toward
        // the tank blue, so the layers read as depth rather than stacked cut-outs.
        float far = 1.0 - uNear;
        float sunk = 1.0 - smoothstep(-3.6, 1.6, vWorld.y);
        float grey = dot(c.rgb, vec3(.299, .587, .114));
        c.rgb = mix(c.rgb, vec3(grey), far * .12);
        c.rgb = mix(c.rgb, uWater, far * .26 + sunk * far * .06);
        c.rgb *= mix(.91, 1.03, uNear) * (1.0 - sunk * .05);
        float light=(caustic(vWorld*vec2(2.35,2.05),uTime)*.72
                    +caustic(vWorld.yx*vec2(2.7,2.2)+.37,-uTime*.71)*.38)
                   *mix(.55,1.0,uNear);
        c.rgb=c.rgb*(.97+light*.17)+uWater*light*.3;
        c.rgb = mix(c.rgb, c.rgb*vec3(.74,.9,.62), uDirt*.5);
        gl_FragColor=c;
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (r.h / r.w)), material);
  mesh.position.z = z;
  return mesh;
}

type FishVisual = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  species: SpeciesId;
};

type Pool = {
  mesh: THREE.InstancedMesh;
  color: THREE.InstancedBufferAttribute;
  alpha: THREE.InstancedBufferAttribute;
  cell: THREE.InstancedBufferAttribute;
  capacity: number;
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
  private propTexture!: THREE.Texture;
  private propCols = 4;
  private propRows = 2;
  private fishRegions = new Map<SpeciesId, { x: number; y: number; w: number; h: number }>();
  private atlasSize = { w: 1, h: 1 };

  private fishVisuals = new Map<number, FishVisual>();
  private pellets!: Pool;
  private pickups!: Pool;
  private particles!: Pool;
  private bubbles!: Pool;
  private shocks: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private shadowPool: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];

  private dummy = new THREE.Object3D();
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
    this.stage.add(this.decorGroup, this.fishGroup);

    this.buildTextures();
    this.buildBackdrop();
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

    const props = buildPropAtlas();
    this.propCols = props.cols;
    this.propRows = props.rows;
    this.propTexture = new THREE.CanvasTexture(props.canvas);
    this.propTexture.colorSpace = THREE.SRGBColorSpace;
    this.propTexture.magFilter = THREE.NearestFilter;
    this.propTexture.minFilter = THREE.LinearFilter;
    this.propTexture.generateMipmaps = true;
    this.propIndex = props.index;
  }

  private propIndex: (key: PropKey) => number = () => 0;

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
          float w1 = sin(q.x + t * 1.05 + sin(q.y * .8 + t * .9) * 1.15);
          float w2 = sin(q.y * 1.05 - t * .85 - sin(q.x * .9 - t * .7) * 1.15);
          float web = 1.0 - min(abs(w1), abs(w2));
          return pow(clamp(web, 0.0, 1.0), mix(6.5, 2.4, blur)) * mix(1.0, .6, blur);
        }
        void main(){
          vec3 lightColor = mix(uTint * vec3(1.1, 1.6, 1.5), vec3(1.0, .72, .35), uHeat * .7);
          // Project each pixel onto the painted sand plane before sampling, so the
          // cells foreshorten with the floor instead of tiling flat up the screen.
          const float SAND_LINE = .356;
          float run = clamp(vUv.y / SAND_LINE, 0.0, 1.14);
          float depth = 1.0 / mix(1.0 / 10.0, 1.0 / 20.0, run);
          vec2 ground = vec2((vUv.x - .5) * depth * 1.44, depth) * 1.75;
          ground.y -= uTime * .3;
          float blur = smoothstep(.5, 1.1, run) * .6;
          float reach = (1.0 - .45 * smoothstep(.65, 1.05, run)) * (1.0 - smoothstep(1.0, 1.13, run));
          float pool = .58 + .42 * (1.0 - smoothstep(.08, .6, abs(vUv.x - .5)));
          float caustics = (caustic(ground, uTime, blur) * .9
                          + caustic(ground * vec2(.62, .74) + 11.3, -uTime * .73, blur) * .55)
                          * reach * pool * .62;
          float wall = caustic(vec2(vUv.x * 12.0, (vUv.y - SAND_LINE) * 22.0) + 3.1, uTime * .8, .55);
          caustics += wall * smoothstep(.34, .44, vUv.y) * (1.0 - smoothstep(.48, .76, vUv.y)) * pool * .2;

          float surfaceMask = smoothstep(.86, .985, vUv.y);
          float wave = sin(vUv.x * 47.0 + uTime * 2.3) + sin(vUv.x * 81.0 - uTime * 1.65) * .55;
          float surface = pow(.5 + .5 * sin((vUv.y - .895) * 175.0 + wave * 2.2), 8.0) * surfaceMask;
          surface += pow(.5 + .5 * sin(vUv.x * 29.0 - uTime * 1.25 + vUv.y * 22.0), 10.0) * surfaceMask * .65;

          vec3 color = lightColor * caustics * (1.0 + uHeat * .6);
          color += lightColor * surface * .58;
          float alpha = clamp(caustics * .92 + surface * .72, 0.0, .96);
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
        float ray(float origin, float width, float slope, float phase) {
          float center = origin + (1.0 - vUv.y) * slope + sin(uTime * .31 + phase + vUv.y * 2.4) * .018;
          float body = 1.0 - smoothstep(width * .2, width, abs(vUv.x - center));
          float core = 1.0 - smoothstep(0.0, width * .24, abs(vUv.x - center));
          return body * .6 + core * .28;
        }
        void main() {
          float beams = ray(.2,.165,.2,.2) + ray(.5,.135,-.12,2.1) + ray(.79,.15,-.16,4.5);
          float depthFade = smoothstep(.04,.5,vUv.y) * (1.0 - smoothstep(.985,1.0,vUv.y));
          float shimmer = .72 + .18 * sin(uTime * .58 + vUv.y * 8.0) + .1 * sin(uTime * 1.13 + vUv.x * 13.0);
          float strength = beams * depthFade * shimmer * (.26 + uHeat * .5);
          gl_FragColor = vec4(uTint * strength, strength * .68);
        }`,
    });
    this.rayMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.2), this.rayMaterial);
    this.rayMesh.position.z = 3.4;
    this.rayMesh.renderOrder = 30;
    this.foreground.add(this.rayMesh);

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

  private makePool(texture: THREE.Texture, capacity: number, additive: boolean, size: number): Pool {
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
        uCellSize: { value: new THREE.Vector2(1 / this.propCols, 1 / this.propRows) },
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

  private buildPools() {
    this.pellets = this.makePool(this.propTexture, 512, false, 1);
    this.pickups = this.makePool(this.propTexture, 256, false, 1);
    this.particles = this.makePool(this.propTexture, 900, true, 1);
    this.bubbles = this.makePool(this.propTexture, 220, true, 1);
    this.stage.add(this.pellets.mesh, this.pickups.mesh, this.bubbles.mesh, this.particles.mesh);
    // No renderOrder on the three "in the water" pools. An instanced mesh sorts as a
    // single object at its own position, so parking each pool at a representative
    // depth lets the fish weave in front of and behind the food and the coins —
    // forcing a renderOrder instead pastes all of it over every fish in the tank.
    this.pellets.mesh.position.z = 0.6;
    this.pickups.mesh.position.z = 0.85;
    this.bubbles.mesh.position.z = 1.5;
    this.particles.mesh.renderOrder = 20;

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

    // Soft elliptical falloff rather than a plane: a hard-edged rectangle on the
    // sand reads as a bug, not a shadow.
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
            float d = length((vUv - .5) * 2.0);
            float a = (1.0 - smoothstep(.25, 1.0, d)) * uOpacity;
            if (a < .004) discard;
            gl_FragColor = vec4(.016, .07, .12, a);
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
    this.dirtMaterial.opacity = game.state.dirt * 0.42;
    this.frenzyMaterial.opacity = heat * 0.1 + world.frenzyFlash * 0.18;
    for (const sprite of this.causticSprites) {
      sprite.material.uniforms.uTime.value = this.elapsed;
      sprite.material.uniforms.uDirt.value = game.state.dirt;
    }
    this.syncFish(dt);
    this.syncPellets();
    this.syncPickups();
    this.syncParticles();
    this.syncBubbles();
    this.syncShocks();

    // Camera shake rides the combo: at frenzy the whole tank is visibly rattling.
    const shakeTarget = heat * 0.034 + world.frenzyFlash * 0.036;
    this.shake += (shakeTarget - this.shake) * Math.min(1, dt * 6);
    this.stage.position.x = Math.sin(this.elapsed * 37) * this.shake;
    this.stage.position.y = Math.cos(this.elapsed * 31) * this.shake * 0.7;
    this.foreground.position.x = this.stage.position.x * 0.6;
    this.foreground.position.y = this.stage.position.y * 0.6;

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
        uFar: { value: 0.4 },
        uFlash: { value: 0 },
        uDirt: { value: 0 },
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
      mesh.position.set(f.x, f.y, -1.3 + f.depth * 4.3);
      const depthScale = (0.78 + f.depth * 0.32) * f.size * fade;
      const targetX = f.facing * depthScale;
      mesh.scale.x += (targetX - mesh.scale.x) * Math.min(1, dt * 9);
      mesh.scale.y = depthScale * (1 + Math.sin(this.elapsed * 3 + f.phase) * 0.014);
      // Nose follows the swim direction; mirrored fish need the pitch mirrored too.
      const pitch = Math.sin(f.heading) * 0.42 * f.facing;
      mesh.rotation.z += (pitch - mesh.rotation.z) * Math.min(1, dt * 3.4);

      const u = mesh.material.uniforms;
      u.uTime.value = this.elapsed;
      u.uBeat.value = f.beat;
      u.uEffort.value = 0.3 + Math.min(f.thrust, 1.2) * 0.95;
      u.uFar.value = 1 - f.depth;
      u.uFlash.value = f.flash;
      u.uDirt.value = dirt;
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

  private cellFor(key: PropKey): [number, number] {
    const index = this.propIndex(key);
    const col = index % this.propCols;
    const row = Math.floor(index / this.propCols);
    return [col / this.propCols, 1 - (row + 1) / this.propRows];
  }

  private syncPellets() {
    const pool = this.pellets;
    const [cu, cv] = this.cellFor("pellet");
    let n = 0;
    for (const p of this.world.pellets) {
      if (n >= pool.capacity) break;
      const food = FOOD_COLORS[p.food] ?? [1, 1, 1];
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.z = p.id * 0.7 + p.age * 1.4;
      const pulse = p.settled > 0 ? 0.82 : 1 + Math.sin(this.elapsed * 9 + p.id) * 0.06;
      this.dummy.scale.setScalar(0.2 * pulse);
      this.dummy.updateMatrix();
      pool.mesh.setMatrixAt(n, this.dummy.matrix);
      pool.color.setXYZ(n, food[0], food[1], food[2]);
      pool.alpha.setX(n, p.settled > 0 ? 0.6 : 1);
      pool.cell.setXY(n, cu, cv);
      n++;
    }
    this.commit(pool, n);
  }

  private syncPickups() {
    const pool = this.pickups;
    let n = 0;
    for (const p of this.world.pickups) {
      if (n >= pool.capacity) break;
      if (p.collected) continue;
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
      const fadeIn = Math.min(1, p.age * 8);
      const nearExpiry = Math.max(0, 1 - Math.max(0, p.age - (this.game.derived.autoCollect - 0.6)) * 2);
      pool.alpha.setX(n, fadeIn * (0.5 + nearExpiry * 0.5));
      pool.cell.setXY(n, cu, cv);
      n++;
    }
    this.commit(pool, n);
  }

  private syncParticles() {
    const pool = this.particles;
    let n = 0;
    for (const p of this.world.particles) {
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

  private syncBubbles() {
    const pool = this.bubbles;
    const [cu, cv] = this.cellFor("dot");
    let n = 0;
    for (const b of this.world.bubbles) {
      if (n >= pool.capacity) break;
      this.dummy.position.set(b.x + Math.sin(this.elapsed * 1.5 + b.drift) * 0.06, b.y, b.z);
      this.dummy.rotation.z = 0;
      this.dummy.scale.setScalar(b.scale * (b.carry > 0 ? 0.34 : 0.16));
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

  private commit(pool: Pool, count: number) {
    pool.mesh.count = count;
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.color.needsUpdate = true;
    pool.alpha.needsUpdate = true;
    pool.cell.needsUpdate = true;
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

const FOOD_COLORS: Record<string, [number, number, number]> = {
  flake: [0.79, 0.54, 0.27],
  shrimpPellet: [1, 0.48, 0.36],
  worm: [0.88, 0.42, 0.63],
  starFood: [1, 0.85, 0.24],
  explosive: [1, 0.34, 0.13],
  rainbow: [0.56, 0.94, 1],
  mutant: [0.62, 1, 0.24],
  krill: [1, 0.84, 0],
};
