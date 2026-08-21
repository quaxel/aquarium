import * as THREE from "three";

/** A flat sprite cut from a larger atlas, with the caustic/atmosphere pass. */
export function atlasSprite(
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
        // Same trick as the water layer: a slow domain warp before the texel lock
        // breaks the wave grid into uneven, drifting cells.
        p+=vec2(sin(p.y*1.1+t*.6)+sin(p.y*.53-t*.31)*.7,
                cos(p.x*.9-t*.5)+sin(p.x*.47+t*.27)*.7)*.55;
        p=(floor(p*24.)+.5)/24.;
        float a=sin(p.x*2.1+t*1.18+sin(p.y*1.7-t*.72));
        float b=sin(p.y*2.45-t*.96+sin(p.x*1.45+t*.51));
        float light=pow(1.-clamp(abs(a+b)*.5,0.,1.),5.2);
        light*=1.0+.32*sin(p.x*.31+t*.27)*sin(p.y*.27-t*.23);
        return floor(light*8.+.5)/8.;
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
        vec2 p=vWorld*vec2(4.6,4.0);
        vec2 split=vec2(.075,.025);
        float lightR=(caustic(p+split,uTime)*.72
                     +caustic(vWorld.yx*vec2(5.3,4.3)+.37+split,-uTime*.71)*.38);
        float lightG=(caustic(p,uTime)*.72
                     +caustic(vWorld.yx*vec2(5.3,4.3)+.37,-uTime*.71)*.38);
        float lightB=(caustic(p-split,uTime)*.72
                     +caustic(vWorld.yx*vec2(5.3,4.3)+.37-split,-uTime*.71)*.38);
        vec3 light=vec3(lightR,lightG,lightB)*mix(.55,1.0,uNear);
        c.rgb=c.rgb*(.97+light*.18)+uWater*light*.3;
        c.rgb = mix(c.rgb, c.rgb*vec3(.74,.9,.62), uDirt*.5);
        gl_FragColor=c;
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (r.h / r.w)), material);
  mesh.position.z = z;
  return mesh;
}
