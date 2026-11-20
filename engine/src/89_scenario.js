'use strict';
const Scenario=(()=>{
  const modes=['free','bee','actors','fps','drive','flight','boat','sub','fishing','collect'];
  const weather=['clear','rain','snow','frost','auto'];
  const object={fishing:'물고기 잡기',fps:'표적 명중',boat:'부표 통과',drive:'관문 통과',collect:'통 수집'};
  const max={drive:4,collect:10};
  const schema={type:'object',properties:{title:{type:'string'},mode:{type:'string',enum:modes},style:{type:'string',enum:Object.keys(VisualStyle.names)},
    weather:{type:'string',enum:weather},hour:{type:'number',minimum:0,maximum:23.75},target:{type:'integer',minimum:1,maximum:5000}},required:['title','mode','style','weather','hour','target'],additionalProperties:false};
  let config=null,progress=0,previous=0,first=true,done=false;
  const prev=new THREE.Vector3(),pos=new THREE.Vector3();
  const output=document.createElement('output');output.id='scenario-goal';output.hidden=true;document.body.append(output);
  function validate(v){
    if(!v||typeof v.title!=='string'||!v.title.trim()||!modes.includes(v.mode)||!Object.hasOwn(VisualStyle.names,v.style)||!weather.includes(v.weather)||!Number.isInteger(v.target)||v.target<1)throw Error('게임 설정 형식을 확인해 다시 생성해 주세요.');
    return {title:v.title.trim().slice(0,64),mode:v.mode,style:v.style,weather:v.weather,hour:clamp(Number.isFinite(v.hour)?v.hour:G.day,0,23.75),target:Math.min(v.target,max[v.mode]||(object[v.mode]?100:5000))};
  }
  function count(m){switch(m){case 'fishing':return Fishing.catches;case 'boat':return Marine.state.laps*6+Marine.state.leg;
    case 'fps':return PulseRange.hits;case 'collect':return Collect.score;case 'drive':return DriveRace.completedGates;}}
  function goal(v){return (object[v.mode]||'이동 거리')+' '+v.target+(object[v.mode]?'회':' m');}
  function apply(v,restart=false){
    const valid=validate(v);Modes.set(valid.mode,restart);VisualStyle.select(valid.style);Weather.set(valid.weather);G.day=valid.hour;
    config=valid;progress=0;done=false;first=true;previous=count(valid.mode)||0;output.hidden=false;paint();
  }
  function paint(){output.textContent=config.title+' · '+(done?'목표 달성':goal(config)+'  ('+Math.min(Math.floor(progress),config.target)+'/'+config.target+')');}
  G.tick.push(()=>{
    if(!config)return;
    output.hidden=Modes.cur!==config.mode;if(output.hidden){first=true;return;}if(done)return;
    const n=count(config.mode);
    if(n!==undefined){progress+=Math.max(0,n-previous);previous=n;}
    else{
      if(config.mode==='actors')pos.copy(ActorWalk.position);
      else if(config.mode==='sub')pos.copy(Marine.position);
      else if(config.mode==='flight'&&!ActorWalk.thirdPerson)pos.fromArray(Airfield.state.position);
      else pos.copy(G.camera.position);
      if(!first)progress+=Math.min(20,prev.distanceTo(pos));prev.copy(pos);
    }
    first=false;done=progress>=config.target;paint();
  });
  function draft(text,current,edit){
    const mode=[['fishing',/낚|떡밥|fishing/i],['sub',/잠수|산호|잠망|해저|거북|submarine/i],['boat',/항해|부표|보트|항구|boat/i],['drive',/운전|차량|레이싱|경주|드리프트|race/i],
      ['fps',/사격|표적|조준|fps/i],['flight',/경비행|비행기|이륙|활주로|plane/i],['bee',/꿀벌|꽃가루|벌이|꿀모/i],['collect',/수집|통을|아이템/i],['actors',/캐릭터|등반|벽타|산행|탐험|달리/i]].find(([,r])=>r.test(text))?.[0]||(edit&&modes.includes(current.mode)?current.mode:'actors');
    const style=[['gaussian',/가우시안/],['diorama',/디오라마/],['yeoul-3d',/흑연/],['cradle-3d',/클린\s*픽셀/],['yeoul-2d',/단색\s*도트/],['yeoul-25d',/디더링/],['cradle-25d',/2\.5D|HD-2D/i],['cradle-2d',/2D|클린.?도트/i],['pixel',/픽셀/]].find(([,r])=>r.test(text))?.[0]||(edit?current.style:'native');
    const target=Number(text.match(/(\d+)\s*(?:마리|개|회|미터|m\b)/i)?.[1])||(object[mode]?3:100);
    return validate({title:text.split(/[\r\n]/)[0].slice(0,42),mode,style,weather:/눈|설원/.test(text)?'snow':/비가|폭우|빗|비 오는/.test(text)?'rain':edit&&weather.includes(Weather.S.mode)?Weather.S.mode:'clear',hour:/밤|야간/.test(text)?22:/노을|해질/.test(text)?18:/새벽/.test(text)?6:edit?G.day:14,target});
  }
  async function generate(text,provider,model,edit){
    const current=Studio.manifest(),baseline=draft(text,current,edit);if(provider==='template')return baseline;
    const system='Design a playable Bee Garden scenario. Return only JSON matching the schema. Use a short title in the language of the user. Target is catch count in fishing, hits in fps, buoys in boat, gates in drive (max 4), barrels in collect (max 10), meters otherwise. Preserve unspecified settings when revising. Style names: '+JSON.stringify(VisualStyle.names)+'. Schema: '+JSON.stringify(schema);
    const message=JSON.stringify({request:text,operation:edit?'revise':'new',current:{mode:current.mode,style:current.style,weather:Weather.S.mode,hour:G.day,scenario:current.scenario}});
    if(provider==='browser'){
      const lm=globalThis.LanguageModel;if(!lm||await lm.availability()==='unavailable')throw Error('이 브라우저에서 기기 내 AI를 사용할 수 없습니다. 로컬 Ollama 또는 즉시 규칙 초안을 선택하세요.');
      const session=await lm.create({initialPrompts:[{role:'system',content:system}]});
      try{return validate(JSON.parse(await session.prompt(message,{responseConstraint:schema})));}finally{session.destroy();}
    }
    const base=location.port==='11435'?'': 'http://127.0.0.1:11435';
    const res=await fetch(base+'/studio/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,system,message,schema}),signal:AbortSignal.timeout(100000)});
    if(!res.ok)throw Error('로컬 AI 서버가 응답하지 않았습니다 ('+res.status+'). 연결 방법을 확인하세요.');
    return validate(await res.json());
  }
  return {apply,generate,validate,goal,get config(){return config;}};
})();
