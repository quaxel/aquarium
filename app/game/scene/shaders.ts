// Every GLSL program the tank renders with, in one place. The water, caustics,
// god rays and fish undulation are the shaders the ambient version of this
// project already had — the game layer is the pooled instancing added on top.

export const fishVertex = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uBeat;
  uniform float uEffort;
  uniform float uTurn;
  uniform vec2 uOffset;
  uniform vec2 uRepeat;
  varying vec2 vUv;
  varying vec2 vLocalUv;
  void main() {
    vLocalUv = uv;
    vUv = uOffset + uv * uRepeat;
    vec3 p = position;
    // Undulation travels head to tail and grows toward it, so the body throws the
    // tail rather than the whole sprite wobbling. The motion is authored as a
    // handful of pixel-art poses, then blended between adjacent poses so it keeps
    // its stepped character without visibly stuttering.
    float along = 1.0 - uv.x;
    const float POSE_RATE = 7.0;
    float pose = floor(uBeat * POSE_RATE) / POSE_RATE;
    float poseNext = pose + 1.0 / POSE_RATE;
    float poseBlend = smoothstep(0.12, 0.88, fract(uBeat * POSE_RATE));
    float waveA = sin(pose - along * 3.6);
    float waveB = sin(poseNext - along * 3.6);
    float wave = mix(waveA, waveB, poseBlend);
    p.y += wave * pow(along, 1.7) * 0.115 * uEffort;
    float bodyPulseA = cos(pose) * 0.016 * uEffort;
    float bodyPulseB = cos(poseNext) * 0.016 * uEffort;
    p.x += mix(bodyPulseA, bodyPulseB, poseBlend);
    float bobPose = floor((uTime * 1.6 + uPhase) * 6.0) / 6.0;
    float bobNext = bobPose + 1.0 / 6.0;
    float bobBlend = smoothstep(0.15, 0.85, fract((uTime * 1.6 + uPhase) * 6.0));
    p.y += mix(sin(bobPose), sin(bobNext), bobBlend) * 0.012;
    // Quick volume fake: bow the sprite around its centre as the fish turns,
    // giving the flat pixel plane a little depth without replacing the atlas.
    float across = uv.x * 2.0 - 1.0;
    float belly = 1.0 - across * across;
    float turnAmount = clamp(abs(uTurn), 0.0, 1.0);
    // Compress the silhouette while turning: the fish briefly presents its
    // shoulder instead of behaving like a full-width paper card.
    p.x *= 1.0 - turnAmount * 0.46;
    p.z += belly * uTurn * 0.72;
    p.x += across * abs(uTurn) * 0.055;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const fishFragment = `
  uniform sampler2D uMap;
  uniform float uFar;
  uniform float uFlash;
  uniform float uDirt;
  uniform float uGoldfish;
  uniform float uBlink;
  uniform vec2 uOffset;
  uniform vec2 uRepeat;
  uniform vec3 uWater;
  uniform vec3 uTint;
  uniform float uTurn;
  varying vec2 vUv;
  varying vec2 vLocalUv;
  void main() {
    vec2 sampleUv = vUv;
    if (uGoldfish > .5) {
      // Re-sample the detailed source as an 88x60 sprite. This is an exact 2:1
      // reduction of the atlas cell, so every logical texel stays a crisp,
      // evenly-spaced colour block when the fish grows or turns.
      vec2 pixelUv = (floor(vLocalUv * vec2(88.0, 60.0)) + .5) / vec2(88.0, 60.0);
      sampleUv = uOffset + pixelUv * uRepeat;
    }
    vec4 c = texture2D(uMap, sampleUv);

    if (uGoldfish > .5) {
      vec2 px = floor(vLocalUv * vec2(88.0, 60.0)) + .5;
      vec3 orangeDark = vec3(.48, .16, .025);

      // The atlas has one pose, so the face is animated as a few deliberate
      // palette swaps on that same low-resolution grid.
      if (uBlink > .01) {
        vec2 eye = (px - vec2(63.5, 26.5)) / vec2(7.7, 7.7);
        float eyeShape = dot(eye, eye);
        float openHalf = mix(1.0, .04, uBlink);
        if (eyeShape < 1.0 && abs(eye.y) > openHalf) {
          // Upper and lower lids move toward one another. A small vertical
          // palette shift keeps the closed eye part of the shaded face instead
          // of looking like a flat orange patch pasted over it.
          float shade = clamp((eye.y + 1.0) * .5, 0.0, 1.0);
          vec3 lid = mix(vec3(1.0, .55, .08), vec3(.88, .25, .025), shade);
          c = vec4(lid, 1.0);
        }
        if (uBlink > .9 && eyeShape < 1.0 && abs(eye.y) < .13) {
          float curve = abs(eye.x) * .11;
          if (abs(eye.y + curve) < .105) c = vec4(orangeDark, 1.0);
        }
      }

    }
    if (c.a < 0.06) discard;
    c.rgb *= uTint;
    // Water haze, held off until the fish is genuinely deep in the tank.
    float far = smoothstep(.5, 1.0, uFar);
    float grey = dot(c.rgb, vec3(.299, .587, .114));
    c.rgb = mix(c.rgb, vec3(grey), far * .18);
    c.rgb = mix(c.rgb, uWater, far * .32);
    c.rgb *= mix(1.02, .84, far);
    c.rgb = mix(c.rgb, c.rgb * vec3(.72, .88, .6), uDirt * .55);
    // A small pixel-clustered light/shadow pass sells the fake volume while the
    // fish is presenting its side during a turn.
    float turnAmount = clamp(abs(uTurn), 0.0, 1.0);
    float side = abs(vLocalUv.x * 2.0 - 1.0);
    float bevel = smoothstep(.18, .92, side) * turnAmount;
    c.rgb *= 1.0 - bevel * .3;
    c.rgb += vec3(.1, .065, .025) * (1.0 - side) * turnAmount;
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
export const SCENERY_FRAGMENT = `
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

export const propVertex = `
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

export const propFragment = `
  uniform sampler2D uMap;
  uniform float uBrightness;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.04) discard;
    gl_FragColor = vec4(c.rgb * vColor * uBrightness, c.a * vAlpha);
  }
