'use strict';
// ---- ways of being in the world. Each mode owns the camera for its frames: free flight (1), the bee in the garden (2), a walk up
//      the trail (3), the car (4). A mode is { name, enter(), leave(), step(camera, dt) -> a line for the readout }; add one to MODES.
//      The sun's shadow map follows whichever lens is in use, sized to what that lens sees. ----
const Modes = (() => {
  const CC = CFG.camera, T = Island.T, GP = Island.GP, UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
  const m = new THREE.Matrix4(), P = new THREE.Vector3(), L = new THREE.Vector3(), q = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), keys = new Set();
  const dbg = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null, sn = (t, s) => (Math.sin(1.7 * t + s) + .6 * Math.sin(3.1 * t + 2.3 * s) + .3 * Math.sin(5.9 * t + 4.1 * s)) / 1.9;
  // free flight: W A S D, Q and E down and up, Shift fast, drag to look. It cannot go under the ground.
  const fly = { p: new THREE.Vector3(GP.x + 16, GP.y + 7, GP.z + 26), yaw: Math.atan2(16, 26), pitch: -.18, drag: false };
  function visitOutcrop() {
    set('free');
    const x=GP.x+9, z=GP.z+4, tx=GP.x+4, tz=GP.z+20;
    fly.p.set(x,Island.surf(x,z)[0]+1.75,z);
    fly.yaw=Math.atan2(x-tx,z-tz);
    fly.pitch=Math.atan2(Island.surf(tx,tz)[0]+3.1-fly.p.y,Math.hypot(tx-x,tz-z));
  }
  addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS') fly.drag = true; }); addEventListener('pointerup', () => { fly.drag = false; });
  addEventListener('pointermove', e => { if (!fly.drag || cur !== 'free') return; fly.yaw -= e.movementX * .0032; fly.pitch = clamp(fly.pitch - e.movementY * .0032, -1.45, 1.45); });
  // the walk: eye height above the trail, steps from the distance walked, the gaze along the path ahead
  const hike = { f: 8, dist: 0, tm: 0 };
  function hikeStep(camera, dt) { const n = T.n, top = hike.f >= n - 3, v = top ? 0 : keys.has('ArrowUp') ? 9 : keys.has('ArrowDown') ? -4 : CC.walkSpeed; hike.f = clamp(hike.f + v * dt, 0, n - 2); hike.dist += Math.abs(v) * dt; hike.tm += dt;
    const at = (ff, o) => { ff = clamp(ff, 0, n - 1.001); const i = Math.floor(ff), k = ff - i; return o.set(lerp(T.px[i], T.px[i + 1], k), lerp(T.py[i], T.py[i + 1], k) + .14, lerp(T.pz[i], T.pz[i + 1], k)); };
    at(hike.f, a); at(hike.f + .6, b); at(hike.f + 4.5, c); let hx = c.x - b.x, hz = c.z - b.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl; at(hike.f + 7, b);
    const t = G.t, ph = hike.dist / .72, sp = clamp(Math.abs(v) / CC.walkSpeed, 0, 1.6), eye = a.y + CC.eye, still = 1 - clamp(sp);
    const yaw = Math.atan2(-hx, -hz) + .03 * sn(t * .23, 9) + .006 * sn(t * .9, 1) + still * .7 * Math.sin(hike.tm * .2), pitch = Math.atan2(b.y + 1.3 - eye, 7) * .8 * (1 - still) - .1 * still + .005 * sn(t * 1.1, 5) + .004 * Math.sin(TAU * ph + 1) * sp, sw = Math.sin(Math.PI * ph) * .018 * sp;
    camera.position.set(a.x + hz * sw, eye - .024 * Math.cos(TAU * ph) * sp, a.z - hx * sw); const cp = Math.cos(pitch); L.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    m.lookAt(P.set(0, 0, 0), L, UP); camera.quaternion.setFromRotationMatrix(m).multiply(q.setFromAxisAngle(ZAX, Math.sin(Math.PI * ph) * .006 * sp)); camera.fov = 62;
    return '해발 ' + Math.round(a.y) + ' m' + (top ? ' · 정상' : '') + ' · ↑ 빠르게 ↓ 뒤로'; }
  let beeT = 0, eyeOn = false;       // B: the compound-eye view, in the bee's mode
  const MODES = {
    free: { name: '자유', enter() {}, leave() {}, step(camera, dt) { const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? CC.flyFast : CC.flySpeed) * dt, cy = Math.cos(fly.yaw), sy = Math.sin(fly.yaw), f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      fly.p.x += (-sy * f + cy * s) * sp * Math.cos(fly.pitch); fly.p.z += (-cy * f - sy * s) * sp * Math.cos(fly.pitch); fly.p.y += (Math.sin(fly.pitch) * f + (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0)) * sp;
      fly.p.y = Math.max(fly.p.y, Math.max(Island.surf(fly.p.x, fly.p.z)[0], CFG.sea.level) + 1.2); camera.position.copy(fly.p); camera.rotation.set(fly.pitch, fly.yaw, 0, 'YXZ'); camera.fov = CC.fov; return 'W A S D 이동 · 끌어서 둘러보기 · Q E 높이 · Shift 빠르게'; } },
    bee: { name: '벌', enter() { beeT = 0; }, leave() { Garden.leave(); }, step(camera, dt) { beeT += dt; const r = Garden.bee(beeT, dt, camera); camera.fov = Post.fisheyeFov(camera.aspect); camera.near = .004; Post.lens.focus = 0; Post.lens.aperture = CFG.lens.beeAperture; Post.lens.fisheye = true; Post.lens.eye += ((eyeOn ? 1 : 0) - Post.lens.eye) * (1 - Math.exp(-dt * 6)); return (eyeOn ? '겹눈 · ' : 'B 겹눈 · ') + '벌의 비행 ' + Math.floor(Garden.T) + ' / ' + Garden.DUR + '초' + (r && r.walk > .5 ? ' · 걷는 중' : ''); } },
    hike: { name: '산행', enter() { hike.f = 8; hike.dist = 0; hike.tm = 0; }, leave() {}, step: hikeStep },
    drive: { name: '운전', enter() { G.drive = true; Drive.enter(); }, leave() { G.drive = false; Drive.leave(); fly.p.copy(G.camera.position); }, step(camera, dt) { return Drive.step(camera, dt); } },
  };
  let cur = MODES[Q.get('mode')] ? Q.get('mode') : 'free', booted = false, hudAt = 0;
  const hud = document.createElement('div'); hud.style.cssText = 'position:fixed;left:14px;bottom:14px;font:600 12px/1.5 "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f3e6d2;background:rgba(14,12,10,.55);padding:8px 12px;border-radius:10px;border:1px solid rgba(243,217,189,.18);z-index:4;pointer-events:none;white-space:pre'; document.body.appendChild(hud);
  function set(name) { if (!MODES[name] || name === cur) return; MODES[cur].leave(); if (cur !== 'free' && cur !== 'drive') fly.p.copy(G.camera.position); cur = name; MODES[cur].enter(); hudAt = 0; }
  // the shadow map: a box around the lens, snapped to its own texels so it does not swim; small for the bee, wide from the air
  const SHP = [[310, 520, 20, 1100, -.00035, .22], [75, 260, 1, 520, -.00008, .07], [7, 40, 1, 80, -.00004, .0025]], SR = new THREE.Vector3(), SU = new THREE.Vector3(); let shMode = -1;
  function shadows(camera, k) { const sun = G.sun, sc = sun.shadow.camera, p = SHP[k], S = Sky.light; q.setFromRotationMatrix(m.lookAt(S, P.set(0, 0, 0), UP)); SR.set(1, 0, 0).applyQuaternion(q); SU.set(0, 1, 0).applyQuaternion(q);
    if (k !== shMode) { shMode = k; sc.left = sc.bottom = -p[0]; sc.right = sc.top = p[0]; sc.near = p[2]; sc.far = p[3]; sc.updateProjectionMatrix(); sun.shadow.bias = p[4]; sun.shadow.normalBias = p[5]; }
    const ts = 2 * p[0] / sun.shadow.mapSize.x, cp = camera.position; c.set(0, 0, 0).addScaledVector(SR, Math.round(cp.dot(SR) / ts) * ts).addScaledVector(SU, Math.round(cp.dot(SU) / ts) * ts).addScaledVector(S, cp.dot(S));
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(S, p[1]); sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); }
  // add(id, mode, keyCode, keyLabel): a module brings its own mode, e.g. Modes.add('collect', {...}, 'Digit0', '0')
  const extra = {}; function add(id, mode, code, label) { MODES[id] = mode; if (code) { extra[code] = id; mode.key = label || code; } }
  function step(camera, dt) { if (!booted) { booted = true; const want = Q.get('mode'); if (MODES[want]) cur = want; MODES[cur].enter(); if (cur==='free') visitOutcrop(); }
    camera.near = .3; Post.lens.aperture = 0; Post.lens.focus = 10; Post.lens.fisheye = false; if (cur !== 'bee') Post.lens.eye = 0; let line;
    const fix = window.__cam || dbg; if (fix) { P.set(fix[0], fix[1], fix[2]); L.set(fix[3], fix[4], fix[5]); camera.position.copy(P); m.lookAt(P, L, UP); camera.quaternion.setFromRotationMatrix(m); camera.fov = fix[6] || CC.fov; camera.near = fix[7] || .3; line = ''; }
    else line = MODES[cur].step(camera, dt);
    const high = camera.position.y - Math.max(Island.surf(camera.position.x, camera.position.z)[0], 0); shadows(camera, cur === 'bee' && !fix ? 2 : high > 45 ? 0 : 1);
    if (performance.now() - hudAt > 250) { hudAt = performance.now(); hud.textContent = Object.keys(MODES).map((k, i) => (k === cur ? '▸' : ' ') + (MODES[k].key || i + 1) + ' ' + MODES[k].name).join('   ') + '   H 엔진 활용법\n' + line; } }
  addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) return; keys.add(e.code); if (e.code === 'KeyB' && !e.repeat && cur === 'bee') eyeOn = !eyeOn; const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (i >= 0) set(Object.keys(MODES)[i]); else if (extra[e.code]) set(extra[e.code]); if (cur === 'hike' && e.code.startsWith('Arrow')) e.preventDefault(); });
  addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
  return { step, set, add, visitOutcrop, MODES, fly, keys, get cur() { return cur; } };
})();
