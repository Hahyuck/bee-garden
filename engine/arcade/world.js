import * as THREE from '../vendor/three.module.min.js';
import { TRACK } from './race-core.js';

// Original, procedural art. Both the WebGL and software renderers consume these
// same meshes; the race never depends on a network asset or texture decoder.
const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const COLORS = [0xffcf32, 0x268bff, 0xffc849, 0xc6f04a, 0xb782ff, 0xff7547, 0x42d4d0, 0xf2e9d2];
const BOX = new THREE.BoxGeometry(1, 1, 1);
const GLYPHS = {
  A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'], D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'], F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01111','10000','10000','10111','10001','10001','01111'], H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'], J:['00111','00010','00010','00010','10010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'], L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'], N:['10001','11001','10101','10011','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'], P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'], R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'], V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','10101','01010'], X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'], Z:['11111','00001','00010','00100','01000','10000','11111'],
  0:['01110','10001','10011','10101','11001','10001','01110'], 1:['00100','01100','00100','00100','00100','00100','01110'],
  2:['01110','10001','00001','00010','00100','01000','11111'], 3:['11110','00001','00001','01110','00001','00001','11110'],
  4:['00010','00110','01010','10010','11111','00010','00010'], 5:['11111','10000','10000','11110','00001','00001','11110'],
  6:['01110','10000','10000','11110','10001','10001','01110'], 7:['11111','00001','00010','00100','01000','01000','01000'],
  8:['01110','10001','10001','01110','10001','10001','01110'], 9:['01110','10001','10001','01111','00001','00001','01110'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'], '-':['00000','00000','00000','11111','00000','00000','00000']
};

