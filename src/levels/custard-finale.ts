import * as THREE from 'three';
import {CUSTARD_POOL_EDGES,CUSTARD_FINALE_DRESSING,CUSTARD_FINALE_FOAM} from './custard-finale-measured';
import type {CustomComponent,CustomGroup} from '../level';

type P=[number,number,number];
interface Course {point(s:number,y?:number,u?:number):P;height(s:number):number;yaw(s:number):number}
export const CUSTARD_POOL_Y=-28;
export const CUSTARD_FINALE_ORIGIN=2445;
export const CUSTARD_FINALE_GROUP:CustomGroup={id:95,nm:'Custard · three-dimensional downstream pool'};
const sections=[
 [8,0,26],[24,0,29],[42,1,27],[60,7,22],[77,17,15],[96,26,13],[112,40,10],[128,56,8],[136,60,7],
] as const;
const round=(n:number)=>Math.round(n*4096)/4096;
/** A broad pool narrows into one short, enclosed bend, as in the approved matte. */
export function custardPoolSection(d:number):{centre:number;halfWidth:number}{
 for(let i=1;i<sections.length;i++)if(d<=sections[i][0]){
  const a=sections[i-1],b=sections[i],t=THREE.MathUtils.clamp((d-a[0])/(b[0]-a[0]),0,1),f=t*t*(3-2*t);
  return {centre:THREE.MathUtils.lerp(a[1],b[1],f),halfWidth:THREE.MathUtils.lerp(a[2],b[2],f)};
 }
 return {centre:60,halfWidth:7};
}

