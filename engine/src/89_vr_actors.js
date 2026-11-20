'use strict';
// A ground-level scale and motion test in the same daylight, weather and terrain as the island.
const ActorWalk = (() => {
  const group = new THREE.Group(), walkers = [];
  const centre = new THREE.Vector3(), eye = new THREE.Vector3(), target = new THREE.Vector3();
  let active = false, loading = false, status = '', time = 0, azimuth = .35, dragging = false;

  async function loadModels() {
    if (loading || walkers.length) return;
    loading = true; status = '모델 불러오는 중';
    try {
      const loader = window.createGardenGLTFLoader(THREE);
      const models = await Promise.all(Object.entries(window.GARDEN_ACTORS).map(async ([kind, url]) => {
        const { scene, animations } = await loader.loadAsync(url);
        const isHuman = kind === 'human', holder = new THREE.Group();
        const bounds = new THREE.Box3().setFromObject(scene, true);
        const height = bounds.max.y - bounds.min.y;
        if (height <= 0) throw new Error('Empty model: ' + kind);
        const scale = (isHuman ? 1.71 : .68) / height;
        scene.scale.multiplyScalar(scale);
        scene.position.y -= bounds.min.y * scale;
        scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        holder.add(scene); holder.name = kind;
        const mixer = new THREE.AnimationMixer(scene);
        const clip = animations.find(a => (isHuman ? /walk/i : /hop/i).test(a.name)) || animations[0];
        if (clip) mixer.clipAction(clip).play();
        return { kind, holder, mixer, clip, isHuman };
      }));
      for (const actor of models) { walkers.push(actor); group.add(actor.holder); }
      G.info.actorModels = models.map(a => ({ kind:a.kind, clip:a.clip?.name || '' }));
      status = '';
    } catch (error) {
      console.error('Actor test', error);
      status = '모델을 불러오지 못했습니다. 1을 눌러 나간 뒤 V로 다시 시도하세요.';
    } finally {
      loading = false;
    }
  }
  function enter() {
    if (!group.parent) G.scene.add(group);
    active = true; group.visible = true; time = 0; azimuth = .35;
    for (const actor of walkers) actor.mixer.setTime(0);
    loadModels();
  }
  function leave() { active = false; dragging = false; group.visible = false; }
  addEventListener('pointerdown', e => { if (active && e.target === G.R.domElement) dragging = true; });
  addEventListener('pointermove', e => { if (active && dragging) azimuth -= e.movementX * .01; });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointercancel', () => { dragging = false; });
  function step(camera, dt) {
    if (walkers.length) time += dt;
    if (Modes.keys.has('ArrowLeft')) azimuth -= dt;
    if (Modes.keys.has('ArrowRight')) azimuth += dt;
    // This short level loop lies inside the garden terrace, between the trail and the hive.
    const a = time * .22 - .94, dx = -Math.sin(a), dz = Math.cos(a);
    centre.set(Island.GP.x + 2.2 + 3.6 * Math.cos(a), 0, Island.GP.z + 7.6 + 3.6 * Math.sin(a));
    centre.y = Island.surf(centre.x, centre.z)[0];
    for (const actor of walkers) {
      const offset = actor.isHuman ? -.56 : .68;
      actor.mixer.update(dt);
      let angle = a;
      if (!actor.isHuman && actor.clip) {
        const loops = time / actor.clip.duration, phase = loops % 1;
        const leap = sm(.22,.76,phase);
        angle = .22 * actor.clip.duration * (Math.floor(loops)+leap) - .94;
      }
      const radius = 3.6 + offset;
      const x = Island.GP.x + 2.2 + radius * Math.cos(angle), z = Island.GP.z + 7.6 + radius * Math.sin(angle);
      actor.holder.position.set(x, Island.surf(x,z)[0], z);
      actor.holder.rotation.y = Math.atan2(Math.sin(angle),-Math.cos(angle));
    }
    const distance = camera.aspect < 1 ? 4.7 : 3.7;
    const angle = Math.atan2(dx,dz) + azimuth;
    eye.set(centre.x + distance*Math.sin(angle), centre.y+1.13, centre.z + distance*Math.cos(angle));
    eye.y = Math.max(eye.y, Island.surf(eye.x,eye.z)[0]+.65);
    target.copy(centre); target.y += .82;
    camera.position.copy(eye); camera.lookAt(target); camera.near=.075; camera.fov=49;
    return status || 'VRChat 모델 보행 · 끌어서 둘러보기 · 1 자유 비행';
  }
  Modes.add('actors',{name:'보행 테스트',enter,leave,step},'KeyV','V');
  return { enter, leave, step };
})();
