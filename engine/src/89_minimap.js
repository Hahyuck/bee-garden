'use strict';
const Minimap=(()=>{
  const map=document.createElement('canvas');map.id='world-minimap';map.width=map.height=216;
  map.setAttribute('role','img');map.setAttribute('aria-label','미니맵 · 북쪽이 위');
  map.style.cssText='position:fixed;z-index:4;left:max(12px,env(safe-area-inset-left));top:65px;width:clamp(85px,13vmin,134px);height:auto;aspect-ratio:1;border:1px solid #adc9b788;border-radius:50%;pointer-events:none;box-shadow:0 2px 12px #09181588';
  document.body.append(map);
  const ctx=map.getContext('2d'),atlas=document.createElement('canvas'),a=atlas.getContext('2d');
  const size=256,span=1540,ox=Island.IC.x-span/2,oz=Island.IC.z-span/2;
  const dir=new THREE.Vector3(),p=new THREE.Vector3(),track=new THREE.Vector3();let built=false,next=-1,last='',lastTime=-1;
  function bake(){
    atlas.width=atlas.height=size;const image=a.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const wx=ox+x/size*span,wz=oz+y/size*span,height=Island.H0(wx,wz),i=(y*size+x)*4;
      const band=height<-.6?[36,76,83]:height<2.2?[157,146,106]:height<40?[86,113,87]:height<170?[68,93,75]:[120,127,107];
      image.data[i]=band[0];image.data[i+1]=band[1];image.data[i+2]=band[2];image.data[i+3]=255;
    }a.putImageData(image,0,0);
    const rd=Island.RD;a.beginPath();for(let i=0;i<rd.n;i+=3){const x=(rd.px[i]-ox)*size/span,y=(rd.pz[i]-oz)*size/span;if(i)a.lineTo(x,y);else a.moveTo(x,y);}
    a.closePath();a.strokeStyle='#cabe9c';a.lineWidth=1.2;a.stroke();built=true;
  }
  function draw(t){
    if(!ctx||map.hidden)return;
    const mode=Modes.cur;if(t>=lastTime&&t<next&&mode===last)return;lastTime=t;next=t+.12;last=mode;if(!built)bake();
    p.copy(G.camera.position);G.camera.getWorldDirection(dir);let goal=null,range=78;
    if(ActorWalk.thirdPerson||mode==='fps')p.copy(ActorWalk.position);
    if(mode==='drive'&&!ActorWalk.thirdPerson){p.copy(Drive.car.p);dir.set(0,0,1).applyQuaternion(Drive.car.q);range=210;}
    if(mode==='flight'&&!ActorWalk.thirdPerson){const s=Airfield.state;p.fromArray(s.position);dir.set(Math.sin(s.heading),0,Math.cos(s.heading));range=360;}
    if(mode==='boat'||mode==='sub'){p.copy(Marine.position);const s=Marine.state;dir.set(Math.sin(s.heading),0,Math.cos(s.heading));goal=Marine.waypoint;range=135;}
    if(mode==='fishing'){p.copy(Fishing.position);goal=Fishing.float;range=29;}
    if(mode==='free')range=210;
    const mid=108,factor=mid/range;ctx.clearRect(0,0,216,216);ctx.save();ctx.beginPath();ctx.arc(mid,mid,mid,0,TAU);ctx.clip();
    ctx.fillStyle='#244c53';ctx.fillRect(0,0,216,216);ctx.drawImage(atlas,mid+(ox-p.x)*factor,mid+(oz-p.z)*factor,span*factor,span*factor);
    ctx.strokeStyle='#dbedda32';ctx.lineWidth=1;ctx.beginPath();ctx.arc(mid,mid,mid*.52,0,TAU);ctx.stroke();
    if(goal){
      track.subVectors(goal,p);const d=Math.hypot(track.x,track.z),s=Math.min(factor,(mid-17)/Math.max(d,.001));
      ctx.fillStyle='#ffca75';ctx.beginPath();ctx.arc(mid+track.x*s,mid+track.z*s,6,0,TAU);ctx.fill();ctx.strokeStyle='#443323';ctx.stroke();
    }
    ctx.fillStyle='#f8f4d7';ctx.font='bold 19px system-ui';ctx.textAlign='center';ctx.fillText('N',mid,21);
    ctx.translate(mid,mid);ctx.rotate(Math.atan2(dir.x,-dir.z));ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(9,9);ctx.lineTo(0,5);ctx.lineTo(-9,9);ctx.closePath();ctx.fillStyle='#a8f0d0';ctx.fill();ctx.strokeStyle='#14382e';ctx.lineWidth=2.5;ctx.stroke();ctx.restore();
    map.dataset.mode=mode;
  }
  return {draw};
})();
