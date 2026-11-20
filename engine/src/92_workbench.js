'use strict';
const Workbench=(()=>{
  const bar=document.createElement('nav'), form=document.createElement('form');
  bar.id='world-bar';bar.setAttribute('aria-label','월드 메뉴');form.id='game-composer';
  bar.innerHTML=`<div class="bar-main"><button type="button" data-menu="play" aria-controls="play-row">플레이 모드</button>
    <button type="button" data-menu="visual" aria-controls="game-visual">게임 비주얼</button><button type="button" data-menu="tools" aria-controls="tools-row">도구</button></div>
    <div id="play-row" class="bar-row" aria-label="플레이 모드" hidden></div>
    <div id="tools-row" class="bar-row" aria-label="도구" hidden><label>날씨 <select data-weather></select></label><label>시각 <input data-hour type="range" min="0" max="23.75" step=".25"><output data-time></output></label></div>`;
  form.innerHTML=`<div class="composer-line"><label for="game-idea">제작할 게임</label><input id="game-idea" required maxlength="1800" autocomplete="off" placeholder="만들고 싶은 게임을 입력하세요"><button type="submit">만들기</button>
    <button type="button" data-settings aria-controls="composer-settings" aria-expanded="false">설정</button></div>
    <section id="composer-settings" hidden><div class="choices"><label>작업 <select name="operation"><option value="new">새 게임 만들기</option><option value="edit">현재 게임 개편</option></select></label>
    <label>생성 방법 <select name="provider"><option value="local">로컬 AI · Ollama</option><option value="browser">브라우저 내장 AI</option><option value="template">즉시 규칙 초안</option></select></label></div>
    <details data-connect><summary>로컬 AI 연결 방법</summary><p>Ollama와 <code>python engine/tools/serve_studio.py</code>를 실행하고 설치된 모델 이름을 입력하세요.</p><label>Ollama 모델 <input name="model" value="qwen2.5:7b" maxlength="100"></label></details>
    <output data-status aria-live="polite"></output><article data-preview hidden><strong></strong><p></p><button type="button" data-apply>이 설정으로 플레이</button></article></section>`;
  document.body.append(bar,form);
  const picker=document.querySelector('#mode-picker'), visual=document.querySelector('#game-visual');
  picker.hidden=true;bar.append(picker,visual);
  const play=bar.querySelector('#play-row'),tools=bar.querySelector('#tools-row'),buttons=[...bar.querySelectorAll('[data-menu]')];
  const rows={play,visual,tools},settings=form.querySelector('#composer-settings'),settingsButton=form.querySelector('[data-settings]');
  const input=form.querySelector('#game-idea'),status=form.querySelector('[data-status]'),preview=form.querySelector('[data-preview]');
  const {provider,operation,model}=form.elements;
  let current=null,proposal=null,revision=0;
  function syncMode(){
    const selected=picker.selectedOptions[0];
    buttons[0].textContent=selected?.textContent||'플레이 모드';buttons[0].setAttribute('aria-label','플레이 모드 · '+buttons[0].textContent);
    for(const b of play.children)b.setAttribute('aria-current',String(b.dataset.mode===picker.value));
  }
  function showSettings(show){
    settings.hidden=!show;settingsButton.setAttribute('aria-expanded',String(show));
  }
  function open(id){
    if(id==='make'){open(null);showSettings(true);input.focus();return;}
    current=id;
    for(const b of buttons){const on=b.dataset.menu===id;b.setAttribute('aria-expanded',String(on));rows[b.dataset.menu].hidden=!on;}
    if(!id)return;
    if(document.pointerLockElement)document.exitPointerLock();
    Modes.keys.clear();showSettings(false);
    if(id==='visual')VisualControls.refresh();
    if(id==='tools'){weather.value=Weather.S.mode;hour.value=G.day;time.textContent=Math.floor(G.day)+'시';}
    if(id==='play')play.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  for(const b of buttons)b.onclick=()=>open(current===b.dataset.menu?null:b.dataset.menu);
  function addButton(parent,label,fn){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;parent.append(b);return b;
  }
  for(const opt of picker.options)if(!opt.disabled){
    const b=addButton(play,opt.text,()=>{open(null);Modes.set(opt.value);});b.dataset.mode=opt.value;
  }
  picker.addEventListener('modechange',syncMode);
  const click=id=>document.getElementById(id).click();
  const links=document.createElement('div');links.className='tool-links';tools.prepend(links);
  for(const [label,fn] of [['GLB · 프로젝트',()=>click('studio-open')],['모델 샘플',()=>click('sample-button')],['조명',()=>LookPanel.open()],['활용법',()=>Guide.toggle()]]){
    addButton(links,label,()=>{open(null);fn();});
  }
  const sound=addButton(links,'소리',()=>{click('engine-sound');sound.textContent=document.querySelector('#engine-sound').textContent;});
  const weather=tools.querySelector('[data-weather]'),hour=tools.querySelector('[data-hour]'),time=tools.querySelector('[data-time]');
  for(const [id,label] of Object.entries(Weather.NAME))weather.add(new Option(label,id));
  weather.onchange=()=>Weather.set(weather.value);
  hour.oninput=()=>{G.day=+hour.value;time.textContent=Math.floor(G.day)+'시';};
  settingsButton.onclick=()=>{open(null);showSettings(settings.hidden);};
  form.addEventListener('input',()=>{
    revision++;proposal=null;preview.hidden=true;status.textContent='';
    form.querySelector('[data-connect]').hidden=provider.value!=='local';
    form.querySelector('[type=submit]').disabled=false;
  });
  form.onsubmit=async e=>{
    e.preventDefault();const request=input.value.trim();if(!request){input.focus();return;}
    open(null);showSettings(true);
    const id=++revision,button=form.querySelector('[type=submit]');button.disabled=true;proposal=null;preview.hidden=true;
    status.textContent=provider.value==='template'?'규칙을 구성하는 중…':'AI 응답을 기다리는 중…';
    try{const p=await Scenario.generate(request,provider.value,model.value.trim(),operation.value==='edit');
      if(id!==revision)return;proposal=p;preview.hidden=false;preview.querySelector('strong').textContent=p.title;
      preview.querySelector('p').textContent=[Modes.MODES[p.mode].name,VisualStyle.names[p.style],Weather.NAME[p.weather],Math.floor(p.hour)+'시',Scenario.goal(p)].join(' · ');status.textContent='초안을 확인하세요.';
    }catch(err){if(id===revision)status.textContent=err instanceof TypeError?'AI 연결 실패. 로컬 AI 연결 방법을 확인하거나 즉시 규칙 초안을 선택하세요.':err.message;}
    finally{if(id===revision)button.disabled=false;}
  };
  form.querySelector('[data-apply]').onclick=()=>{if(!proposal)return;Scenario.apply(proposal,operation.value==='new');
    const idea=document.querySelector('[data-idea]');if(idea)idea.value=input.value;showSettings(false);document.activeElement?.blur();};
  for(const region of [bar,form]){
    region.addEventListener('keydown',e=>{
      e.stopPropagation();if(e.isComposing||e.keyCode===229)return;
      if(e.key==='Escape'){e.preventDefault();if(region===form){showSettings(false);document.activeElement?.blur();}
        else{const trigger=buttons.find(b=>b.dataset.menu===current);open(null);trigger?.focus();}}
      const b=e.target.closest('#play-row button');
      if(b&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const all=[...play.children],i=all.indexOf(b);
        all[e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:all.length-1))%all.length].focus();}
    });
    region.addEventListener('keyup',e=>e.stopPropagation());
  }
  document.addEventListener('pointerdown',e=>{if(current&&!bar.contains(e.target))open(null);if(!form.contains(e.target))showSettings(false);});
  open(null);syncMode();
  function build(){
    sound.textContent=document.getElementById('engine-sound').textContent;
    const target=Q.get('menu');if(target==='make'||Object.hasOwn(rows,target))open(target);
  }
  return {build,open};
})();
