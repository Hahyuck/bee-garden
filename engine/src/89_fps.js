'use strict';
// An arcade pulse range in the garden. Its targets and viewmodel share the island's lighting.
const PulseRange = (() => {
  const capacity = 12, cadence = .16, reloadTime = 1.1, reach = 68;
  const group = new THREE.Group(), view = new THREE.Group(), tool = new THREE.Group();
  group.name = 'pulse-range'; view.name = 'pulse-viewmodel';
  const targets = [], beams = [], rings = [], chargeLights = [], standColliders = [];
  const direction = new THREE.Vector3(), delta = new THREE.Vector3(), end = new THREE.Vector3();
  const origin = new THREE.Vector3(), axis = new THREE.Vector3(), up = new THREE.Vector3(0,1,0);
  const spawn = {x:Island.GP.x+4.1, z:Island.GP.z+9.2, yaw:0};
  // The first beacon is in the player's line of sight. Others span the garden at different elevations.
  const field = [[0,7.2,1.55],[-3.4,8.6,1.16],[3.6,10.8,2.03],[-5.2,14.3,2.38],[5.6,16.2,1.45]];
  let active = false, held = false, triggerPointer = null, pressed = false, built = false;
  let ammo = capacity, hits = 0, wave = 1, cooldown = 0, reload = 0, hitTime = 0, waveTime = 0;
  let clock = 0, recoil = 0, flash = null, muzzle = null;
  let paused=false, hadLock=false, lockRequest=null;

  const ui = document.createElement('div'); ui.id = 'pulse-range-ui'; ui.hidden = true;
  ui.innerHTML = `<div id="pulse-reticle" aria-hidden="true"><i></i></div>
    <div id="pulse-gate" hidden><strong aria-live="polite"></strong><button type="button">클릭하여 조준</button></div>
    <div id="pulse-counter" aria-label="사격 기록"><b></b><span></span></div>
    <div id="pulse-touch"><button type="button" id="pulse-fire">발사</button><button type="button" id="pulse-reload">재장전</button></div>`;
  const style = document.createElement('style');
  style.textContent = `
    #pulse-range-ui{pointer-events:none;color:#f8ecce;font:600 12px/1.35 system-ui,sans-serif}
    #pulse-reticle{--reticle:#fff9df;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:23px;height:23px;z-index:4;filter:drop-shadow(0 1px 2px #282519);}
    #pulse-reticle::before,#pulse-reticle::after,#pulse-reticle i{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--reticle)}
    #pulse-reticle::before{width:23px;height:2px;mask:linear-gradient(to right,#000 27%,transparent 27% 73%,#000 73%)}
    #pulse-reticle::after{width:2px;height:23px;mask:linear-gradient(to bottom,#000 27%,transparent 27% 73%,#000 73%)}
    #pulse-reticle i{width:3px;height:3px;border-radius:50%}#pulse-reticle.ready{--reticle:#a5fff0}#pulse-reticle.hit{--reticle:#ffbb62;transform:translate(-50%,-50%) rotate(45deg)}
    #pulse-gate{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:7;text-align:center;color:white;background:#182823ec;padding:14px 18px;border-radius:8px;pointer-events:auto}
    #pulse-gate strong:not(:empty){display:block;margin-bottom:8px}#pulse-gate button{font:inherit;border:1px solid #a1ede1;border-radius:5px;padding:8px 16px;color:#172c26;background:#b4e9d8;cursor:pointer}
    #pulse-range-ui[data-paused="yes"] #pulse-touch,body.fps-paused #walk-action-buttons{display:none}
    #pulse-counter{position:fixed;right:max(15px,env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));z-index:5;text-align:right;color:#f8f7f0;background:#18221de8;border-left:3px solid #a1ede1;padding:5px 10px;border-radius:3px}
    #pulse-counter b{font:700 16px/1.2 ui-monospace,monospace}#pulse-counter span{display:block;font-size:10px;color:#cae3d9}
    #pulse-touch{display:none;position:fixed;right:max(16px,env(safe-area-inset-right));bottom:calc(178px + env(safe-area-inset-bottom));align-items:center;gap:7px;z-index:6}
    #pulse-touch button{pointer-events:auto;touch-action:none;user-select:none;border:1px solid #bcebe5aa;background:#123633e8;color:#e2fdf8;border-radius:10px;min-height:43px;padding:5px 10px;font:700 12px system-ui,sans-serif}
    #pulse-touch #pulse-fire{width:61px;height:55px;border-radius:50%;color:#182a27;background:#a6dfcf}
    [data-touch="yes"] #pulse-touch{display:flex}
    @media(max-height:480px) and (orientation:landscape){#pulse-touch{bottom:calc(66px + env(safe-area-inset-bottom));right:calc(156px + env(safe-area-inset-right))}}
    @media(max-width:620px){#pulse-counter{bottom:calc(12px + env(safe-area-inset-bottom));max-width:110px}}
  `;
  document.head.append(style); document.body.append(ui);
  const reticle = ui.querySelector('#pulse-reticle'), count = ui.querySelector('#pulse-counter b');
  const score = ui.querySelector('#pulse-counter span'), fireButton = ui.querySelector('#pulse-fire');
  const gate=ui.querySelector('#pulse-gate'),resume=gate.querySelector('button'),notice=gate.querySelector('strong');
  const metal = (color,metalness=.32) => new THREE.MeshStandardMaterial({color,metalness,roughness:.46});
  const glow = (color,intensity=1) => new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),toneMapped:false});
  function mesh(geo,material,parent,x=0,y=0,z=0) {
    const o = new THREE.Mesh(geo,material); o.position.set(x,y,z); parent.add(o); return o;
  }
  function build() {
    if (built) return;
    built = true;
    const graphite = metal(0x495968,.16), ceramic = metal(0xc4cecf,.17), brass = metal(0xd98c39,.3);
    const grip = metal(0x343b3e,.02), cyan = glow(0x56e4db,1.7), amber = glow(0xffb64e,1.3);
    view.add(tool); group.add(view);
    const box = (w,h,d,m,x,y,z) => mesh(new THREE.BoxGeometry(w,h,d),m,tool,x,y,z);
    // A beveled side profile keeps the white thermal jacket and the receding emitter legible from behind.
    function housing(profile,width,material,x=0) {
      const shape=new THREE.Shape();
      profile.forEach(([z,y],i)=>{if(i)shape.lineTo(-z,y);else shape.moveTo(-z,y);});
      shape.closePath();
      const geo=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.007});
      geo.translate(0,0,-width/2);geo.rotateY(Math.PI/2);
      return mesh(geo,material,tool,x,0,0);
    }
    housing([[.17,-.042],[.20,.008],[.145,.054],[.06,.074],[-.076,.064],[-.188,.039],[-.212,-.01],[-.14,-.043]],.126,graphite);
    for(const side of [-1,1]){
      housing([[.119,-.028],[.143,.006],[.088,.045],[-.035,.052],[-.166,.026],[-.184,-.007],[-.055,-.038]],.024,ceramic,side*.067);
      const strip=box(.008,.012,.129,brass,side*.087,-.016,.004);strip.rotation.x=-.075;
      box(.007,.012,.112,cyan,side*.081,.018,-.081);
    }
    const barrel=mesh(new THREE.CylinderGeometry(.041,.036,.245,12),graphite,tool,0,.001,-.255);
    barrel.rotation.x=Math.PI*.5;
    for(let i=0;i<4;i++){
      const collar=mesh(new THREE.TorusGeometry(.042,.005,6,16),i===1?cyan:brass,tool,0,.001,-.215-i*.037);
      collar.scale.y=.95;
    }
    const lip=mesh(new THREE.TorusGeometry(.044,.009,8,18),ceramic,tool,0,.002,-.383);
    muzzle=new THREE.Object3D();lip.add(muzzle);
    flash=mesh(new THREE.OctahedronGeometry(.084,0),glow(0xc2fcf3,3),muzzle,0,0,-.057);flash.scale.set(.8,.8,2.4);
    box(.086,.012,.054,grip,0,.079,.061);
    for(let i=0;i<6;i++)chargeLights.push(box(.008,.006,.033,cyan,-.032+i*.013,.088,.061));
    mesh(new THREE.TorusGeometry(.026,.004,6,14),ceramic,tool,0,.09,-.091);
    box(.021,.035,.017,graphite,0,.065,-.091);
    const sleeve=mesh(new THREE.CylinderGeometry(.052,.077,.27,10),grip,tool,.035,-.123,.216);
    sleeve.rotation.x=-1.07;
    const glove=mesh(new THREE.SphereGeometry(1,12,9),metal(0x667577,.03),tool,.004,-.062,.116);
    glove.scale.set(.057,.053,.079);
    for(let i=0;i<3;i++){
      const finger=mesh(new THREE.CapsuleGeometry(.011,.046,3,7),grip,tool,-.028,-.048-i*.02,.108);
      finger.rotation.z=Math.PI*.36;
    }
    const baseGeo=new THREE.CylinderGeometry(.21,.31,.15,12), stemGeo=new THREE.CylinderGeometry(.036,.052,1,8);
    const ringGeo=new THREE.TorusGeometry(.48,.041,8,42);
    const discGeo=new THREE.CylinderGeometry(.395,.395,.095,40), centerGeo=new THREE.CylinderGeometry(.19,.22,.11,8);
    const bands=new THREE.TorusGeometry(.25,.015,6,32);
    for(let i=0;i<field.length;i++) {
      const [x,z,h]=field[i], floor=Island.support(spawn.x+x,spawn.z-z);
      const post=new THREE.Group(); post.name='pulse-beacon-'+i; post.position.set(spawn.x+x,floor,spawn.z-z); group.add(post);
      mesh(baseGeo,graphite,post,0,.075,0).castShadow=true;
      const stem=mesh(stemGeo,ceramic,post,0,h/2-.13,0);stem.scale.y=h-.25;
      const face=new THREE.Group(); post.add(face); face.position.y=h;
      mesh(ringGeo,amber,face);
      mesh(discGeo,graphite,face).rotation.x=Math.PI/2;
      mesh(centerGeo,cyan,face,0,0,.065).rotation.x=Math.PI/2;
      mesh(bands,brass,face,0,0,.061);
      targets.push({post,face,h,live:true,center:new THREE.Vector3()});
      const pulse=mesh(ringGeo,glow(0x76fff0,2.4),group);pulse.visible=false;rings.push({mesh:pulse,life:0});
    }
    const beamGeo = new THREE.CylinderGeometry(.014,.014,1,7);
    for(let i=0;i<3;i++){const o=mesh(beamGeo,cyan,group);o.visible=false;beams.push({mesh:o,life:0});}
    G.scene.add(group);
  }

  function placeStandColliders() {
    for (const target of targets) {
      const p=target.post.position;
      standColliders.push(Phys.box(new THREE.Vector3(p.x,p.y+.075,p.z),new THREE.Vector3(.53,.15,.53)));
      standColliders.push(Phys.box(new THREE.Vector3(p.x,p.y+target.h/2,p.z),new THREE.Vector3(.105,target.h,.105)));
    }
  }
  function tone(kind) {
    const ac=G.snd?.ac;
    if(!ac || ac.state!=='running' || !G.snd.out)return;
    const hit=kind==='hit', recharge=kind==='load';
    const osc=ac.createOscillator(), gain=ac.createGain(), t=ac.currentTime;
    osc.type=hit?'sine':'triangle';
    osc.frequency.setValueAtTime(hit?720:recharge?340:420,t);
    osc.frequency.exponentialRampToValueAtTime(hit?1150:recharge?610:105,t+.09);
    gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(.042,t+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.105);
    osc.connect(gain); gain.connect(G.snd.out); osc.start(t); osc.stop(t+.12);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  function reloadCell() { if(active && !paused && !reload && ammo<capacity){reload=reloadTime;tone('load');} }
  function findTarget(camera) {
    let closest=reach,index=-1;
    for(let i=0;i<targets.length;i++) {
      const t=targets[i]; if(!t.live)continue;
      delta.subVectors(t.center,camera.position);
      const along=delta.dot(direction), rad=t.center.distanceToSquared(camera.position)-along*along;
      if(along>.04 && rad<.55*.55 && along<closest){closest=along;index=i;}
    }
    return {index,distance:closest};
  }
  function shoot(camera,aim) {
    if(ammo<=0){reloadCell();return;}
    ammo--;cooldown=cadence;recoil=1;tone('shot');
    const obstruction=Phys.ray(camera.position,direction,reach);
    let hit=aim.index>=0 && (!obstruction || obstruction.t>=aim.distance-.5);
    // The terrain still occludes a pulse when the optional physics backend is offline.
    if(hit && !Phys.ready)for(let t=1;t<aim.distance-.45;t+=.7){
      delta.copy(camera.position).addScaledVector(direction,t);
      if(delta.y<Island.surf(delta.x,delta.z)[0]){hit=false;break;}
    }
    let distance=obstruction?obstruction.t:reach;
    if(hit){
      const target=targets[aim.index];target.live=false;target.face.visible=false;hits++;hitTime=.2;distance=aim.distance;
      const pulse=rings[aim.index];pulse.life=.33;pulse.mesh.visible=true;pulse.mesh.position.copy(target.center);
      if(targets.every(t=>!t.live))waveTime=.85;
      tone('hit');
    }
    end.copy(camera.position).addScaledVector(direction,distance);
    muzzle.getWorldPosition(origin);axis.subVectors(end,origin);
    const beam=beams.find(b=>b.life<=0)||beams[0];beam.life=.065;beam.mesh.visible=true;
    beam.mesh.position.copy(origin).lerp(end,.5);beam.mesh.scale.y=axis.length();
    beam.mesh.quaternion.setFromUnitVectors(up,axis.normalize());
  }

  function resetTrigger() { held=pressed=false;triggerPointer=null; }
  function triggerDown(e) {
    if(!active || paused || triggerPointer!==null || e.button!==0)return;
    triggerPointer=e.pointerId;held=pressed=true;
  }
  const canvas=document.getElementById('c');
  const locked=()=>document.pointerLockElement===canvas;
  function syncGate(message=''){
    gate.hidden=!active||(!paused&&(locked()||ui.dataset.touch==='yes')&&!message);
    reticle.hidden=!gate.hidden;ui.dataset.paused=paused?'yes':'no';
    document.body.classList.toggle('fps-paused',active&&paused);
    notice.textContent=message||(paused?'일시정지':'');
    resume.textContent=paused?'계속하기':'클릭하여 조준';
  }
  function pause(){
    if(!active)return;
    paused=true;lockRequest=null;resetTrigger();Modes.keys.clear();ActorWalk.clearInput();
    WalkActions.release();WalkStick.setActive(false);Sound.setPaused(true);syncGate();
    if(locked())document.exitPointerLock();
  }
  function play(){
    paused=false;Modes.keys.clear();WalkStick.setActive(true);Sound.setPaused(false);
    resume.blur();syncGate();
  }
  function capture(){
    if(!active||locked()||lockRequest)return;
    const request={};lockRequest=request;
    const failed=()=>{if(lockRequest===request){lockRequest=null;pause();syncGate('마우스를 고정할 수 없습니다. 게임 화면에서 다시 시도하세요.');}};
    try{if(!canvas.requestPointerLock){failed();return;}canvas.requestPointerLock()?.catch(failed);}
    catch{failed();}
  }
  resume.addEventListener('click',e=>{
    if(e.pointerType==='touch'||(ui.dataset.touch==='yes'&&!matchMedia('(any-pointer: fine)').matches&&e.detail===0))play();
    else capture();
  });
  canvas.addEventListener('click',e=>{if(active&&!locked()&&e.button===0&&e.pointerType!=='touch'&&!(e.sourceCapabilities?.firesTouchEvents))capture();});
  canvas.addEventListener('mousedown',e=>{
    if(!active||paused||!locked())return;
    if(e.button===2){e.preventDefault();reloadCell();}
    else if(e.button===0){held=pressed=true;}
  });
  addEventListener('mouseup',e=>{if(e.button===0&&triggerPointer===null)held=false;});
  canvas.addEventListener('contextmenu',e=>{if(active)e.preventDefault();});
  fireButton.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();triggerDown(e);
    if(triggerPointer===e.pointerId)fireButton.setPointerCapture(e.pointerId);
  });
  fireButton.addEventListener('click',e=>{if(active&&!paused&&e.detail===0)pressed=true;});
  ui.querySelector('#pulse-reload').addEventListener('click',reloadCell);
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])addEventListener(ev,e=>{
    if(e.pointerId===triggerPointer){held=false;triggerPointer=null;if(ev==='pointercancel')pressed=false;}
  });
  addEventListener('keydown',e=>{
    if(!active||e.code!=='KeyR'||e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    reloadCell();
  });
  addEventListener('keydown',e=>{
    if(!active||e.target.closest?.('dialog[open]'))return;
    if(e.key==='Escape'||e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();pause();return;}
    if(paused&&!e.target.closest?.('input,select,textarea,button,[contenteditable="true"]')&&
      /^(Key[WASDCRFGX]|Arrow\w+|Shift(Left|Right)|Space)$/.test(e.code))e.stopImmediatePropagation();
  },true);
  addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('pointerlockerror',()=>{
    if(active&&lockRequest){pause();syncGate('마우스 고정을 허용한 뒤 다시 눌러 주세요.');}
  });
  document.addEventListener('pointerlockchange',()=>{
    if(locked()){
      if(!active||!lockRequest){document.exitPointerLock();return;}
      lockRequest=null;hadLock=true;play();
    }else if(hadLock){hadLock=false;pause();}
  });
  function enter() {
    build();placeStandColliders();active=group.visible=true;ui.hidden=false;
    ui.dataset.touch=(matchMedia('(any-pointer: coarse)').matches||navigator.maxTouchPoints)?'yes':'no';
    ActorWalk.beginFirstPerson(spawn.x,spawn.z,spawn.yaw);
    paused=hadLock=false;lockRequest=null;syncGate();
    held=pressed=false;triggerPointer=null;wave=1;hits=0;ammo=capacity;
    clock=cooldown=reload=hitTime=recoil=waveTime=0;
    for(const t of targets){t.live=t.face.visible=true;}
    for(const p of [...beams,...rings]){p.life=0;p.mesh.visible=false;}
    flash.visible=false;
  }
  function leave() {
    active=group.visible=false;ui.hidden=true;resetTrigger();
    paused=hadLock=false;lockRequest=null;Sound.setPaused(false);syncGate();
    for(const remove of standColliders)remove();
    standColliders.length=0;
    ActorWalk.endApproach();
  }
  function step(camera,dt) {
    ActorWalk.stepFirstPerson(camera,dt);camera.updateMatrixWorld(true);camera.getWorldDirection(direction);
    clock+=dt;cooldown=Math.max(0,cooldown-dt);hitTime=Math.max(0,hitTime-dt);recoil=Math.max(0,recoil-dt*7);
    if(reload>0){reload=Math.max(0,reload-dt);if(!reload)ammo=capacity;}
    if(waveTime>0){waveTime=Math.max(0,waveTime-dt);if(!waveTime){wave++;for(const t of targets)t.live=t.face.visible=true;}}
    for(let i=0;i<targets.length;i++){
      const t=targets[i];t.face.position.y=t.h+(wave>1?.27:.075)*Math.sin(clock*(.95+i*.14)+i);
      t.face.quaternion.copy(camera.quaternion);t.face.getWorldPosition(t.center);
    }
    view.position.copy(camera.position);view.quaternion.copy(camera.quaternion);
    const bob=.004*Math.sin(clock*2.1),reloadPose=reload?Math.sin(Math.PI*reload/reloadTime):0;
    const portrait=camera.aspect<1, side=portrait?.22*camera.aspect:.265;
    tool.scale.setScalar(portrait?.71:.86);
    tool.position.set(side,-.224+bob-reloadPose*.13,-.52+recoil*.047);
    tool.rotation.set(.09+recoil*.12-.67*reloadPose,.25,-.12-.32*reloadPose);
    for(let i=0;i<chargeLights.length;i++)chargeLights[i].visible=ammo>i*2;
    view.updateMatrixWorld(true);
    const aim=findTarget(camera);
    if((held||pressed)&&!reload&&cooldown<=0)shoot(camera,aim);
    pressed=false;flash.visible=recoil>.63;
    for(const beam of beams){beam.life-=dt;beam.mesh.visible=beam.life>0;}
    for(const pulse of rings)if(pulse.life>0){
      pulse.life=Math.max(0,pulse.life-dt);pulse.mesh.scale.setScalar(1.1+(1-pulse.life/.33)*2.1);
      pulse.mesh.quaternion.copy(camera.quaternion);pulse.mesh.visible=pulse.life>0;
    }
    reticle.classList.toggle('ready',aim.index>=0);reticle.classList.toggle('hit',hitTime>0);
    const text=reload?'재장전 중':ammo+' / '+capacity, report='명중 '+hits+' · 라운드 '+wave;
    if(count.textContent!==text)count.textContent=text;if(score.textContent!==report)score.textContent=report;
    return ui.dataset.touch==='yes'?'스틱 이동 · 드래그 조준 · 발사':'WASD 이동 · 좌클릭 발사 · 우클릭 재장전 · Space 점프 · Shift 달리기 · C 앉기 · Esc 일시정지';
  }
  Modes.add('fps',{name:'1인칭 사격',enter,leave,step},'Digit3','3');
  return {get paused(){return paused;},get ammo(){return ammo;},get hits(){return hits;},get wave(){return wave;},get reloading(){return reload>0;}};
})();
