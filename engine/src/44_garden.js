'use strict';
// ---- the garden of "Bee Garden", planted on the terrace at the island's foot. Prototypes are modelled in centimetres and placed at
//      1:100, so a blade of grass is a blade of grass beside the fort's 100 m tower. Garden.bee(t, dt, camera) is the bee's own eye:
//      a keyed flight (hive, lawn, clover, cosmos, the cat, a sunflower, home) with spring-driven gaze, saccades and hover. ----
const Garden = (() => {
  const K = FXKit.geo, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), R = rng(20261119), rr = (a, b) => a + (b - a) * R(), pick = a => a[Math.floor(R() * a.length)], LOW = Q.has('low');
  const cv = (hex, dv = .05) => new THREE.Color(hex).offsetHSL(rr(-.015, .015), rr(-.05, .05), rr(-dv, dv)), S = .01;
  const bez = (a, b, c, n = 6) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push(V(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z)); } return o; };
  // ---- places (metres, in the garden's own frame: origin at the middle of the terrace) ----
  const COS = V(-1.5, .724, -4.3), CLV = V(-3.3, .067, .26), CAT = V(1.5, 0, -1.5), NOSE = V(1.5, .351, -1.366), HIVE = V(-6.7, 0, 3.8), ENT = V(-6.48, .45, 3.805);
  const SF = V(Math.cos(.61), Math.sin(.61), 0), SH = V(6.3, 1.72, -3.8), SQ = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), SF), SEX = V(1, 0, 0).applyQuaternion(SQ), SEY = V(0, 1, 0).applyQuaternion(SQ);
  const sunW = (u, v, h) => SH.clone().addScaledVector(SEX, u).addScaledVector(SEY, v).addScaledVector(SF, h), discH = (u, v) => (1.6 * Math.sqrt(Math.max(0, 1 - (u * u + v * v) / 72.25)) + .92) * S;
  const sL = sunW(.052, -.02, discH(5.2, -2)), sW = sunW(.014, .012, discH(1.4, 1.2)), sHov = sunW(0, 0, .18).add(V(0, .02, 0)), sOff = sunW(0, 0, .09).add(V(0, .05, 0));
  const KEYS = [[0, -6.45, .4447, 3.805], [1.5, -6.436, .4447, 3.804], [2.6, -6.436, .4447, 3.804], [3.5, -6.34, .5, 3.78], [4.7, -6.12, .64, 3.66], [5.9, -5.96, .66, 3.4], [6.9, -5.86, .58, 3.12], [8.3, -5.52, .34, 2.72], [10, -4.7, .17, 2.0],
    [12.2, -3.84, .115, .92], [13.6, -3.4, .095, .38], [14.4, -3.335, .083, .295], [15.6, -3.326, .08, .286], [16.6, -3.18, .12, .06], [18.7, -2.32, .4, -2.5], [20.6, -1.76, .66, -3.84], [22.4, -1.55, .742, -4.235], [23.6, -1.52, .738, -4.273], [24.2, -1.507, .7312, -4.2975],
    [26.2, -1.5005, .7327, -4.3], [29.8, -1.5005, .7327, -4.3], [30.5, -1.497, .7324, -4.302], [31.2, -1.47, .775, -4.285], [32.4, -1.12, .6, -4.12], [33.6, -.7, .52, -4.04], [34.8, -.2, .5, -3.98], [36, .4, .52, -3.6], [37.2, 1.04, .47, -2.32], [38.4, 1.6, .43, -1.76], [39.3, 1.63, .39, -1.40],
    [40.1, 1.51, .365, -1.226], [40.6, 1.505, .358, -1.274], [40.7, 1.505, .358, -1.274], [41.05, 1.44, .47, -1.19], [41.8, 1.5, .62, -1.08], [42.8, 1.96, .54, -.72], [45, 3.6, .6, -1.6], [47.2, 5.2, 1.2, -3.0], [48.6, 5.9, 1.6, -3.52], [49.8, sHov.x, sHov.y, sHov.z],
    [51.3, sL.x, sL.y, sL.z], [54.8, sW.x, sW.y, sW.z], [56.4, sW.x, sW.y, sW.z], [57.1, sOff.x, sOff.y, sOff.z], [59.5, 4.6, 3.2, -2.0], [62.5, -1, 3.6, 1], [65.5, -5.6, 1.2, 3.6], [67.4, -6.28, .54, 3.81], [68.5, -6.415, .456, 3.809], [68.9, -6.418, .4447, 3.809], [71, -6.46, .4447, 3.806], [75, -6.46, .4447, 3.806]];
  const DUR = 75;
  function pchip(ts, ys) { const n = ts.length, h = [], d = [], m = new Array(n); for (let i = 0; i < n - 1; i++) { h[i] = ts[i + 1] - ts[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; } m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) { if (d[i - 1] * d[i] <= 0) m[i] = 0; else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); } }
    return t => { t = clamp(t, ts[0], ts[n - 1]); let lo = 0, hi = n - 2; while (lo < hi) { const md = (lo + hi + 1) >> 1; if (ts[md] <= t) lo = md; else hi = md - 1; } const s = (t - ts[lo]) / h[lo], s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * ys[lo] + (s3 - 2 * s2 + s) * h[lo] * m[lo] + (-2 * s3 + 3 * s2) * ys[lo + 1] + (s3 - s2) * h[lo] * m[lo + 1]; }; }
  const mkPath = keys => { const ts = keys.map(k => k[0]), fx = pchip(ts, keys.map(k => k[1])), fy = pchip(ts, keys.map(k => k[2])), fz = pchip(ts, keys.map(k => k[3])); return (t, o = V()) => o.set(fx(t), fy(t), fz(t)); };
  const pathP = mkPath(KEYS), sn = (t, s) => (Math.sin(1.7 * t + s) + .6 * Math.sin(3.1 * t + 2.3 * s) + .3 * Math.sin(5.9 * t + 4.1 * s)) / 1.9, win = (t, a, b, r = .3) => sm(a, a + r, t) * (1 - sm(b - r, b, t));
  const RG = { x0: -9, z0: -7, c: .2, nx: 90, nz: 65, d: null };
  { const pts = []; for (let t = 0; t <= DUR; t += .2) { const p = pathP(t); if (p.y < 1.3) pts.push([p.x, p.z]); } RG.d = new Float32Array(RG.nx * RG.nz);
    for (let j = 0; j < RG.nz; j++) for (let i = 0; i < RG.nx; i++) { const x = RG.x0 + (i + .5) * RG.c, z = RG.z0 + (j + .5) * RG.c; let m = 1e9; for (const p of pts) { const dd = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (dd < m) m = dd; } RG.d[j * RG.nx + i] = Math.sqrt(m); } }
  const routeD = (x, z) => RG.d[clamp(Math.floor((z - RG.z0) / RG.c), 0, RG.nz - 1) * RG.nx + clamp(Math.floor((x - RG.x0) / RG.c), 0, RG.nx - 1)];

  // ---- prototypes (centimetres) ----
  function tuft(h, nb) { return K.merge(Array.from({ length: nb }, () => K.tag(K.leaf(h * rr(.6, 1.15), rr(.24, .38), { ns: 3, nw: 1, bend: rr(.2, 1), shape: K.shBlade }), cv('#6f9a35', .07), 3, K.M([rr(-1.3, 1.3), 0, rr(-1.3, 1.3)], [rr(.05, .45), rr(0, TAU), 0])))); }
  function clover() { const a = []; for (let s = 0; s < 6; s++) { const b = V(rr(-2.5, 2.5), 0, rr(-2.5, 2.5)), top = V(b.x + rr(-1, 1), rr(3.5, 6.5), b.z + rr(-1, 1)); a.push(K.tag(K.tube([b, top], .05, 3), '#5f9a45', 0)); const az = rr(0, TAU);
      for (let k = 0; k < 3; k++) a.push(K.tag(K.leaf(1.25, 1.3, { ns: 3, nw: 2, shape: K.shRound, fold: .15 }), cv('#4c8c38'), 1, K.M([top.x, top.y, top.z], [1.25, az + k * TAU / 3, 0]))); } return K.merge(a); }
  function cloverFlower() { const a = [], h = 6.2; a.push(K.tag(K.tube([V(), V(0, h, 0)], .06, 4), '#6a9a4a', 0));
    for (let i = 0; i < 26; i++) { const u = rr(-.5, 1), an = rr(0, TAU), s = Math.sqrt(1 - u * u), d = V(s * Math.cos(an), u, s * Math.sin(an)); a.push(K.tag(K.sph(5, 4), cv(i % 4 ? '#f3ecdc' : '#e9bcd0', .03), 8, K.Md(V(0, h + .5, 0).addScaledVector(d, .55), d, [.17, .36, .17]))); } return K.merge(a); }
  function daisy(col, pl, n, disc) { const a = [], h = rr(6, 9); a.push(K.tag(K.tube([V(), V(rr(-.6, .6), h, rr(-.6, .6))], .06, 3), '#6a9a4a', 0));
    for (let k = 0; k < n; k++) a.push(K.tag(K.leaf(pl * rr(.85, 1.1), pl * .32, { ns: 2, nw: 1, shape: K.shPetal, bend: .3 }), col, 2, K.M([0, h, 0], [k % 2 ? 1.38 : 1.15, k / n * TAU, 0])));
    a.push(K.tag(K.sph(8, 5), disc, 8, K.M([0, h + .05, 0], [0, 0, 0], [pl * .36, pl * .18, pl * .36]))); return K.merge(a); }
  function cosmos(hi, H, col) { const a = [], pts = bez(V(), V(0, H * .6, 0), hi ? V(0, H, 0) : V(rr(-7, 7), H, rr(-7, 7))); a.push(K.tag(K.tube(pts, t => .16 - .06 * t, hi ? 6 : 4), '#4f7a2e', 0));
    const top = pts[pts.length - 1], Mh = K.M([top.x, top.y, top.z], hi ? [0, 0, 0] : [rr(-.35, .35), 0, rr(-.35, .35)]);
    for (let k = 0; k < 8; k++) a.push(K.tag(K.leaf(rr(3.5, 3.9), rr(1.8, 2.05), { ns: hi ? 8 : 3, nw: hi ? 4 : 2, bend: rr(.25, .5), fold: -.18, shape: K.shPetal }), col, 2, K.mul(Mh, K.M([0, .15, 0], [1.32 + rr(-.08, .08), k / 8 * TAU + rr(-.08, .08), 0]))));
    a.push(K.tag(K.sph(hi ? 20 : 8, hi ? 12 : 5), '#e2a91a', 8, K.mul(Mh, K.M([0, .4, 0], [0, 0, 0], [1, .45, 1]))));
    if (hi) for (let i = 0; i < 120; i++) { const r = .95 * Math.sqrt((i + .5) / 120), an = i * 2.39996; a.push(K.tag(K.sph(8, 6), i % 3 ? '#f4c81f' : '#b9781a', 8, K.mul(Mh, K.M([r * Math.cos(an), .4 + .45 * Math.sqrt(1 - r * r), r * Math.sin(an)], [0, 0, 0], [.065, .1, .065])))); }
    for (let i = 0; i < 7; i++) { const p = pts[1 + (i % 4)]; a.push(K.tag(K.leaf(rr(5, 9), .45, { ns: 3, nw: 1, bend: .7, shape: K.shBlade }), '#5d8a3a', 1, K.M([p.x, p.y, p.z], [rr(.7, 1.2), rr(0, TAU), 0]))); } return K.merge(a); }
  function poppy() { const a = [], H = rr(46, 64), pts = bez(V(), V(rr(-3, 3), H * .6, rr(-3, 3)), V(rr(-5, 5), H, rr(-5, 5))); a.push(K.tag(K.tube(pts, .13, 4), '#5d8a3a', 0)); const top = pts[pts.length - 1], Mh = K.M([top.x, top.y, top.z], [rr(-.3, .3), 0, rr(-.3, .3)]);
    for (let k = 0; k < 6; k++) a.push(K.tag(K.leaf(rr(4.2, 5), rr(4.8, 5.6), { ns: 5, nw: 4, bend: -rr(.5, 1), fold: .25, wave: .5, shape: v => Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(v, 1.25))), .45) }), cv('#e0361a', .03), 2, K.mul(Mh, K.M([0, 0, 0], [k < 4 ? .85 : .5, k * TAU / 4 + (k < 4 ? 0 : .8), 0]))));
    a.push(K.tag(K.sph(8, 6), '#2a1a2e', 8, K.mul(Mh, K.M([0, .5, 0], [0, 0, 0], [.55, .7, .55]))));
    for (let k = 0; k < 5; k++) a.push(K.tag(K.leaf(rr(9, 14), rr(2.5, 3.5), { ns: 5, nw: 2, bend: .9, fold: .2, wave: .9 }), cv('#5a8a48'), 1, K.M([0, 0, 0], [rr(.5, 1), rr(0, TAU), 0]))); return K.merge(a); }
  function lavender() { const a = []; for (let s = 0; s < 12; s++) { const az = rr(0, TAU), ln = rr(4, 12), H = rr(33, 46), pts = bez(V(Math.cos(az) * 2, 0, Math.sin(az) * 2), V(Math.cos(az) * ln * .3, H * .6, Math.sin(az) * ln * .3), V(Math.cos(az) * ln, H, Math.sin(az) * ln), 4);
      a.push(K.tag(K.tube(pts, .09, 3), '#7f9a6a', 0)); for (let k = 0; k < 13; k++) { const f = k / 12, p = V().lerpVectors(pts[3], pts[4], f).add(V(rr(-.35, .35), -(1 - f) * 2 + 1.5, rr(-.35, .35))); a.push(K.tag(K.sph(4, 3), cv('#7654c8', .06), 8, K.M([p.x, p.y, p.z], [0, 0, 0], [.4, .55, .4]))); } }
    for (let k = 0; k < 16; k++) a.push(K.tag(K.leaf(rr(6, 11), .55, { ns: 2, nw: 1, bend: .4, shape: K.shBlade }), cv('#8fa58a'), 1, K.M([rr(-2, 2), 0, rr(-2, 2)], [rr(.3, .95), rr(0, TAU), 0]))); return K.merge(a); }
  const hosta = () => K.merge(Array.from({ length: 9 }, (_, k) => K.tag(K.leaf(rr(15, 24), rr(8, 11), { ns: 6, nw: 4, bend: rr(.7, 1.25), fold: .3 }), cv(k % 3 ? '#3f7d33' : '#5c9440', .05), 1, K.M([0, 0, 0], [rr(.3, .95), k / 9 * TAU + rr(-.2, .2), 0]))));
  function sunflower(hi) { const a = [], H = hi ? 172 : rr(150, 185), hc = V(8, H, 0), back = hc.clone().addScaledVector(SF, -2.8); a.push(K.tag(K.tube(bez(V(), V(0, H * .65, 0), back, 8), t => 1.7 - .6 * t, 6), '#5a8a34', 0));
    for (let i = 0; i < 9; i++) a.push(K.tag(K.leaf(rr(18, 26), rr(13, 18), { ns: 6, nw: 4, bend: rr(.6, 1.1), fold: .2, wave: .4, shape: v => Math.pow(Math.sin(Math.PI * Math.pow(v, .5)), .9) }), cv('#4c8030', .05), 1, K.M([0, 22 + i * (H - 60) / 9, 0], [rr(.9, 1.3), i * 2.4 + rr(-.3, .3), 0])));
    const Hm = new THREE.Matrix4().compose(hc, SQ, V(1, 1, 1)); a.push(K.tag(K.sph(16, 8), '#5c8a36', 0, K.mul(Hm, K.M([0, 0, -1.2], [0, 0, 0], [8.2, 8.2, 2.6]))), K.tag(K.sph(24, 10), '#33210e', 8, K.mul(Hm, K.M([0, 0, 0], [0, 0, 0], [8.5, 8.5, 1.6]))));
    const nF = hi ? 760 : 130; for (let i = 0; i < nF; i++) { const r = 8.3 * Math.sqrt((i + .5) / nF), an = i * 2.39996, z = 1.6 * Math.sqrt(Math.max(0, 1 - r * r / 72.25));
      a.push(K.tag(K.sph(hi ? 7 : 4, hi ? 5 : 3), r > 5.6 ? cv('#dba51c', .05) : r > 3.2 ? '#7a5216' : '#5f6a24', 8, K.mul(Hm, K.M([r * Math.cos(an), r * Math.sin(an), z + .12], [0, 0, 0], hi ? [.27, .27, .42] : [.6, .6, .5])))); }
    for (let k = 0; k < 34; k++) { const az = k / 34 * TAU + rr(-.05, .05), rad_ = k % 2 ? 7.4 : 7.9; a.push(K.tag(K.leaf(rr(8, 10.5), rr(2.4, 3.1), { ns: hi ? 5 : 3, nw: 2, bend: rr(-.2, .5), fold: .2, shape: K.shPetal }), cv('#f5c21b', .03), 2, K.mul(Hm, K.M([-Math.sin(az) * rad_, Math.cos(az) * rad_, k % 2 ? .1 : .4], [0, 0, az])))); }
    return K.merge(a); }
  function beeGeo() { const a = [], DK = '#1c1408'; a.push(K.tag(K.sph(12, 8), '#6b4a1c', 5, K.M([0, .3, .15], [0, 0, 0], [.24, .22, .26])), K.tag(K.sph(10, 8), '#2a1c0c', 5, K.M([0, .28, .48], [0, 0, 0], [.17, .16, .13])));
    for (const s of [-1, 1]) { a.push(K.tag(K.sph(8, 6), '#050403', 9, K.M([s * .13, .3, .5], [0, 0, 0], [.07, .11, .08])), K.tag(K.tube([V(s * .06, .36, .58), V(s * .12, .44, .72), V(s * .2, .4, .9)], .014, 3), DK, 5));
      for (let k = 0; k < 3; k++) { const z = .3 - k * .2; a.push(K.tag(K.tube([V(s * .12, .22, z), V(s * .34, .3, z + .06 - k * .08), V(s * .44, 0, z + .14 - k * .2)], .022, 3), DK, 5)); } }
    a.push(K.tag(K.sph(14, 12), '#d9952a', 17, K.M([0, .27, -.4], [Math.PI / 2, 0, 0], [.26, .45, .24]))); return K.merge(a); }

  const grp = new THREE.Group(); grp.name = 'garden';
  const NB = 18, beeSeed = Array.from({ length: NB }, () => [R(), R(), R(), R()]), beePos = Array.from({ length: NB }, () => V());
  let bees, beeWF, beeWB, catHead, catEyes, catLeg, catRest, ant = [], T = 0;
  async function build(scene, prog, tick) {
    const t0 = performance.now(), IG = Island.GP; grp.position.set(IG.x, Island.support(IG.x,IG.z), IG.z); scene.add(grp);
    const mG = FXKit.mat({ sway: [.2, .12] }), mF = FXKit.mat({ sway: [.035, .12] }), mH = FXKit.mat({ sway: [.004, .12] }), mS = FXKit.mat(), mW = FXKit.mat({ alpha: .3 }), mWB = FXKit.mat({ alpha: .16 });
    const B = K.buckets(grp, 2.4), plant=B.put;
    B.put=(key,geo,mat,x,y,z,...args)=>plant(key,geo,mat,x,
      y+Island.support(IG.x+x,IG.z+z)-grp.position.y,z,...args);
    // lawn: thick where the bee goes, thinning away from its route
    const tf = [0, 1, 2, 3].map(() => tuft(rr(4.5, 7), 6)), sp = LOW ? .05 : .033;
    for (let x = -8.6; x < 8.6; x += sp) for (let z = -6.6; z < 5.6; z += sp) { const d = routeD(x, z); if (d > 2.3) continue; const p = d < .45 ? 1 : lerp(1, .1, (d - .45) / 1.85); if (R() > p) continue;
      const px = x + rr(-.014, .014), pz = z + rr(-.014, .014); if (Math.hypot(px - HIVE.x - .2, pz - HIVE.z) < .34 || Math.hypot(px - CAT.x, pz - CAT.z - .02) < .17) continue;
      const s0 = Math.min(1 / Math.sqrt(p), 3), k = Math.floor(R() * 4); B.put('tuft' + k, tf[k], mG, px, 0, pz, rr(0, TAU), S * s0 * rr(.85, 1.2), S * (1 + (s0 - 1) * .35) * rr(.8, 1.25)); }
    prog(.3); await tick();
    const pc = [clover(), clover()], pcf = cloverFlower(), pd = [daisy('#ffffff', 1.4, 14, '#e8b21a'), daisy('#f4c81e', 1.5, 24, '#e0a010')];
    const scatter = (n, fn) => { let c = 0, g = 0; while (c < n && g++ < n * 80) { const x = rr(-8.4, 8.4), z = rr(-6.4, 5.4); if (routeD(x, z) > 2 * (.2 + R()) || z < -3.75) continue; fn(x, z); c++; } };
    scatter(260, (x, z) => { for (let i = 0; i < 4; i++) { const ax = x + rr(-.09, .09), az = z + rr(-.09, .09); B.put('clv' + (i & 1), pc[i & 1], mG, ax, 0, az, rr(0, TAU), S * rr(.8, 1.3)); if (R() < .3) B.put('clvf', pcf, mF, ax + rr(-.03, .03), 0, az + rr(-.03, .03), rr(0, TAU), S * rr(.8, 1.15)); } });
    scatter(220, (x, z) => B.put('dsy' + (R() < .8 ? 0 : 1), pd[R() < .8 ? 0 : 1], mF, x, 0, z, rr(0, TAU), S * rr(.8, 1.3)));
    B.put('clvf', pcf, mF, CLV.x, 0, CLV.z, 0, S); B.put('clv0', pc[0], mG, CLV.x + .02, 0, CLV.z - .01, 1, S * 1.1); B.put('clv1', pc[1], mG, CLV.x - .03, 0, CLV.z + .02, 2, S * 1.2);
    // the border
    const TINT = ['#f29ac0', '#d6408f', '#ffffff', '#f6c3d8', '#c93a86'].map(c => new THREE.Color(c)), pcs = [cosmos(false, 62, '#ffffff'), cosmos(false, 78, '#ffffff'), cosmos(false, 70, '#ffffff')], pp = [poppy(), poppy(), poppy()], pl = [lavender(), lavender()], ph = [hosta(), hosta()];
    const far = (x, z, r) => Math.hypot(x - COS.x, z - COS.z) > r && routeD(x, z) > .12;
    for (let i = 0; i < 150; i++) { const x = rr(-6.2, -.9), z = rr(-5.5, -3.92); if (far(x, z, .13)) B.put('cos' + (i % 3), pcs[i % 3], mF, x, 0, z, rr(0, TAU), S * rr(.85, 1.15), undefined, pick(TINT)); }
    for (let i = 0; i < 90; i++) { const x = rr(.6, 4.4), z = rr(-5.5, -3.92); B.put('pop' + (i % 3), pp[i % 3], mF, x, 0, z, rr(0, TAU), S * rr(.85, 1.2)); }
    for (let i = 0; i < 70; i++) { const x = rr(-1.15, .7), z = rr(-4.32, -3.84); B.put('lav' + (i & 1), pl[i & 1], mF, x, 0, z, rr(0, TAU), S * rr(.85, 1.1)); }
    for (let i = 0; i < 110; i++) { const x = rr(-6.2, 4.4), z = R() < .5 ? rr(-3.98, -3.82) : rr(-5.6, -4.7); if (far(x, z, .26)) B.put('hos' + (i & 1), ph[i & 1], mF, x, 0, z, rr(0, TAU), S * rr(.7, 1.4)); }
    const ps = [sunflower(false), sunflower(false)]; [[5.96, -4.24], [6.62, -4.32], [6.94, -3.98], [5.78, -3.84], [7.22, -3.52], [6.5, -4.72]].forEach(([x, z], i) => B.put('sun' + (i & 1), ps[i & 1], mH, x, 0, z, rr(-.5, .5), S * rr(.85, 1.08)));
    G.info.gardenInst = B.flush({ cast: true, receive: true }); prog(.6); await tick();
    const hero = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y+Island.support(IG.x+x,IG.z+z)-grp.position.y, z); m.scale.setScalar(S); grp.add(m); return m; };
    hero(cosmos(true, 72, '#f08bb8'), mH, COS.x, 0, COS.z); hero(sunflower(true), mH, SH.x - .08, 0, SH.z);
    { // the hive: stand, landing board, two boxes and a roof (the bees' door is the dark slit under the front wall)
      const a = [], WH = '#e4dfcc'; for (const [x, z] of [[-18, -18], [14, -18], [-18, 14], [14, 14]]) a.push(K.box(x, x + 4, 0, 42, z, z + 4, '#5a4a3a', 4));
      a.push(K.box(-22, 31, 42, 44, -22, 22, '#8a6c44', 4), K.box(-20, 20, 46.6, 70, -20, 20, WH, 4), K.box(-20, 19.6, 44, 46.6, -19.6, 19.6, '#0a0705', 0), K.box(-20, 20, 44, 46.6, -20, -15, '#b79868', 4), K.box(-20, 20, 44, 46.6, 15, 20, '#b79868', 4),
        K.box(-20.3, 20.3, 69.6, 70.4, -20.3, 20.3, '#b9b3a0', 4), K.box(-20, 20, 70, 94, -20, 20, WH, 4), K.box(-23, 23, 94, 97.5, -23, 23, '#9aa3a8', 9)); hero(K.merge(a), mS, HIVE.x, 0, HIVE.z); }
    // the other bees
    const bg = beeGeo(), wf = K.merge([-1, 1].map(s => K.tag(K.leaf(.95, .34, { ns: 3, nw: 2, shape: K.shRound }), '#e8e4d8', 9, K.M([s * .1, .5, .12], [-Math.PI / 2 + .12, s * .22, 0])))), wb = K.merge([-1, 1].map(s => K.tag(K.leaf(1.05, 1, { ns: 3, nw: 3, shape: K.shRound }), '#ffffff', 9, K.M([s * .12, .46, .12], [-1, -s * 1.25, 0]))));
    bees = new THREE.InstancedMesh(bg, mS, NB); beeWF = new THREE.InstancedMesh(wf, mW, NB); beeWB = new THREE.InstancedMesh(wb, mWB, NB); for (const m of [bees, beeWF, beeWB]) { m.frustumCulled = false; grp.add(m); }
    // the cat
    { const OR = '#c98a45', WH = '#efe4d2', PK = '#d98a8a', FQ = LOW ? .4 : 1, cat = new THREE.Group(); cat.position.copy(CAT); cat.position.y+=Island.support(IG.x+CAT.x,IG.z+CAT.z)-grp.position.y; cat.rotation.y = Math.PI; cat.scale.setScalar(S); grp.add(cat);
      const ell = (c, r, col, nf, fl = 1.1, flow = [0, -.8, .5]) => { const a = [K.tag(K.sph(18, 12), col, 6, K.M(c, [0, 0, 0], r))]; if (nf) a.push(K.tag(K.fur(c, r, Math.floor(nf * FQ), fl, flow, R), col, 6)); return a; };
      const tail = new THREE.CatmullRomCurve3([V(0, 4, 15), V(9, 2.6, 17), V(16, 2.4, 9), V(17, 2.4, -3), V(12, 2.4, -12), V(5, 2.6, -15)]).getPoints(16);
      cat.add(new THREE.Mesh(K.merge([...ell([0, 9, 4], [12.5, 9, 14], OR, 3600), ...ell([0, 17, 0], [9.5, 15, 10.5], OR, 4200), ...ell([0, 25, -4.5], [7, 8, 6.5], WH, 2200, 1.4), K.tag(K.tube(tail, t => 2.3 - 1.1 * t, 8), OR, 6)]), mS));
      catHead = new THREE.Group(); catHead.position.set(0, 36, -7); cat.add(catHead);
      const hp = [...ell([0, 0, 0], [6.6, 5.8, 6.2], OR, 4200, 1, [0, -.1, 1]), ...ell([3.9, -1.9, -2.4], [3, 2.6, 3], OR, 1300, 1.7, [.7, -.3, .5]), ...ell([-3.9, -1.9, -2.4], [3, 2.6, 3], OR, 1300, 1.7, [-.7, -.3, .5]),
        ...ell([1.5, -1.7, -5.1], [2.1, 1.7, 1.8], WH, 500, .5, [.3, -.4, -.2]), ...ell([-1.5, -1.7, -5.1], [2.1, 1.7, 1.8], WH, 500, .5, [-.3, -.4, -.2]), ...ell([0, -3.1, -4.5], [1.8, 1.3, 1.5], WH, 300, .5, [0, -1, 0]), K.tag(K.sph(8, 6), PK, 9, K.M([0, -.75, -6.55], [0, 0, 0], [.95, .65, .5]))];
      for (const s of [-1, 1]) { hp.push(K.tag(new THREE.ConeGeometry(2.9, 5.4, 10, 1, true), OR, 6, K.M([s * 3.9, 5.6, .3], [-.12, 0, -s * .32])), K.tag(new THREE.ConeGeometry(2.1, 4.2, 8, 1, true), PK, 0, K.M([s * 3.85, 5.3, -.35], [-.12, 0, -s * .32])));
        for (let k = 0; k < 6; k++) { const y = -1.4 + (k % 3 - 1) * .55; hp.push(K.tag(K.tube(bez(V(s * 2.5, y, -5.7), V(s * 7, y + rr(-.3, .6), -6.4 + k * .1), V(s * rr(10.5, 12.5), y + (k % 3 - 1) * 1.6 - .6, -4.8 + rr(-1, 1)), 6), t => .04 - .03 * t, 3), '#ffffff', 9)); } }
      catHead.add(new THREE.Mesh(K.merge(hp), mS));
      catEyes = [-1, 1].map(s => { const e = new THREE.Mesh(K.tag(new THREE.SphereGeometry(1.5, 22, 16), '#ffffff', 15), mS); e.position.set(s * 2.75, .85, -4.7); catHead.add(e); return e; });
      catRest = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(0, -1, -.06).normalize());
      catLeg = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 4.3, 23, -6.5); p.add(new THREE.Mesh(K.merge([...ell([0, 0, 9.5], [2.5, 2.5, 10.5], OR, 900, 1, [0, .3, 1]), ...ell([0, -1.2, 20.2], [2.9, 3.7, 2.3], WH, 700, .6, [0, -.6, .6])]), mS)); p.quaternion.copy(catRest); cat.add(p); return p; });
      Garden.cat = cat; }
    // the bee's own antennae (shown only while the lens is the bee)
    ant = [-1, 1].map(s => { const g = new THREE.Group(); g.add(new THREE.Mesh(K.tag(K.tube([V(), V(s * .1, .12, -.2), V(s * .2, .18, -.38), V(s * .3, .19, -.56)], t => .009 - .004 * t, 5), '#1a1208', 5, K.M([s * .15, .17, -.1])), mS)); g.scale.setScalar(S); g.visible = false; scene.add(g); return g; });
    grp.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = o.receiveShadow = true; });
    G.tick.push(update); G.info.garden = { ms: Math.round(performance.now() - t0) }; prog(1);
  }
  // ---- everybody else ----
  const _p = V(), _f = V(), _x = V(), _y = V(), _z = V(), _s = V(), _mx = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), _q = new THREE.Quaternion(), EYE_REST = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI), YUP = V(0, 1, 0), ZAX = V(0, 0, 1);
  function setBee(i, p, fwd, up, sc, flying) { _z.copy(fwd); if (_z.lengthSq() < 1e-12) _z.set(1, 0, 0); _z.normalize(); _x.crossVectors(up, _z); if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0); _x.normalize(); _y.crossVectors(_z, _x);
    _mx.makeBasis(_x, _y, _z).scale(_s.set(sc * S, sc * S, sc * S)).setPosition(p); bees.setMatrixAt(i, _mx); beeWF.setMatrixAt(i, flying ? ZERO : _mx); beeWB.setMatrixAt(i, flying ? _mx : ZERO); beePos[i].copy(p); }
  const visitorP = (t, o) => { const u = -.01 + .015 * Math.sin(.4 * t), v = .028 + .01 * Math.cos(.3 * t); return o.copy(sunW(u, v, discH(u * 100, v * 100) - .0042)); };
  let beeOn = false, camL = V();
  function update(t, dt) { if (!bees) return; const tt = G.tAbs === undefined ? t : G.tAbs;
    for (let i = 0; i < NB; i++) { const s = beeSeed[i];
      if (i < 7) { const ph = s[2] * 9; let z = HIVE.z - .14 + s[1] * .28; _p.set(HIVE.x + .215 + s[0] * .075 + .009 * Math.sin(.4 * tt + ph), .44, z + .013 * Math.cos(.31 * tt + ph)); _f.set(Math.cos(.4 * tt + ph) * .36, 0, -Math.sin(.31 * tt + ph) * .4); setBee(i, _p, _f, YUP, 1, false); }
      else if (i === 7) { visitorP(tt, _p); visitorP(tt + .1, _f).sub(_p); setBee(i, _p, _f, SF, 1, false); }
      else { const c = i < 14 ? [HIVE.x + .75, .6, HIVE.z] : [[-.8, .5, -4.1], [-.2, .5, -4.1], [-2.4, .75, -4.4], [2.2, .62, -4.3]][i - 14], k = i < 14 ? 1 : .2, P = (q, o) => o.set(c[0] + k * (.26 * Math.sin((1 + s[0]) * q + s[1] * 9) + .1 * Math.sin(2.3 * q + s[2] * 7)), c[1] + k * .13 * Math.sin((.8 + s[1]) * q + s[3] * 9), c[2] + k * .34 * Math.sin((.9 + s[2]) * q + s[0] * 9));
        P(tt, _p); P(tt + .03, _f).sub(_p); _f.y *= .3; setBee(i, _p, _f, YUP, 1, true); } }
    bees.instanceMatrix.needsUpdate = beeWF.instanceMatrix.needsUpdate = beeWB.instanceMatrix.needsUpdate = true;
    // the cat watches whoever is near: the bee if the lens is the bee, otherwise it idles
    const cat = Garden.cat, near = beeOn ? win(T, 34.5, 46, 1.5) : 0; cat.updateMatrixWorld(true); _p.copy(camL).applyMatrix4(grp.matrixWorld); const lp = cat.worldToLocal(_p).sub(catHead.position);
    const yT = clamp(Math.atan2(-lp.x, -lp.z), -1.45, 1.45), pT = clamp(Math.atan2(lp.y, Math.hypot(lp.x, lp.z)), -.6, .9);
    catHead.rotation.set(lerp(-.05 + .07 * Math.sin(tt * .31), pT, near), lerp(.35 * Math.sin(tt * .23), yT, near), .2 * (beeOn ? win(T, 38.6, 40.5, .5) : 0) * Math.sin(tt * 1.3), 'YXZ'); catHead.updateMatrixWorld(true);
    _p.copy(camL).applyMatrix4(grp.matrixWorld); for (const e of catEyes) { e.lookAt(_p); _q.copy(e.quaternion); const ang = EYE_REST.angleTo(_q); e.quaternion.copy(EYE_REST).slerp(_q, near * Math.min(1, .55 / Math.max(ang, 1e-3))); }
    FXKit.U.uPupil.value = lerp(.09, .36, beeOn ? win(T, 38.8, 41.6, .6) : 0);
    const sw = !beeOn || T < 40.62 ? 0 : T < 40.78 ? sm(40.62, 40.78, T) : 1 - sm(40.86, 41.6, T); _p.set(1.505, .358, -1.274).applyMatrix4(grp.matrixWorld); cat.worldToLocal(_p).sub(catLeg[1].position); const dist = _p.length(); _q.setFromUnitVectors(ZAX, _p.normalize());
    catLeg[1].quaternion.copy(catRest).slerp(_q, sw); catLeg[1].scale.z = 1 + sw * (clamp(dist / 21.5, 1, 1.35) - 1);
  }
  // ---- the bee's eye ----
  const WALK = [[-1, 2.7], [24.2, 30.8], [51.3, 56.7], [68.9, 76]], walkF = t => { let w = 0; for (const [a, b] of WALK) w = Math.max(w, win(t, a, b, .3)); return w; };
  const ZIG = [[20.8, 23.9, .017, 1.5], [39.1, 40.5, .007, 1.9], [48.7, 51.1, .024, 1.3]];
  const cosTop = (dx = 0, dy = 0, dz = 0) => V(COS.x + dx, COS.y + .0045 + dy, COS.z + dz), CATFACE = V(1.5, .364, -1.374), sunC = sunW(0, 0, .018);
  const ATTN = [[4.5, 6.5, () => ENT, 7], [12.8, 15.7, () => CLV, 8], [19.8, 24.2, () => cosTop(), 9], [24.2, 26.6, () => cosTop(.0035, -.0015, -.003), 6], [26.6, 30, () => cosTop(.0042, 0, -.003), 6],
    [36.8, 42.1, () => CATFACE, 11], [46.6, 51.3, () => sunC, 9], [51.3, 56.6, t => visitorP(G.tAbs === undefined ? t : G.tAbs, V()), 6], [59.5, 63, () => V(1.5, 0, -1.2), 3], [63, 68.6, () => ENT, 5]];
  const attnAt = t => { for (const a of ATTN) if (t >= a[0] && t < a[1]) return a; return null; };
  const C = { yaw: 0, pitch: 0, vy: 0, vp: 0, roll: 0, held: 0, phase: 0, dir: V(1, 0, 0), prev: V(), up: V(0, 1, 0), fresh: true }, _a = V(), _b = V(), _c = V(), _m = new THREE.Matrix4(), _q2 = new THREE.Quaternion(), O = V();
  const angd = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  function targets(t) { const p = pathP(t, _a), w = walkF(t), a = attnAt(t); let om;
    if (a) { _b.copy(a[2](t)).sub(p); om = a[3]; } else { pathP(t + (w > .5 ? .12 : .3), _b).sub(pathP(t - .05, _c)); om = w > .5 ? 7 : 9; if (_b.lengthSq() < 1e-9) _b.copy(C.dir); }
    _b.normalize(); C.dir.copy(_b); let pitch = Math.asin(clamp(_b.y, -1, 1)); if (!a) pitch = pitch * .55 - (1 - w) * .1 - w * .04; return { yaw: Math.atan2(-_b.x, -_b.z), pitch, om, look: !!a, w }; }
  function bee(t, dt, camera) {       // t: seconds into the flight (wraps at DUR); sets the camera in world space
    T = ((t % DUR) + DUR) % DUR; const h = 1 / 120; let n = Math.min(24, Math.max(1, Math.round(dt / h)));
    if (C.fresh) { const q = targets(T); C.yaw = C.held = q.yaw; C.pitch = q.pitch; C.vy = C.vp = C.roll = 0; C.phase = 0; pathP(T, C.prev); C.fresh = false; n = 1; }
    for (let i = 0; i < n; i++) { const tt = T - (n - 1 - i) * h, q = targets(tt); let yawT = q.yaw, om = q.om; if (!q.look && q.w < .5) { if (Math.abs(angd(yawT, C.held)) > .1) C.held = yawT; yawT = C.held; om = 12; } else C.held = yawT;
      C.vy += (om * om * angd(yawT, C.yaw) - 1.7 * om * C.vy) * h; C.yaw += C.vy * h; C.vp += (om * om * (q.pitch - C.pitch) - 1.8 * om * C.vp) * h; C.pitch += C.vp * h;
      C.roll += (clamp(C.vy * .11, -.5, .5) * (1 - q.w) - C.roll) * (1 - Math.exp(-h * 7)); pathP(tt, _a); C.phase += _a.distanceTo(C.prev) / .0042 * q.w; C.prev.copy(_a); }
    const aw = win(T, 51.1, 57.2, .5); C.up.set(lerp(0, SF.x, aw), lerp(1, SF.y, aw), 0).normalize();
    const p = pathP(T, _a), w = walkF(T), fly = 1 - w, sp = pathP(T + .05, _b).distanceTo(pathP(T - .05, _c)) / .1, A = fly * (.0025 + .0055 * (1 - sm(.15, 1.1, sp)));
    p.x += sn(T * 1.3, 1.1) * A; p.y += sn(T * 1.5, 2.7) * A * .7; p.z += sn(T * 1.2, 4.2) * A;
    let lat = 0; for (const z of ZIG) if (T > z[0] && T < z[1]) lat += z[2] * Math.sin(TAU * z[3] * (T - z[0])) * Math.sin(Math.PI * (T - z[0]) / (z[1] - z[0])); p.x += Math.cos(C.yaw) * lat; p.z -= Math.sin(C.yaw) * lat;
    p.addScaledVector(C.up, Math.sin(C.phase * TAU) * .00012 * w); camL.copy(p);
    camera.position.copy(p).add(grp.position); const cp = Math.cos(C.pitch), yaw = C.yaw + w * .03 * Math.sin(C.phase * Math.PI); _b.set(-Math.sin(yaw) * cp, Math.sin(C.pitch), -Math.cos(yaw) * cp);
    _m.lookAt(O, _b, C.up); camera.quaternion.setFromRotationMatrix(_m).multiply(_q2.setFromAxisAngle(ZAX, C.roll + w * .025 * Math.sin(C.phase * Math.PI)));
    ant.forEach((g, i) => { g.visible = true; g.position.copy(camera.position); g.quaternion.copy(camera.quaternion); g.rotateX(.07 * sn(T * 2.2, i * 5 + 1)); g.rotateY((i ? 1 : -1) * .05 * sn(T * 1.7, i * 3 + 2) - clamp(C.vy * .04, -.25, .25)); });
    beeOn = true; return { speed: sp, walk: w };
  }
  function leave() { beeOn = false; C.fresh = true; for (const g of ant) g.visible = false; camL.set(0, 5, 0); }
  function installSolids() {
    const boxAt=(base,x,y,z,w,h,d)=> {
      const wx=grp.position.x+base.x+x, wz=grp.position.z+base.z+z;
      Phys.box(V(wx,Island.support(grp.position.x+base.x,grp.position.z+base.z)+y,wz),V(w,h,d));
    };
    for (const x of [-.16,.16]) for (const z of [-.16,.16]) boxAt(HIVE,x,.21,z,.04,.42,.04);
    boxAt(HIVE,.045,.43,0,.53,.025,.44); boxAt(HIVE,0,.71,0,.41,.54,.41);
    boxAt(CAT,0,.18,0,.24,.36,.30);
  }
  return { build, bee, leave, installSolids, DUR, grp, cat: null, get T() { return T; } };
})();
