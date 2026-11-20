'use strict';
// ---- the sky and its light, after the Bee Garden's: a gradient from horizon to zenith, a glow and a disc for the sun, clouds drawn
//      on a plane overhead, and the same function reflected by the sea. Here it turns with the hour: the sun rises, climbs, reddens
//      and sets; the moon takes over the one directional light; the sky's own colour becomes the fill light and the colour of the air. ----
const GLSL_SKY = /* glsl */`
uniform vec3 uSkySun, uSkyK, uZen, uHor; uniform vec4 uSkyP;      // P: cloud cover, storm, night, cloud drift
vec3 skyCol(vec3 d, float sun){
  float h = max(d.y, 0.); vec3 c = mix(uHor, uZen, pow(h, .5));
  float sd = max(dot(d, uSkySun), 0.), sl = clamp(max(uSkyK.r, uSkyK.g), 0., 1.) * (1. - .85 * uSkyP.y);
  c += uSkyK * (pow(sd, 8.) * .35 + pow(sd, 64.) * .7) * (1. - .85 * uSkyP.y);
  c += uSkyK * smoothstep(.9993, .9998, sd) * 45. * sun * (1. - uSkyP.y);
  if (uSkyP.z > .01 && d.y > 0.) { vec3 g = floor(d * 240.); c += vec3(.8, .86, 1.) * step(.9972, hash31(g)) * uSkyP.z * smoothstep(0., .25, d.y) * (1. - uSkyP.x) * 1.4; }
  if (d.y > .02) { vec2 q = d.xz / (d.y + .12) * 1.3 + uSkyP.w * vec2(1., .4); float n = fbm2(q * 1.2 + 3.) * .78 + .22 * vnoise(q * 5.3), cov = mix(.74, .3, uSkyP.x), cl = smoothstep(cov, cov + .24, n);
    vec3 lit = mix(uHor * .95, uHor * .55 + uSkyK * (.5 + .7 * sd), .5 * sl + .1); lit = mix(lit, uHor * .32, uSkyP.y * .85) * (1. - .5 * smoothstep(cov + .1, cov + .5, n) * (.4 + .6 * uSkyP.x));
    c = mix(c, lit, cl * .92 * smoothstep(.02, .2, d.y)); }
  if (d.y < 0.) c = mix(c, uHor * .55, smoothstep(0., -.2, d.y));
  return c; }
`;
const Sky = (() => {
  const C = CFG.sky, U = { uSkySun: { value: new THREE.Vector3(0, 1, 0) }, uSkyK: { value: new THREE.Vector3(1, 1, 1) }, uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() }, uSkyP: { value: new THREE.Vector4(.3, 0, 0, 0) } };
  const sunDir = new THREE.Vector3(), light = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(); let dome, sun, hemi, drift = 0, flow = !Q.has('still');
  if (Q.get('day')) G.day = +Q.get('day');
  const mix3 = (o, a, b, t) => o.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));

  function build(scene) {
    dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * viewMatrix * vec4(position * 1000. + cameraPosition, 1.); gl_Position = p.xyww; }',
      fragmentShader: GLSL_NOISE + GLSL_SKY + 'varying vec3 vD; void main(){ gl_FragColor = vec4(skyCol(normalize(vD), 1.), 1.); }' }));
    dome.frustumCulled = false; dome.renderOrder = -100; scene.add(dome);
    sun = new THREE.DirectionalLight(0xffffff, 9); sun.castShadow = true; sun.shadow.mapSize.set(LOW ? 2048 : 4096, LOW ? 2048 : 4096); sun.shadow.radius = 2.2; scene.add(sun, sun.target);
    hemi = new THREE.HemisphereLight(0xffffff, 0x333322, 3); scene.add(hemi); scene.fog = new THREE.Fog(0x000000, 1, 2);
    G.sun = sun; G.hemi = hemi; G.tick.push(update); update(0, 0); }

  function update(t, dt) {
    if (flow) G.day = (G.day + dt * 24 / C.dayLength + 24) % 24;
    const storm = typeof Weather !== 'undefined' ? Weather.S.storm : 0, cover = typeof Weather !== 'undefined' ? Weather.S.cloud : .3;
    // where the sun is: up in the east at 6, highest at noon, down in the west at 18
    const ph = (G.day - 6) / 12 * Math.PI, el = Math.sin(ph) * C.noonElevation * Math.PI / 180, az = C.azimuth * Math.PI / 180 + Math.cos(ph) * 1.25;
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize(); const y = sunDir.y, day = sm(-.14, .1, y), low = 1 - sm(0, .38, Math.abs(y)), night = 1 - sm(-.2, -.02, y);
    // the sky's two colours: blue by day, a warm band at the horizon when the sun is low, near black at night; a storm greys them
    mix3(U.uZen.value, [.006, .01, .028], [.14, .34, .78], day); mix3(U.uHor.value, [.02, .028, .055], [.74, .82, .9], day);
    U.uHor.value.lerp(_a.set(1.05, .5, .22), low * day * .6); U.uZen.value.lerp(_a.set(.2, .2, .42), low * day * .45);
    const grey = (.2 + .3 * day) * (.5 + .5 * day); U.uHor.value.lerp(_a.set(grey * .95, grey, grey * 1.06), storm * .8); U.uZen.value.lerp(_a.set(grey * .5, grey * .55, grey * .62), storm * .85);
    // the one light: the sun while it is up, then the moon from the other side; its colour reddens as it nears the horizon
    const sunI = sm(-.03, .12, y) * (1 - .78 * storm) * (1 - .35 * cover * (1 - storm)), moonI = sm(.04, .2, -y) * .05 * (1 - .6 * storm);
    mix3(_a, [1, .4, .14], [1, .95, .86], sm(.0, .36, y)); U.uSkySun.value.copy(sunDir); U.uSkyK.value.copy(_a).multiplyScalar(sm(-.08, .1, y));
    if (sunI > moonI) { light.copy(sunDir); if (light.y < .06) { light.y = .06; light.normalize(); } sun.color.setRGB(_a.x, _a.y, _a.z); sun.intensity = C.sunIntensity * sunI; }
    else { light.set(-sunDir.x, Math.max(-sunDir.y, .25), -sunDir.z).normalize(); sun.color.setRGB(.55, .68, 1); sun.intensity = C.sunIntensity * moonI; }
    hemi.color.setRGB(U.uZen.value.x * .9 + U.uHor.value.x * .35, U.uZen.value.y * .9 + U.uHor.value.y * .35, U.uZen.value.z * .9 + U.uHor.value.z * .35); hemi.groundColor.setRGB(.2, .19, .11).multiplyScalar(.25 + .75 * day);
    hemi.intensity = C.fillIntensity * (.1 + .9 * day) * (1 - .3 * storm);
    // the air takes the horizon's colour, and thickens in rain and snow
    const wet = typeof Weather !== 'undefined' ? Math.max(Weather.S.rain, Weather.S.snowing * .8) : 0;
    G.U.uSunDir.value.copy(light); G.U.uSunK.value.set(sun.color.r, sun.color.g, sun.color.b).multiplyScalar(sun.intensity / Math.PI * .5); G.U.uFogCol.value.copy(U.uHor.value).multiplyScalar(.92);
    sun.castShadow = G.look.shadows; G.U.uFogP.value.set(G.look.air ? C.fogDensity * (1 + 7 * wet + 2 * storm) : 0, C.fogFalloff, 0, 1 - storm);
    drift += dt * (.004 + .012 * storm); U.uSkyP.value.set(cover, storm, night, drift); }

  addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === ']') G.day = (G.day + 1) % 24; else if (e.key === '[') G.day = (G.day + 23) % 24; else if (e.code === 'KeyT' && !e.repeat) flow = !flow; });
  return { build, U, sunDir, light, get flow() { return flow; } };
})();
