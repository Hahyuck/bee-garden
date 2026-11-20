'use strict';
// Local occlusion on the road follows the rendered tyres, including in the rear-view camera.
const CarGroundShade=(()=>{
  const tyres=Array.from({length:4},()=>new THREE.Vector3());
  const centre=new THREE.Vector3(),heading=new THREE.Vector2(0,1);
  let visible=false;
  const active={get value(){return visible&&G.look.contact;}};
  function bind(s,worldPosition){
    Object.assign(s.sh.uniforms,{uCarShadeOn:active,uCarCentre:{value:centre},uCarHeading:{value:heading},uCarTyres:{value:tyres}});
    s.fHead(`uniform bool uCarShadeOn; uniform vec3 uCarCentre,uCarTyres[4]; uniform vec2 uCarHeading;
      float carGroundLight(vec3 p){
        vec2 delta=p.xz-uCarCentre.xz;
        if(!uCarShadeOn || dot(delta,delta)>6.25)return 1.;
        vec2 side=vec2(uCarHeading.y,-uCarHeading.x);
        vec2 local=abs(vec2(dot(delta,side),dot(delta,uCarHeading)));
        float belly=(1.-smoothstep(.54,1.04,local.x))*(1.-smoothstep(1.27,2.03,local.y));
        belly*=1.-smoothstep(.65,1.18,abs(p.y-uCarCentre.y));
        float tyreShade=0.;
        for(int i=0;i<4;i++){
          vec2 offset=p.xz-uCarTyres[i].xz;
          vec2 uv=vec2(dot(offset,side)/.25,dot(offset,uCarHeading)/.38);
          float close=1.-smoothstep(.025,.29,abs(uCarTyres[i].y-p.y));
          tyreShade=max(tyreShade,close*(1.-smoothstep(.16,1.,dot(uv,uv))));
        }
        return (1.-.52*belly)*(1.-.73*tyreShade);
      }`);
    s.f('#include <aomap_fragment>',`#include <aomap_fragment>
      float groundLight=carGroundLight(${worldPosition});
      reflectedLight.indirectDiffuse*=groundLight;reflectedLight.indirectSpecular*=groundLight;`);
  }
  return {tyres,bind,setPose(position,forward){visible=true;centre.copy(position);heading.set(forward.x,forward.z).normalize();},hide(){visible=false;}};
})();
// Short-range ambient occlusion, evaluated in camera space before focus, bloom and film.
const GLSL_CONTACT = /* glsl */`
varying vec2 vUv;
uniform sampler2D tColor, tDepth;
uniform vec2 uClip, uInvFocal, uResolution;
uniform float uRadius, uStrength;

float viewDepth(float d) {
  return uClip.x * uClip.y / (uClip.y - d * (uClip.y - uClip.x));
}
vec3 viewPosition(vec2 uv, float z) {
  return vec3((2.0 * uv - 1.0) * uInvFocal * z, -z);
}
float horizon(vec2 uv, vec3 centre, vec3 normal, float radius) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  vec3 delta = viewPosition(uv, viewDepth(texture2D(tDepth, uv).r)) - centre;
  float d = length(delta);
  float cosine = dot(normal, delta) / max(d, 0.0001);
  return max(cosine - 0.075, 0.0) * (1.0 - smoothstep(radius * 0.35, radius, d));
}
void main(){
  vec4 color = texture2D(tColor, vUv);
  float z = viewDepth(texture2D(tDepth, vUv).r);
  vec3 centre = viewPosition(vUv, z);
  vec3 dx = dFdx(centre), dy = dFdy(centre);
  float radius = min(uRadius, max(0.018, z * 0.17));
  float pixels = radius * uResolution.y / (2.0 * z * uInvFocal.y);
  gl_FragColor = color;
  if (pixels < 1.2 || max(abs(dx.z), abs(dy.z)) > radius * 0.42) return;
  vec3 crossNormal = cross(dx, dy);
  vec3 n = crossNormal * inversesqrt(max(dot(crossNormal, crossNormal), 1e-24));
  if (dot(n, -centre) < 0.0) n = -n;
  vec2 span = min(pixels, 26.0) / uResolution;
  vec2 dir = vec2(0.966, 0.259);
  float coverage = 0.0;
  const int rays = ${LOW ? 4 : 6};
  const mat2 turn = ${LOW ? 'mat2(0.0, 1.0, -1.0, 0.0)' : 'mat2(0.5, 0.8660254, -0.8660254, 0.5)'};
  for (int i=0; i<rays; ++i) {
    vec2 stepUV = dir * span;
    float nearH = horizon(vUv + stepUV * 0.32, centre, n, radius);
    ${LOW ? 'coverage += nearH;' : 'coverage += max(nearH, horizon(vUv + stepUV * 0.76, centre, n, radius));'}
    dir = turn * dir;
  }
  float light = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float shade = min(0.55, uStrength * coverage / float(rays));
  // Sky and distant silhouettes exit above; keep concentrated highlights luminous.
  gl_FragColor.rgb *= 1.0 - shade * smoothstep(1.2, 3.0, pixels) / (1.0 + 0.4 * light);
}`;