/** Source-owned meshes and real Meshy props. No scenery cards or mist. */
export function buildCustardFinale(course:Course):CustomComponent[]{
 const out:CustomComponent[]=[],grp=CUSTARD_FINALE_GROUP.id;
 const point=(u:number,y:number,d:number)=>course.point(CUSTARD_FINALE_ORIGIN+d*.78,y,u);
 const origin=point(0,0,0),yaw=course.yaw(CUSTARD_FINALE_ORIGIN);
 const prop=(dkind:NonNullable<CustomComponent['dkind']>,u:number,y:number,d:number,size:P,turn:number,nm:string,color='#fff7e5')=>
  out.push({t:'decor',dkind,p:point(u,y,d),s:size,yaw:yaw+turn,scenerySolid:false,solid:false,edgeGrinding:false,grp,nm,color});
 const mesh=(nm:string,vertices:number[],indices:number[],uvs:number[],extra:Partial<CustomComponent>={})=>
  out.push({t:'mesh',p:origin,vertices,indices,uvs,tex:'custard-sandstone',color:'#e5c892',
   solid:false,scenerySolid:false,edgeGrinding:false,castShadow:true,grp,nm,...extra});
 const local=(u:number,y:number,d:number)=>{const q=point(u,y,d);return [q[0]-origin[0],y,q[2]-origin[2]].map(round) as P;};

 // Actual submerged bowl: the transparent water reveals its sloping edges,
 // floor and a few large submerged stones instead of a painted river image.
 const rows=48,bedCross=[-1,-5/6,-.5,0,.5,5/6,1],water:number[]=[],bed:number[]=[],uvs:number[]=[],waterUvs:number[]=[],bedIndices:number[]=[],waterIndices:number[]=[];
 for(let i=0;i<=rows;i++){
  const d=8+i*128/rows,{centre,halfWidth}=custardPoolSection(d),edges=CUSTARD_POOL_EDGES[i];
  const left=edges?.[1]??centre-halfWidth-.35,right=edges?.[2]??centre+halfWidth+.35;
  // A flat surface needs only its measured boundaries. Metric bank-distance
  // UVs interpolate identically across the unsplit planar strip.
  for(const u of [left,right]){water.push(...local(u,CUSTARD_POOL_Y,d));waterUvs.push(u-left,right-u);}
  if(i<rows){const a=i*2,b=a+2;waterIndices.push(a,a+1,b,a+1,b+1,b);}
  for(let j=0;j<bedCross.length;j++){
   const t=bedCross[j],u=THREE.MathUtils.lerp(left,right,(t+1)/2);
   const depth=.3+3.0*Math.pow(Math.max(0,1-t*t),.65)+.18*Math.sin(d*.18+u*.24);
   bed.push(...local(u,CUSTARD_POOL_Y-depth,d));uvs.push(u/5,d/5);
   if(i<rows&&j<bedCross.length-1){const a=i*bedCross.length+j,b=a+bedCross.length;bedIndices.push(a,a+1,b,a+1,b+1,b);}
  }
 }
 mesh('Custard sculpted submerged pool bed',bed,bedIndices,uvs,{color:'#afbb8f',tex:'custard-pool-bed'});
 mesh('Custard real downstream pool and river',water,waterIndices,waterUvs,{
  materialStyle:'jungle-stream',tex:'custard-pool',color:'#2cbb99',opacity:1,
  lethal:true,doubleSided:true,castShadow:false,
 });

 // Closed layered foundations support the whole bank silhouette. The
 // front-facing Meshy cliff modules add the measured ledges and fine relief.
 for(const side of [-1,1]){
  const vertices:number[]=[],triangles:number[]=[],bankUvs:number[]=[],colors:number[]=[];
  const profile=[[-.8,0],[.3,.15],[1.3,.17],[9,.22],[14,.35],[22,.78],[27,1],[60,1.03],[68,0]];
  const bankRows=20,n=profile.length;
  for(let i=0;i<=bankRows;i++){
   const d=2+i*132/bankRows,{centre,halfWidth}=custardPoolSection(d);
   const drop=THREE.MathUtils.smoothstep(d,86,122)*(side<0?8:3);
   const top=(side<0?-15:-17)+1.6*Math.sin(d*.054+side)-drop,bottom=-36;
   for(let j=0;j<n;j++){
    const [offset,height]=profile[j],u=centre+side*(halfWidth+offset+.45*Math.sin(d*.13+side));
    vertices.push(...local(u,bottom+(top-bottom)*height,d));bankUvs.push(d/4,(bottom+(top-bottom)*height+offset*.9)/4);
    const shade=.86+.09*Math.sin(d*.071+j*.48),turf=j===6||j===7;
    colors.push(...(turf?[.55*shade,.69*shade,.38*shade]:[shade,shade*.96,shade*.88]));
    if(i<bankRows){const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+j,e=(i+1)*n+(j+1)%n;
     if(side>0)triangles.push(a,b,c,b,e,c);else triangles.push(a,c,b,b,c,e);
    }
   }
  }
  // End caps keep both banks genuine closed volumes when viewed from below.
  const shape=profile.map(([u,y])=>new THREE.Vector2(u*side,y));
  for(const row of [0,bankRows])for(const face of THREE.ShapeUtils.triangulateShape(shape,[])){
   const ids=face.map(j=>row*n+j),a=new THREE.Vector3().fromArray(vertices,ids[0]*3),b=new THREE.Vector3().fromArray(vertices,ids[1]*3),c=new THREE.Vector3().fromArray(vertices,ids[2]*3);
   const forward=new THREE.Vector3(...local(0,0,1)).normalize().multiplyScalar(row===0?-1:1);
   if(b.sub(a).cross(c.sub(a)).dot(forward)<0)ids.reverse();triangles.push(...ids);
  }
  mesh(`Custard ${side<0?'left':'right'} gorge bank foundation`,vertices,triangles,bankUvs,{colors});
 }

 // Large asymmetric masses: a lower near rim, higher left bluff, and a
 // lower right bank. Two measured Meshy sources break the repeated strata.
 for(const [side,d,w,kind,y,turn] of [
  [-1,16,32,0,-33,65],[-1,43,56,1,-31,78],[-1,79,60,1,-30,45],[-1,113,42,1,-30,65],
  [1,21,46,1,-32,-70],[1,60,54,1,-32,-103],[1,100,45,1,-31,-60],
 ]){
  const h=side<0&&d>100?11:w*(kind ? .428683 : .519014),depth=w*(kind ? .920158 : .585341),angle=turn*Math.PI/180;
  const extent=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*depth)/2;
  const {centre,halfWidth}=custardPoolSection(d),u=centre+side*(halfWidth+extent-4);
  prop(kind?'custarderodedcliff':'custardgorgecliff',u,y,d,[w,h,depth],turn,'Custard broad layered gorge cliff','#ffffff');
 }
 for(const side of [-1,1]){const {centre,halfWidth}=custardPoolSection(145);
  prop('custardgorgecliff',centre+side*(halfWidth+18),-33,145,[38.535,20,22.556],side*10,'Custard far river-bend bank');
 }

 // Actual triangle measurements place the shoreline stones, rooted shrubs,
 // willow trunks and hanging curtains on this exact cliff assembly.
 for(const [kind,u,d,y,w,h,depth,turn,name] of CUSTARD_FINALE_DRESSING)
  prop(kind,u,y,d,[w,h,depth],turn,name,'#fffbea');
 // Keep authored patches within the existing 4,096-vertex/triangle editor
 // contract. Splitting changes neither positions nor the measured contour.
 const foam=CUSTARD_FINALE_FOAM;let fv:number[]=[],fi:number[]=[],fu:number[]=[],remap=new Map<number,number>(),patch=0;
 const flush=()=>{if(!fi.length)return;mesh(`Custard measured shoreline foam ${patch++}`,fv,fi,fu,
  {tex:'custard-foam',color:'#d9ecd3',opacity:.68,castShadow:false,doubleSided:true});fv=[];fi=[];fu=[];remap=new Map();};
 for(let i=0;i<foam.indices.length;i+=3){const triangle=foam.indices.slice(i,i+3);
  if(fi.length+3>12288||remap.size+triangle.filter(id=>!remap.has(id)).length>4096)flush();
  for(const id of triangle){let at=remap.get(id);if(at===undefined){at=remap.size;remap.set(id,at);fv.push(...foam.vertices.slice(id*3,id*3+3));fu.push(...foam.uvs.slice(id*2,id*2+2));}fi.push(at);}
 }
 flush();
 return out;
}
