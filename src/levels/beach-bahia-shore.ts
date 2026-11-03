import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';

type Road = {start:number;end:number;startY:number;endY:number};
type Gap = {start:number;end:number};
type Point = [number,number,number];
const round=(v:number)=>Math.round(v*100000)/100000;
export const BAHIA_SEA_Y=-.85;
export const BAHIA_WALL_X=7.2;
export const BAHIA_BEACH_INNER_X=7.6;
export const BAHIA_OPENINGS=[55,345,535,760,1005,1205,1465,1725,1900,2145,2355,2595,2875,2990];
export const bahiaShoreX=(distance:number)=>44+2.6*Math.sin(distance*.006)+.8*Math.sin(distance*.023);

/** The Treehouse opening's sand material, metre UVs and submerged-contour
 * ribbon, extended along the street. One surface owns dry beach and sea bed:
 * no sand rectangles, coplanar overlays, or water spanning inland ground. */
export function bahiaBeachRow(distance:number,heightAt:(z:number)=>number):Point[]{
  const shore=bahiaShoreX(distance),h=heightAt(distance),z=-distance;
  return [[7.6,h-.025,z],[11,Math.max(.7,h-.16),z],[20,Math.max(.44,h-.6),z],
    [28,Math.max(.32,h*.65)+.04*Math.sin(distance*.11),z],[shore-8,.04,z],[shore-4,-.28,z],
    [shore,BAHIA_SEA_Y,z],[shore+2,-1.7,z],[shore+6,-3,z],[shore+14,-4.6,z],[shore+26,-5.5,z]];
}

