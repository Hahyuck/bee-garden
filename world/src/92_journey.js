'use strict';
// ---- one world, three ways through it. The fort's own tour (and its free camera) is left as it was; this module adds the bee's flight
//      in the garden and the walk up the island's trail, and a journey that strings all three together:
//      1 the fort   2 the bee   3 the hike   0 the whole journey (the default).  W A S D still takes the free camera from wherever you are. ----
const Journey = (() => {
  const w0 = G.walk, m = new THREE.Matrix4(), P = new THREE.Vector3(), L = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion(), fromP = new THREE.Vector3(), fromQ = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const dbg = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null, T = Island.T, sn = (t, s) => (Math.sin(1.7 * t + s) + .6 * Math.sin(3.1 * t + 2.3 * s) + .3 * Math.sin(5.9 * t + 4.1 * s)) / 1.9;
  let mode = Q.get('mode') || 'auto', booted = false, seg = 0, tm = 0, blend = 1, blendT = 3, f = 8, dist = 0, wasWalk = false, speedKey = 0;
  // the journey: the fort's tour, the bee's flight, then five clips up the trail (cut, like a hiking film), the last one ending on the summit
  const CLIPS = [.03, .27, .52, .76, 1], SEQ = [['fort', 26], ['bee', Garden.DUR], ...CLIPS.map((k, i) => ['hike', i === CLIPS.length - 1 ? 24 : 9, k])];
  const hud = document.createElement('div'); hud.style.cssText = 'position:fixed;left:14px;bottom:14px;font:600 12px/1.5 "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f3e6d2;background:rgba(14,12,10,.55);padding:8px 12px;border-radius:10px;border:1px solid rgba(243,217,189,.18);z-index:4;pointer-events:none;white-space:pre;transition:opacity .8s'; document.body.appendChild(hud);
  const NAME = { fort: '요새', bee: '벌', hike: '산행', drive: '운전', auto: '이어 보기' }; let hudAt = 0;
  function label(extra) { const keys = [['1', 'fort'], ['2', 'bee'], ['3', 'hike'], ['4', 'drive'], ['0', 'auto']].map(([k, n]) => (mode === n ? '▸' : ' ') + k + ' ' + NAME[n]).join('   '); hud.textContent = keys + '\n' + extra; }
  const cur = () => mode === 'auto' ? SEQ[seg][0] : mode;
  function begin(camera, glide) { fromP.copy(camera.position); fromQ.copy(camera.quaternion); blend = glide ? 0 : 1; blendT = glide || 1; tm = 0; }
  function setMode(mm, camera) { if (cur() === 'bee') Garden.leave(); if (mode === 'drive') Drive.leave(); mode = mm; seg = 0; G.drive = mm === 'drive'; if (G.drive) { if (Walk && Walk.on) Walk.leave(); Drive.enter(); } if (mm === 'hike') { f = 8; dist = 0; } begin(camera, mm === 'fort' ? 0 : 3.5); if (mm === 'fort' && Walk && Walk.on) Walk.leave(); }
  function hikePose(camera, dt, t, endAt) {       // walk the trail: eye height 1.66 m, steps from distance walked, gaze along the path
    const n = T.n, top = f >= n - 3, v = top ? 0 : (speedKey > 0 ? 9 : speedKey < 0 ? -4 : 1.35) * (endAt !== undefined ? clamp((endAt - f) / 3, 0, 1) : 1); f = clamp(f + v * dt, 0, n - 2); dist += Math.abs(v) * dt;
    const at = (ff, o) => { ff = clamp(ff, 0, n - 1.001); const i = Math.floor(ff), k = ff - i; return o.set(lerp(T.px[i], T.px[i + 1], k), lerp(T.py[i], T.py[i + 1], k) + .14, lerp(T.pz[i], T.pz[i + 1], k)); };
    at(f, a); at(f + .6, b); at(f + 4.5, c); let hx = c.x - b.x, hz = c.z - b.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl; at(f + 7, b);
    const ph = dist / .72, sp = clamp(Math.abs(v) / 1.35, 0, 1.6), eye = a.y + 1.66, still = 1 - clamp(sp);
    // on the top (or held still), the head comes round to the fort and the sea
    const toFort = Math.atan2(-(10 - a.x), -(-66 - a.z)); let yaw = Math.atan2(-hx, -hz);
    if (top || endAt !== undefined) { const k = sm(1.5, 7, tm) * still; let d = toFort - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * k + .5 * Math.sin(tm * .25) * k; }
    yaw += .03 * sn(t * .23, 9) + .006 * sn(t * .9, 1); const pitch = Math.atan2(b.y + 1.3 - eye, 7) * .8 * (1 - still) - .1 * still + .005 * sn(t * 1.1, 5) + .004 * Math.sin(TAU * ph + 1) * sp, sw = Math.sin(Math.PI * ph) * .018 * sp;
    camera.position.set(a.x + hz * sw, eye - .024 * Math.cos(TAU * ph) * sp, a.z - hx * sw); const cp = Math.cos(pitch); L.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    m.lookAt(P.set(0, 0, 0), L, UP); camera.quaternion.setFromRotationMatrix(m).multiply(q.setFromAxisAngle(ZAX, Math.sin(Math.PI * ph) * .006 * sp)); camera.fov = 62; return top;
  }
  // the sun's shadow map follows the lens once it leaves the fort: 75 m around a walker, 7 m around the bee (snapped to texels so it does not swim)
  const SHQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(SUN, new THREE.Vector3(), UP)), SR = new THREE.Vector3(1, 0, 0).applyQuaternion(SHQ), SU = new THREE.Vector3(0, 1, 0).applyQuaternion(SHQ), SC0 = new THREE.Vector3(14, 45, -100);
  const SHP = [[310, 520, 20, 1100, -.00035, .22], [75, 260, 1, 520, -.00008, .07], [7, 40, 1, 80, -.00004, .0025]]; let shMode = -1;
  function shadows(camera, k) { const sun = G.sun, sc = sun.shadow.camera, p = SHP[k];
    if (k !== shMode) { shMode = k; sc.left = sc.bottom = -p[0]; sc.right = sc.top = p[0]; sc.near = p[2]; sc.far = p[3]; sc.updateProjectionMatrix(); sun.shadow.bias = p[4]; sun.shadow.normalBias = p[5]; }
    if (k === 0) c.copy(SC0); else { const ts = 2 * p[0] / sun.shadow.mapSize.x, cp = camera.position; c.set(0, 0, 0).addScaledVector(SR, Math.round(cp.dot(SR) / ts) * ts).addScaledVector(SU, Math.round(cp.dot(SU) / ts) * ts).addScaledVector(SUN, cp.dot(SUN)); }
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUN, p[1]); sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); }
  G.walk = (camera, dt) => {
    if (w0) w0(camera, dt);
    const fix = window.__cam || dbg; if (fix) { P.set(fix[0], fix[1], fix[2]); L.set(fix[3], fix[4], fix[5]); camera.position.copy(P); m.lookAt(P, L, UP); camera.quaternion.setFromRotationMatrix(m); if (fix[6]) camera.fov = fix[6]; camera.near = fix[7] || .5; shadows(camera, fix[8] !== undefined ? fix[8] : Math.hypot(P.x - 14, P.z + 100) > 300 ? 1 : 0); return; }
    if (!booted) { booted = true; if (mode === 'drive') { G.drive = true; Drive.enter(); } }
    const walking = !!(Walk && Walk.on); if (walking && !wasWalk && mode !== 'fort') { if (cur() === 'bee') Garden.leave(); mode = 'fort'; } wasWalk = walking;
    const t = G.tAbs || 0; tm += dt; camera.near = .5;
    if (mode === 'auto' && tm > SEQ[seg][1]) { if (SEQ[seg][0] === 'bee') Garden.leave(); seg = (seg + 1) % SEQ.length; const s = SEQ[seg]; if (s[0] === 'hike') { f = Math.max(8, s[2] * (T.n - 2) - (s[2] === 1 ? 14 : 6)); dist = 0; } begin(camera, s[0] === 'bee' ? 4 : 0); }
    const k = cur(); let extra = '';
    if (k === 'fort') extra = walking ? '자유 카메라 · R 투어로 복귀' : '요새 투어 · W A S D 로 직접 이동';
    else if (k === 'bee') { const r = Garden.bee(tm, dt, camera); camera.fov = 96; camera.near = .004; extra = '벌의 비행 ' + Math.floor(Garden.T) + ' / ' + Garden.DUR + '초' + (r.walk > .5 ? ' · 걷는 중' : ''); }
    else if (k === 'drive') extra = Drive.step(camera, dt);
    else { const s = SEQ[seg], top = hikePose(camera, dt, t, mode === 'auto' && s[2] === 1 ? T.n - 3 : undefined); extra = '해발 ' + Math.round(camera.position.y - 1.66) + ' m' + (top ? ' · 정상' : '') + (mode === 'hike' ? ' · ↑ 빠르게 ↓ 뒤로' : ''); if (mode === 'hike' && top && tm > 30 && f >= T.n - 3) { f = 8; dist = 0; begin(camera, 0); } }
    if (k !== 'fort' && blend < 1) { blend = Math.min(1, blend + dt / blendT); const e = sm(0, 1, blend); camera.position.lerpVectors(fromP, camera.position, e); camera.position.y += Math.sin(Math.PI * e) * Math.min(60, fromP.distanceTo(camera.position) * .12); camera.quaternion.copy(q.copy(fromQ).slerp(camera.quaternion, e)); if (k === 'bee') camera.near = lerp(.5, .004, sm(.7, 1, blend)); }
    if (performance.now() - hudAt > 250) { hudAt = performance.now(); label(extra); }
    shadows(camera, k === 'bee' ? 2 : k === 'hike' || Math.hypot(camera.position.x - 14, camera.position.z + 100) > 300 ? 1 : 0);
  };
  addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) return; const cam = G.camera; if (!cam) return;
    if (e.code === 'Digit1') setMode('fort', cam); else if (e.code === 'Digit2') setMode('bee', cam); else if (e.code === 'Digit3') setMode('hike', cam); else if (e.code === 'Digit4') setMode('drive', cam); else if (e.code === 'Digit0') setMode('auto', cam);
    else if (e.code === 'ArrowUp') { speedKey = 1; e.preventDefault(); } else if (e.code === 'ArrowDown') { speedKey = -1; e.preventDefault(); } });
  addEventListener('keyup', e => { if (e.code === 'ArrowUp' || e.code === 'ArrowDown') speedKey = 0; });
  return { get mode() { return mode; }, setMode: mm => setMode(mm, G.camera), get seg() { return seg; }, at: t => { tm = t; }, trail: k => { f = k; } };
})();
