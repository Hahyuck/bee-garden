// The camera keeps receiving canvas pointers while a separate finger walks.
const WalkStick = (() => {
  const coarse = window.matchMedia('(any-pointer: coarse)');
  const pad = document.createElement('div');
  const knob = document.createElement('div');
  pad.hidden = true;
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', '캐릭터 이동 스틱');
  pad.title = '드래그해서 캐릭터 이동';
  pad.style.cssText = `position:fixed;left:calc(16px + env(safe-area-inset-left, 0px));
    bottom:calc(70px + env(safe-area-inset-bottom, 0px));width:clamp(84px,22vmin,108px);
    aspect-ratio:1;box-sizing:border-box;border-radius:50%;z-index:10;
    border:1px solid rgba(230,242,237,.38);background:rgba(18,29,29,.36);
    box-shadow:inset 0 0 18px rgba(0,0,0,.22);touch-action:none;user-select:none;
    -webkit-user-select:none;-webkit-tap-highlight-color:transparent;`;
  knob.style.cssText = `position:absolute;left:50%;top:50%;width:36%;height:36%;
    box-sizing:border-box;border-radius:50%;border:1px solid rgba(244,252,246,.64);
    background:rgba(212,234,225,.27);pointer-events:none;transform:translate(-50%,-50%);`;
  pad.appendChild(knob);
  document.body.appendChild(pad);

  let enabled = false;
  let finger = null;
  let x = 0;
  let y = 0;

  function reset() {
    const id = finger;
    finger = null;
    x = y = 0;
    knob.style.transform = 'translate(-50%,-50%)';
    if (id !== null && pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
  }

  function refresh() {
    pad.hidden = !(enabled && (coarse.matches || navigator.maxTouchPoints > 0));
    if (pad.hidden) reset();
  }

  function move(event) {
    const bounds = pad.getBoundingClientRect();
    if (!bounds.width) return;
    const dx = event.clientX - bounds.left - bounds.width / 2;
    const dy = event.clientY - bounds.top - bounds.height / 2;
    const radius = bounds.width * .32;
    const distance = Math.hypot(dx, dy);
    const length = Math.min(distance / radius, 1);
    const magnitude = Math.max(0, (length - .1) / .9);
    const nx = distance ? dx / distance : 0;
    const ny = distance ? dy / distance : 0;
    x = nx * magnitude;
    y = -ny * magnitude;
    knob.style.transform = `translate(-50%,-50%) translate(${nx * length * radius}px,${ny * length * radius}px)`;
  }

  function consume(event) {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
  }

  pad.addEventListener('pointerdown', event => {
    consume(event);
    if (pad.hidden || finger !== null || event.button !== 0) return;
    finger = event.pointerId;
    pad.setPointerCapture(finger);
    move(event);
  });
  pad.addEventListener('pointermove', event => {
    consume(event);
    if (event.pointerId === finger) move(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    pad.addEventListener(type, event => {
      consume(event);
      if (event.pointerId === finger) reset();
    });
  }
  pad.addEventListener('contextmenu', consume);
  pad.addEventListener('click', consume);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  coarse.addEventListener('change', refresh);

  return {
    setActive(active) { enabled = Boolean(active); refresh(); },
    get x() { return x; },
    get y() { return y; }
  };
})();