export function dressBahiaShore(data:CustomLevelData,road:readonly Road[],heightAt:(z:number)=>number,gaps:readonly Gap[]){
  const opening=(z:number,margin=0)=>BAHIA_OPENINGS.some(o=>Math.abs(o-z)<3.2+margin);
  data.components=data.components.filter(c=>!c.nm?.startsWith('canal wall ')
    &&!c.nm?.startsWith('beach boundary ')
    &&!(c.nm==='Boundary rail teal finish'&&c.p[0]>0)
    &&!(c.grp===101&&c.p[0]>0&&(c.dkind==='baypost'||c.dkind==='baylamp'&&opening(-c.p[2],1))));
  const put=(c:CustomComponent)=>data.components.push({...c,grp:105});
  // Include every grade break, so the sand's inner edge meets the existing
  // road exactly. Shared rows at patch ends have identical world positions.
  const stations=new Set<number>([-90,3130]);
  for(let z=-90;z<3130;z+=4)stations.add(z);
  for(const segment of road){stations.add(segment.start);stations.add(segment.end);}
  const samples=[...stations].sort((a,b)=>a-b);
  for(let first=0;first<samples.length-1;first+=48){
    const rows=samples.slice(first,first+49),v:number[]=[],normals:number[]=[],uv:number[]=[],colors:number[]=[],ix:number[]=[];
    const origin:Point=[0,0,-rows[0]],cols=11;
    for(const distance of rows)bahiaBeachRow(distance,heightAt).forEach(([x,y,z],col)=>{
      v.push(round(x),round(y),round(z-origin[2]));uv.push(round(x/6.5),round(z/6.5));
      const row=bahiaBeachRow(distance,heightAt),left=row[Math.max(0,col-1)],right=row[Math.min(cols-1,col+1)];
      const before=bahiaBeachRow(distance-.05,heightAt)[col],after=bahiaBeachRow(distance+.05,heightAt)[col];
      const n=new THREE.Vector3(...right).sub(new THREE.Vector3(...left))
        .cross(new THREE.Vector3(...after).sub(new THREE.Vector3(...before))).normalize();
      normals.push(round(n.x),round(n.y),round(n.z));
      const color=new THREE.Color('#fff5dc').lerp(new THREE.Color('#d4bc91'),col/(cols-1)*.32);
      colors.push(round(color.r),round(color.g),round(color.b));
    });
    for(let row=0;row<rows.length-1;row++)for(let col=0;col<cols-1;col++){
      const a=row*cols+col,b=a+1,c=a+cols,d=c+1;ix.push(a,b,c,b,d,c);
    }
    put({t:'mesh',p:origin,vertices:v,normals,indices:ix,uvs:uv,colors,tex:'sand',materialStyle:'unity-sand',
      color:'#ffffff',emissive:'#745b32',beachSand:true,smoothCollision:true,edgeGrinding:false,nm:`Bahia continuous Treehouse sand ${first/48+1}`});
  }
  delete data.unitySand;
  // As in Treehouse Trails, start both ocean layers 65 cm seaward of the
  // actual sea-level contour. Fine along-shore sampling prevents chords
  // from crossing a curved dry shore; water remains on the +X side.
  data.ocean={p:[0,BAHIA_SEA_Y,0],geometryVersion:2,length:3220,seaward:1,width:80,overlap:0,
    longitudinalSegments:805,lateralSegments:128,sourceCoordinates:'unity',extendTails:false,
    horizonMode:'shoreline',shoreGeometry:'ground',
    shore:samples.map(distance=>{
      const slope=(bahiaShoreX(distance+.05)-bahiaShoreX(distance-.05))/.1,length=Math.hypot(1,slope);
      return [round(bahiaShoreX(distance)+.65),-distance,round(1/length),round(slope/length)];
    })};
  // Low, cream stone parapet with genuinely open access bays. The original
  // four canal gaps stay open; their pits, launch ramps and camera are untouched.
  let wallIndex=0;
  for(const segment of road){
    const cuts=new Set([segment.start,segment.end]);
    for(const z of BAHIA_OPENINGS)for(const edge of [z-3.2,z+3.2])
      if(edge>segment.start&&edge<segment.end)cuts.add(edge);
    const ends=[...cuts].sort((a,b)=>a-b);
    for(let i=1;i<ends.length;i++){
      const a=ends[i-1],b=ends[i];if(opening((a+b)/2))continue;
      const pts:[number,number,number,number][]=[[0,0,0,0],[0,-(b-a),0,heightAt(b)-heightAt(a)]];
      const nm=`Bahia sandstone seawall ${++wallIndex}`;
      put({t:'wallpath',p:[7.2,heightAt(a)-.1,-a],pts,w:.8,rise:1.16,tex:'bay-stucco',color:'#e8d9bd',nm});
      put({t:'wallpath',p:[7.2,heightAt(a)+1.06,-a],pts,w:1.02,rise:.2,tex:'bay-stucco',color:'#fff1d0',
        solid:false,nm:`${nm} cream coping`});
      // Shallow inset mortar joints read as individual stone panels at both
      // native and normal resolution without replacing the wall silhouette.
      for(let z=a+3;z<b-.3;z+=3.2)for(const x of [6.792,7.608])
        put({t:'decor',dkind:'block',p:[x,heightAt(z)+.48,-z],s:[.012,.99,.035],
          tex:'solid',color:'#b8ac94',solid:false,scenerySolid:false,nm:'Bahia sandstone panel joint'});
      for(const x of [6.791,7.609])put({t:'mesh',p:[x,heightAt(a)+.48,-a],
        vertices:[0,0,0,0,.035,0,0,heightAt(b)-heightAt(a),a-b,0,heightAt(b)-heightAt(a)+.035,a-b],
        indices:[0,1,2,1,3,2],doubleSided:true,solid:false,tex:'solid',color:'#b8ac94',nm:'Bahia sandstone horizontal mortar'});
    }
  }
  for(const z of BAHIA_OPENINGS){
    for(const side of [-1,1]){
      const d=z+side*3.35;
      put({t:'wall',p:[7.2,heightAt(d)-.1,-d],s:[1.1,1.38,.65],tex:'bay-stucco',color:'#ecddbf',nm:'Bahia beach opening stone pier'});
      put({t:'decor',dkind:'block',p:[7.2,heightAt(d)+1.33,-d],s:[1.28,.18,.82],tex:'bay-stucco',color:'#fff1d0',
        solid:false,scenerySolid:false,nm:'Bahia beach opening pier cap'});
    }
    // A fitted apron reaches the sand at the same height; never a floating
    // stair set that clips into the changing road grades.
    const v:number[]=[],uv:number[]=[],ix:number[]=[];
    for(const d of [z-2.7,z+2.7])for(const x of [6.5,7.6,11]){
      const h=x<=7.6?heightAt(d)+.018:Math.max(.7,heightAt(d)-.16)+.018;
      v.push(x,h,-d);uv.push(x/3,d/3);
    }
    for(let i=0;i<2;i++)ix.push(i,i+1,i+3,i+1,i+4,i+3);
    put({t:'mesh',p:[0,0,0],vertices:v,indices:ix,uvs:uv,tex:'bay-paving',color:'#f6e6c5',
      nm:'Bahia beach access fitted apron',edgeGrinding:false});
  }
  // A few familiar coastal palms frame the beach without hiding the water.
  for(let z=85,i=0;z<2990;z+=116,i++){
    if(gaps.some(g=>z>g.start-12&&z<g.end+12))continue;
    const x=23+(i%3)*2,profile=bahiaBeachRow(z,heightAt),a=profile[2],b=profile[3];
    const y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]),yaw=i*57,scale=.72+(i%3)*.08;
    put({t:'decor',dkind:'baytrunk',p:[x,y-.12,-z],s:[3.99883*scale,8*scale,3.14292*scale],yaw,
      solid:false,scenerySolid:false,nm:'Bahia beach palm trunk'});
    const angle=yaw*Math.PI/180;
    put({t:'decor',dkind:'baycrown',p:[x+Math.cos(angle)*.65*scale,y-.12+7*scale,-z-Math.sin(angle)*.65*scale],
      s:[8*scale,3.59648*scale,7.92055*scale],yaw,solid:false,scenerySolid:false,nm:'Bahia beach palm crown'});
  }
  data.groups=[...(data.groups??[]),{id:105,nm:'Bahia beach · stone wall, warm sand, Treehouse shoreline'}];
}
