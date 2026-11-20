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
  const frog={...kate,id:'froggy',label:'개구리 · Froggy',category:'animal',species:'frog',height:.68,
    source:'https://github.com/PolygonalMind/100Avatars/tree/ff07c2ad0017819c4e5366656ee1e5bcc4029bd4/100Avatars_010',file:window.GARDEN_ACTORS.frog};
  const entries = [kate, ...(window.GARDEN_SAMPLES || []), frog];
  const playable=item=>item.category==='person'||item.category==='animal';
  WalkActions.configurePeople(entries.filter(playable), chooseHuman);
  function chooseHuman(item) { return ActorWalk.selectHuman(item === kate ? null : item); }
  const categories = {person:'사람',animal:'동물', prop:'소품', building:'건물', car:'자동차', aircraft:'비행기'};
  const byId = id => document.getElementById(id);
  const button = byId('sample-button'), panel = byId('sample-picker');
  const category = byId('sample-category'), model = byId('sample-model');
  const credit = byId('sample-credits'), run = byId('sample-run'), canvas = byId('c');
  const target = new THREE.Vector3(), size = new THREE.Vector3();
  const worldEntries = entries.filter(item => item.category !== 'person');
  let entry = worldEntries.find(item=>item.id===Q.get('model')) || worldEntries[0], shown = null, ticket = 0;
  let status = '', radius = 2, yaw = .67, pitch = .24, zoom = 1, pointer = null, px = 0, py = 0;
  let walking = false, removeSolid = null;
  const footprint = new THREE.Box3();
  const walkButton = document.createElement('button');
  walkButton.id = 'sample-walk'; walkButton.type = 'button'; walkButton.hidden = true;
  walkButton.style.cssText = 'position:fixed;right:max(14px,env(safe-area-inset-right));top:143px;z-index:6;min-height:38px;padding:7px 12px;border:1px solid #d6e4c388;border-radius:8px;background:#23342bee;color:#e5efdb;font:600 13px system-ui,sans-serif;cursor:pointer';
  document.body.append(walkButton);
  function updateWalkButton() {
    walkButton.hidden = !shown || !panel.hidden || Modes.cur !== 'sample';
    walkButton.textContent = walking ? '모델 회전 보기' : '걸어서 보기';
    walkButton.setAttribute('aria-pressed', String(walking));
  }
  function stopWalk() { if (walking) { walking = false; ActorWalk.endApproach(); } }
  function clearWorld() {
    stopWalk();
    if (removeSolid) { removeSolid(); removeSolid = null; }
    release(shown); shown = null; updateWalkButton();
  }
  function placement(width, depth) {
    const anchorX=Island.GP.x+3, anchorZ=Island.GP.z+5.4;
    let best = null;
    // Prefer the original view, then try adjacent patches sized to this model's footprint.
    for (const [dx,dz] of [[0,0],[-3,0],[0,-4],[-5,-3],[3,-4],[-4,3],[4,0],[0,-8]]) {
      const x=anchorX+dx, z=anchorZ+dz;
      let min=Infinity,max=-Infinity;
      for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){
        const y=Island.support(x+ix*width*.25,z+iz*depth*.25);
        min=Math.min(min,y);max=Math.max(max,y);
      }
      const spread=max-min;
      if(!best || spread<best.spread)best={x,z,y:max,spread};
      if(spread<.009)break;
    }
    return best;
  }
  walkButton.addEventListener('click', () => {
    if (!shown) return;
    if (walking) stopWalk();
    else {
      const inset = Math.max(1.3,Math.min(2.6,radius*.6));
      const entrance = entry.walkEntrance;
      let x = target.x + .18*(footprint.max.x-footprint.min.x), z = footprint.max.z + inset;
      let angle = Math.atan2(x-target.x,z-target.z);
      if (entrance?.edge === 'east') {
        x = footprint.max.x + inset; z = lerp(footprint.min.z,footprint.max.z,entrance.across);
        angle = Math.PI/2;
      }
      ActorWalk.beginApproach(x,z,angle); walking = true;
    }
    updateWalkButton(); walkButton.blur();
  });


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
    clearWorld(); radius = 2; zoom = 1; yaw = .67; pitch = .24;
    target.set(Island.GP.x,Island.GP.y+1,Island.GP.z);
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
      const {x,y,z} = placement(size.x*scale,size.z*scale);
      const holder = new THREE.Group();
      bounds.getCenter(holder.position).multiplyScalar(-scale);
      holder.position.x += x; holder.position.z += z; holder.position.y = y - bounds.min.y * scale;
      holder.scale.setScalar(scale); holder.add(scene); holder.name = 'sample-' + item.id;
      scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      G.scene.add(holder); shown = holder; holder.updateMatrixWorld(true);
      footprint.setFromObject(holder,true); removeSolid = Phys.meshSolid(holder); updateWalkButton();
      target.set(x,y + .5*size.y*scale,z); radius = Math.max(.1, size.length() * scale / 2);
      status = item.label + ' · 끌어서 회전 · 1 자유시점';
    } catch (error) {
      if (request === ticket && shown) clearWorld(); else release(scene);
      if (request === ticket) {
        status = item.label + ' 로드 실패 · 샘플에서 다시 선택하세요.';
        console.error('Sample model:', item.id, error);
      }
    }
  }

  function leave() {
    ++ticket;
    clearWorld();
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    pointer = null;
  }
  function step(camera,dt) {
    if (walking) return ActorWalk.stepApproach(camera,dt);
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
    if (Modes.cur !== 'sample' || walking || pointer !== null || e.button !== 0) return;
    pointer = e.pointerId; px = e.clientX; py = e.clientY; canvas.setPointerCapture(pointer);
  });
  canvas.addEventListener('pointermove', e => {
    if (pointer !== e.pointerId) return;
    yaw -= (e.clientX-px)*.009; pitch = clamp(pitch + (e.clientY-py)*.008, .04, 1.42);
    px = e.clientX; py = e.clientY;
  });
  canvas.addEventListener('lostpointercapture', e => { if (e.pointerId === pointer) pointer = null; });
  canvas.addEventListener('wheel', e => {
    if (Modes.cur !== 'sample' || walking) return;
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
    run.textContent = playable(item) ? '이 캐릭터 조종' : '월드에서 보기';
  }
  function refreshModels() {
    model.replaceChildren();
    for (const item of entries.filter(item => item.category === category.value)) model.add(new Option(item.label,item.id));
    refreshCredit();
  }
  function toggle(open) {
    panel.hidden = !open; button.setAttribute('aria-expanded', String(open));
    byId('sample-exit').hidden = Modes.cur === 'free'; updateWalkButton();
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
    if (playable(item)) {
      Modes.set('actors'); chooseHuman(item);
    } else {
      entry = item;
      if (Modes.cur === 'sample') loadWorld(entry); else Modes.set('sample');
    }
  });
  return {get entry() { return entry; },get walking() { return walking; },
    character(id){return entries.find(item=>item.id===id&&playable(item));}};
})();
