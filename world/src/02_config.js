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
    start: 'auto',            // auto | clear | rain | snow | frost
    tempMild: 16, tempStorm: 9, tempSnow: -3, tempFrost: -14,
    tempEase: 5,              // seconds for the air to follow the weather
    snowRate: .055,           // share of full cover laid down per second of full snowfall
    meltRate: .07,            // share melted per second at 16 degrees
    rainWash: .1,             // share washed off per second of full rain
    freezeRate: .07, thawRate: .12,
    iceInSnow: .35,           // how far the ground ices over in plain snow; frost takes it to 1
    windCalm: 4, windStorm: 22, windCold: 5, windDir: [-.8, 0, .6],
    flakes: 9000, flakeBox: 44, flakeFall: 1.5,
    bounce: .06,              // strength of the sun's first bounce off the ground into the fill light
    albedoGround: [.2, .17, .1], albedoSnow: [.85, .88, .92],
  },
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