function batches() {
  const buckets = new Map();
  function bucket(color, order = 0, unlit = false, side = THREE.FrontSide) {
    const key = `${color}/${order}/${unlit}/${side}`;
    if (!buckets.has(key)) buckets.set(key, { color, order, unlit, side, positions: [] });
    return buckets.get(key).positions;
  }
  function geometry(g, color, matrix, order = 0, unlit = false) {
    const p = g.attributes.position, index = g.index;
    const target = bucket(color, order, unlit), point = V(0, 0, 0);
    for (let i = 0, count = index ? index.count : p.count; i < count; i++) {
      point.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(matrix);
      target.push(point.x, point.y, point.z);
    }
  }
  function box(color, x, y, z, w, h, d, yaw = 0, order = 0) {
    geometry(BOX, color, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(w, h, d)), order);
  }
  function quad(color, a, b, c, d, order = 0, unlit = false, side = THREE.FrontSide) {
    const p = bucket(color, order, unlit, side);
    p.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  function finish(parent, prefix = 'batch') {
    for (const [key, b] of buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const Type = b.unlit ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
      const mesh = new THREE.Mesh(g, new Type({ color: b.color, side: b.side }));
      mesh.name = `${prefix}-${key}`; mesh.renderOrder = b.order;
      mesh.userData.unlit = b.unlit; mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
  return { geometry, box, quad, finish };
}

function roadPoint(s, lateral, lift = 0) {
  return [s.x + s.nx * lateral, s.y - lateral * Math.tan(s.bank || 0) + lift, s.z + s.nz * lateral];
}

// Lettering consists of small quads, so sponsor boards and the racing number
// survive the texture-free software renderer and the 240 px raster preset.
function lettering(batch, words, x, y, z, size, color, yaw = 0, pitch = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  const transform = (px, py) => V(px, py, 0).applyQuaternion(q).add(V(x, y, z)).toArray();
  const width = (words.length * 6 - 1) * size;
  for (let ci = 0; ci < words.length; ci++) {
    const glyph = GLYPHS[words[ci]] || GLYPHS[' '];
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) if (glyph[row][col] === '1') {
      const xx = -width / 2 + (ci * 6 + col) * size, yy = (3.5 - row) * size;
      batch.quad(color, transform(xx, yy - size), transform(xx, yy), transform(xx + size, yy), transform(xx + size, yy - size), 0, true, THREE.DoubleSide);
    }
  }
}

function makeCar(color, number) {
  const root = new THREE.Group(); root.name = `stock-car-${number}`;
  const shell = new THREE.Group(); root.add(shell);
  const b = batches();
  const navy = 0x17304b, glass = 0x253d56, highlight = 0x739aae;
  b.box(navy, 0, .43, 0, 2.24, .48, 4.72);
  b.box(color, 0, .78, -.05, 2.18, .47, 4.61);
  b.box(color, 0, 1.01, 1.35, 2.10, .13, 1.80);
  b.box(color, 0, 1.00, -1.68, 2.10, .14, 1.29);
  // Cabin roof and the sloped four-sided glazing are deliberately faceted.
  b.box(color, 0, 1.54, -.22, 1.78, .13, 1.64);
  b.quad(glass, [-1.02,1.06,1.11], [1.02,1.06,1.11], [.87,1.51,.55], [-.87,1.51,.55]);
  b.quad(glass, [1.01,1.06,-1.34], [-1.01,1.06,-1.34], [-.87,1.51,-1.03], [.87,1.51,-1.03]);
  b.quad(glass, [-1.04,1.05,-1.26], [-1.04,1.05,1.03], [-.89,1.51,.50], [-.89,1.51,-1.00]);
  b.quad(glass, [1.04,1.05,1.03], [1.04,1.05,-1.26], [.89,1.51,-1.00], [.89,1.51,.50]);
  b.box(highlight, 0, 1.526, .48, 1.45, .025, .09);
  b.box(color, -1.045, 1.26, -.38, .07, .48, .12);
  b.box(color, 1.045, 1.26, -.38, .07, .48, .12);
  // Twin hood stripes and rear-deck band; the navy contrasts against yellow.
  for (const x of [-.25, .25]) {
    b.box(navy, x, 1.083, 1.47, .26, .015, 1.38);
    b.box(navy, x, 1.615, -.22, .26, .015, 1.65);
  }
  b.box(navy, 0, 1.082, -1.80, 1.76, .016, .45);
  b.box(0x101923, 0, .62, 2.37, 1.32, .24, .03);
  b.box(0xebf7db, -.75, .84, 2.365, .42, .17, .035);
  b.box(0xebf7db, .75, .84, 2.365, .42, .17, .035);
  b.box(0xfc5350, -.81, .84, -2.366, .48, .15, .035);
  b.box(0xfc5350, .81, .84, -2.366, .48, .15, .035);
  b.box(0xeff2df, 0, .80, -2.37, .50, .20, .035);
  // Wide high rear wing makes the stock-car silhouette readable from chase view.
  b.box(navy, -.79, 1.19, -2.02, .10, .38, .15);
  b.box(navy, .79, 1.19, -2.02, .10, .38, .15);
  b.box(navy, 0, 1.40, -2.04, 2.40, .11, .47);
  b.box(color, -1.18, 1.44, -2.04, .075, .23, .47);
  b.box(color, 1.18, 1.44, -2.04, .075, .23, .47);
  for (const side of [-1, 1]) {
    b.box(0xeff2df, side * 1.096, .85, -.15, .018, .43, 1.20);
    lettering(b, String(number), side * 1.111, .88, -.15, .055, navy, side * PI / 2);
  }
  lettering(b, String(number), 0, 1.631, -.23, .10, 0xfff8dd, 0, PI / 2);
  b.finish(shell, `car-${number}`);
  const wheels = [];
  for (const x of [-1.08, 1.08]) for (const z of [-1.45, 1.45]) {
    const wheel = new THREE.Group(); wheel.position.set(x, .40, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .32, 8), new THREE.MeshLambertMaterial({ color: 0x18212c }));
    tire.rotation.z = PI / 2; wheel.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .335, 8), new THREE.MeshLambertMaterial({ color: 0xc8c8bd }));
    rim.rotation.z = PI / 2; wheel.add(rim);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(.35, .08, .43), new THREE.MeshLambertMaterial({ color: navy }));
    wheel.add(hub); root.add(wheel); wheels.push(wheel);
  }
  const shade = new THREE.Mesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ color: 0x303e46 }));
  shade.rotation.x = -PI / 2; shade.scale.set(1.24, 2.58, 1); shade.position.y = .024; root.add(shade);
  root.userData.shell = shell; root.userData.wheels = wheels;
  return root;
}

