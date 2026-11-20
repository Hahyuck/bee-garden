'use strict';
// Height of the top visible triangle at a world-space X/Z. The terrain grids have
// regular spacing; only the narrow road and trail need a spatial index.
const GroundSurface = (() => {
  const grids = [], strips = [];
  function grid(mesh, n, x, z, width) {
    grids.push({data:mesh.geometry.attributes.position.array,n,x,z,width});
  }
  function strip(mesh, trail) {
    const data = mesh.geometry.attributes.position.array, indices = mesh.geometry.index.array;
    const cells = new Map(), cellSize = 4;
    for (let i=0; i<indices.length; i+=3) {
      const a=indices[i]*3, b=indices[i+1]*3, c=indices[i+2]*3;
      const left=Math.floor(Math.min(data[a],data[b],data[c])/cellSize);
      const right=Math.floor(Math.max(data[a],data[b],data[c])/cellSize);
      const near=Math.floor(Math.min(data[a+2],data[b+2],data[c+2])/cellSize);
      const far=Math.floor(Math.max(data[a+2],data[b+2],data[c+2])/cellSize);
      for (let iz=near; iz<=far; iz++) for (let ix=left; ix<=right; ix++) {
        const key=ix+iz*65536;
        if (!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(i);
      }
    }
    strips.push({data,indices,cells,cellSize,trail});
  }
  function height(x,z,hideTrail) {
    let y = -Infinity;
    for (const g of grids) {
      const gx=(x-g.x)*(g.n-1)/g.width, gz=(z-g.z)*(g.n-1)/g.width;
      if (gx<0 || gz<0 || gx>g.n-1 || gz>g.n-1) continue;
      const i=Math.min(Math.floor(gx),g.n-2), j=Math.min(Math.floor(gz),g.n-2);
      const a=(j*g.n+i)*3+1, b=a+3, c=a+g.n*3, d=c+3, px=gx-i, pz=gz-j, h=g.data;
      const ground=px+pz<=1 ? h[a]+px*(h[b]-h[a])+pz*(h[c]-h[a])
        : h[d]+(1-px)*(h[c]-h[d])+(1-pz)*(h[b]-h[d]);
      y=Math.max(y,ground);
    }
    for (const s of strips) {
      if (s.trail && hideTrail) continue;
      const cells=s.cells.get(Math.floor(x/s.cellSize)+65536*Math.floor(z/s.cellSize));
      if (!cells) continue;
      const p=s.data, idx=s.indices;
      for (const i of cells) {
        const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
        const bx=p[b]-p[a],bz=p[b+2]-p[a+2],cx=p[c]-p[a],cz=p[c+2]-p[a+2];
        const det=bx*cz-bz*cx;
        if (Math.abs(det)<1e-9) continue;
        const dx=x-p[a], dz=z-p[a+2], u=(dx*cz-dz*cx)/det, v=(bx*dz-bz*dx)/det;
        if (u>=-1e-5 && v>=-1e-5 && u+v<=1.00001)
          y=Math.max(y,p[a+1]+u*(p[b+1]-p[a+1])+v*(p[c+1]-p[a+1]));
      }
    }
    return y;
  }
  return {grid,strip,height};
})();
