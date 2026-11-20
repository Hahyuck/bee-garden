'use strict';
const WalkActions = (() => {
  const coarse = matchMedia('(any-pointer: coarse)');
  const styles = document.createElement('style');
  styles.textContent = `
    #walk-picker, #walk-action-buttons { position:fixed; z-index:6; color:#f3e6d2;
      font:600 13px/1.35 system-ui,sans-serif; }
    #walk-picker { right:calc(max(14px,env(safe-area-inset-right)) + 63px); top:54px;
      display:flex; align-items:center; gap:5px; min-height:38px; box-sizing:border-box;
      padding:2px 5px 2px 10px; background:#1c1a17f2; border:1px solid #eddbbf44; border-radius:9px; }
    #walk-picker span { font-size:11px; color:#d5c8b6; }
    #walk-character { min-height:32px; max-width:110px; font:inherit; color:inherit;
      color-scheme:dark; background:#292722; border:0; border-radius:5px; cursor:pointer; }
    #walk-action-buttons { right:calc(16px + env(safe-area-inset-right,0px));
      bottom:calc(70px + env(safe-area-inset-bottom,0px)); display:grid;
      grid-template-columns:auto auto; gap:5px 7px; align-items:center;
      pointer-events:none; user-select:none; -webkit-user-select:none; }
    #walk-action-buttons button { pointer-events:auto; touch-action:none; -webkit-tap-highlight-color:transparent;
      min-width:53px; min-height:44px; box-sizing:border-box; border:1px solid #f0dec564;
      border-radius:12px; padding:5px 9px; color:#fff5e8; background:#211f1bdd;
      font:inherit; cursor:pointer; }
    #walk-action-buttons button[aria-pressed="true"] { color:#271d0c; background:#edc773; border-color:#f9dd9d; }
    #walk-action-buttons #walk-jump { grid-column:2; grid-row:1 / 3; width:60px; height:60px; border-radius:50%; }
    #walk-action-buttons button:active { filter:brightness(1.22); }
    #walk-controls[hidden], #walk-action-buttons[hidden] { display:none; }
  `;
  document.head.append(styles);
  const controls = document.createElement('div');
  controls.id = 'walk-controls';
  controls.hidden = true;
  controls.innerHTML = `
    <label id="walk-picker"><span>캐릭터</span><select id="walk-character" aria-label="캐릭터 변경"></select></label>
    <div id="walk-action-buttons" role="group" aria-label="캐릭터 동작">
      <button type="button" id="walk-run" aria-pressed="false">달리기</button>
      <button type="button" id="walk-crouch" aria-pressed="false">앉기</button>
      <button type="button" id="walk-jump">점프</button>
    </div>`;
  document.body.append(controls);

  const picker = controls.querySelector('#walk-character');
  const actions = controls.querySelector('#walk-action-buttons');
  const run = controls.querySelector('#walk-run'), crouch = controls.querySelector('#walk-crouch');
  let running = false, crouching = false, jumpPending = false;

  function paint() {
    run.setAttribute('aria-pressed', String(running));
    crouch.setAttribute('aria-pressed', String(crouching));
  }
  function setCrouch(on) {
    crouching = on;
    if (on) running = false;
    paint();
  }
  function reset() {
    running = false; crouching = false; jumpPending = false;
    paint();
  }
  function activate(button) {
    if (controls.hidden || actions.hidden) return;
    if (button === run) {
      running = !running;
      if (running) crouching = false;
      paint();
    } else if (button === crouch) {
      setCrouch(!crouching);
    } else {
      jumpPending = true;
    }
  }
  // A second finger must work even when the movement stick owns the primary touch.
  actions.addEventListener('pointerdown', e => {
    if (e.target.tagName !== 'BUTTON' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activate(e.target);
  });
  actions.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON' && e.detail === 0) activate(e.target);
    e.stopPropagation();
  });
  controls.addEventListener('keydown', e => e.stopPropagation());
  picker.addEventListener('focus', () => Modes.keys.clear());
  const people=new Map();
  function addPerson(entry){
    if(!people.has(entry.id))picker.add(new Option(entry.label,entry.id));
    people.set(entry.id,entry);
  }
  function configurePeople(entries, choose) {
    for (const entry of entries) addPerson(entry);
    picker.addEventListener('change', () => {
      const entry = people.get(picker.value);
      if (entry) choose(entry);
      picker.blur();
    });
  }
  function showTouchControls() {
    actions.hidden = !(coarse.matches || navigator.maxTouchPoints > 0);
    if (actions.hidden) { running = false; jumpPending = false; paint(); }
  }
  coarse.addEventListener('change', showTouchControls);
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  return {
    configurePeople,addPerson,removePerson(id){people.delete(id);for(const o of picker.options)if(o.value===id){o.remove();break;}},
    setCharacter(id) { picker.value = id; },
    setActive(on) { controls.hidden = !on; if (!on) reset(); showTouchControls(); },
    get run() { return running; },
    get crouch() { return crouching; },
    setCrouch, toggleCrouch() { setCrouch(!crouching); }, reset,
    consumeJump() { const jump = jumpPending; jumpPending = false; return jump; }
  };
})();
