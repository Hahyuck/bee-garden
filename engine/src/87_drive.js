'use strict';
// ---- driving: a small rally hatchback on the island's coast road. A rigid body on four sprung wheels: each wheel finds the ground
//      under it (road, gravel, grass, sand: Island.surf), carries load through a spring and damper, and makes grip from its slip
//      (a saturating curve, inside a friction circle). Front-wheel drive, five gears changed for you, a handbrake on the rear axle.
//      Around it, the frame of a game: input (keyboard and gamepad), a chase camera, lap timing, a pause menu, a readout, engine sound. ----
const Drive = (() => {
  const RD = Island.RD, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), YAX = V(0, 1, 0);
  const CC = CFG.car, COMY = CC.comY, M = CC.mass, IX = CC.inertia[0], IY = CC.inertia[1], IZ = CC.inertia[2], RAD = CC.wheelRadius, REST = CC.springRest, TRAV = CC.springTravel, KS = CC.spring, CS = CC.damper, G9 = 9.81;
  const WL = [[.74, -.18, 1.22], [-.74, -.18, 1.22], [.74, -.18, -1.18], [-.74, -.18, -1.18]].map(a => V(...a));      // +X is the car's left, +Z its nose
  const MU = CC.grip, RR = CC.rolling, GEAR = CC.gears, FINAL = CC.finalDrive, REV = CC.reverse; let snowK = 0, iceK = 0;
  const car = { p: V(), q: new THREE.Quaternion(), v: V(), w: V(), comp: [0, 0, 0, 0], len: [.2, .2, .2, .2], spin: [0, 0, 0, 0], steer: 0, gear: 1, rpm: 900, slip: 0, thr: 0, air: 0, surf: 0, bad: 0 };
  const inp = { acc: 0, brk: 0, st: 0, hb: 0, look: false }, keys = new Set(), gnd = [0, 1, 2, 3].map(() => [0, 0, 0, 0, 0, 0]);
  const touch = { acc: 0, brk: 0, st: 0, hb: 0 };
  let doorHinge = null, brakeLight = null;
  const bx = V(), by = V(), bz = V(), F = V(), Tq = V(), A = V(), C = V(), r = V(), vC = V(), wf = V(), ws = V(), nrm = V(), f = V(), tmp = V(), camP = V(), dir = V(), tgt = V(), dq = new THREE.Quaternion(), mm = new THREE.Matrix4(), QY = new THREE.Quaternion().setFromAxisAngle(YAX, Math.PI);
  let body = null, hitT = 0; const tr0 = [V(), V()], tr1 = V(); let trOn = [false, false]; const vPrev = V(), cm = V(), _i = { x: 0, y: 0, z: 0 };
  let grp = null, wheels = [], on = false, paused = false, camMode = 0, hud, menu, lastI = 0, camInit = false, snd = null, drive = 0, brake = 0, shiftT = 0, wet = 0, pad = [false, false, false];
  function reset(i) { const n = RD.n; i = ((i % n) + n) % n; const j = (i + 1) % n;
    car.p.set(RD.px[i], Island.support(RD.px[i],RD.pz[i]) + .69, RD.pz[i]); car.q.setFromAxisAngle(YAX, Math.atan2(RD.px[j] - RD.px[i], RD.pz[j] - RD.pz[i])); car.v.set(0, 0, 0); car.w.set(0, 0, 0); car.comp.fill(.09); car.gear = 1; car.rpm = 900; car.bad = 0; car.steer = 0; car.slip = 0; shiftT = 0; camInit = false; lastI = i; vPrev.set(0, 0, 0);
    if (body) { Phys.prime(car.p.x, car.p.z); body.setTranslation(car.p, true); body.setRotation(car.q, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); } }
  const pull = () => { const t = body.translation(), q = body.rotation(), v = body.linvel(), w = body.angvel(); car.p.set(t.x, t.y, t.z); car.q.set(q.x, q.y, q.z, q.w); car.v.set(v.x, v.y, v.z); car.w.set(w.x, w.y, w.z); };
  // the car as a body in the world's physics: mass, a low centre of mass, inertia, and a hull that can hit things. The wheels stay ours:
  // each step their spring and tyre forces go in as impulses, and the solver does the rest (contacts, tumbling, what it knocks over).
  function embody() { const R = Phys.R, w = Phys.world;
    body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(car.p.x, car.p.y, car.p.z).setRotation(car.q).setCanSleep(false).setCcdEnabled(true).setAngularDamping(.3).setAdditionalMassProperties(M, { x: 0, y: COMY, z: 0 }, { x: IX, y: IY, z: IZ }, { x: 0, y: 0, z: 0, w: 1 }));
    const col = d => w.createCollider(d.setDensity(0).setFriction(.35).setRestitution(.12), body); col(R.ColliderDesc.roundCuboid(.72, .23, 1.82, .08).setTranslation(0, -.09, 0)); col(R.ColliderDesc.cuboid(.68, .27, 1.1).setTranslation(0, .5, -.36));
    body.setEnabled(false); Phys.adopt(body, { vol: 2.4, r: .55, lift: [0, .5, 0] }); Phys.pre.push(h => { if (on && !paused) sub(h); });
    // what stands along the course, loose: cones on the edge line, barrels and stacks of hive crates on the shoulder, one wall of crates across half the lane
    const n = RD.n, at = (i, off, along = 0) => { i = ((i % n) + n) % n; const j = (i + 1) % n; let tx = RD.px[j] - RD.px[i], tz = RD.pz[j] - RD.pz[i]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const x = RD.px[i] - tz * off + tx * along, z = RD.pz[i] + tx * off + tz * along; return [x, Island.surf(x, z)[0] + .03, z, new THREE.Quaternion().setFromAxisAngle(YAX, Math.atan2(tx, tz))]; };
    for (let i = 30, k = 0; i < n - 30; i += 22, k++) { const side = k & 1 ? 1 : -1;
      if (k % 3 === 0) for (let c = 0; c < 4; c++) { const p = at(i + c * 3, side * 3.15); Phys.spawn('cone', p[0], p[1] + .35, p[2]); }
      else if (k % 3 === 1) for (let c = 0; c < 3; c++) { const p = at(i, side * 4.15, c * .72); Phys.spawn('barrel', p[0], p[1] + .44, p[2], { color: c & 1 ? 0xb5332d : 0x2d6fb5 }); }
      else for (let lv = 0; lv < 3; lv++) for (let c = 0; c < 3 - lv; c++) { const p = at(i, side * 4.1, (c - (2 - lv) / 2) * .63); Phys.spawn('crate', p[0], p[1] + .25 + lv * .5, p[2], { q: p[3], color: [0xd9c592, 0xcdb37a, 0xe6d6a6][(c + lv) % 3] }); } }
    for (let lv = 0; lv < 3; lv++) for (let c = 0; c < 4; c++) { const p = at(160, .5 + c * .63 + (lv & 1) * .1); Phys.spawn('crate', p[0], p[1] + .25 + lv * .5, p[2], { q: p[3], color: [0xd9c592, 0xcdb37a, 0xe6d6a6][(c + lv) % 3] }); }
  }

  function build(scene) {
    const std = (c, m, ro, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: ro, envMapIntensity: 1.1, ...o });
    const paint = std(0xf2b632, .25, .32), glass = std(0x0b0f13, .6, .08), trim = std(0x151515, .1, .7), tire = std(0x0b0b0c, 0, .92), rim = std(0x9aa0a6, .9, .3), wax = std(0xe9d9a8, 0, .8),
      lamp = std(0xffffff, 0, .3, { emissive: 0xfff2c8, emissiveIntensity: 1.4 }), tail = std(0x7a0c08, 0, .4, { emissive: 0xc0140c, emissiveIntensity: 1.1 });
    brakeLight=tail; grp = new THREE.Group(); grp.name = 'car'; grp.visible = false; scene.add(grp);
    const ext = (pts, w, mat, bevel = .06) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))), { depth: w - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 }); g.rotateY(-Math.PI / 2); g.translate((w - 2 * bevel) / 2, 0, 0); const m = new THREE.Mesh(g, mat); grp.add(m); return m; };
    const bxm = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); grp.add(m); return m; };
    ext([[-1.86, -.40], [1.84, -.40], [1.93, -.16], [1.88, .06], [1.12, .2], [-1.66, .22], [-1.88, .08], [-1.92, -.18]], 1.62, paint);            // the hull, in side view (z, y)
    ext([[1.0, .18], [.42, .72], [-1.22, .74], [-1.72, .2]], 1.42, glass, .04);                                                                   // the glasshouse
    ext([[.46, .71], [.42, .77], [-1.24, .79], [-1.28, .73]], 1.4, paint, .03);                                                                    // the roof
    for (const s of [-1, 1]) { bxm(.05, .52, .09, s * .7, .46, -.34, paint); bxm(.02, .1, 2.7, s * .815, -.06, 0, trim); bxm(.34, .12, .06, s * .56, -.02, 1.9, lamp); bxm(.3, .12, .05, s * .58, .02, -1.9, tail); }
    doorHinge = new THREE.Group(); doorHinge.name='driver-door';
    doorHinge.position.set(.815,.13,.57); grp.add(doorHinge);
    function doorPanel(w,h,d,x,y,z,material) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      mesh.position.set(x,y,z); doorHinge.add(mesh);
    }
    doorPanel(.055,.45,.95,0,-.12,-.475,paint);
    doorPanel(.04,.36,.83,-.052,.281,-.485,glass);
    doorPanel(.07,.055,.16,.045,-.008,-.83,trim);
    for(const side of [-1,1]) {
      bxm(.18,.06,.10,side*.79,.30,.43,trim);
      bxm(.17,.12,.15,side*.91,.34,.41,paint);
      bxm(.14,.087,.015,side*.91,.35,.326,glass);
      bxm(.36,.11,.045,side*.56,-.025,-1.976,tail);
      bxm(.32,.105,.05,side*.56,-.025,1.974,lamp);
    }
    bxm(.46,.135,.03,0,-.11,-1.977,wax);
    bxm(.78,.14,.045,0,-.12,1.98,trim);
    bxm(1.36,.055,.18,0,.75,-1.31,paint);
    bxm(1.66, .16, .14, 0, -.31, 1.9, trim); bxm(1.66, .16, .14, 0, -.31, -1.9, trim); bxm(.7, .1, .04, 0, -.14, 1.925, trim);
    bxm(.72, .24, .52, 0, .93, -.5, wax); bxm(.78, .04, .58, 0, 1.07, -.5, trim); for (const z of [-.66, -.5, -.34]) bxm(.74, .02, .02, 0, .9, z, trim);            // what it carries: a hive box on the roof
    wheels = WL.map(L => { const g = new THREE.Group(); g.rotation.order = 'YXZ'; const t = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, .2, 22).rotateZ(Math.PI / 2), tire), rm = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .21, 6).rotateZ(Math.PI / 2), rim); g.add(t, rm); g.position.copy(L); grp.add(g); return g; });
    grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    hud = document.createElement('div'); hud.id = 'drive-hud'; hud.style.cssText = 'position:fixed;right:14px;bottom:14px;text-align:right;font:700 13px/1.35 system-ui,sans-serif;color:#fff7e6;background:#1b1e1bcc;border:1px solid #e8ddc438;border-radius:9px;padding:7px 10px;z-index:5;pointer-events:none;display:none;font-variant-numeric:tabular-nums;white-space:pre'; document.body.appendChild(hud);
    menu = document.createElement('div'); menu.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,5,3,.72);z-index:7;font:600 15px/1.9 "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f6ead0;text-align:center;white-space:pre';
    menu.textContent = '일시정지\n\nW / ↑  가속      S / ↓  브레이크·후진\nA D / ← →  조향      Space  핸드브레이크\nC  카메라      B  뒤 보기      R  도로로 복귀\n\n게임패드: RT 가속 · LT 브레이크 · 왼쪽 스틱 조향 · A 핸드브레이크\n\nEsc 또는 화면을 눌러 계속하기'; menu.addEventListener('click',()=>setPaused(false)); document.body.appendChild(menu);
    reset(RD.n - 6); if (typeof Phys !== 'undefined' && Phys.ready) { embody(); reset(RD.n - 6); }
  }
  function readInput() {
    const down = code => keys.has(code) || Modes.keys.has(code);
    let acc = down('KeyW') || down('ArrowUp') ? 1 : touch.acc, brk = down('KeyS') || down('ArrowDown') ? 1 : touch.brk, st = clamp(touch.st + Number(down('KeyA') || down('ArrowLeft')) - Number(down('KeyD') || down('ArrowRight')),-1,1), hb = down('Space') ? 1 : touch.hb, look = down('KeyB');
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.mapping === 'standard') : null;
    if (gp) { const b = gp.buttons; acc = Math.max(acc, b[7].value); brk = Math.max(brk, b[6].value); if (Math.abs(gp.axes[0]) > .12) st = -gp.axes[0]; hb = Math.max(hb, b[0].pressed ? 1 : 0); look = look || b[5].pressed;
      const edge = (k, i, fn) => { if (b[i].pressed && !pad[k]) fn(); pad[k] = b[i].pressed; }; edge(0, 3, () => { camMode = (camMode + 1) % 3; camInit = false; }); edge(1, 2, back); edge(2, 9, () => setPaused(!paused)); }
    inp.acc = acc; inp.brk = brk; inp.st = st; inp.hb = hb; inp.look = look;
  }
  const back = () => { const o = Island.nearRoad(car.p.x, car.p.z); reset(o.d < 1e8 ? o.i : lastI); };
  function setPaused(v) { paused = v; if (body) Phys.hold = v; menu.style.display = v ? 'flex' : 'none'; }
  function control(dt) {
    const vf = car.v.dot(bz), spd = Math.abs(vf), lim = Math.min(CC.steerLock, CC.steerSpeedK / Math.max(spd * spd, 1)); car.steer += (inp.st * lim - car.steer) * (1 - Math.exp(-dt * (Math.abs(inp.st) > .05 ? 6 : 9)));      // the faster it goes, the less lock it is given
    let thr = inp.acc, brk = inp.brk; if (car.gear > 0) { if (vf < .8 && brk > .1 && thr < .1) car.gear = -1; } else if (vf > -.8 && thr > .1 && brk < .1) car.gear = 1;
    if (car.gear < 0) { const t = thr; thr = brk; brk = t; }
    const ratio = (car.gear < 0 ? -REV : GEAR[car.gear]) * FINAL; let rpm = Math.max(spd / RAD * Math.abs(ratio) * 9.549, 900 + thr * 2200 * (1 - sm(0, 4, spd)));
    shiftT -= dt; if (car.gear > 0 && shiftT <= 0) { if (rpm > 6100 && car.gear < 5) { car.gear++; shiftT = .35; } else if (rpm < 2500 && car.gear > 1) { car.gear--; shiftT = .35; } }
    car.rpm += (Math.min(rpm, 7000) - car.rpm) * (1 - Math.exp(-dt * 12));
    const tq = CC.torque * (1 - Math.pow((car.rpm - 4300) / 5400, 2)) * thr * (car.rpm > 6850 ? 0 : 1) * (shiftT > .2 ? 0 : 1); drive = tq * ratio * .9 / RAD; brake = brk * CC.brake; car.thr = thr;
  }
  function sub(h) {
    if (body) pull(); const q = car.q; bx.set(1, 0, 0).applyQuaternion(q); by.set(0, 1, 0).applyQuaternion(q); bz.set(0, 0, 1).applyQuaternion(q); F.set(0, body ? 0 : -M * G9, 0); cm.copy(car.p).addScaledVector(by, body ? COMY : 0); Tq.set(0, 0, 0); let slip = 0, air = 0;
    for (let i = 0; i < 4; i++) { const L = WL[i], g = gnd[i]; A.copy(car.p).addScaledVector(bx, L.x).addScaledVector(by, L.y).addScaledVector(bz, L.z);
      const gy = g[0] + g[1] * (A.x - g[3]) + g[2] * (A.z - g[4]), len = (A.y - gy - RAD) / Math.max(by.y, .35); car.len[i] = clamp(len, REST - TRAV - .04, REST + .06);
      if (len > REST) { car.comp[i] = 0; air++; continue; }
      const c = Math.min(REST - len, TRAV + .08); let Fz = KS * c + CS * (c - car.comp[i]) / h; if (c > TRAV) Fz += 90000 * (c - TRAV); car.comp[i] = c; if (Fz <= 0) continue; Fz = Math.min(Fz, 4 * M * G9);
      nrm.set(-g[1], 1, -g[2]).normalize(); C.copy(A).addScaledVector(by, -(len + RAD)); r.subVectors(C, cm); vC.copy(car.w).cross(r).add(car.v);
      const st = i < 2 ? car.steer : 0; wf.copy(bz).multiplyScalar(Math.cos(st)).addScaledVector(bx, Math.sin(st)); wf.addScaledVector(nrm, -wf.dot(nrm)).normalize(); ws.crossVectors(nrm, wf);
      const vl = vC.dot(wf), vs = vC.dot(ws), mu = Math.max(.1, MU[g[5]] * (g[5] === 0 ? 1 - CC.wetGripLoss * wet - CC.iceGripLoss * iceK : 1 - .3 * iceK) * (1 - CC.snowGripLoss * snowK)) * (i > 1 && inp.hb > .5 ? .55 : 1), al = Math.atan2(vs, Math.abs(vl) + 1.2);
      let Fy = -mu * Fz * Math.sin(1.5 * Math.atan(9 * al)), Fx = (i < 2 ? drive * .5 : 0) - clamp(vl * 6, -1, 1) * (brake * (i < 2 ? .31 : .19) + (i > 1 ? inp.hb * 2600 : 0)) - vl * (RR[g[5]] + CC.snowRolling * snowK);
      const mag = Math.hypot(Fx, Fy), mx = mu * Fz; if (mag > mx) { Fx *= mx / mag; Fy *= mx / mag; }
      slip += Math.min(1, Math.abs(al) * 3 + (mag > mx ? .3 : 0)) * Math.min(1, Math.abs(vl) / 6 + Math.abs(vs) / 3);
      f.copy(nrm).multiplyScalar(Fz).addScaledVector(wf, Fx).addScaledVector(ws, Fy); F.add(f); if (!body) r.y *= .45; Tq.add(tmp.crossVectors(r, f)); car.spin[i] += vl / RAD * h; }
    F.addScaledVector(car.v, -CC.drag * car.v.length());
    if (body) { _i.x = F.x * h; _i.y = F.y * h; _i.z = F.z * h; body.applyImpulse(_i, true); _i.x = Tq.x * h; _i.y = Tq.y * h; _i.z = Tq.z * h; body.applyTorqueImpulse(_i, true); car.slip = slip / 4; car.air = air; return; }
    car.v.addScaledVector(F, h / M);
    let wx = car.w.dot(bx) + Tq.dot(bx) / IX * h, wy = car.w.dot(by) + Tq.dot(by) / IY * h, wz = car.w.dot(bz) + Tq.dot(bz) / IZ * h; const dmp = 1 - h * (air === 4 ? .2 : 1.2); wx *= dmp; wz *= 1 - h * (air === 4 ? .2 : 2.6); wy *= 1 - h * .4;
    car.w.set(0, 0, 0).addScaledVector(bx, wx).addScaledVector(by, wy).addScaledVector(bz, wz); car.p.addScaledVector(car.v, h);
    dq.set(car.w.x * h * .5, car.w.y * h * .5, car.w.z * h * .5, 0).multiply(q); q.x += dq.x; q.y += dq.y; q.z += dq.z; q.w += dq.w; q.normalize(); car.slip = slip / 4; car.air = air;
  }
  function sound() { const S = G.snd; if (!S || !S.ac || !S.out) return; const ac = S.ac;
    if (!snd) { const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = (type, fq, q) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = fq; fl.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(S.out); s.start(); return g; };
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; g.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(S.out); o1.start(); o2.start();
      snd = { o1, o2, lp, g, tire: noise('bandpass', 1100, 4), wind: noise('lowpass', 520, .5) }; }
    const now = ac.currentTime, act = on && !paused ? 1 : 0, fq = car.rpm / 60 * 2, sp = car.v.length();
    snd.o1.frequency.setTargetAtTime(fq, now, .03); snd.o2.frequency.setTargetAtTime(fq * .5, now, .03); snd.lp.frequency.setTargetAtTime(500 + car.thr * 2600 + car.rpm * .25, now, .05); snd.g.gain.setTargetAtTime(act * (.03 + .06 * car.thr), now, .05);
    snd.tire.gain.setTargetAtTime(act * Math.min(.14, car.slip * .2) * (car.surf === 0 ? 1 : .35), now, .05); snd.wind.gain.setTargetAtTime(act * Math.min(.1, Math.pow(sp / 45, 2) * .1), now, .1); }
  // one frame: input, physics in small steps, the car's model, the camera, the readout. Returns a line for the mode readout.
  function step(camera, dt) {
    if (!grp) return ''; readInput();
    if (!paused) { const te = G.tEnv === undefined ? G.t : G.tEnv; wet = sm(31.2, 36, te) * (1 - sm(68, 76, te)); if (typeof Weather !== 'undefined') { wet = Weather.S.wet; snowK = Weather.S.cover; iceK = Weather.S.ice; }
      if (body) pull(); bx.set(1, 0, 0).applyQuaternion(car.q); by.set(0, 1, 0).applyQuaternion(car.q); bz.set(0, 0, 1).applyQuaternion(car.q); control(dt);
      for (let i = 0; i < 4; i++) { const L = WL[i], g = gnd[i]; A.copy(car.p).addScaledVector(bx, L.x).addScaledVector(by, L.y).addScaledVector(bz, L.z); const s0 = Island.surf(A.x, A.z), y0 = s0[0], ty = s0[1];
        g[0] = y0; g[1] = (Island.surf(A.x + .4, A.z)[0] - y0) / .4; g[2] = (Island.surf(A.x, A.z + .4)[0] - y0) / .4; g[3] = A.x; g[4] = A.z; g[5] = ty; if (i === 0) car.surf = ty; }
      if (!body) { const n = clamp(Math.ceil(dt * 240), 1, 12), h = dt / n; for (let i = 0; i < n; i++) sub(h); }
      const road = Island.nearRoad(car.p.x, car.p.z); car.off = road.d; if(road.d < 60) lastI = road.i;
      if (body) { hitT -= dt; const dv = tmp.copy(car.v).sub(vPrev).length(); vPrev.copy(car.v); if (dv > 2.2 && hitT <= 0) { Phys.thump(Math.min(1, dv / 9)); hitT = .22; } }      // a jolt in the velocity is a hit: let it be heard
      const sunk = car.p.y < .6 && Island.surf(car.p.x, car.p.z)[0] < -.6; car.bad = by.y < .3 || (!body && car.p.y < -1.2) ? car.bad + dt : sunk ? car.bad + dt * .4 : 0; if (car.bad > 1.6 || !isFinite(car.p.x) || car.p.y < -6) back(); }
    brakeLight.emissiveIntensity=inp.brk || inp.hb ? 3.2 : .64;
    grp.position.copy(car.p); grp.quaternion.copy(car.q); wheels.forEach((w, i) => { w.position.set(WL[i].x, WL[i].y - car.len[i], WL[i].z); w.rotation.set(car.spin[i], i < 2 ? car.steer : 0, 0); });
    if (typeof FX !== 'undefined' && !paused) for (let k = 0; k < 2; k++) { const i = k + 2, sv = car.v.length(), loose = car.surf !== 0 ? 1 : 0, spray = snowK > .25 || wet > .5 ? 1 : 0, slide = car.slip > .45 ? 1 : 0, emit = car.comp[i] > 0 && sv > 4 && (loose || spray || slide);
      tr1.copy(car.p).addScaledVector(bx, WL[i].x).addScaledVector(by, WL[i].y - car.len[i] - RAD + .12).addScaledVector(bz, WL[i].z - .25);
      if (emit && trOn[k] && tr1.distanceToSquared(tr0[k]) > .16) { FX.trail(tr0[k].clone(), tr1.clone(), (.16 + .1 * Math.min(1, sv / 20)) * (spray ? 1.3 : 1), spray || (slide && !loose) ? 1 : 0); tr0[k].copy(tr1); } else if (!trOn[k] || !emit) tr0[k].copy(tr1); trOn[k] = emit; }
    const sp = car.v.length(), sgn = inp.look ? -1 : 1; dir.copy(bz); dir.y = 0; if (sp > 4) dir.lerp(tmp.copy(car.v).setY(0).normalize(), .35); dir.normalize();
    if (camMode === 2) { camera.position.copy(car.p).addScaledVector(by, .64).addScaledVector(bz, .3); camera.quaternion.copy(car.q).multiply(QY); if (inp.look) camera.quaternion.multiply(QY); }
    else { const dist = camMode ? 9.5 : 6.4, hgt = camMode ? 3.4 : 2.2; tgt.copy(car.p).addScaledVector(dir, -dist * sgn); tgt.y += hgt; if (!camInit) { camP.copy(tgt); camInit = true; } camP.lerp(tgt, 1 - Math.exp(-dt * 6));
      camP.y = Math.max(camP.y, Island.surf(camP.x, camP.z)[0] + .7); camera.position.copy(camP); tgt.copy(car.p).addScaledVector(dir, 2.5 * sgn); tgt.y += .9; mm.lookAt(camP, tgt, YAX); camera.quaternion.setFromRotationMatrix(mm); }
    camera.fov = lerp(58, 74, sm(0, 45, sp)); camera.near = .3;
    const kmh = Math.round(sp * 3.6), bar = '▮'.repeat(Math.round(clamp(car.rpm / 7000) * 14)).padEnd(14, '▯');
    hud.textContent = `${kmh} km/h   ${car.gear < 0 ? 'R' : 'D'+car.gear}\n${bar}` + (car.off > 9 ? '\nR  도로로 복귀' : '');
    sound(); return ['아스팔트', '갓길', '풀밭', '모래'][car.surf] + (iceK > .3 ? ' · 빙판' : snowK > .3 ? ' · 눈길' : wet > .3 ? ' · 젖음' : '') + ' · C 카메라 · Esc 조작법';
  }
  function enter() { on = true; grp.visible = true; if (body) { body.setEnabled(true); Phys.prime(car.p.x, car.p.z); } hud.style.display = ''; keys.clear(); camInit = false; }
  function park() {
    reset(RD.n-6); grp.visible = true; grp.position.copy(car.p); grp.quaternion.copy(car.q);
    for (let i=0;i<wheels.length;i++) {
      const anchor=tmp.copy(WL[i]).applyQuaternion(car.q).add(car.p);
      car.len[i]=anchor.y-Island.support(anchor.x,anchor.z)-RAD;
      wheels[i].position.set(WL[i].x,WL[i].y-car.len[i],WL[i].z);
      wheels[i].rotation.set(0,0,0);
    }
    doorHinge.rotation.y=0; car.spin.fill(0); hitT=0; trOn.fill(false); drive=brake=0;
  }
  function finish() {
    on=false; if(body) body.setEnabled(false);
    hud.style.display='none'; setPaused(false); keys.clear();
    Object.assign(touch,{acc:0,brk:0,st:0,hb:0}); sound();
  }
  function leave() { finish(); grp.visible=false; doorHinge.rotation.y=0; }
  addEventListener('keydown', e => { if (!on || e.metaKey || e.ctrlKey || e.altKey) return; keys.add(e.code);
    if (e.code === 'KeyC' && !e.repeat) { camMode = (camMode + 1) % 3; camInit = false; } else if (e.code === 'KeyR' && !e.repeat) back(); else if (e.code === 'Escape') setPaused(!paused);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
  addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
  return { build, step, enter, leave, finish, park, reset, car, inp, keys, touch,
    setDoor(open) { doorHinge.rotation.y=-1.03*open; },
    get on() { return on; }, get body() { return body; }, get paused() { return paused; },
    recover:back };
})();
