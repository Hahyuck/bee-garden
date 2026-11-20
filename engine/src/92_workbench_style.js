'use strict';
{
  const css=document.createElement('style');
  css.textContent=`
    :root{--composer-floor:calc(58px + env(safe-area-inset-bottom,0px))}
    #world-bar,#game-composer{position:fixed;z-index:7;color:#f0f5e8;font:600 13px/1.4 system-ui,sans-serif;color-scheme:dark}
    #world-bar{top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));max-width:calc(100vw - 18px - env(safe-area-inset-left) - env(safe-area-inset-right))}
    #world-bar .bar-main,#world-bar .bar-row,#game-visual,#game-composer .composer-line,#composer-settings{background:#19312cec;border:1px solid #829d8d;border-radius:8px;box-shadow:0 2px 8px #101c1d33}
    #world-bar .bar-main,#world-bar .bar-row,.tool-links,#game-visual .visual-grid,#game-visual .visual-options,#game-composer .composer-line,#composer-settings .choices{display:flex;align-items:center;gap:5px}
    #world-bar .bar-main,#world-bar .bar-row,#game-visual{width:max-content;max-width:100%;box-sizing:border-box;padding:4px}
    #world-bar .bar-row,#game-visual{position:absolute;left:0;top:calc(100% + 4px);max-width:calc(100vw - 18px - env(safe-area-inset-left) - env(safe-area-inset-right))}
    #world-bar .bar-row,#game-visual .visual-grid,#game-visual .visual-options{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;white-space:nowrap}
    #world-bar button,#world-bar select,#game-visual .visual-grid span,#game-composer button,#game-composer input,#game-composer select{box-sizing:border-box;border:1px solid #769084;border-radius:5px;padding:6px 9px;background:#29453a;color:inherit;font:inherit}
    #world-bar button,#world-bar select,#game-composer button,#game-composer select{cursor:pointer}
    #world-bar button,.tool-links,#world-bar .bar-row label,#game-visual label{flex:none}
    #world-bar .bar-main button:after{content:'▾';margin-left:6px;color:#a6bdac}
    #world-bar .bar-main button[aria-expanded=true]:after{content:'▴'}
    #world-bar button[aria-expanded=true],#world-bar button[aria-current=true],#game-visual input:checked+span,#game-composer button[type=submit],#game-composer [data-apply]{background:#cfe5c6;color:#203a2b}
    #world-bar :focus-visible,#game-composer :focus-visible,#game-visual input:focus-visible+span{outline:2px solid #ffcf89;outline-offset:-2px}
    #world-bar [hidden],#game-composer [hidden],#sample-button,#studio-open,#engine-sound{display:none!important}
    #game-visual .visual-grid{padding-bottom:3px}#game-visual .visual-grid label{position:relative;cursor:pointer}#game-visual .visual-grid input{position:absolute;opacity:0;width:1px;height:1px}#game-visual .visual-grid span{display:block}
    #game-visual .visual-options,#world-bar .bar-row label{display:flex;align-items:center;gap:6px}#game-visual .visual-options{padding:3px 1px 0}#game-visual select{margin-left:4px}#world-bar [data-hour]{width:80px}
    #game-composer{bottom:max(6px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(610px,calc(100vw - 16px - env(safe-area-inset-left) - env(safe-area-inset-right)));box-sizing:border-box}
    #game-composer .composer-line{padding:5px}#game-composer .composer-line label{white-space:nowrap;padding:0 3px}#game-composer #game-idea{flex:1;min-width:0;background:#f5f6eb;color:#21352f}#game-composer #game-idea::placeholder{color:#59675e}
    #game-composer button{white-space:nowrap}#game-composer button:disabled{opacity:.65}
    #composer-settings{position:absolute;bottom:calc(100% + 4px);left:0;right:0;max-height:42dvh;overflow:auto;padding:10px}
    #composer-settings .choices{flex-wrap:wrap}#composer-settings details,#composer-settings article,#composer-settings [data-status]:not(:empty){display:block;margin-top:8px}#composer-settings p{margin:4px 0 8px}
    #scenario-goal{position:fixed;z-index:5;top:70px;left:50%;transform:translateX(-50%);background:#142b27ed;color:#f3eecf;border-radius:5px;padding:5px 8px;font:600 12px system-ui;text-align:center}
    #mode-hint{max-width:calc(100vw - 40px);white-space:normal!important}#mode-hint,#drive-hud,#pulse-counter,#marine-gauges{bottom:var(--composer-floor)!important}
    #fishing-panel{bottom:calc(var(--composer-floor) + 33px)!important}#race-touch{bottom:calc(var(--composer-floor) + 46px)!important}
    @media(max-width:800px){#world-weather{top:calc(70px + clamp(85px,13vmin,134px))!important;left:max(12px,env(safe-area-inset-left))!important;transform:none!important;font-size:10px!important}}
    #lighting-panel{top:60px!important;z-index:8!important}
    @media(max-width:620px){#game-composer,#world-bar{font-size:12px}#game-composer input,#game-composer select{font-size:16px}#game-composer :is(button,input){padding:6px}
      #mode-hint{font-size:10px!important;padding:4px 7px!important}#scenario-goal{top:104px;max-width:72vw}
      #race-touch{bottom:calc(var(--composer-floor) + 44px)!important}}
  `;
  document.head.append(css);
}
