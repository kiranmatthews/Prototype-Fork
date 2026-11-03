import * as THREE from 'three';
import type {CustomComponent,CustomGroup} from '../level';
import {CONST,TUNING} from '../tuning';

type P=[number,number,number];
interface Course {point(s:number,y?:number,u?:number):P;yaw(s:number):number}
export const SUNSET_WATERFALL_GROUPS:CustomGroup[]=[
 {id:96,nm:'Sunset · upper waterfall springs'},
 {id:97,nm:'Sunset · hanging timber chasms'},
 {id:98,nm:'Sunset · lower cascade and finish'},
 {id:99,nm:'Sunset · stepped river gorge'},
];
export const SUNSET_WATERFALL_ROUTE=[
 {s:2452,y:-10,kind:'spring'}, {s:2496,y:-22,kind:'spring'},
 {s:2540,y:-42,kind:'spring'}, {s:2584,y:-64,kind:'spring'},
 {s:2628,y:-84,kind:'rest'}, {s:2650,y:-98,kind:'spring'},
 {s:2694,y:-104,kind:'spring'}, {s:2738,y:-126,kind:'spring'},
 {s:2782,y:-148,kind:'spring'}, {s:2826,y:-168,kind:'rest'},
 {s:2848,y:-182,kind:'spring'}, {s:2892,y:-190,kind:'spring'},
 {s:2936,y:-212,kind:'spring'}, {s:2980,y:-234,kind:'spring'},
 {s:3024,y:-254,kind:'finish'},
] as const;
export const SUNSET_WATERFALL_FINISH=3052;
const q=(n:number)=>Math.round(n*10000)/10000;

/** Carlisle's authoring-time flight measurement, using the production gravity
 * and terminal velocity. Runtime is entirely native trampoline / air control. */
export function waterfallFlight(up:number,dy:number):number {
 let y=0,v=up;
 for(let n=1;n<1800;n++){
  const before=y;v=Math.max(-CONST.maxFallSpeed,v-(v>0?TUNING.riseGravity:TUNING.fallGravity)/60);y+=v/60;
  if(v<0&&y<=dy)return(n-1+(before-dy)/(before-y))/60;
 }
 return 30;
}
export function waterfallLaunch(distance:number,drop:number):number {
 let lo=0,hi=150;
 // Held Jump reaches the far half of the broad net; the unboosted arc still
 // reaches its near half. No target attraction or authored air velocity.
 for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(waterfallFlight(mid*1.25,drop)*TUNING.walkSpeed<distance+3)lo=mid;else hi=mid;}
 return q(hi);
}

/** A 614 m extension: twelve native springs, two safe ledges, thirteen
 * descending water terraces. All simple framing/supports are authored meshes. */
