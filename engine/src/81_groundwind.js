'use strict';
// Loose mineral dust lifts from dry gravel shoulders and worn trails. Each source
// follows a short downwind transect sampled from the same ground used by the tyres.
const GroundWind = (() => {
  const cellSize = 40, range = LOW ? 53 : 70, capacity = LOW ? 20 : 38, layers = LOW ? 2 : 3;
  const cells = new Map(), nearby = [], random = rng(97163);
  const flow = new THREE.Vector2(CFG.weather.windDir[0], CFG.weather.windDir[2]).normalize();
  const lastEye = new THREE.Vector3(Infinity, Infinity, Infinity);
  let mesh, origin, heights, variation, uniforms;

  function addSource(x, z, strength) {
    const px = 12 + random() * 5, ground = [];
    for (let i = 0; i < 4; i++) {
      const d = px * i / 3;
      const h = Island.surf(x + flow.x * d, z + flow.y * d)[0];
      if (h < CFG.sea.level + .85 || (i && Math.abs(h - ground[i - 1]) > px / 3 * .44)) return;
      ground.push(h);
    }
    const key = Math.floor(x / cellSize) + ',' + Math.floor(z / cellSize);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ x, z, ground, length: px, strength, seed: random() * 87.3, distance: 0 });
  }

  function seedTracks(line, isRoad) {
    for (let i = 2; i < line.n - 1; i += Math.floor((isRoad ? 8 : 14) + random() * 9)) {
      const dx = line.px[i + 1] - line.px[i - 1], dz = line.pz[i + 1] - line.pz[i - 1];
      const side = (random() < .5 ? -1 : 1) * (isRoad ? 3.7 + random() * .65 : .18 + random() * .55);
      const step = side / (Math.hypot(dx, dz) || 1);
      addSource(line.px[i] + dz * step, line.pz[i] - dx * step, isRoad ? .80 + random() * .20 : .55 + random() * .36);
    }
  }

  function select(eye) {
    lastEye.copy(eye); nearby.length = 0;
    for (let x = Math.floor((eye.x - range) / cellSize); x <= Math.floor((eye.x + range) / cellSize); x++) {
      for (let z = Math.floor((eye.z - range) / cellSize); z <= Math.floor((eye.z + range) / cellSize); z++) {
        const group = cells.get(x + ',' + z);
        if (!group) continue;
        for (const s of group) {
          s.distance = Math.hypot(s.x - eye.x, s.ground[0] - eye.y, s.z - eye.z);
          if (s.distance < range) nearby.push(s);
        }
      }
    }
    nearby.sort((a, b) => a.distance - b.distance);
    let n = 0;
    for (const s of nearby.slice(0, capacity)) {
      for (let layer = 0; layer < layers; layer++, n++) {
        origin.setXY(n, s.x, s.z); heights.setXYZW(n, ...s.ground);
        variation.setXYZW(n, s.length, s.seed, s.strength, layer / layers);
      }
    }
    mesh.geometry.instanceCount = n;
    origin.needsUpdate = heights.needsUpdate = variation.needsUpdate = true;
  }

  function build(scene) {
    seedTracks(Island.RD, true); seedTracks(Island.T, false);
    const geom = new THREE.InstancedBufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([-1,0,0, 1,0,0, -1,1,0, 1,1,0], 3));
    geom.setIndex([0, 1, 2, 2, 1, 3]);
    const make = n => new THREE.InstancedBufferAttribute(new Float32Array(n * capacity * layers), n).setUsage(THREE.DynamicDrawUsage);
    origin = make(2); heights = make(4); variation = make(4);
    geom.setAttribute('aOrigin', origin); geom.setAttribute('aGround', heights); geom.setAttribute('aVariation', variation);
    geom.instanceCount = 0;
    uniforms = {
      uTime: G.uTime, uFlow: { value: flow }, uDrift: G.uWind, uLift: { value: 0 },
      uSun: Sky.U.uSkySun, uSunColor: G.U.uSunK, uHorizon: Sky.U.uHor,
      uCanopy: G.U.uLfTex, uField: G.U.uLfFrame
    };
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: false,
      vertexShader: `
attribute vec2 aOrigin; attribute vec4 aGround, aVariation;
uniform float uTime, uDrift, uLift; uniform vec2 uFlow;
uniform vec3 uSun, uSunColor, uHorizon;
uniform sampler2D uCanopy; uniform vec4 uField;
varying vec2 vP; varying vec3 vLight, vRim; varying float vDensity, vSeed;
void main() {
  float seed = aVariation.y, layer = aVariation.w;
  float phase = fract(seed + layer + uDrift * (.105 + .04 * fract(seed * 13.)));
  float progress = phase * (1.05 - .05 * phase);
  float track = min(2.999, progress * 3.);
  float h = track < 1. ? mix(aGround.x, aGround.y, track) :
            track < 2. ? mix(aGround.y, aGround.z, track - 1.) : mix(aGround.z, aGround.w, track - 2.);
  vec2 xz = aOrigin + uFlow * progress * aVariation.x;
  xz += vec2(-uFlow.y, uFlow.x) * (.17 + .38 * phase) * sin(seed * 11. + layer * 15. + phase * 5.);
  vec3 center = vec3(xz.x, h, xz.y), eye = center - cameraPosition;
  vec2 eyeRight = normalize(vec2(viewMatrix[0][0], viewMatrix[2][0]) + 1e-7);
  float alignment = dot(eyeRight, uFlow);
  float gust = .5 + .5 * sin(uTime * .49 + seed * 3.7 + sin(seed + uTime * .32));
  float halfWidth = (.62 + 2.15 * abs(alignment)) * (.64 + .98 * phase);
  float rise = (.42 + .97 * phase) * (.72 + .4 * gust);
  center.xz += eyeRight * position.x * halfWidth;
  center.y += .035 + .16 * phase + position.y * rise;
  gl_Position = projectionMatrix * viewMatrix * vec4(center, 1.);
  vP = vec2(position.x * (alignment < 0. ? -1. : 1.), position.y);
  vSeed = seed + layer * 7.;
  vec2 uv = (aOrigin - uField.xy) * uField.z;
  float cover = texture2D(uCanopy, clamp(uv, 0., 1.)).r;
  float backlit = pow(max(0., dot(normalize(eye), uSun)), 3.) * smoothstep(-.03, .15, uSun.y);
  vec3 soil = vec3(.48, .345, .205);
  vLight = soil * (.63 * uHorizon + (.39 + .42 * backlit) * uSunColor * (1. - .64 * cover));
  vRim = vec3(1., .78, .50) * uSunColor * (.14 + .70 * backlit) * (1. - cover);
  float distanceFade = (1. - smoothstep(${(range - 23).toFixed(1)}, ${(range - 6).toFixed(1)}, length(eye))) * smoothstep(.8, 2.2, length(eye));
  vDensity = uLift * aVariation.z * (.24 + .76 * gust) * (1. - .69 * cover) *
             smoothstep(0., .14, phase) * (1. - smoothstep(.54, 1., phase)) * distanceFade;
}`,
      fragmentShader: GLSL_NOISE + `
uniform float uTime; varying vec2 vP; varying vec3 vLight, vRim; varying float vDensity, vSeed;
void main(){
  vec2 p = vP;
  vec2 q = vec2(p.x * 2.1 - uTime * .16, p.y * 3.6) + vec2(vSeed * 3.4, vSeed);
  float broad = vnoise(q), fine = vnoise(q * 2.8 + vec2(broad * 2., -uTime * .14));
  float strands = vnoise(q * vec2(2.1, 4.8) + vec2(fine * 2.4, broad));
  float wake = .29 + (broad - .45) * .33 + (fine - .5) * .12 + p.x * .07;
  float vertical = (p.y - wake) / (.13 + .18 * broad + .07 * fine);
  float radial = p.x * p.x * 1.12 + vertical * vertical;
  float body = (1. - smoothstep(.10, 1.22, radial)) * smoothstep(.29, .76, .45 * broad + .35 * fine + .20 * strands);
  float alpha = .55 * vDensity * body * smoothstep(.0, .16, p.y);
  if (alpha < .004) discard;
  gl_FragColor = vec4(vLight + vRim * smoothstep(.22,.81,p.y + fine * .19), alpha);
}`
    });
    mesh = new THREE.Mesh(geom, material); mesh.name = 'groundWind';
    mesh.frustumCulled = false; mesh.renderOrder = 19; scene.add(mesh);
    G.tick.push(() => {
      const w = Weather.S;
      const damp = Math.max(w.wet, w.cover, w.ice, w.rain, w.snowing);
      const lift = (1 - sm(.08, .49, damp)) * sm(1.75, 5.5, w.speed);
      mesh.visible = G.look.air && lift > .01;
      if (!mesh.visible) return;
      if (lastEye.distanceToSquared(G.camera.position) > 6.25) select(G.camera.position);
      uniforms.uLift.value = lift;
      mesh.visible = mesh.geometry.instanceCount > 0;
    });
  }
  return { build };
})();
