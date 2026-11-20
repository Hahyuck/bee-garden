'use strict';
const Studio=(()=>{
  const repo='https://github.com/Hahyuck/bee-garden/tree/main/engine';
  const rows=new Map(), props=new Map(), actors=new Map(), urls=new Map(), mixers=new Map();
  let database=null, projectMode=false, busy=false;
  const open=document.createElement('button');open.id='studio-open';open.type='button';open.textContent='제작';open.setAttribute('aria-expanded','false');
  const panel=document.createElement('section');panel.id='engine-studio';panel.hidden=true;panel.setAttribute('aria-label','게임 제작');
  panel.innerHTML=`<header><h2>게임 제작</h2><button data-close aria-label="제작 닫기">×</button></header>
    <fieldset><legend>GLB 추가</legend><div class="studio-row"><select data-role aria-label="모델 용도"><option value="prop">월드 오브젝트</option><option value="character">플레이 캐릭터</option></select>
    <label>높이(m)<input data-height type="number" min=".05" max="100" step=".05" value="1.7"></label></div>
    <label class="studio-file">파일 선택<input type="file" data-file accept=".glb,model/gltf-binary"></label>
    <div class="studio-row" data-library hidden><select data-model aria-label="추가한 GLB"></select><button data-use>보기</button><button data-remove>삭제</button></div></fieldset>
    <label>만들고 싶은 게임<textarea data-idea rows="3" placeholder="예: 잠수함을 조종해 산호초를 돌며 거북이를 찾는 2.5D 탐험 게임"></textarea></label>
    <div class="studio-row"><button class="primary" data-copy>제작 프롬프트 복사</button><button data-export>프로젝트 JSON</button></div>
    <p>복사한 프롬프트를 사용하는 AI 코딩 도구에 붙여 넣으세요.</p><output aria-live="polite"></output>`;
  const css=document.createElement('style');css.textContent=`
    #studio-open,#engine-studio{position:fixed;right:max(14px,env(safe-area-inset-right));z-index:8;color:#f4f0e3;background:#142827f5;border:1px solid #91aba077;border-radius:9px;font:600 13px/1.45 system-ui;box-sizing:border-box;color-scheme:dark}
    #studio-open{top:141px;min-height:35px;padding:5px 13px;cursor:pointer}
    #engine-studio{top:48px;width:min(345px,calc(100vw - 26px));max-height:calc(100dvh - 65px);padding:15px;overflow:auto;overscroll-behavior:contain;box-shadow:0 10px 36px #0006}
    #engine-studio header,#engine-studio .studio-row{display:flex;align-items:center;gap:7px}
    #engine-studio header{justify-content:space-between}#engine-studio h2{font-size:18px;margin:0}
    #engine-studio label{display:grid;gap:3px;margin:8px 0 4px}#engine-studio legend,#engine-studio label{color:#cfddd2}
    #engine-studio :is(button,input,select,textarea){font:inherit;color:#f4f2df;background:#213937;border:1px solid #87a69b66;border-radius:6px;padding:6px;box-sizing:border-box;min-width:0}
    #engine-studio button{cursor:pointer}#engine-studio textarea{resize:vertical;width:100%}#engine-studio select{flex:1}
    #engine-studio .primary{background:#bde1c7;color:#17342c}#engine-studio fieldset{border:1px solid #91aba057;margin:12px 0;padding:8px;border-radius:7px}
    #engine-studio .studio-row label{max-width:86px;margin:0}#engine-studio .studio-file{font-size:12px}#engine-studio [data-library]{margin-top:9px}
    #engine-studio p,#engine-studio output{font-size:12px}#engine-studio output{color:#cde8bd}#engine-studio [hidden]{display:none}
  `;document.head.append(css);document.body.append(open,panel);
  const get=name=>panel.querySelector('[data-'+name+']');
  const status=panel.querySelector('output'), file=get('file'), library=get('model'), idea=get('idea');
  function show(on){panel.hidden=!on;open.hidden=on;open.setAttribute('aria-expanded',String(on));Modes.keys.clear();
    if(on&&document.pointerLockElement)document.exitPointerLock();
  }
  open.onclick=()=>show(true);get('close').onclick=()=>show(false);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape')show(false);e.stopPropagation();});
  function db(){
    if(!database)database=new Promise((resolve,reject)=>{
      const req=indexedDB.open('bee-garden-studio',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('assets',{keyPath:'id'});
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    return database;
  }
  async function storage(op,value){
    const store=await db();return new Promise((ok,no)=>{
      const tx=store.transaction('assets',op==='getAll'?'readonly':'readwrite'),s=tx.objectStore('assets');
      const req=op==='getAll'?s.getAll():s[op](value);tx.oncomplete=()=>ok(req.result);tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error);
    });
  }
  function libraryState(){
    get('library').hidden=rows.size===0;
    const row=rows.get(library.value);get('use').textContent=row?.role==='character'?'조종':'보기';
  }
  library.onchange=libraryState;
  function mark(row){
    rows.set(row.id,row);library.add(new Option(row.name,row.id));library.value=row.id;libraryState();
  }
  async function load(row,src){
    if(row.role==='character'){
      const entry={id:row.id,label:row.name,height:row.height,file:src,category:'person',custom:true};
      actors.set(row.id,entry);WalkActions.addPerson(entry);
    }else{
      const {scene,animations}=await window.createGardenGLTFLoader(THREE).loadAsync(src);
      const bounds=new THREE.Box3().setFromObject(scene,true),size=bounds.getSize(new THREE.Vector3());
      if(!Number.isFinite(size.y)||size.y<=.00001)throw Error('크기가 있는 3D 메시가 필요합니다.');
      const holder=new THREE.Group(),center=bounds.getCenter(new THREE.Vector3()),k=row.height/size.y;
      holder.name='studio-prop-'+row.id;holder.add(scene);scene.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
      holder.scale.setScalar(k);holder.position.set(row.x,Island.support(row.x,row.z),row.z);holder.rotation.y=row.yaw||0;
      holder.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});G.scene.add(holder);holder.updateMatrixWorld(true);
      props.set(row.id,{holder,remove:Phys.meshSolid(holder)});
      if(animations.length){const m=new THREE.AnimationMixer(scene);m.clipAction(animations[0]).play();mixers.set(row.id,m);}
    }
    mark(row);
  }
  async function use(id){
    const character=actors.get(id);
    if(character){Modes.set('actors');if(!await ActorWalk.selectHuman(character))throw Error('캐릭터 GLB를 읽을 수 없습니다.');}
    else {
      const holder=props.get(id)?.holder;if(!holder)return;
      Modes.set('free');const h=rows.get(id).height,d=Math.max(2.5,h*1.7),p=holder.position;
      Modes.fly.p.set(p.x+d*.65,p.y+h*.73+1,p.z+d);
      Modes.fly.yaw=Math.atan2(d*.65,d);Modes.fly.pitch=Math.atan2(p.y+h*.47-Modes.fly.p.y,d*1.19);
    }
  }
  async function remove(id,persist){
    const holder=props.get(id)?.holder;
    if(holder){
      props.get(id).remove();holder.removeFromParent();mixers.get(id)?.stopAllAction();mixers.delete(id);
      const geometries=new Set(),materials=new Set(),textures=new Set();
      holder.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of [].concat(o.material))materials.add(m);});
      for(const m of materials){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();}
      for(const g of geometries)g.dispose();for(const t of textures)t.dispose();props.delete(id);
    }
    if(actors.has(id)){if(ActorWalk.currentId===id)await ActorWalk.selectHuman(null);WalkActions.removePerson(id);actors.delete(id);}
    if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id);}
    rows.delete(id);for(const o of library.options)if(o.value===id){o.remove();break;}libraryState();
    if(persist)await storage('delete',id);
  }
  get('use').onclick=async()=>{try{await use(library.value);show(false);}catch(e){status.textContent=e.message;}};
  get('remove').onclick=async()=>{try{await remove(library.value,!projectMode);status.textContent='목록에서 삭제했습니다.';}catch(e){status.textContent=e.message;}};
  function place(){
    const p=Modes.cur==='actors'?ActorWalk.position:G.camera.position;
    const v=G.camera.getWorldDirection(new THREE.Vector3());v.y=0;v.normalize();
    let x=p.x+v.x*3,z=p.z+v.z*3;
    if(Island.support(x,z)<CFG.sea.level+.2){x=Island.GP.x+4+props.size*2;z=Island.GP.z+4;}
    return {x,z};
  }
  file.onchange=async()=>{
    const f=file.files[0];file.value='';if(!f||busy)return;busy=true;file.disabled=true;
    const id='user-'+(crypto.randomUUID?.()||Date.now().toString(36));
    try{
      if(!/\.glb$/i.test(f.name))throw Error('GLB 파일을 선택해 주세요.');
      const header=new DataView(await f.slice(0,12).arrayBuffer());
      if(header.byteLength!==12||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2)throw Error('glTF 2.0 바이너리(GLB) 파일이 필요합니다.');
      const h=get('height').valueAsNumber;if(!Number.isFinite(h)||h<.05||h>100)throw Error('높이는 0.05~100m 사이로 입력해 주세요.');
      const row={id,name:f.name.replace(/\.glb$/i,''),filename:f.name,role:get('role').value,height:h,...place(),yaw:0};
      const src=URL.createObjectURL(f);urls.set(id,src);await load(row,src);await use(id);
      if(projectMode){status.textContent=f.name+' · 프로젝트에 추가했습니다. JSON으로 내보낼 수 있습니다.';return;}
      try{await storage('put',{...row,blob:f});status.textContent=f.name+' · 이 브라우저에 저장했습니다.';}
      catch{status.textContent=f.name+' · 현재 세션에 추가했습니다. 브라우저 저장 공간을 사용할 수 없습니다.';}
    }catch(e){await remove(id,false);status.textContent=e.message;}finally{busy=false;file.disabled=false;}
  };
  function manifest(){
    return {version:1,description:idea.value.trim(),mode:Modes.cur,style:VisualStyle.current,raster:VisualStyle.raster,pixelFit:PixelFit.choice,
      character:ActorWalk.currentId,scenario:Scenario.config,
      assets:[...rows.values()].map(({id,name,role,height,x,z,yaw,filename,path})=>({id,name,role,height,x,z,yaw,path:path||'assets/project/'+filename}))};
  }
  function prompt(){
    const spec=manifest();
    return repo+'\n\n만들고 싶은 게임\n'+(spec.description||'플레이 목표, 조작, 클리어 조건을 적어 주세요.')+
      '\n\n이 저장소의 engine을 기반으로 구현해 주세요. engine/README.md와 engine/GUIDE.md를 읽고, 기존 모드와 물리·입력·렌더러를 재사용해 주세요. 아래 프로젝트 설정과 첨부한 GLB를 반영하고 브라우저에서 직접 실행해 검증해 주세요.\n'+JSON.stringify(spec,null,2);
  }
  get('copy').onclick=async()=>{
    const s=prompt();try{await navigator.clipboard.writeText(s);status.textContent='저장소 링크와 제작 요청을 복사했습니다.';}
    catch{const area=document.createElement('textarea');area.value=s;panel.append(area);area.select();status.textContent='선택된 프롬프트를 복사하세요.';}
  };
  get('export').onclick=()=>{
    const blob=new Blob([JSON.stringify(manifest(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.download='project.json';a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='GLB를 assets/project/에 함께 두고 ?project=project.json으로 실행하세요.';
  };
  async function restore(){
    const config=Q.get('project');projectMode=!!config;
    try{
      if(config){
        const url=new URL(config,location.href);if(url.origin!==location.origin)throw Error('같은 사이트의 프로젝트 JSON을 선택해 주세요.');
        const res=await fetch(url);if(!res.ok)throw Error('프로젝트 설정을 열 수 없습니다.');
        const spec=await res.json();if(spec.version!==1||!Array.isArray(spec.assets))throw Error('지원하지 않는 프로젝트 형식입니다.');
        idea.value=spec.description||'';VisualStyle.select(Q.get('style')||spec.style,Q.get('raster')||spec.raster);
        PixelFit.select(Q.get('pixelFit')??spec.pixelFit);
        for(const item of spec.assets){
          const src=new URL(item.path,url);if(src.origin!==location.origin||!['character','prop'].includes(item.role)||!Number.isFinite(item.height)||item.height<=0||!item.id||rows.has(item.id))throw Error('모델 설정을 확인해 주세요.');
          const row={...item,x:Number.isFinite(item.x)?item.x:Island.GP.x,z:Number.isFinite(item.z)?item.z:Island.GP.z};await load(row,src.href);
        }
        const character=actors.get(spec.character)||SampleBrowser.character(spec.character);
        if(character)await ActorWalk.selectHuman(character.id==='kate'?null:character);
        if(spec.scenario)Scenario.apply(spec.scenario);
        VisualStyle.select(Q.get('style')||spec.style);Modes.set(Q.get('mode')||spec.mode||'actors');
      }else{
        try{const pref=JSON.parse(localStorage.getItem('garden.studio.look')||'[]');VisualStyle.select(Q.get('style')||pref[0],Q.get('raster')||pref[1]);PixelFit.select(Q.get('pixelFit')??pref[2]);}catch{}
        for(const {blob,...row} of await storage('getAll')){const url=URL.createObjectURL(blob);urls.set(row.id,url);await load(row,url);}
      }
    }catch(e){status.textContent=e.message;if(config)show(true);}
    libraryState();VisualControls.refresh();
  }
  G.tick.push((t,dt)=>{for(const mixer of mixers.values())mixer.update(dt);});
  return {restore,manifest,prompt};
})();
