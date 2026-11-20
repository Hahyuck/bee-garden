'use strict';
// Mode modules own the active camera and their controls. Numeric slots are explicit,
// so adding an exhibition or character mode cannot change a driving or flight shortcut.
const Modes = (() => {
  const CC=CFG.camera, GP=Island.GP, UP=new THREE.Vector3(0,1,0);
  const m=new THREE.Matrix4(), P=new THREE.Vector3(), L=new THREE.Vector3(), q=new THREE.Quaternion(), c=new THREE.Vector3(), keys=new Set();
  const dbg=Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
  const flyDelta=new THREE.Vector3(), flyHalf=new THREE.Vector3(.14,.14,.14), identity=new THREE.Quaternion();
  // free flight: W A S D, Q and E down and up, Shift fast, drag to look. It cannot go under the ground.
  const fly = { p: new THREE.Vector3(GP.x + 16, GP.y + 7, GP.z + 26), yaw: Math.atan2(16, 26), pitch: -.18, drag: false };
  function visitOutcrop() {
    set('free');
    const x=GP.x+9, z=GP.z+4, tx=GP.x+4, tz=GP.z+20;
    fly.p.set(x,Island.surf(x,z)[0]+1.75,z);
    fly.yaw=Math.atan2(x-tx,z-tz);
    fly.pitch=Math.atan2(Island.surf(tx,tz)[0]+3.1-fly.p.y,Math.hypot(tx-x,tz-z));
  }
  addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS') fly.drag = true; }); addEventListener('pointerup', () => { fly.drag = false; });
  addEventListener('pointermove', e => { if (!fly.drag || cur !== 'free') return; fly.yaw -= e.movementX * .0032; fly.pitch = clamp(fly.pitch - e.movementY * .0032, -1.45, 1.45); });
  let beeT = 0, eyeOn = false;       // B: the compound-eye view, in the bee's mode
  const MODES = {
    free: { name: '자유', enter() {}, leave() {}, step(camera, dt) { const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? CC.flyFast : CC.flySpeed) * dt, cy = Math.cos(fly.yaw), sy = Math.sin(fly.yaw), f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      flyDelta.set((-sy*f+cy*s)*Math.cos(fly.pitch),Math.sin(fly.pitch)*f+Number(keys.has('KeyE'))-Number(keys.has('KeyQ')),(-cy*f-sy*s)*Math.cos(fly.pitch)).multiplyScalar(sp);
      if (flyDelta.lengthSq()) {
        const hit=Phys.castBox(fly.p,flyHalf,identity,flyDelta);
        fly.p.addScaledVector(flyDelta,hit ? clamp(hit.t) : 1);
      }
      fly.p.y = Math.max(fly.p.y, Math.max(Island.surf(fly.p.x, fly.p.z)[0], CFG.sea.level) + 1.2); camera.position.copy(fly.p); camera.rotation.set(fly.pitch, fly.yaw, 0, 'YXZ'); camera.fov = CC.fov; return 'W A S D 이동 · 끌어서 둘러보기 · Q E 높이 · Shift 빠르게'; } },
    bee: { name: '벌', enter() { beeT = 0; }, leave() { Garden.leave(); }, step(camera, dt) { beeT += dt; const r = Garden.bee(beeT, dt, camera); camera.fov = Post.fisheyeFov(camera.aspect); camera.near = .004; Post.lens.focus = 0; Post.lens.aperture = CFG.lens.beeAperture; Post.lens.fisheye = true; Post.lens.eye += ((eyeOn ? 1 : 0) - Post.lens.eye) * (1 - Math.exp(-dt * 6)); return (eyeOn ? '겹눈 · ' : 'B 겹눈 · ') + '벌의 비행 ' + Math.floor(Garden.T) + ' / ' + Garden.DUR + '초' + (r && r.walk > .5 ? ' · 걷는 중' : ''); } },
  };
  let cur = 'free', booted = false, hudAt = 0;
  const shortcuts = {Digit1:'free', Digit2:'bee', Digit3:'fps', Digit4:'drive', Digit5:'flight', KeyV:'actors', Digit0:'collect'};
  const picker = document.createElement('select');
  picker.id='mode-picker'; picker.setAttribute('aria-label','플레이 모드');
  picker.style.cssText='position:fixed;right:max(14px,env(safe-area-inset-right));top:100px;z-index:6;max-width:148px;height:35px;background:#211e1aee;color:#f3e6d2;border:1px solid #eddbbf55;border-radius:8px;padding:3px 8px;font:600 13px system-ui;cursor:pointer;color-scheme:dark';
  for (const [id,label] of [['free','1 자유 비행'],['bee','2 벌'],['fps','3 FPS'],['drive','4 레이싱'],['flight','5 경비행'],['actors','V 캐릭터'],['collect','0 통 모으기'],['sample','모델 보기']]) {
    const opt = new Option(label,id); if (id==='sample') opt.disabled=true; picker.add(opt);
  }
  picker.addEventListener('focus',()=>keys.clear());
  picker.addEventListener('keydown',e=>e.stopPropagation());
  picker.addEventListener('change',()=>{set(picker.value);picker.blur();}); document.body.append(picker);
  const hud = document.createElement('div'); hud.style.cssText = 'position:fixed;left:14px;bottom:14px;font:600 12px/1.5 "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f3e6d2;background:rgba(14,12,10,.55);padding:8px 12px;border-radius:10px;border:1px solid rgba(243,217,189,.18);z-index:4;pointer-events:none;white-space:pre'; document.body.appendChild(hud);
  function set(name) { if (name==='hike') name='fps'; if (!MODES[name] || name === cur) return; keys.clear(); MODES[cur].leave(); if (cur !== 'free' && cur !== 'drive') fly.p.copy(G.camera.position); cur = name; picker.value=cur; MODES[cur].enter(); hudAt = 0; }
  // the shadow map: a box around the lens, snapped to its own texels so it does not swim; small for the bee, wide from the air
  const SHP = [[310, 520, 20, 1100, -.00035, .22], [75, 260, 1, 520, -.00008, .07], [7, 40, 1, 80, -.00004, .0025], [24, 100, 1, 205, -.000035, .009]], SR = new THREE.Vector3(), SU = new THREE.Vector3(); let shMode = -1;
  function shadows(camera, k) { const sun = G.sun, sc = sun.shadow.camera, p = SHP[k], S = Sky.light; q.setFromRotationMatrix(m.lookAt(S, P.set(0, 0, 0), UP)); SR.set(1, 0, 0).applyQuaternion(q); SU.set(0, 1, 0).applyQuaternion(q);
    if (k !== shMode) { shMode = k; sc.left = sc.bottom = -p[0]; sc.right = sc.top = p[0]; sc.near = p[2]; sc.far = p[3]; sc.updateProjectionMatrix(); sun.shadow.bias = p[4]; sun.shadow.normalBias = p[5]; }
    const ts = 2 * p[0] / sun.shadow.mapSize.x, cp = camera.position; c.set(0, 0, 0).addScaledVector(SR, Math.round(cp.dot(SR) / ts) * ts).addScaledVector(SU, Math.round(cp.dot(SU) / ts) * ts).addScaledVector(S, cp.dot(S));
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(S, p[1]); sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); }
  // add(id, mode, keyCode, keyLabel): a module brings its own mode, e.g. Modes.add('collect', {...}, 'Digit0', '0')
  const extra = {}; function add(id, mode, code, label) { MODES[id] = mode; if (code) { extra[code] = id; mode.key = label || code; } }
  function step(camera, dt) { if (!booted) { booted = true; const requested = Q.get('mode'), want = requested==='hike' ? 'fps' : requested; if (MODES[want]) cur = want; picker.value=cur; MODES[cur].enter(); if (cur==='free') visitOutcrop(); }
    camera.near = .3; Post.lens.aperture = 0; Post.lens.focus = 10; Post.lens.fisheye = false; if (cur !== 'bee') Post.lens.eye = 0; let line;
    const fix = window.__cam || dbg; if (fix) { P.set(fix[0], fix[1], fix[2]); L.set(fix[3], fix[4], fix[5]); camera.position.copy(P); m.lookAt(P, L, UP); camera.quaternion.setFromRotationMatrix(m); camera.fov = fix[6] || CC.fov; camera.near = fix[7] || .3; line = ''; }
    else line = MODES[cur].step(camera, dt);
    const high = camera.position.y - Math.max(Island.surf(camera.position.x, camera.position.z)[0], 0); shadows(camera, cur === 'bee' && !fix ? 2 : high>45 ? 0 : high<8 && ['actors','fps','drive','flight','sample'].includes(cur) ? 3 : 1);
    if (performance.now() - hudAt > 250) {
      hudAt = performance.now();
      const modes = innerWidth < 820 ? MODES[cur].name : '1 자유   2 벌   3 FPS   4 레이싱   5 경비행   V 캐릭터   H 활용법';
      hud.textContent = modes + '\n' + line;
    } }
  addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) return; keys.add(e.code); if (e.code === 'KeyB' && !e.repeat && cur === 'bee') eyeOn = !eyeOn; const id=shortcuts[e.code] || extra[e.code]; if (id && !e.repeat) set(id); if (cur==='actors' && e.code.startsWith('Arrow')) e.preventDefault(); });
  addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
  return { step, set, add, visitOutcrop, MODES, fly, keys, get cur() { return cur; } };
})();
