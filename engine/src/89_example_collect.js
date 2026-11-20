'use strict';
// Keep the saved mode id so existing projects and links still open slot 0.
const FallingProps=(()=>{
  const items=[],limit=24;
  const direction=new THREE.Vector3();
  let delay=0,count=0,firstKind='barrel';
  function enter(){
    count=0;delay=0;firstKind=Math.random()<.5?'barrel':'stone';
    const road=Island.RD,fly=Modes.fly;
    fly.p.set(road.px[0],road.py[0]+2.4,road.pz[0]);
    fly.yaw=Math.atan2(road.px[0]-road.px[6],road.pz[0]-road.pz[6]);fly.pitch=.04;
  }
  function drop(camera){
    camera.getWorldDirection(direction);const heading=Math.atan2(direction.x,direction.z);
    const angle=heading+(Math.random()-.5)*.83,distance=6+Math.random()*6;
    const x=camera.position.x+Math.sin(angle)*distance,z=camera.position.z+Math.cos(angle)*distance;
    const y=Math.max(Island.support(x,z)+.5,Phys.SEA,camera.position.y)+1.6+Math.random()*2.7;
    const kind=count===0?firstKind:count===1?(firstKind==='barrel'?'stone':'barrel'):(Math.random()<.5?'barrel':'stone');
    if(items.length>=limit)Phys.remove(items.shift());
    Phys.prime(x,z,0);
    const item=Phys.spawn(kind,x,y,z);
    if(!item)return;
    item.b.setAngvel({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random()*2-1},true);
    count++;items.push(item);
  }
  function step(camera,dt){
    Modes.MODES.free.step(camera,dt);
    if(!Phys.ready)return '통+돌 랜덤 낙하 · 물리 엔진을 불러오지 못했습니다';
    if(!Phys.hold&&dt>0){
      delay-=dt;if(delay<=0){drop(camera);delay=.5+Math.random()*.9;}
    }
    return '통+돌 랜덤 낙하 · '+count+'개 · WASD 이동 · 끌어서 둘러보기';
  }
  function leave(){for(const e of items)Phys.remove(e);items.length=0;}
  Modes.add('collect',{name:'통+돌 랜덤 낙하',enter,step,leave},'Digit0','0');
  return {get count(){return count;}};
})();
