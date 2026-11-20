'use strict';
// The controller stands on the surface under the capsule centre. On a grade,
// the heel or toe that bears the weight can be several centimetres uphill.
const Footing = (() => {
  const point = new THREE.Vector3();
  const directions = [[0,0], [-.65,-.7], [.65,-.7], [-.65,.7], [.65,.7]];

  function bind(model) {
    // Pick actual mesh vertices on each shoe's lower hull in the initial pose.
    // The same vertex indices follow the animation through skin weights.
    model.updateMatrixWorld(true);
    const feet = [[], []];
    model.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      const {skinIndex,skinWeight,position} = mesh.geometry.attributes;
      if (!skinIndex || !skinWeight) return;
      const sides = mesh.skeleton.bones.map(bone => {
        const name = bone.name.match(/(left|right)(?:foot|toe)/i);
        return name ? (name[1].toLowerCase()==='left' ? 0 : 1) : -1;
      });
      for (let i=0; i<position.count; i++) {
        let side=-1, strongest=.15;
        for (let k=0;k<4;k++) {
          const index=sides[skinIndex.getComponent(i,k)], weight=skinWeight.getComponent(i,k);
          if (index>=0 && weight>strongest) { strongest=weight; side=index; }
        }
        if (side<0) continue;
        mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
        feet[side].push({mesh,index:i,x:point.x,y:point.y,z:point.z});
      }
    });
    const soles=[];
    for (const candidates of feet) {
      if (!candidates.length) continue;
      const base=candidates.reduce((y,p)=>Math.min(y,p.y),Infinity);
      const bottom=candidates.filter(p=>p.y<base+.095);
      for (const [dx,dz] of directions) {
        let best=null, lowest=Infinity;
        for (const p of bottom) {
          const score=p.y+dx*p.x+dz*p.z;
          if (score<lowest) {best=p;lowest=score;}
        }
        if (best && !soles.includes(best)) soles.push(best);
      }
    }
    return soles;
  }

  function place(actor,groundAt,preserveLift) {
    const soles=actor.soles;
    if (!soles?.length) return;
    const holder=actor.holder, base=holder.position.y;
    holder.updateMatrixWorld(true);
    let highestCorrection=-Infinity, soleHeight=Infinity;
    for (const {mesh,index} of soles) {
      mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld);
      const surface=groundAt(point.x,point.z);
      if (!Number.isFinite(surface)) continue;
      soleHeight=Math.min(soleHeight,point.y-base);
      highestCorrection=Math.max(highestCorrection,surface-point.y);
    }
    if (!Number.isFinite(highestCorrection)) return;
    // Keep the natural suspension phase when both shoes are off level ground.
    // The limit protects the visual body from tall ledge samples beside the capsule.
    const offset=highestCorrection+(preserveLift ? Math.max(0,soleHeight) : 0);
    holder.position.y+=clamp(offset,-.16,.21);
  }
  return {bind,place};
})();
