'use strict';
// ---- putting it together: the renderer, the list of things to build (in order, with a progress bar), and the frame.
//      A frame is: the mode places the camera, every system ticks, the picture is drawn through the lens.
//      To add a system, write its module and add one line to STEPS. ----
(async () => {
  const canvas = document.getElementById('c'), bar = document.getElementById('bar'), label = document.getElementById('what'), loader = document.getElementById('load');
  window.__INFO = G.info; window.__ERR = null; addEventListener('error', e => { window.__ERR = String(e.message); });
  const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : 1.5)); R.setSize(innerWidth, innerHeight);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.NoToneMapping; R.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, .3, 20000); G.scene = scene; G.camera = camera; G.R = R;
  addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; });
  const tick = () => new Promise(r => setTimeout(r));
  const STEPS = [
    ['하늘과 빛', 1, async () => Sky.build(scene)],
    ['날씨', 1, async () => Weather.build(scene)],
    ['바다', 1, async () => Sea.build(scene)],
    ['섬', 16, async p => Island.build(scene, p, tick)],
    ['정원', 10, async p => Garden.build(scene, p, tick)],
    ['물리', 3, async () => Phys.init(scene)],
    ['차', 1, async () => Drive.build(scene)],
    ['소리', 1, async () => Sound.build()],
    ['렌즈', 1, async () => Post.build(R)],
  ];
  const t0 = performance.now(), total = STEPS.reduce((s, x) => s + x[1], 0); let done = 0;
  try { for (const [name, w, fn] of STEPS) { label.textContent = name; await tick(); const ts = performance.now(); await fn(k => { bar.style.width = ((done + w * k) / total * 100).toFixed(1) + '%'; }); done += w; bar.style.width = (done / total * 100).toFixed(1) + '%'; G.info[name] = Math.round(performance.now() - ts); } }
  catch (e) { window.__ERR = String(e && e.stack || e); label.textContent = '불러오지 못했습니다: ' + (e && e.message || e); throw e; }
  G.info.loadMs = Math.round(performance.now() - t0);

  function frame(t, dt) { G.t = G.tAbs = t; G.uTime.value = t;
    Modes.step(camera, dt); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    for (const f of G.tick) f(t, dt);
    Post.render(scene, camera, dt); }
  window.__frameAt = (t, dt = 1 / 60) => frame(t, dt);
  frame(0, 1 / 60); loader.style.opacity = 0; setTimeout(() => loader.remove(), 700);
  if (!CAPTURE) { let last = performance.now(), t = 0; const loop = now => { const dt = Math.min((now - last) / 1000, .1); last = now; t += dt; frame(t, dt); G.info.fps = Math.round(1 / Math.max(dt, .001)); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
})();
