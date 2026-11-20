// Pure arcade race simulation. Metres, seconds, radians; no DOM or renderer state.
// Clockwise stadium in XZ. Start: (-180, 4, 0), tangent +Z. Positive lateral is
// the driver's right / infield. A rendered point is center + normal * lateral,
// with y = sample.y - lateral * tan(sample.bank). Heading is relative to tangent.
const PI = Math.PI;
const RADIUS = 180;
const STRAIGHT = 440;
const ARC = PI * RADIUS;
const LENGTH = 2 * STRAIGHT + 2 * ARC;
const STEP = 1 / 120;
const TOP_SPEED = 300 / 3.6;
const CHECKPOINT_SPACING = LENGTH / 3;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const wrap = x => ((x % LENGTH) + LENGTH) % LENGTH;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const separation = (a, b) => wrap(a - b + LENGTH / 2) - LENGTH / 2;

function sampleTrack(distance) {
  let s = wrap(Number.isFinite(distance) ? distance : 0);
  let x, z, tx, tz, local = 0, onCurve = false;
  if (s < STRAIGHT / 2) {
    x = -RADIUS; z = s; tx = 0; tz = 1;
  } else if (s < STRAIGHT / 2 + ARC) {
    local = s - STRAIGHT / 2;
    const a = local / RADIUS;
    x = -RADIUS * Math.cos(a); z = STRAIGHT / 2 + RADIUS * Math.sin(a);
    tx = Math.sin(a); tz = Math.cos(a); onCurve = true;
  } else if (s < STRAIGHT * 1.5 + ARC) {
    local = s - STRAIGHT / 2 - ARC;
    x = RADIUS; z = STRAIGHT / 2 - local; tx = 0; tz = -1;
  } else if (s < STRAIGHT * 1.5 + ARC * 2) {
    local = s - STRAIGHT * 1.5 - ARC;
    const a = local / RADIUS;
    x = RADIUS * Math.cos(a); z = -STRAIGHT / 2 - RADIUS * Math.sin(a);
    tx = -Math.sin(a); tz = -Math.cos(a); onCurve = true;
  } else {
    local = s - STRAIGHT * 1.5 - ARC * 2;
    x = -RADIUS; z = -STRAIGHT / 2 + local; tx = 0; tz = 1;
  }
  return {
    x, y: 4, z, tx, tz, nx: tz, nz: -tx,
    yaw: Math.atan2(tx, tz), curvature: onCurve ? 1 / RADIUS : 0,
    bank: onCurve ? .16 * ease(local / 42) * ease((ARC - local) / 42) : 0,
  };
}

export const TRACK = Object.freeze({
  length: LENGTH, halfWidth: 12, radius: RADIUS, straightLength: STRAIGHT,
  checkpointDistances: Object.freeze([CHECKPOINT_SPACING, CHECKPOINT_SPACING * 2, LENGTH]),
  sample: sampleTrack,
});

const COLORS = [0x268bff, 0xffc849, 0xc6f04a, 0xb782ff, 0xff7547, 0x42d4d0, 0xf2e9d2];
const NAMES = ['COBALT', 'SOLAR', 'VECTOR', 'NOVA', 'TORQUE', 'TIDAL', 'APEX'];

export function createRace({ difficulty = 'normal' } = {}) {
  const easy = difficulty === 'easy';
  return {
    difficulty: easy ? 'easy' : 'normal', phase: 'ready', resumePhase: 'racing',
    countdown: 3, elapsed: 0, timeLeft: easy ? 60 : 45,
    lap: 1, totalLaps: 3, position: 8, totalCars: 8,
    player: {
      distance: 0, lateral: 3.3, speed: 0, heading: 0,
      drifting: false, slipstream: false, draft: 0, gear: 1, rpm: 950,
    },
    opponents: NAMES.map((name, i) => ({
      id: i + 1, name, color: COLORS[i], distance: 54 - i * 6,
      lateral: i % 2 ? 3.3 : -3.3, speed: 0, heading: 0,
      baseLane: i % 2 ? 3.3 : -3.3,
      cruiseSpeed: (easy ? 67 : 73) + [1.2, -1.0, 3.4, 0, 2.8, .5, 4.0][i],
    })),
    checkpointIndex: 0, checkpointCount: 9, distanceToCheckpoint: CHECKPOINT_SPACING,
    flash: { text: '', ttl: 0, kind: 'info' }, lastEvent: null, finishTime: null,
    stats: { overtakes: 0, collisions: 0, wallHits: 0, driftSeconds: 0, draftSeconds: 0, checkpoints: 0, resets: 0 },
    _accumulator: 0, _eventSequence: 0, _steer: 0,
    _wallCooldown: 0, _hitCooldown: 0, _countdownLabel: 3,
  };
}

