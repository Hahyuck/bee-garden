'use strict';
const ActorWalk = (() => {
  const group = new THREE.Group();
  const feet = new THREE.Vector3();
  const target = new THREE.Vector3(), eye = new THREE.Vector3(), ray = new THREE.Vector3();
  const probe = new THREE.Vector3(), down = new THREE.Vector3(0,-1,0), up = new THREE.Vector3(0,1,0);
  const walkSpeed = 1.85, runSpeed = 4.15, crouchSpeed = .86;
  const gravity = 12.8, takeoffSpeed = 5.15, windup = .08, recovery = .16;
  let player = null;
  let active = false, placed = false, azimuth = 0, pitch = .27, facing = 0;
  let orbitPointer = null, pointerX = 0, pointerY = 0, cameraReady = false;
  let selectedHuman = null, humanVersion = 0, pendingHuman = null, status = '';
  let jumpStage = 'ground', stageTime = 0, verticalSpeed = 0;
  let capsuleHeight = 1.71, capsuleRadius = .26, crouchActive = false;
  let supportY = 0, jumpPressed = false, lowCamera = 0, fastCamera = 0;
  let firstPerson = false, savedWalk = null, extraFloor = null;
  let climbing=false,climbPhase=0,regrabDelay=0;
  const wallDir=new THREE.Vector3(),ledge=new THREE.Vector3(),reachPoint=new THREE.Vector3();
  function climbClip(model,clips){
    const authored=clips.find(c=>/climb/i.test(c.name));if(authored)return authored;
    const tracks=[],times=[0,.125,.25,.375,.5,.625,.75,.875,1],rot=new THREE.Quaternion(),e=new THREE.Euler();
    model.traverse(b=>{
      if(!b.isBone)return;
      const limb=b.name.match(/(Left|Right)(UpLeg|Leg|ForeArm|Arm)$/i);if(!limb)return;
      const sign=limb[1].toLowerCase()==='left'?1:-1,values=[];
      for(const t of times){
        const w=sign*Math.cos(t*TAU);
        switch(limb[2].toLowerCase()){
          case 'arm':e.set(2.15+.48*w,0,sign*.92);break;
          case 'forearm':e.set(0,-sign*(.78-.38*w),0);break;
          case 'upleg':e.set(.72-.41*w,0,sign*.10);break;
          case 'leg':e.set(-1.05+.45*w,0,0);break;
        }
        values.push(...rot.setFromEuler(e).toArray());
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(b.uuid+'.quaternion',times,values));
    });
    return new THREE.AnimationClip('WallClimb',1,tracks);
  }
  function surface(x,z) {
    const y = Island.support(x,z), extra = extraFloor?.(x,z);
    return Number.isFinite(extra) ? Math.max(y,extra) : y;
  }

  function characterActions(mixer, clips, entry) {
    const names = {idle:'TrailIdle', walk:'TrailWalk', run:'TrailRun', jump:'TrailJump',
      crouch:'TrailCrouch', crouchWalk:'TrailCrouchWalk'};
    const actions = {};
    for (const [key,name] of Object.entries(names)) {
      let clip = THREE.AnimationClip.findByName(clips,name);
      if(entry?.species==='frog'){
        const idle=key==='idle'||key==='crouch';
        clip=THREE.AnimationClip.findByName(clips,idle?'CreekIdle':'CreekHop')?.clone();
      }else if(!clip && entry?.custom){
        const aliases={idle:/idle|stand|rest/i,walk:/walk/i,run:/run|jog|walk/i,jump:/jump|leap/i,crouch:/crouch.?idle|squat|crouch$/i,crouchWalk:/crouch.*walk|sneak|walk/i};
        const usable=clips.find(a=>aliases[key].test(a.name)) || clips.find(a=>aliases.idle.test(a.name));
        clip=usable?.clone() || new THREE.AnimationClip(name,1,[]);
      }
      if (!clip) throw new Error('Missing character animation: ' + name);
      actions[key] = mixer.clipAction(clip).setEffectiveWeight(key === 'idle' ? 1 : 0).play();
    }
    actions.jump.setEffectiveTimeScale(0);
    return actions;
  }

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

  async function loadActor(entry) {
    const kind=entry?.species==='frog'?'frog':'human';
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
    const actions=characterActions(mixer,animations,entry);
    const climbingClip=climbClip(model,animations);
    actions.climb=mixer.clipAction(climbingClip).setEffectiveWeight(0).play();
    actions.climb.setEffectiveTimeScale(0);
    mixer.update(0);
    const soles = Footing.bind(model);
    return { holder, model, mixer, actions, entry, kind, motion, soles, fresh: true,
      scaleY:model.scale.y,baseY:model.position.y,approxCrouch:(entry?.custom||kind==='frog')&&!animations.some(a=>/crouch|squat|sneak/i.test(a.name))};
  }

  function install(actor) {
    release(player);player=actor;
    actor.holder.visible=!firstPerson;
    actor.holder.position.copy(feet);actor.holder.rotation.y=facing;group.add(actor.holder);
    G.info.actorModels=[{kind:actor.kind,id:actor.entry?.id||actor.kind,clip:actor.motion?.name||''}];
  }

  async function swapHuman(entry, version) {
    status = '캐릭터를 불러오는 중';
    try {
      const actor = await loadActor(entry);
      if (version !== humanVersion) { release(actor); return false; }
      install(actor); status = '';
      return true;
    } catch (error) {
      if (version === humanVersion) {
        selectedHuman = player?.entry || null;
        WalkActions.setCharacter(selectedHuman?.id || 'kate');
        status = '캐릭터를 불러오지 못했습니다. 캐릭터 변경에서 다시 선택하세요.';
        console.error('Character model', error);
      }
      return false;
    } finally {
      if (version === humanVersion) pendingHuman = null;
    }
  }
  function selectHuman(entry = null) {
    const id = entry?.id || 'kate';
    WalkActions.setCharacter(id);
    if (pendingHuman?.id === id) return pendingHuman.promise;
    const version = ++humanVersion;
    selectedHuman = entry;
    if (player && player.entry?.id === entry?.id) {
      status = ''; pendingHuman = null; return Promise.resolve(true);
    }
    const promise = swapHuman(entry, version);
    pendingHuman = {id, promise};
    return promise;
  }

  function stopOrbit() {
    const id = orbitPointer; orbitPointer = null;
    if (id !== null && G.R?.domElement.hasPointerCapture(id)) G.R.domElement.releasePointerCapture(id);
  }
  addEventListener('pointerdown', e => {
    if (!active || e.target !== G.R.domElement || orbitPointer !== null || e.button !== 0) return;
    if (firstPerson && (e.pointerType==='mouse' || PulseRange.paused)) return;
    orbitPointer = e.pointerId; pointerX = e.clientX; pointerY = e.clientY;
    if (!firstPerson || e.pointerType !== 'mouse') e.target.setPointerCapture(e.pointerId);
  });
  const canvas=document.getElementById('c');
  let mouseX=null,mouseY=0,edgeYaw=0,edgePitch=0;
  function resetMouse(){mouseX=null;edgeYaw=edgePitch=0;}
  // Screen coordinates also work in embedded browsers where pointer lock is unavailable.
  function edgeSpeed(fraction){
    const axis=2*fraction-1;
    return Math.sign(axis)*sm(.82,1,Math.abs(axis));
  }
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse'||!active||!firstPerson||PulseRange.paused)return;
    if(mouseX!==null){
      azimuth-=(e.clientX-mouseX)*.0026;pitch=clamp(pitch-(e.clientY-mouseY)*.0026,-1.34,1.34);
    }
    mouseX=e.clientX;mouseY=e.clientY;
    const rect=canvas.getBoundingClientRect();
    edgeYaw=edgeSpeed((mouseX-rect.left)/rect.width);edgePitch=edgeSpeed((mouseY-rect.top)/rect.height);
  });
  canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')resetMouse();});
  document.addEventListener('focusin',resetMouse);
  addEventListener('pointermove', e => {
    if (e.pointerId !== orbitPointer) return;
    azimuth -= (e.clientX - pointerX) * .006;
    const dy=e.clientY-pointerY;
    pitch = firstPerson ? clamp(pitch-dy*.004,-1.34,1.34) : clamp(pitch+dy*.004,-.06,.92);
    pointerX = e.clientX; pointerY = e.clientY;
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture'])
    addEventListener(event, e => { if (e.pointerId === orbitPointer) stopOrbit(); });
  function clearInput() { stopOrbit();resetMouse();jumpPressed = false; }
  addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  addEventListener('keydown', e => {
    if (!active || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    if (e.target.closest?.('input,select,textarea,button,a,[contenteditable="true"]')) return;
    if (e.code !== 'Space' && e.code !== 'KeyC') return;
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Space') jumpPressed = true;
    else WalkActions.toggleCrouch();
  });

  function enter() {
    if (!group.parent) G.scene.add(group);
    active = group.visible = true; cameraReady = false;
    if (!placed) {
      placed = true; facing = azimuth = -2.68;
      feet.set(Island.GP.x + 4, 0, Island.GP.z + 5);
      feet.y = surface(feet.x,feet.z);
    }
    supportY = feet.y;
    if (player) player.holder.visible = !firstPerson;
    WalkStick.setActive(true); WalkActions.setActive(true);
    WalkActions.setCharacter(selectedHuman?.id || 'kate');
    if (!player) selectHuman(selectedHuman);
  }
  function leave() {
    climbing=false;
    active = group.visible = false;
    Phys.stopPlayer(); crouchActive=false;
    clearInput(); WalkStick.setActive(false); WalkActions.setActive(false);
    if (jumpStage !== 'ground') feet.y = supportY;
    jumpStage = 'ground'; stageTime = verticalSpeed = lowCamera = fastCamera = 0;
    if (player) player.fresh = true;
  }

  function floorAt(x, z, from) {
    const terrain = surface(x,z);
    if (terrain >= from) return terrain;
    probe.set(x,from,z);
    const hit = Phys.ray(probe,down,from-terrain+.03,true);
    return hit && hit.t > .001 && hit.y > terrain+.012 ? hit.y : terrain;
  }
  function stanceFloor(x,z,from) {
    const terrain=surface(x,z), reach=from-terrain+.03;
    if (reach<=0) return terrain;
    let height=terrain;
    // A foot can rest on a tread before the hips cross its edge. The outline keeps
    // the same support when moving sideways, stopping, or changing direction.
    for (let i=0;i<9;i++) {
      const r=i===8 ? 0 : capsuleRadius+.02, angle=i*Math.PI/4;
      probe.set(x+r*Math.cos(angle),from,z+r*Math.sin(angle));
      const hit=Phys.ray(probe,down,reach,true);
      if (hit && hit.t>.001) height=Math.max(height,hit.y);
    }
    return height;
  }

  const sweepFeet=new THREE.Vector3(), travel=new THREE.Vector3();
  function tryMove(dx,dz,slide=true) {
    const distance=Math.hypot(dx,dz);
    if (distance<.00001) return 0;
    const airborne=jumpStage==='air', x=feet.x+dx, z=feet.z+dz;
    const y=airborne ? floorAt(x,z,feet.y+.13) : stanceFloor(x,z,feet.y+.265), rise=y-feet.y;
    const stepLimit=Math.max(.26,distance*.95);
    if (y<CFG.sea.level+.08 || (airborne ? rise>.12 : Math.abs(rise)>stepLimit)) return 0;
    sweepFeet.copy(feet);
    if (!airborne && rise>0) {
      sweepFeet.y+=rise;
      if (!Phys.headroom(sweepFeet,capsuleHeight,capsuleRadius)) return 0;
    }
    travel.set(dx,0,dz);
    const hit=Phys.castPlayer(sweepFeet,capsuleHeight,capsuleRadius,travel);
    const fraction=hit ? clamp(hit.t-.001/distance) : 1;
    feet.x+=dx*fraction; feet.z+=dz*fraction;
    if (!airborne) feet.y=stanceFloor(feet.x,feet.z,feet.y+.265);
    if (!hit || !slide || fraction>=1) return distance*fraction;
    const n=hit.normal, length=Math.hypot(n.x,n.z);
    if (length<.001) return distance*fraction;
    const nx=n.x/length, nz=n.z/length, inward=Math.min(0,dx*nx+dz*nz);
    return distance*fraction+tryMove((dx-nx*inward)*(1-fraction),(dz-nz*inward)*(1-fraction),false);
  }
  function moveHorizontal(dt, speed) {
    const keys = Modes.keys;
    let x = WalkStick.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    let z = WalkStick.y + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    if(x===0&&z===0)return 0;
    const length = Math.max(1, Math.hypot(x,z));
    x /= length; z /= length;
    const yaw=VisualStyle.walkYaw()??azimuth,cosine=Math.cos(yaw),sine=Math.sin(yaw);
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
    return dt > 0 ? distance/dt : 0;
  }

  function stepJump(dt) {
    stageTime += dt;
    supportY = jumpStage==='air' ? floorAt(feet.x,feet.z,feet.y+.13) : stanceFloor(feet.x,feet.z,feet.y+.265);
    if (jumpStage === 'windup') {
      if (stageTime < windup) return;
      dt = stageTime-windup;
      jumpStage = 'air'; stageTime = 0; verticalSpeed = takeoffSpeed;
    }
    if (jumpStage === 'air') {
      const rise = verticalSpeed*dt - .5*gravity*dt*dt;
      const hit=rise && Phys.castPlayer(feet,capsuleHeight,capsuleRadius,travel.set(0,rise,0));
      if (hit) {
        feet.y+=rise*clamp(hit.t);
        verticalSpeed=0;
        if (rise<0) { supportY=feet.y; jumpStage='land'; stageTime=0; }
        return;
      }
      verticalSpeed -= gravity*dt;
      feet.y += rise;
      if (verticalSpeed <= 0 && feet.y <= supportY) {
        feet.y = supportY; jumpStage = 'land'; stageTime = verticalSpeed = 0;
      }
    } else {
      feet.y = supportY;
      if (jumpStage === 'land' && stageTime >= recovery) jumpStage = 'ground';
    }
  }

  function touchesWall(dir,height){
    const reach=capsuleRadius+.23;
    reachPoint.copy(feet).addScaledVector(dir,reach);reachPoint.y=feet.y+height;
    if(surface(reachPoint.x,reachPoint.z)>reachPoint.y+.02)return true;
    probe.copy(feet);probe.y=reachPoint.y;
    return !!Phys.ray(probe,dir,reach,true);
  }
  function forwardInput(){
    return WalkStick.y+Number(Modes.keys.has('KeyW')||Modes.keys.has('ArrowUp'))-Number(Modes.keys.has('KeyS')||Modes.keys.has('ArrowDown'));
  }
  function canGrab(){
    if(Modes.cur!=='actors'||forwardInput()<.2)return false;
    const yaw=VisualStyle.walkYaw()??azimuth;wallDir.set(-Math.sin(yaw),0,-Math.cos(yaw));
    return touchesWall(wallDir,.5*capsuleHeight)&&touchesWall(wallDir,1.24);
  }
  function climbStep(dt,release){
    if(release){climbing=false;regrabDelay=.55;jumpStage='air';verticalSpeed=0;return;}
    const input=clamp(forwardInput(),-1,1),dy=input*1.58*dt;
    facing=Math.atan2(-wallDir.x,-wallDir.z);
    if(input<0&&feet.y<=stanceFloor(feet.x,feet.z,feet.y+.08)+.03){climbing=false;jumpStage='ground';return;}
    // Inspect the top before a pull-up. Both the landing space and the path to it must be clear.
    ledge.copy(feet).addScaledVector(wallDir,capsuleRadius*2+.27);
    const top=floorAt(ledge.x,ledge.z,feet.y+.42);
    if(input>0&&!touchesWall(wallDir,.43)&&top>=feet.y-.14&&top<=feet.y+.39){
      ledge.y=Math.max(feet.y,top)+.035;
      sweepFeet.copy(feet);sweepFeet.y=ledge.y;
      travel.subVectors(ledge,sweepFeet);
      if(Phys.headroom(ledge,capsuleHeight,capsuleRadius)&&!Phys.castPlayer(feet,capsuleHeight,capsuleRadius,travel.set(0,ledge.y-feet.y,0))&&
          !Phys.castPlayer(sweepFeet,capsuleHeight,capsuleRadius,travel.subVectors(ledge,sweepFeet))){
        feet.copy(ledge);feet.y=top;supportY=top;climbing=false;jumpStage='ground';return;
      }
    }
    if(!touchesWall(wallDir,.12)&&!touchesWall(wallDir,.55)){climbing=false;jumpStage='air';verticalSpeed=0;return;}
    if(dy&&!Phys.castPlayer(feet,capsuleHeight,capsuleRadius,travel.set(0,dy,0))){
      feet.y+=dy;climbPhase=(climbPhase+dy*.65+1)%1;
    }
    supportY=feet.y;
  }

  const footprintGround=(x,z)=>floorAt(x,z,feet.y+.205);
  function animateHuman(dt, speed, crouched) {
    const actor = player, a = actor.actions;
    const moving = sm(.025,.58,speed), running = sm(walkSpeed,runSpeed,speed);
    const jumping = jumpStage !== 'ground';
    let jumpPhase = 0;
    if (jumpStage === 'windup') jumpPhase = .12 * stageTime/windup;
    if (jumpStage === 'air') jumpPhase = .12 + .68 * clamp((takeoffSpeed-verticalSpeed)/(2*takeoffSpeed));
    if (jumpStage === 'land') jumpPhase = .8 + .2 * clamp(stageTime/recovery);
    const groundedWeight = jumping ? 0 : 1;
    const targets = {
      climb:climbing?1:0,
      jump: 1-groundedWeight,
      idle: groundedWeight * (crouched ? 0 : 1-moving),
      walk: groundedWeight * (crouched ? 0 : moving*(1-running)),
      run: groundedWeight * (crouched ? 0 : moving*running),
      crouch: groundedWeight * (crouched ? 1-moving : 0),
      crouchWalk: groundedWeight * (crouched ? moving : 0)
    };
    const blend = actor.fresh ? 1 : 1-Math.exp(-dt*(jumping ? 32 : 18));
    for (const key of Object.keys(targets)) {
      const current = a[key].getEffectiveWeight();
      const weight=climbing&&key!=='climb'?0:targets[key];
      a[key].setEffectiveWeight(current+(weight-current)*blend);
    }
    if (jumping) a.jump.time = jumpPhase*a.jump.getClip().duration;
    if (climbing) a.climb.time=climbPhase*a.climb.getClip().duration;
    a.walk.setEffectiveTimeScale(Math.min(1.7,1.5*speed/walkSpeed));
    a.run.setEffectiveTimeScale(Math.min(1.3,speed/runSpeed));
    a.crouchWalk.setEffectiveTimeScale(Math.min(1.3,speed/crouchSpeed));
    actor.fresh = false;
    actor.holder.position.copy(feet); actor.holder.rotation.y = facing;
    actor.mixer.update(dt);
    if(actor.approxCrouch){
      const k=1-.28*(a.crouch.getEffectiveWeight()+a.crouchWalk.getEffectiveWeight());
      actor.model.scale.y=actor.scaleY*k;actor.model.position.y=actor.baseY*k;
    }
    if (actor.holder.visible && !climbing && !(actor.kind==='frog' && speed>.025) && jumpStage!=='air') Footing.place(actor,footprintGround,a.run.getEffectiveWeight()>.2);
  }

  function walk(dt) {
    regrabDelay=Math.max(0,regrabDelay-dt);
    const touchJump=WalkActions.consumeJump(),jump=jumpPressed||touchJump,wasClimbing=climbing;
    if(!climbing&&!regrabDelay&&(jump||jumpStage==='air')&&canGrab()){
      climbing=true;climbPhase=0;jumpStage='ground';verticalSpeed=0;WalkActions.setCrouch(false);
    }else if (!climbing&&jump && (jumpStage === 'ground' || jumpStage === 'land')) {
      WalkActions.setCrouch(false);
      jumpStage = 'windup'; stageTime = firstPerson ? windup : 0;
    }
    jumpPressed = false;
    const height=player.entry?.height || 1.71;
    capsuleRadius=clamp(height*.153,.22,.31);
    if (crouchActive && !WalkActions.crouch && !Phys.headroom(feet,height,capsuleRadius)) {
      WalkActions.setCrouch(true);
      if (jumpStage==='windup') jumpStage='ground';
    }
    const crouched = crouchActive = WalkActions.crouch && jumpStage === 'ground';
    capsuleHeight=height*(crouched ? .69 : 1);
    const running = !crouched && (WalkActions.run || Modes.keys.has('ShiftLeft') || Modes.keys.has('ShiftRight'));
    let speed=0;
    if(climbing)climbStep(dt,wasClimbing&&jump);
    else{speed=moveHorizontal(dt, crouched ? crouchSpeed : running ? runSpeed : walkSpeed);stepJump(dt);}
    Phys.setPlayer(feet,capsuleHeight,capsuleRadius);
    animateHuman(dt,speed,crouched);
    const blend = 1-Math.exp(-dt*10);
    lowCamera += (Number(crouched)-lowCamera)*blend;
    fastCamera += (sm(walkSpeed,runSpeed,speed)-fastCamera)*blend;
  }
  function step(camera, dt) {
    if (player) walk(dt);
    const distance = camera.aspect < 1 ? 4.25 : 3.55;
    const head = supportY + (feet.y-supportY)*.52 + (player?.entry?.height || 1.71)*(.61-.16*lowCamera);
    if (!cameraReady) { target.set(feet.x,head,feet.z); cameraReady = true; }
    else target.set(feet.x,lerp(target.y,head,1-Math.exp(-dt*12)),feet.z);
    ray.set(Math.sin(azimuth)*Math.cos(pitch), Math.sin(pitch), Math.cos(azimuth)*Math.cos(pitch));
    const obstruction = Phys.ray(target,ray,distance);
    eye.copy(target).addScaledVector(ray, obstruction ? Math.max(.4,obstruction.t-.18) : distance);
    eye.y = Math.max(eye.y,Island.surf(eye.x,eye.z)[0]+.28);
    camera.position.copy(eye); camera.lookAt(target); camera.near=.075; camera.fov=52+(PixelFit.enabled?0:3*fastCamera);
    if(status)return status;
    if(climbing)return '벽 오르기 · 앞으로 올라가기 · 뒤로 내려가기 · 점프로 놓기';
    if(navigator.maxTouchPoints)return '왼쪽 스틱 이동 · 화면 드래그로 시점 회전';
    const viewHint=VisualStyle.walkYaw()!==null?'드래그 회전 · 휠 확대/축소':'드래그 시점';
    return 'WASD / 방향키 이동 · Shift 달리기 · Space 점프 · C 앉기/일어서기 · '+viewHint;
  }
  Modes.add('actors',{name:'캐릭터',enter,leave,step},'KeyV','V');
  function beginApproach(x,z,yaw,floorFn,first=false) {
    if (savedWalk) endApproach();
    savedWalk = {feet:feet.clone(), facing, azimuth, pitch, placed};
    firstPerson = first; extraFloor = floorFn;
    placed = true; feet.set(x,surface(x,z),z); facing = azimuth = yaw; pitch = first ? 0 : .26;
    enter();
  }
  function endApproach() {
    if (!savedWalk) return;
    leave();
    feet.copy(savedWalk.feet); facing=savedWalk.facing; azimuth=savedWalk.azimuth; pitch=savedWalk.pitch;
    placed=savedWalk.placed; savedWalk=null; firstPerson=false; extraFloor=null;
  }
  function stepFirstPerson(camera,dt) {
    azimuth-=edgeYaw*2.45*dt;pitch=clamp(pitch-edgePitch*1.6*dt,-1.34,1.34);
    if (player) walk(dt);
    const height=player?.entry?.height || 1.71;
    camera.position.copy(feet); camera.position.y+=height*(.91-.26*lowCamera);
    camera.rotation.set(pitch,azimuth,0,'YXZ'); camera.near=.04; camera.fov=68+4*fastCamera;
  }
  return {enter,leave,step,selectHuman,beginApproach,endApproach,stepApproach:step,stepFirstPerson,clearInput,
    get anglerEntry(){return selectedHuman?.species==='frog'?null:selectedHuman;},
    loadActor,releaseActor:release,
    beginFirstPerson(x,z,yaw) { beginApproach(x,z,yaw,null,true); }, get position() {return feet;},
    get avatar(){return player?.holder || null;}, get thirdPerson(){return active&&!firstPerson;},get climbing(){return climbing;},
    get currentId() {
    return player ? player.entry?.id || 'kate' : null;
  } };
})();
