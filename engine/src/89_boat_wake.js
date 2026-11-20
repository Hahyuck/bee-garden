'use strict';
// World-space foam stays behind when the helm turns. Each stamp follows the sea's own wave field.
function makeBoatWake(world){
  const limit=LOW?170:260, geometry=new THREE.PlaneGeometry(1,1,3,3);
  const data=new THREE.InstancedBufferAttribute(new Float32Array(limit*4),4);
  geometry.setAttribute('foamData',data);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    uniforms:Sea.waveUniforms,vertexShader:Sea.waves+`
      attribute vec4 foamData;varying vec2 cell;varying vec4 info;
      void main(){cell=uv*2.-1.;info=foamData;
        vec4 p=instanceMatrix*vec4(position.x,0.,position.y,1.);
        p.y+=`+CFG.sea.level.toFixed(3)+`+seaWave(p.xz,1.,smoothstep(.05,3.,-seaBed(p.xz))).z;
        gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:GLSL_NOISE+`varying vec2 cell;varying vec4 info;uniform vec3 uSunK,uHor;uniform float uTime;
      void main(){float r=length(cell),n=vnoise(cell*4.7+info.y+uTime*.24);
        float fade=1.-smoothstep(.56,1.,r);
        float lace=smoothstep(.26,.73,n+.18*sin(18.*r-2.*uTime+info.y));
        if(info.z>.5&&info.z<1.5){vec2 q=cell+vec2(n-.5,vnoise(cell*3.6-info.y)-.5)*.48;
          float twist=atan(q.y,q.x)+13.*length(q)-info.w*4.+info.y;
          float strands=smoothstep(.36,.92,sin(twist)*.48+.51+n*.21);
          lace=(.18+.67*strands)*smoothstep(.16,.70,n+.20*vnoise(cell*13.+info.y));}
        float a=info.x*fade*lace;if(a<.018)discard;
        gl_FragColor=vec4(mix(vec3(.08,.33,.36),uHor*.66+uSunK*.18+.13,lace),a);}`});
  const mesh=new THREE.InstancedMesh(geometry,material,limit),stamp=new THREE.Object3D();
  mesh.name='boat-wake';mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=6;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(mesh);
  const pool=Array.from({length:limit},()=>({life:0})),rand=rng(76211);
  let slot=0,sideClock=0,washClock=0;
  function emit(p,h,x,z,kind,side,strength,speed){
    const a=pool[slot];slot=(slot+1)%limit;
    const sn=Math.sin(h),cs=Math.cos(h),spray=kind===2,reverse=Math.sign(speed);
    const lateral=side*(spray?2+rand()*2.8:kind===0?.9+strength:rand()*.4);
    const aft=kind===1?-reverse*(1.2+strength*2.2):spray?speed*.4:0;
    Object.assign(a,{x:p.x+cs*x+sn*z,z:p.z-sn*x+cs*z,vx:lateral*cs+sn*aft,vz:-lateral*sn+cs*aft,
      height:.085,vy:spray?.9+strength*2.4+rand():0,age:0,life:spray?.55+rand()*.22:kind===1?2.7:2.9,
      heading:h+(kind===0?-side*.28:0),strength,seed:rand()*93,kind});
  }
  function reset(){for(const a of pool)a.life=0;mesh.count=slot=sideClock=washClock=0;}
  function step(p,h,speed,dt){
    const bow=sm(2.7,9.5,speed),thrust=sm(.28,9,Math.abs(speed));
    sideClock+=bow*dt*13;washClock+=thrust*dt*19;
    while(sideClock>=1){sideClock--;for(const s of [-1,1]){
      emit(p,h,s*.94,2.85,0,s,bow,speed);
      for(let k=0;k<2;k++)emit(p,h,s*(.85+rand()*.36),2.6+rand()*.6,2,s,bow,speed);
    }}
    while(washClock>=1){washClock--;emit(p,h,(rand()-.5)*.52,-4.15,1,rand()-.5,thrust,speed);}
    let count=0;
    for(const a of pool){
      if(!a.life)continue;a.age+=dt;if(a.age>=a.life){a.life=0;continue;}
      const t=a.age/a.life,spray=a.kind===2,eddy=a.kind===1;
      a.x+=a.vx*dt;a.z+=a.vz*dt;
      if(spray){a.vy-=9.81*dt;a.height+=a.vy*dt;if(a.height<.04){a.life=0;continue;}}
      stamp.position.set(a.x,a.height,a.z);stamp.rotation.y=a.heading;
      const size=spray?.07+.18*Math.sin(t*Math.PI):eddy?.78+2.8*t:.48+1.85*t;
      stamp.scale.set(size,1,spray?size:eddy?size*2.25:1.85+t*1.65);stamp.updateMatrix();
      mesh.setMatrixAt(count,stamp.matrix);data.setXYZW(count,a.strength*(1-t)*(spray?.95:.85),a.seed,a.kind,a.age);count++;
    }
    mesh.count=count;if(count){data.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;}
  }
  return {reset,step};
}
