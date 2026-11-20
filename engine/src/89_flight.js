'use strict';
// A taildragger on the coastal airstrip. World +Z is the runway's departure direction.
const Airfield = (() => {
  const strip = { x:-34, z:-560, halfWidth:13, halfLength:190, y:2.4 };
  const apron = { x:strip.x-17, z:strip.z-145, halfWidth:8, halfLength:22 };
  const field = new THREE.Group(), plane = new THREE.Group();
  const position = new THREE.Vector3(), look = new THREE.Vector3(), view = new THREE.Vector3();
  const previous = new THREE.Vector3(), sweep = new THREE.Vector3(), colliderCentre = new THREE.Vector3();
  const bodyHalf = new THREE.Vector3(.52,.47,2.7), wingHalf = new THREE.Vector3(3.90,.105,.52);
  const parkedSolids = [], gear = [];
  let removePole = null;
  const touch = new Set();
  let built = false, loading = false, propeller = null, fallback = null, sock = null;
  let active = false, phase = 'approach', heading = 0, pitch = 0, bank = 0;
  let speed = 0, throttle = 0, climb = 0, autoClimb = 0, recovery = 0, cameraReady = false;
  let boardDistance = Infinity, message = '', messageTime = 0;
  const isTouch = () => navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches;

  function onDeck(x,z,margin=0) {
    const runway = Math.abs(x-strip.x) <= strip.halfWidth-margin && Math.abs(z-strip.z) <= strip.halfLength-margin;
    const parking = Math.abs(x-apron.x) <= apron.halfWidth-margin && Math.abs(z-apron.z) <= apron.halfLength-margin;
    return runway || parking;
  }
  function floor(x,z) { return onDeck(x,z) ? strip.y : null; }
  const material = (color, roughness=.9) => new THREE.MeshStandardMaterial({color,roughness});
  function box(parent, width,height,length, x,y,z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width,height,length),mat);
    mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }

  function foundation(cx,cz,w,l) {
    const verts = [], tris = [];
    for (const [y,extra] of [[-3,5],[strip.y-.42,0]]) {
      for (const [sx,sz] of [[-1,-1],[-1,1],[1,1],[1,-1]]) {
        verts.push(cx+sx*(w+extra), y, cz+sz*(l+extra));
      }
    }
    for(let i=0;i<4;i++) {
      const j=(i+1)%4;
      tris.push(i,j+4,j, i,i+4,j+4);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); geo.setIndex(tris); geo.computeVertexNormals();
    const stone=new THREE.Mesh(geo, material(0x726e5f)); stone.material.side=THREE.DoubleSide; field.add(stone);
  }
  function runwayNumbers(text, z, angle) {
    const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=192;
    const ink=canvas.getContext('2d'); ink.fillStyle='#d9d4b7'; ink.textAlign='center';
    ink.font='bold 145px sans-serif'; ink.fillText(text,128,148);
    const map=new THREE.CanvasTexture(canvas); map.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(7.5,5.4),new THREE.MeshBasicMaterial({
      map,transparent:true,depthWrite:false,toneMapped:true
    }));
    mesh.rotation.set(-Math.PI/2,0,angle); mesh.position.set(strip.x,strip.y+.018,z); field.add(mesh);
  }
  function makeStrip() {
    const asphalt=material(0x434548), paint=material(0xd3cdb4);
    foundation(strip.x,strip.z,strip.halfWidth,strip.halfLength);
    foundation(apron.x,apron.z,apron.halfWidth,apron.halfLength);
    box(field,26,.42,380,strip.x,strip.y-.21,strip.z,asphalt);
    box(field,16,.42,44,apron.x,strip.y-.214,apron.z,asphalt);
    const marks=[];
    for (let z=-144;z<=144;z+=18) marks.push([0,z,.30,7.5]);
    for (const side of [-1,1]) {
      marks.push([12*side,0,.16,371]);
      for (const end of [-1,1]) {
        for(let n=1;n<=4;n++) marks.push([side*(1.25+1.3*n),end*178,.70,9.5]);
        marks.push([side*8.6,end*144,.95,11]);
      }
    }
    const stripes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.012,1),paint,marks.length);
    const stamp=new THREE.Object3D();
    marks.forEach(([x,z,w,l],i) => {
      stamp.position.set(strip.x+x,strip.y+.006,strip.z+z); stamp.scale.set(w,1,l);
      stamp.updateMatrix(); stripes.setMatrixAt(i,stamp.matrix);
    });
    stripes.receiveShadow=true; field.add(stripes);
    runwayNumbers('18',strip.z-161,Math.PI); runwayNumbers('36',strip.z+161,0);
    const lenses=[];
    for (let z=-180;z<=180;z+=30) for (const side of [-1,1]) lenses.push([side*13.5,z]);
    const lights=new THREE.InstancedMesh(new THREE.SphereGeometry(.13,6,4),
      new THREE.MeshStandardMaterial({color:0xffe0a6,emissive:0xeeb874,emissiveIntensity:1.3}),lenses.length);
    stamp.scale.set(1,1,1);
    lenses.forEach(([x,z],i)=>{ stamp.position.set(strip.x+x,strip.y-.02,strip.z+z); stamp.updateMatrix(); lights.setMatrixAt(i,stamp.matrix); });
    field.add(lights);

    const poleX=apron.x-5.0,poleZ=apron.z-14;
    box(field,.09,4.8,.09,poleX,strip.y+2.4,poleZ, material(0x9c9790));
    sock=new THREE.Group(); sock.position.set(poleX,strip.y+4.65,poleZ); field.add(sock);
    for (let i=0;i<5;i++) {
      const taper=new THREE.Mesh(new THREE.CylinderGeometry(.34-i*.045,.34-(i+1)*.045,.45,10,1,true),material(i%2?0xe2dcc8:0xba4526));
      taper.rotation.z=Math.PI/2; taper.position.x=.225+i*.45; sock.add(taper);
    }
    sock.rotation.y=.73; sock.rotation.z=-.14;
  }
  function placeholder() {
    const group=new THREE.Group(), red=material(0xb23d20,.51), pale=material(0xdfc99f,.6), rubber=material(0x282924);
    const body=new THREE.Mesh(new THREE.SphereGeometry(1,18,10),red);
    body.position.y=1.63; body.scale.set(.66,.63,3.1); group.add(body);
    box(group,7.6,.15,1.12,0,1.31,.32,pale);
    box(group,2.8,.1,.73,0,1.42,-2.45,pale); box(group,.12,1.02,.82,0,1.93,-2.46,red);
    for(const x of [-.86,.86]) {
      box(group,.09,1.04,.09,x,.81,.71,pale);
      const tire=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.16,12),rubber);
      tire.rotation.z=Math.PI/2; tire.position.set(x,.32,.71); group.add(tire);
    }
    group.traverse(o=>{ if(o.isMesh) o.castShadow=o.receiveShadow=true; });
    return group;
  }
  async function loadPlane() {
    if (loading || plane.userData.original) return;
    const asset=window.GARDEN_SAMPLES?.find(item=>item.id==='stunt-plane');
    if(!asset) return;
    loading=true;
    try {
      const {scene}=await window.createGardenGLTFLoader(THREE).loadAsync(asset.file);
      scene.traverse(o=>{ if(o.isMesh) o.castShadow=o.receiveShadow=true; });
      const bounds=new THREE.Box3().setFromObject(scene,true);
      scene.position.y-=bounds.min.y;
      // The source is a taildragger exported in level flight. At rest its main and
      // tail wheel bottoms share a plane pitched 12.39 degrees to the model axes.
      const profile=new Map();
      scene.traverse(mesh=>{
        const vertices=mesh.geometry?.getAttribute('position');
        if(!vertices) return;
        for(let i=0;i<vertices.count;i++) {
          const y=vertices.getY(i), z=vertices.getZ(i);
          if((y<.32 && z>1.8) || (y<1.3 && z<-2.3)) profile.set(z,Math.min(y,profile.get(z)??Infinity));
        }
      });
      gear.push(...profile.entries());
      const blades=scene.getObjectByName('Prop');
      if(blades) {
        // FBX export baked the blade vertices in fuselage space. Rotate about the actual hub.
        propeller=new THREE.Group(); propeller.position.set(0,1.623224,3.89);
        scene.add(propeller); propeller.attach(blades);
      }
      plane.add(scene); plane.userData.original=true;
      if(fallback) {
        fallback.removeFromParent();
        const materials=new Set();
        fallback.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material);}});
        for(const m of materials)m.dispose();
        fallback=null;
      }
      sync();
      if(active && phase==='approach') addParkedSolids();
    } catch(e) { console.warn('Airfield display uses the reserve aircraft',e); }
    finally { loading=false; }
  }

  const controls=document.createElement('div'); controls.id='airfield-controls'; controls.hidden=true;
  controls.setAttribute('aria-label','경비행기 조종');
  controls.innerHTML='<button type="button" data-act="board">비행기 탑승 (E)</button><div id="airfield-power"><button type="button" data-act="more">출력 +</button><button type="button" data-act="less">출력 −</button><button type="button" data-act="brake">브레이크</button><button type="button" data-act="reset">활주로 복귀</button></div>';
  const style=document.createElement('style');
  style.textContent='#airfield-controls{position:fixed;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(70px + env(safe-area-inset-bottom,0px));z-index:6;display:grid;gap:6px;justify-items:end;pointer-events:none}#airfield-controls[data-phase="approach"]{bottom:calc(176px + env(safe-area-inset-bottom,0px))}#airfield-controls[hidden],#airfield-controls [hidden]{display:none}#airfield-power{display:grid;grid-template-columns:auto auto;gap:5px}#airfield-controls button{min-height:40px;padding:6px 10px;color:#fff0da;background:#251f18eb;border:1px solid #f4deb66b;border-radius:9px;font:600 12px system-ui;cursor:pointer;pointer-events:auto;touch-action:none;user-select:none}#airfield-controls [data-act="board"]{background:#e5bf7e;color:#251b0a}#airfield-controls [data-act="board"]:disabled{opacity:.7}';
  document.head.append(style); document.body.append(controls);
  const boardButton=controls.querySelector('[data-act=board]'), powerButtons=controls.querySelector('#airfield-power');
  function refreshUI() {
    if (!active) return;
    const walking=phase==='approach', stopped=phase==='taxi'&&speed<1.3;
    controls.dataset.phase=phase; boardButton.hidden=!walking&&!stopped;
    boardButton.disabled=walking&&boardDistance>2.8;
    const text=walking ? (boardDistance<=2.8?'비행기 탑승 (E)':'비행기로 걸어가기') : '비행기에서 내리기 (E)';
    if(boardButton.textContent!==text) boardButton.textContent=text;
    powerButtons.hidden=walking || !isTouch();
  }
  const tag = act => controls.querySelector('[data-act="'+act+'"]');
  for (const act of ['more','less','brake']) {
    const el=tag(act);
    el.addEventListener('pointerdown',e=>{
      if(e.button!==0) return;
      e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); touch.add(act);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']) el.addEventListener(type,()=>touch.delete(act));
  }
  addEventListener('blur',()=>touch.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)touch.clear();});
  for(const [button,act] of [[boardButton,boardOrLeave],[tag('reset'),restart]]) {
    button.addEventListener('pointerdown',e=>{
      if(e.button!==0) return;
      e.preventDefault(); e.stopPropagation(); act();
    });
    button.addEventListener('click',e=>{if(e.detail===0)act();button.blur();});
  }
  addEventListener('keydown', e=>{
    if(!active || e.metaKey || e.altKey || e.ctrlKey || /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&phase!=='approach') e.preventDefault();
    if(e.repeat) return;
    if(e.code==='KeyE') boardOrLeave();
    if(e.code==='KeyR') restart();
  });

  function resetPlane() {
    position.set(strip.x,strip.y,strip.z-145);
    heading=pitch=bank=speed=throttle=climb=autoClimb=recovery=0; cameraReady=false;
    sync();
  }
  function sync() {
    let deckPitch=0, offset=0;
    if(phase==='approach'||phase==='taxi') {
      deckPitch=.21628122*(1-sm(2,17,speed));
      if(gear.length) {
        const cs=Math.cos(deckPitch),sn=Math.sin(deckPitch);
        let bottom=Infinity;
        for(const [z,y] of gear) bottom=Math.min(bottom,y*cs+z*sn);
        offset=-bottom;
      }
    }
    plane.position.copy(position); plane.position.y+=offset;
    plane.rotation.set(-pitch-deckPitch,heading,bank,'YXZ');
  }
  function removeParkedSolids() {
    for(const remove of parkedSolids) remove?.();
    parkedSolids.length=0;
  }
  function addParkedSolids() {
    removeParkedSolids(); plane.updateMatrixWorld(true);
    for(const [x,y,z,w,h,l] of [[0,1.59,.48,1.1,1.27,4.45],[0,1.55,1.01,7.85,.24,1.34],[0,1.89,-2.64,3.25,.29,.85]]) {
      colliderCentre.set(x,y,z);plane.localToWorld(colliderCentre);
      parkedSolids.push(Phys.box(colliderCentre,new THREE.Vector3(w,h,l),heading));
    }
  }
  function hitsSolid() {
    sweep.subVectors(position,previous);
    if(sweep.lengthSq()<1e-9) return false;
    for(const [half,y,z] of [[wingHalf,1.55,1.02],[bodyHalf,1.68,.32]]) {
      colliderCentre.set(0,y,z).applyQuaternion(plane.quaternion).add(plane.position);
      if(Phys.castBox(colliderCentre,half,plane.quaternion,sweep)) return true;
    }
    return false;
  }
  function approach(start) {
    phase='approach'; WalkStick.setActive(false);
    sync(); addParkedSolids();
    let x,z,yaw;
    if(start) { x=position.x-4.4; z=position.z-5.4; yaw=-2.64; }
    else {
      x=position.x-3.3*Math.cos(heading); z=position.z+3.3*Math.sin(heading);
      if(!onDeck(x,z,.35)) { x=strip.x; z=clamp(position.z,strip.z-strip.halfLength+4,strip.z+strip.halfLength-4); }
      yaw=Math.atan2(x-position.x,z-position.z);
    }
    ActorWalk.beginApproach(x,z,yaw,floor);
    boardingRange(); refreshUI();
  }
  function boardingRange() {
    const x=ActorWalk.position.x-position.x, z=ActorWalk.position.z-position.z;
    // Door on either side of the cockpit; the propeller and tail do not enable boarding.
    const side=x*Math.cos(heading)-z*Math.sin(heading), along=x*Math.sin(heading)+z*Math.cos(heading);
    boardDistance=Math.hypot(Math.abs(side)-1.45,along+.55);
  }
  function boardOrLeave() {
    if(!active) return;
    if(phase==='approach') {
      boardingRange();
      if(boardDistance>2.8) return;
      ActorWalk.endApproach(); removeParkedSolids(); phase='taxi'; WalkStick.setActive(true); cameraReady=false; messageTime=0;
    } else if(phase==='taxi' && speed<1.3) {
      throttle=speed=0; approach(false);
    }
    refreshUI();
  }
  function restart() {
    if(!active) return;
    if(phase==='approach') ActorWalk.endApproach();
    touch.clear(); resetPlane(); messageTime=0; approach(true);
  }
  function enter() {
    if(!built) {
      built=true; field.name='coastal-airfield'; plane.name='piloted-stunt-plane';
      makeStrip(); fallback=placeholder(); plane.add(fallback); field.add(plane); G.scene.add(field);
    }
    active=true; field.visible=true; controls.hidden=false;
    removePole=Phys.box(new THREE.Vector3(apron.x-5,strip.y+2.4,apron.z-14),new THREE.Vector3(.14,4.8,.14),0);
    loadPlane(); restart();
  }
  function leave() {
    if(phase==='approach') ActorWalk.endApproach();
    removeParkedSolids(); removePole?.(); removePole=null;
    WalkStick.setActive(false); touch.clear();
    active=false; field.visible=false; controls.hidden=true;
  }
  function recover(reason) {
    phase='recover'; recovery=1.25; throttle=0; speed=0; message=reason; messageTime=2;
    WalkStick.setActive(false);
  }
  function piloting(dt) {
    previous.copy(position);
    const keys=Modes.keys;
    const power=Number(keys.has('KeyW')||touch.has('more'))-Number(keys.has('KeyS')||touch.has('less'));
    const stickX=clamp(WalkStick.x+Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),-1,1);
    const stickY=clamp(WalkStick.y+Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')),-1,1);
    const brakes=keys.has('Space')||touch.has('brake');
    throttle=clamp(throttle+power*(power>0?.47:.70)*dt);
    const grounded=phase==='taxi';
    if(brakes&&grounded) throttle=Math.max(0,throttle-1.1*dt);
    const drag=(grounded?.63:0)+.00195*speed*speed;
    speed=clamp(speed+(throttle*8.4-drag-(brakes&&grounded?9.5:0))*dt,0,75);
    if(propeller) propeller.rotation.z-=dt*(7+throttle*67);
    if(grounded) {
      heading-=stickX*sm(.15,4,speed)*lerp(.83,.21,sm(5,23,speed))*dt;
      if((speed>=18.8&&stickY>.18&&throttle>.18)||(speed>=25&&stickY>=-.05&&throttle>.65)){
        phase='flight'; climb=2.8; pitch=.105; autoClimb=2.2;
      }
    } else {
      bank+=(stickX*.93-bank)*(1-Math.exp(-dt*2.7));
      const liftAssist=Math.max(0,autoClimb/2.2)*.12;
      autoClimb=Math.max(0,autoClimb-dt);
      pitch+=(stickY*(stickY>0?.52:.40)+liftAssist-pitch)*(1-Math.exp(-dt*2.3));
      heading-=Math.tan(bank)*11.5/Math.max(13,speed)*dt;
      const vertical=speed*Math.sin(pitch)-Math.max(0,19-speed)*.87-Math.abs(bank)*.46;
      climb+=(vertical-climb)*(1-Math.exp(-dt*2.0));
      position.y+=climb*dt;
    }
    position.x+=Math.sin(heading)*speed*Math.cos(pitch)*dt;
    position.z+=Math.cos(heading)*speed*Math.cos(pitch)*dt;
    if(hitsSolid()) {
      position.copy(previous); recover('장애물 접촉');
    } else if(phase==='taxi') {
      position.y=strip.y;
      if(!onDeck(position.x,position.z,.55)) recover('활주로 이탈');
    } else if(phase==='flight') {
      const deck=onDeck(position.x,position.z,.45);
      let terrain=Island.surf(position.x,position.z)[0];
      if(!deck&&Math.abs(position.y-terrain)<6) terrain=Island.support(position.x,position.z);
      const surface=deck?strip.y:Math.max(CFG.sea.level,terrain);
      if(climb<=0 && position.y<=surface+.035) {
        if(deck&&Math.abs(bank)<.46&&climb>-5.6&&speed<39) {
          position.y=strip.y; phase='taxi'; bank=pitch=climb=0;
          throttle=Math.min(throttle,.21); message='착륙 완료 · 브레이크로 정지'; messageTime=3.5;
        } else { recover(deck?'착륙 자세를 다시 맞추세요':'비상 착수·착지'); }
      } else if(!deck&&position.y<surface-.25) { recover('지면 접촉'); }
    }
    sync();
  }
  function cameraFollow(camera,dt) {
    const distance=camera.aspect<1?15.3:11.3;
    const x=Math.sin(heading), z=Math.cos(heading);
    view.set(position.x-distance*x,position.y+(phase==='flight'?3.8:3.05),position.z-distance*z);
    if(!onDeck(view.x,view.z)) view.y=Math.max(view.y,Island.surf(view.x,view.z)[0]+1.1);
    if(!cameraReady) { camera.position.copy(view); cameraReady=true; } else camera.position.lerp(view,1-Math.exp(-dt*6));
    look.set(position.x+x*5,position.y+1.8+pitch*4.4,position.z+z*5);
    camera.lookAt(look); camera.fov=camera.aspect<1?61:56+4*sm(10,50,speed); camera.near=.15;
  }
  function step(camera,dt) {
    sock.rotation.z=-.15+.055*Math.sin(G.t*2.4); sock.rotation.y=.72+.12*Math.sin(G.t*.53);
    if(phase==='approach') {
      ActorWalk.stepApproach(camera,dt); boardingRange(); refreshUI();
      return boardDistance<=2.8?'조종석 옆 · E 또는 탑승 버튼':'비행기로 걸어가기 · '+Math.ceil(boardDistance)+' m';
    }
    if(phase==='recover') {
      recovery-=dt;
      if(recovery<=0) { restart(); return '활주로로 복귀했습니다'; }
    } else piloting(dt);
    cameraFollow(camera,dt); refreshUI(); messageTime=Math.max(0,messageTime-dt);
    if(phase==='recover') return message+' · 활주로 복귀 중';
    const kmh=Math.round(speed*3.6), stats=kmh+' km/h · 출력 '+Math.round(throttle*100)+'%';
    if(phase==='taxi') return (messageTime>0?message:(isTouch()?'활주 · 출력 + · 스틱 ↑ 이륙':'활주 · W/S 출력 · ↑ 이륙 · Space 제동'))+' · '+stats;
    const dx=strip.x-position.x, dz=strip.z-position.z;
    const delta=Math.atan2(Math.sin(heading-Math.atan2(dx,dz)),Math.cos(heading-Math.atan2(dx,dz)))*180/Math.PI;
    const path=Math.round(Math.hypot(dx,dz))+' m '+(Math.abs(delta)<8?'정면':(delta>0?'오른쪽 ':'왼쪽 ')+Math.round(Math.abs(delta))+'°');
    return stats+' · 고도 '+Math.round(position.y-strip.y)+' m · 활주로 '+path+
      (isTouch()?'':'\nA/D 선회 · ↑/↓ 기수 · W/S 출력 · R 활주로 복귀');
  }
  Modes.add('flight',{name:'경비행기',enter,leave,step},'Digit5','5');
  return { get state(){return {phase,speed,throttle,heading,pitch,bank,climb,position:position.toArray(),boardDistance};} };
})();
