import {dressRumblewaterTemple} from './rumblewater-temples';
import type {CustomComponent,CustomGroup} from '../level';
import {buildBoulderCradle} from './rumblewater-foundations';
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
  banks.push(floor);
  const floorParts=[...buildCreekBank(sampler,floor),...buildCreekCollision(sampler,floor)];
  for(const part of floorParts){
    C.push({...part,artProxy:true});
    if(part.t==='mesh'&&!part.invisible)C.push({...part,p:[part.p[0],part.p[1]-.3,part.p[2]],tex:'dirt',solid:false,solidSides:undefined,edgeGrinding:false,nm:name+' earth foundation'});
  }
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
   C.push({t:'mesh',p:p(s),yaw:yaw(s),vertices:m.vertices,indices:m.indices,uvs:m.uvs,solid:true,solidSides:true,doubleSided:true,artProxy:true,tex:'custard-sandstone',color:'#cbb48c',grp,nm:`${name} ${s===entry?'boulder-stop entrance':'exit arch'}`});
  }
  // Collision follows the Meshy temple's flat roof and masonry side walls.
  // The old curved vault would otherwise leave an invisible low ceiling.
  const middle=(entry+exit)/2,first=p(entry),last=p(exit),length=Math.hypot(last[0]-first[0],last[2]-first[2]);
  const roof=meshBuilder();roof.box(-9.4,9.4,10.05,11.25,-length/2,length/2);
  C.push({t:'mesh',p:p(middle),yaw:yaw(middle),vertices:roof.vertices,indices:roof.indices,uvs:roof.uvs,solid:true,solidSides:true,doubleSided:true,artProxy:true,grp,nm:name+' temple roof collider'});
  for(const side of [-1,1]){
    const wall=meshBuilder();wall.box(-1.3,1.3,0,9.2,-(length-2.9)/2,(length-2.9)/2);
    C.push({t:'mesh',p:p(middle,h(middle),side*8.6),yaw:yaw(middle),vertices:wall.vertices,indices:wall.indices,uvs:wall.uvs,solid:true,solidSides:true,artProxy:true,grp,nm:name+' temple wall collider'});
  }
  const ridge=entry+.8;
  C.push({t:'platform',p:p(ridge,h(ridge)+.11),s:[10.5,.22,.9],yaw:yaw(ridge),artProxy:true,edgeGrinding:false,grp,nm:`${name} board-catching threshold`});
  for(let i=-2;i<=2;i++)C.push({t:'decor',dkind:'stonestep',p:p(ridge,h(ridge)-.1,i*2.1),s:[2.1,.315,.735],yaw:yaw(ridge),scenerySolid:false,solid:false,grp,nm:`${name} Meshy trip ridge`});
  C.push({t:'tumblezone',checkpointTrip:true,p:p(entry-.2,h(entry)+5.5),s:[10.8,12,1.4],yaw:yaw(entry),grp,nm:`${name} mandatory board trip`});
  C.push({t:'checkpoint',p:p(checkpoint),grp,nm:`${name} sheltered checkpoint`});
  for(const [s,u,kind]of [[checkpoint-4,-3.5,'wood'],[checkpoint+3,-3.5,'wood'],[checkpoint+5,3.5,'mystery']] as const)
   C.push({t:'crate',p:p(s,h(s),u),kind,grp,nm:`${name} safe supplies`});
  for(const s of [entry+6,exit-6])for(const side of [-1,1])
   C.push({t:'torch',p:p(s,h(s)+2.1,side*7.0),w:.55,rise:2.1,grp,nm:`${name} warm wall torch`});
  dressRumblewaterTemple(C,room,sampler,yaw);
  // A fresh, separate boulder rests on this overhead timber until the player
  // clears the exit. The existing crumble mechanism breaks its cradle.
  buildBoulderCradle(C,sampler,yaw,exit+10,grp,name+' release tower');
 }
}
