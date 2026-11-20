'use strict';
const Workbench=(()=>{
  const bar=document.createElement('nav'), form=document.createElement('form');
  bar.id='world-bar';bar.setAttribute('aria-label','월드 메뉴');form.id='game-composer';
  bar.innerHTML=`<div class="bar-main"><button type="button" data-menu="play" aria-controls="play-row">플레이 모드</button>
    <button type="button" data-menu="visual" aria-controls="game-visual">게임 비주얼</button><button type="button" data-menu="tools" aria-controls="tools-row">도구</button></div>
    <div id="play-row" class="bar-row" aria-label="플레이 모드" hidden></div>
    <div id="tools-row" class="bar-row" aria-label="도구" hidden><label>날씨 <select data-weather></select></label><label>시각 <input data-hour type="range" min="0" max="23.75" step=".25"><output data-time></output></label></div>`;
  form.innerHTML=`<div class="composer-line"><label for="game-idea">제작할 게임</label><input id="game-idea" required maxlength="1800" autocomplete="off" placeholder="만들고 싶은 게임을 입력하세요">
    <select name="provider" aria-label="제작 AI"><option value="codex">GPT · Codex</option><option value="claude">Claude Code</option></select><button type="submit">AI로 열기</button>
    <button type="button" data-settings aria-controls="composer-settings" aria-expanded="false">설정</button></div>
    <section id="composer-settings" hidden><div class="choices"><label>작업 <select name="operation"><option value="new">새 게임 만들기</option><option value="edit">현재 게임 개편</option></select></label></div>
    <p data-instructions></p><output data-status aria-live="polite"></output>
    <div data-recovery hidden><button type="button" data-copy>요청문 복사</button> <a data-web target="_blank" rel="noopener noreferrer"></a>
    <textarea data-full hidden readonly aria-label="전체 제작 요청문" rows="4"></textarea></div></section>`;
  document.body.append(bar,form);
  const picker=document.querySelector('#mode-picker'), visual=document.querySelector('#game-visual');
  picker.hidden=true;bar.append(picker,visual);
  const play=bar.querySelector('#play-row'),tools=bar.querySelector('#tools-row'),buttons=[...bar.querySelectorAll('[data-menu]')];
  const rows={play,visual,tools},settings=form.querySelector('#composer-settings'),settingsButton=form.querySelector('[data-settings]');
  const input=form.querySelector('#game-idea'),status=form.querySelector('[data-status]');
  const {provider,operation}=form.elements,help=form.querySelector('[data-instructions]'),recovery=form.querySelector('[data-recovery]');
  const web=recovery.querySelector('[data-web]'),full=recovery.querySelector('[data-full]');
  let current=null,lastPrompt='';
  try{
    if(localStorage.getItem('garden.creator')==='claude')provider.value='claude';
    input.value=sessionStorage.getItem('garden.gameIdea')||'';
    if(sessionStorage.getItem('garden.operation')==='edit')operation.value='edit';
  }catch{}
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
  function describeAgent(){
    const claude=provider.value==='claude';
    help.textContent=claude?'Claude Code 웹에서 GitHub 저장소와 요청문을 확인한 뒤 보내세요.':'Codex 앱에서 Git 저장소와 요청문을 확인한 뒤 보내세요. 처음에는 이 저장소의 작업 폴더를 선택해야 할 수 있습니다.';
    web.href=claude?'https://claude.ai/code?repositories='+encodeURIComponent(Studio.repository):'https://chatgpt.com/codex';
    web.textContent=claude?'Claude Code 웹 열기':'Codex 웹 열기';
  }
  describeAgent();
  form.addEventListener('input',()=>{
    lastPrompt='';status.textContent='';recovery.hidden=true;full.hidden=true;full.value='';describeAgent();
    try{localStorage.setItem('garden.creator',provider.value);sessionStorage.setItem('garden.gameIdea',input.value);sessionStorage.setItem('garden.operation',operation.value);}catch{}
  });
  form.onsubmit=e=>{
    e.preventDefault();const request=input.value.trim();if(!request){input.focus();return;}
    open(null);showSettings(true);
    const idea=document.querySelector('#engine-studio [data-idea]');if(idea)idea.value=request;
    lastPrompt=Studio.prompt(request,operation.value);recovery.hidden=false;full.hidden=true;
    const claude=provider.value==='claude',encoded=encodeURIComponent(lastPrompt);
    const href=claude?web.href+'&prompt='+encoded:'codex://threads/new?originUrl='+encodeURIComponent(Studio.remote+'.git')+'&prompt='+encoded;
    // Protocol handlers and web gateways have different limits. Keep the full request available on return.
    if(href.length>(claude?24000:28000)){
      full.value=lastPrompt;full.hidden=false;
      status.textContent='요청문이 링크에 담기에는 깁니다. 전체 요청문을 복사해 아래 웹 작업창에 붙여 넣으세요.';return;
    }
    const launch=document.createElement('a');launch.href=href;launch.rel='noopener noreferrer';
    if(claude)launch.target='_blank';
    document.body.append(launch);launch.click();launch.remove();
    status.textContent=claude?'새 탭에서 보내기를 누르면 제작을 시작합니다.':'앱 열기를 허용한 뒤 보내세요. 앱이 열리지 않으면 요청문을 복사해 Codex 웹에서 사용할 수 있습니다.';
  };
  recovery.querySelector('[data-copy]').onclick=async()=>{
    const text=lastPrompt;if(!text)return;
    try{await navigator.clipboard.writeText(text);if(text===lastPrompt)status.textContent='전체 제작 요청문을 복사했습니다.';}
    catch{if(text!==lastPrompt)return;full.value=text;full.hidden=false;full.focus();full.select();status.textContent='선택된 전체 요청문을 복사하세요.';}
  };
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
