'use strict';
const VisualStyle=(()=>{
  const sizes=[[240,160],[360,240],[480,320],[600,400],[720,480]];
  const groups={pixel:'픽셀','2d':'2D','25d':'2.5D',native:'3D','cradle-3d':'클린 픽셀 3D','yeoul-3d':'흑연명암 3D',diorama:'디오라마',gaussian:'가우시안'};
  const variants={'2d':{'cradle-2d':'클린 도트','yeoul-2d':'단색 도트'},'25d':{'cradle-25d':'HD-2D 라이트','yeoul-25d':'디더링'}};
  const names={};
  for(const [group,label] of Object.entries(groups)){
    if(variants[group])for(const [id,name] of Object.entries(variants[group]))names[id]=label+' · '+name;
    else names[group]=label;
  }
  let mode='native', raster=240, target=null, display=null;
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),scene=new THREE.Scene();
  const focus=new THREE.Vector3(),diagonal=new THREE.Vector3(14,12,-17),flat=new THREE.Vector3(0,27,40);
  const fixedView=()=>mode.endsWith('-2d')?flat:mode==='diorama'||mode.endsWith('-25d')?diagonal:null;
  const usesRaster=()=>mode==='pixel'||mode.startsWith('yeoul-')||mode.startsWith('cradle-');
  function select(id,res){
    id=({'2d':'cradle-2d','2.5d':'cradle-25d','25d':'cradle-25d','3d':'native'})[id]||id;
    if(Object.hasOwn(names,id))mode=id;
    if(sizes.some(([w])=>w===Number(res)))raster=Number(res);
  }
  let yaw=0, pitch=0,zoom=1,pointer=null,px=0,py=0;
  const orbitOffset=new THREE.Vector3(),canvas=document.getElementById('c');
  function subject(){
    if(ActorWalk.thirdPerson)return ActorWalk.position;
    if(Modes.cur==='drive'&&(Drive.on||DriveRace.phase==='grid')&&!Drive.cockpit)return Drive.car.p;
    if(Modes.cur==='boat')return Marine.position;
    return null;
  }
  function resetPointer(){const id=pointer;pointer=null;if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
  function rotateView(){return !!(G.camera&&fixedView()&&subject());}
  canvas.addEventListener('pointerdown',e=>{
    if(!rotateView()||pointer!==null||e.button!==0)return;
    pointer=e.pointerId;px=e.clientX;py=e.clientY;canvas.setPointerCapture(pointer);
    e.stopImmediatePropagation();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(pointer!==e.pointerId)return;
    if(!rotateView()){resetPointer();return;}
    yaw-=.006*(e.clientX-px);pitch=clamp(pitch+.004*(e.clientY-py),-.6,.70);
    px=e.clientX;py=e.clientY;e.stopImmediatePropagation();
  },true);
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>{if(e.pointerId===pointer)resetPointer();},true);
  addEventListener('blur',resetPointer);
  canvas.addEventListener('wheel',e=>{
    if(!G.camera||!fixedView()||e.ctrlKey||e.metaKey)return;
    if(Modes.cur==='sample'&&!SampleBrowser.walking)return; // The model viewer owns its own wheel.
    e.preventDefault();
    const unit=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;
    zoom=clamp(zoom*Math.exp(-clamp(e.deltaY*unit,-800,800)*.00155),.55,3.5);
  },{passive:false});
  function frame(camera){
    if(Modes.cur==='drive'&&DriveRace.phase==='opening')return;
    const offset=fixedView();if(!offset)return;
    const point=subject();
    if(!point){
      if(!(Modes.cur==='sample'&&!SampleBrowser.walking))
        camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/zoom));
      return;
    }
    focus.copy(point);
    const distance=offset.length(),a=Math.atan2(offset.x,offset.z)+yaw;
    const elevation=clamp(Math.asin(offset.y/distance)+pitch,.14,1.32);
    orbitOffset.set(Math.sin(a)*Math.cos(elevation),Math.sin(elevation),Math.cos(a)*Math.cos(elevation)).multiplyScalar(distance);
    camera.position.copy(focus).add(orbitOffset);
    camera.position.y=Math.max(camera.position.y,Island.support(camera.position.x,camera.position.z)+.6);
    camera.lookAt(focus.x,focus.y+.65,focus.z);
    const baseFov=(ActorWalk.thirdPerson?18:27)*(offset===flat?.50:1);
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov*.5))/zoom));
  }
  function makeFilter(mirror=false){
    return new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{image:{value:null},depthMap:{value:null},clip:{value:new THREE.Vector2()},texel:{value:new THREE.Vector2()},phase:{value:mirror?new THREE.Vector2():PixelFit.phase},style:{value:0},snap:{value:false}},
        vertexShader:'varying vec2 sampleUV;void main(){sampleUV=vec2('+(mirror?'1.-uv.x':'uv.x')+',uv.y);gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`varying vec2 sampleUV;uniform sampler2D image,depthMap;uniform vec2 texel,clip,phase;uniform int style;uniform bool snap;
        float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
        float meters(vec2 uv){float d=texture2D(depthMap,uv).r;return clip.x*clip.y/max(.0001,clip.y-d*(clip.y-clip.x));}
        float bayer2(vec2 p){p=mod(p,2.);return 2.*p.x+3.*p.y-4.*p.x*p.y;}
        float dither(vec2 cell){return (4.*bayer2(cell)+bayer2(floor(cell*.5))+.5)/16.-.5;}
        void main(){vec2 tc=snap?(floor(sampleUV/texel)+.5)*texel:sampleUV;vec3 c=texture2D(image,tc).rgb;
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
            cell+=phase;
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
  }
  function configureFilter(material,image,depth,near,far,w,h,snap=false){
    const u=material.uniforms;
    u.image.value=image;u.depthMap.value=depth;u.clip.value.set(near,far);
    u.texel.value.set(1/w,1/h);u.snap.value=snap;
    u.style.value=mode.startsWith('yeoul-')?4:mode==='cradle-2d'?5:mode==='cradle-25d'?6:mode==='cradle-3d'?7:['native','diorama','pixel','gaussian'].indexOf(mode);
  }
  function output(w,h,sceneDepth,near,far){
    if(mode==='native'&&!PixelFit.enabled)return null;
    if(!display){
      display=makeFilter();
      const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),display);quad.frustumCulled=false;scene.add(quad);
      target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    }
    const fit=PixelFit.enabled;
    const filter=fit?THREE.LinearFilter:THREE.NearestFilter;
    if(target.texture.minFilter!==filter){target.texture.minFilter=target.texture.magFilter=filter;target.texture.needsUpdate=true;}
    if(fit)target.setSize(w,h);
    else if(usesRaster()){const hPix=raster*2/3;target.setSize(w>=h?raster:hPix,w>=h?hPix:raster);}
    else target.setSize(w,h);
    configureFilter(display,target.texture,sceneDepth,near,far,fit?PixelFit.width:target.width,fit?PixelFit.height:target.height);
    return target;
  }
  function present(renderer){if(PixelFit.enabled)PixelFit.present(renderer,scene.children[0],scene,camera);
    else{renderer.setRenderTarget(null);renderer.render(scene,camera);}}
  select(Q.get('style'),Q.get('raster'));
  PixelFit.select(Q.get('pixelFit'));
  function walkYaw(){const offset=fixedView();return offset&&ActorWalk.thirdPerson?Math.atan2(offset.x,offset.z)+yaw:null;}
  function renderCamera(camera){return PixelFit.snapped(camera,subject(),mode+'/'+Modes.cur);}
  return {groups,variants,names,sizes,select,frame,output,present,renderCamera,usesRaster,walkYaw,makeFilter,configureFilter,get current(){return mode;},get raster(){return raster;}};
})();
