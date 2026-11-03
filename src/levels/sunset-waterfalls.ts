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
 {s:2452,y:-10,u:0,w:20,d:28,kind:'spring'},
 {s:2488,y:-20,u:10,w:16,d:22,kind:'spring'},
 {s:2520,y:-13,u:-12,w:12,d:18,kind:'spring'},
 {s:2552,y:-20,u:14,w:11,d:16,kind:'spring'},
 {s:2586,y:-43,u:-9,w:18,d:24,kind:'spring'},
 {s:2620,y:-52,u:0,kind:'rest'},
 {s:2642,y:-65,u:0,w:20,d:28,kind:'spring'},
 {s:2680,y:-80,u:-14,w:14,d:20,kind:'spring'},
 {s:2712,y:-70,u:12,w:12,d:18,kind:'spring'},
 {s:2744,y:-87,u:18,w:10,d:16,kind:'spring'},
 {s:2778,y:-111,u:-12,w:17,d:22,kind:'spring'},
 {s:2810,y:-122,u:0,kind:'rest'},
 {s:2832,y:-135,u:0,w:22,d:28,kind:'spring'},
 {s:2868,y:-147,u:-14,w:13,d:18,kind:'spring'},
 {s:2898,y:-138,u:8,w:11,d:16,kind:'spring'},
 {s:2932,y:-155,u:-17,w:10,d:15,kind:'spring'},
 {s:2966,y:-175,u:12,w:16,d:22,kind:'spring'},
 {s:3000,y:-190,u:0,kind:'rest'},
 {s:3022,y:-203,u:0,w:20,d:28,kind:'spring'},
 {s:3058,y:-216,u:16,w:12,d:18,kind:'spring'},
 {s:3090,y:-208,u:-13,w:10,d:15,kind:'spring'},
 {s:3124,y:-229,u:10,w:14,d:20,kind:'spring'},
 {s:3160,y:-248,u:-11,w:18,d:26,kind:'spring'},
 {s:3198,y:-264,u:0,kind:'finish'},
] as const;
export const SUNSET_WATERFALL_FINISH=3222;
// Water elevations are independent of the nets. Long quiet reaches allow
// low, high and uphill landings over the same pool between the major falls.
export const SUNSET_WATERFALL_POOLS=[
 {start:2461,end:2562,y:-28}, {start:2574,end:2626,y:-66},
 {start:2636,end:2756,y:-96}, {start:2770,end:2816,y:-136},
 {start:2826,end:2944,y:-164}, {start:2958,end:3006,y:-204},
 {start:3016,end:3136,y:-238}, {start:3150,end:3260,y:-278},
] as const;
export function waterfallWaterY(s:number):number {
 for(let i=0;i<SUNSET_WATERFALL_POOLS.length;i++){
  const pool=SUNSET_WATERFALL_POOLS[i],next=SUNSET_WATERFALL_POOLS[i+1];
  if(s<=pool.end||!next)return pool.y;
  if(s<next.start)return THREE.MathUtils.lerp(pool.y,next.y,(s-pool.end)/(next.start-pool.end));
 }
 return SUNSET_WATERFALL_POOLS[SUNSET_WATERFALL_POOLS.length-1].y;
}
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
export function waterfallLaunch(distance:number,drop:number,entryDepth=28):number {
 let lo=0,hi=150;
 // Budget for diagonal air control and entry near the previous net's rim.
 // Held Jump leaves time to line up a small receiver, using native braking
 // and sidesteps; there is no target attraction or authored air velocity.
 for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(waterfallFlight(mid*1.25,drop)*TUNING.walkSpeed*.82<distance+entryDepth*.365+3)lo=mid;else hi=mid;}
 return q(hi);
}

/** Twenty native springs across a 784 m gorge, three checkpoint ledges and
 * eight water terraces. Simple frames and supports remain authored meshes. */
