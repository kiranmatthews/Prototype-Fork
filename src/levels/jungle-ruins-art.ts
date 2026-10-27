import type { CustomComponent, CustomGroup } from "../level";
import type { JungleAssetKind } from "../jungleAssets";
import { jungleAssemblyComponents } from "../jungleAssemblies";
import { jungleShoulderHeight } from "../jungleGround";
import { jungleContainment } from "./jungle-ruins-bounds";
import { jungleRuinsForest } from "./jungle-ruins-forest";

/** Deliberately sparse, large plants. Two depths and an overhead canopy close the lane. */
export function jungleRuinsDressing(gx: (z: number) => number, gy: (z: number) => number): {components:CustomComponent[];groups:CustomGroup[]} {
  const out: CustomComponent[] = [];
  const groups:CustomGroup[]=[{id:200,nm:"Jungle planting and accents"}];
  const group=(name:string):number=>{const id=200+groups.length;groups.push({id,nm:name});return id;};
  const rnd = (i: number): number => { const n = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return n - Math.floor(n); };
  const add = (dkind: JungleAssetKind, p: [number, number, number], s: [number, number, number], yaw = 0, color?: string): void => {
    out.push({ t: "decor", dkind, p, s, yaw, color, solid: false, grp:200 });
  };
  let k = 0;
  const stretches: [number, number, number, number][] = [
    [14, -296, 0, 6.7], [-300, -486, 16, 11.5], [-490, -718, 0, 6.7],
  ];
  for (const [near, far, base, inset] of stretches) {
    for (let z = near; z > far; z -= 10.4) {
      for (const side of [-1, 1]) {
        const seed = k++ * 31;
        const jitterZ = z + (rnd(seed + 3) - 0.5) * 2;
        const inner = jitterZ > -34 || jitterZ < -676 ? 6.1 : 5.1;
        const soilHeight = base === 0 ? jungleShoulderHeight(inset - inner + rnd(seed) * .8, jitterZ) : .35;
        const y = base + gy(jitterZ) + soilHeight;
        const x = gx(jitterZ) + side * (inset + rnd(seed) * 0.8);
        const fern = rnd(seed + 1) > 0.58;
        const scale = 0.92 + rnd(seed + 5) * 0.3;
        // Leave occasional pockets for the lower Treehouse planting layer.
        if(k%3!==1)add(fern ? "junglefern" : "jungleleaf", [x, y, jitterZ],
          fern ? [6.7 * scale, 2.9 * scale, 6 * scale] : [6.6 * scale, 3.8 * scale, 6.2 * scale],
          rnd(seed + 7) * 360, rnd(seed + 11) < 0.3 ? '#bedc9b' : '#ffffff');
        // A larger, darker bank plant fills the space between foreground crowns.
        if (k % 3 !== 0) {
          add("jungleleaf", [gx(z) + side * (inset + 5.8), y - 0.3, z - 3.3],
            [8.8, 5.6, 8.5], rnd(seed + 17) * 360, '#85b097');
        }
        if (k % 4 < 2) {
          add("junglepalmtree", [gx(z) + side * (inset + 4.1 + rnd(seed + 19) * 2), y, z + 1],
            [13.8, 16 + rnd(seed + 23) * 4, 13.5], rnd(seed + 29) * 360, '#d4e5b3');
        }
        if (k % 6 < 2) {
          add("junglepalmtree", [gx(z) + side * (inset + 18), y - 0.5, z - 2],
            [22, 24 + rnd(seed + 31) * 5, 21], rnd(seed + 37) * 360, '#6e9c88');
          add("jungleleaf", [gx(z) + side * (inset + 15), base + gy(z) + .2, z - 3],
            [15, 10, 15], rnd(seed + 41) * 360, '#568873');
        }
      }
    }
  }

  // Broad crowns overlap into a canopy ceiling. Trunks stay outside the lane.
  for (let z = 10, i = 0; z > -715; z -= 17.5, i++) {
    const temple = z < -300 && z > -486;
    const base = temple ? 16 : 0;
    const inset = temple ? 18.5 : 13.8;
    for (const side of [-1, 1]) {
      const r = rnd(i * 83 + (side > 0 ? 19 : 3));
      add("junglecanopy", [gx(z) + side * (inset + r * 1.4), base + gy(z) + .32, z + side * 2.2],
        [21 + r * 2, 18 + r * 2.5, 20 + r * 2], r * 360,
        i % 3 === 0 ? "#94b89b" : "#c4d8b0");
    }
  }

  // Strong silhouettes announce each traversal beat; the opening always clears the lane.
  for (const z of [-18, -88, -158, -251, -296, -514, -638, -685]) {
    out.push(...jungleAssemblyComponents({dkind:"hangingarch",p:[gx(z),gy(z)-.18,z],s:[21,14.5,3.1]},`Gateway ${Math.abs(z)}`,group(`Gateway ${Math.abs(z)}`)));
  }
  out.push(...jungleAssemblyComponents({dkind:"hangingarch",p:[0,11.35,-413],s:[21,14,3.1]},"Terrace gateway",group("Terrace gateway")));
  // Shrines sit on supported scenery banks, well beyond the traversable corridor.
  for (const [x, y, z, yaw, scale] of [
    [-19, 0, -65, 20, 1], [19, 0, -273, -25, 1.15],
    [-23, 16, -348, 22, 1.3], [23, 16, -438, -20, 1.2],
    [-20, 0, -604, 25, 1.05], [-24, -1.5, -714, 20, 1.65],
  ]) {
    out.push(...jungleAssemblyComponents({dkind:"roofedtemple",p:[gx(z)+x,y+gy(z)-.3,z],
      s:[14*scale,13.5*scale,12*scale],yaw,vr:x<0?1:0},z<-700?"Finish sanctuary":`Wayside temple ${Math.abs(z)}`,group(z<-700?"Finish sanctuary":`Wayside temple ${Math.abs(z)}`)));
  }

  // Roofed rooms on the route make the temple something the player enters.
  // Their floor stays owned by the authored traversal surfaces beneath them.
  for (const room of [
    {name:"Temple entrance portico",z:-308,y:0,w:20,d:9,h:12.6},
    {name:"Terrace roofed hall",z:-423,y:11.5,w:20,d:18,h:13.5},
  ]) {
    const roomGroup=group(room.name);
    out.push(...jungleAssemblyComponents({dkind:"roofedtemple",p:[0,room.y,room.z],
      s:[room.w,room.h,room.d],openFloor:true,seed:Math.abs(room.z)},room.name,roomGroup));
    const zs=room.d>10?[-room.d/2+1.7,0,room.d/2-1.7]:[-room.d/2+1.7,room.d/2-1.7];
    for(const side of [-1,1])for(const z of zs)out.push({t:"wall",p:[side*(room.w/2-1.7),room.y,room.z+z],
      s:[2.6,7.5,2.6],invisible:true,nm:room.name+" pier collision",grp:roomGroup});
    for(const side of [-1,1])add("junglevine",[side*3.2,room.y+8,room.z+room.d/2-.8],[5,2.4,1],0,"#91ad66");
  }

  // Reliefs mark chambers, with long quiet masonry between the accents.
  for(const z of [-322,-350,-377,-406,-432]) {
    const y=z>-386?Math.max(0,(-324-z)/62*11.5):11.5;
    for(const side of [-1,1])add("stonefrieze",[side*8.15,y+2.2,z],[2.4,1.8,.35],side<0?90:-90,"#d7e2cd");
  }

  // Fit dressed coping to the five original climb blocks. The chipped native
  // cornices sit below the collider lip and cover the exposed earth core.
  for(const [i,cx] of [-2.6,2.6,-2.6,2.6,0].entries()){
    const top=2.3*(i+1),z=-332-i*12,depth=i===4?14:10;
    for(let n=0;n<3;n++)out.push({t:'decor',dkind:'stonecornice',
      p:[cx-4+(n+.5)*8/3,top-.38,z+depth/2-.5],s:[8/3+.015,.35,1.05],
      solid:false,scenerySolid:false,castShadow:false,color:'#e7e2ca',grp:200,nm:'Climbing block · dressed chipped lip'});
    for(const side of [-1,1])out.push({t:'decor',dkind:'trialsv2groundcovera',
      p:[cx+side*3.25,top-.13,z-depth/2+1],s:[1.7,.42,1.8],yaw:i*73+side*31,
      solid:false,scenerySolid:false,castShadow:false,grp:200,nm:'Climbing block · moss rooted in a rear joint'});
  }

  // Roofline planting and occasional ruined pedestals give the temple a human scale.
  for (let z = -304; z >= -482; z -= 17) {
    const top = z > -386 ? 0 : z > -444 ? 11.5 : 11.5 - ((-444 - z) / 42) * 11.1;
    for (const side of [-1, 1]) {
      add("junglefern", [side * 7.3, top - 0.05, z], [3.8, 1.65, 3.4], side * 65);
      // The descent falls another 1.6 m over six metres: don't seat a
      // pedestal there using the height of the fern farther up the ramp.
      if (z > -325 || (z < -390 && z > -438)) add("templeplatform", [side * 7.6, top - 0.1, z - 6], [2.8, 1.3, 2.8], side * 8);
    }
  }
  // Full-detail eroded Treehouse rock faces close the sky gaps behind the
  // planting. Their broad axis follows the corridor; roots bury their feet.
  const outerGroup=group("Outer jungle and rock faces");
  for(let z=22,i=0;z>-746;z-=22,i++)for(const side of [-1,1]) {
    const r=rnd(i*137+(side<0?11:71));
    const temple=z<-300&&z>-486,base=temple?16:0,inset=temple?48:41;
    out.push({t:"decor",dkind:i%2?'trialsv2cavewalla':'trialsv2cavewallb',p:[gx(z)+side*(inset+r*3-3),base+gy(z)-5,z],
      s:[36+r*4,(i%5===2?25:32)+r*5,22+r*3],yaw:side*90+(r-.5)*14,
      color:["#e0e6cf","#cbdac8","#e4e0c7"][i%3],solid:false,scenerySolid:false,castShadow:false,grp:outerGroup,nm:"Outer eroded rock face"});
    if(i%2===0)out.push({t:"decor",dkind:"junglebackdrop",
      p:[gx(z)+side*(temple?56:48),base+gy(z)-9,z-8+side*3],
      s:[43+r*5,39+r*6,46+r*4],yaw:r*360,color:side<0?"#89a796":"#98af93",
      solid:false,grp:outerGroup,nm:"Outer jungle canopy"});
  }
  out.push(jungleContainment(gx,group("Jungle perimeter")));
  out.push(...jungleRuinsForest(gx,gy,group("Treehouse forest floor"),group("Treehouse rooted canopy")));
  return {components:out,groups};
}
