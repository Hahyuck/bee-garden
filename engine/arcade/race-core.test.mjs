import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK, createRace, startRace, stepRace, resetCar, togglePause } from './race-core.js';

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const drive = (race, seconds, input = { throttle: 1 }, fps = 60) => {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) stepRace(race, input, 1 / fps);
};
const racing = difficulty => {
  const race = createRace({ difficulty });
  startRace(race);
  stepRace(race, {}, 3);
  assert.equal(race.phase, 'racing');
  return race;
};
const isolate = race => {
  race.opponents.forEach((o, i) => { o.distance = race.player.distance + 350 + i * 35; o.lateral = -7; });
};

test('stadium closes, wraps both directions, and exposes continuous orthonormal frames', () => {
  close(TRACK.length, 880 + Math.PI * 360);
  assert.equal(TRACK.halfWidth, 12);
  assert.deepEqual(TRACK.sample(0), TRACK.sample(TRACK.length));
  const start = TRACK.sample(0);
  close(start.x, -180); close(start.z, 0); close(start.tx, 0); close(start.tz, 1);
  close(start.nx, 1); close(start.nz, 0);
  for (let d = -20; d < TRACK.length + 20; d += 5.7) {
    const a = TRACK.sample(d), b = TRACK.sample(d + TRACK.length);
    for (const value of Object.values(a)) assert.ok(Number.isFinite(value));
    close(a.x, b.x); close(a.z, b.z);
    close(Math.hypot(a.tx, a.tz), 1);
    close(Math.hypot(a.nx, a.nz), 1);
    close(a.tx * a.nx + a.tz * a.nz, 0);
    assert.ok(a.bank >= 0 && a.bank <= .16);
  }
  for (const d of [220, 220 + 180 * Math.PI, 660 + 180 * Math.PI, 660 + 360 * Math.PI]) {
    const before = TRACK.sample(d - .001), after = TRACK.sample(d + .001);
    assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < .00201);
    assert.ok(Math.hypot(before.tx - after.tx, before.tz - after.tz) < .00002);
    assert.ok(before.bank < .0001 && after.bank < .0001);
  }
});

test('countdown consumes supplied time and blocks movement before GO', () => {
  const race = createRace();
  startRace(race);
  stepRace(race, { throttle: 1 }, 2.5);
  assert.equal(race.phase, 'countdown');
  close(race.countdown, .5);
  assert.equal(race.player.distance, 0);
  assert.equal(race.elapsed, 0);
  stepRace(race, { throttle: 1 }, .5);
  assert.equal(race.phase, 'racing');
  assert.equal(race.lastEvent.type, 'go');
  assert.equal(race.player.speed, 0);
  stepRace(race, { throttle: 1 }, .5);
  close(race.elapsed, .5);
  assert.ok(race.player.distance > 1);
});

test('fixed simulation is equivalent at 30, 60 and 144 frames per second', () => {
  const runs = [30, 60, 144].map(fps => {
    const race = racing();
    drive(race, 12, { throttle: 1, steer: .05 }, fps);
    return race;
  });
  for (const race of runs.slice(1)) {
    for (const key of ['distance', 'lateral', 'speed', 'heading', 'rpm']) close(race.player[key], runs[0].player[key], 1e-8);
    close(race.elapsed, runs[0].elapsed);
    close(race.timeLeft, runs[0].timeLeft);
    assert.deepEqual(race.stats, runs[0].stats);
    race.opponents.forEach((o, i) => close(o.distance, runs[0].opponents[i].distance));
  }
});

test('acceleration, automatic gears, brake and drift respond to current controls', () => {
  const race = racing();
  isolate(race);
  drive(race, 4, { throttle: 1 });
  assert.ok(race.player.speed > 45);
  assert.ok(race.player.gear >= 3);
  const speed = race.player.speed;
  drive(race, .5, { brake: 1 });
  assert.ok(race.player.speed < speed - 10);
  drive(race, .3, { throttle: 1, steer: .6, drift: true });
  assert.equal(race.player.drifting, true);
  assert.ok(race.stats.driftSeconds > .15);
  drive(race, .1, {});
  assert.equal(race.player.drifting, false);
});