`;

export const plantVertex = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uSway;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float tip = uv.y * uv.y;
    float current = sin(uTime * uSpeed + uPhase + uv.y * 1.35);
    float counter = sin(uTime * uSpeed * .57 + uPhase * 1.7) * .3;
    p.x += (current + counter) * tip * uSway;
    p.y += sin(uTime * uSpeed * .72 + uPhase) * tip * .018;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const plantFragment = `
  uniform sampler2D uMap;
  uniform vec2 uOffset;
  uniform vec2 uRepeat;
  uniform vec3 uTint;
  uniform vec3 uWater;
  uniform float uHue;
  uniform float uDirt;
  varying vec2 vUv;

  vec3 rotateHue(vec3 color, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat3 hue = mat3(
      0.213 + c * 0.787 - s * 0.213, 0.213 - c * 0.213 + s * 0.143, 0.213 - c * 0.213 - s * 0.787,
      0.715 - c * 0.715 - s * 0.715, 0.715 + c * 0.285 + s * 0.140, 0.715 - c * 0.715 + s * 0.715,
      0.072 - c * 0.072 + s * 0.928, 0.072 - c * 0.072 - s * 0.283, 0.072 + c * 0.928 + s * 0.072
    );
    return hue * color;
  }

  void main() {
    vec4 c = texture2D(uMap, uOffset + vUv * uRepeat);
    if (c.a < .08) discard;
    // The generated sprites already carry deep teal shadows. Lift the whole layer
    // so those shaded pixels stay readable after compositing through the water.
    vec3 plantColor = rotateHue(c.rgb * uTint, uHue);
    float luminance = dot(plantColor, vec3(.299, .587, .114));
    plantColor = mix(plantColor, vec3(luminance), .3);
    plantColor = mix(plantColor, uWater, .26);
    c.rgb = min(plantColor * 1.08 + vec3(.018, .035, .014), vec3(1.0));
    c.rgb = mix(c.rgb, c.rgb * vec3(.68, .82, .55), uDirt * .45);
    gl_FragColor = c;
  }
`;
