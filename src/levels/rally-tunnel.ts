import type {CustomComponent} from '../level';
import {CART_RALLY_TUNNEL as T,cartRallyFrame,dirtHeight,stadiumBase,stadiumPoint} from './cart-stadium-layout';
type V=[number,number,number];

/** A short excavated service tunnel. The continuous dirt road owns support;
 * the vaulted shell is overhead scenery, with separate physical side guards.
 * No upward-facing roof enters the kart's ground sampler. */
export function rallyTunnel():CustomComponent[]{
 const out:CustomComponent[]=[],steps=24;
 const point=(s:number,u:number,y:number):V=>stadiumPoint(s,u,dirtHeight(s)-stadiumBase(s)+y);
 const arc=(s:number,a:number,r=20,h=16):V=>point(s,Math.cos(a)*r,2+Math.sin(a)*h);
 const surface=(name:string,color:string,tex:string,quads:V[][],glow=false):CustomComponent=>{
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  for(const q of quads){const n=vertices.length/3;for(let i=0;i<4;i++){vertices.push(...q[i]);uvs.push((i%2)*3,Math.floor(i/2)*3);}indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  return {t:'mesh',nm:name,p:[0,0,0],vertices,indices,uvs,color,tex,solid:false,scenerySolid:false,edgeGrinding:false,doubleSided:true,castShadow:!glow};
 };
 for(let s=T.entry;s<T.exit;s+=8){
  const end=Math.min(T.exit,s+8),inner:V[][]=[],earth:V[][]=[];
  for(let i=0;i<steps;i++){
   const a=i*Math.PI/steps,b=(i+1)*Math.PI/steps;
   inner.push([arc(s,a),arc(s,b),arc(end,a),arc(end,b)]);
   earth.push([arc(s,a,31,24),arc(s,b,31,24),arc(end,a,31,24),arc(end,b,31,24)]);
  }
  out.push(surface('Underground tunnel vaulted lining','#554b41','metal',inner));
  out.push(surface('Earth over stadium tunnel','#745438','dirt',earth));
 }
 // Thick rusted ribs and stone portal faces make the enclosure readable in
 // motion. All detail remains authored geometry at every viewing distance.
 for(let s=T.entry;s<=T.exit;s+=16){
  const portal=s===T.entry||s===T.exit,ribs:V[][]=[];
  for(let i=0;i<steps;i++){
   const a=i*Math.PI/steps,b=(i+1)*Math.PI/steps;
   for(const at of [s-.45,s+.45])ribs.push([arc(at,a,19.5,15.5),arc(at,b,19.5,15.5),arc(at,a,portal?31:20.2,portal?24:16.2),arc(at,b,portal?31:20.2,portal?24:16.2)]);
   ribs.push([arc(s-.45,a,19.5,15.5),arc(s-.45,b,19.5,15.5),arc(s+.45,a,19.5,15.5),arc(s+.45,b,19.5,15.5)]);
  }
  out.push(surface(portal?'Buried tunnel portal':'Tunnel reinforcing arch',portal?'#b29669':'#9a6c3b',portal?'dirt':'metal',ribs));
 }
 for(let s=T.entry;s<T.exit;s+=6)for(const side of [-1,1]){
  const at=Math.min(s+3,T.exit-1),f=cartRallyFrame(at),yaw=-Math.atan(f.dx)*180/Math.PI;
  out.push({t:'wall',nm:'Tunnel side contact',p:point(at,side*19.5,-1),s:[1.4,20,6.4],yaw,invisible:true,edgeGrinding:false});
 }
 for(let s=T.entry+8;s<T.exit;s+=24)for(const side of [-1,1]){
  const p=point(s,side*14.5,10.7),f=cartRallyFrame(s),lens:V[][]=[];
  // Warm caged fluorescent strips, aimed into the lane by the existing
  // bounded stadium light pool rather than adding dozens of shadow lights.
  const local=(u:number,y:number,v:number):V=>[p[0]+u*f.nx+v*f.nz,p[1]+y,p[2]+u*f.nz-v*f.nx];
  lens.push([local(-.18,0,-1.6),local(.18,0,-1.6),local(-.18,0,1.6),local(.18,0,1.6)]);
  const lamp=surface('Tunnel worklight','#ffe3a3','rally-lamp',lens,true);
  // Positions above are already in world coordinates; the light anchor needs
  // the same real location without translating the render vertices twice.
  lamp.vertices=lamp.vertices!.map((v,i)=>v-p[i%3]);lamp.p=p;lamp.rise=0;lamp.amp=1600;lamp.radius=48;lamp.to=point(s+3,0,0);lamp.emissive='#ffce7c';out.push(lamp);
  const halo=surface('Tunnel worklight glow','#ffe3a3','rally-lamp-glow',[[local(-1,0,-2),local(1,0,-2),local(-1,0,2),local(1,0,2)]],true);
  halo.uvs=[0,0,1,0,0,1,1,1];out.push(halo);
 }
 return out;
}
