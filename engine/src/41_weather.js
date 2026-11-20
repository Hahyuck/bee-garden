'use strict';
// ---- weather as one state the whole world reads: air temperature, wind, cloud, storm, rain, falling snow, snow lying on the ground,
//      ice, wetness. Snow builds up on what faces the sky and melts when it warms; wet ground freezes; the wind carries rain and
//      flakes and pushes loose bodies (Phys); tyres lose their grip (Drive); the sky darkens and the air thickens (Sky); and the
//      ground's colour feeds the light that bounces off it. Every patched material gets uWx = (snow cover, ice, wetness, wind 0..1)
//      and may call wxCover(). Keys 5-9 choose the weather. ----
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
  const S = { mode: C.start, temp: C.tempMild, cloud: .3, storm: 0, rain: 0, snowing: 0, cover: 0, ice: 0, wet: 0, wind: new THREE.Vector3(), speed: 0 };
  const _d = new THREE.Vector3(), _a = new THREE.Color(), _b = new THREE.Color(); let flakes, FU, drops, DU, chip, chipT = 0, phase = 0;
  { const q = Q.get('weather'); if (q && NAME[q]) S.mode = q; }
  const set = mode => { if (NAME[mode]) S.mode = mode; };
  // a box of air that rides with the lens; a particle's place is its seed plus its fall and drift, wrapped into the box: nothing is stored
  function cloud(scene, N, box, vs, fs) { const pos = new Float32Array(N * 3), r = rng(977 + N); for (let i = 0; i < N * 3; i++) pos[i] = r();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const u = { uT: { value: 0 }, uAmt: { value: 0 }, uBox: { value: box }, uDrift: { value: new THREE.Vector3() }, uPx: { value: 1 }, uLum: { value: 1 } };
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, fog: false, vertexShader: vs, fragmentShader: fs })); m.frustumCulled = false; m.renderOrder = 50; m.visible = false; scene.add(m); return [m, u]; }
  function build(scene) {
    const head = 'uniform float uT, uAmt, uBox, uPx; uniform vec3 uDrift; varying float vA; void main(){ vec3 s = position; ', wrap = ' p = cameraPosition + mod(p - cameraPosition + .5 * uBox, uBox) - .5 * uBox; vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; float d = -mv.z; vA = step(fract(s.x * 91.7 + s.z * 37.3), uAmt) * smoothstep(.3, 1.2, d) * smoothstep(.5 * uBox, .3 * uBox, d); ';
    [flakes, FU] = cloud(scene, C.flakes, C.flakeBox, head + 'vec3 p = s * uBox + uDrift + vec3(sin(uT * .9 + s.y * 40.) * .35, 0., cos(uT * .7 + s.x * 40.) * .35);' + wrap + 'gl_PointSize = min(uPx * (.035 + .03 * fract(s.y * 57.)) / max(d, .3), 7.); }',
      'uniform float uLum; varying float vA; void main(){ float a = smoothstep(.5, .15, length(gl_PointCoord - .5)) * vA; if (a < .01) discard; gl_FragColor = vec4(vec3(.82, .86, .92) * uLum, a * .85); }');
    [drops, DU] = cloud(scene, C.drops, C.dropBox, head + 'vec3 p = s * uBox + uDrift * (.85 + .3 * fract(s.z * 13.));' + wrap + 'gl_PointSize = min(uPx * .5 / max(d, .4), 46.); }',
      'uniform float uLum; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float a = smoothstep(.03, 0., abs(c.x + c.y * .12)) * smoothstep(.5, .3, abs(c.y)) * vA; if (a < .01) discard; gl_FragColor = vec4(vec3(.7, .76, .84) * uLum, a * .32); }');
    chip = document.createElement('div'); chip.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);font:600 12px/1.4 "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f6ead0;text-shadow:0 1px 8px rgba(0,0,0,.85);z-index:5;pointer-events:none;white-space:pre;font-variant-numeric:tabular-nums;opacity:.9'; document.body.appendChild(chip);
    G.tick.push(tick); }

  function tick(t, dt) { dt = Math.min(dt || 0, .1); const cold = S.mode === 'snow' || S.mode === 'frost', ease = (k, to, s) => { S[k] += (to - S[k]) * (1 - Math.exp(-dt / s)); };
    // auto: fair weather with a front of rain passing through now and then
    phase = (phase + dt / C.autoPeriod) % 1; const front = S.mode === 'auto' ? sm(.5, .62, phase) * (1 - sm(.82, .94, phase)) : S.mode === 'rain' ? 1 : 0;
    ease('storm', front, 6); ease('cloud', cold ? .85 : S.mode === 'clear' ? .22 : lerp(.3, 1, front), 8); ease('rain', cold ? 0 : sm(.55, .9, S.storm), 2);
    ease('temp', S.mode === 'frost' ? C.tempFrost : S.mode === 'snow' ? C.tempSnow : lerp(C.tempMild, C.tempStorm, S.storm), C.tempEase); ease('snowing', cold ? (S.mode === 'frost' ? .4 : 1) : 0, 2);
    S.cover = clamp(S.cover + dt * (S.snowing * (S.temp < .5 ? 1 : 0) * C.snowRate - Math.max(S.temp, 0) / 16 * C.meltRate - S.rain * C.rainWash));
    const melt = S.temp > 0 ? Math.min(1, S.cover * 3) * .7 : 0; ease('wet', Math.max(S.rain, melt), S.rain > S.wet ? 3 : 14);
    S.ice = S.temp < -1 ? Math.min(S.ice + dt * C.freezeRate, Math.max(S.ice, S.mode === 'frost' ? 1 : C.iceInSnow)) : S.temp > 0 ? Math.max(0, S.ice - dt * C.thawRate) : S.ice;
    const gust = 1 + .3 * Math.sin(t * .7) + .18 * Math.sin(t * 1.9 + 1.3); S.speed = (C.windCalm + C.windStorm * S.storm + (cold ? C.windCold : 0)) * gust; S.wind.set(C.windDir[0], C.windDir[1], C.windDir[2]).multiplyScalar(S.speed);
    G.uWx.value.set(S.cover, S.ice, S.wet * (1 - S.ice), clamp(S.speed / 26)); G.uGust.value = clamp(S.speed / 22, 0, 1.3); G.uWind.value += dt * (.5 + S.speed * .09);
    const lum = G.hemi ? clamp(G.hemi.intensity / 3, .08, 1) : 1, px = innerHeight * 1.2;
    flakes.visible = S.snowing > .01; if (flakes.visible) { FU.uT.value = t; FU.uAmt.value = S.snowing; FU.uPx.value = px; FU.uLum.value = lum; FU.uDrift.value.set(S.wind.x * .35 * t, -C.flakeFall * t, S.wind.z * .35 * t); }
    drops.visible = S.rain > .01; if (drops.visible) { DU.uT.value = t; DU.uAmt.value = S.rain; DU.uPx.value = px; DU.uLum.value = lum; DU.uDrift.value.set(S.wind.x * .25 * t, -C.dropFall * t, S.wind.z * .25 * t); }
    // light that has touched the ground once: the sun's colour times the ground's, sent up into the fill from below. Snow on the ground
    // turns it from a dim earth-brown into a bright cold white; wet ground gives less back. (A stand-in for traced bounce light, not a tracer.)
    if (G.hemi && G.sun && G.look.bounce) { const up = Math.max(0, _d.copy(G.sun.position).sub(G.sun.target.position).normalize().y), k = C.bounce * G.sun.intensity * up * (1 - .3 * S.wet) / Math.max(G.hemi.intensity, .05);
      _a.setRGB(C.albedoGround[0], C.albedoGround[1], C.albedoGround[2]).lerp(_b.setRGB(C.albedoSnow[0], C.albedoSnow[1], C.albedoSnow[2]), S.cover); G.hemi.groundColor.r += G.sun.color.r * _a.r * k; G.hemi.groundColor.g += G.sun.color.g * _a.g * k; G.hemi.groundColor.b += G.sun.color.b * _a.b * k; }
    chipT -= dt; if (chipT <= 0) { chipT = .25; const h = Math.floor(G.day), mi = Math.floor((G.day - h) * 60); chip.textContent = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} · 날씨 ${NAME[S.mode]} · ${S.temp.toFixed(0)}°C · 바람 ${S.speed.toFixed(0)} m/s` + (S.rain > .05 ? ' · 비' : '') + (S.snowing > .05 ? ' · 눈' : '') + (S.cover > .01 ? ` · 적설 ${Math.round(S.cover * 100)}%` : '') + (S.ice > .01 ? ` · 빙결 ${Math.round(S.ice * 100)}%` : ''); } }

  addEventListener('keydown', e => { if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return; const m = { KeyK: 'clear', Digit6: 'rain', Digit7: 'snow', Digit8: 'frost', Digit9: 'auto' }[e.code]; if (m) { set(m); chipT = 0; } });
  return { build, set, S, NAME };
})();
