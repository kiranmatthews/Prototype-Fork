import type { CustomComponent, CustomOceanData } from '../level';

/** The small cove opens behind the original spawn; the jungle route stays -Z. */
export const JUNGLE_COVE = Object.freeze({ near: 13.5, far: 96, halfWidth: 36 });
export function jungleCoveWidth(z: number): number {
  const knots = [[13.5, 7.8], [25, 16], [42, 30], [62, 36], [96, 36]];
  for (let i = 1; i < knots.length; i++) {
    if (z <= knots[i][0]) {
      const [a, aw] = knots[i - 1], [b, bw] = knots[i];
      return aw + (bw - aw) * Math.max(0, (z - a) / (b - a));
    }
  }
  return 36;
}
/** Same profile drives sand, the water contour, and shoreline prop seating. */
export function jungleCoveHeight(x:number,z:number):number {
  const side=Math.max(-1,Math.min(1,x/jungleCoveWidth(z)));
  const scallop=1.35*Math.sin(side*3.1)+1.1*side*side;
  const u=Math.min(1,Math.max(0,(z-14-scallop)/34));
  const slope=u*u*(3-2*u);
  return -6*slope+1.2*Math.pow(Math.abs(side),4)*slope;
}
/** Start the detailed sea seaward of its actual sand intersection, as in
 * Treehouse's opening. The margin also protects broad lite-mode wave cells. */
export function jungleCoveWaterZ(x:number):number {
  let a=14,b=48;
  for(let i=0;i<32;i++){
    const mid=(a+b)/2;
    if(jungleCoveHeight(x,mid)>-1.25)a=mid;else b=mid;
  }
  return (a+b)/2+.8;
}
export function jungleShore(gx: (z: number) => number, gy: (z: number) => number) {
  const x = gx(14), y = gy(14), sea = y - 1.25;
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [],uvs:number[]=[];
  const rows = 66, columns = 32;
  for (let row = 0; row <= rows; row++) {
    const z = JUNGLE_COVE.near + (JUNGLE_COVE.far - JUNGLE_COVE.near) * row / rows;
    for (let col = 0; col <= columns; col++) {
      const side = col / columns * 2 - 1;
      const localX=side*jungleCoveWidth(z),height=jungleCoveHeight(localX,z);
      vertices.push(localX,height,z-14);
      uvs.push(localX/6.5,z/6.5);
      // Warm dry sand fades into the quieter submerged bed.
      const wet=Math.min(1,Math.max(0,(-height-.4)/4));
      colors.push(1-wet*.19,.96-wet*.19,.83-wet*.18);
    }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const components: CustomComponent[] = [{
    t: 'mesh', p: [x, y, 14], vertices, indices, colors,uvs,
    tex: 'sand', materialStyle: 'unity-sand', color: '#ffffff',
    beachSand: true, edgeGrinding: false, nm: 'Jungle cove beach and seabed', grp: 290,
  }];
  for (const side of [-1, 1]) {
    for (const [i,[z,h,w]] of [[27,11,12],[46,15,16],[69,17,16],[91,12,13]].entries()) {
      components.push({t:'decor',dkind:i%2?'trialsv2cavewalla':'trialsv2cavewallb',
        p:[x+side*(jungleCoveWidth(z)+4.5),sea-4.8,z],s:[27,h,w],
        yaw:side*90+side*(i%2?8:-11),solid:false,scenerySolid:false,
        color:'#e3e1ce',castShadow:false,nm:'Cove eroded rock headland',grp:290});
    }
    for(const [i,z] of [19.5,24].entries()){
      const localX=side*(jungleCoveWidth(z)-1.7),ground=y+jungleCoveHeight(localX,z);
      components.push({t:'decor',dkind:'junglepalmtree',p:[x+localX,ground-.32,z],s:[10,12.5,10],
        yaw:side*45+i*31,solid:false,scenerySolid:false,color:'#dce4bd',nm:'Shore palm rooted in the sand',grp:290});
      components.push({t:'decor',dkind:i?'trialsv2fernb':'trialsv2ferna',
        p:[x+localX+side*.5,ground-.12,z-1.2],s:[3.2,1.8,3],yaw:side*61,
        solid:false,scenerySolid:false,nm:'Low planting at the dry sand edge',grp:290});
    }
    for(const [i,z] of [25,32,42].entries()){
      const localX=side*(jungleCoveWidth(z)-1.1),ground=y+jungleCoveHeight(localX,z);
      components.push({t:'decor',dkind:'treehousemossrock',p:[x+localX,ground-1.1,z],
        s:[4.5+i*.65,2.5+i*.2,3.9+i*.5],yaw:side*27+i*57,solid:false,scenerySolid:false,
        color:'#e0e0c8',nm:'Cove tide-worn mossy boulder',grp:290});
    }
  }
  const shore:NonNullable<CustomOceanData['shore']>=Array.from({length:49},(_,i)=>{
    const localX=-48+i*2,z=jungleCoveWaterZ(localX);
    const slope=(jungleCoveWaterZ(localX+.05)-jungleCoveWaterZ(localX-.05))/.1,n=Math.hypot(1,slope);
    return [localX,z,-slope/n,1/n];
  });
  const ocean: CustomOceanData = {
    // Inland hollows sit below sea level. Keep the distant sea on the cove
    // side, otherwise the surrounding horizon plane covers the jungle floor.
    horizonMode:'shoreline',shoreGeometry:'ground',
    geometryVersion:2,p:[x,sea,0],seaward:1,shore,
    length:96,width:96,overlap:0,longitudinalSegments:96,
    lateralSegments:128,sourceCoordinates:'unity',extendTails:false,
    swimBounds: [x - 41, 13.5, x + 41, 100],
  };
  return { components, ocean, group: { id: 290, nm: 'Jungle swimming cove' } };
}
