'use strict';
const DriveRace = (() => {
  const rd = Island.RD, car = Drive.car;
  const spawn = new THREE.Vector3(), door = new THREE.Vector3();
  const toward = new THREE.Vector3(), eye = new THREE.Vector3();
  const mirrorCam = new THREE.PerspectiveCamera(56, 3.25, .2, 4200);
  const view = new THREE.Vector4(), scissor = new THREE.Vector4();
  let mirrorTarget, mirrorColor, mirrorScene, mirrorQuad, mirrorTone, mirrorFilter, mirrorClock = 1;
  let phase = 'none', t = 0, elapsed = 0, best = 0, nextGate = 0, previousIndex = 0;
  let arch = null, promptDistance = Infinity, messageAt = -1;
  let releaseParked = null, releaseGate = [];
  try { best = Math.max(0, Number(localStorage.getItem('garden.coast-time-trial')) || 0); } catch {}
  const touch = matchMedia('(any-pointer: coarse)');
  const ui = document.createElement('div');
  ui.id = 'drive-race'; ui.hidden = true;
  ui.innerHTML = `
    <div id="race-rear-mirror" aria-label="후방 거울"></div>
    <div id="race-time" role="timer"></div>
    <button type="button" id="race-board"></button>
    <div id="race-result" role="status"></div>
    <div id="race-touch" aria-label="운전 조작">
      <div><button type="button" data-pedal="left" aria-label="좌회전">◀</button><button type="button" data-pedal="right" aria-label="우회전">▶</button></div>
      <div><button type="button" data-pedal="hb">브레이크</button><button type="button" data-pedal="brk">제동/후진</button><button type="button" data-pedal="acc">가속</button></div>
    </div>`;
  document.body.append(ui);
  const css = document.createElement('style');
  css.textContent = `
    #drive-race {font:650 13px/1.4 system-ui,sans-serif;color:#fbf2de;font-variant-numeric:tabular-nums}
    #drive-race button {font:inherit;min-height:44px;border:1px solid #f6e4c45c;border-radius:9px;padding:6px 10px;background:#22251feb;color:#fff6e5;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}
    #race-rear-mirror {position:fixed;top:50px;left:50%;width:clamp(132px,24vw,285px);aspect-ratio:3.6;border:3px solid #2d302e;border-radius:8px;box-shadow:0 1px 4px #0008;transform:translateX(-50%);pointer-events:none;z-index:4}
    #race-time {position:fixed;left:50%;top:calc(60px + clamp(132px,24vw,285px)/3.6);transform:translateX(-50%);padding:3px 8px;border-radius:6px;background:#151b19ce;white-space:nowrap;pointer-events:none;z-index:4}
    #drive-race #race-board,#race-result {position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:6;text-align:center;white-space:pre-line}
    #drive-race #race-board {background:#edc476;color:#272011;border:0;white-space:nowrap;padding:9px 16px}
    #drive-race #race-board:disabled {background:#181d19df;color:#fff3dd;cursor:default}
    #race-result {bottom:48%;background:#171d1ceb;padding:10px 15px;border-radius:8px;font-size:17px}
    #race-touch {position:fixed;inset:auto 14px calc(75px + env(safe-area-inset-bottom)) 14px;z-index:5;display:flex;justify-content:space-between;align-items:flex-end;pointer-events:none}
    #race-touch div {display:flex;gap:4px}
    #race-touch button {pointer-events:auto;min-width:44px}
    #race-touch button.pressed {background:#edc476;color:#281f0e}
    #drive-race [hidden] {display:none}
    @media(max-width:540px) {#drive-race #race-board {bottom:25%}#race-touch button {padding:5px 8px} #race-time {font-size:11px}}
    @media(max-height:480px) {#drive-race #race-board {bottom:21%}#race-touch {bottom:60px}}
  `;
  document.head.append(css);
  const mirror = ui.querySelector('#race-rear-mirror'), timing = ui.querySelector('#race-time');
  const board = ui.querySelector('#race-board'), message = ui.querySelector('#race-result'), pads = ui.querySelector('#race-touch');
  const held = new Map();
  function readPedals() {
    const down = key => [...held.values()].includes(key);
    Object.assign(Drive.touch, {acc:+down('acc'), brk:+down('brk'), hb:+down('hb'), st:+down('left')-Number(down('right'))});
    for (const b of pads.querySelectorAll('button')) b.classList.toggle('pressed', down(b.dataset.pedal));
  }
  function resetPedals() { held.clear(); readPedals(); }
  pads.addEventListener('pointerdown', e => {
    const b=e.target.closest('button');
    if (!b || e.button !== 0 || (phase !== 'driving' && phase !== 'grid')) return;
    e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); held.set(e.pointerId,b.dataset.pedal); readPedals();
  });
  for (const ev of ['pointerup','pointercancel','lostpointercapture']) pads.addEventListener(ev,e=>{
    if (held.delete(e.pointerId)) readPedals();
  });
  pads.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('blur',resetPedals);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetPedals();});
  const raceClock = seconds => Math.floor(seconds/60)+':'+(seconds%60).toFixed(2).padStart(5,'0');
  function visibility() {
    const racing = phase === 'driving', inCar = racing || phase === 'grid';
    ui.hidden = phase === 'none'; mirror.hidden = !inCar; timing.hidden = !racing;
    pads.hidden = !(inCar && (navigator.maxTouchPoints || touch.matches));
    board.hidden = phase !== 'approach' && phase !== 'finished';
    message.hidden = !(phase === 'finished' || phase === 'grid');
  }
  touch.addEventListener('change',visibility);
  function vehiclePoint(out,x,y,z) { return out.set(x,y,z).applyQuaternion(car.q).add(car.p); }

  function buildGate() {
    arch = new THREE.Group(); arch.name='coast-checkpoint';
    const gold = new THREE.MeshStandardMaterial({color:0xffba47,roughness:.55,emissive:0xaa5512,emissiveIntensity:.22});
    const dark = new THREE.MeshStandardMaterial({color:0x273e3f,roughness:.8});
    const post = new THREE.BoxGeometry(.13,3.85,.15), cap = new THREE.BoxGeometry(7.94,.23,.19);
    for(const x of [-3.97,3.97]) { const p=new THREE.Mesh(post,dark);p.position.set(x,1.9,0);p.castShadow=true;arch.add(p); }
    const bar = new THREE.Mesh(cap,gold);bar.position.y=3.8;arch.add(bar);
    for(let i=0;i<8;i++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.485,.24,.2),dark);stripe.position.set(i*.98-3.65,3.8,0);arch.add(stripe);}
    G.scene.add(arch);
  }
  function gateIndex(n) { return n < 3 ? Math.floor(rd.n*(n+1)/4) : 0; }
  function clearGate() {
    for(const remove of releaseGate) remove();
    releaseGate=[];
    if(arch) arch.visible=false;
  }
  function unpark() {
    if(releaseParked) releaseParked();
    releaseParked=null;
  }
  function placeGate() {
    clearGate();
    if (!arch) buildGate();
    const i=gateIndex(nextGate), j=(i+1)%rd.n;
    arch.position.set(rd.px[i],Island.support(rd.px[i],rd.pz[i]),rd.pz[i]);
    const yaw=Math.atan2(rd.px[j]-rd.px[i],rd.pz[j]-rd.pz[i]);
    arch.rotation.y=yaw;arch.visible=true;
    if(Phys.ready) for(const post of arch.children.slice(0,2)) {
      const center=arch.localToWorld(post.position.clone());
      releaseGate.push(Phys.box(center,new THREE.Vector3(.13,3.85,.15),yaw));
    }
  }
  function startApproach() {
    Drive.park(); G.drive=false;
    unpark();
    if(Phys.ready) {
      const center=vehiclePoint(eye,0,.1,-.04);
      releaseParked=Phys.box(center,new THREE.Vector3(1.65,1.04,3.87),carYaw());
    }
    vehiclePoint(door,1.15,0,-.03); vehiclePoint(spawn,4.05,0,-1.15);
    const yaw=Math.atan2(spawn.x-door.x,spawn.z-door.z);
    ActorWalk.beginApproach(spawn.x,spawn.z,yaw);
    phase='approach';t=elapsed=nextGate=0;promptDistance=Infinity;messageAt=-1;mirrorClock=1;
    clearGate();
    board.textContent='운전석으로 이동';board.disabled=true;visibility();
  }
  function boardCar() {
    if (phase === 'finished') { Drive.leave(); startApproach(); return; }
    if (phase !== 'approach' || promptDistance > 1.5 || !ActorWalk.avatar) return;
    ActorWalk.endApproach();Modes.keys.clear();
    phase='opening';t=0;
    visibility();
  }
  board.addEventListener('click',()=>{boardCar();board.blur();});
  addEventListener('keydown',e=>{
    if(phase==='approach' && (e.code==='KeyO'||e.code==='KeyE') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.('input,select,textarea,dialog[open]')){e.preventDefault();boardCar();}
  });
  function chase(camera) {
    vehiclePoint(eye,0,2.3,-6.6);vehiclePoint(toward,0,.8,1.8);
    camera.position.copy(eye);camera.lookAt(toward);camera.near=.2;camera.fov=60;
  }
  function carYaw() {
    toward.set(0,0,1).applyQuaternion(car.q);return Math.atan2(toward.x,toward.z);
  }
  function crossed(index,cur,prev,n) {
    const move=(cur-prev+n)%n, distance=(index-prev+n)%n;
    return move>0 && move<n/5 && distance>0 && distance<=move;
  }
  function updateRace(dt) {
    if(Drive.paused) return;
    elapsed+=dt;
    const road=Island.nearRoad(car.p.x,car.p.z);
    if(road.d<5.9 && crossed(gateIndex(nextGate),road.i,previousIndex,rd.n)) {
      nextGate++;
      if(nextGate===4) {
        if(!best || elapsed<best) {best=elapsed;try{localStorage.setItem('garden.coast-time-trial',String(best));}catch{}}
        phase='finished';Drive.finish();G.drive=false;clearGate();resetPedals();visibility();
        message.textContent='완주  '+raceClock(elapsed)+'\n최고  '+raceClock(best);
        board.disabled=false;board.textContent='다시 도전';return;
      }
      messageAt=elapsed;placeGate();
    }
    previousIndex=road.i;
    const passed=elapsed-messageAt<1.1 && messageAt>=0;
    const ahead=((gateIndex(nextGate)*2-road.s+rd.n*2)%(rd.n*2));
    const destination=nextGate<3?'관문 '+(nextGate+1)+'/3':'결승선';
    timing.textContent=(passed?'체크포인트 통과':destination+' · '+Math.round(ahead)+' m')+'   '+raceClock(elapsed);
  }
  function step(camera,dt) {
    if(phase==='approach') {
      ActorWalk.stepApproach(camera,dt);
      const p=ActorWalk.position; promptDistance=Math.hypot(p.x-door.x,p.z-door.z);
      board.disabled=promptDistance>1.5 || !ActorWalk.avatar;
      board.textContent=board.disabled ? '운전석까지 '+promptDistance.toFixed(1)+' m' : (navigator.maxTouchPoints?'문 열고 출발 준비':'E / O  문 열고 출발 준비');
      return '운전석 문으로 이동';
    }
    if(phase==='opening'){
      t+=dt;Drive.setDoor(sm(0,.20,t));
      if(t>=.20){phase='grid';t=0;placeGate();message.textContent='3';chase(camera);visibility();}
      return '출발 준비';
    }
    if(phase==='grid') {
      t+=dt;Drive.setDoor(1-sm(0,.25,t));chase(camera);message.textContent=String(Math.max(1,3-Math.floor(t)));
      if(t>=3){phase='driving';unpark();Drive.enter();G.drive=true;previousIndex=Island.nearRoad(car.p.x,car.p.z).i;visibility();}
      return '해안 순환 · 타임 트라이얼';
    }
    if(phase==='finished'){chase(camera);return '해안 순환 완주';}
    const hint=Drive.step(camera,dt);updateRace(dt);return hint;
  }
  function leave() {
    if(phase==='approach')ActorWalk.endApproach();
    Drive.leave();unpark();G.drive=false;clearGate();phase='none';resetPedals();visibility();Modes.fly.p.copy(G.camera.position);
  }

  function initMirror() {
    mirrorTarget=new THREE.WebGLRenderTarget(288,80,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(288,80)});
    mirrorColor=new THREE.WebGLRenderTarget(288,80,{depthBuffer:false});
    mirrorQuad=new THREE.OrthographicCamera(-1,1,1,-1,0,1);mirrorScene=new THREE.Scene();
    mirrorTone=new THREE.ShaderMaterial({ uniforms:{uView:{value:mirrorTarget.texture},uExposure:{value:1}},
      vertexShader:'varying vec2 uvMirror; void main(){uvMirror=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'varying vec2 uvMirror; uniform sampler2D uView; uniform float uExposure; void main(){vec3 c=texture2D(uView,uvMirror).rgb*uExposure; c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.); gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}',
      depthWrite:false,depthTest:false });
    mirrorFilter=VisualStyle.makeFilter(true);
    mirrorScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),mirrorFilter));
  }
  function renderMirror(renderer,scene,dt) {
    if(phase!=='driving' && phase!=='grid')return;
    if(!mirrorTarget)initMirror();
    const screen=mirror.getBoundingClientRect(), width=screen.width-6, height=screen.height-6;
    if(width<=0||height<=0)return;
    const previous=renderer.getRenderTarget(),clipped=renderer.getScissorTest(),clear=renderer.autoClear,shadow=renderer.shadowMap.autoUpdate;
    renderer.getViewport(view);renderer.getScissor(scissor);
    try {
      mirrorClock+=dt;
      if(mirrorClock>=1/(LOW?10:16)) {
        mirrorClock=0;mirrorCam.aspect=width/height;
        vehiclePoint(mirrorCam.position,0,1.08,-1.84);vehiclePoint(toward,0,.8,-28);mirrorCam.lookAt(toward);mirrorCam.updateProjectionMatrix();
        renderer.shadowMap.autoUpdate=false;renderer.autoClear=true;renderer.setRenderTarget(mirrorTarget);renderer.setScissorTest(false);
        renderer.render(scene,mirrorCam);
        mirrorTone.uniforms.uExposure.value=G.info.exposure||1;
        mirrorScene.children[0].material=mirrorTone;renderer.setRenderTarget(mirrorColor);renderer.render(mirrorScene,mirrorQuad);
      }
      renderer.setRenderTarget(null);renderer.setViewport(screen.left+3,innerHeight-screen.bottom+3,width,height);
      renderer.setScissor(screen.left+3,innerHeight-screen.bottom+3,width,height);renderer.setScissorTest(true);renderer.autoClear=false;
      const snap=VisualStyle.usesRaster()||PixelFit.enabled;
      const density=PixelFit.enabled?renderer.getPixelRatio()/PixelFit.scale:VisualStyle.raster/Math.max(innerWidth,innerHeight);
      const w=snap?Math.max(1,Math.round(width*density)):mirrorColor.width;
      const h=snap?Math.max(1,Math.round(height*density)):mirrorColor.height;
      VisualStyle.configureFilter(mirrorFilter,mirrorColor.texture,mirrorTarget.depthTexture,mirrorCam.near,mirrorCam.far,w,h,snap);
      mirrorScene.children[0].material=mirrorFilter;renderer.render(mirrorScene,mirrorQuad);
    } finally {
      renderer.shadowMap.autoUpdate=shadow;renderer.autoClear=clear;renderer.setRenderTarget(previous);renderer.setViewport(view);renderer.setScissor(scissor);renderer.setScissorTest(clipped);
    }
  }
  Modes.add('drive',{name:'레이싱',enter:startApproach,leave,step},'Digit4','4');
  return {renderMirror,get phase(){return phase;},get completedGates(){return nextGate;},get elapsed(){return elapsed;}};
})();