export function buildSunsetWaterfalls(course:Course):CustomComponent[]{
 const C:CustomComponent[]=[],yaw=course.yaw(2430);
 const group=(s:number)=>s<2618?96:s<2816?97:98;
 const point=(s:number,y:number,u=0)=>course.point(s,y,u);
 const geom=(name:string,p:P,g:THREE.BufferGeometry,extra:Partial<CustomComponent>={})=>{
  C.push({t:'mesh',p,vertices:Array.from(g.attributes.position.array).map(q),indices:g.index?Array.from(g.index.array):undefined,
   normals:Array.from(g.attributes.normal.array).map(q),uvs:Array.from(g.attributes.uv.array).map(q),
   tex:'treehouse-timber',color:'#bc8954',solid:false,scenerySolid:false,castShadow:true,grp:99,nm:name,...extra});g.dispose();
 };
 const beam=(name:string,a:P,b:P,w:number,d=w)=>{
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),length=from.distanceTo(to),g=new THREE.BoxGeometry(w,length,d);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));
  geom(name,from.add(to).multiplyScalar(.5).toArray() as P,g);
 };
 const prop=(kind:CustomComponent['dkind'],s:number,y:number,u:number,size:P,turn:number,name:string,color='#fff3db')=>
  C.push({t:'decor',dkind:kind,p:point(s,y,u),s:size,yaw:yaw+turn,solid:false,scenerySolid:false,castShadow:true,color,grp:99,nm:name});
 const surface=(name:string,rows:number[][],tex:string,color:string,extra:Partial<CustomComponent>={})=>{
  const origin=point(rows[0][0],0),vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
  rows.forEach(([s,y,half],i)=>{
   for(let j=0;j<=12;j++){const u=-half+2*half*j/12,p=point(s,y,u);vertices.push(q(p[0]-origin[0]),y,q(p[2]-origin[2]));uvs.push(j*half/24,tex==='custard-foam'?i/(rows.length-1):(s-rows[0][0]-y)/8);}
   if(i)for(let j=0;j<12;j++){const a=(i-1)*13+j,b=i*13+j;indices.push(a,a+1,b,a+1,b+1,b);}
  });
  C.push({t:'mesh',p:origin,vertices,uvs,indices,solid:false,scenerySolid:false,doubleSided:true,castShadow:false,tex,color,grp:99,nm:name,...extra});
 };
 let springIndex=0;
 SUNSET_WATERFALL_ROUTE.forEach((node,i)=>{
  const {s,y,kind}=node,grp=group(s);
  if(kind==='spring'){
   const next=SUNSET_WATERFALL_ROUTE[i+1],name=`Waterfall spring ${++springIndex}`;
   C.push({t:'trampoline',p:point(s,y),s:[20,.7,28],yaw,speed:waterfallLaunch(next.s-s,next.y-y),amp:1.25,
    tex:'tribal-weave',color:'#795132',grp,nm:name});
   // The hand-built timber follows the exact Carlisle rope anchor footprint.
   for(const u of [-8.45,8.45])beam(`${name} · chunky side frame`,point(s-12.65,y-.55,u),point(s+12.65,y-.55,u),1.6,1.6);
   for(const ds of [-12.65,12.65])beam(`${name} · chunky end frame`,point(s+ds,y-.55,-9.25),point(s+ds,y-.55,9.25),1.6,1.6);
   const bottom=springIndex===1?-34:y-12;
   for(const u of [-8.45,8.45])for(const ds of [-11.6,11.6]){
    beam(`${name} · water pile`,point(s+ds,bottom,u),point(s+ds,y-.3,u),1.15,1.15);
    beam(`${name} · diagonal pile brace`,point(s+ds,bottom+2,u),point(s+ds*.3,y-1,u),.65,.65);
   }
   // Alternating cliff brackets visibly pin the larger assemblies to rock.
   const side=springIndex%2?1:-1;
   for(const ds of [-9,9])beam(`${name} · cliffside support`,point(s+ds,y-8,side*24),point(s+ds,y-1,side*7.5),.9,1.1);
   for(let n=1;n<=5;n++){
    const t=n/6,flight=waterfallFlight(waterfallLaunch(next.s-s,next.y-y)*1.25,next.y-y),time=t*flight;
    let h=0,v=waterfallLaunch(next.s-s,next.y-y)*1.25;
    for(let f=0;f<Math.round(time*60);f++){v=Math.max(-CONST.maxFallSpeed,v-(v>0?TUNING.riseGravity:TUNING.fallGravity)/60);h+=v/60;}
    C.push({t:'wumpa',p:point(s+TUNING.walkSpeed*time,y+h+1),grp,nm:`${name} · flight fruit ${n}`});
   }
  }else{
   const end=kind==='finish'?3066:s+8,start=s-18;
   C.push({t:'platform',p:point((start+end)/2,y-2),s:[25,4,end-start],yaw,tex:'custard-sandstone',color:'#e1c28f',grp,nm:`Waterfall ${kind} landing shelf`});
   prop('custardboulder',(start+end)/2,y-26,0,[33,25.5,end-start+10],18,`Waterfall ${kind} shelf bedrock`);
   if(kind==='rest'){
    C.push({t:'checkpoint',p:point(s,y),grp,nm:`Waterfall terrace ${s===2628?'one':'two'} · safe restart`});
    for(const u of [-7,7])C.push({t:'crate',kind:u<0?'wood':'mystery',p:point(s+6,y,u),grp,nm:'Waterfall terrace supplies'});
   }else C.push({t:'gate',p:point(SUNSET_WATERFALL_FINISH,y),yaw,grp,nm:'Sunset Safari · waterfall run finish'});
  }
 });
 C.push({t:'checkpoint',p:point(2403,-6,-3),grp:96,nm:'Waterfall brink · safe restart'});
 // Preserve the existing first fall. The new basins continue its -28 m pool
 // and connect each lower terrace with one contiguous folding water sheet.
 const terraces=SUNSET_WATERFALL_ROUTE.filter(n=>n.s>2452&&n.kind!=='rest');
 for(let i=0;i<terraces.length;i++){
  const n=terraces[i],prev=i?terraces[i-1]:null,next=terraces[i+1];
  const y=i===0?-28:n.y-8,start=i===0?2461:prev!.s+25,end=next?n.s+15:3090;
  const width=30+3*Math.sin(i*1.8);
  surface(`Waterfall basin ${i+1}`,[[start,y,width],[end,y,width]],'custard-water','#85d7c4',{materialStyle:'jungle-stream',opacity:.98,emissive:'#0a2923',lethal:true});
  surface(`Waterfall submerged bed ${i+1}`,[[start,y-5,width+4],[end,y-5,width+4]],'custard-pool-bed','#62a899');
  const p=point((start+end)/2,y-.35);
  C.push({t:'pit',p,s:[width*2,1,end-start+.2],yaw,invisible:true,grp:99,nm:`Waterfall basin ${i+1} contact reset`});
  if(next){
   const lower=next.y-8;
   surface(`Waterfall descending curtain ${i+1}`,[[end-1,y,width],[end+2,y-1,width-1],[end+7,lower+3,width-2],[end+10,lower,width-1]],'custard-cascade','#acd9c1');
   surface(`Waterfall cascade foam ${i+1}`,[[end+8,lower+.08,width-1],[end+15,lower+.08,width-1]],'custard-foam','#e1f5d7',{opacity:.64});
  }
  // Full-height rock banks are actual closed volumes with inset water edges.
  for(const side of [-1,1]){
   const top=n.y+12+(side<0?5:0),bottom=y-17,centre=(start+end)/2,origin=point(centre,0);
   const profile=[[-3,0],[-2,.34],[1,.52],[3,.55],[6,.84],[11,.96],[21,1],[31,.85],[39,0]];
   const vertices:number[]=[],uvs:number[]=[],indices:number[]=[],rows=6,count=profile.length;
   for(let row=0;row<=rows;row++){
    const station=start-6+(end-start+12)*row/rows,ridge=top+2*Math.sin(station*.087+side),wave=1.5*Math.sin(station*.12+side);
    for(let j=0;j<count;j++){
     const [offset,height]=profile[j],u=side*(width+offset+wave*Math.sin(j*.6)),h=bottom+(ridge-bottom)*height;
     const v=point(station,h,u);vertices.push(v[0]-origin[0],h,v[2]-origin[2]);uvs.push(station/8,(u+h)/8);
     if(row<rows){const a=row*count+j,b=row*count+(j+1)%count,c=(row+1)*count+j,d=(row+1)*count+(j+1)%count;
      if(side>0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);}
    }
   }
   for(const row of [0,rows])for(const triangle of THREE.ShapeUtils.triangulateShape(profile.map(([u,h])=>new THREE.Vector2(u*side,h)),[])){
    const ids=triangle.map(j=>row*count+j),a=new THREE.Vector3().fromArray(vertices,ids[0]*3),b=new THREE.Vector3().fromArray(vertices,ids[1]*3),c=new THREE.Vector3().fromArray(vertices,ids[2]*3);
    const direction=new THREE.Vector3(...point(centre+1,0)).sub(new THREE.Vector3(...point(centre,0))).normalize().multiplyScalar(row===0?-1:1);
    if(b.sub(a).cross(c.sub(a)).dot(direction)<0)ids.reverse();indices.push(...ids);
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
   geom(`Waterfall gorge ${i+1} closed ${side<0?'left':'right'} bank`,origin,g,{tex:'custard-sandstone',color:side<0?'#d4b18b':'#c3ad8c'});
   for(const s of [start+4,end-5]){
    prop('custarderodedcliff',s,y-10,side*(width+7),[32,25,36],side*76,`Waterfall gorge ${i+1} sculpted cliff`);
    prop('coasttree',s,bottom+(top-bottom)*.88-.8,side*(width+7),[17,13,15],s*.63,'Waterfall cliff canopy','#dacb91');
    prop('coastfern',s+3,top-1,side*(width+1),[5,3.5,5],s*.77,'Waterfall rim fern','#c8c794');
   }
  }
 }
 for(let s=2447;s<=3069;s+=8){
  let a:typeof SUNSET_WATERFALL_ROUTE[number]=SUNSET_WATERFALL_ROUTE[0],b:typeof SUNSET_WATERFALL_ROUTE[number]=SUNSET_WATERFALL_ROUTE[SUNSET_WATERFALL_ROUTE.length-1];
  for(let i=1;i<SUNSET_WATERFALL_ROUTE.length;i++)if(s<=SUNSET_WATERFALL_ROUTE[i].s){a=SUNSET_WATERFALL_ROUTE[i-1];b=SUNSET_WATERFALL_ROUTE[i];break;}
  const t=THREE.MathUtils.clamp((s-a.s)/(b.s-a.s),0,1),y=a.y+(b.y-a.y)*t;
  C.push({t:'camnode',p:point(s,y+.8),radius:0,grp:group(s),nm:'Ordered descending waterfall camera'});
 }
 return C;
}
