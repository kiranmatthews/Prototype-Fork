/** Fit a complete rotated rock footprint into the landform. A centre sample
 * or an inscribed ellipse misses the downhill corners of broad sandstone fins. */
export function desertRockFooting(
  ground:(x:number,z:number)=>number,x:number,z:number,width:number,depth:number,yaw:number,
  burial=2,
):number {
  const angle=yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const nx=Math.max(2,Math.ceil(width/2)),nz=Math.max(2,Math.ceil(depth/2));
  let floor=Infinity;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const u=(i/nx-.5)*width,v=(j/nz-.5)*depth;
    floor=Math.min(floor,ground(x+u*c+v*s,z-u*s+v*c));
  }
  return floor-burial;
}
