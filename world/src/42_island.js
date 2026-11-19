'use strict';
// ---- the island behind the fort: the mountain of "Mountain Hike" brought down to the sea. A height function (a dome, ridges, gullies,
//      a shore, a terrace for the garden), a trail that finds its own way up by traversing the slope with switchbacks, forest below the
//      treeline, larches at it, meadow and rock above, a cairn on the top. Everything stands under the fort's own sky and weather. ----
const Island = (() => {
  const K = FXKit.geo, IC = { x: -560, z: -560 }, GP = { x: -238, y: 6, z: -282 }, TREELINE = 205, MEADOW = 250;
  const R = rng(4242), rr = (a, b) => a + (b - a) * R(), pick = a => a[Math.floor(R() * a.length)], LOW = Q.has('low');
  // the smooth mountain (what the trail is found on, and what the far mesh draws)
  function H0(x, z) {
    const dx = x - IC.x, dz = z - IC.z, r = Math.hypot(dx, dz), k = sm(520, 220, r);
    let h = 262 * Math.exp(-Math.pow(r / 250, 2)) + 66 * sm(540, 160, r) - 14;
    h += (NZ.ridged(x / 300 + 3, 0, z / 300, 4) - .45) * 105 * k + NZ.fbm(x / 90, 1.7, z / 90, 4) * 26 * sm(500, 250, r);
    h = lerp(-12, h, sm(505, 440, r + NZ.n3(x / 70, 0, z / 70) * 40));
    const d = Math.hypot(x - GP.x, z - GP.z); return lerp(h, GP.y, 1 - sm(13, 30, d));
  }
  const micro = (x, z) => (NZ.fbm(x / 7, 0, z / 7, 3) + .5) * .5 + (NZ.n3(x / 1.3, 0, z / 1.3) + 1) * .05;
  const grad = (x, z) => { const e = 3; return [(H0(x + e, z) - H0(x - e, z)) / (2 * e), (H0(x, z + e) - H0(x, z - e)) / (2 * e)]; };
  const T = { n: 0, px: null, pz: null, py: null, grid: new Map() }, SUMMIT = { x: 0, y: 0, z: 0 };
  function findTrail() {
    { let x = IC.x, z = IC.z, h = H0(x, z); for (let it = 0; it < 600; it++) { let mv = false; for (const [ax, az] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) { const hh = H0(x + ax, z + az); if (hh > h) { h = hh; x += ax; z += az; mv = true; } } if (!mv) break; } SUMMIT.x = x; SUMMIT.z = z; SUMMIT.y = h; }
    const pts = []; let x = GP.x + (IC.x - GP.x) / 430 * 13, z = GP.z + (IC.z - GP.z) / 430 * 13, side = 1, run = 0, seg = rr(120, 170), px = 0, pz = 0;
    for (let i = 0; i < 5200; i++) { pts.push([x, z]); const h = H0(x, z), ds = Math.hypot(SUMMIT.x - x, SUMMIT.z - z); if (ds < 2.5) break;
      const g = grad(x, z), sl = Math.hypot(g[0], g[1]) + 1e-6, ux = g[0] / sl, uz = g[1] / sl, an = Math.asin(clamp(.17 / sl, -.95, .95));
      let dx = -uz * side * Math.cos(an) + ux * Math.sin(an), dz = ux * side * Math.cos(an) + uz * Math.sin(an);
      const top = Math.max(sm(SUMMIT.y - 34, SUMMIT.y - 12, h), 1 - sm(20, 70, ds)); dx = lerp(dx, (SUMMIT.x - x) / ds, top); dz = lerp(dz, (SUMMIT.z - z) / ds, top);
      if (i) { dx = lerp(px, dx, .16); dz = lerp(pz, dz, .16); } const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; px = dx; pz = dz; x += dx; z += dz;
      if (++run > seg || (run > 40 && Math.hypot(x - IC.x, z - IC.z) > 415)) { side = -side; run = 0; seg = rr(110, 180); } }
    const n = pts.length; T.n = n; T.px = new Float32Array(n); T.pz = new Float32Array(n); T.py = new Float32Array(n); const raw = pts.map(p => H0(p[0], p[1]));
    for (let i = 0; i < n; i++) { T.px[i] = pts[i][0]; T.pz[i] = pts[i][1]; let s = 0, c = 0; for (let k = -6; k <= 6; k++) { s += raw[clamp(i + k, 0, n - 1)]; c++; } T.py[i] = s / c + .1;
      const key = Math.floor(pts[i][0] / 8) + ',' + Math.floor(pts[i][1] / 8); let a = T.grid.get(key); if (!a) T.grid.set(key, a = []); a.push(i); }
  }
  const _o = { d: 1e9, y: 0, i: 0 };
  function nearTrail(x, z) {       // distance to the trail (within about 8 m), its height there, and the index
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8); let b = 1e9, bi = -1;
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { const l = T.grid.get((cx + a) + ',' + (cz + c)); if (l) for (const i of l) { const d = (T.px[i] - x) ** 2 + (T.pz[i] - z) ** 2; if (d < b) { b = d; bi = i; } } }
    if (bi < 0) { _o.d = 1e9; return _o; } let bd = b, by = T.py[bi];
    for (let i = Math.max(0, bi - 1); i < Math.min(T.n - 1, bi + 1); i++) { const ax = T.px[i], az = T.pz[i], dx = T.px[i + 1] - ax, dz = T.pz[i + 1] - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)), d = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2; if (d < bd) { bd = d; by = lerp(T.py[i], T.py[i + 1], t); } }
    _o.d = Math.sqrt(bd); _o.y = by; _o.i = bi; return _o;
  }
  // the ground you actually stand on: the cut path near the trail, the garden's terrace, the far mesh elsewhere
  function ground(x, z) { const o = nearTrail(x, z); if (o.d < 3.3) return lerp(H0(x, z) + micro(x, z) * (1 - .8 * (1 - sm(1, 3, o.d))), o.y, 1 - sm(.55, 2.4, o.d)) + .14;
    if (Math.abs(x - GP.x) < 31 && Math.abs(z - GP.z) < 31) return H0(x, z) + .14 + micro(x, z) * sm(11, 22, Math.hypot(x - GP.x, z - GP.z)); return H0(x, z) - .15; }

  const FRAG = /* glsl */`
varying vec3 vIw, vIn; varying float vIp;
vec2 isVor(vec2 x){ vec2 n=floor(x),f=fract(x); float md=8.,id=0.; for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=hash22(n+g); vec2 r=g+o-f; float d=dot(r,r); if(d<md){ md=d; id=hash21(n+g+7.); } } return vec2(sqrt(md),id); }
vec3 isGround(){
  vec2 q=vIw.xz; float alt=vIw.y, sl=1.-normalize(vIn).y, near=smoothstep(110.,12.,length(cameraPosition-vIw));
  float n1=fbm2(q*.012), n2=vnoise(q*.9), n3=vnoise(q*6.);
  float tl=${TREELINE}.+(n1-.5)*26., forest=smoothstep(tl+6.,tl-6.,alt)*smoothstep(9.,15.,alt);
  vec3 floorC=mix(mix(vec3(.15,.1,.055),vec3(.09,.065,.04),n2),vec3(.09,.19,.04)*(.7+.6*n3),smoothstep(.42,.6,fbm2(q*.35+2.)));
  vec3 grassC=mix(vec3(.27,.24,.085),vec3(.16,.21,.065),n1)*(.7+.45*n2)*(.62+.75*vnoise(vec2(q.x*13.,q.y*3.5))*(.4+vnoise(q*4.3+6.)));
  grassC=mix(grassC,vec3(.4,.11,.045),smoothstep(.6,.74,fbm2(q*.05+8.))*.75*smoothstep(${TREELINE}.-30.,${TREELINE}.+10.,alt));
  vec3 lawn=vec3(.075,.16,.04)*(.6+.8*n1)*(.5+1.0*vnoise(q*2.5)*(.5+vnoise(vec2(q.x*9.,q.y*1.6))));
  grassC=mix(lawn,grassC,smoothstep(14.,40.,alt));
  vec3 rockC=vec3(.36,.355,.35)*(.5+.75*fbm2(q*.25+alt*.05))*(.8+.4*n3);
  rockC*=1.-.35*near*smoothstep(.42,.5,abs(vnoise(q*.7+3.)-.5)*2.)-.25*near*smoothstep(.4,.5,abs(vnoise(q*2.3)-.5)*2.);
  vec3 alb=mix(grassC,floorC,forest);
  alb=mix(alb,mix(rockC,vec3(.2,.15,.1)*(.7+.6*n2),forest*.8),max(smoothstep(.34,.48,sl+(n1-.5)*.15),smoothstep(${MEADOW}.-8.,${MEADOW}.+14.,alt+(n1-.5)*30.)));
  vec3 sand=mix(vec3(.5,.44,.33),vec3(.36,.32,.26),n2); alb=mix(sand,alb,smoothstep(1.2,3.6,alt+(n2-.5)*1.2));
  alb=mix(alb,alb*.45,smoothstep(.9,.15,alt)*.8);
  vec2 vp=isVor(q*7.5+n2*2.); vec3 dirt=mix(vec3(.25,.19,.13),vec3(.36,.3,.22),n2)*(.8+.4*n3);
  dirt=mix(dirt,mix(vec3(.3,.29,.28),vec3(.46,.44,.41),fract(vp.y*7.)),smoothstep(.36,.24,vp.x)*step(.45,vp.y)*.75*near);
  return mix(alb,dirt,smoothstep(.2,.7,vIp)); }`;
  function groundMat() { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0, envMapIntensity: .5 });
    patch(m, s => { s.vHead('attribute float aPath; varying vec3 vIw, vIn; varying float vIp;');
      s.v('#include <begin_vertex>', '#include <begin_vertex>\n  vIw = (modelMatrix * vec4(transformed, 1.0)).xyz; vIn = normalize(mat3(modelMatrix) * normal); vIp = aPath;');
      s.fHead(GLSL_NOISE + FRAG); s.f('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = isGround();'); }, 'island');
    return m; }
  function gridMesh(x0, z0, w, n, hf, mat, skirt) { const pos = new Float32Array(n * n * 3), pa = new Float32Array(n * n), idx = new Uint32Array((n - 1) * (n - 1) * 6); let q = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = x0 + i / (n - 1) * w, z = z0 + j / (n - 1) * w, k = (j * n + i) * 3, e = skirt && (i === 0 || j === 0 || i === n - 1 || j === n - 1); pos[k] = x; pos[k + 1] = hf(x, z) - (e ? .6 : 0); pos[k + 2] = z; }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPath', new THREE.BufferAttribute(pa, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
  function ribbon(mat) {       // the trail itself: a strip of fine ground laid along it, with the path cut flat
    const W = 10, n = T.n, pos = new Float32Array(n * (2 * W + 1) * 3), pa = new Float32Array(n * (2 * W + 1)), idx = []; let k = 0;
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let tx = T.px[b] - T.px[a], tz = T.pz[b] - T.pz[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      for (let j = -W; j <= W; j++) { const off = j * .33, x = T.px[i] - tz * off, z = T.pz[i] + tx * off, d = Math.abs(off), w = 1 - sm(.55, 2.4, d);
        pos[k * 3] = x; pos[k * 3 + 1] = lerp(H0(x, z) + micro(x, z) * (1 - .8 * (1 - sm(1, 3, d))), T.py[i], w) + .14 - (Math.abs(j) === W ? .55 : 0); pos[k * 3 + 2] = z; pa[k] = 1 - sm(.4, 1.05, d); k++; }
      if (i < n - 1) for (let j = 0; j < 2 * W; j++) { const a0 = i * (2 * W + 1) + j, b0 = a0 + 1, c0 = a0 + 2 * W + 1, d0 = c0 + 1; idx.push(a0, b0, c0, b0, d0, c0); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPath', new THREE.BufferAttribute(pa, 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }

  // ---- what grows on it (prototypes in metres) ----
  function conifer(larch) { const a = [], HT = 20, n = larch ? 13 : 17;
    a.push(K.tag(K.tube([new THREE.Vector3(0, -.6, 0), new THREE.Vector3(rr(-.15, .15), HT * .5, rr(-.15, .15)), new THREE.Vector3(0, HT, 0)], t => .3 * (1 - t) + .03, 6), larch ? '#6b4a34' : '#4a3a2e', 19));
    for (let k = 0; k < n; k++) { const f = k / (n - 1), y = HT * ((larch ? .22 : .27) + (larch ? .76 : .71) * f), len = (HT - y) * (larch ? .36 : .3) + .55, nb = k > n - 3 ? 4 : 5;
      for (let j = 0; j < nb; j++) a.push(K.tag(K.leaf(len * rr(.85, 1.1), len * (larch ? .62 : .55), { ns: 3, nw: 2, bend: larch ? rr(.45, .75) : rr(.25, .5), fold: -.18, shape: v => 1 - v * .72 }), '#ffffff', 22, K.M([0, y + rr(-.25, .25), 0], [lerp(larch ? 1.55 : 1.75, 1.15, f) + rr(-.08, .08), k * 1.13 + j * TAU / nb + rr(-.2, .2), 0]))); }
    return K.merge(a); }
  function farTree(larch) { const a = [], HT = 20; a.push(K.tag(K.tube([new THREE.Vector3(0, -.5, 0), new THREE.Vector3(0, HT * .3, 0)], .28, 4), '#4a3a2e', 19));
    for (let k = 0; k < 4; k++) { const y0 = HT * (.14 + k * .2), h = HT * (larch ? .34 : .38), r = (HT - y0) * (larch ? .2 : .22) + .5, g = new THREE.ConeGeometry(r, h, 7, 1, true), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rr(.85, 1.15), p.getY(i), p.getZ(i) * rr(.85, 1.15)); a.push(K.tag(g, '#ffffff', 23, K.M([0, y0 + h / 2, 0], [0, k * 1.3, 0]))); }
    return K.merge(a); }
  const tuft = (h, nb) => K.merge(Array.from({ length: nb }, () => K.tag(K.leaf(h * rr(.55, 1.15), rr(.018, .032), { ns: 2, nw: 1, bend: rr(.2, 1.1), shape: K.shBlade }), new THREE.Color(1, 1, 1).offsetHSL(0, 0, rr(-.12, 0)), 3, K.M([rr(-.2, .2), 0, rr(-.2, .2)], [rr(.05, .5), rr(0, TAU), 0]))));
  function bilberry() { const a = [], c = new THREE.Vector3(0, .02, 0); for (let i = 0; i < 30; i++) { const u = rr(.05, 1), an = rr(0, TAU), s = Math.sqrt(1 - u * u), d = new THREE.Vector3(s * Math.cos(an), u, s * Math.sin(an));
      a.push(K.tag(K.leaf(rr(.06, .09), rr(.045, .06), { ns: 1, nw: 1, shape: v => 1 - v * .6 }), pick(['#b3261a', '#c9401c', '#8f1d1d', '#d0661e', '#5a7a2e']), 1, K.Md(c.clone().addScaledVector(d, rr(.08, .24)), d.add(new THREE.Vector3(rr(-.5, .5), rr(0, .5), rr(-.5, .5)))))); } return K.merge(a); }
  const fern = () => K.merge(Array.from({ length: 8 }, (_, k) => K.tag(K.leaf(rr(.6, .95), rr(.22, .3), { ns: 6, nw: 2, bend: rr(.8, 1.25), fold: .12 }), new THREE.Color('#5c9440').offsetHSL(0, 0, rr(-.05, .05)), 26, K.M([0, 0, 0], [rr(.35, .9), k / 8 * TAU + rr(-.25, .25), 0]))));
  const SPR = ['#22452a', '#1c3a24', '#2a4f2c', '#254a33'].map(c => new THREE.Color(c)), LAR = ['#dba21c', '#c98d16', '#e2b530', '#b9801a', '#cfae3a'].map(c => new THREE.Color(c));
  const GRS = ['#b0a24a', '#9c9a44', '#c2a650', '#8a9440', '#a88a3c'].map(c => new THREE.Color(c)), GRF = ['#5f8a3a', '#6f9440', '#4f7a34'].map(c => new THREE.Color(c)), RKC = ['#b5b1ab', '#a09d99', '#c2bcb2', '#93918f'].map(c => new THREE.Color(c));

  async function build(scene, prog, tick) {
    const t0 = performance.now(); findTrail(); prog(.1); await tick();
    const gm = groundMat(), grp = new THREE.Group(); grp.name = 'island'; scene.add(grp);
    grp.add(gridMesh(IC.x - 620, IC.z - 620, 1240, LOW ? 260 : 400, (x, z) => H0(x, z) - .15, gm)); prog(.3); await tick();
    grp.add(ribbon(gm)); grp.add(gridMesh(GP.x - 30, GP.z - 30, 60, 200, (x, z) => H0(x, z) + .14 + micro(x, z) * sm(11, 22, Math.hypot(x - GP.x, z - GP.z)), gm, true)); prog(.45); await tick();
    const mTree = FXKit.mat({ sway: [.02, 10] }), mGrass = FXKit.mat({ sway: [.22, .3] }), mShrub = FXKit.mat({ sway: [.06, .4] }), mStill = FXKit.mat();
    const P = { spruce: [conifer(false), conifer(false)], larch: [conifer(true), conifer(true)], farS: farTree(false), farL: farTree(true), tuft: [tuft(.36, 14), tuft(.3, 14), tuft(.42, 13)], bil: [bilberry(), bilberry()], fern: [fern(), fern()],
      rock: [0, 1, 2, 3].map(i => K.tag(K.blob(i * 7.3 + 1, .32), '#ffffff', 7, K.M([0, 0, 0], [0, 0, 0], [1, .75, 1]))) };
    const B = K.buckets(grp, 60), tl = (x, z) => TREELINE + NZ.n3(x * .012, 0, z * .012) * 13;
    // forest: simple trees everywhere under the treeline, larches as it nears
    const cell = LOW ? 9 : 6.5; for (let x = IC.x - 520; x < IC.x + 520; x += cell) for (let z = IC.z - 520; z < IC.z + 520; z += cell) { const px = x + rr(0, cell), pz = z + rr(0, cell), h = H0(px, pz); if (h < 9 || h > tl(px, pz) || R() > .86) continue;
      if (Math.hypot(px - GP.x, pz - GP.z) < 24 || nearTrail(px, pz).d < 7.5) continue; const g = grad(px, pz); if (Math.hypot(g[0], g[1]) > 1.0) continue;
      const larch = R() < sm(150, 200, h) * .92 + .04, s = rr(.7, 1.3) * (larch ? .85 : 1); B.put(larch ? 'L' : 'S', larch ? P.farL : P.farS, mTree, px, h - .45, pz, rr(0, TAU), s, s * rr(.9, 1.15), pick(larch ? LAR : SPR)); }
    prog(.65); await tick();
    // along the trail: detailed conifers beside it, ferns and bilberry under them, grass and rock above the trees
    for (let i = 8; i < T.n; i++) { const h = T.py[i], a = Math.max(0, i - 1), b = Math.min(T.n - 1, i + 1); let tx = T.px[b] - T.px[a], tz = T.pz[b] - T.pz[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const at = (off, along) => [T.px[i] - tz * off + tx * along, T.pz[i] + tx * off + tz * along], forest = h < tl(T.px[i], T.pz[i]) - 4, meadow = !forest && h < MEADOW + 6;
      const put = (key, geo, mat, off, s, sy, col, sink = 0) => { const [x, z] = at(off, rr(-.5, .5)); if (nearTrail(x, z).d < Math.min(Math.abs(off), .75)) return; B.put(key, geo, mat, x, ground(x, z) - sink, z, rr(0, TAU), s, sy, col); };
      if (forest && i % 4 === 0) for (const sd of [-1, 1]) if (R() < .85) { const larch = R() < sm(150, 200, h) * .9, k = R() < .5 ? 0 : 1, s = rr(.75, 1.4) * (larch ? .82 : 1); put((larch ? 'l' : 's') + k, (larch ? P.larch : P.spruce)[k], mTree, sd * rr(4.4, 9), s * rr(.9, 1.1), s, pick(larch ? LAR : SPR), .3); }
      if (forest) { if (R() < .7) put('f' + (i & 1), P.fern[i & 1], mShrub, (R() < .5 ? -1 : 1) * rr(.9, 3.1), rr(.7, 1.4)); if (R() < .35) put('b' + (i & 1), P.bil[i & 1], mShrub, (R() < .5 ? -1 : 1) * rr(.9, 3.1), rr(.8, 1.5));
        for (let k = 0; k < 3; k++) if (R() < .6) put('t' + (k % 3), P.tuft[k % 3], mGrass, (R() < .5 ? -1 : 1) * rr(.8, 3.1), rr(.6, 1.1), undefined, pick(GRF)); }
      else if (meadow) { for (let k = 0; k < (LOW ? 14 : 34); k++) put('t' + (k % 3), P.tuft[k % 3], mGrass, (R() < .5 ? -1 : 1) * rr(.7, 3.2), rr(.7, 1.3), undefined, pick(GRS)); if (R() < .5) put('b' + (i & 1), P.bil[i & 1], mShrub, (R() < .5 ? -1 : 1) * rr(.9, 3.1), rr(.9, 1.9)); }
      else for (let k = 0; k < 6; k++) put('r' + (k & 3), P.rock[k & 3], mStill, (R() < .5 ? -1 : 1) * rr(.75, 3.2), rr(.12, .42), undefined, pick(RKC), .05);
      if (R() < .12) put('r' + (i & 3), P.rock[i & 3], mStill, (R() < .5 ? -1 : 1) * rr(1.6, 3.1), rr(.3, .9), undefined, pick(RKC), .2); }
    for (let k = 0; k < 420; k++) { const an = rr(0, TAU), r = Math.sqrt(R()) * 70, x = SUMMIT.x + Math.cos(an) * r, z = SUMMIT.z + Math.sin(an) * r; if (nearTrail(x, z).d < 2.4 || r < 6) continue; const s = rr(.5, 2.4); B.put('r' + (k & 3), P.rock[k & 3], mStill, x, ground(x, z) - s * .2, z, rr(0, TAU), s, s * rr(.6, 1), pick(RKC)); }
    G.info.islandInst = B.flush();
    { const a = [], x = SUMMIT.x + 1.6, z = SUMMIT.z - 2.2;       // the cairn
      for (let i = 0; i < 16; i++) { const lv = Math.floor(i / 4), an = i * 1.7, r = (.5 - lv * .11) * (i % 4 ? 1 : .3), s = rr(.2, .3) * (1 - lv * .12); a.push(K.tag(K.blob(i * 3.1, .3), pick(['#8d8a86', '#7c7a78', '#9a958e']), 7, K.M([Math.cos(an) * r, .12 + lv * .27, Math.sin(an) * r], [rr(-.3, .3), rr(0, 6), rr(-.3, .3)], [s * 1.2, s * .7, s]))); }
      const cm = new THREE.Mesh(K.merge(a), mStill); cm.position.set(x, ground(x, z), z); grp.add(cm); }
    G.info.island = { trail: T.n, summit: [Math.round(SUMMIT.x), Math.round(SUMMIT.y), Math.round(SUMMIT.z)], ms: Math.round(performance.now() - t0) }; prog(1);
  }
  return { build, H0, ground, nearTrail, T, SUMMIT, GP, IC, TREELINE, MEADOW };
})();
