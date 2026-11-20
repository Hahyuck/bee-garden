'use strict';
const VisualControls=(()=>{
  const panel=document.createElement('dialog');
  panel.id='game-visual';panel.setAttribute('aria-labelledby','visual-title');
  panel.innerHTML=`<header><h2 id="visual-title">게임 비주얼</h2><button type="button" aria-label="게임 비주얼 닫기">닫기 ×</button></header>
    <fieldset><legend>화면 스타일</legend><div class="visual-grid"></div></fieldset>
    <label hidden>표현 방식<select data-variant></select></label>
    <label>픽셀 해상도<select data-raster></select></label>
    <label>픽셀 Fit<select data-pixel-fit><option value="auto">스타일 기본값</option><option value="off">끄기</option><option value="fit">화면 맞춤</option><option value="integer">정수배</option></select></label>`;
  const css=document.createElement('style');css.textContent=`
    #game-visual{box-sizing:border-box;inset:max(54px,env(safe-area-inset-top)) 10px auto auto;margin:0;width:min(310px,calc(100vw - 20px));max-height:calc(100dvh - 68px);overflow:auto;color:#ecf3e8;background:#19332e;border:1px solid #789487;border-radius:10px;padding:14px;font:600 14px/1.35 system-ui}
    #game-visual::backdrop{background:#06191320}#game-visual header,#game-visual>label{display:flex;align-items:center;justify-content:space-between;gap:8px}#game-visual h2{font-size:18px;margin:0}#game-visual fieldset{border:0;padding:0;margin:15px 0 10px}#game-visual legend{font-size:12px;color:#bed0c1;margin-bottom:6px}
    #game-visual .visual-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}#game-visual label:has(input){position:relative;cursor:pointer}#game-visual input{position:absolute;opacity:0}
    #game-visual span,#game-visual button,#game-visual select{display:block;background:#29483d;color:inherit;border:1px solid #759483;border-radius:5px;padding:7px 8px;font:inherit;cursor:pointer}
    #game-visual input:checked+span{background:#d2e8cb;color:#143226;border-color:#e7f9de}#game-visual input:focus-visible+span,#game-visual :is(button,select):focus-visible{outline:2px solid #ffca7c;outline-offset:1px}
    #game-visual>label{margin-top:7px}#game-visual [hidden]{display:none!important}`;
  document.head.append(css);document.body.append(panel);
  const grid=panel.querySelector('.visual-grid'),variant=panel.querySelector('[data-variant]'),raster=panel.querySelector('[data-raster]'),fit=panel.querySelector('[data-pixel-fit]');
  for(const [id,name] of Object.entries(VisualStyle.groups)){
    const label=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('span');
    radio.type='radio';radio.name='world-visual-style';radio.value=id;text.textContent=name;label.append(radio,text);grid.append(label);
  }
  for(const [w,h] of VisualStyle.sizes)raster.add(new Option(w+' × '+h,w));
  let family='cradle',afterClose=null;
  function sync(){
    const id=VisualStyle.current,group=Object.keys(VisualStyle.variants).find(k=>Object.hasOwn(VisualStyle.variants[k],id))||id;
    const options=VisualStyle.variants[group];
    grid.querySelector('input[value="'+group+'"]').checked=true;
    if(options){
      family=id.split('-')[0];variant.replaceChildren();
      for(const [key,name] of Object.entries(options))variant.add(new Option(name,key));
      variant.value=id;
    }
    variant.parentElement.hidden=!options;raster.value=VisualStyle.raster;fit.value=PixelFit.choice;
    raster.parentElement.hidden=!VisualStyle.usesRaster()&&!PixelFit.enabled;
  }
  panel.onchange=e=>{
    const el=e.target;
    if(el.type==='radio')VisualStyle.select(VisualStyle.variants[el.value]?family+'-'+el.value:el.value);
    else if(el===variant)VisualStyle.select(el.value);
    else if(el===raster)VisualStyle.select(VisualStyle.current,el.value);
    else if(el===fit)PixelFit.select(el.value);
    sync();
    if(!Q.get('project'))try{localStorage.setItem('garden.studio.look',JSON.stringify([VisualStyle.current,VisualStyle.raster,PixelFit.choice]));}catch{}
  };
  for(const name of ['keydown','keyup'])panel.addEventListener(name,e=>e.stopPropagation());
  panel.querySelector('button').onclick=()=>panel.close();
  panel.addEventListener('close',()=>{Modes.keys.clear();afterClose?.();afterClose=null;});
  return {refresh(){if(panel.open)sync();},open(onClose){afterClose=onClose;Modes.keys.clear();sync();if(!panel.open)panel.showModal();grid.querySelector(':checked').focus();}};
})();
