'use strict';
const Workbench=(()=>{
  const descriptions={
    free:'섬과 해안을 자유롭게 둘러봅니다.',actors:'걷기, 달리기 점프, 암벽 등반을 합니다.',bee:'벌의 눈으로 정원을 날아봅니다.',
    fps:'가상 블래스터로 발광 표적을 맞힙니다.',drive:'운전석에 올라 해안 코스를 달립니다.',flight:'활주로에서 경비행기를 타고 이륙합니다.',
    boat:'배를 조종해 부표를 통과합니다.',sub:'잠수하고 잠망경으로 수면을 관찰합니다.',fishing:'미끼를 골라 입질을 기다리고 낚아 올립니다.',collect:'시간 안에 흩어진 통을 수집합니다.'};
  const bar=document.createElement('nav'),menu=document.createElement('dialog');bar.id='world-bar';menu.id='system-menu';
  bar.setAttribute('aria-label','시뮬레이션');bar.innerHTML='<span>플레이 모드</span><button type="button" data-visual aria-haspopup="dialog">게임 비주얼</button><button type="button" data-system aria-haspopup="dialog">시스템 메뉴</button>';
  menu.setAttribute('aria-labelledby','system-title');
  menu.innerHTML=`<header><h1 id="system-title">Bee Garden</h1><button data-close aria-label="시스템 메뉴 닫기">닫기 ×</button></header>
    <nav aria-label="시스템 기능"><button data-tab="play">플레이</button><button data-tab="make">AI 게임 제작</button><button data-tab="tools">도구와 설정</button><button data-visual aria-haspopup="dialog">게임 비주얼</button></nav>
    <section data-page="play"><form class="quick-idea"><label for="quick-game-idea">만들고 싶은 게임</label><div><input id="quick-game-idea" maxlength="1800" placeholder="예: 밤바다에서 물고기 세 마리 낚기"><button class="primary">AI로 만들기</button></div></form><h2>시뮬레이션 선택</h2><div class="mode-grid"></div></section>
    <section data-page="make" hidden><h2>만들고 싶은 게임</h2><form><textarea required maxlength="1800" rows="3" aria-label="만들고 싶은 게임" placeholder="예: 비 오는 해안에서 감성돔 세 마리를 잡는 픽셀 낚시 게임"></textarea>
    <div class="ai-settings"><label>작업<select name="operation"><option value="new">새 게임 만들기</option><option value="edit">현재 게임 개편</option></select></label>
    <label>생성 방법<select name="provider"><option value="local">로컬 AI · Ollama</option><option value="browser">브라우저 내장 AI</option><option value="template">즉시 규칙 초안</option></select></label></div>
    <details data-connect><summary>로컬 AI 연결 방법</summary><p>Ollama 실행 후 엔진 저장소에서 <code>python engine/tools/serve_studio.py</code>를 실행하세요. 아래에 설치된 모델 이름을 입력하세요.</p><label>Ollama 모델 <input name="model" value="qwen2.5:7b" maxlength="100"></label></details>
    <div class="ai-submit"><button class="primary" type="submit">게임 초안 생성</button><output aria-live="polite"></output></div></form>
    <article data-preview hidden><h3></h3><p></p><button data-apply class="primary">이 설정으로 플레이</button></article></section>
    <section data-page="tools" hidden><h2>도구와 설정</h2><div class="tool-grid"></div><div class="ai-settings"><label>날씨 <select data-weather></select></label><label>시각 <input data-hour type="range" min="0" max="23.75" step=".25"><output data-time></output></label></div></section>`;
  const css=document.createElement('style');css.textContent=`
    #world-bar{position:fixed;top:max(10px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));display:flex;align-items:center;gap:7px;color:#f2f5e7;font:600 12px system-ui;z-index:7;background:#142a26ed;border:1px solid #8ca59888;border-radius:8px;padding:4px 6px}
    #world-bar #mode-picker,#world-bar button{position:static!important;background:#223c35!important;color:#eef5e5!important;border:1px solid #769084!important;border-radius:5px!important;font:600 13px system-ui!important;padding:5px 8px!important;height:33px!important;cursor:pointer}
    #world-bar>span{padding-left:3px}#mode-hint{max-width:calc(100vw - 52px);white-space:normal!important}#scenario-goal{position:fixed;z-index:5;top:70px;left:50%;transform:translateX(-50%);background:#142b27ed;color:#f3eecf;border-radius:5px;padding:6px 9px;font:600 12px system-ui;text-align:center}
    #system-menu{box-sizing:border-box;color:#1c342c;background:#f4f3e8;border:1px solid #9aafa0;border-radius:14px;padding:0;width:min(730px,calc(100vw - 26px));max-height:86dvh;box-shadow:0 20px 70px #06191070;font:500 14px/1.45 system-ui}
    #system-menu::backdrop{background:#081c19a6}#system-menu header,#system-menu>nav,#system-menu>section{padding:16px 23px}#system-menu header{display:flex;align-items:center;justify-content:space-between;background:#19392d;color:#faf5dc}#system-menu h1{margin:0;font:700 26px/1.1 Georgia,serif}
    #system-menu button,#system-menu select,#system-menu input,#system-menu textarea{font:inherit;color:inherit;box-sizing:border-box}#system-menu button{cursor:pointer}#system-menu :focus-visible,#world-bar :focus-visible{outline:3px solid #c77537;outline-offset:2px}
    #system-menu button{border:1px solid #b2bfb0;background:#fdfcf5;padding:8px 11px;border-radius:6px;text-align:left}#system-menu header button{background:transparent;color:inherit;border-color:#87a38f}
    #system-menu>nav{display:flex;gap:5px;border-bottom:1px solid #c3cdbd;padding-top:10px;padding-bottom:10px}#system-menu>nav button{border:none;background:transparent}#system-menu>nav button[aria-pressed=true],#system-menu .primary{background:#245643;color:white}
    #system-menu h2{margin:0 0 12px;font-size:19px}#system-menu .mode-grid,#system-menu .tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    #system-menu .mode-grid button span,#system-menu .tool-grid button span{display:block;color:#53685a;font-size:12px;margin-top:2px}#system-menu .mode-grid button[aria-current=true]{border-color:#387455;box-shadow:inset 3px 0 #387455}
    #system-menu textarea,#system-menu input,#system-menu select{border:1px solid #9aac9c;background:#fffef7;border-radius:5px;padding:7px}#system-menu textarea{width:100%;resize:vertical}
    #system-menu .quick-idea{margin:0 0 15px}#system-menu .quick-idea label{display:block;font-weight:700;margin-bottom:5px}#system-menu .quick-idea div{display:flex;gap:5px}#system-menu .quick-idea input{flex:1;min-width:0}#system-menu .quick-idea button{white-space:nowrap}
    #system-menu .ai-settings,#system-menu .ai-submit{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:10px 0}#system-menu label{display:inline-flex;gap:6px;align-items:center;font-size:13px}#system-menu details{font-size:12px}#system-menu details p{margin:6px 0}
    #system-menu article{border-top:1px solid #adbcae;margin-top:15px;padding-top:8px}#system-menu article :is(h3,p){margin:5px 0}#system-menu [hidden]{display:none!important}
    #sample-button,#studio-open,#engine-sound{display:none!important}#lighting-panel{top:60px!important;z-index:8!important}
    @media(max-width:620px){#world-bar>span{display:none}#system-menu header,#system-menu>nav,#system-menu>section{padding:12px}#system-menu .mode-grid button,#system-menu .tool-grid button{padding:8px}#mode-hint{font-size:10px!important;padding:4px 7px!important}#scenario-goal{top:auto;bottom:9px;width:max-content;max-width:80vw}}
  `;document.head.append(css);document.body.append(bar,menu);
  const $=s=>menu.querySelector(s),picker=document.querySelector('#mode-picker'),launch=bar.querySelector('[data-system]'),visual=bar.querySelector('[data-visual]');
  bar.insertBefore(picker,visual);let current='play',proposal=null,revision=0;
  visual.onclick=()=>VisualControls.open(()=>visual.blur());
  $('[data-visual]').onclick=()=>{close();VisualControls.open(()=>{open();$('[data-visual]').focus();});};
  function tab(id){
    current=id;for(const s of menu.querySelectorAll('[data-page]'))s.hidden=s.dataset.page!==id;
    for(const b of menu.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===id));
    for(const b of menu.querySelectorAll('[data-mode]'))b.setAttribute('aria-current',String(b.dataset.mode===Modes.cur));
    if(id==='tools'){$('[data-weather]').value=Weather.S.mode;$('[data-hour]').value=G.day;$('[data-time]').textContent=Math.floor(G.day)+'시';}
  }
  function close(){if(menu.open)menu.close();launch.blur();Modes.keys.clear();}
  function open(id=current){
    if(document.pointerLockElement)document.exitPointerLock();Modes.keys.clear();tab(id);
    if(!menu.open)menu.showModal();if(id==='make')$('textarea').focus();
  }
  launch.onclick=()=>open();$('[data-close]').onclick=close;
  for(const b of menu.querySelectorAll('[data-tab]'))b.onclick=()=>tab(b.dataset.tab);
  menu.addEventListener('keydown',e=>e.stopPropagation());menu.addEventListener('keyup',e=>e.stopPropagation());
  menu.addEventListener('close',()=>{launch.blur();Modes.keys.clear();});
  function tile(parent,title,desc,fn){
    const b=document.createElement('button');b.type='button';const t=document.createElement('strong'),s=document.createElement('span');
    t.textContent=title;s.textContent=desc;b.append(t,s);b.onclick=fn;parent.append(b);return b;
  }
  for(const opt of picker.options)if(descriptions[opt.value]){
    const b=tile($('.mode-grid'),opt.text,descriptions[opt.value],()=>{close();Modes.set(opt.value);});b.dataset.mode=opt.value;
  }
  const click=id=>document.getElementById(id).click(),tools=$('.tool-grid');
  tile(tools,'GLB · 프로젝트','모델 가져오기와 프로젝트 저장',()=>{close();click('studio-open');});
  tile(tools,'캐릭터 · 모델 샘플','사람, 개구리, 건물과 탈것 둘러보기',()=>{close();click('sample-button');});
  tile(tools,'조명 설정','그림자, 반사, 주변광과 렌즈 비교',()=>{close();LookPanel.open();});
  tile(tools,'엔진 활용법','모드별 조작, 예제 코드와 제작 방법',()=>{close();Guide.toggle();});
  const sound=tile(tools,'소리','',()=>{click('engine-sound');sound.lastChild.textContent=document.getElementById('engine-sound').textContent;});
  for(const [id,label] of Object.entries(Weather.NAME))$('[data-weather]').add(new Option(label,id));
  $('[data-weather]').onchange=e=>Weather.set(e.target.value);
  $('[data-hour]').oninput=e=>{G.day=+e.target.value;$('[data-time]').textContent=Math.floor(G.day)+'시';};
  const form=$('[data-page="make"] form'),input=$('textarea'),status=form.querySelector('output'),preview=$('[data-preview]'),provider=form.elements.provider;
  $('.quick-idea').onsubmit=e=>{e.preventDefault();const q=$('#quick-game-idea').value.trim();if(q){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));}tab('make');input.focus();};
  form.addEventListener('input',()=>{revision++;proposal=null;preview.hidden=true;status.textContent='';$('[data-connect]').hidden=provider.value!=='local';});
  form.onsubmit=async e=>{
    e.preventDefault();const request=input.value.trim();if(!request)return;
    const id=++revision,button=form.querySelector('[type=submit]');button.disabled=true;preview.hidden=true;
    status.textContent=provider.value==='template'?'규칙을 구성하는 중…':'AI 응답을 기다리는 중…';
    try{const p=await Scenario.generate(request,provider.value,form.elements.model.value.trim(),form.elements.operation.value==='edit');
      if(id!==revision)return;proposal=p;preview.hidden=false;preview.querySelector('h3').textContent=p.title;
      preview.querySelector('p').textContent=[Modes.MODES[p.mode].name,VisualStyle.names[p.style],Weather.NAME[p.weather],Math.floor(p.hour)+'시',Scenario.goal(p)].join(' · ');status.textContent='초안을 확인하세요.';
    }catch(err){if(id===revision)status.textContent=err instanceof TypeError?'AI 연결 실패. 로컬 AI 연결 방법을 확인하거나 즉시 규칙 초안을 선택하세요.':err.message;}
    finally{button.disabled=false;}
  };
  $('[data-apply]').onclick=()=>{if(!proposal)return;close();Scenario.apply(proposal,form.elements.operation.value==='new');
    const idea=document.querySelector('[data-idea]');if(idea)idea.value=input.value;};
  function build(){
    sound.lastChild.textContent=document.getElementById('engine-sound').textContent;
    if(Q.get('menu')==='visual'){VisualControls.open();return;}
    if(!Q.has('mode')&&!Q.has('project')&&!Q.has('capture')&&!Q.has('nopanel')&&!Q.has('guide')&&!Q.has('cam'))open('play');
    if(Q.get('menu')==='make')open('make');
  }
  return {build,open};
})();
