'use strict';
// ---- local indirect light from a field, after Pixel Aleste's irradiance field: a map of the world seen from above that every lit
//      material reads. Where there is mass overhead or beside (here: the forest), the sky's fill is blocked at its foot; where that
//      mass faces the sun, it hands coloured light back to what stands next to it. On top of that, a few hot spots (blasts) light
//      their surroundings for as long as they burn. One small texture for the whole island, built once; no tracing at run time. ----
const LightField = (() => {
  const C = CFG.light, N = 260, CELL = 4, HOT = [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)], hotT = [0, 0];
  G.U.uLfTex = { value: null }; G.U.uLfFrame = { value: new THREE.Vector4(0, 0, 1, 0) }; G.U.uLfBounce = { value: new THREE.Vector3() }; G.U.uLfHot = { value: HOT };
  THREE.ShaderChunk.fog_pars_fragment += `
#ifdef USE_FOG
uniform sampler2D uLfTex; uniform vec4 uLfFrame; uniform vec4 uLfHot[2]; uniform vec3 uLfBounce;
vec3 lfLight(vec3 irr, vec3 wp){
  vec3 hot = vec3(0.); for (int i = 0; i < 2; i++) { vec3 d = wp - uLfHot[i].xyz; hot += vec3(1., .42, .12) * uLfHot[i].w / (1. + dot(d, d) * .03); }
  vec2 uv = (wp.xz - uLfFrame.xy) * uLfFrame.z; if (uLfFrame.w < .5 || any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return irr + hot;
  vec4 c = texture2D(uLfTex, uv); float top = c.b * 400., low = 1. - smoothstep(top - 6., top + 5., wp.y);
  vec2 g = c.ga * 2. - 1.; float face = max(dot(-g, normalize(uSunDir.xz + 1e-4)), 0.);
  return irr * (1. - ${C.occlusion.toFixed(2)} * c.r * low) + uLfBounce * face * low + hot; }
#endif`;
  THREE.ShaderChunk.lights_fragment_begin += '\n#if defined( RE_IndirectDiffuse ) && defined( USE_FOG )\n irradiance = lfLight(irradiance, vFogW);\n#endif\n';

  function build() { const x0 = Island.IC.x - N * CELL / 2, z0 = Island.IC.z - N * CELL / 2, den = new Float32Array(N * N), top = new Float32Array(N * N), tmp = new Float32Array(N * N);
    // how much canopy stands over each 4 m cell, and how high it reaches
    for (const c of Island.FOREST.list) for (const L of c.t) for (const t of L) { const cx = Math.floor((t[0] - x0) / CELL), cz = Math.floor((t[2] - z0) / CELL), h = t[1] + 20 * t[5];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const i = cx + a, j = cz + b; if (i < 0 || j < 0 || i >= N || j >= N) continue; const k = j * N + i; den[k] += a || b ? .16 : .5; if (h > top[k]) top[k] = h; } }
    for (let pass = 0; pass < 2; pass++) { for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; tmp[k] = (den[k] * 2 + den[k - 1] + den[k + 1] + den[k - N] + den[k + N]) / 6; } den.set(tmp); }
    const px = new Uint8Array(N * N * 4); let cells = 0;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i, d = clamp(den[k]), gx = clamp((den[k + 1] - den[k - 1]) * 2.2, -1, 1), gz = clamp((den[k + N] - den[k - N]) * 2.2, -1, 1); if (d > .05) cells++;
      px[k * 4] = d * 255; px[k * 4 + 1] = (gx * .5 + .5) * 255; px[k * 4 + 2] = clamp(Math.max(top[k], top[k - 1], top[k + 1], top[k - N], top[k + N]) / 400) * 255; px[k * 4 + 3] = (gz * .5 + .5) * 255; }
    for (let k = 0; k < N * N; k++) if (px[k * 4 + 1] === 0 && px[k * 4 + 3] === 0) { px[k * 4 + 1] = 127; px[k * 4 + 3] = 127; }
    const tex = new THREE.DataTexture(px, N, N, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    G.U.uLfTex.value = tex; G.U.uLfFrame.value.set(x0, z0, 1 / (N * CELL), Q.has('nofield') ? 0 : 1); G.info.lightField = { cells };
    G.tick.push((t, dt) => { const s = G.sun, w = typeof Weather !== 'undefined' ? Weather.S.cover : 0, k = s.intensity * C.bounce;      // the canopy's colour, or the snow on it, times the sun
      G.U.uLfBounce.value.set(s.color.r * lerp(.1, .8, w), s.color.g * lerp(.15, .84, w), s.color.b * lerp(.05, .9, w)).multiplyScalar(k);
      for (let i = 0; i < 2; i++) if (HOT[i].w > 0) { hotT[i] += dt; HOT[i].w = Math.max(0, HOT[i].w - dt * HOT[i].w * 4 - dt * 2); } }); }
  // a hot spot: something burning at a place, lighting what is near it until it fades
  function hot(x, y, z, power) { const i = HOT[0].w <= HOT[1].w ? 0 : 1; HOT[i].set(x, y, z, power); hotT[i] = 0; }
  return { build, hot };
})();