function announce(race, type, text, kind = 'info', ttl = 1.8) {
  race.lastEvent = { id: ++race._eventSequence, type, at: race.elapsed, text };
  race.flash = { text, ttl, kind };
}

export function startRace(race) {
  const sequence = race._eventSequence;
  Object.assign(race, createRace({ difficulty: race.difficulty }));
  race._eventSequence = sequence;
  race.phase = 'countdown';
  announce(race, 'start', '3', 'countdown', 3);
  return race;
}

export function togglePause(race) {
  if (race.phase === 'paused') {
    race.phase = race.resumePhase;
    race._steer = 0;
    race._accumulator = 0;
    announce(race, 'resume', 'BACK TO THE RACE', 'info', 1);
  } else if (race.phase === 'racing' || race.phase === 'countdown') {
    race.resumePhase = race.phase;
    race.phase = 'paused';
    race._steer = 0;
    race._accumulator = 0;
    race.player.drifting = false;
    race.player.slipstream = false;
    announce(race, 'pause', 'PAUSED', 'info', 0);
  }
  return race.phase;
}

export function resetCar(race) {
  if (!['ready', 'countdown', 'racing', 'paused'].includes(race.phase)) return;
  // Recovery never advances distance or checkpoints, including near the line.
  race.player.lateral = 0;
  race.player.heading = 0;
  race.player.speed = Math.min(race.player.speed, 16);
  race.player.drifting = false;
  race.player.slipstream = false;
  race.player.draft = 0;
  race._steer = 0;
  race._hitCooldown = 1;
  race._wallCooldown = 1;
  race.stats.resets++;
  const active = race.phase === 'racing' || (race.phase === 'paused' && race.resumePhase === 'racing');
  if (active) race.timeLeft = Math.max(0, race.timeLeft - 3);
  announce(race, 'recover', active ? 'BACK ON TRACK  −3 SEC' : 'BACK ON TRACK', 'warning');
  if (active && race.timeLeft === 0) endRace(race, false);
}

function updateOpponents(race, dt) {
  const p = race.player;
  for (const o of race.opponents) {
    const track = sampleTrack(o.distance);
    let targetLane = o.baseLane + 1.1 * Math.sin(o.distance / 170 + o.id * 1.7);
    let targetSpeed = o.cruiseSpeed - (track.curvature ? 2.6 : 0);
    // Small pace correction keeps the field competitive, never teleports a car.
    targetSpeed += clamp((p.distance - o.distance) / 170, -1.5, 2);
    for (const other of race.opponents) {
      if (other === o) continue;
      const gap = separation(other.distance, o.distance);
      if (gap > 0 && gap < 20 && Math.abs(other.lateral - o.lateral) < 2.5) {
        targetLane = o.lateral < 0 ? 4.4 : -4.4;
        if (gap < 7) targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 2));
      }
    }
    const oldLane = o.lateral;
    const laneStep = clamp(targetLane - oldLane, -1.7 * dt, 1.7 * dt);
    o.lateral += laneStep;
    o.heading = damp(o.heading, Math.atan2(laneStep / dt, Math.max(8, o.speed)), 7, dt);
    const acceleration = clamp((targetSpeed - o.speed) * .9, -9, 14);
    o.speed = Math.max(0, o.speed + acceleration * dt);
    o.distance += o.speed * dt;
  }
}

