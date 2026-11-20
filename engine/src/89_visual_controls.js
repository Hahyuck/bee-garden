'use strict';
const VisualControls=(()=>{
  const panel=document.createElement('section');
  panel.id='game-visual';panel.hidden=true;panel.setAttribute('aria-label','게임 비주얼');
  panel.innerHTML=`<div role="radiogroup" aria-label="화면 스타일" class="visual-grid"></div><div class="visual-options">
    <label hidden>표현 방식<select data-variant></select></label><label>픽셀 해상도<select data-raster></select></label>
    <label>픽셀 Fit<select data-pixel-fit><option value="auto">스타일 기본값</option><option value="off">끄기</option><option value="fit">화면 맞춤</option><option value="integer">정수배</option></select></label></div>`;
  document.body.append(panel);
  const grid=panel.querySelector('.visual-grid'),variant=panel.querySelector('[data-variant]'),raster=panel.querySelector('[data-raster]'),fit=panel.querySelector('[data-pixel-fit]');
  for(const [id,name] of Object.entries(VisualStyle.groups)){
    const label=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('span');
    radio.type='radio';radio.name='world-visual-style';radio.value=id;text.textContent=name;label.append(radio,text);grid.append(label);
  }
  for(const [w,h] of VisualStyle.sizes)raster.add(new Option(w+' × '+h,w));
  let family='cradle';
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
  return {refresh(){if(!panel.hidden)sync();},open(){Workbench.open('visual');}};
})();
