'use strict';
// ---- effects that come and go, after Pixel Aleste's: ribbons of dust, spray and fire that the wind carries off (FX.trail),
//      and a blast drawn as a wispy shell with a ring running out along the ground (FX.blast). Each kind is one draw call.
//      A blast also lights its surroundings (LightField.hot) and bends the air in front of the lens (Post.heat). ----
const FX = (() => {
  const CAP = 2400, _v = new THREE.Vector3(); let geo, from, to, info, mat, head = 0, now = 0; const sites = [];
  function build(scene) {
    // ribbons: every recent segment lives in one instanced draw. A segment is a quad between two points, widened on screen,
    // that grows, drifts with the wind, rises and fades with its age.
    geo = new THREE.InstancedBufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3));
    const attr = n => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * CAP), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    from = attr(3); to = attr(3); info = attr(3); geo.setAttribute('aFrom', from); geo.setAttribute('aTo', to); geo.setAttribute('aInfo', info); geo.instanceCount = 0;
    mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { now: { value: 0 }, haze: G.U.uFogCol, crosswind: { value: new THREE.Vector2() }, lum: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: `attribute vec3 aFrom, aTo, aInfo; uniform float now; uniform vec2 crosswind; varying float life, edge, depth, kind, noisePos;
        void main(){ float age = now - aInfo.x; kind = aInfo.z; life = age / (kind > 1.5 ? .5 : kind > .5 ? 1.1 : 2.2); edge = position.y;
          if (life > 1. || age < 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
          vec3 a = (viewMatrix * vec4(aFrom, 1.)).xyz, b = (viewMatrix * vec4(aTo, 1.)).xyz, p = mix(a, b, position.x);
          p += mat3(viewMatrix) * vec3(crosswind.x, kind > 1.5 ? -2.5 : .9, crosswind.y) * age * (kind > 1.5 ? age : .35 + .3 * age);
          vec2 d = b.xy / max(1., -b.z) - a.xy / max(1., -a.z), n = vec2(-d.y, d.x) / max(.00001, length(d));
          noisePos = dot(mix(aFrom, aTo, position.x), vec3(.7, .3, .9));
          p.xy += n * edge * aInfo.y * (kind > 1.5 ? 1. - life * .6 : 1. + life * 5.) * (1. + life * .24 * sin(noisePos * 1.8));
          depth = -p.z; gl_Position = projectionMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform vec3 haze, lum; varying float life, edge, depth, kind, noisePos;
        void main(){ float drift = life * .24 * sin(noisePos * 1.8 + life * 3.), soft = 1. - smoothstep(.04, 1., abs(edge + drift));
          vec3 c = mix(vec3(.3, .26, .2), vec3(.62, .55, .44), smoothstep(-.6, .7, edge)) * lum;                 // dust
          if (kind > .5) c = vec3(.78, .84, .92) * lum;                                                           // spray, snow, tyre smoke
          if (kind > 1.5) c = mix(vec3(4.3, 2.2, .5), vec3(1.1, .18, .008), life);                               // fire
          float a = soft * pow(max(0., 1. - life), 1.5) * (.79 + .21 * sin(noisePos + life * 4.)) * (kind > .5 ? .34 : .5) * smoothstep(0., .06, life);
          if (kind > 1.5) a = soft * (1. - life);
          gl_FragColor = vec4(mix(c, haze, smoothstep(200., 900., depth) * .68), a); }` });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 20; scene.add(mesh);
    // blasts: a pool of shells and rings
    const sg = new THREE.SphereGeometry(1, LOW ? 28 : 42, LOW ? 14 : 21), rg = new THREE.TorusGeometry(1, .018, 6, LOW ? 64 : 96).rotateX(Math.PI / 2);
    const shellMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: { strength: { value: 0 }, phase: { value: 0 }, tint: { value: new THREE.Color() } },
      vertexShader: `uniform float phase; varying float rim; varying vec3 direction;
        void main(){ direction = normalize(position); float n = sin(direction.x * 12. + phase * 2.) * sin(direction.z * 16. + direction.y * 7.); vec4 eye = modelViewMatrix * vec4(position * (1. + .012 * n), 1.);
          rim = 1. - abs(dot(normalize(normalMatrix * normal), normalize(-eye.xyz))); gl_Position = projectionMatrix * eye; }`,
      fragmentShader: `uniform float strength, phase; uniform vec3 tint; varying float rim; varying vec3 direction;
        void main(){ float wisps = .54 + .22 * sin(dot(direction, vec3(23., 11., 29.)) + phase * 4.) + .16 * sin(dot(direction, vec3(-41., 19., 8.)));
          float edge = exp(-pow((rim - .79) * 5.1, 2.)) * (1. - smoothstep(.91, 1., rim)) + .35 * (1. - rim) * (1. - rim), a = edge * wisps * strength; if (a < .009) discard; gl_FragColor = vec4(tint, a); }` });
    const ringMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: { strength: { value: 0 }, phase: { value: 0 }, tint: { value: new THREE.Color() } },
      vertexShader: `uniform float phase; varying float angle, section;
        void main(){ angle = uv.x * 6.283185; float split = sin(angle * 7. + phase * 4.) * sin(angle * 11. - phase * 2.); vec4 eye = modelViewMatrix * vec4(position * (1. + .011 * split), 1.);
          section = abs(dot(normalize(normalMatrix * normal), normalize(-eye.xyz))); gl_Position = projectionMatrix * eye; }`,
      fragmentShader: `uniform float strength, phase; uniform vec3 tint; varying float angle, section;
        void main(){ float wave = .5 + .24 * sin(angle * 9. - phase * 4.) + .18 * sin(angle * 17. + 1.) + .10 * sin(angle * 33. + phase), a = strength * smoothstep(.08, .76, wave) * smoothstep(.02, .68, section); if (a < .012) discard; gl_FragColor = vec4(tint, a); }` });
    for (let i = 0; i < 4; i++) { const shell = new THREE.Mesh(sg, shellMat()), ring = new THREE.Mesh(rg, ringMat()); shell.visible = ring.visible = false; shell.renderOrder = ring.renderOrder = 21; scene.add(shell, ring); sites.push({ shell, ring, t: 9, rad: 1, p: new THREE.Vector3() }); }
    G.tick.push(tick); }
  function trail(a, b, width, kind = 0) { if (!geo) return; const i = head++ % CAP; from.setXYZ(i, a.x, a.y, a.z); to.setXYZ(i, b.x, b.y, b.z); info.setXYZ(i, now, width, kind); geo.instanceCount = Math.min(head, CAP); from.needsUpdate = to.needsUpdate = info.needsUpdate = true; }
  function blast(x, y, z, rad = 9) { if (!geo) return; const s = sites.reduce((a, b) => (b.t > a.t ? b : a)); s.t = 0; s.rad = rad; s.p.set(x, y, z); s.shell.position.copy(s.p); s.ring.position.set(x, y + .15, z);
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + Math.random(), e = .2 + Math.random() * .9, r0 = rad * .08, r1 = rad * (.25 + .35 * Math.random()), c = Math.cos(a) * Math.cos(e), sn = Math.sin(e), d = Math.sin(a) * Math.cos(e);
      trail(_v.set(x + c * r0, y + sn * r0, z + d * r0).clone(), new THREE.Vector3(x + c * r1, y + sn * r1, z + d * r1), .07 + .06 * Math.random(), 2); trail(new THREE.Vector3(x + c * r1 * .6, y + .2, z + d * r1 * .6), new THREE.Vector3(x + c * r1 * 1.5, y + .5 + sn, z + d * r1 * 1.5), .5 + Math.random() * .5, 0); }
    if (typeof LightField !== 'undefined') LightField.hot(x, y + 1, z, 60); if (typeof Post !== 'undefined') Post.heat(s.p, 1); }
  function tick(t, dt) { now = t; mat.uniforms.now.value = t; const W = typeof Weather !== 'undefined' ? Weather.S.wind : null; if (W) mat.uniforms.crosswind.value.set(W.x * .25, W.z * .25);
    const l = G.hemi ? clamp(G.hemi.intensity / 3 + (G.sun ? G.sun.intensity / 14 : 0), .06, 1.6) : 1; mat.uniforms.lum.value.set(l, l, l);
    for (const s of sites) { if (s.t > 1.2) { s.shell.visible = s.ring.visible = false; continue; } s.t += dt; const k = s.t / 1.2, r = s.rad * (.12 + .88 * Math.sqrt(k)), fade = (1 - k) * (1 - k);
      s.shell.visible = s.ring.visible = true; s.shell.scale.set(r * .7, r * .6, r * .7); s.ring.scale.setScalar(r * 1.1);
      for (const m of [s.shell, s.ring]) { m.material.uniforms.phase.value = t * 3; m.material.uniforms.tint.value.setRGB(lerp(3.2, .9, k), lerp(1.7, .5, k), lerp(.5, .35, k)); } s.shell.material.uniforms.strength.value = fade * .9; s.ring.material.uniforms.strength.value = fade * .8; } }
  return { build, trail, blast };
})();
