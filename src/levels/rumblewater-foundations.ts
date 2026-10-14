import {ShapeUtils,Vector2} from 'three';
import type {CustomComponent} from '../level';
import type {CreekSampler} from './custard-terrain';
type P=[number,number,number];
type Scalar=number|((s:number)=>number);
const value=(v:Scalar,s:number)=>typeof v==='function'?v(s):v;

/** A soil embankment follows the outside of the actual transition. It closes
 * the exposed ends below the riding skin and stops at every authored gap. */
export function dressPipeFoundation(C:CustomComponent[],sampler:CreekSampler,
 {a,b,w,rise,offset,arc,group,name}:{a:number;b:number;w:number;rise:number;offset:Scalar;arc:number;group:number;name:string}):void {
 const {point:p,height:h}=sampler,angle=arc*Math.PI/180,edge=rise*Math.sin(angle),lip=rise*(1-Math.cos(angle)),outer=w+edge+2.8;
 const frame=(s:number)=>{
  const before=p(s-.1,0,value(offset,s-.1)),after=p(s+.1,0,value(offset,s+.1)),dx=after[0]-before[0],dz=after[2]-before[2],length=Math.hypot(dx,dz);
  return {nx:-dz/length,nz:dx/length,yaw:Math.atan2(-dx,-dz)*180/Math.PI};
 };
 const at=(s:number,y:number,u:number):P=>{const c=p(s,y,value(offset,s)),f=frame(s);return[c[0]+f.nx*u,y,c[2]+f.nz*u];};
 const xs=[-outer,-w-edge-1.1,-w-edge,-w-edge*.92,-w-edge*.7,-w,0,w,w+edge*.7,w+edge*.92,w+edge,w+edge+1.1,outer];
 const height=(u:number)=>{
  const q=Math.max(0,Math.min(edge,Math.abs(u)-w));
  return rise-Math.sqrt(Math.max(0,rise*rise-q*q))-.42-(Math.abs(u)>w+edge+1.1?.55:0);
 };
 for(let lo=a;lo<b;lo+=48){
  const hi=Math.min(b,lo+48),rows=Math.ceil((hi-lo)/6),origin=p(lo,0),vertices:number[]=[],uvs:number[]=[],indices:number[]=[],stride=xs.length;
  for(let i=0;i<=rows;i++){
   const s=lo+(hi-lo)*i/rows;
   for(const x of xs){const q=at(s,h(s)+height(x),x);vertices.push(q[0]-origin[0],q[1],q[2]-origin[2]);uvs.push(x/4,s/4);}
   for(const x of [-outer,outer]){const q=at(s,h(s)-11,x*.75);vertices.push(q[0]-origin[0],q[1],q[2]-origin[2]);uvs.push(x/4,(h(s)-11)/4);}
  }
  const row=stride+2,quad=(a:number,b:number,c:number,d:number)=>indices.push(a,c,b,b,c,d);
  for(let i=0;i<rows;i++){
   for(let j=0;j<stride-1;j++)quad(i*row+j,(i+1)*row+j,i*row+j+1,(i+1)*row+j+1);
   quad(i*row,i*row+stride,(i+1)*row,(i+1)*row+stride);
   quad(i*row+stride-1,(i+1)*row+stride-1,i*row+stride+1,(i+1)*row+stride+1);
  }
  const outline=[...xs.map(x=>new Vector2(x,height(x))),new Vector2(outer*.75,-11),new Vector2(-outer*.75,-11)];
  const ids=[...xs.map((_,i)=>i),stride+1,stride],faces=ShapeUtils.triangulateShape(outline,[]);
  for(const end of [0,rows]){
   if(end===0&&lo===a||end===rows&&hi===b)continue; // the sculpted roots own exposed cut faces
   for(const face of faces){const triangle=face.map(i=>end*row+ids[i]);if(end===0)triangle.reverse();indices.push(...triangle);}
  }
  C.push({t:'mesh',p:origin,vertices,indices,uvs,tex:'dirt',color:'#a79775',solid:false,doubleSided:true,castShadow:false,edgeGrinding:false,grp:group,nm:name+' · closed earth embankment'});
 }
 const prop=(dkind:CustomComponent['dkind'],s:number,u:number,y:number,size:P,turn=0)=>C.push({t:'decor',dkind,p:at(s,y,u),s:size,yaw:frame(s).yaw+turn,solid:false,scenerySolid:false,grp:91,nm:name+' · rooted '+dkind});
 for(let s=a+1.2,i=0;s<b-.7;s+=9,i++)for(const side of [-1,1]){
  prop(i%3?'coastv2grass':'coastfern',s,side*(outer-1),h(s)+lip-.5,i%3?[2.3,.7,1.6]:[2.4,1.2,2.0],i*71);
  if(i%5===2)prop('coastfoliage',s+1,side*(outer-.8),h(s+1)+lip-.62,[2.8,1.55,2.5],i*43);
 }
 // Meshy eroded roots cover the earthen cut faces below the riding skin.
 // Seat every rock below the lowest bit of pipe over its whole footprint.
 const count=Math.ceil(outer*2/5.6),span=outer*2/count,width=span+.5,rockHeight=Math.max(9.5,width*1.0115),depth=width*.8597;
 for(const end of [a,b])for(let i=0;i<count;i++){
  const u=-outer+(i+.5)*span,inside=end===a?end+depth/2:end-depth/2;
  const top=h(end)+height(Math.max(0,Math.abs(u)-width/2))-.12;
  prop('coastv2ledge',inside,u,top-rockHeight,[width,rockHeight,depth],end===a?180:0);
 }
 for(const s of [a+.8,b-.8])for(const side of [-1,1]){
  prop('coastpillar',s,side*(outer-.15),h(s)-5.7,[1.6,lip+5.4,1.6],0);
  prop('coastfern',s,side*(outer-1.2),h(s)+lip-.48,[2.8,1.3,2.2],side*45);
  prop('bw-hanging-vines',s,side*(outer-.6),h(s)+lip-3,[2.6,2.9,1.3],s===a?0:180);
 }
}

/** Two narrow carved piers stand in broad stone footings. The sphere rests
 * on a sacrificial timber deck; there is no arch intersecting its upper half. */
export function buildBoulderCradle(C:CustomComponent[],sampler:CreekSampler,yaw:(s:number)=>number,s:number,grp:number,name:string):void {
 const {point:p,height:h}=sampler,floor=h(s),turn=yaw(s);
 C.push({t:'crumble',p:p(s,floor+13),s:[24,1.8,5.5],yaw:turn,supports:true,shake:.04,speed:70,tex:'bridge-timber',grp,nm:name+' boulder release cradle'});
 const prop=(dkind:CustomComponent['dkind'],u:number,y:number,size:P)=>C.push({t:'decor',dkind,p:p(s,y,u),s:size,yaw:turn,scenerySolid:false,solid:false,grp,nm:name+' '+dkind});
 for(const side of [-1,1]){
  prop('coastv2buttress',side*12,floor-13,[9,9,10]);
  prop('stonebase',side*11,floor-5.2,[5,2,5]);
  prop('coastpillar',side*11,floor-3.3,[3.2,14.4,3.2]);
  prop('stonecapital',side*11,floor+11.1,[5,.8,5]);
  prop('coastfern',side*13,floor-4.5,[3.2,1.6,2.8]);
 }
}