function updatePlayer(race, input, dt) {
  const p = race.player, easy = race.difficulty === 'easy';
  const track = sampleTrack(p.distance);
  race._steer = damp(race._steer, input.steer, input.drift ? 5.5 : 9, dt);
  p.drifting = input.drift && Math.abs(race._steer) > .12 && p.speed > 12;
  let following = false;
  for (const o of race.opponents) {
    const gap = separation(o.distance, p.distance);
    if (gap > 5 && gap < 46 && Math.abs(o.lateral - p.lateral) < 2.8 && p.speed > 18) following = true;
  }
  p.draft = clamp(p.draft + (following ? .9 : -1.4) * dt, 0, 1);
  p.slipstream = following && p.draft > .12;
  if (p.slipstream) race.stats.draftSeconds += dt;
  if (p.drifting) race.stats.driftSeconds += dt;
  const limit = TOP_SPEED + p.draft * 4.4;
  const acceleration = input.throttle * (17 * (1 - .78 * (p.speed / limit) ** 2) + p.draft);
  const resistance = .95 + .0004 * p.speed * p.speed;
  const braking = input.brake * 28 + (p.drifting ? 3.4 : 0);
  p.speed = clamp(p.speed + (acceleration - resistance - braking) * dt, 0, limit);

  // Most tangent rotation is assisted; the remaining outward drift still needs
  // steering in a bend. Track-relative heading makes keyboard taps predictable.
  const cornerDrift = track.curvature * p.speed * (easy ? .052 : .075);
  const steerAngle = .08 + .045 * p.speed / TOP_SPEED;
  const targetHeading = race._steer * steerAngle * (p.drifting ? 1.65 : 1) - cornerDrift * (p.drifting ? 1.55 : 1);
  p.heading = damp(p.heading, clamp(targetHeading, -.3, .3), p.drifting ? 2.4 : 7.5, dt);
  p.lateral += Math.sin(p.heading) * p.speed * dt;
  if (Math.abs(p.lateral) > 11.1) {
    p.speed = Math.max(0, p.speed - (8 + p.speed * (easy ? .09 : .16)) * dt);
  }
  if (Math.abs(p.lateral) > 14.15) {
    const side = Math.sign(p.lateral);
    p.lateral = side * 13.9;
    p.heading = -side * .045;
    if (race._wallCooldown <= 0) {
      p.speed *= easy ? .84 : .73;
      race._wallCooldown = .75;
      race.stats.wallHits++;
      announce(race, 'barrier', 'WALL CONTACT', 'warning', .9);
    }
  }
  // Turning toward the infield follows the shorter lane radius continuously.
  p.distance += p.speed * Math.cos(p.heading) / Math.max(.8, 1 - track.curvature * p.lateral) * dt;
  const gear = p.speed < 25 ? 1 : p.speed < 45 ? 2 : p.speed < 64 ? 3 : 4;
  p.gear = gear;
  p.rpm = damp(p.rpm, Math.max(950, 1200 + p.speed / [0, 25, 45, 64, 85][gear] * 5800 + input.throttle * 150), 12, dt);
}

function collide(race) {
  if (race._hitCooldown > 0) return;
  const p = race.player;
  for (const o of race.opponents) {
    const gap = separation(o.distance, p.distance), across = p.lateral - o.lateral;
    if ((gap / 4.8) ** 2 + (across / 1.9) ** 2 >= 1) continue;
    const side = across === 0 ? (o.id % 2 ? -1 : 1) : Math.sign(across);
    p.lateral = clamp(p.lateral + side * .75, -13.9, 13.9);
    p.heading = side * .04;
    p.speed = Math.max(0, Math.min(p.speed * .85, o.speed * .92));
    race._hitCooldown = .8;
    race.stats.collisions++;
    announce(race, 'collision', 'CONTACT!', 'warning', .85);
    break;
  }
}

