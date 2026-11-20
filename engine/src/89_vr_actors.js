'use strict';
const ActorWalk = (() => {
  const group = new THREE.Group();
  const feet = new THREE.Vector3(), frogFeet = new THREE.Vector3();
  const hopStart = new THREE.Vector3(), hopEnd = new THREE.Vector3();
  const target = new THREE.Vector3(), eye = new THREE.Vector3(), ray = new THREE.Vector3();
  const actors = { human: null, frog: null };
  let active = false, placed = false, azimuth = 0, pitch = .27, facing = 0;
  let orbitPointer = null, pointerX = 0, pointerY = 0, cameraReady = false;
  let selectedHuman = null, humanVersion = 0, pendingHuman = null, frogLoading = false, status = '';
  let gait = 0, hopTime = -1;

  function release(actor) {
    if (!actor) return;
    actor.mixer.stopAllAction();
    actor.mixer.uncacheRoot(actor.model);
    actor.holder.removeFromParent();
    const materials = new Set(), textures = new Set(), geometry = new Set(), skeletons = new Set();
    actor.model.traverse(o => {
      if (!o.isMesh) return;
      geometry.add(o.geometry);
      if (o.skeleton) skeletons.add(o.skeleton);
      for (const m of [].concat(o.material)) materials.add(m);
    });
    for (const m of materials) {
      for (const t of Object.values(m)) if (t?.isTexture) textures.add(t);
      m.dispose();
    }
    for (const t of textures) { t.dispose(); t.source?.data?.close?.(); }
    for (const g of geometry) g.dispose();
    for (const s of skeletons) s.dispose();
  }

  async function loadActor(kind, entry) {
    const loader = window.createGardenGLTFLoader(THREE);
    const { scene: model, animations } = await loader.loadAsync(entry?.file || window.GARDEN_ACTORS[kind]);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const height = bounds.max.y - bounds.min.y;
    if (!(height > 0)) throw new Error('Empty model: ' + kind);
    const scale = (entry?.height || (kind === 'human' ? 1.71 : .68)) / height;
    model.scale.multiplyScalar(scale);
    model.position.y -= bounds.min.y * scale;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const holder = new THREE.Group(); holder.name = kind; holder.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const motion = animations.find(a => (kind === 'human' ? /walk/i : /hop/i).test(a.name));
    const idle = animations.find(a => /idle/i.test(a.name));
    const rest = idle && mixer.clipAction(idle).play();
    const move = motion && mixer.clipAction(motion).setEffectiveWeight(0).play();
    mixer.update(0);
    return { holder, model, mixer, rest, move, entry, kind, motion };
  }

  function install(actor) {
    release(actors[actor.kind]);
    actors[actor.kind] = actor;
    actor.holder.position.copy(actor.kind === 'human' ? feet : frogFeet);
    actor.holder.rotation.y = facing;
    group.add(actor.holder);
    if (actors.human && actors.frog) G.info.actorModels = Object.values(actors).map(a => ({
      kind: a.kind, id: a.entry?.id || a.kind, clip: a.motion?.name || ''
    }));
  }

  async function swapHuman(entry, version) {
    status = '캐릭터를 불러오는 중';
    try {
      const actor = await loadActor('human', entry);
      if (version !== humanVersion) { release(actor); return false; }
      install(actor); status = '';
      return true;
    } catch (error) {
      if (version === humanVersion) {
        selectedHuman = actors.human?.entry || null;
        status = '캐릭터를 불러오지 못했습니다. 샘플에서 다시 선택하세요.';
        console.error('Character model', error);
      }
      return false;
    } finally {
      if (version === humanVersion) pendingHuman = null;
    }
  }
  function selectHuman(entry = null) {
    const id = entry?.id || 'kate';
    if (pendingHuman?.id === id) return pendingHuman.promise;
    const version = ++humanVersion;
    selectedHuman = entry;
    if (actors.human && actors.human.entry?.id === entry?.id) {
      status = ''; pendingHuman = null; return Promise.resolve(true);
    }
    const promise = swapHuman(entry, version);
    pendingHuman = {id, promise};
    return promise;
  }

  async function loadFrog() {
    if (actors.frog || frogLoading) return;
    frogLoading = true;
    try { install(await loadActor('frog', null)); }
    catch (error) { console.warn('Froggy model', error); }
    finally { frogLoading = false; }
  }

  function stopOrbit() {
    const id = orbitPointer; orbitPointer = null;
    if (id !== null && G.R?.domElement.hasPointerCapture(id)) G.R.domElement.releasePointerCapture(id);
  }
  addEventListener('pointerdown', e => {
    if (!active || e.target !== G.R.domElement || orbitPointer !== null || e.button !== 0) return;
    orbitPointer = e.pointerId; pointerX = e.clientX; pointerY = e.clientY;
    e.target.setPointerCapture(e.pointerId);
  });
  addEventListener('pointermove', e => {
    if (e.pointerId !== orbitPointer) return;
    azimuth -= (e.clientX - pointerX) * .006;
    pitch = clamp(pitch + (e.clientY - pointerY) * .004, -.06, .92);
    pointerX = e.clientX; pointerY = e.clientY;
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture'])
    addEventListener(event, e => { if (e.pointerId === orbitPointer) stopOrbit(); });
  addEventListener('blur', stopOrbit);

  function enter() {
    if (!group.parent) G.scene.add(group);
    active = group.visible = true; cameraReady = false; gait = 0;
    if (!placed) {
      placed = true; facing = azimuth = -2.68;
      feet.set(Island.GP.x + 4, 0, Island.GP.z + 5);
      feet.y = Island.surf(feet.x, feet.z)[0];
      frogFeet.set(feet.x - .97, 0, feet.z + .64);
      frogFeet.y = Island.surf(frogFeet.x, frogFeet.z)[0];
    }
    WalkStick.setActive(true);
    if (!actors.human) selectHuman(selectedHuman);
    loadFrog();
  }
  function leave() {
    active = group.visible = false;
    stopOrbit(); WalkStick.setActive(false);
  }

  function tryMove(dx, dz) {
    const distance = Math.hypot(dx, dz);
    if (!distance) return 0;
    const x = feet.x + dx, z = feet.z + dz, y = Island.surf(x,z)[0];
    if (y < CFG.sea.level + .08 || Math.abs(y - feet.y) > .07 + distance * .95) return 0;
    eye.copy(feet); eye.y += .64;
    ray.set(dx / distance, 0, dz / distance);
    if (Phys.ray(eye, ray, distance + .2)) return 0;
    feet.set(x, y, z); return distance;
  }
  function walk(dt) {
    const keys = Modes.keys;
    let x = WalkStick.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    let z = WalkStick.y + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const length = Math.max(1, Math.hypot(x,z));
    x /= length; z /= length;
    const cosine = Math.cos(azimuth), sine = Math.sin(azimuth), speed = 1.85;
    const dx = (cosine*x - sine*z)*speed*dt, dz = (-sine*x - cosine*z)*speed*dt;
    const startX = feet.x, startZ = feet.z;
    if (!tryMove(dx, dz) && dx && dz) {
      if (Math.abs(dx) >= Math.abs(dz)) { if (!tryMove(dx,0)) tryMove(0,dz); }
      else if (!tryMove(0,dz)) tryMove(dx,0);
    }
    const movedX = feet.x - startX, movedZ = feet.z - startZ, distance = Math.hypot(movedX,movedZ);
    if (distance > .00001) {
      const angle = Math.atan2(-movedX,-movedZ) - facing;
      facing += Math.atan2(Math.sin(angle),Math.cos(angle)) * (1-Math.exp(-dt*16));
    }
    const weight = clamp(distance / Math.max(.00001, speed*dt));
    gait += (weight-gait)*(1-Math.exp(-dt*13));
    const a = actors.human;
    if (a) {
      a.holder.position.copy(feet); a.holder.rotation.y = facing;
      if (a.move) a.move.setEffectiveWeight(gait).setEffectiveTimeScale(weight * 1.5);
      if (a.rest) a.rest.setEffectiveWeight(1-gait);
      a.mixer.update(dt);
    }
  }
  function followFrog(dt) {
    const a = actors.frog;
    if (!a) return;
    const dx = feet.x-frogFeet.x, dz = feet.z-frogFeet.z, distance = Math.hypot(dx,dz);
    if (hopTime < 0 && distance > 1.65 && a.motion) {
      const travel = Math.min(2.15, distance-.9) / distance;
      hopStart.copy(frogFeet);
      hopEnd.copy(frogFeet); hopEnd.x += dx*travel; hopEnd.z += dz*travel;
      a.holder.rotation.y = Math.atan2(-dx, -dz);
      hopTime = 0;
    }
    if (hopTime >= 0) {
      hopTime = Math.min(hopTime + dt, a.motion.duration);
      const phase = hopTime / a.motion.duration, blend = Math.min(sm(0,.13,phase), 1-sm(.82,1,phase));
      frogFeet.lerpVectors(hopStart,hopEnd,sm(.22,.76,phase));
      frogFeet.y = Island.surf(frogFeet.x,frogFeet.z)[0];
      a.move.time = hopTime; a.move.setEffectiveTimeScale(0).setEffectiveWeight(blend);
      if (a.rest) a.rest.setEffectiveWeight(1-blend);
      if (phase >= 1) hopTime = -1;
    }
    a.holder.position.copy(frogFeet); a.mixer.update(dt);
  }
  function step(camera, dt) {
    if (actors.human) walk(dt);
    followFrog(dt);
    const distance = camera.aspect < 1 ? 4.25 : 3.55;
    const head = feet.y + (actors.human?.entry?.height || 1.71)*.61;
    if (!cameraReady) { target.set(feet.x,head,feet.z); cameraReady = true; }
    else target.lerp(eye.set(feet.x,head,feet.z), 1-Math.exp(-dt*12));
    ray.set(Math.sin(azimuth)*Math.cos(pitch), Math.sin(pitch), Math.cos(azimuth)*Math.cos(pitch));
    const obstruction = Phys.ray(target,ray,distance);
    eye.copy(target).addScaledVector(ray, obstruction ? Math.max(.4,obstruction.t-.18) : distance);
    eye.y = Math.max(eye.y,Island.surf(eye.x,eye.z)[0]+.28);
    camera.position.copy(eye); camera.lookAt(target); camera.near=.075; camera.fov=52;
    return status || (navigator.maxTouchPoints ? '왼쪽 스틱 이동 · 화면 드래그로 시점 회전' : 'WASD / 방향키 이동 · 드래그로 시점 회전 · 1 자유 비행');
  }
  Modes.add('actors',{name:'캐릭터',enter,leave,step},'KeyV','V');
  return { enter, leave, step, selectHuman };
})();
