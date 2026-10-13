import * as THREE from 'three';
import type {CustomComponent,CustomGroup} from '../level';

type P=[number,number,number];
interface Course {point(s:number,y?:number,u?:number):P;height(s:number):number;yaw(s:number):number}
export const CUSTARD_POOL_Y=-28;
export const CUSTARD_FINALE_ORIGIN=2445;
export const CUSTARD_FINALE_GROUP:CustomGroup={id:95,nm:'Custard · three-dimensional downstream pool'};
const sections=[
 [8,0,26],[24,0,29],[42,1,27],[60,7,22],[77,17,15],[96,27,10],[112,27,8],[128,19,7],
] as const;
const round=(n:number)=>Math.round(n*4096)/4096;
/** A broad pool narrows into one short, enclosed bend, as in the approved matte. */
export function custardPoolSection(d:number):{centre:number;halfWidth:number}{
 for(let i=1;i<sections.length;i++)if(d<=sections[i][0]){
  const a=sections[i-1],b=sections[i],t=THREE.MathUtils.clamp((d-a[0])/(b[0]-a[0]),0,1),f=t*t*(3-2*t);
  return {centre:THREE.MathUtils.lerp(a[1],b[1],f),halfWidth:THREE.MathUtils.lerp(a[2],b[2],f)};
 }
 return {centre:19,halfWidth:7};
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
 const rows=48,columns=12,water:number[]=[],bed:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let i=0;i<=rows;i++){
  const d=8+i*128/rows,{centre,halfWidth}=custardPoolSection(d);
  for(let j=0;j<=columns;j++){
   const t=-1+2*j/columns,u=centre+t*(halfWidth+.35);
   water.push(...local(u,CUSTARD_POOL_Y,d));
   const depth=.65+3.0*Math.pow(Math.max(0,1-t*t),.65)+.18*Math.sin(d*.18+u*.24);
   bed.push(...local(u,CUSTARD_POOL_Y-depth,d));uvs.push(u/5,d/5);
   if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
 }
 mesh('Custard sculpted submerged pool bed',bed,indices,uvs,{color:'#99b58c'});
 mesh('Custard real downstream pool and river',water,[...indices],[...uvs],{
  materialStyle:'jungle-stream',tex:'custard-water',color:'#2cbb99',emissive:'#155c42',opacity:.90,
  lethal:true,doubleSided:true,castShadow:false,
 });

 // Closed layered foundations support the whole bank silhouette. The
 // front-facing Meshy cliff modules add the measured ledges and fine relief.
 for(const side of [-1,1]){
  const vertices:number[]=[],triangles:number[]=[],bankUvs:number[]=[],colors:number[]=[];
  const profile=[[8,0],[9,.23],[10,.26],[9.5,.49],[12,.53],[11,.78],[14,1],[50,1.03],[62,0]];
  const bankRows=44,n=profile.length;
  for(let i=0;i<=bankRows;i++){
   const d=2+i*132/bankRows,{centre,halfWidth}=custardPoolSection(d);
   const top=(side<0?-15:-17)+1.6*Math.sin(d*.054+side),bottom=-36;
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

 // Broad asymmetric cliff faces: large banks rather than a forest of spires.
 for(const [side,d,h,turn] of [
  [-1,22,19,65],[-1,49,22,88],[-1,78,21,60],[-1,111,20,75],
  [1,25,18,-70],[1,59,20,-105],[1,94,20,-65],
 ]){
  const w=h/.519014,depth=w*.585341,angle=turn*Math.PI/180;
  const extent=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*depth)/2;
  const {centre,halfWidth}=custardPoolSection(d),u=centre+side*(halfWidth+extent-13);
  prop('custardgorgecliff',u,-33,d,[w,h,depth],turn,'Custard broad layered gorge cliff');
 }
 for(const [u,turn] of [[3,-5],[45,7]])prop('custardgorgecliff',u,-33,145,[38.535,20,22.556],turn,'Custard closed far gorge bank');

 // Shoreline stones deliberately meet the waterline; four quieter submerged
 // forms remain visible through the real water surface.
 for(const [u,d,w,h] of [[-24,28,6.6,4.8],[-22,44,7,5.2],[-15,63,6.5,4.4],
  [27,28,5.8,4.2],[28,50,5.2,3.7],[31,70,4.8,3.5],[18,97,4.4,3.0]])
  prop('custardboulder',u,CUSTARD_POOL_Y-h*.55,d,[w,h,w*.86],d*13,'Custard pool shoreline boulder','#e9d2a7');
 for(const [u,d,w] of [[-17,23,5.5],[-10,36,4.8],[18,40,5.6],[14,61,4.2]])
  prop('custardboulder',u,CUSTARD_POOL_Y-3.4,d,[w,1.8,w*.86],d*19,'Custard submerged pool stone','#b7b67b');

 // Root heights were raycast against the final cliff triangles. Individual
 // rooted 3D willows give the near banks the reference's large
 // drooping foliage shapes, with a few low-detail groves closing the bend.
 for(const [u,d,width,turn,base] of [
  [-31,18,12,25,-14.373],[-38,47,16,130,-13.542],[-25,78,16,220,-15.031],[-13,111,20,55,-16.398],
  [31,25,13,190,-15.469],[37,59,17,10,-13.477],[47,93,18,115,-13.666],[51,121,24,260,-15.504],
  [-3,132,22,60,-15.376],[37,143,22,170,-13.435],
 ]){
  prop('custardwillow',u,base,d,[width,width*.979357,width*.973089],turn,'Custard rooted gorge willow','#fff6d4');
 }
 for(const [u,d,w,turn] of [[-39,111,62,85],[59,109,66,90],[19,155,94,0]])
  prop('custardgrove',u,-15,d,[w,w*.21835,w*.307],turn,'Custard enclosed bend woodland','#f4efce');
 // Low leafy masses sit on the inner ledges, leaving the large sandstone
 // shapes readable and drawing green down toward the waterline.
 for(const [u,d,y,w,turn] of [
  [-27.696,12,-22.118,8,75],[-14.965,34,-11.451,12,75],[-4.041,62,-11.58,12,75],[22.611,96,-16.293,11,75],
  [25.942,17,-21.129,9,-85],[22.669,44,-13.483,13,-85],[27.699,77,-13.254,12,-85],[29.355,111,-13.465,12,-85],
 ]){
  const height=w*.747569;
  prop('custardclifffoliage',u,y-height*.82,d,[w,height,w],turn,'Custard trailing cliff foliage','#fff5d8');
 }
 for(const [u,d,y] of [[-32,19,-14.46],[-34,43,-11.283],[-24,72,-11.436],[32,19,-15.449],[36,46,-13.488],[42,90,-13.485],[-4,119,-16.275],[44,130,-15.512]]){
  prop('coastcarpet',u,y,d,[8,1.7,4.2],d*29,'Custard broad bank moss','#e0d19b');
  prop('coastfern',u+1,y+.1,d+1,[4.1,2.2,3.8],d*17,'Custard bank fern','#d6d392');
 }
 return out;
}
