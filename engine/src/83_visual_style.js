'use strict';
const VisualStyle=(()=>{
  const sizes=[[240,160],[360,240],[480,320],[600,400],[720,480]];
  const names={native:'3D',diorama:'2.5D 디오라마',pixel:'픽셀',gaussian:'가우시안 소프트',
    'yeoul-2d':'여울 2D · 단색 도트','yeoul-25d':'여울 2.5D · 디더 디오라마','yeoul-3d':'여울 3D · 흑연 명암',
    'cradle-2d':'AI요람 2D · 클린 도트','cradle-25d':'AI요람 2.5D · HD-2D 라이트','cradle-3d':'AI요람 3D · 픽셀 라이팅'};
  let mode='native', raster=240, target=null, display=null;
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),scene=new THREE.Scene();
  const focus=new THREE.Vector3(),diagonal=new THREE.Vector3(14,12,-17),flat=new THREE.Vector3(0,27,40);
  const fixedView=()=>mode.endsWith('-2d')?flat:mode==='diorama'||mode.endsWith('-25d')?diagonal:null;
  const usesRaster=()=>mode==='pixel'||mode.startsWith('yeoul-')||mode.startsWith('cradle-');
  function select(id,res){
    if(Object.hasOwn(names,id))mode=id;
    if(sizes.some(([w])=>w===Number(res)))raster=Number(res);
  }
  function frame(camera){
    const offset=fixedView();if(!offset)return;
    const modeId=Modes.cur;
    if(modeId==='actors')focus.copy(ActorWalk.position);
    else if(modeId==='drive'&&Drive.on)focus.copy(Drive.car.p);
    else if(modeId==='boat')focus.fromArray(Marine.state.position);
    else return; // Cockpit, periscope and FPS retain their actual aiming axis.
    camera.position.copy(focus).add(offset);
    camera.position.y=Math.max(camera.position.y,Island.support(camera.position.x,camera.position.z)+.6);
    camera.lookAt(focus.x,focus.y+.65,focus.z);
    camera.fov=(modeId==='actors'?18:27)*(offset===flat?.50:1);
  }
  function output(w,h,sceneDepth,near,far){
    if(mode==='native')return null;
    if(!display){
      display=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{image:{value:null},depthMap:{value:null},clip:{value:new THREE.Vector2()},texel:{value:new THREE.Vector2()},style:{value:0}},
        vertexShader:'varying vec2 tc;void main(){tc=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`varying vec2 tc;uniform sampler2D image,depthMap;uniform vec2 texel,clip;uniform int style;
        float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
        float meters(vec2 uv){float d=texture2D(depthMap,uv).r;return clip.x*clip.y/max(.0001,clip.y-d*(clip.y-clip.x));}
        float bayer2(vec2 p){p=mod(p,2.);return 2.*p.x+3.*p.y-4.*p.x*p.y;}
        float dither(vec2 cell){return (4.*bayer2(cell)+bayer2(floor(cell*.5))+.5)/16.-.5;}
        void main(){vec3 c=texture2D(image,tc).rgb;
          if(style==1){
            vec3 right=texture2D(image,tc+vec2(texel.x,0.)*1.5).rgb;
            vec3 up=texture2D(image,tc+vec2(0.,texel.y)*1.5).rgb;
            float y=luma(c),edge=smoothstep(.045,.17,abs(y-luma(right))+abs(y-luma(up)));
            c*=mix(1.,(floor(8.*y+.5)/8.+.075)/(y+.075),.61);
            c=mix(c,vec3(.10,.15,.16),edge*.61);
          }else if(style==2){c=floor(c*31.+.5)/31.;}
          else if(style==3){
            vec2 t=texel*3.0;vec3 soft=c*.25;
            soft+=(texture2D(image,tc+vec2(t.x,0.)).rgb+texture2D(image,tc-vec2(t.x,0.)).rgb+
                   texture2D(image,tc+vec2(0.,t.y)).rgb+texture2D(image,tc-vec2(0.,t.y)).rgb)*.125;
            soft+=(texture2D(image,tc+t).rgb+texture2D(image,tc-t).rgb+
                   texture2D(image,tc+vec2(t.x,-t.y)).rgb+texture2D(image,tc+vec2(-t.x,t.y)).rgb)*.0625;
            c=mix(c,soft,.88)+.09*max(soft-vec3(.55),vec3(0.));
          }else if(style>=4){
            vec2 cell=floor(tc/texel),uv=(cell+.5)*texel;
            float d=meters(uv),slope=meters(uv+texel*vec2(-1.,1.))-d;
            float edge=smoothstep(.025,.16,max(abs(slope),abs(meters(uv+texel*vec2(1.,0.))-d))/max(d,1.));
            float y=luma(c),grain=fract(sin(dot(mod(cell,337.),vec2(17.13,73.91)))*4327.2)-.5;
            if(style==4){
              float tone=smoothstep(.028,.94,y)-edge*.15;
              float dots=dither(cell)*.83+grain*.55;
              float band=clamp(floor(tone*6.+.5+dots)/6.,0.,1.);
              c=mix(vec3(.096,.090,.093),vec3(.955,.948,.920),band);
            }else if(style==5){
              c=floor(clamp((c-.5)*1.09+.5,0.,1.)*24.+.5)/24.;
              c*=1.-edge*.20;
            }else if(style==6){
              float farBlur=smoothstep(5.,30.,d-meters(vec2(.5)));
              vec3 soft=(texture2D(image,uv+texel*2.).rgb+texture2D(image,uv-texel*2.).rgb+
                         texture2D(image,uv+texel*vec2(2.,-2.)).rgb+texture2D(image,uv+texel*vec2(-2.,2.)).rgb)*.25;
              c=mix(c,soft,farBlur*.48)+max(soft-.55,0.)*.20;
              c+=vec3(.13,.083,.038)*edge*step(0.,slope);c=mix(vec3(luma(c)),c,1.09);
              c*=vec3(1.033,1.003,.967)*(1.-.22*dot(tc-.5,tc-.5));
            }else{
              float band=floor(y*12.+.5+dither(cell)*.44)/12.;
              c*=(max(.035,band)+.12)/(y+.12);
              c=mix(c,c*vec3(.89,.97,1.08),1.-smoothstep(.05,.57,y));
              c+=vec3(.17,.105,.048)*edge*step(0.,slope);
            }
          }gl_FragColor=vec4(clamp(c,0.,1.),1.);}`});
      const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),display);quad.frustumCulled=false;scene.add(quad);
      target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    }
    if(usesRaster()){const hPix=raster*2/3;target.setSize(w>=h?raster:hPix,w>=h?hPix:raster);}
    else target.setSize(w,h);
    display.uniforms.image.value=target.texture;display.uniforms.texel.value.set(1/target.width,1/target.height);
    display.uniforms.depthMap.value=sceneDepth;display.uniforms.clip.value.set(near,far);
    display.uniforms.style.value=mode.startsWith('yeoul-')?4:mode==='cradle-2d'?5:mode==='cradle-25d'?6:mode==='cradle-3d'?7:['native','diorama','pixel','gaussian'].indexOf(mode);
    return target;
  }
  function present(renderer){renderer.setRenderTarget(null);renderer.render(scene,camera);}
  select(Q.get('style'),Q.get('raster'));
  function walkYaw(){const offset=fixedView();return offset&&Modes.cur==='actors'?Math.atan2(offset.x,offset.z):null;}
  return {names,sizes,select,frame,output,present,usesRaster,walkYaw,get current(){return mode;},get raster(){return raster;}};
})();