function updatePosition(race) {
  const next = 1 + race.opponents.filter(o => o.distance > race.player.distance).length;
  if (race.phase === 'racing' && next < race.position) race.stats.overtakes += race.position - next;
  race.position = next;
}

function endRace(race, success) {
  race.phase = success ? 'finished' : 'timeout';
  race.player.drifting = false;
  race.player.slipstream = false;
  race.finishTime = success ? race.elapsed : null;
  race._accumulator = 0;
  announce(race, success ? 'finish' : 'timeout', success ? 'FINISH!' : 'TIME OVER', success ? 'success' : 'warning', 20);
}

function simulate(race, input, dt) {
  race.flash.ttl = Math.max(0, race.flash.ttl - dt);
  if (race.phase === 'countdown') {
    race.countdown = Math.max(0, race.countdown - dt);
    const count = Math.ceil(race.countdown - 1e-9);
    if (count <= 0) {
      race.phase = 'racing';
      race.countdown = 0;
      announce(race, 'go', 'GO!', 'success', 1.3);
    } else if (count !== race._countdownLabel) {
      race._countdownLabel = count;
      announce(race, 'countdown', String(count), 'countdown', 1);
    }
    return;
  }
  if (race.phase !== 'racing') return;
  race.elapsed += dt;
  race.timeLeft = Math.max(0, race.timeLeft - dt);
  race._wallCooldown = Math.max(0, race._wallCooldown - dt);
  race._hitCooldown = Math.max(0, race._hitCooldown - dt);
  const previousDistance = race.player.distance;
  updateOpponents(race, dt);
  updatePlayer(race, input, dt);
  collide(race);
  updatePosition(race);
  while (race.player.distance + 1e-9 >= (race.checkpointIndex + 1) * CHECKPOINT_SPACING) {
    race.checkpointIndex++;
    race.stats.checkpoints++;
    if (race.checkpointIndex === race.checkpointCount) {
      const finish = race.totalLaps * LENGTH;
      const covered = race.player.distance - previousDistance;
      const fraction = covered > 0 ? clamp((finish - previousDistance) / covered, 0, 1) : 1;
      race.elapsed -= (1 - fraction) * dt;
      race.player.distance = finish;
      race.lap = race.totalLaps;
      race.distanceToCheckpoint = 0;
      endRace(race, true);
      return;
    }
    const extension = race.difficulty === 'easy' ? 12 : 9;
    race.timeLeft = Math.min(99.99, race.timeLeft + extension);
    race.lap = Math.min(race.totalLaps, Math.floor(race.checkpointIndex / 3) + 1);
    const lap = race.checkpointIndex % 3 === 0;
    announce(race, lap ? 'lap' : 'checkpoint', lap ? `LAP ${race.lap} / ${race.totalLaps}  +${extension} SEC` : `TIME EXTEND  +${extension} SEC`, 'success', 2.1);
  }
  race.distanceToCheckpoint = Math.max(0, (race.checkpointIndex + 1) * CHECKPOINT_SPACING - race.player.distance);
  if (race.timeLeft <= 0) endRace(race, false);
}

export function stepRace(race, input = {}, dt = 0) {
  if (!Number.isFinite(dt) || dt <= 0 || !['countdown', 'racing'].includes(race.phase)) return race;
  const finite = value => Number.isFinite(value) ? value : 0;
  const controls = {
    throttle: clamp(finite(input.throttle), 0, 1), brake: clamp(finite(input.brake), 0, 1),
    steer: clamp(finite(input.steer), -1, 1), drift: !!input.drift,
  };
  // Fixed 120Hz substeps, with carried fractions, give identical behaviour at
  // 30/60/144fps. Consume the supplied dt: a 3s call completes the countdown.
  // A single pathological input is bounded to a minute; the UI also caps dt.
  race._accumulator += Math.min(dt, 60);
  while (race._accumulator + 1e-10 >= STEP && ['countdown', 'racing'].includes(race.phase)) {
    race._accumulator = Math.max(0, race._accumulator - STEP);
    simulate(race, controls, STEP);
  }
  return race;
}
