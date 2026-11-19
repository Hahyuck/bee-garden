'use strict';
// ---- the island behind the fort: the mountain of "Mountain Hike" brought down to the sea. A height function (a dome, ridges, gullies,
//      a beach, a terrace for the garden), a trail that finds its own way up by traversing the slope with switchbacks, forest below the
//      treeline, larches at it, meadow and rock above, a cairn on the top. Everything stands under the fort's own sky and weather.
//      Ground cover is not planted once: tiles of grass follow the lens, so there is grass wherever you go. ----
const Island = (() => {
  const K = FXKit.geo, IC = { x: -560, z: -560 }, GP = { x: -238, y: 6, z: -282 }, TREELINE = 205, MEADOW = 250;
  const R = rng(4242), rr = (a, b) => a + (b - a) * R(), pick = a => a[Math.floor(R() * a.length)], LOW = Q.has('low'), V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  // the smooth mountain (what the trail is found on, and what the far mesh draws). Near sea level the slope eases into a beach.
  function H0(x, z) {
    const dx = x - IC.x, dz = z - IC.z, r = Math.hypot(dx, dz), k = sm(520, 220, r);
    let h = 262 * Math.exp(-Math.pow(r / 250, 2)) + 66 * sm(540, 160, r) - 14;
    h += (NZ.ridged(x / 300 + 3, 0, z / 300, 4) - .45) * 105 * k + NZ.fbm(x / 90, 1.7, z / 90, 4) * 26 * sm(500, 250, r);
    h = lerp(-12, h, sm(505, 440, r + NZ.n3(x / 70, 0, z / 70) * 40));
    if (h < 14) { const t = clamp((h + 12) / 26); h = -12 + 26 * (.5 + 4 * Math.pow(t - .5, 3)) + NZ.n3(x / 9, 3, z / 9) * .25 * sm(0, .5, t); }
    const d = Math.hypot(x - GP.x, z - GP.z); return lerp(h, GP.y, 1 - sm(13, 30, d));
  }
  const micro = (x, z) => (NZ.fbm(x / 7, 0, z / 7, 3) + .5) * .5 + (NZ.n3(x / 1.3, 0, z / 1.3) + 1) * .05;
  const grad = (x, z) => { const e = 3; return [(H0(x + e, z) - H0(x - e, z)) / (2 * e), (H0(x, z + e) - H0(x, z - e)) / (2 * e)]; };
  const tlAt = (x, z) => TREELINE + NZ.n3(x * .012, 0, z * .012) * 13;
  const T = { n: 0, px: null, pz: null, py: null, grid: new Map() }, SUMMIT = { x: 0, y: 0, z: 0 };
  function findTrail() {
    { let x = IC.x, z = IC.z, h = H0(x, z); for (let it = 0; it < 600; it++) { let mv = false; for (const [ax, az] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) { const hh = H0(x + ax, z + az); if (hh > h) { h = hh; x += ax; z += az; mv = true; } } if (!mv) break; } SUMMIT.x = x; SUMMIT.z = z; SUMMIT.y = h; }
    const pts = []; let x = GP.x + (IC.x - GP.x) / 430 * 13, z = GP.z + (IC.z - GP.z) / 430 * 13, side = 1, run = 0, seg = rr(120, 170), px = 0, pz = 0;
    for (let i = 0; i < 5200; i++) { pts.push([x, z]); const h = H0(x, z), ds = Math.hypot(SUMMIT.x - x, SUMMIT.z - z); if (ds < 2.5) break;
      const g = grad(x, z), sl = Math.hypot(g[0], g[1]) + 1e-6, ux = g[0] / sl, uz = g[1] / sl, an = Math.asin(clamp(.17 / sl, -.95, .95));
      let dx = -uz * side * Math.cos(an) + ux * Math.sin(an), dz = ux * side * Math.cos(an) + uz * Math.sin(an);
      const top = Math.max(sm(SUMMIT.y - 34, SUMMIT.y - 12, h), 1 - sm(20, 70, ds)); dx = lerp(dx, (SUMMIT.x - x) / ds, top); dz = lerp(dz, (SUMMIT.z - z) / ds, top);
      if (i) { dx = lerp(px, dx, .16); dz = lerp(pz, dz, .16); } const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; px = dx; pz = dz; x += dx; z += dz;
      if (++run > seg || (run > 40 && Math.hypot(x - IC.x, z - IC.z) > 400)) { side = -side; run = 0; seg = rr(110, 180); } }
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
  const fineH = (x, z, d, y) => lerp(H0(x, z) + micro(x, z) * (1 - .8 * (1 - sm(1, 3, d))), y, 1 - sm(.55, 2.4, d)) + .14 - .02 * d;
  // the ground you actually stand on: the fine strip near the trail, the garden's terrace, the far mesh elsewhere
  function ground(x, z) { const o = nearTrail(x, z); if (o.d < 7.2) return fineH(x, z, o.d, o.y);
    if (Math.abs(x - GP.x) < 31 && Math.abs(z - GP.z) < 31) return H0(x, z) + .14 + micro(x, z) * sm(11, 22, Math.hypot(x - GP.x, z - GP.z)); return H0(x, z) - .15; }

  const FRAG = /* glsl */`
uniform float uTime; varying vec3 vIw, vIn; varying float vIp; float isHt, isRo;
vec2 isVor(vec2 x){ vec2 n=floor(x),f=fract(x); float md=8.,id=0.; for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=hash22(n+g); vec2 r=g+o-f; float d=dot(r,r); if(d<md){ md=d; id=hash21(n+g+7.); } } return vec2(sqrt(md),id); }
vec3 isGround(){
  vec2 q=vIw.xz; float alt=vIw.y, sl=1.-normalize(vIn).y, near=smoothstep(110.,12.,length(cameraPosition-vIw));
  float n1=fbm2(q*.012), n2=vnoise(q*.9), n3=vnoise(q*6.);
  float tl=${TREELINE}.+(n1-.5)*26., forest=smoothstep(tl+6.,tl-6.,alt)*smoothstep(9.,15.,alt);
  vec3 floorC=mix(mix(vec3(.12,.08,.045),vec3(.07,.05,.03),n2)*(.7+.6*vnoise(q*3.3)),vec3(.075,.17,.04)*(.6+.7*n3),smoothstep(.36,.55,fbm2(q*.22+2.)));
  vec3 grassC=mix(vec3(.27,.24,.085),vec3(.16,.21,.065),n1)*(.7+.45*n2)*(.62+.75*vnoise(vec2(q.x*13.,q.y*3.5))*(.4+vnoise(q*4.3+6.)));
  grassC=mix(grassC,vec3(.4,.11,.045),smoothstep(.6,.74,fbm2(q*.05+8.))*.75*smoothstep(${TREELINE}.-30.,${TREELINE}.+10.,alt));
  vec3 lawn=vec3(.075,.16,.04)*(.6+.8*n1)*(.5+1.0*vnoise(q*2.5)*(.5+vnoise(vec2(q.x*9.,q.y*1.6))));
  grassC=mix(lawn,grassC,smoothstep(14.,40.,alt));
  float rf=fbm2(q*.9+alt*.07);
  vec3 rockC=mix(vec3(.33,.33,.34),vec3(.46,.43,.39),fbm2(q*.11+3.))*(.55+.7*rf)*(.8+.4*n3);
  float crack=smoothstep(.44,.5,abs(vnoise(q*.7+3.)-.5)*2.)+.6*smoothstep(.4,.5,abs(vnoise(q*2.3)-.5)*2.); rockC*=1.-.4*near*crack;
  vec3 alb=mix(grassC,floorC,forest); isHt=.05*fbm2(q*3.1)+.012*n3; isRo=.95;
  float rk=max(smoothstep(.34,.48,sl+(n1-.5)*.15),smoothstep(${MEADOW}.-8.,${MEADOW}.+14.,alt+(n1-.5)*30.));
  alb=mix(alb,mix(rockC,vec3(.2,.15,.1)*(.7+.6*n2),forest*.8),rk); isHt=mix(isHt,.16*rf-.05*crack+.02*n3,rk*(1.-forest*.8));
  // the beach: dry sand with wind ripples, pebbles, a darker wet band at the water and a line of foam that comes and goes
  float beach=smoothstep(4.2,2.4,alt+(n2-.5)*1.4), wet=smoothstep(.75,.15,alt), rip=sin(dot(q,vec2(.8,.6))*7.+5.*vnoise(q*.35));
  vec2 pb=isVor(q*5.+n2); float peb=smoothstep(.34,.2,pb.x)*step(.72,pb.y)*near;
  vec3 sand=mix(vec3(.62,.54,.4),vec3(.5,.43,.32),fbm2(q*.5))*(.86+.2*n3+.07*rip*near); sand=mix(sand,mix(vec3(.3,.29,.28),vec3(.55,.52,.47),fract(pb.y*9.)),peb);
  sand=mix(sand,sand*vec3(.5,.47,.44),wet);
  float fl=.2+.13*sin(uTime*.7+q.x*.05+q.y*.04)+.05*sin(uTime*1.9+q.x*.4);
  sand=mix(sand,vec3(.92,.95,.97),smoothstep(.16,.0,abs(alt-fl))*(.55+.45*vnoise(q*3.+uTime*.4))*.9);
  alb=mix(alb,sand,beach); isHt=mix(isHt,.012*rip*(1.-wet)+.03*peb,beach); isRo=mix(isRo,mix(.9,.3,wet),beach);
  vec2 vp=isVor(q*7.5+n2*2.); float st=smoothstep(.36,.24,vp.x)*step(.45,vp.y)*near; vec3 dirt=mix(vec3(.25,.19,.13),vec3(.36,.3,.22),n2)*(.8+.4*n3);
  dirt=mix(dirt,mix(vec3(.3,.29,.28),vec3(.46,.44,.41),fract(vp.y*7.)),st*.75); float pth=smoothstep(.2,.7,vIp);
  isHt=mix(isHt,.02*st+.012*n3,pth); return mix(alb,dirt,pth); }`;
  function groundMat() { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0, envMapIntensity: .5 });
    patch(m, s => { s.vHead('attribute float aPath; varying vec3 vIw, vIn; varying float vIp;');
      s.v('#include <begin_vertex>', '#include <begin_vertex>\n  vIw = (modelMatrix * vec4(transformed, 1.0)).xyz; vIn = normalize(mat3(modelMatrix) * normal); vIp = aPath;');
      s.fHead(GLSL_NOISE + FRAG); s.f('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = isGround();');
      s.f('#include <roughnessmap_fragment>', 'float roughnessFactor = isRo;');
      // relief from the procedural height, by screen-space derivatives; it fades out where a pixel is wider than the relief
      s.f('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  { vec3 sp = -vViewPosition, sx = dFdx(sp), sy = dFdy(sp), r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1), fw = max(length(sx), length(sy));\n    vec3 gr = sign(det) * (dFdx(isHt) * r1 + dFdy(isHt) * r2); normal = normalize(abs(det) * normal - gr * (1.0 - smoothstep(0.03, 0.25, fw))); }'); }, 'island');
    return m; }
  function gridMesh(x0, z0, w, n, hf, mat, skirt) { const pos = new Float32Array(n * n * 3), pa = new Float32Array(n * n), idx = new Uint32Array((n - 1) * (n - 1) * 6); let q = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = x0 + i / (n - 1) * w, z = z0 + j / (n - 1) * w, k = (j * n + i) * 3, e = skirt && (i === 0 || j === 0 || i === n - 1 || j === n - 1); pos[k] = x; pos[k + 1] = hf(x, z) - (e ? .6 : 0); pos[k + 2] = z; }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPath', new THREE.BufferAttribute(pa, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
  function ribbon(mat) {       // fine ground laid along the trail: 33 cm cells at the path, widening to the sides, with the path cut flat
    const OFF = [0, .33, .66, 1, 1.4, 1.9, 2.5, 3.2, 4.1, 5.2, 6.4, 7.6, 8.4], W = OFF.length - 1, C = 2 * W + 1, n = T.n, pos = new Float32Array(n * C * 3), pa = new Float32Array(n * C), idx = []; let k = 0;
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let tx = T.px[b] - T.px[a], tz = T.pz[b] - T.pz[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      for (let j = -W; j <= W; j++) { const d = OFF[Math.abs(j)], off = Math.sign(j) * d, x = T.px[i] - tz * off, z = T.pz[i] + tx * off;
        pos[k * 3] = x; pos[k * 3 + 1] = Math.abs(j) === W ? H0(x, z) - 1 : fineH(x, z, d, T.py[i]); pos[k * 3 + 2] = z; pa[k] = 1 - sm(.4, 1.05, d); k++; }
      if (i < n - 1) for (let j = 0; j < C - 1; j++) { const a0 = i * C + j, b0 = a0 + 1, c0 = a0 + C, d0 = c0 + 1; idx.push(a0, b0, c0, b0, d0, c0); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPath', new THREE.BufferAttribute(pa, 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }

  // ---- what grows on it (prototypes in metres) ----
  // a conifer as tiers of drooping boughs: each tier is a skirt whose rim is ragged in the shader (material 23), so the outline is boughs, not a cone
  function conifer(larch, tiers, seg, twin, base = larch ? .2 : .17, uvk = 1) { const a = [], HT = 20;
    a.push(K.tag(K.tube([V(0, -.6, 0), V(rr(-.12, .12), HT * .5, rr(-.12, .12)), V(0, HT * .97, 0)], t => .32 * (1 - t) + .03, 6), larch ? '#6b4a34' : '#4a3a2e', 19));
    for (let k = 0; k < tiers; k++) { const f = k / (tiers - 1), y0 = HT * (base + (.975 - base) * f), R0 = ((HT - y0) * (larch ? .25 : .3) + .65) * rr(.85, 1.15), drop = R0 * (larch ? .62 : .46), tw = rr(0, TAU);
      for (let ly = 0; ly < (twin ? 2 : 1); ly++) { const pos = [], nor = [], uv = [], idx = [];
        for (let i = 0; i <= seg; i++) { const an = tw + (i % seg) / seg * TAU + ly * Math.PI / seg, c = Math.cos(an), s = Math.sin(an), ro = R0 * (ly ? .74 : 1) * (.78 + .44 * NZ.n3(i % seg * 1.7 + k * 3.1, ly * 5.5, f * 9)), yo = y0 - drop * (.75 + .5 * NZ.n3(i % seg * 2.3, k * 1.9, 4 + ly)) - ly * .22 * R0;
          pos.push(c * .1 * R0, y0 + .14 * R0, s * .1 * R0, c * ro, yo, s * ro); nor.push(c * .75, .66, s * .75, c * .8, .6, s * .8); uv.push(i / seg * uvk, 0, i / seg * uvk, 1);
          if (i < seg) { const p = i * 2; idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); } }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); a.push(K.tag(g, '#ffffff', 23)); } }
    return K.merge(a); }
  const tuft = (h, nb) => K.merge(Array.from({ length: nb }, () => K.tag(K.leaf(h * rr(.55, 1.15), rr(.018, .032), { ns: 2, nw: 1, bend: rr(.2, 1.1), shape: K.shBlade }), new THREE.Color(1, 1, 1).offsetHSL(0, 0, rr(-.12, 0)), 3, K.M([rr(-.2, .2), 0, rr(-.2, .2)], [rr(.05, .5), rr(0, TAU), 0]))));
  function bilberry() { const a = [], c = V(0, .02, 0); for (let i = 0; i < 30; i++) { const u = rr(.05, 1), an = rr(0, TAU), s = Math.sqrt(1 - u * u), d = V(s * Math.cos(an), u, s * Math.sin(an));
      a.push(K.tag(K.leaf(rr(.06, .09), rr(.045, .06), { ns: 1, nw: 1, shape: v => 1 - v * .6 }), pick(['#b3261a', '#c9401c', '#8f1d1d', '#d0661e', '#5a7a2e']), 1, K.Md(c.clone().addScaledVector(d, rr(.08, .24)), d.add(V(rr(-.5, .5), rr(0, .5), rr(-.5, .5)))))); } return K.merge(a); }
  const fern = () => K.merge(Array.from({ length: 8 }, (_, k) => K.tag(K.leaf(rr(.6, .95), rr(.22, .3), { ns: 6, nw: 2, bend: rr(.8, 1.25), fold: .12 }), new THREE.Color('#5c9440').offsetHSL(0, 0, rr(-.05, .05)), 26, K.M([0, 0, 0], [rr(.35, .9), k / 8 * TAU + rr(-.25, .25), 0]))));
  const SPR = ['#2a5a34', '#234a2c', '#336238', '#2c5a3e'].map(c => new THREE.Color(c)), LAR = ['#dba21c', '#c98d16', '#e2b530', '#b9801a', '#cfae3a'].map(c => new THREE.Color(c));
  const GRS = ['#b0a24a', '#9c9a44', '#c2a650', '#8a9440', '#a88a3c'].map(c => new THREE.Color(c)), GRF = ['#5f8a3a', '#6f9440', '#4f7a34'].map(c => new THREE.Color(c)), GRL = ['#5f9a3a', '#6aa23c', '#548c36'].map(c => new THREE.Color(c)), GRD = ['#c9bd84', '#b8b07a', '#d4c68c'].map(c => new THREE.Color(c)), RKC = ['#b5b1ab', '#a09d99', '#c2bcb2', '#93918f'].map(c => new THREE.Color(c));

  // ---- grass that follows the lens: square tiles around the camera, refilled from the height function as it moves ----
  const tiles = []; let tileQ = [];
  function tileSet(parent, size, n, count, geos, mat, scale) { const set = { size, n, count, map: new Map(), free: [] };
    for (let i = 0; i < n * n; i++) { const im = new THREE.InstancedMesh(geos[i % geos.length], mat, count); im.frustumCulled = false; im.receiveShadow = true; im.count = 0; im.setColorAt(0, new THREE.Color(1, 1, 1)); parent.add(im); set.free.push(im); }
    set.fill = (im, ix, iz) => { const r = rng((Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663)) >>> 0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), YA = new THREE.Vector3(0, 1, 0), col = new THREE.Color(); let c = 0;
      for (let i = 0; i < count; i++) { const x = (ix + r()) * size, z = (iz + r()) * size, u = r(), h0 = H0(x, z); if (h0 < .7) continue;
        const dg = Math.hypot(x - GP.x, z - GP.z), tl = tlAt(x, z); let pr, pal, sc = 1;
        if (dg < 11.5) continue; if (h0 < 3.2) { pr = h0 > 1.6 ? .07 : 0; pal = GRD; sc = 1.5; } else if (dg < 34 || h0 < 12) { pr = .95; pal = GRL; sc = .8; } else if (h0 < tl - 4) { pr = .55; pal = GRF; sc = .85; } else if (h0 < MEADOW + 6) { pr = 1; pal = GRS; } else { pr = .1; pal = GRS; sc = .7; }
        if (u > pr) continue; const o = nearTrail(x, z); if (o.d < .8) continue; const g = grad(x, z); if (g[0] * g[0] + g[1] * g[1] > 1.3) continue;
        const k = scale * sc * (.7 + .7 * r()); m.compose(p.set(x, ground(x, z) - .03, z), q.setFromAxisAngle(YA, r() * TAU), s.set(k, k * (.8 + .5 * r()), k)); im.setMatrixAt(c, m); im.setColorAt(c, col.copy(pal[Math.floor(r() * pal.length)])); c++; }
      im.count = c; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; };
    tiles.push(set); return set; }
  function followGrass(cam) { for (const set of tiles) { const cx = Math.floor(cam.x / set.size), cz = Math.floor(cam.z / set.size), h = (set.n - 1) / 2, want = new Set();
      for (let a = -h; a <= h; a++) for (let b = -h; b <= h; b++) want.add((cx + a) + ',' + (cz + b));
      for (const [k, im] of set.map) if (!want.has(k)) { set.map.delete(k); im.count = 0; set.free.push(im); }
      for (const k of want) if (!set.map.has(k) && set.free.length) { const im = set.free.pop(); set.map.set(k, im); const [ix, iz] = k.split(',').map(Number); tileQ.push([set, im, ix, iz, k]); } }
    for (let n = 0; n < 2 && tileQ.length; n++) { const [set, im, ix, iz, k] = tileQ.shift(); if (set.map.get(k) === im) set.fill(im, ix, iz); } }

  async function build(scene, prog, tick) {
    const t0 = performance.now(); findTrail(); prog(.1); await tick();
    const gm = groundMat(), grp = new THREE.Group(); grp.name = 'island'; scene.add(grp);
    grp.add(gridMesh(IC.x - 620, IC.z - 620, 1240, LOW ? 260 : 440, (x, z) => { const o = nearTrail(x, z); return o.d < 8.4 ? Math.min(fineH(x, z, o.d, o.y), o.y) - .7 : H0(x, z) - .15; }, gm));      // the far mesh ducks under the fine strip along the trail prog(.3); await tick();
    grp.add(ribbon(gm)); grp.add(gridMesh(GP.x - 30, GP.z - 30, 60, 200, (x, z) => H0(x, z) + .14 + micro(x, z) * sm(11, 22, Math.hypot(x - GP.x, z - GP.z)), gm, true)); prog(.45); await tick();
    const mTree = FXKit.mat({ sway: [.02, 10] }), mGrass = FXKit.mat({ sway: [.22, .3] }), mShrub = FXKit.mat({ sway: [.06, .4] }), mStill = FXKit.mat();
    const P = { spruce: [conifer(false, 15, 18, true, .34, 3), conifer(false, 14, 18, true, .38, 3)], larch: [conifer(true, 13, 18, true, .34, 3), conifer(true, 12, 18, true, .38, 3)], farS: [conifer(false, 8, 10), conifer(false, 7, 10)], farL: [conifer(true, 7, 10), conifer(true, 6, 10)],
      tuft: [tuft(.36, 14), tuft(.3, 14), tuft(.42, 13)], bil: [bilberry(), bilberry()], fern: [fern(), fern()], rock: [0, 1, 2, 3].map(i => K.tag(K.blob(i * 7.3 + 1, .3, 14, 10), '#ffffff', 7, K.M([0, 0, 0], [0, 0, 0], [1, .72, 1]))),
      log: K.merge([K.tag(K.tube([V(-2.2, .16, 0), V(0, .2, .1), V(2.2, .14, 0)], t => .17 - .05 * t, 7), '#b8ab98', 4), K.tag(K.tube([V(.6, .2, 0), V(.9, .5, .3), V(1.1, .9, .4)], t => .05 - .03 * t, 4), '#b8ab98', 4)]) };
    const B = K.buckets(grp, 60);
    // forest: trees everywhere under the treeline, larches as it nears
    const cell = LOW ? 9 : 6.5; for (let x = IC.x - 520; x < IC.x + 520; x += cell) for (let z = IC.z - 520; z < IC.z + 520; z += cell) { const px = x + rr(0, cell), pz = z + rr(0, cell), h = H0(px, pz); if (h < 9 || h > tlAt(px, pz) || R() > .86) continue;
      if (Math.hypot(px - GP.x, pz - GP.z) < 24 || nearTrail(px, pz).d < 7.5) continue; const g = grad(px, pz); if (Math.hypot(g[0], g[1]) > 1.0) continue;
      const larch = R() < sm(150, 200, h) * .92 + .04, s = rr(.7, 1.3) * (larch ? .85 : 1), k = R() < .5 ? 0 : 1; B.put((larch ? 'L' : 'S') + k, (larch ? P.farL : P.farS)[k], mTree, px, h - .45, pz, rr(0, TAU), s, s * rr(.9, 1.15), pick(larch ? LAR : SPR)); }
    prog(.65); await tick();
    // along the trail: fuller conifers beside it, ferns and bilberry under them, rock above the trees
    for (let i = 8; i < T.n; i++) { const h = T.py[i], a = Math.max(0, i - 1), b = Math.min(T.n - 1, i + 1); let tx = T.px[b] - T.px[a], tz = T.pz[b] - T.pz[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const at = (off, along) => [T.px[i] - tz * off + tx * along, T.pz[i] + tx * off + tz * along], forest = h < tlAt(T.px[i], T.pz[i]) - 4, meadow = !forest && h < MEADOW + 6;
      const put = (key, geo, mat, off, s, sy, col, sink = 0) => { const [x, z] = at(off, rr(-.5, .5)); if (nearTrail(x, z).d < Math.min(Math.abs(off), .75)) return; B.put(key, geo, mat, x, ground(x, z) - sink, z, rr(0, TAU), s, sy, col); };
      if (forest && i % 4 === 0) for (const sd of [-1, 1]) if (R() < .85) { const larch = R() < sm(150, 200, h) * .9, k = R() < .5 ? 0 : 1, s = rr(.75, 1.4) * (larch ? .82 : 1); put((larch ? 'l' : 's') + k, (larch ? P.larch : P.spruce)[k], mTree, sd * rr(5.5, 8), s * rr(.9, 1.1), s, pick(larch ? LAR : SPR), .3); }
      if (forest) { if (R() < .8) put('f' + (i & 1), P.fern[i & 1], mShrub, (R() < .5 ? -1 : 1) * rr(.9, 5), rr(.7, 1.4)); if (R() < .4) put('b' + (i & 1), P.bil[i & 1], mShrub, (R() < .5 ? -1 : 1) * rr(.9, 4), rr(.8, 1.5)); }
      else if (meadow) { if (R() < .6) put('b' + (i & 1), P.bil[i & 1], mShrub, (R() < .5 ? -1 : 1) * rr(.9, 5), rr(.9, 1.9)); }
      else for (let k = 0; k < 4; k++) put('r' + (k & 3), P.rock[k & 3], mStill, (R() < .5 ? -1 : 1) * rr(.75, 5), rr(.12, .42), undefined, pick(RKC), .05);
      if (R() < .14) put('r' + (i & 3), P.rock[i & 3], mStill, (R() < .5 ? -1 : 1) * rr(1.6, 6), rr(.3, .9), undefined, pick(RKC), .2); }
    for (let k = 0; k < 420; k++) { const an = rr(0, TAU), r = Math.sqrt(R()) * 70, x = SUMMIT.x + Math.cos(an) * r, z = SUMMIT.z + Math.sin(an) * r; if (nearTrail(x, z).d < 2.4 || r < 6) continue; const s = rr(.5, 2.4); B.put('r' + (k & 3), P.rock[k & 3], mStill, x, ground(x, z) - s * .2, z, rr(0, TAU), s, s * rr(.6, 1), pick(RKC)); }
    // the shore: pebbles, boulders and driftwood where the land meets the water
    for (let k = 0; k < 1500; k++) { const an = rr(0, TAU), c = Math.cos(an), s = Math.sin(an); let r = 520; for (; r > 300; r -= 4) if (H0(IC.x + c * r, IC.z + s * r) > .3) break; r -= rr(0, 16); const x = IC.x + c * r, z = IC.z + s * r, h = H0(x, z); if (h < -.3 || h > 4.5) continue;
      if (R() < .035) B.put('log', P.log, mStill, x, h - .05, z, rr(0, TAU), rr(.6, 1.3)); else { const sc = R() < .08 ? rr(.5, 1.6) : rr(.06, .3); B.put('r' + (k & 3), P.rock[k & 3], mStill, x, h - sc * .25, z, rr(0, TAU), sc, sc * rr(.5, .9), pick(RKC)); } }
    G.info.islandInst = B.flush({ cast: true, receive: true });
    { const a = [], x = SUMMIT.x + 1.6, z = SUMMIT.z - 2.2;       // the cairn
      for (let i = 0; i < 16; i++) { const lv = Math.floor(i / 4), an = i * 1.7, r = (.5 - lv * .11) * (i % 4 ? 1 : .3), s = rr(.2, .3) * (1 - lv * .12); a.push(K.tag(K.blob(i * 3.1, .3), pick(['#8d8a86', '#7c7a78', '#9a958e']), 7, K.M([Math.cos(an) * r, .12 + lv * .27, Math.sin(an) * r], [rr(-.3, .3), rr(0, 6), rr(-.3, .3)], [s * 1.2, s * .7, s]))); }
      const cm = new THREE.Mesh(K.merge(a), mStill); cm.position.set(x, ground(x, z), z); cm.castShadow = cm.receiveShadow = true; grp.add(cm); }
    tileSet(grp, 7, 5, LOW ? 500 : 1100, P.tuft, mGrass, 1); tileSet(grp, 20, 7, LOW ? 500 : 1000, P.tuft, mGrass, 2.3);
    G.tick.push(() => followGrass(G.camera.position)); followGrass(V(GP.x, 0, GP.z)); while (tileQ.length) followGrass(V(GP.x, 0, GP.z));
    G.info.island = { trail: T.n, summit: [Math.round(SUMMIT.x), Math.round(SUMMIT.y), Math.round(SUMMIT.z)], ms: Math.round(performance.now() - t0) }; prog(1);
  }
  return { build, H0, ground, nearTrail, T, SUMMIT, GP, IC, TREELINE, MEADOW };
})();