function addCircuit(batch) {
  const count = 384, stride = TRACK.length / count;
  const ribbon = (a, b, lo, hi, color, lift, order) => batch.quad(color, roadPoint(a, lo, lift), roadPoint(b, lo, lift), roadPoint(b, hi, lift), roadPoint(a, hi, lift), order);
  for (let i = 0; i < count; i++) {
    const d = i * stride, a = TRACK.sample(d), b = TRACK.sample(d + stride);
    ribbon(a, b, -17, 17, 0x65b6ad, -.055, -20);
    ribbon(a, b, -12, 12, i % 16 < 8 ? 0x586171 : 0x555f6f, 0, -20);
    ribbon(a, b, -13.5, -12, i % 4 < 2 ? 0xf1eee0 : 0xe65a4f, .025, -19);
    ribbon(a, b, 12, 13.5, i % 4 < 2 ? 0xf1eee0 : 0xe65a4f, .025, -19);
    ribbon(a, b, -11.70, -11.54, 0xf7ecd4, .035, -19);
    ribbon(a, b, 11.54, 11.70, 0xf7ecd4, .035, -19);
    if (i % 5 < 3) for (const offset of [-4, 4]) ribbon(a, b, offset - .07, offset + .07, 0xf7ecd4, .04, -19);
    if (i % 3 === 0) {
      const s = TRACK.sample(d + stride * 1.5), len = stride * 3 + .15;
      for (const side of [-1, 1]) {
        const p = roadPoint(s, side * 17.25, .39);
        batch.box(i % 12 < 6 ? 0xf0eee2 : 0xd9564f, ...p, .70, .8, len, s.yaw);
        if (side === -1) {
          const post = roadPoint(s, -17.65, 1.55);
          batch.box(0x738b92, ...post, .12, 2.5, .12, 0);
          const rail = roadPoint(s, -17.65, 2.75);
          batch.box(0x8b9fa4, ...rail, .08, .08, len, s.yaw);
        }
      }
    }
  }
  // Checker pattern across the actual starting/finishing line.
  for (let lane = 0; lane < 24; lane++) for (let row = 0; row < 3; row++) {
    const a = TRACK.sample(row * 1.2), b = TRACK.sample((row + 1) * 1.2);
    ribbon(a, b, lane - 12, lane - 11, (lane + row) % 2 ? 0x25344b : 0xf9f6e8, .055, -19);
  }
  // Mark the player grid visibly even when no countdown has begun.
  for (let row = 0; row < 4; row++) for (const lane of [-4, 4]) {
    const s = TRACK.sample(-row * 12 - 10), p = roadPoint(s, lane, .05);
    batch.box(0xe9e1c9, ...p, 3.3, .025, .16, s.yaw, -19);
  }
}

function addGantry(batch, distance, title, color = 0x17304b) {
  const s = TRACK.sample(distance), center = roadPoint(s, 0, 0);
  for (const side of [-1, 1]) {
    const p = roadPoint(s, side * 15.25, 4.65);
    batch.box(0xe7e9dc, ...p, .75, 9.3, .75, s.yaw);
  }
  batch.box(color, center[0], center[1] + 8.9, center[2], 31.3, 2.20, .9, s.yaw);
  const front = V(0, 0, -.48).applyAxisAngle(V(0, 1, 0), s.yaw);
  lettering(batch, title, center[0] + front.x, center[1] + 8.95, center[2] + front.z, .19, 0xfff6df, s.yaw);
  for (let i = 0; i < 14; i++) {
    const p = roadPoint(s, -14.5 + i * 2.2, 7.65);
    batch.box(i % 2 ? 0xffd246 : 0xe9efdf, ...p, 1.1, .22, 1, s.yaw);
  }
}

