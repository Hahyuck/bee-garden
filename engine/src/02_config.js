'use strict';
// ---- the numbers worth turning, in one place. Change a value, reload dev.html, see it. Modules read CFG when they are built,
//      so nothing here needs a rebuild of anything else. Units are SI: metres, seconds, kilograms, newtons, degrees Celsius. ----
const CFG = {
  phys: {
    engineUrl: 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.3/rapier.mjs',
    step: 1 / 240,            // fixed step of the rigid-body world
    gravity: -9.81,
    tile: 32,                 // side of one ground tile made solid around the focus
    tileRing: 3,              // tiles kept solid on each side of the focus
    seaLevel: 0, waterDensity: 1000, waterDrag: 1.6,
    airDensity: 1.2,
    blast: { power: 900, radius: 9 },
    throwSpeed: 24,
  },
  weather: {
    start: 'clear',           // auto | clear | rain | snow | frost
    tempMild: 16, tempStorm: 9, tempSnow: -3, tempFrost: -14,
    tempEase: 5,              // seconds for the air to follow the weather
    snowRate: .055,           // share of full cover laid down per second of full snowfall
    meltRate: .07,            // share melted per second at 16 degrees
    rainWash: .1,             // share washed off per second of full rain
    freezeRate: .07, thawRate: .12,
    iceInSnow: .35,           // how far the ground ices over in plain snow; frost takes it to 1
    windCalm: 4, windStorm: 22, windCold: 5, windDir: [-.8, 0, .6],
    flakes: 9000, flakeBox: 44, flakeFall: 1.5,
    drops: 7000, dropBox: 34, dropFall: 11,
    autoPeriod: 300,          // seconds for the automatic weather to come round
    bounce: .06,              // strength of the sun's first bounce off the ground into the fill light
    albedoGround: [.2, .17, .1], albedoSnow: [.85, .88, .92],
  },
  time: {},
  sky: {
    dayLength: 720,           // seconds of real time for one day and night (T stops the clock, [ and ] move it an hour)
    noonElevation: 58, azimuth: 150,
    sunIntensity: 9, fillIntensity: 3,
    fogDensity: .00022, fogFalloff: .006,
    mist: .008, mistFalloff: .22,      // the low mist: how thick at the waterline, how fast it thins with height
  },
  sea: { level: 0, swell: .22, windSwell: .9 },
  surface: { fillTime: 5, drainTime: 38, rippleRange: 16 },  // seconds to fill/drain hollows; rain rings resolve within this many metres
  light: { occlusion: .5, bounce: .05 },       // the light field: how much the canopy blocks the sky's fill, how much sunlit canopy gives back
  post: { exposure: 1, nightGain: 3.2, snowStop: .38, shafts: .9, fringe: .0009,      // fringe: colour fringing at the frame's edge; much more than this turns thin dark things against the sky purple
    contactRadius: .95, contactStrength: 1.65,  // maximum sampling distance in metres and occlusion gain
    bloom: 1, vignette: .38, grain: .028 },
  lens: { beeAperture: 1.1 },      // the bee's lens: how wide it is open (the Bee Garden's own value; larger blurs more away from the focus)
  camera: { fov: 60, flySpeed: 7, flyFast: 40, eye: 1.66, walkSpeed: 1.35 },
  car: {
    mass: 980, inertia: [1450, 1650, 520], comY: -.26,
    wheelRadius: .3, springRest: .3, springTravel: .17, spring: 27000, damper: 2900,
    grip: [1.05, .78, .62, .5],        // asphalt, gravel shoulder, grass, sand
    rolling: [14, 70, 110, 190],
    gears: [0, 3.55, 2.05, 1.42, 1.08, .86], finalDrive: 3.9, reverse: 3.4,
    torque: 168, brake: 9500, drag: .42,
    steerLock: .56, steerSpeedK: 31,
    wetGripLoss: .2, iceGripLoss: .65, snowGripLoss: .45, snowRolling: 60,
  },
};
