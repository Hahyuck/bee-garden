'use strict';
// ---- the lens and the film, from the Bee Garden: the scene is drawn into a floating-point picture with depth; a depth of field
//      gathers it along a golden-angle spiral (only when a mode asks for one); what is brighter than white blooms at two sizes;
//      then exposure, a little colour fringing and vignette, the ACES curve, gamma and grain. ----
const Post = (() => {
  const C = CFG.post, VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const DOF = /* glsl */`varying vec2 vUv; uniform sampler2D tC, tD, tF; uniform vec2 uRes; uniform float uNear, uFar, uFocus, uApK, uMaxC, uStep, uJit, uK, uT, uAspect, uFish;
// the picture is drawn straight (rectilinear) and wider than needed; this bends it into a stereographic fisheye, as an insect's wide eye would have it
vec2 distort(vec2 uv){ if (uFish < .5) return uv; vec2 p = (uv * 2. - 1.) * vec2(1., 1. / uAspect); float r = length(p), th = 2. * atan(r * uK), s = r > 1e-4 ? tan(th) / (r * uT) : 2. * uK / uT; return p * s * vec2(1., uAspect) * .5 + .5; }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float lin(float z){ float n = z * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - n * (uFar - uNear)); }
float FOC;
float coc(float d){ return clamp(uApK * abs(1. / FOC - 1. / d), 0., uMaxC); }
void main(){ vec2 uv = distort(vUv); FOC = uFocus > 0. ? uFocus : exp(texture2D(tF, vec2(.5)).r);
  float d0 = lin(texture2D(tD, uv).r), c0 = coc(d0); vec4 acc = texture2D(tC, uv); float n = 1.;
  float ang = hash12(gl_FragCoord.xy + fract(uJit * 7.31) * 311.) * 6.2832, rad = uStep;
  for (int i = 0; i < 96; i++) { if (rad >= uMaxC) break; vec2 tuv = uv + vec2(cos(ang), sin(ang)) * rad / uRes * .8;
    float d = lin(textureLod(tD, tuv, 0.).r), c = coc(d); if (d > d0) c = clamp(c, 0., c0 * 2.);
    acc += mix(acc / n, textureLod(tC, tuv, 0.), smoothstep(rad - .5, rad + .5, c)); n += 1.; ang += 2.39996323; rad += uStep / rad; }
  gl_FragColor = acc / n; }`;
  // autofocus: the distance of what is in the middle of the frame (the nearer of what is found there, so a flower in front of a far hill wins),
  // followed slowly, as an eye refocuses; kept in a one-pixel picture from frame to frame
  const FOCUS = `varying vec2 vUv; uniform sampler2D tD, tP; uniform float uNear, uFar, uRate, uAspect;
float lin(float z){ float n = z * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - n * (uFar - uNear)); }
void main(){ float mn = 1e9, av = 0.; for (int i = 0; i < 9; i++) { float a = float(i) * 2.39996, r = i == 0 ? 0. : .01 + .006 * float(i); float d = lin(texture2D(tD, vec2(.5) + vec2(cos(a), sin(a) * uAspect) * r).r); mn = min(mn, d); av += d; }
  float t = log(mix(mn, av / 9., .3)), p = texture2D(tP, vec2(.5)).r; gl_FragColor = vec4(mix(p, t, uRate), 0., 0., 1.); }`;
  const BRIGHT = `varying vec2 vUv; uniform sampler2D tC; uniform vec2 uPx; uniform float uExp;
void main(){ vec3 c = vec3(0.); for (int i = 0; i < 4; i++) { vec2 o = vec2(float(i / 2) * 2. - 1., float(i - (i / 2) * 2) * 2. - 1.); c += min(texture2D(tC, vUv + o * uPx).rgb, vec3(60.)); }
  c *= .25 * uExp; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(.9, 2.2, l), 1.); }`;
  const BLUR = `varying vec2 vUv; uniform sampler2D tC; uniform vec2 uDir;
void main(){ vec3 c = texture2D(tC, vUv).rgb * .227; c += (texture2D(tC, vUv + uDir * 1.385).rgb + texture2D(tC, vUv - uDir * 1.385).rgb) * .316;
  c += (texture2D(tC, vUv + uDir * 3.231).rgb + texture2D(tC, vUv - uDir * 3.231).rgb) * .0703; gl_FragColor = vec4(c, 1.); }`;
  const FINAL = /* glsl */`varying vec2 vUv; uniform sampler2D tC, tB1, tB2, tD; uniform float uExp, uTime, uAspect, uVig, uGrain, uBloom, uShafts, uFringe, uFilm, uEye; uniform vec2 uRes;
vec3 hexg(vec2 p){ const vec2 s = vec2(1., 1.7320508); vec4 hC = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5; vec4 h = vec4(p - hC.xy * s, p - (hC.zw + .5) * s); vec2 c = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? hC.xy * s : (hC.zw + .5) * s; vec2 l = abs(p - c); return vec3(c, .5 - max(dot(l, s * .5), l.x)); } uniform vec2 uSunScr; uniform vec3 uShaftCol, uHeat[2];
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main(){ vec2 uv = vUv;
  // the compound eye: the picture falls into hexagonal facets, each seeing one colour
  float cell = uRes.y / 82.; vec3 hx = hexg(gl_FragCoord.xy / cell); uv = mix(uv, hx.xy * cell / uRes, uEye);
  // hot air in front of the lens bends what is behind it
  for (int i = 0; i < 2; i++) { vec2 d = uv - uHeat[i].xy; d.x *= uAspect; float mask = exp(-dot(d, d) / .012) * uHeat[i].z; uv.x += sin(uv.y * 205. + uTime * 46. + sin(uv.x * 90.)) * .0026 * mask; uv.y += sin(uv.x * 188. - uTime * 42.) * .0018 * mask; }
  vec2 dir = uv - .5; float r = length(dir * vec2(uAspect, 1.)) / length(vec2(uAspect, 1.) * .5), ca = uFringe * r * r * uFilm;
  vec3 c = texture2D(tC, uv).rgb; c.r = texture2D(tC, uv + dir * ca).r; c.b = texture2D(tC, uv - dir * ca).b;
  vec3 col = c * uExp + (texture2D(tB1, uv).rgb * .16 + texture2D(tB2, uv).rgb * .2) * uBloom;
  // shafts of light: walk from the pixel towards the sun on screen; wherever the sky shows through (nothing in the depth), light gets past
  if (uShafts > .001) { vec2 toSun = uSunScr - uv; float tr = 0.;
    for (int i = 0; i < 14; i++) { float f = (float(i) + .5) / 14.; vec2 q = uv + toSun * f * .88; float open = step(.99997, texture2D(tD, q).r) * step(0., q.x) * step(q.x, 1.) * step(0., q.y) * step(q.y, 1.); tr += open * (.12 + min(1.5, texture2D(tB2, q).r)) * (1. - f * .68); }
    col += uShaftCol * tr / 14. * uShafts * exp(-length(toSun * vec2(uAspect, 1.)) * 2.5); }
  // a bee sees no red but does see ultraviolet: green goes to red, blue to green, and what is bright and pale stands in for UV in blue
  { float uvl = (dot(col, vec3(.2)) + .4 * max(col.r, max(col.g, col.b))) * .75; col = mix(col, vec3(col.g * 1.05, col.b, uvl), uEye); col *= 1. - smoothstep(.1, .02, hx.z) * .6 * uEye; }
  vec3 plain = clamp(col, 0., 1.);                                    // without the film: the light as it is, cut off at white
  col *= 1. - uVig * pow(r, 2.6); col = aces(col * 1.05); float l = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(l), col, 1.1); col = mix(plain, col, uFilm);
  col = pow(max(col, 0.), vec3(1. / 2.2)); col += (hash12(gl_FragCoord.xy + fract(uTime * 3.17) * 517.) - .5) * uGrain * uFilm; gl_FragColor = vec4(col, 1.); }`;
  const heatP = [{ p: new THREE.Vector3(), k: 0 }, { p: new THREE.Vector3(), k: 0 }], _s = new THREE.Vector3();
  let fA, fB, focusOn = false;
  let R, quad, qcam, qscene, rtMain, rtDof, rtLens, b1a, b1b, b2a, b2b, W = 0, H = 0, exp = C.exposure;
  // a mode sets these each frame. aperture 0: no depth of field. focus 0: autofocus on the middle of the frame. fisheye: the wide stereographic lens
  // (the mode must also give the camera the wider field it needs: camera.fov = Post.fisheyeFov(aspect)). eye: the compound-eye view, 0..1
  const lens = { focus: 10, aperture: 0, fisheye: false, eye: 0 };
  const fishK = asp => Math.tan(27 * Math.PI / 180) * Math.min(1, asp), fishT = asp => { const rc = Math.hypot(1, 1 / asp); return Math.tan(2 * Math.atan(rc * fishK(asp))) / rc; };
  const fisheyeFov = asp => 2 * Math.atan(fishT(asp) / asp) * 180 / Math.PI;
  const mat = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
  const M = {};
  function build(renderer) { R = renderer; qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qscene = new THREE.Scene(); quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qscene.add(quad);
    M.contact = mat(GLSL_CONTACT, {
      tColor: { value: null }, tDepth: { value: null }, uClip: { value: new THREE.Vector2() },
      uInvFocal: { value: new THREE.Vector2() }, uResolution: { value: new THREE.Vector2() },
      uRadius: { value: C.contactRadius }, uStrength: { value: C.contactStrength }
    });
    M.dof = mat(DOF, { tC: { value: null }, tD: { value: null }, uRes: { value: new THREE.Vector2() }, uNear: { value: .3 }, uFar: { value: 1 }, uFocus: { value: 1 }, uApK: { value: 0 }, uMaxC: { value: 14 }, uStep: { value: 1.1 }, uJit: { value: 0 }, tF: { value: null }, uK: { value: 1 }, uT: { value: 1 }, uAspect: { value: 1 }, uFish: { value: 0 } });
    M.focus = mat(FOCUS, { tD: { value: null }, tP: { value: null }, uNear: { value: .3 }, uFar: { value: 1 }, uRate: { value: 1 }, uAspect: { value: 1 } });
    fA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, depthBuffer: false, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter }); fB = fA.clone();
    M.bright = mat(BRIGHT, { tC: { value: null }, uPx: { value: new THREE.Vector2() }, uExp: { value: 1 } }); M.blur = mat(BLUR, { tC: { value: null }, uDir: { value: new THREE.Vector2() } });
    M.fin = mat(FINAL, { tC: { value: null }, tB1: { value: null }, tB2: { value: null }, uExp: { value: 1 }, uTime: G.uTime, uAspect: { value: 1 }, uVig: { value: C.vignette }, uGrain: { value: C.grain }, uBloom: { value: C.bloom }, uFringe: { value: C.fringe }, uFilm: { value: 1 }, uEye: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, tD: { value: null }, uShafts: { value: 0 }, uSunScr: { value: new THREE.Vector2() }, uShaftCol: { value: new THREE.Vector3() }, uHeat: { value: [new THREE.Vector3(), new THREE.Vector3()] } }); }
  // heat(world position, strength): the air shimmers there for a second or two
  function heat(p, k) { const h = heatP[0].k <= heatP[1].k ? heatP[0] : heatP[1]; h.p.copy(p); h.k = k; }
  function size() { const s = R.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(8, s.x), h = Math.max(8, s.y); if (rtMain && w === W && h === H) return; W = w; H = h; for (const t of [rtMain, rtDof, rtLens, b1a, b1b, b2a, b2b]) if (t) t.dispose();
    rtLens = null;
    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    rtMain = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: LOW ? 0 : 4, depthTexture: new THREE.DepthTexture(W, H) }); rtDof = new THREE.WebGLRenderTarget(W, H, hf);
    b1a = new THREE.WebGLRenderTarget(W >> 2, H >> 2, hf); b1b = b1a.clone(); b2a = new THREE.WebGLRenderTarget(W >> 3, H >> 3, hf); b2b = b2a.clone(); }
  const pass = (m, to) => { quad.material = m; R.setRenderTarget(to); R.render(qscene, qcam); };
  function render(scene, camera, dt) { size(); R.setRenderTarget(rtMain); R.render(scene, camera); let src = rtMain;
    if (G.look.contact) {
      const u = M.contact.uniforms, projection = camera.projectionMatrix.elements;
      u.tColor.value = src.texture; u.tDepth.value = rtMain.depthTexture;
      u.uClip.value.set(camera.near, camera.far); u.uInvFocal.value.set(1 / projection[0], 1 / projection[5]);
      u.uResolution.value.set(W, H); u.uRadius.value = C.contactRadius; u.uStrength.value = C.contactStrength;
      pass(M.contact, rtDof); src = rtDof;
    }
    if (lens.aperture > 0 || lens.fisheye) { const u = M.dof.uniforms, asp = W / H, ref = Math.min(H, W * 9 / 16) / 1080;      // sizes are in pixels of a 1080-line frame, as in the Bee Garden
      if (!(lens.focus > 0)) { const f = M.focus.uniforms; f.tD.value = rtMain.depthTexture; f.tP.value = fA.texture; f.uNear.value = camera.near; f.uFar.value = camera.far; f.uAspect.value = asp; f.uRate.value = focusOn ? 1 - Math.exp(-(dt || .016) * 5) : 1; pass(M.focus, fB); const t = fA; fA = fB; fB = t; focusOn = true; } else focusOn = false;
      if (src === rtDof && !rtLens) rtLens = rtDof.clone();
      const lensTarget = src === rtDof ? rtLens : rtDof;
      u.tC.value = src.texture; u.tD.value = rtMain.depthTexture; u.tF.value = fA.texture; u.uRes.value.set(W, H); u.uNear.value = camera.near; u.uFar.value = camera.far; u.uFocus.value = lens.focus > 0 ? lens.focus : 0;
      u.uApK.value = lens.aperture * ref; u.uMaxC.value = 24 * ref; u.uStep.value = (LOW ? 7 : 3.4) * ref; u.uJit.value = G.t; u.uK.value = fishK(asp); u.uT.value = fishT(asp); u.uAspect.value = asp; u.uFish.value = lens.fisheye ? 1 : 0; pass(M.dof, lensTarget); src = lensTarget; } else focusOn = false;
    // exposure follows the light slowly, as an eye does: open at night, stopped down at noon
    const day = G.hemi ? clamp(G.hemi.intensity / CFG.sky.fillIntensity) : 1;
    const want = C.exposure * lerp(C.nightGain, 1, sm(.08, .7, day)) * (1 - C.snowStop * (typeof Weather !== 'undefined' ? Weather.S.cover : 0) * day);
    exp = G.look.adapt ? lerp(exp, want, 1 - Math.exp(-Math.max(0, dt ?? .016) / 1.5)) : C.exposure;
    G.info.exposure = exp;
    M.bright.uniforms.tC.value = src.texture; M.bright.uniforms.uPx.value.set(1 / W, 1 / H); M.bright.uniforms.uExp.value = exp; pass(M.bright, b1a);
    const bl = (from, to, x, y) => { M.blur.uniforms.tC.value = from.texture; M.blur.uniforms.uDir.value.set(x, y); pass(M.blur, to); };
    bl(b1a, b1b, 1 / b1a.width, 0); bl(b1b, b1a, 0, 1 / b1a.height); bl(b1a, b2b, 1 / b2a.width, 0); bl(b2b, b2a, 0, 1 / b2a.height);
    const f = M.fin.uniforms; f.tC.value = src.texture; f.tB1.value = b1a.texture; f.tB2.value = b2a.texture; f.uExp.value = exp; f.uAspect.value = W / H; f.tD.value = rtMain.depthTexture; f.uEye.value = lens.eye; f.uRes.value.set(W, H); f.uBloom.value = G.look.bloom ? C.bloom : 0; f.uFilm.value = G.look.film ? 1 : 0;
    // where the sun is on the screen, and whether its shafts can be seen: low sun, in front of the lens, not behind a storm
    { const sd = Sky.sunDir, st = typeof Weather !== 'undefined' ? Weather.S.storm : 0; _s.copy(camera.position).addScaledVector(sd, 1000).project(camera); const front = _s.z < 1 && Math.abs(_s.x) < 1.6 && Math.abs(_s.y) < 1.6;
      f.uShafts.value = front && G.look.shafts ? C.shafts * sm(-.03, .08, sd.y) * (1 - sm(.35, .8, sd.y)) * (1 - st) * (lens.aperture > 0 ? 0 : 1) : 0; f.uSunScr.value.set(_s.x * .5 + .5, _s.y * .5 + .5); f.uShaftCol.value.copy(Sky.U.uSkyK.value).multiplyScalar(1.4); }
    heatP.forEach((h, i) => { h.k = Math.max(0, h.k - (dt || .016) * .7); _s.copy(h.p).project(camera); f.uHeat.value[i].set(_s.x * .5 + .5, _s.y * .5 + .5, _s.z < 1 ? h.k * clamp(18 / Math.max(camera.position.distanceTo(h.p), 4)) : 0); });
    pass(M.fin, null); }
  return { build, render, lens, heat, fisheyeFov };
})();
