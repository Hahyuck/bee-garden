'use strict';
// ---- the sea: a disc of water that rides with the lens, fine near and coarse far. Waves are a few trains of swell summed in the
//      vertex shader (the wind makes them taller); the surface reflects the sky function, by Fresnel, with the sun's glitter in it,
//      foam on the steep crests, and the same air in front of it as everything else. In a hard frost, ice closes over it. ----
const Sea = (() => {
  const C = CFG.sea; let mesh, U;
  const WAVES = /* glsl */`
uniform float uTime; uniform vec4 uWx;
vec3 seaWave(vec2 p, float far){      // xy: slope, z: height
  vec3 o = vec3(0.); float amp = (${C.swell.toFixed(3)} + ${C.windSwell.toFixed(3)} * uWx.w) * (1. - uWx.y);
  vec2 d; float k, a, ph;
  d = vec2(.8, .6);   k = .045; a = amp;        ph = dot(p, d) * k + uTime * .62; o += vec3(d * k * a * cos(ph), a * sin(ph));
  d = vec2(-.35, .94); k = .09;  a = amp * .55;  ph = dot(p, d) * k + uTime * .9;  o += vec3(d * k * a * cos(ph), a * sin(ph));
  d = vec2(.96, -.28); k = .21;  a = amp * .28 * far; ph = dot(p, d) * k + uTime * 1.4; o += vec3(d * k * a * cos(ph), a * sin(ph));
  d = vec2(.2, .98);  k = .47;  a = amp * .14 * far; ph = dot(p, d) * k + uTime * 2.1; o += vec3(d * k * a * cos(ph), a * sin(ph));
  return o; }`;
  function build(scene) {
    // rings that widen with distance: 1 m cells at the lens, hundreds of metres at the horizon
    const R = [0]; for (let r = 2; r < 9000; r *= 1.085) R.push(r); const seg = LOW ? 96 : 160, pos = new Float32Array(R.length * seg * 3), idx = [];
    R.forEach((r, i) => { for (let j = 0; j < seg; j++) { const a = j / seg * TAU, k = (i * seg + j) * 3; pos[k] = Math.cos(a) * r; pos[k + 1] = 0; pos[k + 2] = Math.sin(a) * r; } });
    for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    U = { ...Sky.U, ...G.U, uTime: G.uTime, uWx: G.uWx, uAt: { value: new THREE.Vector3() } };
    mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, fog: false,
      vertexShader: WAVES + `uniform vec3 uAt; varying vec3 vW; varying float vFar;
        void main(){ vec3 p = position + uAt; vFar = 1. - smoothstep(60., 420., length(position.xz)); vec3 w = seaWave(p.xz, vFar); p.y = ${C.level.toFixed(2)} + w.z; vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
      fragmentShader: GLSL_NOISE + GLSL_SKY + GLSL_AIR + WAVES + `varying vec3 vW; varying float vFar;
        void main(){ vec3 w = seaWave(vW.xz, vFar); float dist = length(cameraPosition - vW), near = 1. - smoothstep(20., 260., dist);
          // ripples too small for the mesh: two sheets of noise sliding across each other, fading with distance
          vec2 q = vW.xz; float e = .35; float n0 = vnoise(q * 1.7 + uTime * vec2(.4, .25)) + .5 * vnoise(q * 4.3 - uTime * vec2(.3, .5));
          float nx = vnoise((q + vec2(e, 0.)) * 1.7 + uTime * vec2(.4, .25)) + .5 * vnoise((q + vec2(e, 0.)) * 4.3 - uTime * vec2(.3, .5)), nz = vnoise((q + vec2(0., e)) * 1.7 + uTime * vec2(.4, .25)) + .5 * vnoise((q + vec2(0., e)) * 4.3 - uTime * vec2(.3, .5));
          vec2 rip = vec2(nx - n0, nz - n0) / e * (.1 + .25 * uWx.w) * near * (1. - uWx.y);
          vec3 N = normalize(vec3(-w.x - rip.x, 1., -w.y - rip.y)), V = normalize(cameraPosition - vW);
          float fr = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.); vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y);
          vec3 deep = mix(vec3(.012, .06, .09), vec3(.03, .16, .17), pow(max(dot(N, V), 0.), 2.)) * (.25 + .75 * clamp(uHor.b * 1.2, 0., 1.));
          vec3 col = mix(deep, skyCol(Rf, 1.), fr);
          float foam = smoothstep(.55, .95, w.z / (${C.swell.toFixed(3)} + ${C.windSwell.toFixed(3)} * uWx.w + .01) * .5 + .5) * smoothstep(.45, .7, vnoise(q * .9 + uTime * .3) * .6 + vnoise(q * 3.1) * .4) * (.25 + .75 * uWx.w) * (1. - uWx.y);
          col = mix(col, uHor * 1.15 + uSunK * .25, foam * .8);
          // sea ice: pale plates with dark leads between them
          float plate = smoothstep(.02, .1, abs(vnoise(q * .06) - .5)) * (.85 + .15 * vnoise(q * 1.3)); col = mix(col, mix(deep * 1.5, vec3(.72, .8, .86) * (.35 + .65 * clamp(uHor.b * 1.3, 0., 1.)), plate), smoothstep(.55, 1., uWx.y));
          gl_FragColor = vec4(clAir(col, vW), 1.); }` }));
    mesh.frustumCulled = false; scene.add(mesh);
    G.tick.push(() => { const c = G.camera.position; U.uAt.value.set(Math.round(c.x), 0, Math.round(c.z)); }); }
  return { build };
})();