test('pause freezes clock, traffic and position, then resumes without remembered throttle', () => {
  const race = racing();
  drive(race, 2);
  togglePause(race);
  const before = JSON.stringify({ player: race.player, opponents: race.opponents, elapsed: race.elapsed, timeLeft: race.timeLeft });
  stepRace(race, { throttle: 1, steer: 1, drift: true }, 20);
  assert.equal(JSON.stringify({ player: race.player, opponents: race.opponents, elapsed: race.elapsed, timeLeft: race.timeLeft }), before);
  const speed = race.player.speed;
  togglePause(race);
  assert.equal(race.phase, 'racing');
  stepRace(race, {}, .1);
  assert.ok(race.player.speed < speed);
  assert.equal(race.player.drifting, false);
  assert.equal(race._steer, 0);
  const countdown = createRace(); startRace(countdown); stepRace(countdown, {}, 1);
  togglePause(countdown); stepRace(countdown, {}, 10); togglePause(countdown);
  assert.equal(countdown.phase, 'countdown'); close(countdown.countdown, 2);
});

test('recovery preserves exact progress and applies a single time penalty', () => {
  const race = racing();
  race.player.distance = TRACK.checkpointDistances[0] - .25;
  race.player.lateral = -14;
  race.player.speed = 71;
  race.player.heading = -.2;
  const distance = race.player.distance, time = race.timeLeft, checkpoint = race.checkpointIndex;
  resetCar(race);
  assert.equal(race.player.distance, distance);
  assert.equal(race.checkpointIndex, checkpoint);
  assert.equal(race.player.lateral, 0);
  assert.equal(race.player.heading, 0);
  assert.equal(race.player.speed, 16);
  assert.equal(race.timeLeft, time - 3);
  assert.equal(race.stats.resets, 1);
  race.player.speed = 0;
  stepRace(race, {}, .1);
  assert.equal(race.checkpointIndex, checkpoint);
});

test('ordered gates extend time only once and advance the lap at the finish line', () => {
  const race = racing();
  for (let gate = 1; gate <= 3; gate++) {
    race.player.distance = gate * TRACK.length / 3 - .1;
    race.player.speed = 60; race.player.lateral = 0; race.player.heading = 0;
    isolate(race);
    const time = race.timeLeft;
    stepRace(race, {}, .05);
    assert.equal(race.checkpointIndex, gate);
    close(race.timeLeft, time + 9 - .05, 1e-7);
    race.player.speed = 0;
    stepRace(race, {}, .1);
    assert.equal(race.checkpointIndex, gate);
    assert.equal(race.stats.checkpoints, gate);
  }
  assert.equal(race.lap, 2);
  assert.equal(race.lastEvent.type, 'lap');
});

test('a steering driver completes all three laps against moving rivals', () => {
  const race = racing();
  for (let frame = 0; frame < 120 * 60 && race.phase === 'racing'; frame++) {
    const p = race.player, curve = TRACK.sample(p.distance).curvature;
    const corner = curve * p.speed * .075 / (.08 + .045 * p.speed / (300 / 3.6));
    const steer = Math.max(-1, Math.min(1, corner + (7 - p.lateral) * .085 - p.heading * .8));
    stepRace(race, { throttle: 1, steer }, 1 / 60);
  }
  assert.equal(race.phase, 'finished');
  assert.equal(race.lap, 3);
  assert.equal(race.checkpointIndex, 9);
  assert.equal(race.stats.checkpoints, 9);
  assert.equal(race.player.distance, TRACK.length * 3);
  assert.ok(race.elapsed > 60 && race.elapsed < 110);
  assert.equal(race.finishTime, race.elapsed);
  assert.equal(race.position, 1);
  assert.ok(race.opponents.every(o => o.distance > TRACK.length * 2));
  assert.equal(race.lastEvent.type, 'finish');
  const finish = JSON.stringify(race);
  stepRace(race, { throttle: 1 }, 20);
  assert.equal(JSON.stringify(race), finish);
});