function addStands(batch) {
  // Main spectator stand on the outer west straight. Its descending terraces
  // face the circuit; the cyan roof gives the start straight a strong landmark.
  const x = -216, base = 3.1;
  batch.box(0xe4dfc7, x, base + 4.0, 35, 26, 8, 184);
  for (let row = 0; row < 8; row++) {
    const xx = -199.5 - row * 2.8, yy = 4.8 + row * 1.06;
    batch.box(row % 2 ? 0x88a6ac : 0x71919c, xx, yy, 35, 2.85, .65, 180);
    for (let seat = 0; seat < 68; seat++) {
      if ((seat + row * 3) % 11 === 0) continue;
      const zz = -53 + seat * 2.64;
      const color = [0xf9c857, 0xe86b5c, 0x4d89ba, 0xe9e4cb][(seat * 7 + row) % 4];
      // Two-sided vertical cards make a compact, colourful crowd.
      batch.quad(color, [xx,yy+.4,zz], [xx,yy+1.25,zz], [xx,yy+1.25,zz+1.2], [xx,yy+.4,zz+1.2], 0, false, THREE.DoubleSide);
    }
  }
  batch.box(0x2f778e, -214, 15.2, 35, 32, .9, 191);
  batch.box(0xf3d366, -197.9, 14.7, 35, .25, .7, 191);
  for (let z = -56; z <= 126; z += 26) batch.box(0xa0b6b1, -227, 9, z, .45, 13, .45);
  batch.box(0x23465c, -198.6, 5.0, 35, .30, 2.4, 182);
  lettering(batch, 'RACING CLUB', -198.38, 5.0, 38, .16, 0xffedc1, PI / 2);

  // Infield pit lane and the alternating garage doors.
  batch.box(0x8e9693, -143, 3.99, 45, 33, .05, 212, 0, -20);
  batch.box(0xe7e5cf, -127, 7.2, 44, 15, 6.4, 202);
  batch.box(0x425b6e, -127, 10.55, 44, 17, .40, 205);
  for (let z = -49, i = 0; z < 144; z += 16, i++) {
    batch.box(i % 3 === 0 ? 0xd65e54 : i % 3 === 1 ? 0x427f9c : 0xe6b948, -134.6, 6.3, z, .18, 3.9, 12);
    batch.box(0xabc8cb, -134.65, 9.3, z, .2, 1.0, 12);
    batch.box(0xf5e8ca, -140, 4.05, z, 7, .08, .20);
  }
  batch.box(0x2a5974, -126, 13.0, 45, 13, 4.5, 36);
  batch.box(0xc0d5cc, -126, 15.4, 45, 15, .4, 39);
  for (let z = 31; z <= 59; z += 7) batch.box(0x85b4c1, -132.6, 13.5, z, .1, 1.8, 5.7);
  lettering(batch, 'APEX 94', -134.8, 11.2, -18, .19, 0xffd650, -PI / 2);
  // Far-side grandstand and oversized striped event canopy.
  batch.box(0xcfccae, 214, 5.7, -55, 20, 5, 137);
  for (let r = 0; r < 5; r++) batch.box(r % 2 ? 0xdfb75c : 0xde7757, 200 + r * 3, 5.5 + r, -55, 3, .5, 134);
  batch.box(0xf3dd99, 214, 11.8, -55, 25, .6, 144);
}

function addPalm(batch, x, z, height, phase) {
  const cone = new THREE.CylinderGeometry(.21, .53, height, 5);
  batch.geometry(cone, 0x9b7653, new THREE.Matrix4().makeTranslation(x, 3.4 + height / 2, z)); cone.dispose();
  const top = [x, 3.4 + height, z];
  for (let n = 0; n < 6; n++) {
    const a = phase + n * PI / 3, dx = Math.sin(a), dz = Math.cos(a), sx = Math.cos(a), sz = -Math.sin(a);
    const mid = [x+dx*2.5,top[1]+.8,z+dz*2.5], tip = [x+dx*5.1,top[1]-1.0,z+dz*5.1];
    const left = [mid[0]+sx*.95,mid[1],mid[2]+sz*.95], right = [mid[0]-sx*.95,mid[1],mid[2]-sz*.95];
    batch.quad(n % 2 ? 0x3e855c : 0x5aa462, top, left, tip, right, 0, false, THREE.DoubleSide);
  }
}

