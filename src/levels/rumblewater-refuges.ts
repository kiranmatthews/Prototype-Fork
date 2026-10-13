import type {CustomComponent,CustomGroup} from '../level';
import {CARLISLE_ASSETS} from '../carlisleAssets';
import {buildCreekBank,buildCreekCollision,type CreekBank,type CreekSampler} from './custard-terrain';
type P=[number,number,number];
export const RUMBLEWATER_REFUGES=[
 {entry:310,checkpoint:324,exit:340,name:'Mossgate refuge'},
 {entry:722,checkpoint:739,exit:756,name:'Old mill culvert'},
 {entry:1166,checkpoint:1178,exit:1190,name:'Sluice vault'},
 {entry:1656,checkpoint:1668,exit:1682,name:'Roofstone shelter'},
 {entry:2002,checkpoint:2016,exit:2030,name:'Quarry gatehouse'},
 {entry:2474,checkpoint:2485,exit:2500,name:'Crown watch'},
].map((room,i)=>({...room,grp:110+i}));
export const RUMBLEWATER_REFUGE_GROUPS:CustomGroup[]=RUMBLEWATER_REFUGES.map(r=>({id:r.grp,nm:r.name,editorOnly:true}));

/** Replace ordinary banks/pipes only within the sheltered footprints. */
export function outsideRefuges(a:number,b:number):[number,number][] {
 let spans:[number,number][]=[[a,b]];
 for(const room of RUMBLEWATER_REFUGES)spans=spans.flatMap(([lo,hi])=>{
  if(hi<=room.entry||lo>=room.exit)return[[lo,hi]] as [number,number][];
  const result:[number,number][]=[];if(lo<room.entry)result.push([lo,room.entry]);if(hi>room.exit)result.push([room.exit,hi]);return result;
 });return spans;
}
function meshBuilder(){
 const vertices:number[]=[],uvs:number[]=[],indices:number[]=[],shared=new Map<string,number>();
 const quad=(a:P,b:P,c:P,d:P)=>{
  const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
  const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]].map(Math.abs);
  const axis=normal.indexOf(Math.max(...normal)),ids:number[]=[];
  for(const v of [a,b,c,d]){
   const uv=axis===0?[v[2]/3,v[1]/3]:axis===1?[v[0]/3,v[2]/3]:[v[0]/3,v[1]/3];
   const key=[...v,...uv].map(n=>n.toFixed(5)).join(',');let id=shared.get(key);
   if(id===undefined){id=vertices.length/3;vertices.push(...v);uvs.push(...uv);shared.set(key,id);}ids.push(id);
  }
  indices.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);
 };
 const box=(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number)=>{
  quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);
  quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]);
  quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]);
  quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);
  quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]);
  quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]);
 };
 return{vertices,uvs,indices,quad,box};
}
export function buildRumblewaterRefuges(C:CustomComponent[],sampler:CreekSampler,yaw:(s:number)=>number,banks:CreekBank[]):void {
 const {point:p,height:h}=sampler;
 for(const room of RUMBLEWATER_REFUGES){
  const {entry,exit,checkpoint,grp,name}=room;
  const floor:CreekBank={a:entry,b:exit,width:18,offset:0,top:h,minHalf:8.8,turf:false,name:`${name} floor`,group:grp};
  banks.push(floor);C.push(...buildCreekBank(sampler,floor),...buildCreekCollision(sampler,floor));
  for(const s of [entry,exit]){
   const m=meshBuilder(),front=1.5,back=-1.5;
   const at=(radius:number,t:number,z:number):P=>[Math.cos(t)*radius,3+Math.sin(t)*radius,z];
   for(let i=0;i<16;i++){
    const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
    m.quad(at(9,a,front),at(9,b,front),at(5.2,b,front),at(5.2,a,front));
    m.quad(at(5.2,a,back),at(5.2,b,back),at(9,b,back),at(9,a,back));
    m.quad(at(9,a,front),at(9,a,back),at(9,b,back),at(9,b,front));
    m.quad(at(5.2,a,front),at(5.2,b,front),at(5.2,b,back),at(5.2,a,back));
   }
   for(const t of [0,Math.PI])m.quad(at(5.2,t,front),at(5.2,t,back),at(9,t,back),at(9,t,front));
   m.box(-9,-5.2,0,3,back,front);m.box(5.2,9,0,3,back,front);
   C.push({t:'mesh',p:p(s),yaw:yaw(s),vertices:m.vertices,indices:m.indices,uvs:m.uvs,solid:true,solidSides:true,doubleSided:true,tex:'custard-sandstone',color:'#cbb48c',grp,nm:`${name} ${s===entry?'boulder-stop entrance':'exit arch'}`});
  }
  // A real closed stone vault. Its clear ceiling and the scoped cave camera
  // leave the rider visible while the opening remains smaller than the sphere.
  const roof=meshBuilder(),origin=p(entry),steps=Math.ceil((exit-entry)/8);
  const roofAt=(s:number,r:number,t:number):P=>{const q=p(s,h(s)+1.2+Math.sin(t)*r,Math.cos(t)*r);return[q[0]-origin[0],q[1]-origin[1],q[2]-origin[2]];};
  for(let j=0;j<steps;j++){
   const a=entry+(exit-entry)*j/steps,b=entry+(exit-entry)*(j+1)/steps;
   for(let i=0;i<16;i++){
    const t=i*Math.PI/16,u=(i+1)*Math.PI/16;
    roof.quad(roofAt(a,8.2,t),roofAt(a,8.2,u),roofAt(b,8.2,u),roofAt(b,8.2,t));
    roof.quad(roofAt(a,9.8,t),roofAt(b,9.8,t),roofAt(b,9.8,u),roofAt(a,9.8,u));
    if(j===0)roof.quad(roofAt(a,8.2,t),roofAt(a,9.8,t),roofAt(a,9.8,u),roofAt(a,8.2,u));
    if(j===steps-1)roof.quad(roofAt(b,8.2,u),roofAt(b,9.8,u),roofAt(b,9.8,t),roofAt(b,8.2,t));
   }
   for(const side of [-1,1]){
    const s=(a+b)/2;
    const wall=meshBuilder();wall.box(-1.1,1.1,0,2.2,-(b-a+.3)/2,(b-a+.3)/2);
    C.push({t:'mesh',p:p(s,h(s)-.2,side*9),vertices:wall.vertices,indices:wall.indices,uvs:wall.uvs,yaw:yaw(s),solid:true,solidSides:true,tex:'custard-sandstone',color:'#b29d7b',grp,nm:`${name} enclosed wall`});
   }
  }
  C.push({t:'mesh',p:origin,vertices:roof.vertices,indices:roof.indices,uvs:roof.uvs,solid:true,solidSides:true,doubleSided:true,tex:'custard-sandstone',color:'#bda880',grp,nm:`${name} vaulted roof`});
  C.push({t:'checkpoint',p:p(checkpoint),grp,nm:`${name} sheltered checkpoint`});
  for(const [s,u,kind]of [[checkpoint-4,-3.5,'wood'],[checkpoint+3,-3.5,'wood'],[checkpoint+5,3.5,'mystery']] as const)
   C.push({t:'crate',p:p(s,h(s),u),kind,grp,nm:`${name} safe supplies`});
  for(const s of [entry+6,exit-6])for(const side of [-1,1])
   C.push({t:'torch',p:p(s,h(s)+2.1,side*6.5),w:.55,rise:2.1,grp,nm:`${name} warm wall torch`});
  // A fresh, separate boulder rests on this overhead timber until the player
  // clears the exit. The existing crumble mechanism breaks its cradle.
  const launch=exit+10;
  C.push({t:'crumble',p:p(launch,h(launch)+13),s:[19,.7,5],yaw:yaw(launch),shake:.04,speed:70,tex:'bridge-timber',grp,nm:`${name} boulder release cradle`});
  const asset=CARLISLE_ASSETS.coastpillar,k=25/asset.size[1];
  for(const side of [-1,1])C.push({t:'decor',dkind:'coastpillar',p:p(launch,h(launch)-11,side*11),s:asset.size.map(v=>v*k) as P,yaw:yaw(launch),solid:false,scenerySolid:false,grp,nm:`${name} overhead release pier`});
 }
}
