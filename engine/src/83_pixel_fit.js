'use strict';
// Only the render camera and targets use this grid. Gameplay keeps continuous world coordinates.
const PixelFit=(()=>{
  let choice='auto',gridWidth=240,gridHeight=160,scale=1;
  const effective=()=>choice==='auto'?(VisualStyle.current==='cradle-2d'?'fit':'off'):choice;
  const origin=new THREE.Vector2(),phase=new THREE.Vector2(),size=new THREE.Vector2();
  const renderCamera=new THREE.PerspectiveCamera(),anchor=new THREE.Vector3(),relative=new THREE.Vector3();
  const right=new THREE.Vector3(),up=new THREE.Vector3(),back=new THREE.Vector3();
  let anchorMode='', fitted=null, material=null;
  function select(value){
    if(value===true||value==='1')value='fit';
    if(value===false||value==='0')value='off';
    if(['auto','off','integer','fit'].includes(value))choice=value;
  }
  function layout(renderer,camera,resolution){
    const enabled=effective()!=='off',ratio=enabled?devicePixelRatio:Math.min(devicePixelRatio,LOW?1:1.5);
    if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);
    renderer.getDrawingBufferSize(size);
    camera.aspect=innerWidth/innerHeight;
    if(!enabled){anchorMode='';phase.set(0,0);return;}
    const land=size.x>=size.y,x=land?3:2,y=land?2:3;
    const unit=Math.max(1,Math.floor(Math.min(resolution/3,size.x/x,size.y/y)));
    gridWidth=x*unit;gridHeight=y*unit;
    scale=Math.min(size.x/gridWidth,size.y/gridHeight);
    if(effective()==='integer')scale=Math.max(1,Math.floor(scale));
    origin.set(Math.floor((size.x-gridWidth*scale)/2),Math.floor((size.y-gridHeight*scale)/2));
    camera.aspect=gridWidth/gridHeight;
  }
  function snapped(camera,focus,modeKey){
    if(effective()==='off'||!focus){anchorMode='';phase.set(0,0);return camera;}
    if(modeKey!==anchorMode){anchor.copy(focus);anchorMode=modeKey;}
    renderCamera.copy(camera,false);
    right.set(1,0,0).applyQuaternion(camera.quaternion);up.set(0,1,0).applyQuaternion(camera.quaternion);
    back.set(0,0,1).applyQuaternion(camera.quaternion);
    const depth=Math.max(.1,relative.subVectors(camera.position,focus).dot(back));
    const step=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/(gridHeight*camera.zoom);
    relative.subVectors(camera.position,anchor);
    const x=relative.dot(right)/step,y=relative.dot(up)/step,z=relative.dot(back)/step;
    const ix=Math.round(x),iy=Math.round(y);
    renderCamera.position.addScaledVector(right,(ix-x)*step).addScaledVector(up,(iy-y)*step)
      .addScaledVector(back,(Math.round(z)-z)*step);
    renderCamera.updateMatrixWorld(true);
    phase.set(ix,iy);
    return renderCamera;
  }
  function present(renderer,quad,scene,camera){
    if(!fitted){
      fitted=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
      material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{picture:{value:fitted.texture},
        origin:{value:origin},grid:{value:new THREE.Vector2()},scale:{value:1}},
        vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`uniform sampler2D picture;uniform vec2 origin,grid;uniform float scale;
        void main(){vec2 pos=(gl_FragCoord.xy-origin)/scale,cell=floor(pos);
          if(any(lessThan(cell,vec2(0.)))||any(greaterThanEqual(cell,grid))){gl_FragColor=vec4(.034,.044,.046,1.);return;}
          vec2 f=fract(pos);
          vec2 edge=min(f*scale-.5,0.)+max((f-1.)*scale+.5,0.);
          gl_FragColor=texture2D(picture,(cell+.5+edge)/grid);}`});
    }
    fitted.setSize(gridWidth,gridHeight);
    renderer.setRenderTarget(fitted);renderer.render(scene,camera);
    material.uniforms.grid.value.set(gridWidth,gridHeight);material.uniforms.scale.value=scale;
    const shading=quad.material;quad.material=material;
    renderer.setRenderTarget(null);renderer.render(scene,camera);quad.material=shading;
  }
  return {select,layout,snapped,present,phase,get choice(){return choice;},get enabled(){return effective()!=='off';},get scale(){return scale;},get width(){return gridWidth;},get height(){return gridHeight;}};
})();
