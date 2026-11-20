'use strict';
// ---- FXKit: the shading and modelling pieces of "Bee Garden" and "Mountain Hike", gathered in one place and made to live under
//      this world's light (three.js standard lighting + the Daylight / fog chunks of 05_glsl.js).
//      FXKit.geo   procedural geometry: leaf surfaces, tubes, tagging (colour + material id), merging, fur strands
//      FXKit.mat   one patched MeshStandardMaterial that draws every organic surface from a per-vertex material id
//      FXKit.glsl  stand-alone GLSL snippets (post effects and helpers that this world's own post chain does not use yet) ----
const FXKit = (() => {
  const YAX = new THREE.Vector3(0, 1, 0);
  const shLeaf = v => Math.pow(Math.sin(Math.PI * Math.pow(v, .75)), .7), shPetal = v => Math.pow(Math.sin(Math.PI * Math.pow(v, 1.5)), .6);
  const shBlade = v => Math.pow(1 - v, .6), shRound = v => Math.pow(Math.sin(Math.PI * Math.pow(v, .9)), .5);
  // a leaf / petal / blade: grows along +Y, bends toward +Z, width along X
  function leaf(len, wid, o = {}) {
    const ns = o.ns ?? 4, nw = o.nw ?? 2, bend = o.bend ?? 0, fold = o.fold ?? 0, sh = o.shape ?? shLeaf, wave = o.wave ?? 0, pos = [], uv = [], idx = []; let y = 0, z = 0; const dl = len / ns;
    for (let i = 0; i <= ns; i++) { const v = i / ns, a = bend * v;
      if (i > 0) { const am = bend * (i - .5) / ns; y += Math.cos(am) * dl; z += Math.sin(am) * dl; }
      const w = wid * .5 * sh(v), ny = -Math.sin(a), nz = Math.cos(a);
      for (let j = 0; j <= nw; j++) { const u = j / nw * 2 - 1, off = fold * Math.abs(u) * w + wave * Math.sin(v * 9 + u * 2) * w * .3; pos.push(u * w, y + ny * off, z + nz * off); uv.push(j / nw, v); } }
    for (let i = 0; i < ns; i++) for (let j = 0; j < nw; j++) { const a = i * (nw + 1) + j, b = a + 1, c = a + nw + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function tube(pts, radius, rs = 5) {
    const n = pts.length, rf = typeof radius === 'function' ? radius : () => radius, pos = [], nor = [], uv = [], idx = [], T = new THREE.Vector3(), B = new THREE.Vector3(); let N = null;
    for (let i = 0; i < n; i++) { T.copy(pts[Math.min(i + 1, n - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
      if (!N) { N = new THREE.Vector3(1, 0, 0); if (Math.abs(T.x) > .9) N.set(0, 0, 1); } N.addScaledVector(T, -N.dot(T)).normalize(); B.crossVectors(T, N);
      const r = rf(i / (n - 1)), p = pts[i];
      for (let j = 0; j <= rs; j++) { const a = j / rs * TAU, c = Math.cos(a), s = Math.sin(a), nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s; pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r); nor.push(nx, ny, nz); uv.push(j / rs, i / (n - 1)); } }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < rs; j++) { const a = i * (rs + 1) + j, b = a + 1, c = a + rs + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  const sph = (ws = 10, hs = 8) => new THREE.SphereGeometry(1, ws, hs);
  function M(p = [0, 0, 0], r = [0, 0, 0], s = 1) { const sc = Array.isArray(s) ? s : [s, s, s]; return new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ')), new THREE.Vector3(...sc)); }
  function Md(p, dir, s = 1) { const sc = Array.isArray(s) ? s : [s, s, s]; return new THREE.Matrix4().compose(p.isVector3 ? p : new THREE.Vector3(...p), new THREE.Quaternion().setFromUnitVectors(YAX, dir.clone().normalize()), new THREE.Vector3(...sc)); }
  const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);
  // colour (sRGB hex or THREE.Color) + material id baked per vertex; every tagged geometry has position, normal, uv, color, aM
  function tag(g, col, mat, m) {
    if (m) g.applyMatrix4(m); const n = g.attributes.position.count; if (!g.index) g.setIndex([...Array(n).keys()]);
    const c = col.isColor ? col : new THREE.Color(col), ac = new Float32Array(n * 3), am = new Float32Array(n).fill(mat);
    for (let i = 0; i < n; i++) { ac[i * 3] = c.r; ac[i * 3 + 1] = c.g; ac[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ac, 3)); g.setAttribute('aM', new THREE.BufferAttribute(am, 1));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aM'].includes(k)) g.deleteAttribute(k);
    return g;
  }
  function merge(list) { let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), Uv = new Float32Array(nv * 2), C = new Float32Array(nv * 3), A = new Float32Array(nv), I = new Uint32Array(ni); let vo = 0, io = 0;
    for (const g of list) { const a = g.attributes, c = a.position.count; P.set(a.position.array, vo * 3); Nn.set(a.normal.array, vo * 3); Uv.set(a.uv.array, vo * 2); C.set(a.color.array, vo * 3); A.set(a.aM.array, vo);
      const ia = g.index.array; for (let i = 0; i < ia.length; i++) I[io + i] = ia[i] + vo; io += ia.length; vo += c; }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); o.setAttribute('uv', new THREE.BufferAttribute(Uv, 2));
    o.setAttribute('color', new THREE.BufferAttribute(C, 3)); o.setAttribute('aM', new THREE.BufferAttribute(A, 1)); o.setIndex(new THREE.BufferAttribute(I, 1)); return o; }
  const box = (x0, x1, y0, y1, z0, z1, col, mat) => tag(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), col, mat, M([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]));
  // a lumpy stone / foliage mass: a sphere pushed about by noise
  function blob(seed, amp = .3, ws = 10, hs = 7) { const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + amp * 2 * NZ.n3(x * 1.7 + seed, y * 1.7, z * 1.7 - seed); p.setXYZ(i, x * d, y * d, z * d); } g.computeVertexNormals(); return g; }
  // fur: single-triangle strands grown from an ellipsoid, combed along `flow`
  function fur(c, r, n, len, flow, R, wk = .09) { const pos = [], nor = [], uv = [], f = new THREE.Vector3(...flow), nv = new THREE.Vector3(), d = new THREE.Vector3(), sd = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) { const u = R() * 2 - 1, an = R() * TAU, s = Math.sqrt(1 - u * u), dx = s * Math.cos(an), dz = s * Math.sin(an);
      p.set(c[0] + dx * r[0], c[1] + u * r[1], c[2] + dz * r[2]); nv.set(dx / r[0], u / r[1], dz / r[2]).normalize();
      d.copy(nv).multiplyScalar(.55).add(f).add(new THREE.Vector3(R() * .5 - .25, R() * .5 - .25, R() * .5 - .25)).normalize(); sd.crossVectors(d, nv).normalize().multiplyScalar(wk * len);
      const L = len * (.6 + .7 * R()), nn = nv.clone().multiplyScalar(.75).addScaledVector(d, .25).normalize();
      pos.push(p.x - sd.x, p.y - sd.y, p.z - sd.z, p.x + sd.x, p.y + sd.y, p.z + sd.z, p.x + d.x * L, p.y + d.y * L, p.z + d.z * L); for (let k = 0; k < 3; k++) nor.push(nn.x, nn.y, nn.z); uv.push(0, 0, 1, 0, .5, 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; }
  // instances gathered in spatial chunks so the renderer can cull them
  function buckets(parent, chunk = 40) { const map = new Map(), WHITE = new THREE.Color(1, 1, 1);
    return { put(key, geo, mat, x, y, z, ry, s, sy, col, quat) { const k = key + '|' + Math.floor(x / chunk) + '|' + Math.floor(z / chunk); let b = map.get(k); if (!b) { b = { geo, mat, list: [], col: false }; map.set(k, b); }
        const q = new THREE.Quaternion().setFromAxisAngle(YAX, ry); if (quat) q.premultiply(quat);
        b.list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, sy ?? s, s)), c: col }); if (col) b.col = true; },
      flush(o = {}) { let n = 0; for (const b of map.values()) { const im = new THREE.InstancedMesh(b.geo, b.mat, b.list.length);
          b.list.forEach((e, i) => { im.setMatrixAt(i, e.m); if (b.col) im.setColorAt(i, e.c || WHITE); }); im.castShadow = !!o.cast; im.receiveShadow = !!o.receive; im.computeBoundingSphere(); parent.add(im); n += b.list.length; } map.clear(); return n; } }; }

  // ---- the surface library (fragment). Material ids:
  //  0 plain  1 leaf (veins)  2 petal (streaks, nectar guide)  3 grass blade  4 timber  5 insect fuzz  6 fur (tabby)  7 stone  8 florets / pollen
  //  9 glossy  10 honeycomb  15 cat's eye  17 striped fuzz  19 bark  22 needle-bearing branch (cut out)  23 conifer bough tier (ragged rim, cut out)  24 far conifer (outline drawn on a card)  26 fern (cut out)
  // Share shoot cutouts with the shadow pass so that sunlight can reach the forest floor.
  const coniferMask = /* glsl */`
bool openNeedles(int m, vec2 uv, vec3 p) {
  float v=uv.y;
  if(m==22) {
    float u=abs(uv.x-.5)*2.;
    float tw=abs(fract(v*34.+u*3.2+p.y*.7)-.5);
    float leaf=step(tw,.2+.16*vnoise3(vec3(uv*vec2(9.,70.),p.y)))*step(u,1.-.35*v);
    leaf*=step(.3,vnoise3(vec3(uv.x*5.,v*4.,p.y*3.1))+.25*(1.-u));
    return max(leaf,step(u,.07))<.5;
  }
  if(m==23) {
    float seed=vnoise3(vec3(uv.x*70.,p.y*2.,uv.x*17.));
    float ribs=uv.x*10.+vnoise3(vec3(p.y*1.7,uv.x*3.,1.))*.6;
    float gap=abs(fract(ribs)-.5);
    float tip=.56+.37*seed+.08*cos(ribs*6.283);
    return v>tip || (gap>.44+.04*seed-.105*smoothstep(.23,.88,v) && v>.27);
  }
  return false;
}`;
  const FRAG = coniferMask + /* glsl */`
varying float vM, vH; varying vec3 vWp, vOp; varying vec2 vFxUv;
uniform float uGuide, uPupil;
float fxTrans, fxRough, fxAO;
vec3 fxHex(vec2 p){ const vec2 s=vec2(1.,1.7320508); vec4 hC=floor(vec4(p,p-vec2(.5,1.))/s.xyxy)+.5; vec4 h=vec4(p-hC.xy*s,p-(hC.zw+.5)*s);
  vec2 c=dot(h.xy,h.xy)<dot(h.zw,h.zw)?hC.xy*s:(hC.zw+.5)*s; vec2 l=abs(p-c); return vec3(c,.5-max(dot(l,s*.5),l.x)); }
vec3 fxSurface(vec3 alb){
  int m=int(vM+.5); vec2 uv=vFxUv; fxTrans=0.; fxRough=.85; fxAO=1.;
  if(m==1){ float u=abs(uv.x-.5)*2.; float mid=smoothstep(.07,0.,u), side=smoothstep(.4,.5,abs(fract(uv.y*7.+u*1.6)-.5));
    alb*=.8+.4*vnoise3(vOp*1.3); alb=mix(alb,alb*1.5+vec3(.02,.04,0.),max(mid,side*.4)*.55); fxTrans=.7; fxRough=.6; fxAO=mix(.55,1.,smoothstep(0.,.22,vH)); }
  else if(m==2){ alb*=.86+.26*vnoise3(vec3(uv.x*26.,uv.y*2.,vOp.x)); float g=smoothstep(.6,.05,uv.y)*(.55+.45*step(.5,fract(uv.x*6.)));
    alb=mix(alb,alb*vec3(.4,.2,.55),g*uGuide); fxTrans=.9; fxRough=.75; }
  else if(m==3){ alb*=mix(.45,1.15,uv.y); alb=mix(alb,alb*vec3(1.2,1.1,.55),smoothstep(.7,1.,uv.y)*.5); fxTrans=.6; fxRough=.55; fxAO=mix(.3,1.,smoothstep(0.,.07,vH)); }
  else if(m==4){ alb*=.7+.5*vnoise3(vec3(vOp.x*3.,vOp.y*40.,vOp.z*3.))*vnoise3(vOp*2.+4.); }
  else if(m==5||m==17){ if(m==17) alb=mix(vec3(.025,.018,.01),alb,smoothstep(.42,.5,abs(fract(uv.y*4.3+.1)-.5))); alb*=.75+.5*vnoise3(vOp*40.); fxRough=.95; }
  else if(m==6){ float lum=dot(alb,vec3(.33)); float st=vnoise3(vec3(vOp.x*.22,vOp.y*.75+sin(vOp.x*.35)*1.3,vOp.z*.22)+11.);
    alb=mix(alb,alb*.42,smoothstep(.47,.6,st)*step(lum,.5)); alb*=.78+.44*vnoise3(vOp*vec3(9.,3.,9.)); fxRough=1.; }
  else if(m==7){ alb*=.5+.8*fbm3(vOp*2.2); fxRough=.9; }
  else if(m==8){ alb*=.65+.6*vnoise3(vOp*22.); }
  else if(m==9){ fxRough=.18; }
  else if(m==10){ vec3 hx=fxHex(vOp.xy/.54); float e=hx.z, id=hash21(hx.xy*7.3+floor(vOp.z)); float wall=smoothstep(.09,.03,e);
    vec3 cell=id<.5?vec3(.55,.24,.02):(id<.75?vec3(.82,.66,.36):vec3(.07,.04,.015)); cell*=id<.75?1.:1.-.6*smoothstep(.1,.4,e); alb=mix(cell,vec3(.78,.55,.18),wall); fxRough=id<.5?.25:.8; }
  else if(m==15){ vec3 p=normalize(vOp); float r=length(p.xy);
    vec3 iris=mix(vec3(.75,.55,.08),vec3(.35,.5,.12),smoothstep(.2,.75,r))*(.8+.4*vnoise(vec2(atan(p.y,p.x)*9.,r*4.)));
    float slit=uPupil*sqrt(max(0.,1.-pow(p.y/.66,2.))); alb=p.z>0.&&r<.8?iris:vec3(.05,.035,.03);
    alb=mix(alb,vec3(.01),smoothstep(.72,.8,r)*step(0.,p.z)); if(p.z>0.&&abs(p.x)<slit) alb=vec3(.004); fxRough=.05; }
  else if(m==19){ alb*=.45+vnoise3(vec3(vOp.x*14.,vOp.y*1.3,vOp.z*14.)); fxRough=.95; }
  else if(m==22 || m==23){
    if(openNeedles(m,uv,vOp)) discard;
    float tip=m==22?abs(uv.x-.5)*2.:uv.y;
    float cluster=vnoise3(vWp*vec3(.65,.92,.65));
    float young=smoothstep(.38,.92,tip)*(.38+.62*cluster);
    float lum=dot(alb,vec3(.2126,.7152,.0722));
    alb=mix(vec3(lum),alb,.76)*mix(vec3(.64,.75,.83),vec3(1.17,1.02,.68),young);
    alb*=mix(.73,1.16,cluster); fxTrans=mix(.09,.41,young);
    fxRough=mix(.90,.68,young); fxAO=mix(.54,1.,tip); }
  else if(m==24){ float v=uv.y, x=abs(uv.x-.5)*2., t=fract(v*7.), w=((1.-v)*(1.-.42*t)+.03)*(.82+.36*vnoise3(vec3(uv.x*38.,v*46.,3.)));
    bool trunk=x<.045&&v<.24; if((x>w||v<.13)&&!trunk) discard;
    alb=trunk&&(x>w||v<.13)?vec3(.09,.06,.04):alb*mix(.3,1.1,clamp(x/max(w,.01),0.,1.))*(.7+.6*vnoise3(vec3(uv.x*30.,v*40.,1.))); fxTrans=.3; }
  else if(m==26){ float u=abs(uv.x-.5)*2.; if(u>.1&&fract(uv.y*15.+u*.8)>.62) discard; alb*=.8+.4*uv.y; fxTrans=.7; fxAO=mix(.5,1.,smoothstep(0.,.3,vH)); }
  return alb*fxAO;
}`;
  const U = { uGuide: { value: .3 }, uPupil: { value: .1 } };
  function coniferDepth() {
    const depth = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking});
    patch(depth, s => {
      s.vHead('attribute float aM; uniform vec3 uSunDir; varying float treePart; varying vec2 treeUV, crownRay; varying vec3 treeLocal;\n'+GLSL_WIND);
      s.v('#include <begin_vertex>', `#include <begin_vertex>
        treePart=aM; treeUV=uv; treeLocal=position; crownRay=vec2(0.);
        #ifdef USE_INSTANCING
          mat4 objectToWorld=modelMatrix*instanceMatrix;
          float height=max(0.,(objectToWorld*vec4(position,1.)).y-objectToWorld[3].y);
          mat3 rot=mat3(objectToWorld);
          transformed+=(clWind(objectToWorld[3].xyz,.02*height*height/(height+10.))*rot)/dot(rot[0],rot[0]);
          // A sun ray keeps the same opening through overlapping foliage shells.
          // Anchor the pattern at the tree, independent of the camera and shadow-map texels.
          vec3 rel=rot*transformed;
          vec3 side=normalize(vec3(uSunDir.z,0.,-uSunDir.x));
          crownRay=vec2(dot(rel,side),dot(rel,cross(uSunDir,side)))+objectToWorld[3].xz;
        #endif`);
      s.fHead(GLSL_NOISE+coniferMask+'\nvarying float treePart; varying vec2 treeUV, crownRay; varying vec3 treeLocal;');
      s.f('#include <alphatest_fragment>',`#include <alphatest_fragment>
        int part=int(treePart+.5);
        if(openNeedles(part,treeUV,treeLocal)) discard;
        if(part==23 && .7*vnoise(crownRay*1.65)+.3*vnoise(crownRay*4.5)>.58) discard;`);
    }, 'conifer-depth');
    return depth;
  }
  // sway: [amplitude, length scale] in the units of the world (metres). Vertices move with the square of their height above the plant's foot.
  function mat(o = {}) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true, side: THREE.DoubleSide, envMapIntensity: .6 });
    const sw = o.sway || [0, 1], key = 'fxkit' + sw.join('_') + (o.alpha ? 'a' + o.alpha : '');
    if (o.alpha) { m.transparent = true; m.opacity = o.alpha; m.depthWrite = false; }
    patch(m, s => { Object.assign(s.sh.uniforms, U); s.sh.uniforms.uSway = { value: new THREE.Vector2(sw[0], sw[1]) };
      s.vHead(`attribute float aM; varying float vM, vH; varying vec3 vWp, vOp; varying vec2 vFxUv; uniform vec2 uSway;\n${GLSL_WIND}`);
      s.v('#include <begin_vertex>', `#include <begin_vertex>
  vM = aM; vOp = position; vFxUv = uv;
  #ifdef USE_INSTANCING
    mat4 fxMM = modelMatrix * instanceMatrix;
  #else
    mat4 fxMM = modelMatrix;
  #endif
  { vec3 fxO = fxMM[3].xyz, fxW = (fxMM * vec4(transformed, 1.0)).xyz; vH = max(fxW.y - fxO.y, 0.0); vWp = fxW;
    mat3 fxR = mat3(fxMM); transformed += (clWind(fxO, uSway.x * vH * vH / (vH + uSway.y)) * fxR) / dot(fxR[0], fxR[0]); }`);
      s.fHead(GLSL_NOISE + (typeof GLSL_WX !== 'undefined' ? GLSL_WX : 'uniform vec4 uWx; float wxCover(vec3 a, float b){ return 0.; }') + FRAG);
      s.f('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = fxSurface(diffuseColor.rgb);\n  { float fxNy = dot(normalize(vNormal), normalize(mat3(viewMatrix) * vec3(0., 1., 0.))), fxSc = wxCover(vWp, .45 + .55 * max(fxNy, 0.)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.87, .9, .95), fxSc * .92); fxRough = mix(fxRough, .7, fxSc); fxTrans *= 1. - .8 * fxSc; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.72, .8, .88), uWx.y * .3); }');
      s.f('#include <roughnessmap_fragment>', 'float roughnessFactor = fxRough;');
      // light through thin things: what the far side receives from the sun shows on this side, tinted by the leaf
      s.f('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  #ifdef USE_FOG
  { float fxSo; vec3 fxK = clSunK(vFogW, fxSo); vec3 fxL = normalize((viewMatrix * vec4(SUN_DIR, 0.0)).xyz);
    totalEmissiveRadiance += mix(diffuseColor.rgb, diffuseColor.rgb * diffuseColor.rgb * 3.0, 0.5) * fxK * vec3(1.0, 0.72, 0.46) * 1.9 * fxTrans * max(-dot(normal, fxL), 0.0); }
  #endif`);
    }, key);
    return m;
  }
  // ---- snippets that are not wired into this world's post chain: kept here so the three works share one shelf ----
  const glsl = {
    hex: 'vec3 fxHex(vec2 p) -> xy: cell centre, z: distance to the cell edge (0 at the edge, .5 at the centre). Honeycomb, compound-eye facets.',
    fisheye: /* glsl */`// stereographic lens over a rectilinear render. uK = tan(halfFov/2), uT = tan(cornerAngle)/cornerRadius
vec2 fxFisheye(vec2 uv, float uK, float uT, float aspect){ vec2 p=(uv*2.-1.)*vec2(1.,1./aspect); float r=length(p), th=2.*atan(r*uK);
  float s=r>1e-4?tan(th)/(r*uT):2.*uK/uT; return p*s*vec2(1.,aspect)*.5+.5; }`,
    dof: /* glsl */`// gather depth of field (golden-angle spiral). coc(d) = clamp(uApK*abs(1./uFocus-1./d), 0., uMaxC), in pixels
vec4 fxDof(sampler2D tC, sampler2D tD, vec2 uv, vec2 res, float jitter){ float d0=fxLin(texture2D(tD,uv).r), c0=fxCoc(d0); vec4 acc=texture2D(tC,uv); float n=1., ang=jitter*6.2832, rad=uStep;
  for(int i=0;i<96;i++){ if(rad>=uMaxC) break; vec2 t=uv+vec2(cos(ang),sin(ang))*rad/res; float d=fxLin(textureLod(tD,t,0.).r), c=fxCoc(d); if(d>d0) c=clamp(c,0.,c0*2.);
    acc+=mix(acc/n,textureLod(tC,t,0.),smoothstep(rad-.5,rad+.5,c)); n+=1.; ang+=2.39996323; rad+=uStep/rad; } return acc/n; }`,
    shafts: /* glsl */`// screen-space light shafts: march from the pixel to the sun's screen position over a sky mask (alpha = 1 where the sky shows)
float fxShafts(sampler2D tMask, vec2 uv, vec2 sunUV, float jitter){ vec2 dv=(sunUV-uv)/40.; vec2 p=uv+dv*jitter; float acc=0., w=1.;
  for(int i=0;i<40;i++){ acc+=textureLod(tMask,clamp(p,0.,1.),0.).a*w*step(abs(p.x-.5),.5)*step(abs(p.y-.5),.5); w*=.965; p+=dv; } return acc/22.; }`,
    compoundEye: /* glsl */`// a bee's eye: hexagonal mosaic + false colour (display R,G,B = green, blue, ultraviolet). uvr = UV reflectance kept in alpha
vec3 fxBeeEye(sampler2D tC, vec2 frag, vec2 res, float cells){ float cell=res.y/cells; vec3 hx=fxHex(frag/cell); vec4 c=texture2D(tC,hx.xy*cell/res);
  float uvl=c.a*(dot(c.rgb,vec3(.2))+.4*max(c.r,max(c.g,c.b)))*1.5; return vec3(c.g*1.05,c.b,uvl)*(1.-.6*smoothstep(.1,.02,hx.z)); }`,
    heightFog: /* glsl */`// fog that thins with altitude, integrated along the view ray. fog = (density at refY, refY, 1/scaleHeight)
float fxHeightFog(vec3 cam, vec3 p, vec3 fog){ vec3 v=p-cam; float d=length(v), fo=fog.x*exp(-(cam.y-fog.y)*fog.z), t=fog.z*v.y; return 1.-exp(-fo*(abs(t)>1e-3?(1.-exp(-t))/t:1.)*d); }`,
    macroShadow: /* glsl */`// a mountain's own shadow: march a height map toward the sun with growing steps; soft where the ray just clears a ridge
float fxMacroShadow(sampler2D tH, vec3 p, vec3 sun, vec2 org, float size){ float s=1., t=30.; for(int i=0;i<18;i++){ vec3 q=p+sun*t; s=min(s,(q.y-textureLod(tH,(q.xz-org)/size,0.).r+12.)*5./t); t*=1.42; } return clamp(s,0.,1.); }`,
  };
  return { geo: { leaf, tube, sph, M, Md, mul, tag, merge, box, blob, fur, buckets, shLeaf, shPetal, shBlade, shRound }, mat, coniferDepth, U, glsl, FRAG };
})();
