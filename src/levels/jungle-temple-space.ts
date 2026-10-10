import type { CustomComponent } from '../level';
import { jungleSequelArt } from './jungle-sequel-art';
type P=[number,number,number];
export type TempleVariant=1|2;
export const TEMPLE_TURNS:Record<TempleVariant,readonly (readonly [number,number,number])[]>={
  1:[[-20,0,90],[164,0,-94],[234,70,-94],[252,70,-56],[276,110,-56],[294,130,-94],[438,130,50],[510,58,50]],
  2:[[-20,0,100],[140,0,-60],[250,110,-60],[340,110,30],[354,82,30],[366,82,62],[376,110,62],[384,110,74],[464,30,74],
    [594,121.9239,-17.9239],[694,51.2132,-88.6346],[764,51.2132,-18.6346],
    [790,25.2132,-18.6346],[838,25.2132,29.3654]],
};
export function templeFrame(s:number,variant:TempleVariant){
 const knots=TEMPLE_TURNS[variant];let i=0;while(i<knots.length-2&&s>knots[i+1][0])i++;
 const a=knots[i],b=knots[i+1],length=Math.hypot(b[1]-a[1],b[2]-a[2]),fx=(b[1]-a[1])/length,fz=(b[2]-a[2])/length;
 let x=a[1]+(s-a[0])/(b[0]-a[0])*(b[1]-a[1]),z=a[2]+(s-a[0])/(b[0]-a[0])*(b[2]-a[2]);
 let dx=fx,dz=fz,scale=length/(b[0]-a[0]);
 for(let k=1;k<knots.length-1;k++){
  const q=knots[k];
  const prev=knots[k-1],next=knots[k+1],lp=Math.hypot(q[1]-prev[1],q[2]-prev[2]),ln=Math.hypot(next[1]-q[1],next[2]-q[2]);
  const cornerAngle=Math.abs(Math.atan2((q[1]-prev[1])*(next[2]-q[2])-(q[2]-prev[2])*(next[1]-q[1]),(q[1]-prev[1])*(next[1]-q[1])+(q[2]-prev[2])*(next[2]-q[2])));
  const r=Math.min(Math.max(12,4.7*Math.tan(cornerAngle/2)),lp*.49,ln*.49),before=r*(q[0]-prev[0])/lp,after=r*(next[0]-q[0])/ln;
  if(s<q[0]-before||s>q[0]+after)continue;
  const ux=(q[1]-prev[1])/lp,uz=(q[2]-prev[2])/lp,vx=(next[1]-q[1])/ln,vz=(next[2]-q[2])/ln,t=(s-q[0]+before)/(before+after);
  const ax=q[1]-ux*r,az=q[2]-uz*r;
  const angle=Math.atan2(ux*vz-uz*vx,ux*vx+uz*vz),sign=Math.sign(angle)||1;
  const radius=r/Math.tan(Math.abs(angle)/2),cx=ax-uz*radius*sign,cz=az+ux*radius*sign;
  const theta=Math.atan2(az-cz,ax-cx)+angle*t;
  x=cx+Math.cos(theta)*radius;z=cz+Math.sin(theta)*radius;
  dx=-Math.sin(theta)*sign;dz=Math.cos(theta)*sign;scale=radius*Math.abs(angle)/(before+after);break;
 }
 return {x,z,fx:dx,fz:dz,scale,yaw:Math.atan2(-dz,dx)*180/Math.PI};
}
export function templePoint(s:number,y:number,side:number,variant:TempleVariant):P{
 const f=templeFrame(s,variant);return[f.x-f.fz*side,y,f.z+f.fx*side];
}
export function profileHeight(profile:readonly (readonly [number,number])[],s:number){
 for(let i=1;i<profile.length;i++){const a=profile[i-1],b=profile[i];if(s<=b[0])return a[1]+(b[1]-a[1])*Math.max(0,(s-a[0])/(b[0]-a[0]));}return profile[profile.length-1][1];
}
export function templeSourceHeight(components:readonly CustomComponent[],profile:readonly (readonly [number,number])[],s:number){
 for(const c of components)if(c.t==='vertramp'&&c.vkind==='half'){
  const r=c.rise!,w=c.w!,arc=(c.arc??60)*Math.PI/180,edge=w+r*Math.sin(arc)+(c.deck??0),d=Math.abs(s-c.p[0]);
  if(d<=edge){if(d<=w)return c.p[1];if(d<=w+r*Math.sin(arc))return c.p[1]+r-Math.sqrt(Math.max(0,r*r-(d-w)**2));return c.p[1]+r*(1-Math.cos(arc));}
 }
 for(const c of components)if(c.t==='ramp'){const a=c.p[0]-c.len!/2,b=c.p[0]+c.len!/2;if(s>=a&&s<=b)return c.p[1]+c.rise!*((c.yaw??0)<0?(s-a)/(b-a):(b-s)/(b-a));}
 return profileHeight(profile,s);
}
const SPACE_CACHE=new WeakMap<readonly CustomComponent[],{variant:TempleVariant;profile:readonly (readonly [number,number])[];samples:{s:number;x:number;y:number;z:number}[]}>();
export function templeLocal(p:readonly number[],variant:TempleVariant,source:readonly CustomComponent[],profile:readonly (readonly [number,number])[]):P{
 let entry=SPACE_CACHE.get(source);
 if(!entry||entry.variant!==variant||entry.profile!==profile){
  const samples=[];for(let s=-20;s<=profile[profile.length-1][0];s++){const f=templeFrame(s,variant);samples.push({s,x:f.x,y:templeSourceHeight(source,profile,s),z:f.z});}
  entry={variant,profile,samples};SPACE_CACHE.set(source,entry);
 }
 let best=Infinity,bs=-20;for(const q of entry.samples){const cost=(p[0]-q.x)**2+(p[2]-q.z)**2+(p[1]-q.y)**2*.65;if(cost<best){best=cost;bs=q.s;}}
 const f=templeFrame(bs,variant),along=(p[0]-f.x)*f.fx+(p[2]-f.z)*f.fz;
 return[bs+along/f.scale,p[1],-(p[0]-f.x)*f.fz+(p[2]-f.z)*f.fx];
}
export function makeTempleWorld(source:readonly CustomComponent[],profile:readonly (readonly [number,number])[],variant:TempleVariant):CustomComponent[]{
 const out:CustomComponent[]=[];
 const road=(a:number,b:number,top:(s:number)=>number,width:number,side:number,c:CustomComponent,thin=false)=>{
  const stations=Array.from({length:Math.max(2,Math.ceil(b-a)+1)},(_,i)=>a+(b-a)*i/Math.ceil(b-a));
  const v:number[]=[],ix:number[]=[];
  for(const s of stations){const y=top(s)+.035,f=templeFrame(s,variant);let bottom=thin?y-1.3:-10;
   // Where a later gallery crosses an earlier route, it is an actual open
   // underpass; its masonry cannot fill the lower rider's corridor.
   for(let q=-20;!thin&&q<s-35;q+=3){const prev=templeFrame(q,variant),py=templeSourceHeight(source,profile,q);if(y>py+5&&Math.hypot(f.x-prev.x,f.z-prev.z)<11){bottom=y-1.3;break;}}
   for(const [z,yy]of [[side-width/2,y],[side+width/2,y],[side-width/2,bottom],[side+width/2,bottom]])v.push(...templePoint(s,yy,z,variant));
  }
  for(let i=0;i<stations.length-1;i++){const a=i*4,b=a+4;ix.push(a,a+1,b+1,a,b+1,b,a+2,b+3,a+3,a+2,b+2,b+3,a,b,a+2,a+2,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);}
  const k=(stations.length-1)*4;ix.push(0,2,3,0,3,1,k,k+1,k+3,k,k+3,k+2);
  out.push({t:'mesh',p:[0,0,0],vertices:v,indices:ix,tex:c.outline?'jungle':'dirt',color:c.outline?c.color:'#ecdfbf',outline:c.outline,
   edgeGrinding:c.edgeGrinding,vert:false,grp:c.grp,nm:c.nm});
 };
 for(const c of source){
  if(c.t==='camnode'||c.t==='zone'||c.t==='decor'||(c.t==='wall'&&c.invisible))continue;
  if(c.t==='platform'&&!(c.yaw??0)){
   const [w,h,d]=c.s!,y=c.p[1]+h/2,a=c.p[0]-w/2,b=c.p[0]+w/2;
   road(a,b,()=>y,d,c.p[2],c,Math.abs(y-profileHeight(profile,c.p[0]))>3);continue;
  }
  if(c.t==='ramp'&&Math.abs(c.yaw??0)===90){const a=c.p[0]-c.len!/2,b=c.p[0]+c.len!/2,up=(c.yaw??0)<0;
   road(a,b,s=>c.p[1]+c.rise!*(up?(s-a)/(b-a):(b-s)/(b-a)),c.w!,c.p[2],c);continue;}
  if(c.t==='mesh'&&c.outline&&c.vertices){
   const xs=c.vertices.filter((_,i)=>i%3===0),ys=c.vertices.filter((_,i)=>i%3===1),zs=c.vertices.filter((_,i)=>i%3===2);
   const a=c.p[0]+Math.min(...xs),b=c.p[0]+Math.max(...xs),y=c.p[1]+Math.max(...ys);
   road(a,b,()=>y,Math.max(...zs)-Math.min(...zs),c.p[2]+(Math.max(...zs)+Math.min(...zs))/2,c,true);continue;
  }
  const f=templeFrame(c.p[0],variant),next:CustomComponent={...c,p:templePoint(c.p[0],c.p[1],c.p[2],variant),yaw:(c.yaw??0)+f.yaw};
  if(c.t==='rail'&&c.pts){
   const points=c.pts.map(q=>templePoint(c.p[0]+q[0],c.p[1]+(q[3]??0),c.p[2]+q[1],variant)),p=points[0];
   next.p=p;next.yaw=0;next.pts=points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);
  }
  if(c.t==='gate')next.yaw=90-f.yaw;
  if(c.t==='pit'&&c.s){const [w,,d]=c.s,pts=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>templePoint(c.p[0]+x,c.p[1],c.p[2]+z,variant));
   next.p=[0,c.p[1],0];next.yaw=0;next.pts=pts.map(q=>[q[0],q[2]]);}

  if(c.to)next.to=templePoint(c.to[0],c.to[1],c.to[2],variant);
  out.push(next);
  if(c.t==='vertramp'){
   const edge=c.w!+c.rise!*Math.sin((c.arc??60)*Math.PI/180)+(c.deck??0);
   road(c.p[0]-edge,c.p[0]+edge,()=>c.p[1]-.08,c.len!,0,{t:'platform',p:c.p,grp:1,color:'#8a9c82',tex:'jungle',nm:`${c.nm} excavated temple foundation`});
  }
 }
 const cores=variant===1?[[16,114,-76,70,11.5],[25,103,-62,64,22.5],[25,95,-5,55,34.5]]:
  [[16,96,-44,60,11.5],[22,90,-36,48,23],[26,96,-32,56,34.5],[24,60,-26,16,46],[24,64,-18,14,57.5],[18,70,-18.6346,13.4,69]];
 cores.forEach(([a,b,c,d,y],i)=>{
  const h=11.5,bottom=y-h;
  const pieces=variant===1&&i===1?[[a,76,c,d],[98,b,c,d],[76,98,c,-61],[76,98,-51,d]]:[[a,b,c,d]];
  for(const [left,right,near,far]of pieces)out.push({t:'platform',p:[(left+right)/2,bottom+h/2,(near+far)/2],s:[right-left,h,far-near],color:'#c7c19e',tex:'dirt',grp:7,nm:`Playable temple storey ${i+1}: masonry core and walkable terrace`});
  for(const z of [c,d]){
   out.push({t:'platform',p:[(a+b)/2,y-.27,z],s:[b-a+1.4,.46,1.5],tex:'stone',color:'#e0d4b1',grp:7,nm:'Walkable projecting temple cornice'});
   for(let x=a+4;x<b;x+=8)for(let row=0;row<5;row++)out.push({t:'decor',dkind:(row%2?'wornstoneblock':'stoneblock'),p:[x,bottom+row*2.25,z],s:[7.8,2.15,.5],solid:false,color:row%2?'#c4c3a8':'#d4cab0',grp:90,nm:'Bonded stone face on solid temple wall'});
  }
  for(const x of [a,b]){
   out.push({t:'platform',p:[x,y-.27,(c+d)/2],s:[1.5,.46,d-c+1.4],tex:'stone',color:'#e0d4b1',grp:7,nm:'Walkable projecting temple cornice'});
   for(let z=c+4;z<d;z+=8)for(let row=0;row<5;row++)out.push({t:'decor',dkind:'stoneblock',p:[x,bottom+row*2.25,z],s:[.5,2.15,7.8],solid:false,color:'#cfc5ab',grp:90,nm:'Bonded stone side face on solid temple wall'});
  }
 });
 // Wide solid courts give the rider room to carve and approach the temple
 // puzzles. Their floor is cut around every authored chasm, never over it.
 const holes=source.filter(c=>c.t==='pit'&&c.s).map(c=>{
  const points:P[]=[];for(let x=c.p[0]-c.s![0]/2-.5;x<=c.p[0]+c.s![0]/2+.5;x+=.5)for(const z of [-5,5])points.push(templePoint(x,c.p[1],z,variant));
  return {minX:Math.min(...points.map(p=>p[0]))-1,maxX:Math.max(...points.map(p=>p[0]))+1,minZ:Math.min(...points.map(p=>p[2]))-1,maxZ:Math.max(...points.map(p=>p[2]))+1};
 });
 for(const [s,x,z]of TEMPLE_TURNS[variant].slice(1,-1)){
  const y=templeSourceHeight(source,profile,s);if(Math.abs(templeSourceHeight(source,profile,s-6)-y)>.05||Math.abs(templeSourceHeight(source,profile,s+6)-y)>.05)continue;
  const v:number[]=[],ix:number[]=[];
  for(let dx=-14;dx<14;dx+=2)for(let dz=-14;dz<14;dz+=2){const cx=x+dx+1,cz=z+dz+1;
   if(holes.some(h=>cx>=h.minX&&cx<=h.maxX&&cz>=h.minZ&&cz<=h.maxZ))continue;
   const n=v.length/3;v.push(x+dx,y+.018,z+dz,x+dx,y+.018,z+dz+2,x+dx+2,y+.018,z+dz+2,x+dx+2,y+.018,z+dz);ix.push(n,n+1,n+2,n,n+2,n+3);
  }
  if(ix.length)out.push({t:'mesh',p:[0,0,0],vertices:v,indices:ix,solid:true,tex:'dirt',color:'#d3c8a6',vert:false,grp:7,nm:'Playable temple courtyard: broad carved floor with an open bridge void'});
 }
 for(let s=-20;s<=profile[profile.length-1][0];s+=5){const y=templeSourceHeight(source,profile,s);out.push({t:'camnode',p:templePoint(s,y,0,variant),radius:0,grp:6,nm:'Ordered winding temple camera spine'});}
 out.push(...jungleSequelArt({variant,end:profile[profile.length-1][0],source,
  point:(s,y,side)=>templePoint(s,y,side,variant),height:s=>templeSourceHeight(source,profile,s),frame:s=>templeFrame(s,variant)}));
 return out;
}