export function buildSunsetWaterfalls(course:Course):CustomComponent[]{
 const C:CustomComponent[]=[],yaw=course.yaw(2430);
 const group=(s:number)=>s<2630?96:s<3000?97:98;
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
  const {s,y,u,kind}=node,grp=group(s);
  if(kind==='spring'){
   const next=SUNSET_WATERFALL_ROUTE[i+1],name=`Waterfall spring ${++springIndex}`;
   const distance=Math.hypot(next.s-s,next.u-u),launch=waterfallLaunch(distance,next.y-y,node.d);
   const {w,d}=node,frameU=w*.4225,frameS=d*.451786,pileS=d*.414286,timber=Math.min(1.6,Math.max(.9,w*.08));
   C.push({t:'trampoline',p:point(s,y,u),s:[w,.7,d],yaw,speed:launch,amp:1.25,
    tex:'tribal-weave',color:'#795132',grp,nm:name});
   // The hand-built timber follows the exact Carlisle rope anchor footprint.
   for(const du of [-frameU,frameU])beam(`${name} · chunky side frame`,point(s-frameS,y-.55,u+du),point(s+frameS,y-.55,u+du),timber,timber);
   for(const ds of [-frameS,frameS])beam(`${name} · chunky end frame`,point(s+ds,y-.55,u-frameU-timber/2),point(s+ds,y-.55,u+frameU+timber/2),timber,timber);
   for(const du of [-frameU,frameU])for(const ds of [-pileS,pileS]){
    const bottom=waterfallWaterY(s+ds)-6;
    beam(`${name} · water pile`,point(s+ds,bottom,u+du),point(s+ds,y-.3,u+du),timber*.72,timber*.72);
    beam(`${name} · diagonal pile brace`,point(s+ds,bottom+2,u+du),point(s+ds*.3,y-1,u+du),.65,.65);
   }
   // Alternating cliff brackets visibly pin the larger assemblies to rock.
   const side=Math.sign(u)||(springIndex%2?1:-1);
   for(const ds of [-pileS*.75,pileS*.75])beam(`${name} · cliffside support`,point(s+ds,y-8,side*42),point(s+ds,y-1,u+side*frameU),.9,1.1);
   for(let n=1;n<=5;n++){
    const t=n/6,flight=waterfallFlight(launch*1.25,next.y-y),time=t*flight;
    let h=0,v=launch*1.25;
    for(let f=0;f<Math.round(time*60);f++){v=Math.max(-CONST.maxFallSpeed,v-(v>0?TUNING.riseGravity:TUNING.fallGravity)/60);h+=v/60;}
    C.push({t:'wumpa',p:point(s+(next.s-s)*t,y+h+1,u+(next.u-u)*t),grp,nm:`${name} · flight fruit ${n}`});
   }
  }else{
   const end=kind==='finish'?SUNSET_WATERFALL_FINISH+18:s+8,start=s-18;
   C.push({t:'platform',p:point((start+end)/2,y-2),s:[25,4,end-start],yaw,tex:'custard-sandstone',color:'#e1c28f',grp,nm:`Waterfall ${kind} landing shelf`});
   prop('custardboulder',(start+end)/2,y-26,0,[33,25.5,end-start+10],18,`Waterfall ${kind} shelf bedrock`);
   if(kind==='rest'){
    C.push({t:'checkpoint',p:point(s,y),grp,nm:`Waterfall terrace ${s} · safe restart`});
    for(const u of [-7,7])C.push({t:'crate',kind:u<0?'wood':'mystery',p:point(s+6,y,u),grp,nm:'Waterfall terrace supplies'});
   }else C.push({t:'gate',p:point(SUNSET_WATERFALL_FINISH,y),yaw,grp,nm:'Sunset Safari · waterfall run finish'});
  }
 });
 C.push({t:'checkpoint',p:point(2403,-6,-3),grp:96,nm:'Waterfall brink · safe restart'});
 // Preserve the existing first fall. The new basins continue its -28 m pool
 // and connect each lower terrace with one contiguous folding water sheet.
 for(let i=0;i<SUNSET_WATERFALL_POOLS.length;i++){
  const {start,end,y}=SUNSET_WATERFALL_POOLS[i],next=SUNSET_WATERFALL_POOLS[i+1];
  const width=34+2*Math.sin(i*1.8);
  surface(`Waterfall basin ${i+1}`,[[start,y,width],[end,y,width]],'custard-water','#85d7c4',{materialStyle:'jungle-stream',opacity:.98,emissive:'#0a2923',lethal:true});
  surface(`Waterfall submerged bed ${i+1}`,[[start,y-5,width+4],[end,y-5,width+4]],'custard-pool-bed','#62a899');
  const p=point((start+end)/2,y-.35);
  C.push({t:'pit',p,s:[width*2,1,end-start+.2],yaw,invisible:true,grp:99,nm:`Waterfall basin ${i+1} contact reset`});
  if(next){
   const lower=next.y,nextWidth=34+2*Math.sin((i+1)*1.8);
   surface(`Waterfall descending curtain ${i+1}`,[[end,y,width],[end+2,y-1,width],[next.start-3,lower+3,nextWidth],[next.start,lower,nextWidth]],'custard-cascade','#acd9c1');
   surface(`Waterfall cascade foam ${i+1}`,[[next.start,lower+.08,nextWidth],[next.start+9,lower+.08,nextWidth]],'custard-foam','#e1f5d7',{opacity:.64});
  }
  // Full-height rock banks are actual closed volumes with inset water edges.
  for(const side of [-1,1]){
   const top=y+48+(side<0?5:0),bottom=y-17,centre=(start+end)/2,origin=point(centre,0);
   const profile=[[-3,0],[-2,.34],[1,.52],[3,.55],[6,.84],[11,.96],[21,1],[31,.85],[39,0]];
   const vertices:number[]=[],uvs:number[]=[],indices:number[]=[],rows=6,count=profile.length;
   for(let row=0;row<=rows;row++){
    const station=start-8+(end-start+16)*row/rows,ridge=top+2*Math.sin(station*.087+side),wave=1.5*Math.sin(station*.12+side);
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
 for(let s=2447;s<=SUNSET_WATERFALL_FINISH+24;s+=5){
  let a:typeof SUNSET_WATERFALL_ROUTE[number]=SUNSET_WATERFALL_ROUTE[0],b:typeof SUNSET_WATERFALL_ROUTE[number]=SUNSET_WATERFALL_ROUTE[SUNSET_WATERFALL_ROUTE.length-1];
  for(let i=1;i<SUNSET_WATERFALL_ROUTE.length;i++)if(s<=SUNSET_WATERFALL_ROUTE[i].s){a=SUNSET_WATERFALL_ROUTE[i-1];b=SUNSET_WATERFALL_ROUTE[i];break;}
  const t=THREE.MathUtils.clamp((s-a.s)/(b.s-a.s),0,1),y=a.y+(b.y-a.y)*t;
  // Keep the river's forward axis steady through the airborne zigzags. The
  // player chooses each side transfer while Carlisle's launch shot reveals it.
  C.push({t:'camnode',p:point(s,y+.8),radius:0,grp:group(s),nm:'Ordered descending waterfall camera'});
 }
 return C;
}