function addScenery(batch) {
  batch.box(0x288fb6, 0, -.05, 0, 6500, .1, 6500, 0, -40);
  batch.box(0xd4c794, 0, 1.55, 0, 690, 3.0, 1035, 0, -30);
  batch.box(0x83a85e, 0, 3.25, 0, 637, .4, 992, 0, -30);
  batch.box(0x75a25c, 0, 3.50, 0, 291, .15, 612, 0, -30);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * 2 * PI, x = Math.cos(a) * (850 + (i % 3) * 150), z = Math.sin(a) * (1000 + (i % 4) * 140);
    const h = 140 + (i * 37) % 160;
    const mountain = new THREE.ConeGeometry(190 + (i % 4) * 26, h, 5, 1);
    batch.geometry(mountain, [0x8eb8b9,0x78a7ae,0xadc7c0][i%3], new THREE.Matrix4().compose(V(x, h/2-15,z),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),i),V(1,1,1)), -25);
    mountain.dispose();
  }
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * 2 * PI;
    const x = Math.cos(a) * (256 + (i % 3) * 8), z = Math.sin(a) * (443 + (i % 4) * 7);
    if (x < -190 && z > -75 && z < 145) continue;
    addPalm(batch, x, z, 9 + i % 5, i * 2.15);
  }
  for (let i = 0; i < 7; i++) addPalm(batch, -105 + i * 32, 100, 9 + i % 3, i);
  // Event flags and floodlights frame the home straight.
  for (let z = -150, i = 0; z <= 150; z += 50, i++) {
    batch.box(0xe9ddbe, -244, 14, z, .30, 22, .30);
    batch.quad(i % 2 ? 0xf6c944 : 0xe75d50, [-243.8,24,z],[-243.8,19,z],[-237.3,20,z],[-237.3,24,z],0,false,THREE.DoubleSide);
  }
  for (const x of [-248, 246]) for (const z of [-200, 10, 215]) {
    batch.box(0x71898e,x,17,z,.60,28,.60);
    batch.box(0x4b6470,x,31,z,11,1.4,1.0);
    for (let j=-4;j<=4;j+=2) batch.box(0xffffdb,x+j,30.8,z+0.55,1.3,.85,.10);
  }
  const boards = [{d:165,text:'APEX 94',c:0x285d7a},{d:510,text:'COASTLINE',c:0xc65a48},{d:1000,text:'RACING CLUB',c:0x306b78},{d:1570,text:'FULL THROTTLE',c:0x23445c}];
  for (const info of boards) {
    const s = TRACK.sample(info.d), p = roadPoint(s,-24,5.3);
    batch.box(info.c,...p,24,4.0,.5,s.yaw);
    const front=V(0,0,-.28).applyAxisAngle(V(0,1,0),s.yaw);
    lettering(batch,info.text,p[0]+front.x,p[1],p[2]+front.z,.21,0xffedbd,s.yaw);
    for(const side of [-1,1]){
      const leg = V(side*9, -3, 0).applyAxisAngle(V(0,1,0),s.yaw).add(V(...p));
      batch.box(0x546971,leg.x,leg.y,leg.z,.30,6,.30);
    }
  }
  // Clearly readable right-turn chevrons along each banked corner.
  for (const d of [310, 405, 500, 595, 690, 1310, 1405, 1500, 1595, 1690]) {
    const s=TRACK.sample(d), p=roadPoint(s,-19.1,2.3), q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),s.yaw);
    batch.box(0x174766,...p,4.4,2.3,.30,s.yaw);
    const t=(x,y)=>V(x,y,-.18).applyQuaternion(q).add(V(...p)).toArray();
    batch.quad(0xffe460,t(-.8,.8),t(.1,.8),t(1.1,0),t(.2,0),0,true,THREE.DoubleSide);
    batch.quad(0xffe460,t(.2,0),t(1.1,0),t(.1,-.8),t(-.8,-.8),0,true,THREE.DoubleSide);
  }
}

