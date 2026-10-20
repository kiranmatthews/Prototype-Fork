import type { CustomComponent } from '../level';
import { BILGE_BOWL_LAYOUT as layout, bilgeBowlOutline } from './pirate-bilge-bowl';

type Point = [number, number, number];
type PlanPoint = [number, number];
type Paint = { vertices:number[]; indices:number[]; colors:number[]; vertexIndex:Map<string,number> };
const ivory:Paint={vertices:[],indices:[],colors:[],vertexIndex:new Map()};
const red:Paint={vertices:[],indices:[],colors:[],vertexIndex:new Map()};
const noise=(x:number,z:number)=>{
 const n=Math.sin(x*12.9898+z*78.233)*43758.5453;
 return n-Math.floor(n);
};
const lerp=(a:Point,b:Point,t:number):Point=>a.map((v,i)=>v+(b[i]-v)*t) as Point;
function triangle(paint:Paint,a:Point,b:Point,c:Point):void {
 const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3;
 if(noise(x,z)<.065)return;
 for(const point of [a,b,c]){
  // Shared vertices stay inside the editor mesh budget and keep the snapshot
  // compact. Quantisation is one micrometre, far below the paint's offset.
  const p=point.map(n=>Math.round(n*1e6)/1e6) as Point,key=p.join(',');
  let index=paint.vertexIndex.get(key);
  if(index===undefined){
   index=paint.vertices.length/3;paint.vertexIndex.set(key,index);paint.vertices.push(...p);
   const fade=Math.round((.77+.15*Math.sin(p[0]*.38+p[2]*.21)**2+.08*noise(Math.floor(p[0]*.7),Math.floor(p[2]*.7)))*1e4)/1e4;
   paint.colors.push(fade,fade,fade);
  }
  paint.indices.push(index);
 }
}
function floorTriangle(paint:Paint,a:PlanPoint,b:PlanPoint,c:PlanPoint):void {
 // Every face points up, so translucent paint needs only the visible pass.
 if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)[b,c]=[c,b];
 const size=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(a[0]-c[0],a[1]-c[1]),Math.hypot(b[0]-c[0],b[1]-c[1]));
 const steps=Math.max(1,Math.ceil(size/1.65));
 const at=(i:number,j:number):Point=>[
  a[0]+(b[0]-a[0])*i/steps+(c[0]-a[0])*j/steps,.022,
  -14+a[1]+(b[1]-a[1])*i/steps+(c[1]-a[1])*j/steps,
 ];
 for(let i=0;i<steps;i++)for(let j=0;j<steps-i;j++){
  triangle(paint,at(i,j),at(i,j+1),at(i+1,j));
  if(i+j<steps-1)triangle(paint,at(i+1,j),at(i,j+1),at(i+1,j+1));
 }
}
const polar=(radius:number,angle:number):PlanPoint=>[Math.cos(angle)*radius,Math.sin(angle)*radius];
function ring(paint:Paint,radius:number,width:number):void {
 const count=192;
 for(let i=0;i<count;i++){
  if(noise(i,radius)<.08)continue;
  const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2;
  const edge=(j:number)=>.035*Math.sin(j*2.6)+.02*Math.sin(j*.7);
  const outerA=polar(radius+edge(i),a),outerB=polar(radius+edge(i+1),b);
  const innerA=polar(radius-width+edge(i),a),innerB=polar(radius-width+edge(i+1),b);
  floorTriangle(paint,outerA,innerA,outerB);floorTriangle(paint,outerB,innerA,innerB);
 }
}

// A compass rose is painted onto the open floor, with its long north point
// aimed at the ordinary exit throat. It has no raised edge or collision.
ring(ivory,16.3,.28);ring(red,15.5,.16);ring(ivory,3.4,.24);
for(let i=0;i<8;i++){
 const angle=-Math.PI/2+i*Math.PI/4,reach=i%2?11.4:19.3;
 const tip=polar(reach,angle),base=polar(3.7,angle);
 const left=polar(5.5,angle-.29),right=polar(5.5,angle+.29);
 floorTriangle(ivory,tip,left,base);floorTriangle(red,tip,base,right);
}
// Small cardinal strokes sit outside the rose, without letters or UI arrows.
for(let i=0;i<4;i++){
 const a=-Math.PI/2+i*Math.PI/2;
 floorTriangle(ivory,polar(21,a),polar(20.2,a-.025),polar(20.2,a+.025));
}
// The royal crown at the centre ties the riding floor to the ship's sails.
const crown:PlanPoint[]=[[-2.1,.55],[-2.45,-1.5],[-1.15,-.65],[0,-2.05],[1.15,-.65],[2.45,-1.5],[2.1,.55]];
for(let i=1;i<crown.length-1;i++)floorTriangle(ivory,crown[0],crown[i],crown[i+1]);
floorTriangle(red,[-2.1,.82],[-1.95,1.25],[1.95,1.25]);
floorTriangle(red,[-2.1,.82],[1.95,1.25],[2.1,.82]);

// Interpolate the actual 48-step quarter profile and the authored open spine.
// The two old waterline stripes follow the wall, including rounded corners,
// and stop at both sides of the existing north throat.
const outline=bilgeBowlOutline();
const normals=outline.map((_,i)=>{
 const a=outline[Math.max(0,i-1)],b=outline[Math.min(outline.length-1,i+1)];
 const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
 return [dz/length,-dx/length] as PlanPoint;
});
function profile(height:number):PlanPoint {
 const sample=Math.acos(1-height/layout.radius)*48/(Math.PI/2),i=Math.floor(sample),t=sample-i;
 const at=(step:number):PlanPoint=>[layout.flatHalf+layout.radius*Math.sin(step/48*Math.PI/2),layout.radius*(1-Math.cos(step/48*Math.PI/2))];
 const a=at(i),b=at(i+1);
 return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
function stripe(paint:Paint,low:number,high:number):void {
 const point=(index:number,height:number):Point=>{
  const [offset,y]=profile(height),[nx,nz]=normals[index];
  const angle=Math.acos(1-height/layout.radius);
  return [outline[index][0]+nx*(offset-.025*Math.sin(angle)),y+.025*Math.cos(angle),outline[index][1]+nz*(offset-.025*Math.sin(angle))];
 };
 for(let i=0;i<outline.length-1;i++){
  const a=point(i,low),b=point(i,high),c=point(i+1,low),d=point(i+1,high);
  const steps=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[2]-a[2])/1.25));
  for(let step=0;step<steps;step++){
   if(noise(i+step/steps,low)<.055)continue;
   const t=step/steps,u=(step+1)/steps;
   triangle(paint,lerp(a,c,t),lerp(b,d,u),lerp(b,d,t));
   triangle(paint,lerp(a,c,t),lerp(a,c,u),lerp(b,d,u));
  }
 }
}
stripe(ivory,8.7,9.15);stripe(red,8.22,8.39);

function component(paint:Paint,color:string,label:string):CustomComponent {
 paint.vertexIndex.clear();
 return {t:'mesh',p:[...layout.centre],vertices:paint.vertices,indices:paint.indices,colors:paint.colors,
  solid:false,doubleSided:false,castShadow:false,depthBias:-1,tex:'solid',color,opacity:.62,grp:5,
  nm:`Bilge bowl · nautical floor and wall paint · ${label}`};
}
export const PIRATE_BILGE_PAINT:CustomComponent[]=[
 component(ivory,'#d9c79e','faded ivory'),component(red,'#b46b51','weathered red'),
];
