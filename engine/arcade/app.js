import * as THREE from '../vendor/three.module.min.js';
import { TRACK, createRace, startRace, stepRace, resetCar, togglePause } from './race-core.js';
import { createWorld } from './world.js';
import { createRenderer } from './renderer.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const keys = new Set(), touches = new Map();
const audio = createAudio();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .5, 2600);
const views = ['chase', 'hood', 'wide'];
const viewNames = ['CHASE CAM', 'HOOD CAM', 'WIDE CAM'];
let race, world, renderer, view = 0, last = performance.now(), frameId;
let previousPhase = '', lastEventId = -1, countdownSound = -1, hudClock = 0, noticeUntil = 0;
let best = {}, resultSaved = false, gamepadPrevious = {}, qualityIndex = 0;
const quality = [
  {style:'pixel', raster:240, pixelFit:query.get('pixelFit') || 'auto', label:'PIXEL 240'},
  {style:'pixel', raster:480, pixelFit:'auto', label:'PIXEL 480'},
  {style:'native', raster:720, pixelFit:'off', label:'CLEAN 3D'},
];
if (query.get('style') === 'native') qualityIndex = 2;
else if (+query.get('raster') >= 360) qualityIndex = 1;
const clock = seconds => {
  const ms = Math.max(0, Math.floor((Number.isFinite(seconds) ? seconds : 0) * 1000));
  return `${String(Math.floor(ms / 60000)).padStart(2,'0')}:${String(Math.floor(ms / 1000) % 60).padStart(2,'0')}.${String(ms % 1000).padStart(3,'0')}`;
};
const difficulty = () => document.querySelector('input[name="difficulty"]:checked').value;
try { const saved = JSON.parse(localStorage.getItem('coastline-gt.best.v1') || '{}'); if (saved && typeof saved === 'object') best = saved; } catch { /* Racing also works with storage disabled. */ }
const bestFor = mode => Number.isFinite(best[mode]) && best[mode] > 0 ? best[mode] : 0;
function showBest() { const record = bestFor(difficulty()); $('lobby-best').textContent = record ? `PERSONAL BEST / ${difficulty().toUpperCase()}  ${clock(record)}` : 'YOUR NEXT PERSONAL BEST STARTS HERE.'; }
function releaseInputs() { keys.clear(); touches.clear(); document.querySelectorAll('[data-control]').forEach(b => b.classList.remove('active')); }
function notify(text) { $('notice').textContent = text; $('notice').hidden = false; noticeUntil = performance.now() + 2600; }
function start() {
  releaseInputs(); race = createRace({difficulty:difficulty()}); startRace(race);
  resultSaved = false; lastEventId = -1; countdownSound = -1; previousPhase = ''; view = 0;
  $('camera-label').textContent=viewNames[view]; world.player.visible=true;
  document.activeElement?.blur(); syncPhase();
}
function home() {
  releaseInputs(); race = createRace({difficulty:difficulty()}); previousPhase = ''; resultSaved = false;
  world.player.visible=true;
  document.activeElement?.blur(); syncPhase(); showBest();
}
function pause() {
  if (!race || !['racing','countdown','paused'].includes(race.phase)) return;
  releaseInputs(); togglePause(race); document.activeElement?.blur(); syncPhase();
}
function recover() {
  if (race?.phase !== 'racing') return;
  resetCar(race); releaseInputs(); document.activeElement?.blur(); notify('코스 중앙 복귀 · 시간 페널티 3초');
}
function switchCamera() { view = (view + 1) % views.length; $('camera-label').textContent = viewNames[view]; document.activeElement?.blur(); }
function syncPhase() {
  if (previousPhase === race.phase) return;
  previousPhase = race.phase; document.body.dataset.phase = race.phase;
  const ready = race.phase === 'ready';
  const result = race.phase === 'finished' || race.phase === 'timeout';
  $('lobby').hidden = !ready; $('race-hud').hidden = ready || result;
  $('pause-overlay').hidden = race.phase !== 'paused'; $('result-overlay').hidden = !result;
  $('touch-controls').hidden = !['racing','countdown'].includes(race.phase) || !(matchMedia('(pointer:coarse)').matches || query.has('touch'));
  if (result) renderResult();
  if (ready || result || race.phase === 'paused') { $('race-message').hidden = true; releaseInputs(); }
}
function renderResult() {
  const finished = race.phase === 'finished', resultTime = race.finishTime || race.elapsed, mode = race.difficulty || difficulty();
  let personalBest = false;
  if (finished && !resultSaved) {
    personalBest = !bestFor(mode) || resultTime < bestFor(mode);
    if (personalBest) { best[mode] = resultTime; try { localStorage.setItem('coastline-gt.best.v1', JSON.stringify(best)); } catch {} }
    resultSaved = true;
  }
  $('result-kicker').textContent = finished ? (personalBest ? 'A NEW PERSONAL BEST' : 'THE CHECKERED FLAG') : 'ONE MORE LAP. ONE MORE CHANCE.';
  $('result-title').textContent = finished ? (race.position === 1 ? 'VICTORY!' : 'FINISH!') : 'TIME UP';
  $('result-subtitle').textContent = finished ? '세 바퀴의 승부가 끝났습니다.' : '시간이 다 됐습니다. 체크포인트에서 시간을 더 얻으세요.';
  $('result-position').textContent = String(race.position).padStart(2,'0');
  $('result-time').textContent = clock(resultTime); $('result-best').textContent = bestFor(mode) ? clock(bestFor(mode)) : '—';
  $('result-tip').textContent = finished ? '라이벌 뒤를 따라가면 슬립스트림으로 더 빠르게 가속합니다.' : '코너에서는 가속을 잠시 놓고 오른쪽으로 조향하세요. 입문 난이도는 시간이 더 넉넉합니다.';
}
function input() {
  const controls = new Set(touches.values());
  let throttle = keys.has('KeyW') || keys.has('ArrowUp') || controls.has('throttle') ? 1 : 0;
  let brake = keys.has('KeyS') || keys.has('ArrowDown') || controls.has('brake') ? 1 : 0;
  let steer = Number(keys.has('KeyD') || keys.has('ArrowRight') || controls.has('right')) - Number(keys.has('KeyA') || keys.has('ArrowLeft') || controls.has('left'));
  let drift = keys.has('Space') || controls.has('drift');
  const pad = navigator.getGamepads?.()?.find(p => p?.connected);
  if (pad) {
    if (Math.abs(pad.axes[0] || 0) > .14) steer = pad.axes[0];
    steer += Number(pad.buttons[15]?.pressed) - Number(pad.buttons[14]?.pressed);
    throttle = Math.max(throttle, pad.buttons[7]?.value || 0, pad.buttons[0]?.pressed ? 1 : 0);
    brake = Math.max(brake, pad.buttons[6]?.value || 0, pad.buttons[1]?.pressed ? 1 : 0);
    drift ||= !!pad.buttons[2]?.pressed;
    const now = {start:!!pad.buttons[9]?.pressed, camera:!!pad.buttons[3]?.pressed};
    if (now.start && !gamepadPrevious.start) { if (['ready','finished','timeout'].includes(race.phase)) start(); else pause(); }
    if (now.camera && !gamepadPrevious.camera) switchCamera(); gamepadPrevious = now;
  } else gamepadPrevious = {};
  if (race.phase !== 'racing') return {throttle:0,brake:0,steer:0,drift:false};
  return {throttle,brake,steer:Math.max(-1,Math.min(1,steer)),drift};
}
function paintMap(canvas, active) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const scale = Math.min((w - 70) / 400, (h - 34) / 840);
  const project = p => [w / 2 + p.x * scale, h / 2 - p.z * scale];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); for (let i=0;i<=128;i++) { const p=project(TRACK.sample(i / 128 * TRACK.length)); if(i)ctx.lineTo(...p); else ctx.moveTo(...p); } ctx.closePath(); };
  path();ctx.strokeStyle='#b4d3be18';ctx.lineWidth=22;ctx.stroke();
  path();ctx.strokeStyle='#b8d2c8';ctx.lineWidth=active?7:9;ctx.stroke();
  path();ctx.strokeStyle='#14353b';ctx.lineWidth=active?3:4;ctx.stroke();
  for(let i=0;i<3;i++) {const s=TRACK.sample(TRACK.length*i/3),p=project(s);ctx.fillStyle=i?'#7caa9e':'#ffd45a';ctx.fillRect(p[0]-4,p[1]-3,8,6);}
  const first=project(TRACK.sample(0));
  if(!active){ctx.font='bold 9px Arial';ctx.fillStyle='#a5c6bd';ctx.fillText('START',first[0]-42,first[1]-10);ctx.fillStyle='#ffd45a';ctx.font='15px Arial';ctx.fillText('↑',first[0]-26,first[1]+12);ctx.font='bold 8px Arial';ctx.fillStyle='#8eafa6';ctx.textAlign='center';ctx.fillText('PACIFIC',w/2,h/2-5);ctx.fillText('COAST',w/2,h/2+8);ctx.textAlign='left';}
  if(active && race){
    for(const other of race.opponents){const p=project(TRACK.sample(other.distance));ctx.beginPath();ctx.arc(p[0],p[1],3.4,0,Math.PI*2);ctx.fillStyle='#dfe9de';ctx.fill();}
    const p=project(TRACK.sample(race.player.distance));ctx.beginPath();ctx.arc(p[0],p[1],8,0,Math.PI*2);ctx.fillStyle='#ffd45a35';ctx.fill();ctx.beginPath();ctx.arc(p[0],p[1],4.2,0,Math.PI*2);ctx.fillStyle='#ffd45a';ctx.fill();ctx.strokeStyle='#102b32';ctx.lineWidth=1.4;ctx.stroke();
  }
}
function updateHUD(dt) {
  hudClock += dt;
  const event = race.lastEvent;
  if(event && event.id !== lastEventId){lastEventId=event.id;if(event.type!=='countdown')audio.event(event.type);}
  if(race.phase === 'countdown') {
    const count=Math.max(1,Math.ceil(race.countdown));
    if(count !== countdownSound){countdownSound=count;audio.event('countdown');}
    $('race-message').hidden=false;$('race-message').classList.remove('flash');$('message-kicker').textContent='GET READY';$('message-text').textContent=String(count);$('message-detail').textContent='W / ↑ 가속 · A D / ← → 조향';
  } else if(race.phase === 'racing') {
    const flash = race.flash;
    $('race-message').hidden = !flash || flash.ttl <= 0;
    if(flash?.ttl > 0) { const checkpoint=event?.type==='checkpoint'||event?.type==='lap';$('race-message').classList.add('flash');$('message-kicker').textContent=checkpoint ? 'KEEP IT GOING' : ''; $('message-text').textContent=flash.text;$('message-detail').textContent=checkpoint ? '다음 체크포인트를 향해 달리세요' : ''; }
  }
  if(hudClock < .075)return;hudClock=0;
  $('position').textContent=String(race.position).padStart(2,'0');
  $('position-label').textContent=race.position === 1?'선두를 지키세요':race.position<=3?'포디움을 향해':'추월을 준비하세요';
  $('time-left').textContent=Math.max(0,race.timeLeft).toFixed(2);$('timer-bar').style.width=`${Math.min(100,race.timeLeft / (race.difficulty === 'easy'?60:45) * 100)}%`;$('time-left').parentElement.classList.toggle('low',race.timeLeft < 10);
  $('lap').textContent=String(Math.min(3,race.lap));$('elapsed').textContent=clock(race.elapsed);
  $('speed').textContent=String(Math.round(Math.max(0,race.player.speed)*3.6)).padStart(3,'0');$('gear').textContent=String(race.player.gear||1);
  $('driving-status').textContent=race.player.drifting?'DRIFT / 타이어를 흘려라':race.player.slipstream?'SLIPSTREAM / 슬립스트림':Math.abs(race.player.lateral)>TRACK.halfWidth-1?'TRACK LIMIT / 코스로 복귀':race.player.draft>.12?'DRAFT EXIT / 추월 가속':'FULL THROTTLE';
  $('lap-progress').style.width=`${(race.player.distance % TRACK.length + TRACK.length) % TRACK.length / TRACK.length * 100}%`;
  $('checkpoint-label').textContent=`CP ${(race.checkpointIndex || 0)%3+1} / 3`;
  const rpm=race.player.rpm>1?race.player.rpm/8000:race.player.rpm;
  for(const [i,bar] of [...$('rpm-bars').children].entries())bar.classList.toggle('on',i<Math.max(1,Math.floor((rpm||0)*20)));
  $('game-status').textContent=`${race.phase} · ${Math.round(race.player.speed*3.6)} km/h · ${race.position}/8위 · ${race.lap}/3랩 · 시간 ${race.timeLeft.toFixed(1)}초 · 체크포인트 ${race.checkpointIndex || 0} · 추월 ${race.stats.overtakes} · ${viewNames[view]}`;
  $('game-status').dataset.phase=race.phase;$('game-status').dataset.renderer=renderer.kind;
  paintMap($('race-map'),true);
}
function resize() {renderer.resize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
function frame(now) {
  const dt=Math.min((now-last)/1000,.1);last=now;
  const driveInput=input();
  stepRace(race,driveInput,dt);syncPhase();
  world.update(race,race.phase==='racing'?dt:0);
  if(race.phase === 'ready') {
    const t=now*.00012;
    camera.position.set(-202+Math.sin(t)*2,11,-23);camera.lookAt(-187,5,15);camera.fov=57;
  } else {
    const pose=world.cameraPose(race,views[view],race.phase === 'paused'?0:dt);
    camera.position.copy(pose.position);camera.lookAt(pose.target);camera.fov=pose.fov;
  }
  camera.updateProjectionMatrix();renderer.render(world.scene,camera);
  audio.update(race);updateHUD(dt);
  if(noticeUntil && now>noticeUntil){$('notice').hidden=true;noticeUntil=0;}
  frameId=requestAnimationFrame(frame);
}
async function changeSound() {const on=await audio.setEnabled(!audio.enabled);$('sound-button').setAttribute('aria-pressed',String(on));$('sound-button').setAttribute('aria-label',on?'소리 끄기':'소리 켜기');$('sound-button').innerHTML=`♪ <span>소리 ${on?'ON':'OFF'}</span>`;document.activeElement?.blur();}
function bind() {
  $('start-button').onclick=start;$('retry-button').onclick=start;$('restart-button').onclick=start;
  $('quit-button').onclick=home;$('result-home').onclick=home;$('resume-button').onclick=pause;$('pause-button').onclick=pause;
  $('camera-button').onclick=switchCamera;$('reset-button').onclick=recover;$('sound-button').onclick=changeSound;
  $('quality-button').onclick=()=>{qualityIndex=(qualityIndex+1)%quality.length;renderer.setQuality(quality[qualityIndex]);$('quality-label').textContent=quality[qualityIndex].label;resize();document.activeElement?.blur();};
  $('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{notify('이 브라우저에서는 전체 화면 전환을 지원하지 않습니다.');}document.activeElement?.blur();};
  for(const radio of document.querySelectorAll('[name="difficulty"]'))radio.onchange=()=>{showBest();if(race.phase==='ready')race=createRace({difficulty:difficulty()});};
  const editable=e=>!!e.target.closest?.('input,textarea,select,[contenteditable="true"]');
  const physicalCode=e=>e.code&&e.code!=='Unidentified'?e.code:e.key===' '?'Space':/^[a-z]$/i.test(e.key)?'Key'+e.key.toUpperCase():e.key;
  addEventListener('keydown',e=>{
    if(editable(e)||e.metaKey||e.ctrlKey||e.altKey)return;
    const code=physicalCode(e);
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(code))e.preventDefault();
    if(e.repeat)return;
    if(code==='Enter' && ['ready','finished','timeout'].includes(race.phase)){e.preventDefault();start();return;}
    if(code==='Escape'||code==='KeyP'){pause();return;}
    if(code==='KeyC'){switchCamera();return;}if(code==='KeyR'){recover();return;}if(code==='KeyM'){changeSound();return;}
    if(!['racing','countdown'].includes(race.phase))return;
    if(document.activeElement?.tagName==='BUTTON')document.activeElement.blur();keys.add(code);
  });
  addEventListener('keyup',e=>keys.delete(physicalCode(e)));
  const loseFocus=()=>{releaseInputs();if(['racing','countdown'].includes(race.phase))pause();};
  addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();});
  document.addEventListener('focusin',e=>{if(e.target.matches('input,select,textarea'))releaseInputs();});
  for(const button of document.querySelectorAll('[data-control]')) {
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touches.set(e.pointerId,button.dataset.control);button.classList.add('active');});
    const up=e=>{touches.delete(e.pointerId);button.classList.remove('active');};
    button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
    button.addEventListener('contextmenu',e=>e.preventDefault());
  }
  addEventListener('resize',resize);
  addEventListener('pagehide',e=>{releaseInputs();cancelAnimationFrame(frameId);if(!e.persisted){audio.dispose();world.dispose();renderer.dispose();}});
  addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();frameId=requestAnimationFrame(frame);}});
}
try {
  $('loading-message').textContent='스타팅 그리드에 차량을 배치하고 있습니다.';
  renderer=createRenderer($('race-canvas'),{...quality[qualityIndex],forceSoftware:query.get('renderer')==='software'});
  world=createWorld();race=createRace({difficulty:difficulty()});
  for(let i=0;i<20;i++)$('rpm-bars').append(document.createElement('i'));
  resize();bind();showBest();paintMap($('lobby-map'),false);$('quality-label').textContent=quality[qualityIndex].label;
  $('loading').hidden=true;syncPhase();last=performance.now();frameId=requestAnimationFrame(frame);
} catch(error) {
  console.error(error);$('loading').hidden=false;$('loading').querySelector('h1').textContent='서킷을 불러오지 못했습니다.';$('loading-message').textContent='새로고침해 주세요. 오류: '+error.message;
}
