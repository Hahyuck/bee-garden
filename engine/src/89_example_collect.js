'use strict';
// ---- an example of a game made on the engine, kept small on purpose: "gather the barrels". Press 0.
//      Ten yellow barrels are set down around you; fly into one to take it; the clock runs for sixty seconds.
//      It shows the four things a game needs from the engine: a mode of its own, things placed in the physics world,
//      a rule checked every frame, and a line of readout. Copy this file to start a game of your own. ----
const Collect = (() => {
  const N = 10, TIME = 60; let items = [], score = 0, left = 0, best = 0;
  function enter() { score = 0; left = TIME; const p = Modes.fly.p;
    for (const e of items) if (!e.got) e.b.setTranslation({ x: 0, y: -100, z: 0 }, true);       // clear what the last round left (far below, the physics puts a body to rest)
    items = []; for (let i = 0; i < N; i++) { const a = i / N * TAU, r = 14 + 22 * Math.random(), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      Phys.prime(x, z, 0);                                                                       // make the ground solid there before something lands on it
      const e = Phys.spawn('barrel', x, Math.max(Island.surf(x, z)[0], 0) + 1.5, z, { color: 0xffd040 }); if (e) items.push(e); } }
  function step(camera, dt) { Modes.MODES.free.step(camera, dt);                                 // move like free flight
    if (left > 0) { left -= dt; for (const e of items) { if (e.got) continue; const q = e.b.translation();
        if (camera.position.distanceTo(q) < 2.6) { e.got = true; score++; FX.blast(q.x, q.y, q.z, 3); Phys.thump(.4); e.b.setTranslation({ x: q.x, y: -100, z: q.z }, true); } }
      if (score === items.length || left <= 0) { best = Math.max(best, score); left = 0; } }
    return left > 0 ? `통 모으기 ${score} / ${items.length} · 남은 시간 ${left.toFixed(0)}초` : `끝! ${score}개 · 최고 ${best}개 · 0 을 다시 누르면 새 판`; }
  Modes.add('collect', { name: '통 모으기', enter, leave() {}, step }, 'Digit0', '0');
  return { get score() { return score; }, get items() { return items; } };
})();
