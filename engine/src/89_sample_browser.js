'use strict';
// A catalogue of credited models. People use the character controller. Other models
// stand on the terrace, in the same daylight, fog and shadows as the rest of the island.
const SampleBrowser = (() => {
  const kate = {
    id: 'kate', label: 'Kate', category: 'person', author: 'Polygonal Mind', license: 'CC0 1.0',
    source: 'https://github.com/PolygonalMind/100Avatars/tree/ff07c2ad0017819c4e5366656ee1e5bcc4029bd4/100Avatars_038',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', origin: 'VRChat · 100Avatars',
    file: window.GARDEN_ACTORS.human
  };
  const entries = [kate, ...(window.GARDEN_SAMPLES || [])];
  const categories = {person:'사람', prop:'소품', building:'건물', car:'자동차', aircraft:'비행기'};
  const byId = id => document.getElementById(id);
  const button = byId('sample-button'), panel = byId('sample-picker');
  const category = byId('sample-category'), model = byId('sample-model');
  const credit = byId('sample-credits'), run = byId('sample-run'), canvas = byId('c');
  const target = new THREE.Vector3(), size = new THREE.Vector3();
  let entry = entries.find(item => item.category !== 'person'), shown = null, ticket = 0;
  let status = '', radius = 2, yaw = .67, pitch = .24, zoom = 1, pointer = null, px = 0, py = 0;

  function release(scene) {
    if (!scene) return;
    scene.removeFromParent();
    const materials = new Set(), geometries = new Set(), textures = new Set();
    scene.traverse(o => {
      if (!o.isMesh) return;
      geometries.add(o.geometry);
      for (const m of [].concat(o.material)) materials.add(m);
    });
    for (const m of materials) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      m.dispose();
    }
    for (const tex of textures) { tex.source.data?.close?.(); tex.dispose(); }
    for (const geometry of geometries) geometry.dispose();
  }

  async function loadWorld(item) {
    const request = ++ticket;
    release(shown); shown = null; radius = 2; zoom = 1; yaw = .67; pitch = .24;
    const x = Island.GP.x + 3, z = Island.GP.z + 5.4, y = Island.surf(x,z)[0];
    target.set(x,y+1,z);
    if (!item) { status = '샘플에서 모델을 선택하세요.'; return; }
    status = item.label + ' 불러오는 중';
    let scene;
    try {
      ({scene} = await window.createGardenGLTFLoader(THREE).loadAsync(item.file));
      if (request !== ticket) { release(scene); return; }
      const bounds = new THREE.Box3().setFromObject(scene, true);
      bounds.getSize(size);
      if (bounds.isEmpty() || !(size.y > 0)) throw Error('Empty model');
      const scale = item.height > 0 ? item.height / size.y : 1;
      const holder = new THREE.Group();
      bounds.getCenter(holder.position).multiplyScalar(-scale);
      holder.position.x += x; holder.position.z += z; holder.position.y = y - bounds.min.y * scale;
      holder.scale.setScalar(scale); holder.add(scene); holder.name = 'sample-' + item.id;
      scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      G.scene.add(holder); shown = holder;
      target.set(x,y + .5*size.y*scale,z); radius = Math.max(.1, size.length() * scale / 2);
      status = item.label + ' · 끌어서 회전 · 1 자유 비행';
    } catch (error) {
      release(scene);
      if (request === ticket) {
        status = item.label + ' 로드 실패 · 샘플에서 다시 선택하세요.';
        console.error('Sample model:', item.id, error);
      }
    }
  }

  function leave() {
    ++ticket;
    release(shown); shown = null;
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    pointer = null;
  }
  function step(camera) {
    const fov = 43, vertical = THREE.MathUtils.degToRad(fov/2);
    const narrow = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
    const distance = radius / Math.sin(narrow) * 1.12 * zoom;
    const horizontal = Math.cos(pitch) * distance;
    camera.position.set(target.x + Math.sin(yaw)*horizontal, target.y + Math.sin(pitch)*distance, target.z + Math.cos(yaw)*horizontal);
    camera.position.y = Math.max(camera.position.y, Island.surf(camera.position.x,camera.position.z)[0] + Math.min(.35, radius*.2));
    camera.lookAt(target); camera.fov = fov; camera.near = Math.min(.1, radius*.08);
    return status;
  }
  Modes.add('sample', {name:'모델 보기', key:'◇', enter() { loadWorld(entry); }, leave, step});
  canvas.addEventListener('pointerdown', e => {
    if (Modes.cur !== 'sample' || pointer !== null || e.button !== 0) return;
    pointer = e.pointerId; px = e.clientX; py = e.clientY; canvas.setPointerCapture(pointer);
  });
  canvas.addEventListener('pointermove', e => {
    if (pointer !== e.pointerId) return;
    yaw -= (e.clientX-px)*.009; pitch = clamp(pitch + (e.clientY-py)*.008, .04, 1.42);
    px = e.clientX; py = e.clientY;
  });
  canvas.addEventListener('lostpointercapture', e => { if (e.pointerId === pointer) pointer = null; });
  canvas.addEventListener('wheel', e => {
    if (Modes.cur !== 'sample') return;
    e.preventDefault(); zoom = clamp(zoom*Math.exp(e.deltaY*.001), .55, 2.2);
  }, {passive:false});

  const selection = () => entries.find(item => item.category === category.value && item.id === model.value);
  function refreshCredit() {
    const item = selection();
    credit.textContent = [item.origin,item.author].filter(Boolean).join(' · ');
    credit.append(document.createElement('br'));
    const link = (label, url) => {
      const a = document.createElement('a'); a.textContent = label; a.href = url;
      a.target = '_blank'; a.rel = 'noopener noreferrer'; credit.append(a);
    };
    link(item.license, item.licenseUrl); credit.append(' · '); link('원본', item.source || item.sourceUrl);
    credit.append(' · ');
    const download = document.createElement('a');
    download.textContent = 'GLB 받기'; download.href = item.file; download.download = item.id + '.glb';
    credit.append(download);
    run.textContent = item.category === 'person' ? '이 캐릭터 조종' : '월드에서 보기';
  }
  function refreshModels() {
    model.replaceChildren();
    for (const item of entries.filter(item => item.category === category.value)) model.add(new Option(item.label,item.id));
    refreshCredit();
  }
  function toggle(open) {
    panel.hidden = !open; button.setAttribute('aria-expanded', String(open));
    byId('sample-exit').hidden = Modes.cur === 'free';
    if (open) category.focus(); else button.focus({preventScroll:true});
  }
  for (const [key,label] of Object.entries(categories)) {
    if (entries.some(item => item.category === key)) category.add(new Option(label,key));
  }
  refreshModels();
  button.addEventListener('click', () => toggle(panel.hidden));
  byId('sample-close').addEventListener('click', () => toggle(false));
  category.addEventListener('change', refreshModels); model.addEventListener('change', refreshCredit);
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { toggle(false); e.preventDefault(); }
    e.stopPropagation();
  });
  byId('sample-exit').addEventListener('click', () => {
    Modes.set('free'); toggle(false); button.blur();
  });
  run.addEventListener('click', () => {
    const item = selection(); toggle(false); button.blur();
    if (item.category === 'person') {
      Modes.set('actors'); ActorWalk.selectHuman(item === kate ? null : item);
    } else {
      entry = item;
      if (Modes.cur === 'sample') loadWorld(entry); else Modes.set('sample');
    }
  });
  return {get entry() { return entry; }};
})();
