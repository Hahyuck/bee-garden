'use strict';
// The same metric projection covers the ground, the road shoulder and detached pieces of bedrock.
const Geology = (() => {
  const uniforms = { uGeoColor: { value: null }, uGeoDetail: { value: null }, uGeoWeight: { value: 0 } };
  async function load() {
    const maps = window.GEOLOGY_MAPS;
    if (!maps) return;
    const loader = new THREE.TextureLoader();
    try {
      const [color, detail] = await Promise.all([loader.loadAsync(maps.albedo), loader.loadAsync(maps.detail)]);
      color.colorSpace = THREE.SRGBColorSpace;
      detail.colorSpace = THREE.NoColorSpace;
      const aniso = Math.min(G.R.capabilities.getMaxAnisotropy(), LOW ? 2 : 4);
      color.anisotropy = detail.anisotropy = aniso;
      uniforms.uGeoColor.value = color;
      uniforms.uGeoDetail.value = detail;
      uniforms.uGeoWeight.value = 1;
    } catch (error) {
      console.warn('Could not decode the geology maps. Using the terrain palette.', error);
    }
  }
  const shader = /* glsl */`
uniform sampler2D uGeoColor, uGeoDetail;
uniform float uGeoWeight;
const vec2 geoCliff=vec2(0.,1.), geoGravel=vec2(1.,1.), geoEarth=vec2(0.), geoBedrock=vec2(1.,0.);
struct GeoLayer { vec3 color; vec3 relief; float rough; float height; };
vec3 geoRelief;
GeoLayer geoMix(GeoLayer a, GeoLayer b, float t){
  return GeoLayer(mix(a.color,b.color,t), mix(a.relief,b.relief,t), mix(a.rough,b.rough,t),mix(a.height,b.height,t));
}
// Each 512px quadrant holds 480px of repeating material surrounded by its own wrapped 16px border.
// Derivatives come from continuous UVs, so crossing a repeat never selects the wrong mip.
GeoLayer geoRead(vec2 cell, vec3 p, vec3 ax, vec3 ay, float scale, vec3 dx, vec3 dy){
  vec2 uv=vec2(dot(p,ax),dot(p,ay))*scale;
  vec2 gx=vec2(dot(dx,ax),dot(dx,ay))*scale, gy=vec2(dot(dy,ax),dot(dy,ay))*scale;
  float span=max(length(gx),length(gy));
  vec3 base=cell.y>.5 ? (cell.x>.5?vec3(.16,.13,.091):vec3(.245,.183,.121))
                      : (cell.x>.5?vec3(.225,.235,.23):vec3(.102,.061,.039));
  GeoLayer distant=GeoLayer(base,vec3(0.),.86,.5);
  if(span>.11 || uGeoWeight<.01) return distant;
  vec2 addr=.5*cell+(16.+480.*fract(uv))/1024.;
  vec3 color=textureGrad(uGeoColor,addr,gx*.46875,gy*.46875).rgb;
  vec4 packedMap=textureGrad(uGeoDetail,addr,gx*.46875,gy*.46875);
  vec2 xy=packedMap.rg*2.-1.;
  float nz=sqrt(max(.12,1.-dot(xy,xy)));
  GeoLayer scanned=GeoLayer(color,(ax*xy.x+ay*xy.y)/nz,packedMap.b,packedMap.a);
  return geoMix(scanned,distant,smoothstep(.027,.11,span));
}
GeoLayer geoFlat(vec2 cell, vec3 wp, float scale, vec3 dx, vec3 dy){
  return geoRead(cell,wp,vec3(1.,0.,0.),vec3(0.,0.,-1.),scale,dx,dy);
}
vec3 fractureCoords(vec3 p){
  vec3 bedding=vec3(.15*p.y,.09*p.x-.13*p.z,.05*p.x);
  vec3 warp=sin(p.zxy*vec3(.33,.21,.29)+p.yzx*vec3(.19,.17,.23));
  return p+bedding+.95*warp+.49*sin(.19*p.zxy-.28*p.xyz);
}
GeoLayer geoStone(vec3 wp, vec3 n, vec3 dx, vec3 dy, float scale, float variant){
  // Broad fractures and tilted mineral bands are in metres. Detached fragments retain the same strata.
  vec3 p=fractureCoords(wp), wx=fractureCoords(wp+dx)-p, wy=fractureCoords(wp+dy)-p;
  vec3 w=pow(abs(n),vec3(5.)); w/=max(w.x+w.y+w.z,.0001);
  vec2 tile=variant>.5?geoCliff:geoBedrock;
  GeoLayer outcrop=GeoLayer(vec3(0.),vec3(0.),0.,0.);
  for(int axis=0;axis<3;axis++){
    float wt=axis==0?w.x:(axis==1?w.y:w.z);
    if(wt<.012) continue;
    vec3 ax=axis==0?vec3(0.,0.,-sign(n.x)):(axis==1?vec3(1.,0.,0.):vec3(sign(n.z),0.,0.));
    vec3 ay=axis==1?vec3(0.,0.,-sign(n.y)):vec3(0.,1.,0.);
    GeoLayer a=geoRead(tile,p,ax,ay,scale,wx,wy);
    outcrop.color+=a.color*wt; outcrop.relief+=a.relief*wt;
    outcrop.rough+=a.rough*wt; outcrop.height+=a.height*wt;
  }
  vec2 section=vec2(.74*wp.x+.48*wp.z,wp.y-.15*wp.x+.10*wp.z);
  float macro=vnoise(section*.14+.20*sin(wp.zx*.13)), bedding=section.y*.32+.41*macro+.07*sin(wp.x*.18);
  float seam=abs(fract(bedding)-.5)*2.;
  float strata=(1.-smoothstep(.024,.14,seam))*(1.-smoothstep(.08,.50,max(length(wx),length(wy))))*(1.-abs(n.y));
  float mineral=smoothstep(.31,.71,macro+.16*vnoise(section*.48));
  float lum=dot(outcrop.color,vec3(.213,.715,.072));
  // Cool weathered granite in the exposure, iron staining where the seams have carried runoff.
  outcrop.color=mix(lum*vec3(.71,.82,.86),outcrop.color*.94,.12+.80*mineral);
  outcrop.color*=mix(.69,1.08,mineral)*(1.-strata*.29);
  outcrop.rough=mix(outcrop.rough,.61,strata*.37);
  return outcrop;
}
vec3 geoNormal(vec3 viewNormal){
  vec3 detail=mat3(viewMatrix)*geoRelief;
  return normalize(viewNormal+detail-viewNormal*dot(viewNormal,detail));
}`;
  function bind(s) { Object.assign(s.sh.uniforms, uniforms); }
  function boulderMaterial(){
    const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.86,metalness:0,envMapIntensity:.5});
    m.name='Fractured stone';
    return patch(m,s=>{
      bind(s);
      s.vHead('varying vec3 vStoneW, vStoneN; varying float vStoneKind, vStoneBase;');
      s.v('#include <begin_vertex>', `#include <begin_vertex>
        mat4 placement=modelMatrix;
        #ifdef USE_INSTANCING
          placement=placement*instanceMatrix;
        #endif
        vStoneW=(placement*vec4(position,1.)).xyz;
        vStoneN=transpose(inverse(mat3(placement)))*objectNormal;
        vStoneBase=position.y;
        vStoneKind=fract(sin(dot(placement[3].xz,vec2(.033,.078)))*51.341);`);
      s.fHead(GLSL_NOISE+GLSL_WX+shader+'\nvarying vec3 vStoneW,vStoneN; varying float vStoneKind, vStoneBase; float stoneRough;');
      s.f('#include <color_fragment>', `#include <color_fragment>
        vec3 faceN=normalize(vStoneN);
        GeoLayer rock=geoStone(vStoneW,faceN,dFdx(vStoneW),dFdy(vStoneW),.52,vStoneKind);
        float sc=wxCover(vStoneW,max(faceN.y,0.));
        float moisture=uWx.z*(1.-.45*smoothstep(.12,.60,rock.height));
        float deposit=(1.-smoothstep(-.12,.24,vStoneBase+.18*rock.height-.11*vnoise(vStoneW.xz*1.8)));
        rock.color=mix(rock.color,rock.color*vec3(.43,.53,.35),deposit*.49);
        // Instance colour is a subtle geological tint, in addition to the scan's actual albedo.
        diffuseColor.rgb=mix(rock.color*(.87+.15*diffuseColor.rgb)*(1.-.36*moisture),vec3(.85,.88,.93),sc);
        stoneRough=mix(mix(rock.rough,.30,moisture*.70),.77,sc);
        geoRelief=rock.relief*(1.-sc)*(.89-.24*moisture);`);
      s.f('#include <roughnessmap_fragment>','float roughnessFactor=clamp(stoneRough,.16,1.);');
      s.f('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=geoNormal(normal);');
    },'fractured-stone');
  }
  // A block bounded by tilted fracture planes, with smaller bevels around the sharp intersections.
  // A shared indexed prototype and the instance transform keep piles of talus cheap.
  function fragment(kind){
    const rand=rng(2977+317*kind), bounds=[], widths=[[1.06,.67,.72],[.79,.83,.79],[.99,.53,.62],[.79,.55,1.01]][kind];
    function cut(x,y,z,d){ const n=new THREE.Vector3(x,y,z).normalize(); bounds.push({n,d}); }
    cut(1,.22*(rand()-.5),.20*(rand()-.5),widths[0]); cut(-1,.17,.06,widths[0]*.89);
    cut(.17*(kind-1),1,-.25,widths[1]); cut(.07,-1,.12,widths[1]);
    cut(.12,.16,1,widths[2]); cut(-.09,-.06,-1,widths[2]*.94);
    for(let i=0;i<12;i++){
      const a=i*2.39996+kind, y=.28+.48*rand(), n=new THREE.Vector3(Math.cos(a),i%2?y:-y,Math.sin(a)).normalize();
      cut(n.x,n.y,n.z,.81+.15*rand());
    }
    const source=new THREE.IcosahedronGeometry(1,LOW?3:5), pos=source.attributes.position;
    const points=[],normals=[],indices=[],shared=new Map();
    const d=new THREE.Vector3(), normal=new THREE.Vector3(), vert=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      d.fromBufferAttribute(pos,i).normalize();
      const key=[d.x,d.y,d.z].map(c=>Math.round(c*1e5)).join(',');
      if(shared.has(key)){ indices.push(shared.get(key)); continue; }
      const index=points.length/3;
      shared.set(key,index); indices.push(index);
      let r=2;
      for(const plane of bounds){ const c=plane.n.dot(d); if(c>.02) r=Math.min(r,plane.d/c); }
      vert.copy(d).multiplyScalar(r); normal.set(0,0.,0.);
      for(const plane of bounds){
        const distance=plane.d-plane.n.dot(vert), weight=Math.max(0,1-distance/.13);
        normal.addScaledVector(plane.n,weight*weight);
      }
      const scar=NZ.n3(vert.x*3.4+kind*7,vert.y*3.1,vert.z*3.4);
      vert.multiplyScalar(1+.071*scar);
      normal.normalize(); points.push(vert.x,vert.y,vert.z); normals.push(normal.x,normal.y,normal.z);
    }
    source.dispose();
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    g.setIndex(indices);
    return g;
  }
  return {load,shader,bind,boulderMaterial,fragment};
})();