test('timeout ends racing without a completion record, including recovery penalty', () => {
  const race = racing(); race.timeLeft = .12;
  stepRace(race, {}, .2);
  assert.equal(race.phase, 'timeout');
  assert.equal(race.timeLeft, 0);
  assert.equal(race.finishTime, null);
  assert.equal(race.lastEvent.type, 'timeout');
  const other = racing(); other.timeLeft = 2;
  resetCar(other);
  assert.equal(other.phase, 'timeout');
});

test('drafting requires an ahead car in the same lane and fades when leaving it', () => {
  const race = racing();
  race.player.distance = 30; race.player.lateral = 0; race.player.speed = 65;
  isolate(race);
  Object.assign(race.opponents[0], { distance: 50, lateral: 0, baseLane: 0, speed: 65, cruiseSpeed: 65 });
  stepRace(race, { throttle: 1 }, .25);
  assert.equal(race.player.slipstream, true);
  assert.ok(race.player.draft > .2);
  assert.ok(race.stats.draftSeconds > 0);
  race.player.lateral = -8;
  stepRace(race, { throttle: 1 }, .25);
  assert.equal(race.player.slipstream, false);
  assert.equal(race.player.draft, 0);
});

test('traffic contact slows the car and cooldown prevents repeated instant penalties', () => {
  const race = racing();
  Object.assign(race.player, { distance: 40, lateral: 0, speed: 65 });
  isolate(race);
  Object.assign(race.opponents[0], { distance: 43, lateral: 0, baseLane: 0, speed: 50, cruiseSpeed: 50 });
  stepRace(race, {}, 1 / 120);
  assert.equal(race.stats.collisions, 1);
  assert.ok(race.player.speed < 50);
  assert.equal(race.lastEvent.type, 'collision');
  stepRace(race, {}, .1);
  assert.equal(race.stats.collisions, 1);
});

test('outer barrier retains the car on the circuit and costs speed', () => {
  const race = racing(); isolate(race);
  Object.assign(race.player, { speed: 60, lateral: 14.14, heading: .15 });
  race._steer = 1;
  stepRace(race, { throttle: 1, steer: 1 }, .1);
  assert.ok(race.stats.wallHits > 0);
  assert.ok(Math.abs(race.player.lateral) <= 14.15);
  assert.ok(race.player.speed < 50);
  assert.equal(race.lastEvent.type, 'barrier');
});

test('restart resets race data but event identifiers remain monotonic', () => {
  const race = racing('easy'); drive(race, 1);
  const id = race.lastEvent.id;
  startRace(race);
  assert.equal(race.phase, 'countdown');
  assert.equal(race.difficulty, 'easy');
  assert.equal(race.timeLeft, 60);
  assert.equal(race.elapsed, 0);
  assert.equal(race.player.distance, 0);
  assert.ok(race.lastEvent.id > id);
  assert.equal(race.stats.collisions, 0);
});

test('invalid dt and non-finite controls cannot corrupt the simulation', () => {
  const race = racing();
  const before = JSON.stringify(race);
  for (const dt of [0, -1, NaN, Infinity]) stepRace(race, { throttle: 1 }, dt);
  assert.equal(JSON.stringify(race), before);
  stepRace(race, { throttle: NaN, steer: Infinity, brake: -Infinity }, .1);
  for (const key of ['distance', 'lateral', 'speed', 'heading', 'rpm']) assert.ok(Number.isFinite(race.player[key]));
  assert.equal(race.player.speed, 0);
});
