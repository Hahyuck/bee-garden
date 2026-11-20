'use strict';
const Scenario=(()=>{
  const modes=['free','bee','actors','fps','drive','flight','boat','sub','fishing','collect'];
  const weather=['clear','rain','snow','frost','auto'];
  const object={fishing:'물고기 잡기',fps:'표적 명중',boat:'부표 통과',drive:'관문 통과',collect:'통·돌 낙하'};
  const max={drive:4};
  let config=null,progress=0,previous=0,first=true,done=false;
  const prev=new THREE.Vector3(),pos=new THREE.Vector3();
  const output=document.createElement('output');output.id='scenario-goal';output.hidden=true;document.body.append(output);
  function validate(v){
    if(!v||typeof v.title!=='string'||!v.title.trim()||!modes.includes(v.mode)||!Object.hasOwn(VisualStyle.names,v.style)||!weather.includes(v.weather)||!Number.isInteger(v.target)||v.target<1)throw Error('게임 설정 형식을 확인해 다시 생성해 주세요.');
    return {title:v.title.trim().slice(0,64),mode:v.mode,style:v.style,weather:v.weather,hour:clamp(Number.isFinite(v.hour)?v.hour:G.day,0,23.75),target:Math.min(v.target,max[v.mode]||(object[v.mode]?100:5000))};
  }
  function count(m){switch(m){case 'fishing':return Fishing.catches;case 'boat':return Marine.state.laps*6+Marine.state.leg;
    case 'fps':return PulseRange.hits;case 'collect':return FallingProps.count;case 'drive':return DriveRace.completedGates;}}
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
  return {apply,validate,goal,get config(){return config;}};
})();
