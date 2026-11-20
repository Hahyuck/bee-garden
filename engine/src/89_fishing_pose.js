'use strict';
const FishingPose=(()=>{
  const holder=new THREE.Group();
  holder.name='angler';holder.position.set(0,.09,-.55);
  let actor=null,entry,version=0,arms=[],height=1.71;
  const shoulder=new THREE.Vector3(),elbow=new THREE.Vector3(),hand=new THREE.Vector3(),goal=new THREE.Vector3();
  const reach=new THREE.Vector3(),pole=new THREE.Vector3(),joint=new THREE.Vector3();
  const start=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),palm=new THREE.Vector3();
  const rotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion();
  function bind(model,side){
    let wrist;model.traverse(o=>{if(o.isBone&&o.name.toLowerCase().endsWith(side+'hand'))wrist=o;});
    if(!wrist?.parent?.parent?.isBone)return null;
    const lower=wrist.parent,upper=lower.parent;
    const finger=wrist.children.find(o=>o.isBone&&/middle|index/i.test(o.name));
    const grip=finger?finger.position.clone().multiplyScalar(.66):new THREE.Vector3();
    return {wrist,lower,upper,grip,restUpper:upper.quaternion.clone(),restLower:lower.quaternion.clone()};
  }
  async function mount(deck){
    deck.add(holder);const requested=ActorWalk.anglerEntry;
    if(actor&&entry===requested)return;
    const token=++version;
    let next=await ActorWalk.loadActor(requested);
    if(token!==version){ActorWalk.releaseActor(next);return;}
    let pair=['right','left'].map(s=>bind(next.model,s));
    if(pair.some(a=>!a)&&requested){
      ActorWalk.releaseActor(next);next=await ActorWalk.loadActor(null);
      if(token!==version){ActorWalk.releaseActor(next);return;}
      pair=['right','left'].map(s=>bind(next.model,s));
    }
    ActorWalk.releaseActor(actor);actor=next;entry=requested;arms=pair;height=next.entry?.height||1.71;
    next.holder.name='fishing-character';holder.add(next.holder);
  }
  function pointBone(bone,childWorld,target){
    bone.getWorldPosition(start);
    parentRotation.copy(bone.parent.getWorldQuaternion(rotation)).invert();
    from.subVectors(childWorld,start).applyQuaternion(parentRotation).normalize();
    to.subVectors(target,start).applyQuaternion(parentRotation).normalize();
    bone.quaternion.premultiply(rotation.setFromUnitVectors(from,to));
    bone.updateWorldMatrix(false,true);
  }
  function poseArm(arm,target,side){
    if(!arm)return;
    const {upper,lower,wrist,grip}=arm;
    upper.getWorldPosition(shoulder);lower.getWorldPosition(elbow);wrist.localToWorld(hand.copy(grip));
    const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(hand);
    reach.subVectors(target,shoulder);const length=reach.length();if(length<.001||a*b<.00001)return;
    reach.divideScalar(length);const d=clamp(length,Math.abs(a-b)+.0001,a+b-.0001);
    // Elbows fold down and out. Work in world metres so differently scaled avatars share a grip.
    holder.localToWorld(pole.set(side*height*.43,height*.46,0));
    pole.sub(shoulder);pole.addScaledVector(reach,-pole.dot(reach)).normalize();
    const along=(a*a+d*d-b*b)/(2*d);
    joint.copy(shoulder).addScaledVector(reach,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
    pointBone(upper,elbow,joint);
    wrist.localToWorld(hand.copy(grip));pointBone(lower,hand,target);
  }
  function step(dt,rod,bearing,pitch,reel){
    holder.rotation.y=Math.PI+bearing;
    // Rod origin is the casting palm. Both hands follow the same moving handle.
    holder.localToWorld(goal.set(.075*height,height*(.63+.055*Math.cos(pitch)),(-.18-.035*Math.sin(pitch))*height));
    rod.parent.worldToLocal(rod.position.copy(goal));
    rod.rotation.set(pitch,bearing,0,'YXZ');rod.updateWorldMatrix(true,false);
    if(!actor)return;
    for(const arm of arms)if(arm){arm.upper.quaternion.copy(arm.restUpper);arm.lower.quaternion.copy(arm.restLower);}
    actor.mixer.update(dt);holder.updateWorldMatrix(true,true);
    poseArm(arms[0],goal,1);
    rod.localToWorld(palm.set(.105,.13+.035*Math.sin(reel),-.065+.035*Math.cos(reel)));
    poseArm(arms[1],palm,-1);
  }
  return {mount,step,leave(){version++;}};
})();
