'use strict';
// ---- sound: one output every module plays into (G.snd), a button to silence it (remembered), and the air itself: wind that rises
//      with the weather, surf near the water, rain. All of it is filtered noise made here; there are no sound files. ----
const Sound = (() => {
  let ac = null, master = null, muted = false, wind, surf, rain; try { muted = localStorage.getItem('engine.mute') === '1'; } catch (e) {}
  const btn = document.createElement('button'); btn.style.cssText = 'position:fixed;right:14px;top:12px;z-index:6;font:600 12px "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f6ead0;background:rgba(14,12,10,.55);border:1px solid rgba(243,217,189,.25);border-radius:9px;padding:6px 11px;cursor:pointer';
  const paint = () => { btn.textContent = muted ? '소리 꺼짐' : '소리 켜짐'; if (master) master.gain.setTargetAtTime(muted ? 0 : .8, ac.currentTime, .05); };
  function start() { if (ac) { if (ac.state === 'suspended') ac.resume(); return; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : .8; master.connect(ac.destination);
    const nb = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (type, fq, q) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = fq; f.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return { g, f }; };
    wind = noise('bandpass', 380, .6); surf = noise('lowpass', 520, .4); rain = noise('highpass', 2600, .3); }
  btn.addEventListener('click', e => { e.stopPropagation(); muted = !muted; try { localStorage.setItem('engine.mute', muted ? '1' : '0'); } catch (x) {} if (!muted) start(); paint(); btn.blur(); });
  addEventListener('pointerdown', start); addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat) btn.click(); else start(); });
  function build() { paint(); document.body.appendChild(btn); G.snd = { get ac() { return ac; }, get out() { return master; } };
    G.tick.push(t => { if (!ac) return; const now = ac.currentTime, W = Weather.S, cam = G.camera.position, shore = 1 - sm(2, 40, cam.y) * 1;
      wind.g.gain.setTargetAtTime(Math.min(.3, .012 + W.speed * W.speed * .0005), now, .3); wind.f.frequency.setTargetAtTime(300 + W.speed * 22 + 60 * Math.sin(t * .6), now, .3);
      surf.g.gain.setTargetAtTime(shore * (.05 + .04 * Math.sin(t * .55)) * (1 - W.ice), now, .4); rain.g.gain.setTargetAtTime(W.rain * .09, now, .3); }); }
  return { build };
})();
