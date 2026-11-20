'use strict';
// The same coastal route can be sailed above the reef or explored below it.
const Marine=(()=>{
  const harbor={x:88,z:-545}, sea=CFG.sea.level;
  const course=[[0,40],[48,88],[104,52],[88,-24],[32,-45],[0,-14]];
  const world=new THREE.Group(), boat=new THREE.Group(), sub=new THREE.Group(), reef=new THREE.Group();
  const animals=[], markers=[], touching=new Map(), p=new THREE.Vector3(), eye=new THREE.Vector3(), look=new THREE.Vector3();
  const stamp=new THREE.Object3D(), random=rng(8261);
  const materials=new Map(), orb=new THREE.SphereGeometry(1,18,12), cube=new THREE.BoxGeometry(1,1,1);
  const rod=new THREE.CylinderGeometry(1,1,1,10), taper=new THREE.ConeGeometry(1,1,10);
  const pale=0xf4e5c4, navy=0x195359, amber=0xeb943e, glass=0x386573;
  let active='',built=false,heading=0,speed=0,depth=0,clock=0,leg=0,laps=0,scope=false,scopeYaw=0,zoom=1;
  let prop,boatProp,mast,scopeLens,wake,schools,lamps,mouse=null,bottom=null,bottomX=Infinity,bottomZ=Infinity,orbit=0,tilt=0;
  let scopeBlend=0;
  const lensAt=new THREE.Vector3(),lensAim=new THREE.Vector3(),scopeDepth=2.05;
  function mat(color){
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.54,metalness:.12}));
    return materials.get(color);
  }
  function part(parent,g,color,x,y,z,sx,sy,sz){
    const m=new THREE.Mesh(g,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
  }
  function beam(parent,a,b,r,color){
    const d=new THREE.Vector3().subVectors(b,a);
    const m=part(parent,rod,color,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,r,d.length(),r);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
  }
  function makeBoat(){
    // Transverse frames define a pointed bow, flared gunwales, keel and flat deck.
    const points=[],indices=[],colors=[];
    const frames=[[-3.7,1.22],[-2.7,1.46],[.9,1.42],[2.6,1.0],[3.95,.04]];
    const section=(z,w)=>[[-w,.65,z],[-w*.79,-.24,z],[0,-.65,z],[w*.79,-.24,z],[w,.65,z]];
    const faces=[navy,navy,navy,navy,0xc49d71];
    for(let i=0;i<frames.length-1;i++){
      const a=section(...frames[i]),b=section(...frames[i+1]);
      for(let j=0;j<5;j++){
        const k=(j+1)%5,n=points.length/3,c=new THREE.Color(faces[j]);
        for(const v of [a[j],a[k],b[k],b[j]]){points.push(...v);colors.push(c.r,c.g,c.b);}
        indices.push(n,n+1,n+2,n,n+2,n+3);
      }
    }
    for(const [z,w] of [frames[0],frames[frames.length-1]]){
      const n=points.length/3,c=new THREE.Color(navy);
      for(const v of section(z,w)){points.push(...v);colors.push(c.r,c.g,c.b);}indices.push(n,n+1,n+2,n,n+2,n+3,n,n+3,n+4);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    boat.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.48})));
    part(boat,cube,pale,0,.95,-.10,1.95,.60,2.6);
    part(boat,cube,glass,0,1.62,-.16,1.78,.78,1.81);
    for(const x of [-.88,.88])for(const z of [-1.04,-.12,.72])part(boat,cube,pale,x,1.64,z,.065,.80,.09);
    part(boat,cube,pale,0,2.05,-.20,2.2,.13,2.15);
    part(boat,rod,navy,.35,2.63,-.58,.034,1.15,.034);
    part(boat,cube,amber,.35,3.15,-.58,.84,.13,.14);
    for(const s of [-1,1]){
      const v=(z,x,y)=>new THREE.Vector3(s*x,y,z);
      for(const [z,x,nz,nx] of [[1.05,1.32,2.6,.95],[2.6,.95,3.68,.18],[-3.45,1.15,-1.5,1.33]]){
        beam(boat,v(z,x,.67),v(z,x,1.11),.029,pale);beam(boat,v(z,x,1.11),v(nz,nx,1.11),.034,pale);
      }
      const ring=part(boat,new THREE.TorusGeometry(.27,.069,8,22),amber,s*1.04,1.13,-.77,1,1,1);ring.rotation.y=Math.PI/2;
    }
    part(boat,cube,navy,0,.02,-3.75,.34,.9,.40);
    const shaft=part(boat,rod,0xa8a8a0,0,-.26,-3.92,.075,.6,.075);shaft.rotation.x=Math.PI/2;
    boatProp=new THREE.Group();boatProp.name='boat-propeller';boatProp.position.set(0,-.26,-4.12);boat.add(boatProp);
    part(boatProp,orb,0xae8955,0,0,0,.13,.13,.22);
    for(let i=0;i<3;i++){
      const arm=new THREE.Group();arm.rotation.z=i*TAU/3;boatProp.add(arm);
      const blade=part(arm,orb,0xb99352,.065,.24,0,.13,.25,.046);
      blade.rotation.set(.48,0,-.35);
    }
    wake=makeBoatWake(world);
    boat.name='coastal-cabin-boat';
  }
  function makeSub(){
    part(sub,orb,amber,0,0,0,1.10,1.12,3.05);
    part(sub,orb,navy,0,-.47,-.12,1.00,.77,2.80);
    part(sub,orb,glass,0,.02,2.41,.78,.72,.65);
    part(sub,cube,amber,0,.98,-.24,.75,.65,1.22);
    for(const side of [-1,1])for(const z of [-1.05,-.18,.73]){
      const port=part(sub,rod,pale,side*1.03,.12,z,.17,.10,.17);port.rotation.z=Math.PI/2;
      const pane=part(sub,orb,glass,side*1.087,.12,z,.032,.13,.13);
      pane.rotation.z=side*.08;
    }
    part(sub,cube,navy,0,.04,-1.66,3.12,.10,.63);part(sub,cube,navy,0,.13,-2.05,.12,1.71,.58);
    mast=new THREE.Group();sub.add(mast);part(mast,rod,pale,0,1.73,-.28,.074,1.24,.074);
    part(mast,cube,navy,0,2.38,-.18,.21,.19,.34);
    scopeLens=new THREE.Object3D();scopeLens.position.set(0,2.38,.025);mast.add(scopeLens);
    prop=new THREE.Group();prop.position.z=-3;sub.add(prop);
    for(let i=0;i<4;i++){const blade=new THREE.Group();blade.rotation.z=i*Math.PI/2;prop.add(blade);part(blade,orb,0xa57d4c,0,.35,0,.125,.37,.075);}
    lamps=new THREE.PointLight(0xa4f4f3,42,21,1.6);lamps.position.set(0,.05,3.7);sub.add(lamps);
    sub.name='reef-survey-submarine';
  }
  function makeAnimal(kind,x,y,z,phase){
    const model=new THREE.Group(), fins=[], limbs=[];
    model.name='reef-'+kind;reef.add(model);
    const oval=(c,px,py,pz,sx,sy,sz)=>part(model,orb,c,px,py,pz,sx,sy,sz);
    if(kind==='fish'){
      oval(0x5dafac,0,0,0,.19,.33,.71);
      oval(0xe5c25f,0,.07,.27,.194,.28,.20);
      const tail=part(model,taper,0xe5a545,0,0,-.76,.29,.53,.065);tail.rotation.x=Math.PI/2;tail.rotation.z=Math.PI/2;fins.push(tail);
      part(model,taper,0x439395,0,.28,-.04,.14,.31,.20);
    }else if(kind==='turtle'){
      oval(0x807243,0,0,0,.77,.39,1.04);oval(0x588b66,0,-.03,1.00,.235,.23,.35);
      for(const side of [-1,1])for(const zz of [-.63,.44]){
        const fin=oval(0x668e67,side*(zz>0?.92:.62),-.11,zz,zz>0?.61:.34,.085,.21);fin.rotation.y=side*-.42;fins.push(fin);
      }
      for(const side of [-1,1])oval(0x252d29,side*.165,.04,1.19,.046,.046,.046);
    }else{
      const oct=kind==='octopus',c=oct?0xb75f59:0xcf9b91, count=oct?8:10;
      oval(c,0,oct?.43:.05,0,oct?.54:.30,oct?.49:.28,oct?.51:.95);
      if(!oct)for(const s of [-1,1])oval(0xcd8786,.25*s,.02,-.49,.24,.07,.33).rotation.y=s*.43;
      for(let i=0;i<count;i++){
        const a=TAU*i/count,arm=new THREE.Group();model.add(arm);
        arm.position.set(Math.cos(a)*(oct?.30:.18),oct?.15:-.035,oct?Math.sin(a)*.29:.65);
        arm.rotation.y=oct?-a:0;
        const curve=new THREE.CatmullRomCurve3(oct?
          [new THREE.Vector3(),new THREE.Vector3(.32,-.18,0),new THREE.Vector3(.60,-.19,.08),new THREE.Vector3(.84,-.02,.20)]:
          [new THREE.Vector3(),new THREE.Vector3(Math.cos(a)*.12,Math.sin(a)*.11,.21),new THREE.Vector3(Math.cos(a)*.22,Math.sin(a)*.18,i%5===0?.95:.53)]);
        part(arm,new THREE.TubeGeometry(curve,7,oct?.073:.038,5,false),c,0,0,0,1,1,1);limbs.push(arm);
      }
    }
    if(kind==='fish'||kind==='squid')for(const side of [-1,1])oval(0x19302e,side*(kind==='fish'?.14:.20),.085,kind==='fish'?.45:.56,.055,.055,.061);
    animals.push({kind,model,fins,limbs,x,y,z,phase});
  }
  function seaFloor(x,z){
    const offshore=Math.hypot(x-Island.IC.x,z-Island.IC.z)>540;
    const terrain=offshore?-12.15:Math.max(Island.support(x,z),Island.surf(x,z)[0]);
    const sand=.42+.20*Math.sin(x*.21+Math.sin(z*.14))+.13*Math.sin(z*.27+x*.093);
    return terrain+sand*(1-sm(-8,-.5,terrain));
  }
  function updateBottom(){
    const cx=Math.round(p.x/64)*64,cz=Math.round(p.z/64)*64;if(cx===bottomX&&cz===bottomZ)return;
    bottomX=cx;bottomZ=cz;
    if(!bottom){
      const g=new THREE.PlaneGeometry(288,288,72,72);g.rotateX(-Math.PI/2);
      const sand=new THREE.ShaderMaterial({uniforms:{t:G.uTime,day:G.U.uSunK},vertexShader:`
        varying vec3 bed;void main(){vec4 p=modelMatrix*vec4(position,1.);bed=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
        fragmentShader:`varying vec3 bed;uniform float t;uniform vec3 day;
        float hash(vec2 p){return fract(sin(dot(p,vec2(17.127,91.35)))*4683.73);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
        void main(){vec2 q=bed.xz;float grain=noise(q*9.),silt=noise(q*.43);
          float ridges=sin(q.x*4.+q.y*1.4+2.*sin(q.y*.5)+silt*4.);
          float light=sin(q.x*1.48+sin(q.y*1.13+t*.62))+sin(q.y*1.31+sin(q.x*.92-t*.5));
          float caustic=pow(max(0.,1.-abs(light)*1.8),4.)*(.30+.70*silt);
          vec3 sand=mix(vec3(.28,.32,.24),vec3(.63,.66,.43),silt*.7+.3*grain);
          float sunlight=clamp(length(day)*.37,.12,1.);
          gl_FragColor=vec4(sand*(.32+.61*sunlight+.095*ridges)+vec3(.22,.37,.29)*caustic*sunlight,1.);}`});
      bottom=new THREE.Mesh(g,sand);bottom.name='tidal-sand-bed';reef.add(bottom);
    }
    const pos=bottom.geometry.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setY(i,seaFloor(cx+pos.getX(i),cz+pos.getZ(i)));
    pos.needsUpdate=true;bottom.position.set(cx,0,cz);bottom.geometry.computeBoundingSphere();
  }
  function makeReef(){
    const rocks=[],branches=[],tips=[];
    function stampAt(list,x,y,z,sx,sy,sz,ax,ay,az,color){
      stamp.position.set(x,y,z);stamp.scale.set(sx,sy,sz);stamp.rotation.set(ax,ay,az);stamp.updateMatrix();
      list.push([stamp.matrix.clone(),color]);
    }
    for(let i=0;i<76;i++){
      const angle=random()*TAU,r=i<12?4+random()*12:12+random()*62;
      const x=harbor.x+Math.cos(angle)*r,z=harbor.z+24+Math.sin(angle)*r,y=seaFloor(x,z);
      const s=.5+1.25*random();stampAt(rocks,x,y-.02,z,s,s*.54,s*.81,.09,angle,.13,0x648377);
      const color=[0xe88b6f,0xbc70aa,0xe0b45a,0x72aaa1][i%4];
      for(let j=0;j<6;j++){
        const a=j*TAU/6+angle,dx=Math.cos(a),dz=Math.sin(a),h=.5+random()*.9;
        const stem=new THREE.Vector3(x+dx*.22,y+s*.25,z+dz*.22);
        const fork=stem.clone().add(new THREE.Vector3(dx*.24,h*.65,dz*.24));
        const twig=(from,to,radius)=>{
          stamp.position.copy(from).lerp(to,.5);look.subVectors(to,from);
          stamp.scale.set(radius,look.length(),radius);stamp.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,look.normalize());stamp.updateMatrix();branches.push([stamp.matrix.clone(),color]);
        };
        twig(stem,fork,.084);for(const turn of [-.5,.6]){
          const tip=fork.clone().add(new THREE.Vector3(Math.cos(a+turn)*.30,h*.42,Math.sin(a+turn)*.30));twig(fork,tip,.053);
          stampAt(tips,tip.x,tip.y,tip.z,.073,.092,.073,0,0,0,color);
        }
      }
    }
    for(const [list,g] of [[rocks,new THREE.IcosahedronGeometry(1,1)],[branches,rod],[tips,new THREE.SphereGeometry(1,6,4)]]){
      const batch=new THREE.InstancedMesh(g,mat(0xffffff),list.length);
      list.forEach(([matrix,color],i)=>{batch.setMatrixAt(i,matrix);batch.setColorAt(i,new THREE.Color(color));});
      batch.name=list===rocks?'reef-rocks':'branching-coral';reef.add(batch);
    }
    schools=makeFishSchools(reef,seaFloor,harbor);
    for(const [kind,x,d,z] of [['turtle',-3,4.3,12],['squid',3,6.2,18],['squid',8,5.4,24],['octopus',-1,0,23],['octopus',9,0,32]]){
      makeAnimal(kind,harbor.x+x,d?sea-d:seaFloor(harbor.x+x,harbor.z+z)+.20,harbor.z+z,random()*TAU);
    }
  }
  function build(){
    if(built)return;built=true;world.name='coastal-navigation';world.add(boat,sub,reef);G.scene.add(world);
    makeBoat();makeSub();makeReef();
    for(const [i,[dx,dz]] of course.entries()){
      const m=new THREE.Group(),c=i%2?0x429975:0xcb6545;
      part(m,taper,c,0,.31,0,.6,1.35,.6);part(m,rod,pale,0,1.06,0,.13,.69,.13);
      part(m,orb,c,0,1.47,0,.23,.24,.23);m.position.set(harbor.x+dx,sea,harbor.z+dz);
      m.name='course-buoy-'+(i+1);markers.push(m);world.add(m);
    }
  }
  const ui=document.createElement('div');ui.id='marine-controls';ui.hidden=true;
  ui.innerHTML='<output id="marine-gauges"></output><div id="marine-scope" hidden><span>⌖</span></div><div id="marine-helm"></div>';
  const css=document.createElement('style');css.textContent=`
  #marine-controls{color:#ecfff9;font:600 12px/1.45 system-ui;pointer-events:none}
  #marine-gauges{position:fixed;z-index:4;bottom:18px;right:16px;background:#0b292eea;border-left:3px solid #e6af66;border-radius:4px;padding:8px 12px;white-space:pre;text-align:right;font-variant-numeric:tabular-nums}
  #marine-helm{position:fixed;z-index:6;right:14px;bottom:85px;display:grid;grid-template-columns:repeat(3,auto);gap:5px}
  #marine-helm button{pointer-events:auto;touch-action:none;min-width:44px;min-height:42px;background:#133436e8;color:#f6f4df;border:1px solid #93b8ad88;border-radius:8px;font:inherit}
  #marine-scope{position:fixed;inset:0;z-index:3;background:radial-gradient(circle closest-side,transparent 86%,#0b231ac9 91%,#07110ff5 98%);display:grid;place-items:center}
  #marine-scope span{font:400 54px monospace;color:#d5f7e3b5}
  #marine-controls [hidden]{display:none}@media(max-width:680px){#marine-gauges{bottom:66px}#marine-helm{bottom:129px}}`;
  document.head.append(css);document.body.append(ui);
  const gauges=ui.querySelector('output'),overlay=ui.querySelector('#marine-scope'),helm=ui.querySelector('#marine-helm');
  const labels={left:'◀',up:'전진',right:'▶',down:'후진',rise:'부상',dive:'잠항',scope:'잠망경',zoom:'배율'};
  for(const [id,label] of Object.entries(labels)){
    const b=document.createElement('button');b.type='button';b.dataset.helm=id;b.textContent=label;helm.append(b);
    b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);touching.set(e.pointerId,id);});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>touching.delete(e.pointerId));
    if(id==='scope'||id==='zoom')b.addEventListener('click',()=>{if(id==='scope')toggleScope();else zoom=zoom===1?3:1;b.blur();});
  }
  function toggleScope(){if(active==='sub'){scope=!scope;scopeYaw=0;zoom=1;}}
  addEventListener('keydown',e=>{if(active!=='sub'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input,select,textarea'))return;
    if(e.code==='KeyP')toggleScope();if(e.code==='KeyZ'&&scope)zoom=zoom===1?3:1;
  });
  const canvas=document.getElementById('c');
  canvas.addEventListener('pointerdown',e=>{if(active&&e.button===0){mouse={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(mouse?.id===e.pointerId){
    if(active==='sub'&&scope)scopeYaw-=(e.clientX-mouse.x)*.008/zoom;
    else{orbit-=(e.clientX-mouse.x)*.007;tilt=clamp(tilt+(e.clientY-mouse.y)*.012,-1.4,2.6);}
    mouse.x=e.clientX;mouse.y=e.clientY;
  }});
  function releasePointer(){if(mouse && canvas.hasPointerCapture(mouse.id))canvas.releasePointerCapture(mouse.id);mouse=null;}
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{mouse=null;});
  addEventListener('blur',()=>{touching.clear();releasePointer();});
  function enter(mode){
    build();active=mode;world.visible=true;boat.visible=mode==='boat';sub.visible=mode==='sub';reef.visible=sub.visible;
    p.set(harbor.x,sea,harbor.z);depth=sub.visible?5.3:0;heading=speed=leg=laps=orbit=tilt=scopeBlend=0;scope=false;scopeYaw=0;zoom=1;ui.hidden=false;wake.reset();
    const touch=navigator.maxTouchPoints||matchMedia('(any-pointer:coarse)').matches;
    for(const b of helm.children)b.hidden=['scope','zoom'].includes(b.dataset.helm)?mode!=='sub':!touch || (mode==='boat'&&['rise','dive'].includes(b.dataset.helm));
  }
  function leave(){active='';world.visible=false;touching.clear();releasePointer();ui.hidden=overlay.hidden=true;}
  const down=(action,code,alt)=>Modes.keys.has(code)||Modes.keys.has(alt)||[...touching.values()].includes(action);
  function animateReef(dt){
    for(const a of animals){
      const k=a.kind,t=clock*(k==='fish'?.62:.34)+a.phase, radius=k==='octopus'?.12:k==='fish'?2.4:1.7;
      a.model.position.set(a.x+Math.sin(t)*radius,a.y+(k==='octopus'?.02:.33)*Math.sin(t*1.3),a.z+Math.cos(t)*radius);
      a.model.rotation.y=Math.atan2(Math.cos(t),-Math.sin(t));
      a.fins.forEach((fin,i)=>{if(k==='fish')fin.rotation.y=Math.sin(clock*7+a.phase)*.53;else fin.rotation.z=Math.sin(clock*2.5+i*Math.PI)*.39;});
      a.limbs.forEach((limb,i)=>{limb.rotation.z=Math.sin(clock*2.0+i*.7)*.22;});
    }
  }
  function step(camera,dt){
    clock+=dt;
    const diving=active==='sub', forward=+down('up','KeyW','ArrowUp')-+down('down','KeyS','ArrowDown');
    const turn=+down('left','KeyA','ArrowLeft')-+down('right','KeyD','ArrowRight');
    const lift=+down('rise','KeyE','PageUp')-+down('dive','KeyQ','PageDown');
    if(lift<0)scope=false;
    speed+=(forward*(forward<0?3.4:diving?6.3:13.6)-speed)*(1-Math.exp(-dt*(forward?.63:.90)));
    heading+=turn*dt*(diving?.76:.95)*(.23+.77*sm(0,3,Math.abs(speed)))*(speed<-.12?-1:1);
    const dx=Math.sin(heading),dz=Math.cos(heading),movement=speed*dt;
    const nextX=p.x+dx*movement,nextZ=p.z+dz*movement;
    // Sample the bow as well as the centre so shallows stop a hull before the camera reaches land.
    const bed=seaFloor(nextX+Math.sign(speed)*dx*3.5,nextZ+Math.sign(speed)*dz*3.5);
    if(bed<sea-(diving?depth+1.2:1.0)){p.x=nextX;p.z=nextZ;}else speed*=Math.exp(-dt*10);
    const maxDepth=Math.max(1.40,sea-seaFloor(p.x,p.z)-1.25);
    depth=diving?clamp(scope?depth+clamp(Math.min(scopeDepth,maxDepth)-depth,-2.7*dt,2.7*dt):depth-lift*2.7*dt,1.40,maxDepth):0;
    const bob=Sea.height(p.x,p.z,clock)-sea;
    p.y=diving?sea-depth:sea+bob;const ship=diving?sub:boat;ship.position.copy(p);
    ship.rotation.set(diving?.035*Math.sin(clock):-.026*Math.cos(clock*1.2),heading,(diving?.025:.064)*Math.sin(clock*1.15)-turn*sm(0,9,Math.abs(speed))*.07,'YXZ');
    const ready=diving&&scope&&Math.abs(depth-Math.min(maxDepth,scopeDepth))<.035;
    scopeBlend=clamp(scopeBlend+(ready?1:-1)*dt*1.35,0,1);
    const blend=sm(0,1,scopeBlend),liveScope=scopeBlend>=1;
    overlay.hidden=!liveScope;
    if(diving){
      updateBottom();animateReef(dt);schools.step(p,clock);prop.rotation.z+=dt*(2+Math.abs(speed)*5);
      mast.position.y+=clamp((ready?1.25:0)-mast.position.y,-1.8*dt,1.8*dt);
      mast.rotation.y=scopeYaw;
      sub.visible=true;ui.querySelector('[data-helm=zoom]').hidden=!liveScope;
    }else{
      boatProp.rotation.z=(boatProp.rotation.z+speed*4.5*dt)%TAU;wake.step(p,heading,speed,dt);
      const buoy=markers[leg];if(Math.hypot(p.x-buoy.position.x,p.z-buoy.position.z)<6){leg=(leg+1)%course.length;if(!leg)laps++;}
    }
    for(const m of markers){m.position.y=Sea.height(m.position.x,m.position.z,clock);m.rotation.z=.08*Math.sin(clock+m.position.x);}
    {
      const vx=Math.sin(heading+orbit),vz=Math.cos(heading+orbit);
      eye.set(p.x-vx*(diving?9.3:10.5),p.y+(diving?2.5:3.95)+tilt,p.z-vz*(diving?9.3:10.5));
      if(diving)eye.y=clamp(eye.y,seaFloor(eye.x,eye.z)+.45,sea-.48);
      camera.position.copy(eye);look.set(p.x+vx*4,p.y+(diving?.60:.85),p.z+vz*4);camera.fov=diving?65:56;
      if(diving&&blend>0){
        scopeLens.getWorldPosition(lensAt);const a=heading+scopeYaw;
        lensAim.copy(lensAt);lensAim.x+=50*Math.sin(a);lensAim.z+=50*Math.cos(a);
        camera.position.lerp(lensAt,blend);look.lerp(lensAim,blend);camera.fov=liveScope?43/zoom:lerp(65,43/zoom,blend);
      }
    }
    camera.lookAt(look);camera.near=.11;
    const compass=a=>String((Math.round(-a*180/Math.PI)%360+360)%360).padStart(3,'0');
    const bearing=compass(heading+(liveScope?scopeYaw:0));
    const waypoint=markers[leg].position,distance=Math.round(Math.hypot(waypoint.x-p.x,waypoint.z-p.z));
    gauges.textContent=diving?'수심 '+depth.toFixed(1)+' m  ·  '+bearing+'°\n'+(scope?(liveScope?'잠망경 ×'+zoom:'잠망경 수심으로 부상 중'):'해저 여유 '+(sea-seaFloor(p.x,p.z)-depth-1.12).toFixed(1)+' m'):
      '항속 '+(Math.abs(speed)*1.944).toFixed(1)+' kn  ·  '+bearing+'°\n부표 '+(leg+1)+' / '+course.length+'  ·  '+distance+' m  ·  '+compass(Math.atan2(waypoint.x-p.x,waypoint.z-p.z))+'°'+(laps?'  ·  '+laps+'바퀴':'');
    return diving?(liveScope?'드래그로 잠망경 회전 · Z 배율 · P 복귀':'W/S 전후진 · A/D 선회 · Q 잠항 · E 부상 · P 잠망경'):'W/S 전후진 · A/D 조타 · 부표를 순서대로 통과';
  }
  Modes.add('boat',{name:'해안 항해',enter:()=>enter('boat'),leave,step},'Digit6','6');
  Modes.add('sub',{name:'잠수함',enter:()=>enter('sub'),leave,step},'Digit7','7');
  return {rescue(x,z,yaw){Modes.set('boat');p.set(x,sea,z);heading=yaw;},get waypoint(){return markers[leg]?.position;},get position(){return p;},get state(){return {mode:active,depth,heading,speed,position:p.toArray(),scope,leg,laps};}};
})();
