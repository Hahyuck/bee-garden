'use strict';
const Fishing=(()=>{
  const site=new THREE.Vector3(94,0,-550),floatAt=new THREE.Vector3(),tip=new THREE.Vector3(),aim=new THREE.Vector3();
  const group=new THREE.Group(),rig=new THREE.Group(),float=new THREE.Group(),fish=new THREE.Group();
  const rods=[{name:'연질대',range:9,power:2.9,flex:1.3},{name:'만능대',range:13,power:3.9,flex:1},{name:'원투대',range:18,power:4.9,flex:.7}];
  const baits=['곡물 떡밥','크릴 떡밥','오징어살'];
  const species=[['망상어',.22,0],['숭어',1.45,0],['고등어',.80,1],['감성돔',1.75,1],['농어',2.25,2]];
  const ui=document.createElement('section');ui.id='fishing-panel';ui.hidden=true;ui.setAttribute('aria-label','낚시');
  ui.innerHTML='<div><label>낚싯대 <select data-rod></select></label> <label>미끼 <select data-bait></select></label></div><p data-state aria-live="polite"></p><div data-tension hidden>줄 장력 <meter min="0" max="1" low=".23" high=".76" optimum=".48"></meter></div><div class="fish-buttons"><button data-left aria-label="찌 왼쪽으로">↶</button><button data-action>던지기</button><button data-right aria-label="찌 오른쪽으로">↷</button><button data-net aria-expanded="false">어망</button></div><div data-basket hidden></div>';
  const css=document.createElement('style');css.textContent=`
    #fishing-panel{position:fixed;z-index:6;left:50%;bottom:max(26px,env(safe-area-inset-bottom));transform:translateX(-50%);background:#142b2bec;color:#edf3de;border:1px solid #587976;border-radius:8px;padding:9px 13px;font:600 12px/1.4 system-ui;text-align:center;max-width:95vw;}
    #fishing-panel :is(button,select){background:#264742;color:#fcfae7;padding:5px;border:1px solid #6b8980;border-radius:5px;font:inherit;touch-action:manipulation}#fishing-panel [data-action]{background:#badccd;color:#162d29;min-width:78px}
    #fishing-panel p{margin:5px 0}#fishing-panel meter{width:100px}#fishing-panel .fish-buttons{display:flex;justify-content:center;gap:5px;margin-top:4px}
    #fishing-panel [data-basket]{max-height:95px;overflow:auto;white-space:pre-line;text-align:left;margin-top:6px}#fishing-panel [hidden]{display:none}
    @media(max-width:620px){#fishing-panel{width:max-content;bottom:max(54px,env(safe-area-inset-bottom));padding:7px}}
  `;document.head.append(css);document.body.append(ui);
  const el=k=>ui.querySelector('[data-'+k+']'),rod=el('rod'),bait=el('bait'),action=el('action'),meter=ui.querySelector('meter');
  rods.forEach((r,i)=>rod.add(new Option(r.name,i)));rod.value='1';baits.forEach((b,i)=>bait.add(new Option(b,i)));
  let net=[];try{const n=JSON.parse(localStorage.getItem('garden.angler.net')||'[]');if(Array.isArray(n))net=n.filter(x=>species.some(s=>s[0]===x.name)&&Number.isFinite(x.kg)).slice(-100);}catch{}
  let active=false,built=false,stage='ready',age=0,elapsed=0,range=0,bearing=0,wait=0,reeling=false,wind=0,tension=0,shake=0,mass=0;
  let catchName='',catches=0,turn=0,line,ring;
  const sections=[],a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const rodPts=new Float32Array(9*3),linePts=new Float32Array(13*3);
  function mesh(g,color,parent,x,y,z){const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.52}));m.position.set(x,y,z);parent.add(m);return m;}
  function cord(array,color,parent){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(array,3).setUsage(THREE.DynamicDrawUsage));
    const l=new THREE.Line(g,new THREE.LineBasicMaterial({color}));l.frustumCulled=false;parent.add(l);return l;
  }
  function build(){
    if(built)return;built=true;G.scene.add(group);group.name='fishing-pontoon';group.add(rig,float,fish);
    for(let i=0;i<11;i++)mesh(new THREE.BoxGeometry(.25,.18,3.3),i%2?0x967658:0xb58d68,rig,(i-5)*.255,0,0);
    for(const x of [-1.02,1.02]){const f=mesh(new THREE.CylinderGeometry(.31,.31,3.32,12),0x496b6b,rig,x,-.21,0);f.rotation.x=Math.PI/2;}
    const shaft=mesh(new THREE.CylinderGeometry(.025,.049,.87,10),0x875731,rig,.48,.65,.43);shaft.rotation.x=.79;
    mesh(new THREE.CylinderGeometry(.11,.11,.1,14),0x526369,rig,.53,.74,.5).rotation.z=Math.PI/2;
    for(let i=0;i<8;i++)sections.push(mesh(new THREE.CylinderGeometry(.028-i*.0028,.032-i*.0028,1,8),i%3===0?0xc7a45f:0x314449,rig,0,0,0));
    line=cord(linePts,0xbddbd7,group);
    const bulb=mesh(new THREE.SphereGeometry(1,12,12),0xe6562d,float,0,.055,0);bulb.scale.set(.089,.12,.089);
    mesh(new THREE.CylinderGeometry(.022,.025,.30,8),0xffed9e,float,0,.24,0);
    mesh(new THREE.CylinderGeometry(.022,.022,.085,8),0xd24c34,float,0,.395,0);
    ring=mesh(new THREE.TorusGeometry(1,.018,5,48),0xd8eeeb,group,0,0,0);ring.rotation.x=Math.PI/2;
    const body=mesh(new THREE.SphereGeometry(1,16,10),0x87b7a5,fish,0,0,0);body.scale.set(.15,.22,.50);
    const tail=mesh(new THREE.ConeGeometry(.2,.37,4),0xd2b578,fish,0,0,-.50);tail.rotation.x=Math.PI/2;tail.scale.x=.2;
  }
  function basket(){el('basket').textContent=net.length?net.slice().reverse().map(v=>v.name+'  '+v.kg.toFixed(2)+' kg').join('\n'):'어망이 비어 있습니다.';el('net').textContent='어망 '+net.length;}
  function change(s,msg=''){
    stage=s;age=0;const ready=s==='ready';
    rod.disabled=bait.disabled=!ready;action.textContent=({ready:'던지기',cast:'캐스팅',wait:'찌 감기',bite:'챔질!',fight:'길게 눌러 감기'})[s];
    el('state').textContent=msg||({ready:'방향을 정해 찌를 던지세요.',cast:'찌를 던지는 중',wait:'찌를 보며 입질을 기다리세요.',bite:'입질! 지금 챔질하세요.',fight:'당기면 감고, 장력이 높으면 놓으세요.'})[s];
    el('tension').hidden=s!=='fight';el('left').disabled=el('right').disabled=s==='cast';
  }
  function begin(){
    if(!active)return;
    if(stage==='ready'){range=rods[rod.selectedIndex].range;wait=2.5+Math.random()*3;change('cast');}
    else if(stage==='bite'){
      const preferred=species.filter(s=>s[2]===bait.selectedIndex);
      const list=Math.random()<.78?preferred:species,entry=list[Math.floor(Math.random()*list.length)];
      catchName=entry[0];mass=entry[1]*(.68+Math.random()*.85);tension=.32;shake=1;change('fight');
    }else if(stage==='wait'||stage==='fight')reeling=true;
  }
  function endInput(){reeling=false;turn=0;wind=0;}
  function caught(){
    catches++;const kg=Number(mass.toFixed(2));net.push({name:catchName,kg});net=net.slice(-100);
    try{localStorage.setItem('garden.angler.net',JSON.stringify(net));}catch{}basket();endInput();shake=.32;
    change('ready',catchName+' '+kg.toFixed(2)+' kg · 어망에 담았습니다.');
  }
  action.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();action.setPointerCapture(e.pointerId);begin();});
  action.addEventListener('click',e=>{if(e.detail===0){begin();if(reeling)wind=.26;reeling=false;}});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])action.addEventListener(ev,()=>{reeling=false;});
  for(const [k,d] of [['left',-1],['right',1]]){
    const b=el(k);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);turn=d;bearing=clamp(bearing+d*.055,-1.15,1.15);};
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{turn=0;});
  }
  el('net').onclick=()=>{const b=el('basket');b.hidden=!b.hidden;el('net').setAttribute('aria-expanded',String(!b.hidden));basket();};
  for(const s of [rod,bait])s.onchange=()=>s.blur();
  const canvas=document.getElementById('c');
  canvas.addEventListener('pointerdown',e=>{if(active&&e.button===0){canvas.setPointerCapture(e.pointerId);begin();}});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{reeling=false;});
  canvas.addEventListener('wheel',e=>{if(!active||e.ctrlKey)return;e.preventDefault();if(e.deltaY<0)wind=Math.min(.45,wind+.14);else if(stage==='ready')bearing=clamp(bearing+Math.sign(e.deltaY)*.065,-1.15,1.15);},{passive:false});
  addEventListener('keydown',e=>{if(active&&e.code==='Space'&&!e.target.closest?.('select,input,textarea,button')){e.preventDefault();if(!e.repeat)begin();}});
  addEventListener('keyup',e=>{if(e.code==='Space')reeling=false;},true);
  addEventListener('blur',endInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)endInput();});
  function step(camera,dt){
    age+=dt;elapsed+=dt;shake=Math.max(0,shake-dt*1.9);wind=Math.max(0,wind-dt);
    const gear=rods[rod.selectedIndex],pull=reeling||wind>0;
    const steering=turn+Number(Modes.keys.has('KeyD'))-Number(Modes.keys.has('KeyA'));
    bearing=clamp(bearing+steering*dt*(stage==='ready'?1:.33),-1.15,1.15);
    if(stage==='cast'&&age>=.70)change('wait');
    else if(stage==='wait'){if(pull){range-=3.3*dt;if(range<1.2){endInput();change('ready','찌를 회수했습니다.');}}
      if(stage==='wait'&&age>=wait){shake=.3;change('bite');}}
    else if(stage==='bite'&&age>2.1){endInput();change('ready','물고기가 미끼를 놓쳤습니다.');}
    else if(stage==='fight'){
      const burst=Math.max(0,Math.sin(age*2.7+mass)),load=mass*.037+burst*.25;
      tension=clamp(tension+dt*(pull?.20+load:-.34+.10*burst),.05,1);
      range+=dt*(pull?-gear.power/(1+.23*mass):.6+burst*.7);
      shake=Math.max(shake,burst*(.11+mass*.038));meter.value=tension;
      if(tension>=.99||range>gear.range+9){endInput();change('ready',tension>=.99?'줄이 끊어졌습니다.':'물고기가 빠져나갔습니다.');}
      else if(range<=1.1)caught();
    }
    const sn=Math.sin(bearing),cs=Math.cos(bearing),surface=Sea.height(site.x,site.z),cast=stage==='cast'?clamp(age/.7):1;
    rig.position.set(site.x,surface+.13,site.z);rig.rotation.z=.018*Math.sin(elapsed*.9);
    const reach=stage==='ready'?1.65:lerp(1.65,range,cast),tug=stage==='fight'?.45*Math.sin(age*4):0;
    const x=site.x+sn*reach+cs*tug,z=site.z+cs*reach-sn*tug;
    floatAt.set(x,Sea.height(x,z)+(stage==='cast'?Math.sin(cast*Math.PI)*3.2:0),z);
    float.position.copy(floatAt);float.position.y+=stage==='bite'?-.16+.15*Math.cos(age*19):.04*Math.sin(elapsed*3.1);
    float.rotation.z=stage==='bite'?.39*Math.sin(age*17):.08*Math.sin(elapsed*2);
    const bend=stage==='fight'?tension*gear.flex:stage==='cast'?Math.sin(cast*Math.PI)*.42:0;
    for(let i=0;i<9;i++){const u=i/8;rodPts.set([.48+sn*u*1.1,.92+u*1.25-bend*u*u,.72+cs*u*(1.35+bend*.4)],i*3);}
    for(let i=0;i<sections.length;i++){const s=sections[i];a.fromArray(rodPts,i*3);b.fromArray(rodPts,(i+1)*3);
      s.position.copy(a).lerp(b,.5);axis.subVectors(b,a);s.scale.y=axis.length();s.quaternion.setFromUnitVectors(up,axis.normalize());}
    tip.fromArray(rodPts,24);rig.localToWorld(tip);
    for(let i=0;i<13;i++){const u=i/12;linePts.set([lerp(tip.x,float.position.x,u),lerp(tip.y,float.position.y+.2,u)-Math.sin(u*Math.PI)*(stage==='fight'?.04:.20),lerp(tip.z,float.position.z,u)],i*3);}
    line.geometry.attributes.position.needsUpdate=true;ring.position.copy(floatAt);ring.position.y+=.048;
    ring.visible=stage==='bite'||stage==='fight';ring.scale.setScalar(.16+((elapsed*1.35)%1)*.68);
    fish.visible=stage==='fight';fish.position.copy(floatAt);fish.position.y-=.25;fish.rotation.y=bearing+Math.sin(age*7)*.68;
    fish.scale.setScalar(.71+.32*Math.sqrt(mass));const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?.15:1;
    camera.position.set(site.x+.28+Math.sin(elapsed*39)*shake*.055*motion,surface+2.22+Math.sin(elapsed*31)*shake*.043*motion,site.z-2.72);
    aim.set(site.x+sn*reach*.78,surface+.35,site.z+Math.max(2.6,cs*reach*.78));camera.lookAt(aim);camera.fov=55;camera.near=.09;
    return 'A/D 찌 방향 · Space 던지기/챔질 · 길게 누르거나 휠 위로 감기';
  }
  Modes.add('fishing',{name:'바다낚시',enter(){build();active=group.visible=true;ui.hidden=false;endInput();change('ready');basket();},
    leave(){active=group.visible=false;ui.hidden=true;endInput();},step},'Digit8','8');
  return {get position(){return site;},get float(){return stage==='ready'?null:floatAt;},get stage(){return stage;},get catches(){return catches;}};
})();
