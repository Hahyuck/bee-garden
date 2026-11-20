'use strict';
// ---- weather as one state the whole world reads: air temperature, wind, rain, falling snow, snow lying on the ground, ice, wetness.
//      The sky, the storm and the rain belong to the engine's own clock; this module adds what follows from them and from the cold:
//      snow builds up on what faces the sky and melts when it warms, wet ground freezes, the wind carries the flakes and pushes loose
//      bodies (Phys), tyres lose their grip (Drive), and the ground's colour feeds the light that bounces off it.
//      Every patched material gets uWx = (snow cover, ice, wetness, wind 0..1) and may call wxCover(). Keys 5-9 choose the weather. ----
const GLSL_WX = /* glsl */`
#ifndef CL_WX
#define CL_WX
uniform vec4 uWx;
// how much snow lies at a place: it settles first on what faces the sky, in patches, and closes over as the cover grows
float wxCover(vec3 wp, float ny){ float n = vnoise(wp.xz * .9) * .55 + vnoise(wp.xz * .13) * .45; return smoothstep(0., .22, uWx.x * 1.35 - (1. - ny) * 1.1 - .3 * n); }
#endif
`;
G.uWx = { value: new THREE.Vector4(0, 0, 0, 0) };
const Weather = (() => {
  const C = CFG.weather, NAME = { auto: '자동', clear: '맑음', rain: '비', snow: '눈', frost: '혹한' };
  const S = { mode: C.start, temp: C.tempMild, rain: 0, snowing: 0, cover: 0, ice: 0, wet: 0, storm: 0, wind: new THREE.Vector3(), speed: 0 };
  const _d = new THREE.Vector3(), _a = new THREE.Color(), _b = new THREE.Color(); let flakes = null, FU = null, chip = null, chipT = 0;
  { const q = Q.get('weather'); if (q && NAME[q]) S.mode = q; }

  function set(mode) { if (!NAME[mode]) return; S.mode = mode; if (mode === 'clear') G.envSet = 4; else if (mode === 'rain') G.envSet = 33; }
  function build(scene) {
    const N = C.flakes, pos = new Float32Array(N * 3), r = rng(977); for (let i = 0; i < N * 3; i++) pos[i] = r();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    FU = { uT: { value: 0 }, uAmt: { value: 0 }, uBox: { value: C.flakeBox }, uDrift: { value: new THREE.Vector3() }, uPx: { value: 1 } };
    // a box of air that rides with the lens; a flake's place is its seed plus its fall and drift, wrapped into the box: nothing is stored
    flakes = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: FU, transparent: true, depthWrite: false, fog: false,
      vertexShader: `uniform float uT, uAmt, uBox, uPx; uniform vec3 uDrift; varying float vA;
        void main(){ vec3 s = position; vec3 p = s * uBox + uDrift + vec3(sin(uT * .9 + s.y * 40.) * .35, 0., cos(uT * .7 + s.x * 40.) * .35);
          p = cameraPosition + mod(p - cameraPosition + .5 * uBox, uBox) - .5 * uBox; vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
          float d = -mv.z; vA = step(fract(s.x * 91.7 + s.z * 37.3), uAmt) * smoothstep(.3, 1.2, d) * smoothstep(.5 * uBox, .3 * uBox, d); gl_PointSize = min(uPx * (.035 + .03 * fract(s.y * 57.)) / max(d, .3), 7.); }`,
      fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float a = smoothstep(.5, .15, length(c)) * vA; if (a < .01) discard; gl_FragColor = vec4(vec3(.82, .86, .92), a * .85); }` }));
    flakes.frustumCulled = false; flakes.renderOrder = 50; flakes.visible = false; scene.add(flakes);
    chip = document.createElement('div'); chip.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);font:600 12px/1.4 "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f6ead0;text-shadow:0 1px 8px rgba(0,0,0,.85);z-index:5;pointer-events:none;white-space:pre;font-variant-numeric:tabular-nums;opacity:.9'; document.body.appendChild(chip);
    G.tick.push(tick); }

  function tick(t, dt) { dt = Math.min(dt || 0, .1); const te = G.tEnv === undefined ? G.t : G.tEnv, cold = S.mode === 'snow' || S.mode === 'frost';
    if (cold) G.envSet = 21.5;                                           // a held, overcast hour: the engine's own storm and rain stay out of the cold
    S.storm = (.3 * sm(17.5, 24, te) + .7 * sm(24, 31, te)) * (1 - sm(67.7, 70.2, te)); S.rain = cold ? 0 : sm(31.2, 34.5, te) * (1 - sm(67.55, 68.5, te));
    const tT = S.mode === 'frost' ? C.tempFrost : S.mode === 'snow' ? C.tempSnow : lerp(C.tempMild, C.tempStorm, S.storm); S.temp += (tT - S.temp) * (1 - Math.exp(-dt / C.tempEase));
    S.snowing += ((cold ? (S.mode === 'frost' ? .4 : 1) : 0) - S.snowing) * (1 - Math.exp(-dt / 2));
    S.cover = clamp(S.cover + dt * (S.snowing * (S.temp < .5 ? 1 : 0) * C.snowRate - Math.max(S.temp, 0) / 16 * C.meltRate - S.rain * C.rainWash));
    const wetE = cold ? 0 : sm(31.2, 36, te) * (1 - sm(68, 76, te)), melt = S.temp > 0 ? Math.min(1, S.cover * 3) * .7 : 0; S.wet = Math.max(wetE, melt);
    S.ice = S.temp < -1 ? Math.min(S.ice + dt * C.freezeRate, Math.max(S.ice, S.mode === 'frost' ? 1 : C.iceInSnow)) : S.temp > 0 ? Math.max(0, S.ice - dt * C.thawRate) : S.ice;
    const gust = 1 + .3 * Math.sin(t * .7) + .18 * Math.sin(t * 1.9 + 1.3); S.speed = (C.windCalm + C.windStorm * S.storm + (cold ? C.windCold : 0)) * gust; S.wind.set(C.windDir[0], C.windDir[1], C.windDir[2]).multiplyScalar(S.speed);
    G.uWx.value.set(S.cover, S.ice, S.wet * (1 - S.ice), clamp(S.speed / 26));
    // falling snow, carried by the wind
    flakes.visible = S.snowing > .01; if (flakes.visible) { FU.uT.value = t; FU.uAmt.value = S.snowing; FU.uPx.value = innerHeight * 1.2; FU.uDrift.value.set(S.wind.x * .35 * t, -C.flakeFall * t, S.wind.z * .35 * t); }
    // light that has touched the ground once: the sun's colour times the ground's, sent up into the fill from below. Snow on the ground
    // turns it from a dim earth-brown into a bright cold white; wet ground gives less back. (A stand-in for traced bounce light, not a tracer.)
    if (G.hemi && G.sun) { const up = Math.max(0, _d.copy(G.sun.position).sub(G.sun.target.position).normalize().y), k = C.bounce * G.sun.intensity * up * (1 - .3 * S.wet);
      _a.setRGB(C.albedoGround[0], C.albedoGround[1], C.albedoGround[2]).lerp(_b.setRGB(C.albedoSnow[0], C.albedoSnow[1], C.albedoSnow[2]), S.cover); G.hemi.groundColor.r += G.sun.color.r * _a.r * k; G.hemi.groundColor.g += G.sun.color.g * _a.g * k; G.hemi.groundColor.b += G.sun.color.b * _a.b * k; }
    chipT -= dt; if (chipT <= 0) { chipT = .25; chip.textContent = `날씨 ${NAME[S.mode]} · ${S.temp.toFixed(0)}°C · 바람 ${S.speed.toFixed(0)} m/s` + (S.rain > .05 ? ' · 비' : '') + (S.snowing > .05 ? ' · 눈' : '') + (S.cover > .01 ? ` · 적설 ${Math.round(S.cover * 100)}%` : '') + (S.ice > .01 ? ` · 빙결 ${Math.round(S.ice * 100)}%` : ''); } }

  addEventListener('keydown', e => { if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return; const m = { Digit5: 'clear', Digit6: 'rain', Digit7: 'snow', Digit8: 'frost', Digit9: 'auto' }[e.code]; if (m) { set(m); chipT = 0; } });
  return { build, set, S, NAME };
})();
