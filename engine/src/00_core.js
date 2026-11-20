'use strict';
// ---- the ground everything stands on: small maths, seeded random, noise on the CPU and in GLSL, the shared state G,
//      and patch(), which slips shader code into three.js's standard materials. ----
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const CAPTURE = Q.has('capture'), LOW = Q.has('low');
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
// mulberry32: a small seeded generator, so a world built twice is the same world
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// keyed curve: [[x, y], ...] sorted by x, eased between keys
const keyed = ks => x => { if (x <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (x <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], sm(ks[i - 1][0], ks[i][0], x)); return ks[ks.length - 1][1]; };

// gradient noise in three dimensions (Perlin's improved noise), with the usual sums built on it
const NZ = (() => {
  const p = new Uint8Array(512), r = rng(20261112), perm = []; for (let i = 0; i < 256; i++) perm.push(i);
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; } for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10), mix = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  function n3(x, y, z) { let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
    const u = fade(x), v = fade(y), w = fade(z), A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return mix(mix(mix(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), mix(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      mix(mix(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), mix(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w); }
  const fbm = (x, y, z, o = 5, lac = 2.03, g = .5) => { let a = .5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * n3(x * f, y * f, z * f); f *= lac; a *= g; } return s; };
  const ridged = (x, y, z, o = 5) => { let a = .5, s = 0, f = 1, w = 1; for (let i = 0; i < o; i++) { let n = 1 - Math.abs(n3(x * f, y * f, z * f)); n *= n; s += n * a * w; w = clamp(n * 1.6); f *= 2.11; a *= .5; } return s; };
  return { n3, fbm, ridged };
})();

// what every module can see. U holds the uniforms of the light and the air, fed to every material that is compiled.
const G = { t: 0, tAbs: 0, day: 10, look: { shadows: true, air: true, bounce: true, field: true, shafts: true, bloom: true, adapt: true, film: true },      // look: the parts of the lighting, each of which can be switched off to compare
  uTime: { value: 0 }, uGust: { value: 0 }, uWind: { value: 0 }, tick: [], info: {},
  U: { uSunDir: { value: new THREE.Vector3(.4, .8, .45).normalize() }, uSunK: { value: new THREE.Vector3(1, 1, 1) }, uFogCol: { value: new THREE.Vector3(.62, .72, .85) }, uFogP: { value: new THREE.Vector4(.0004, .012, 0, 1) }, uFogM: { value: new THREE.Vector2(0, .25) } } };

const GLSL_NOISE = /* glsl */`
#ifndef CL_NOISE
#define CL_NOISE
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash31(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm2(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(17.1,9.2,5.3); a*=.5; } return s; }
#endif
`;
// wind on a plant: a slow lean with the gusts and a quick flutter on top. uWind is the wind's phase, uGust its strength 0..1
const GLSL_WIND = /* glsl */`
#ifndef CL_WIND
#define CL_WIND
uniform float uWind; uniform float uGust;
vec3 clWind(vec3 wp, float w){
  float g = .3 + 1.5 * uGust, lean = sin(uWind * 1.25 + wp.x * .11 + wp.z * .07) * .55 + sin(uWind * 2.9 + wp.z * .33 + wp.y * .21) * .28;
  float fl = sin(uWind * 7.3 + wp.x * 2.1 + wp.y * 1.7 + wp.z * 1.3) * .06 * (.6 + 2. * uGust);
  return w * (vec3(-.8, .06, .32) * (lean * g + .35 * uGust) + vec3(fl, fl * .6, -fl)); }
#endif
`;
// the air between the eye and a surface: fog that thins with height, integrated along the line of sight, lit towards the sun
const GLSL_AIR = /* glsl */`
#ifndef CL_AIR
#define CL_AIR
uniform vec3 uSunDir, uSunK, uFogCol; uniform vec4 uFogP; uniform vec2 uFogM;
#ifndef SUN_DIR
#define SUN_DIR uSunDir
#endif
vec3 clSunK(vec3 wp, out float so){ so = 1.; return uSunK; }
vec3 clAir(vec3 col, vec3 wp){ vec3 v = wp - cameraPosition; float d = length(v); vec3 n = v / max(d, 1e-4);
  float t = uFogP.y * v.y, k = abs(t) > 1e-3 ? (1. - exp(-t)) / t : 1., od = uFogP.x * min(exp(-uFogP.y * (cameraPosition.y - uFogP.z)), 3.) * d * k;
  float t2 = uFogM.y * v.y, k2 = abs(t2) > 1e-3 ? (1. - exp(-t2)) / t2 : 1.; od += uFogM.x * min(exp(-uFogM.y * (cameraPosition.y - uFogP.z)), 3.) * d * k2;      // the mist: thick at the waterline, gone a few metres up
  float sd = max(dot(n, uSunDir), 0.); vec3 fc = uFogCol + uSunK * (.5 * pow(sd, 8.) + .9 * pow(sd, 48.)) * uFogP.w; return mix(col, fc, clamp(1. - exp(-od), 0., 1.)); }
#endif
`;
// three.js's own fog is replaced by that air in every built-in material (scene.fog only switches it on)
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying vec3 vFogW;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n #ifdef USE_INSTANCING\n  vFogW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n #else\n  vFogW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n #endif\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n varying vec3 vFogW;\n' + GLSL_AIR + '\n#endif';
THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n gl_FragColor.rgb = clAir(gl_FragColor.rgb, vFogW);\n#endif';
const feed = u => { for (const k in G.U) u[k] = G.U[k]; };
THREE.Material.prototype.onBeforeCompile = function (sh) { feed(sh.uniforms); };

// patch(material, s => { s.v(find, replace); s.f(find, replace); s.vHead(code); s.fHead(code); }, key)
function patch(mat, fn, key) {
  mat.onBeforeCompile = sh => { sh.uniforms.uTime = G.uTime; sh.uniforms.uWind = G.uWind; sh.uniforms.uGust = G.uGust; if (G.uWx) sh.uniforms.uWx = G.uWx; feed(sh.uniforms);
    fn({ sh,
      v: (a, b) => { if (!sh.vertexShader.includes(a)) console.warn('patch miss (v)', key, a); sh.vertexShader = sh.vertexShader.replace(a, b); },
      f: (a, b) => { if (!sh.fragmentShader.includes(a)) console.warn('patch miss (f)', key, a); sh.fragmentShader = sh.fragmentShader.replace(a, b); },
      vHead: s => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + s); },
      fHead: s => { sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + s); } }); };
  mat.customProgramCacheKey = () => key; return mat; }