export function createWorld() {
  const scene = new THREE.Scene();
  scene.name = 'coastline-speedway'; scene.background = new THREE.Color(0x87cbe4);
  scene.fog = new THREE.Fog(0x99cbd8, 520, 1850);
  scene.add(new THREE.HemisphereLight(0xeaf9ff, 0x4b634e, 2.0));
  const sun = new THREE.DirectionalLight(0xffedc5, 2.0); sun.position.set(-350, 600, -100); scene.add(sun);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 12, 8),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{top:{value:new THREE.Color(0x4097ce)},bottom:{value:new THREE.Color(0xb9e2e5)}},
    vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 vDirection;uniform vec3 top;uniform vec3 bottom;void main(){float h=clamp(normalize(vDirection).y*1.8,0.,1.);gl_FragColor=vec4(mix(bottom,top,h),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
  }));
  sky.name='arcade-sky';sky.renderOrder=-100;scene.add(sky);
  const batch=batches();
  addScenery(batch);addCircuit(batch);addStands(batch);
  addGantry(batch,0,'COASTLINE 94');
  addGantry(batch,TRACK.length/3,'CHECKPOINT',0x267582);
  addGantry(batch,TRACK.length*2/3,'CHECKPOINT',0x267582);
  batch.finish(scene,'speedway');
  const cars=COLORS.map((color,i)=>makeCar(color,[27,8,42,11,65,3,90,18][i]));
  cars.forEach(car=>scene.add(car));
  const player=cars[0],opponents=cars.slice(1);
  const cameraPosition=V(-180,9,-13), cameraTarget=V(-180,4,15);
  const desiredPosition=V(0,0,0),desiredTarget=V(0,0,0);
  let initialized=false,wheelAngle=0,oldPhase='',lastView=null;

  function place(car,vehicle) {
    const s=TRACK.sample(vehicle.distance),lateral=vehicle.lateral||0;
    car.position.set(s.x+s.nx*lateral,s.y-lateral*Math.tan(s.bank||0)+.045,s.z+s.nz*lateral);
    car.rotation.set(0,s.yaw+(vehicle.heading||0),-(s.bank||0),'YXZ');
    const shell=car.userData.shell;
    shell.rotation.z=(vehicle.drifting ? -.035 : 0)*(Math.sign(vehicle.heading)||1);
    for(const wheel of car.userData.wheels) wheel.rotation.x=wheelAngle*(vehicle.speed>0?1:0);
  }
  function update(race,dt=1/60) {
    wheelAngle-=(race.player.speed||0)*dt/.44;
    place(player,race.player);
    for(let i=0;i<opponents.length;i++){
      const vehicle=race.opponents[i];opponents[i].visible=!!vehicle;
      if(vehicle) place(opponents[i],vehicle);
    }
    if(race.phase!==oldPhase){if(race.phase==='ready'||race.phase==='countdown')initialized=false;oldPhase=race.phase;}
    scene.updateMatrixWorld(true);
  }
  function cameraPose(race,view='chase',dt=1/60) {
    const p=race.player,s=TRACK.sample(p.distance),speed=p.speed||0;
    const hood=view==='hood'||view===1,wide=view==='wide'||view===2;
    if(view!==lastView){initialized=false;lastView=view;}
    const behind=hood ? -.65 : wide ? 18.5 : 11.3;
    const high=hood ? 1.35 : wide ? 7.9 : 4.5;
    const curveLean=clamp((s.curvature||0)*speed*1.5,0,.65);
    desiredPosition.set(player.position.x-s.tx*behind+s.nx*curveLean,player.position.y+high,player.position.z-s.tz*behind+s.nz*curveLean);
    const look=TRACK.sample(p.distance+(hood?36:21));
    desiredTarget.set(look.x+look.nx*(p.lateral||0)*.7,look.y+(hood?1.1:.75),look.z+look.nz*(p.lateral||0)*.7);
    const smooth=initialized ? 1-Math.exp(-Math.max(.001,dt)*(hood?18:8)) : 1;
    cameraPosition.lerp(desiredPosition,smooth);cameraTarget.lerp(desiredTarget,smooth);initialized=true;
    player.visible=!hood;
    return {position:cameraPosition,target:cameraTarget,fov:(hood?76:wide?60:64)+clamp(speed/85,0,1)*6};
  }
  function dispose(){
    const geometries=new Set(),materials=new Set();
    scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  return {scene,player,opponents,cars,update,cameraPose,dispose,track:TRACK};
}
