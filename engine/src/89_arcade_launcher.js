'use strict';
// A dedicated entry keeps the speedway independent of island terrain/physics.
// The same repository's Three.js builds its scene; a software renderer also
// plays that scene when a browser cannot create a WebGL context.
const ArcadeLaunch = (() => {
  function enter() {
    const url = new URL('arcade/', location.href);
    url.searchParams.set('style', VisualStyle.current === 'native' ? 'native' : 'pixel');
    url.searchParams.set('raster', String(VisualStyle.raster || 240));
    url.searchParams.set('pixelFit', Q.get('pixelFit') || 'auto');
    url.searchParams.set('day', '11.5');
    url.searchParams.set('weather', 'clear');
    location.assign(url.href);
  }
  Modes.add('arcade', {name:'COASTLINE GT', enter, leave(){}, step(){return 'COASTLINE GT 서킷으로 이동합니다.';}});
  document.getElementById('mode-picker').add(new Option('GT 아케이드 레이싱', 'arcade'));
  return {enter};
})();
