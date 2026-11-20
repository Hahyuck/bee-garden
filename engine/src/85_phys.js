'use strict';
// ---- physics for the whole world, not for one object: a rigid-body world (Rapier, https://rapier.rs, Apache-2.0) that every mode shares.
//      What is solid: the island's ground (streamed as tiles of triangles around whoever is looking), tree trunks, boulders.
//      What moves: anything spawned through Phys.spawn (crates, barrels, cones, stones) and bodies other modules bring (the car).
//      What acts on them: gravity, contact and friction (the solver), the sea (buoyancy and drag below the waterline), the storm's wind, blasts.
//      Fixed step of 1/240 s; modules that make their own forces hook into each step with Phys.pre. If the engine cannot be loaded, Phys.ready stays false. ----
const Phys = (() => {
  const PC = CFG.phys, URL = PC.engineUrl, H = PC.step, TS = PC.tile, SEA = PC.seaLevel;
  let R = null, world = null, ready = false, acc = 0, hold = false, scene = null, steps = 0, stepMs = 0;
  const pre = [], bodies = [], tiles = new Map(), cells = new Map(), queue = [], focus = new THREE.Vector3(1e9, 0, 0), wind = new THREE.Vector3(), blasts = [];
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = { x: 0, y: 0, z: 0 }, _d = new THREE.Vector3(), _f = new THREE.Vector3();
  const std = (c, m, ro) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: ro });
  // the kinds of loose thing the world knows how to make. vol: displaced volume (for the sea), area: what the wind gets hold of
  const KIND = {
    crate: { n: 220, geo: () => new THREE.BoxGeometry(.6, .5, .6), col: c => c.cuboid(.3, .25, .3), rho: 210, fr: .7, re: .05, vol: .18, r: .3, area: .3, tint: 0xd9c592 },
    barrel: { n: 120, geo: () => new THREE.CylinderGeometry(.29, .29, .88, 18), col: c => c.cylinder(.44, .29), rho: 130, fr: .5, re: .15, vol: .23, r: .4, area: .5, tint: 0x2d6fb5 },
    cone: { n: 200, geo: () => { const g = new THREE.ConeGeometry(.2, .7, 14); return g; }, col: c => c.cone(.35, .2), rho: 110, fr: .8, re: .1, vol: .03, r: .3, area: .14, tint: 0xf26a1b },
    stone: { n: 160, geo: () => new THREE.IcosahedronGeometry(.16, 1), col: c => c.ball(.16), rho: 2500, fr: .7, re: .25, vol: .017, r: .16, area: .08, tint: 0x8d8a86, ccd: true },
  };
  const tkey = (kx, kz) => kx + ',' + kz, rr = (a, b) => a + (b - a) * Math.random(), pick = a => a[Math.floor(Math.random() * a.length)];

  async function init(sc) { scene = sc; const t0 = performance.now();
    try { const m = await import(URL); R = m.default || m; await R.init(); world = new R.World({ x: 0, y: PC.gravity, z: 0 }); world.timestep = H;
      for (const k in KIND) { const K = KIND[k], im = new THREE.InstancedMesh(K.geo(), std(0xffffff, k === 'barrel' ? .5 : 0, k === 'barrel' ? .45 : .85), K.n); im.count = 0; im.frustumCulled = false; im.castShadow = im.receiveShadow = true; im.setColorAt(0, _c.set(K.tint)); scene.add(im); K.im = im; K.used = 0; }
      statics(); ready = true; G.tick.push((t, dt) => step(dt)); G.info.phys = { engine: 'rapier ' + (R.version ? R.version() : ''), ms: Math.round(performance.now() - t0) };
    } catch (e) { G.info.phys = { off: String(e && e.message || e) }; console.warn('physics engine not loaded; the world runs without it', e); }
    return ready; }

  // ---- what stands still: trunks and boulders, sorted into 90 m cells and only made solid near the focus ----
  function statics() { const put = (x, z, it) => { const k = tkey(Math.floor(x / 90), Math.floor(z / 90)); let c = cells.get(k); if (!c) cells.set(k, c = { x: (Math.floor(x / 90) + .5) * 90, z: (Math.floor(z / 90) + .5) * 90, items: [], cols: null }); c.items.push(it); };
    if (Island.FOREST) for (const c of Island.FOREST.list) for (const L of c.t) for (const t of L) put(t[0], t[2], [0, t[0], t[1], t[2], .2 * t[4], 3.2 * t[5]]);
    if (Island.ROCKS) for (const r of Island.ROCKS) put(r[0], r[2], [1, r[0], r[1], r[2], r[3], r[4]]); }
  function cellOn(c) { c.cols = c.items.map(it => world.createCollider(it[0] === 0 ? R.ColliderDesc.cylinder(it[5], it[4]).setTranslation(it[1], it[2] + it[5], it[3]).setFriction(.6)
    : R.ColliderDesc.ball(.86 * Math.cbrt(it[4] * it[4] * it[5] * .72)).setTranslation(it[1], it[2], it[3]).setFriction(.8))); }
  function cellOff(c) { for (const col of c.cols) world.removeCollider(col, false); c.cols = null; }

  // ---- the ground: one triangle mesh per 32 m tile, sampled from the same height function the eye and the wheels use ----
  function tileOn(kx, kz) { const k = tkey(kx, kz); if (tiles.has(k)) return; const n = TS + 1, v = new Float32Array(n * n * 3), ix = new Uint32Array(TS * TS * 6); let o = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = kx * TS + i, z = kz * TS + j; v[o++] = x; v[o++] = Island.surf(x, z)[0]; v[o++] = z; }
    o = 0; for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; ix[o++] = a; ix[o++] = c; ix[o++] = b; ix[o++] = b; ix[o++] = c; ix[o++] = d; }
    tiles.set(k, world.createCollider(R.ColliderDesc.trimesh(v, ix).setFriction(.9))); }
  function prime(x, z, rad = 1) { if (!ready) return; const kx = Math.floor(x / TS), kz = Math.floor(z / TS); for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) tileOn(kx + a, kz + b); }
  function stream() { const kx = Math.floor(focus.x / TS), kz = Math.floor(focus.z / TS);
    if (!queue.length) for (let r = 0; r <= PC.tileRing; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (Math.max(Math.abs(a), Math.abs(b)) === r && !tiles.has(tkey(kx + a, kz + b))) queue.push([kx + a, kz + b]);
    if (queue.length) { const t = queue.shift(); if (Math.max(Math.abs(t[0] - kx), Math.abs(t[1] - kz)) <= PC.tileRing + 1) tileOn(t[0], t[1]); }
    for (const [k, col] of tiles) { const s = k.split(','); if (Math.max(Math.abs(+s[0] - kx), Math.abs(+s[1] - kz)) > PC.tileRing + 2) { world.removeCollider(col, false); tiles.delete(k); } }
    for (const c of cells.values()) { const d = Math.hypot(c.x - focus.x, c.z - focus.z); if (!c.cols && d < 150) cellOn(c); else if (c.cols && d > 230) cellOff(c); } }

  // ---- loose things ----
  function spawn(kind, x, y, z, o = {}) { if (!ready) return null; const K = KIND[kind]; if (!K || K.used >= K.n) return null;
    const bd = R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setAngularDamping(.25).setLinearDamping(.02); if (o.q) bd.setRotation(o.q); if (o.v) bd.setLinvel(o.v.x, o.v.y, o.v.z); if (K.ccd) bd.setCcdEnabled(true);
    const b = world.createRigidBody(bd); world.createCollider(K.col(R.ColliderDesc).setDensity(K.rho).setFriction(K.fr).setRestitution(K.re), b);
    const e = { b, kind, i: K.used++, vol: K.vol, r: K.r, area: K.area, on: true, wet: 0 }; K.im.count = K.used; K.im.setColorAt(e.i, _c.set(o.color === undefined ? K.tint : o.color)); if (K.im.instanceColor) K.im.instanceColor.needsUpdate = true;
    bodies.push(e); show(e); return e; }
  // a body another module made and draws itself (the car): it gets the sea, the wind and the blasts like everything else
  function adopt(b, o) { const e = { b, kind: null, vol: o.vol, r: o.r, area: o.area || 0, on: true, manual: true, wet: 0, lift: o.lift || null }; bodies.push(e); return e; }
  function show(e) { const K = KIND[e.kind], t = e.b.translation(), q = e.b.rotation(); _m.compose(_p.set(t.x, t.y, t.z), _q.set(q.x, q.y, q.z, q.w), _s.set(1, 1, 1)); K.im.setMatrixAt(e.i, _m); K.im.instanceMatrix.needsUpdate = true; }

  // ---- what the environment does to a body, each step: the sea carries and slows it, the storm pushes it ----
  function forces(h) { for (const e of bodies) { if (!e.on || e.b.isSleeping() && !e.wet && wind.lengthSq() < 9) continue; const b = e.b, t = b.translation(), sea = SEA + .12 * Math.sin(G.t * 1.1 + t.x * .21 + t.z * .17);
      const sub = clamp((sea - (t.y - e.r)) / (2 * e.r)); e.wet = sub;
      if (sub > 0) { const m = b.mass(), v = b.linvel(), w = b.angvel(), up = e.vol * PC.waterDensity * -PC.gravity * sub * h, wd = PC.waterDrag; _v.x = -v.x * m * Math.min(1, wd * sub * h); _v.y = up - v.y * m * Math.min(1, 2 * wd * sub * h); _v.z = -v.z * m * Math.min(1, wd * sub * h);
        if (e.lift) { const q = b.rotation(); _d.set(e.lift[0], e.lift[1], e.lift[2]).applyQuaternion(_q.set(q.x, q.y, q.z, q.w)); _f.set(t.x + _d.x, t.y + _d.y, t.z + _d.z); b.applyImpulseAtPoint(_v, _f, true); } else b.applyImpulse(_v, true);      // lifted from above its centre, a hull rights itself
        const k = 1 - Math.min(1, 2.2 * sub * h); _v.x = w.x * k; _v.y = w.y * k; _v.z = w.z * k; b.setAngvel(_v, true); }
      else if (e.area && wind.lengthSq() > 9) { const v = b.linvel(); _d.set(wind.x - v.x, 0, wind.z - v.z); const k = .5 * PC.airDensity * 1.1 * e.area * _d.length() * h; _v.x = _d.x * k; _v.y = 0; _v.z = _d.z * k; b.applyImpulse(_v, true); } } }
  // a blast: an impulse falling off with distance, on everything loose within reach; and a short flash to see it by
  function blast(x, y, z, power = PC.blast.power, rad = PC.blast.radius) { if (!ready) return 0; let n = 0;
    for (const e of bodies) { if (!e.on) continue; const t = e.b.translation(); _d.set(t.x - x, t.y - y + .5, t.z - z); const d = _d.length(); if (d > rad) continue; const m = e.b.mass(), J = Math.min(power * (1 - d / rad), m * 22); _d.multiplyScalar(J / Math.max(d, .2));
      _v.x = _d.x; _v.y = _d.y; _v.z = _d.z; e.b.applyImpulse(_v, true); _v.x = rr(-1, 1) * J * .05; _v.y = rr(-1, 1) * J * .05; _v.z = rr(-1, 1) * J * .05; e.b.applyTorqueImpulse(_v, true); n++; }
    if (typeof FX !== 'undefined') { FX.blast(x, y, z, rad); thump(1); return n; }
    const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending })); fl.position.set(x, y, z); scene.add(fl); blasts.push({ m: fl, t: 0, rad });
    thump(1); return n; }
  function thump(k) { const S = G.snd; if (!S || !S.ac || !S.out) return; const ac = S.ac, n = ac.sampleRate * .5 | 0, bf = ac.createBuffer(1, n, ac.sampleRate), d = bf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = bf; lp.type = 'lowpass'; lp.frequency.value = 160 + 500 * k; g.gain.value = Math.min(.5, .3 * k); s.connect(lp); lp.connect(g); g.connect(S.out); s.start(); }
  function ray(o, d, max = 200) { if (!ready) return null; const hit = world.castRay(new R.Ray(o, d), max, true); if (!hit) return null; const t = hit.timeOfImpact !== undefined ? hit.timeOfImpact : hit.toi; return { t, x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }; }

  // ---- one frame: stream the solid world to the focus, then as many fixed steps as the frame's time holds ----
  function step(dt) { if (!ready) return; const car = G.drive && typeof Drive !== 'undefined' ? Drive.car : null; focus.copy(car ? car.p : G.camera.position); stream();
    if (typeof Weather !== 'undefined') wind.copy(Weather.S.wind); else wind.set(0, 0, 0);
    for (const e of bodies) { if (e.manual) continue; const t = e.b.translation(), has = tiles.has(tkey(Math.floor(t.x / TS), Math.floor(t.z / TS))) && t.y > -40; if (has !== e.on) { e.on = has; e.b.setEnabled(has); } }
    for (let i = blasts.length - 1; i >= 0; i--) { const B = blasts[i]; B.t += dt; const k = B.t / .45; if (k >= 1) { scene.remove(B.m); B.m.geometry.dispose(); B.m.material.dispose(); blasts.splice(i, 1); } else { B.m.scale.setScalar(B.rad * .75 * Math.sqrt(k)); B.m.material.opacity = .8 * (1 - k) * (1 - k); } }
    if (hold) return; acc = Math.min(acc + dt, .06); const t0 = performance.now(); let n = 0;
    while (acc >= H) { acc -= H; for (const f of pre) f(H); forces(H); world.step(); n++; } steps = n; stepMs += (performance.now() - t0 - stepMs) * .05;
    for (const e of bodies) if (e.kind && e.on && !e.b.isSleeping()) show(e); }

  // ---- things to do with it from any mode: F throws a stone, G sets down a hive crate, X sets off a blast where you look ----
  function aim() { const cam = G.camera; cam.getWorldDirection(_d); return { o: { x: cam.position.x, y: cam.position.y, z: cam.position.z }, d: { x: _d.x, y: _d.y, z: _d.z } }; }
  addEventListener('keydown', e => { if (!ready || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return; const c = e.code; if (c !== 'KeyF' && c !== 'KeyG' && c !== 'KeyX') return; const a = aim(); prime(a.o.x, a.o.z);
    if (c === 'KeyF') spawn('stone', a.o.x + a.d.x * 1.2, a.o.y + a.d.y * 1.2 - .1, a.o.z + a.d.z * 1.2, { v: { x: a.d.x * PC.throwSpeed, y: a.d.y * PC.throwSpeed + 3, z: a.d.z * PC.throwSpeed } });
    else if (c === 'KeyG') { const x = a.o.x + a.d.x * 9, z = a.o.z + a.d.z * 9; prime(x, z, 0); spawn('crate', x, Math.max(Island.surf(x, z)[0], SEA) + 2.2, z, { color: pick([0xd9c592, 0xcdb37a, 0xe6d6a6]) }); }
    else { const h = ray(a.o, a.d, 160); if (h) blast(h.x, h.y + .3, h.z); else blast(a.o.x + a.d.x * 20, a.o.y + a.d.y * 20, a.o.z + a.d.z * 20); } });

  return { init, step, spawn, adopt, blast, ray, prime, thump, pre, KIND, bodies, wind, H, SEA,
    get ready() { return ready; }, get R() { return R; }, get world() { return world; }, get hold() { return hold; }, set hold(v) { hold = v; },
    get stats() { return { bodies: bodies.length, awake: bodies.filter(e => e.on && !e.b.isSleeping()).length, tiles: tiles.size, cells: [...cells.values()].filter(c => c.cols).length, steps, stepMs: +stepMs.toFixed(2) }; } };
})();
