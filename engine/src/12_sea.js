'use strict';
// ---- the sea: a disc of water that rides with the lens, fine near and coarse far.
//      Shape: six trains of swell of different length and heading, summed in the vertex shader; the wind makes them taller, and they
//      lie down as the water shallows towards the shore. Ripples too small for the mesh are added to the normal and fade with distance.
//      Colour: the water knows how deep it is (a map of the seabed baked from the island). Shallow water lets the sand show through,
//      losing red first; deep water is its own dark blue-green. On top: the sky mirrored by Fresnel, the sun's glitter, light coming
//      through the backs of waves towards the sun, whitecaps in wind, and foam that laps up and down the beach.
//      In a hard frost, plates of ice close over it. The same air (fog) stands in front of it as in front of everything else. ----
const Sea = (() => {
  const C = CFG.sea, N = 384, SPAN = 1280, f3 = v => v.toFixed(3); let mesh, U;
  const WAVES = /* glsl */`
uniform float uTime; uniform vec4 uWx; uniform sampler2D uShore; uniform vec4 uShoreF;
float seaBed(vec2 p){ vec2 uv = (p - uShoreF.xy) * uShoreF.z; if (uShoreF.w < .5 || any(lessThan(uv, vec2(.002))) || any(greaterThan(uv, vec2(.998)))) return -12.; return texture2D(uShore, uv).r * 24. - 12.; }
float seaAmp(){ return (${f3(C.swell)} + ${f3(C.windSwell)} * uWx.w) * (1. - uWx.y); }
vec3 seaWave(vec2 p, float far, float calm){      // xy: slope, z: height
  vec3 o = vec3(0.); float A = seaAmp() * calm; vec2 d; float k, ph, a;
  #define TRAIN(dx, dz, len, amp, keep) d = normalize(vec2(dx, dz)); k = 6.2832 / len; ph = dot(p, d) * k + uTime * sqrt(9.81 * k) * .8; a = A * amp * keep; o += vec3(d * k * a * cos(ph), a * sin(ph));
  TRAIN(.8, .6, 61., 1., 1.) TRAIN(.55, .83, 37., .62, 1.) TRAIN(.97, .24, 23., .4, 1.) TRAIN(.3, .95, 13., .24, far) TRAIN(.9, -.4, 7.3, .14, far) TRAIN(.6, .8, 4.1, .08, far * far)
  return o; }`;
  // the seabed, seen from above: one byte of height per 3.3 m, from 12 m under to 12 m over the waterline
  function bake() { const x0 = Island.IC.x - SPAN / 2, z0 = Island.IC.z - SPAN / 2, px = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = Island.surf(x0 + (i + .5) / N * SPAN, z0 + (j + .5) / N * SPAN)[0] - C.level, k = (j * N + i) * 4; px[k] = clamp((h + 12) / 24) * 255; px[k + 3] = 255; }
    const t = new THREE.DataTexture(px, N, N, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; U.uShore.value = t; U.uShoreF.value.set(x0, z0, 1 / SPAN, 1); }
  function build(scene) {
    const R = [0]; for (let r = 1.5; r < 9000; r *= 1.075) R.push(r); const seg = LOW ? 96 : 192, pos = new Float32Array(R.length * seg * 3), idx = [];
    R.forEach((r, i) => { for (let j = 0; j < seg; j++) { const a = j / seg * TAU, k = (i * seg + j) * 3; pos[k] = Math.cos(a) * r; pos[k + 1] = 0; pos[k + 2] = Math.sin(a) * r; } });
    for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    U = { ...Sky.U, ...G.U, uTime: G.uTime, uWx: G.uWx, uAt: { value: new THREE.Vector3() }, uShore: { value: null }, uShoreF: { value: new THREE.Vector4(0, 0, 1, 0) } };
    mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, fog: false, transparent: true,side:THREE.DoubleSide,forceSinglePass:true,
      vertexShader: WAVES + `uniform vec3 uAt; varying vec3 vW; varying float vFar;
        void main(){ vec3 p = position + uAt; vFar = 1. - smoothstep(50., 380., length(position.xz)); float calm = smoothstep(.05, 3., -seaBed(p.xz));
          vec3 w = seaWave(p.xz, vFar, calm); p.y = ${f3(C.level)} + w.z; vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
      fragmentShader: GLSL_NOISE + GLSL_SKY + GLSL_AIR + WAVES + `varying vec3 vW; varying float vFar;
        float ripF(vec2 p){ return vnoise(p * .9 + uTime * vec2(.35, .2)) + .5 * vnoise(p * 2.3 - uTime * vec2(.25, .4)) + .25 * vnoise(p * 5.1 + uTime * vec2(.5, -.3)); }
        void main(){ vec2 q = vW.xz; float bed = seaBed(q), calm = smoothstep(.05, 3., -bed); vec3 w = seaWave(q, vFar, calm);
          float depth = vW.y - ${f3(C.level)} - bed, dist = length(cameraPosition - vW), dn = 1. / (1. + dist * .03), open = 1. - uWx.y;
          if (depth < 0.) discard;
          // the surface: the swell's own slope, plus ripples the mesh cannot carry
          float e = .25, n0 = ripF(q); vec2 rip = vec2(ripF(q + vec2(e, 0.)) - n0, ripF(q + vec2(0., e)) - n0) / e * (.05 + .17 * uWx.w) * dn * (.35 + .65 * calm) * open;
          vec3 N = normalize(vec3(-w.x - rip.x, 1., -w.y - rip.y)), V = normalize(cameraPosition - vW), L = uSunDir;
          if(!gl_FrontFacing){
            if(cameraPosition.y>-.12)discard;
            float windowLight=smoothstep(.53,.82,-V.y);
            vec3 refracted=normalize(vec3(-V.x*.67,max(.04,-V.y)+N.x*.23,-V.z*.67));
            vec3 underside=mix(vec3(.035,.19,.20),skyCol(refracted,0.)*.72,windowLight);
            underside+=vec3(.045,.10,.085)*smoothstep(.0,.20,N.z+.07);
            gl_FragColor=vec4(underside,1.);return;
          }
          float nv = max(dot(N, V), 0.), fr = .02 + .98 * pow(1. - nv, 5.); vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y) + .02; Rf = normalize(Rf);
          // what is under it: the sand through shallow water (red is lost first, then green), and the water's own colour where it is deep
          vec3 light = uHor * .5 + uSunK * (.18 + .3 * max(L.y, 0.));
          vec3 absorb = exp(-depth * vec3(.5, .13, .09)), sand = vec3(.52, .46, .34) * (.8 + .3 * vnoise(q * .7)) * light * 1.3;
          vec3 body = mix(vec3(.008, .045, .075), vec3(.02, .2, .19), exp(-depth * .28)) * light * 1.6;
          vec3 under = sand * absorb + body * (1. - absorb.g);
          // light coming through the back of a wave, towards a low sun
          under += vec3(.03, .22, .17) * uSunK * pow(max(dot(V, -normalize(vec3(L.x, 0., L.z))), 0.), 4.) * max(w.z, 0.) / (seaAmp() + .05) * .25 * open;
          vec3 col = mix(under, skyCol(Rf, 0.), fr);
          // the sun's glitter: tight near, smeared far, where a pixel holds many facets
          float sh = mix(700., 70., clamp(dist / 500., 0., 1.)); col += uSunK * pow(max(dot(N, normalize(L + V)), 0.), sh) * (sh + 8.) * .012 * (1. - uSkyP.y) * open;
          // foam: whitecaps where the wind steepens the crests, and the line that laps up and down the beach
          float fn = vnoise(q * .9 + uTime * .3) * .6 + vnoise(q * 3.1 - uTime * .2) * .4;
          float cap = smoothstep(.5, .95, w.z / (seaAmp() + .01) * .5 + .5) * smoothstep(.42, .7, fn) * smoothstep(.2, .8, uWx.w);
          float lap = depth - (.1 + .09 * sin(uTime * .9 + vnoise(q * .25) * 6.3)), shoreFoam = smoothstep(.3, 0., lap) * (.45 + .55 * smoothstep(.3, .6, vnoise(q * 3.5 + uTime * vec2(.2, .35)))) * step(-11., bed);
          float foam = clamp(max(cap, shoreFoam * .9), 0., 1.) * open; col = mix(col, uHor * .95 + uSunK * .28, foam);
          // sea ice: pale plates with dark leads between them
          float plate = smoothstep(.02, .1, abs(vnoise(q * .06) - .5)) * (.85 + .15 * vnoise(q * 1.3)); col = mix(col, mix(body, vec3(.72, .8, .86) * light * 1.6, plate), smoothstep(.55, 1., uWx.y));
          gl_FragColor = vec4(clAir(col, vW), smoothstep(0., .07, depth)); }` }));
    mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh);
    G.tick.push(() => { const c = G.camera.position; U.uAt.value.set(Math.round(c.x), 0, Math.round(c.z)); }); }
  const trains=[[.8,.6,61,1],[.55,.83,37,.62],[.97,.24,23,.4],[.3,.95,13,.24],[.9,-.4,7.3,.14],[.6,.8,4.1,.08]];
  function height(x,z){
    const weather=G.uWx.value,amp=(C.swell+C.windSwell*weather.w)*(1-weather.y);
    let wave=0;
    for(const [dx,dz,length,weight] of trains){
      const k=TAU/length;wave+=weight*Math.sin((x*dx+z*dz)/Math.hypot(dx,dz)*k+G.t*Math.sqrt(9.81*k)*.8);
    }
    return C.level+amp*wave*sm(.05,3,C.level-Island.surf(x,z)[0]);
  }
  return { build, bake, height };
})();
