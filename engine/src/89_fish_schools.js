'use strict';
function makeFishSchools(reef,floor,harbor){
  // One draw call for the populated water cells around the submarine.
  const pos=[],colors=[],c=new THREE.Color();
  function tri(a,b,d,color){c.setHex(color);for(const p of [a,b,d]){pos.push(...p);colors.push(c.r,c.g,c.b);}}
  const rings=[[-.63,.055,.08],[-.34,.14,.22],[.11,.19,.27],[.40,.13,.19],[.56,.025,.047]];
  const pt=([z,w,h],i)=>[Math.sin(i*TAU/10)*w,Math.cos(i*TAU/10)*h,z];
  for(let j=1;j<rings.length;j++)for(let i=0;i<10;i++){
    const a=pt(rings[j-1],i),b=pt(rings[j-1],i+1),d=pt(rings[j],i),e=pt(rings[j],i+1);
    const col=a[1]>.05?0x57908a:a[1]<-.06?0xe6e5ca:0xb9cec5;
    tri(a,b,d,col);tri(d,b,e,col);
  }
  tri([0,-.06,-.60],[0,.27,-.95],[0,.04,-.81],0xd9ae63);
  tri([0,-.06,-.60],[0,.04,-.81],[0,-.25,-.92],0xd9ae63);
  tri([0,.13,-.32],[0,.42,-.24],[0,.20,.14],0x749d8e);
  for(const s of [-1,1]){
    tri([s*.16,0,.11],[s*.42,-.13,-.14],[s*.14,-.075,-.03],0xc7aa62);
    tri([s*.148,.105,.32],[s*.144,.045,.37],[s*.171,.06,.265],0x172b30);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.43,metalness:.16});
  material.onBeforeCompile=s=>{s.uniforms.fishTime=G.uTime;
    s.vertexShader='uniform float fishTime;\n'+s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed.x+=sin(fishTime*6.8+instanceMatrix[3].x*.43+position.z*5.)*smoothstep(.12,.93,-position.z)*.18;');};
  const ring=2,span=32,max=25*8,mesh=new THREE.InstancedMesh(geometry,material,max),stamp=new THREE.Object3D();
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.name='reef-fish';mesh.count=0;reef.add(mesh);
  const seed=Math.floor(Math.random()*4294967296),tints=[0xf9f4d8,0x8acbc4,0xfbb68b,0xc0b1da];
  let lastX=Infinity,lastZ=Infinity,schools=[];
  function populate(cx,cz){
    schools=[];lastX=cx;lastZ=cz;
    for(let z=cz-ring;z<=cz+ring;z++)for(let x=cx-ring;x<=cx+ring;x++){
      const r=rng(seed^Math.imul(x,73856093)^Math.imul(z,19349663));
      const sx=harbor.x+(x+(r()-.5)*.65)*span,sz=harbor.z+(z+(r()-.5)*.65)*span;
      const lower=floor(sx,sz)+1.5,upper=CFG.sea.level-1.4;if(lower>=upper)continue;
      const school={x:sx,z:sz,y:lerp(lower,upper,r()),phase:r()*TAU,rate:.10+r()*.16,radius:2.8+r()*4,
        tint:tints[Math.floor(r()*tints.length)],fish:[]};
      const n=r()<.21?1:2+Math.floor(r()*7);
      for(let i=0;i<n;i++)school.fish.push({x:(r()-.5)*5,z:(r()-.5)*6,y:(r()-.5)*1.5,size:.56+r()*.72,phase:r()*TAU});
      schools.push(school);
    }
    let i=0;for(const school of schools)for(const f of school.fish)mesh.setColorAt(i++,c.setHex(school.tint));
    mesh.count=i;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }
  function step(p,t){
    const cx=Math.round((p.x-harbor.x)/span),cz=Math.round((p.z-harbor.z)/span);
    if(cx!==lastX||cz!==lastZ)populate(cx,cz);
    let index=0;
    for(const s of schools){
      const a=t*s.rate+s.phase,x=s.x+s.radius*Math.sin(a),z=s.z+s.radius*Math.sin(a*.76+s.phase);
      const yaw=Math.atan2(Math.cos(a),.76*Math.cos(a*.76+s.phase)),sn=Math.sin(yaw),cs=Math.cos(yaw);
      for(const f of s.fish){
        const fx=x+f.x*cs+f.z*sn,fz=z-f.x*sn+f.z*cs;
        const bed=floor(fx,fz),fy=Math.min(CFG.sea.level-.65,Math.max(bed+.42,s.y+f.y+.29*Math.sin(t*.9+f.phase)));
        stamp.position.set(fx,fy,fz);stamp.rotation.set(.06*Math.cos(a+f.phase),yaw+.07*Math.sin(t+f.phase),.045*Math.sin(f.phase+t));
        stamp.scale.setScalar(bed>CFG.sea.level-1.2?0:f.size);stamp.updateMatrix();mesh.setMatrixAt(index++,stamp.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate=true;
  }
  return {step};
}
