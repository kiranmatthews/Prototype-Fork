import type {CustomComponent,CustomGroup} from '../level';
import type {RooftopRoof} from './codex-lab';
import {ROOFTOP_KOOK_ASSETS} from '../rooftopKookAssets';
import {COASTAL_TOWN_ASSETS} from '../coastalTownAssets';
import {COUNTRY_CLUB_ASSETS} from '../countryClubAssets';

type P=[number,number,number];
type District={index:number;a:number;b:number;first:number;last:number;name:string;roof:string;body:string;accent:string};
interface Context {
 roofs:RooftopRoof[];districts:District[];length:number;
 world:(s:number,y:number,u?:number)=>P;yaw:(s:number)=>number;
 surface:(r:RooftopRoof,s:number,u?:number)=>number;branch:(s:number,route:number)=>number;
 width:(r:RooftopRoof,s:number)=>number;
 blocked:(r:RooftopRoof,s:number,u:number,w?:number,depth?:number)=>boolean;
}
const IVORY='#fff3db',GOLD='#e5b850',TEAL='#438e99';
const assets={...ROOFTOP_KOOK_ASSETS,...COASTAL_TOWN_ASSETS,...COUNTRY_CLUB_ASSETS};
const round=(x:number)=>Math.round(x*10000)/10000;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const cubeFaces=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]];

/** Scenery is kept below the missed-roof reset volumes or outside the riding
 * corridor. The original collision components continue to own every transfer. */
export function dressKookRooftops(components:CustomComponent[],groups:CustomGroup[],c:Context){
 const batches=new Map<string,{p:P;vertices:number[];indices:number[];colors:number[];uvs:number[];tex:string;grp:number}>();
 for(const d of c.districts)groups.push({id:450+d.index,nm:`${d.name} / coastal architecture and gardens`,editorOnly:true});
 const face=(d:number,pts:P[],color:string,tex='solid',uv?:number[])=>{
  const key=`${d}:${tex}`;
  if(!batches.has(key))batches.set(key,{p:c.world(c.districts[d].a,0),vertices:[],indices:[],colors:[],uvs:[],tex,grp:450+d});
  const b=batches.get(key)!,base=b.vertices.length/3,rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
  const w=Math.hypot(...pts[1].map((v,i)=>v-pts[0][i]))/4,h=Math.hypot(...pts[pts.length-1].map((v,i)=>v-pts[0][i]))/4;
  const uvs=uv??[0,0,w,0,w,h,0,h];
  pts.forEach((p,i)=>{b.vertices.push(...p.map((v,j)=>round(v-b.p[j])));b.colors.push(...rgb);b.uvs.push(uvs[i*2],uvs[i*2+1]);});
  for(let i=1;i<pts.length-1;i++)b.indices.push(base,base+i,base+i+1);
 };
 const cuboid=(d:number,pts:P[],color:string,tex='solid')=>cubeFaces.forEach(f=>face(d,f.map(i=>pts[i]),color,tex));
 const box=(d:number,p:P,s:P,color:string,yaw=0,tex='solid')=>{
  const a=yaw*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
  cuboid(d,[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([x,y,z])=>
   [p[0]+cs*x*s[0]/2+sn*z*s[2]/2,p[1]+y*s[1]/2,p[2]-sn*x*s[0]/2+cs*z*s[2]/2] as P),color,tex);
 };
 const beam=(d:number,a:P,b:P,width:number,height:number,color:string)=>{
  const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,rx=dz/len*width/2,rz=-dx/len*width/2;
  cuboid(d,[[a[0]-rx,a[1]-height/2,a[2]-rz],[a[0]+rx,a[1]-height/2,a[2]+rz],
   [a[0]+rx,a[1]+height/2,a[2]+rz],[a[0]-rx,a[1]+height/2,a[2]-rz],
   [b[0]-rx,b[1]-height/2,b[2]-rz],[b[0]+rx,b[1]-height/2,b[2]+rz],
   [b[0]+rx,b[1]+height/2,b[2]+rz],[b[0]-rx,b[1]+height/2,b[2]-rz]],color);
 };
 const asset=(kind:keyof typeof assets,p:P,scale:number,yaw:number,d:number,extra:Partial<CustomComponent>={})=>{
  components.push({t:'decor',dkind:kind,p:p.map(round) as P,s:assets[kind].size.map(x=>round(x*scale)) as P,
   yaw:round(yaw),grp:450+d,solid:false,scenerySolid:false,edgeGrinding:false,nm:assets[kind].label,...extra});
 };
 const roofPoint=(r:RooftopRoof,s:number,u:number,y:number)=>c.world(s,y,c.branch(s,r.route)+u);
 const main=c.roofs.filter(r=>r.route<0);
 const roofAt=(s:number)=>main.find(r=>s<=r.b)??main[main.length-1];

 // Neighbouring upper stories emerge above the fog. There is deliberately
 // no ground, road, shoreline, pool or water surface beneath this roof course.
 const skylineY=(s:number)=>roofAt(Math.max(0,Math.min(c.length,s))).top-18;


 for(const r of c.roofs){
  const d=r.district,mid=(r.a+r.b)/2,yaw=c.yaw(mid);
  // Continuous white fascia follows the actual roof contour and pitched lips.
  for(const side of [-1,1])for(let s=r.a;s<r.b-.01;s+=6){
   const end=Math.min(r.b,s+6),u0=side*(c.width(r,s)/2+.10),u1=side*(c.width(r,end)/2+.10);
   for(const [drop,thick] of [[.28,.55],[1.1,.28]])beam(d,roofPoint(r,s,u0,c.surface(r,s,u0)-drop),roofPoint(r,end,u1,c.surface(r,end,u1)-drop),.46,thick,IVORY);
   if(r.route<0)for(const drop of [6.8,13.2])beam(d,roofPoint(r,s,u0,r.top-drop),roofPoint(r,end,u1,r.top-drop),.32,.22,IVORY);
  }
  for(const s of [r.a,r.b])for(const side of [-1,1]){
   const u=side*c.width(r,s)/2;
   beam(d,roofPoint(r,s,0,c.surface(r,s,0)-.3),roofPoint(r,s,u,c.surface(r,s,u)-.3),.5,.55,IVORY);
  }
  // Separate Meshy shutter windows, balconies and hanging flower boxes.
  if(r.route<0){
   for(let s=r.a+6;s<r.b-4;s+=10)for(const side of [-1,1]){
    const u=side*(c.width(r,s)/2+.24),angle=c.yaw(s)+side*90;
    for(const drop of [5.2,11.5])asset('baywindow',roofPoint(r,s,u,r.top-drop),1.15,angle,d,{castShadow:false});
    if(Math.round((s-r.a)/10)%2===0)asset('baybox',roofPoint(r,s,u+side*.22,r.top-5.65),1.05,angle,d,{castShadow:false});
   }
   for(let u=-c.width(r,r.a)/2+4;u<c.width(r,r.a)/2-2;u+=6){
    asset('baywindow',roofPoint(r,r.a-.23,u,r.top-5.5),1.2,c.yaw(r.a),d,{castShadow:false});
    if(r.index%2===0)asset('bayawning',roofPoint(r,r.a-.8,u,r.top-6.0),.88,c.yaw(r.a),d,{castShadow:false});
   }
   if(r.index%3===0)for(const side of [-1,1])asset('baybalcony',roofPoint(r,mid,side*(c.width(r,mid)/2+.85),r.top-7.2),1.4,yaw+side*90,d);
  }
  if(['terrace','garden','court'].includes(r.kind)&&r.width>18)for(const side of [-1,1]){
   const u=side*(r.width/2-3.2);
   if(c.blocked(r,mid,u,3.4,6))continue;
   asset('kookhydrangea',roofPoint(r,mid,u,c.surface(r,mid,u)+.02),1,yaw+90,d,{s:[5.8,2.3,3.15]});
  }
  // Lanterns and potted flowers frame the atrium galleries. Keep these on
  // the outside margin: the curved skating line and the void stay readable.
  if(r.kind==='atrium'){
   const neck=Math.min(24,r.depth*.28);
   for(const side of [-1,1])for(const s of [r.a+neck+3,r.b-neck-3]){
    const u=side*(r.width/2-1);
    if(c.blocked(r,s,u,2.2,4))continue;
    asset('baylamp',roofPoint(r,s,u,r.top),.72,c.yaw(s)+side*90,d);
    asset('baypot',roofPoint(r,s+1.7,u,r.top),.7,c.yaw(s)+side*35,d);
   }
  }
  if(r.kind==='slalom')for(const [t,side] of [[.32,-1],[.68,1]]){
   const s=r.a+r.depth*t,u=side*r.width*.2;
   if(!c.blocked(r,s,u,r.width*.38,4))asset('kookhydrangea',roofPoint(r,s,u,r.top+.1),1,c.yaw(s),d,{s:[r.width*.36,2.5,3.3]});
  }
  // Service housings retain their authored collider. Metal caps, raised seams
  // and inset louvres replace the conspicuous untextured prototype blocks.
  if(r.kind==='works'&&r.width>17){
   const u=r.width/2-3,y=c.surface(r,mid,u),w=3,h=2,depth=8;
   box(d,roofPoint(r,mid,u,y+h+.045),[w+.16,.14,depth+.16],'#4a6067',yaw,'kook-metal');
   box(d,roofPoint(r,mid,u,y+.12),[w+.10,.24,depth+.10],'#e1ddd1',yaw);
   for(const side of [-1,1]){
    const p=roofPoint(r,mid,u+side*(w/2+.012),y+1.1);
    box(d,p,[.025,1.38,depth-1.1],'#273e46',yaw);
    for(let height=.48;height<1.8;height+=.17)box(d,roofPoint(r,mid,u+side*(w/2+.035),y+height),[.06,.055,depth-1.15],'#aabbb8',yaw);
    for(const station of [mid-depth/2+.4,mid+depth/2-.4])box(d,roofPoint(r,station,u+side*(w/2+.05),y+1.1),[.075,1.5,.08],'#c6c5b5',yaw);
   }
  }
  if(r.route<0&&r.shape!=='flat'&&r.width>=18)for(const side of [-1,1]){
   const s=r.a+r.depth*(side<0?.32:.65),u=side*(c.width(r,s)/2-1.4);
   if(!c.blocked(r,s,u,5.5,6))asset('kookdormer',roofPoint(r,s,u,c.surface(r,s,u)-.7),1.05,c.yaw(s)+side*90,d,{scenerySolid:false});
  }

  // Relaxed side terraces occupy the established wide roof margins only.
  if(r.route<0&&r.width>=24&&r.shape==='flat'&&!['atrium','slalom','crumble'].includes(r.kind)){
   const s=r.a+13,side=r.index%2?-1:1,u=side*(r.width/2-4);
   if(!c.blocked(r,s,u,6.2,6))asset('kookterrace',roofPoint(r,s,u,c.surface(r,s,u)),.9,c.yaw(s)+side*35,d,{scenerySolid:false});
   if(r.index%2===0)asset('bayvine',roofPoint(r,r.a+6,-r.width/2-.3,r.top-3.5),1.15,c.yaw(r.a+6)-90,d,{castShadow:false});
  }
  // Belvederes sit on upper-story outriggers, outside both roof routes.
  if(r.route<0&&(r.kind==='tower'||r.index===c.districts[d].first)){
   const side=r.index%2?-1:1,u=side*(r.width/2+9);
   if(!c.blocked(r,mid,u,8,9)){
    box(d,c.world(mid,r.top-8,u),[7.3,16,7.3],c.districts[d].body,yaw,'kook-cedar');
    box(d,c.world(mid,r.top+.05,u),[8.2,.6,8.2],IVORY,yaw);
    asset('kookcupola',c.world(mid,r.top+.35,u),1.32,yaw,d);
   }
  }
  if(r.route>=0){
   // The optional line is marked by its turquoise roof and a small coastal
   // lantern where it separates. Nothing spans the player's camera lane.
   if(!c.roofs.some(previous=>previous.route===r.route&&previous.a<r.a)){
    const s=r.a+Math.min(30,r.depth*.6),side=c.branch(s,r.route)<0?-1:1;
    asset('baylamp',roofPoint(r,s,side*(c.width(r,s)/2-.55),c.surface(r,s)),.66,c.yaw(s),d);
   }
   continue;
  }
  // Homes and trees are true 3D silhouettes, with full depth in a moving view.
  const side=r.index%2?-1:1,scale=.94+(r.index%4)*.13;
  let u=side*(62+(r.index%3)*8);
  if(c.blocked(r,mid,u,36,35))u+=side*30;
  const y=skylineY(mid);
  const estateYaw=yaw+(side<0?25:-25);
  box(d,c.world(mid,y-2.7,u),[28.5*scale,5.4,25*scale],IVORY,estateYaw,'bay-paving');
  asset(d===5&&r.index%2===0?'kookclubhouse':r.index%3===1||d===3?'kookmanor':'kookestate',c.world(mid,y-.15,u),scale,estateYaw,d,{color:['#ffffff','#e7f7ef','#fff0e6'][r.index%3]});
  if(r.index%3===0)for(const off of [-20,20]){
   const station=mid+off,tu=u+side*(20+off*.12);
   asset(r.index%3===0?'countryumbrellapine':'countryoak',c.world(station,skylineY(station)-.5,tu),1.65+(r.index%3)*.16,yaw+r.index*21,d);
  }
  if(r.index%2===0){
   const fu=-side*(108+(r.index%3)*14),fy=skylineY(mid);
   const fs=1.2+(r.index%3)*.18;
   box(d,c.world(mid,fy-2.7,fu),[28.5*fs,5.4,25*fs],IVORY,yaw+side*55,'bay-paving');
   asset(r.index%4===0?'kookmanor':'kookestate',c.world(mid,fy-.15,fu),fs,yaw+side*55,d,{color:'#e4eeee'});
   asset('countryoak',c.world(mid+20,skylineY(mid+20)-.3,fu),2.1,yaw+120,d);
  }
  for(const sign of [-1,1]){
   const tu=sign*(155+(r.index%3)*12),s=mid+13;
   asset(r.index%2?'countryoak':'countryumbrellapine',c.world(s,skylineY(s)-.4,tu),1.8+(r.index%3)*.25,yaw+r.index*39,d);

  }
 }

 const compass=(cp:number,cy:number,d:number)=>{
  for(let i=0;i<48;i++){
   const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;
   face(d,[c.world(cp+Math.sin(a)*3.8,cy,Math.cos(a)*3.8),c.world(cp+Math.sin(b)*3.8,cy,Math.cos(b)*3.8),c.world(cp+Math.sin(b)*3.5,cy,Math.cos(b)*3.5),c.world(cp+Math.sin(a)*3.5,cy,Math.cos(a)*3.5)],GOLD);
  }
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,rad=i%2?2.5:3.15;
   face(d,[c.world(cp,cy,0),c.world(cp+Math.sin(a)*rad,cy,Math.cos(a)*rad),c.world(cp+Math.sin(a+.3)*.8,cy,Math.cos(a+.3)*.8)],i%2?GOLD:TEAL);
   face(d,[c.world(cp,cy,0),c.world(cp+Math.sin(a-.3)*.8,cy,Math.cos(a-.3)*.8),c.world(cp+Math.sin(a)*rad,cy,Math.cos(a)*rad)],IVORY);
  }
 };
 // Each district opens under nautical pennants; the centre remains clear.
 for(const d of c.districts){
  const r=main.find(r=>r.index===d.first)!,s=r.a+22,width=r.width*.5-1.1,y=r.top+7.5;
  compass(r.a+34,r.top+.06,d.index);
  for(const side of [-1,1]){
   box(d.index,c.world(s,r.top+3.65,side*width),[.18,7.3,.18],IVORY,c.yaw(s));
   asset('baylamp',c.world(s+2,r.top,side*(width-.7)),.8,c.yaw(s),d.index);
  }
  for(let i=0;i<18;i++){
   const u=mix(-width,width,i/18),v=mix(-width,width,(i+1)/18),dip=Math.sin(i/18*Math.PI)*1.4,dip2=Math.sin((i+1)/18*Math.PI)*1.4;
   beam(d.index,c.world(s,y-dip,u),c.world(s,y-dip2,v),.028,.028,GOLD);
   const a=c.world(s,y-dip-.1,u+.1),b=c.world(s,y-dip2-.1,v-.1),tip=c.world(s,y-(dip+dip2)/2-.95,(u+v)/2);
   face(d.index,[a,tip,b],[TEAL,'#ed826e',IVORY,GOLD][i%4]);face(d.index,[a,b,tip],[TEAL,'#ed826e',IVORY,GOLD][i%4]);
  }
 }
 const last=main[main.length-1],finish=last.b-14;
 compass(last.a+42,last.top+.06,last.district);
 for(const side of [-1,1]){
  const u=side*16,s=finish-3;
  box(last.district,c.world(s,last.top+.25,u),[7.3,.5,7.3],IVORY,c.yaw(s));
  asset('kookcupola',c.world(s,last.top+.5,u),1.1,c.yaw(s),last.district,{scenerySolid:false});
  asset('kookhydrangea',c.world(s-8,last.top,u),1,c.yaw(s),last.district);
 }
 box(last.district,c.world(last.b+95,last.top-18,0),[50,8,44],IVORY,c.yaw(last.b),'kook-cedar');
 asset('kookestate',c.world(last.b+95,last.top-14,0),1.75,c.yaw(last.b),last.district);
 // Share identical untextured corners, retaining every face and hard shading.
 // Bounded chunks remain portable through the editor's mesh-size limits.
 for(const b of batches.values()){
  const flat=b.tex==='solid';let vertices:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[],ids=new Map<string,number>();
  const flush=()=>{
   if(!indices.length)return;
   components.push({t:'mesh',p:b.p,tex:b.tex,grp:b.grp,vertices,indices,colors,...(!flat?{uvs}:{}),flatShading:flat,
    color:'#ffffff',solid:false,edgeGrinding:false,nm:`Coastal ${b.tex} / fitted rooftop architecture`});
   vertices=[];indices=[];colors=[];uvs=[];ids=new Map();
  };
  for(let i=0;i<b.indices.length;i+=3){
   if(vertices.length/3>3996||indices.length>=12000)flush();
   for(const original of b.indices.slice(i,i+3)){
    const p=b.vertices.slice(original*3,original*3+3),color=b.colors.slice(original*3,original*3+3),uv=b.uvs.slice(original*2,original*2+2);
    const key=flat?[...p,...color].join(','):String(original);let id=ids.get(key);
    if(id===undefined){id=vertices.length/3;ids.set(key,id);vertices.push(...p);colors.push(...color);if(!flat)uvs.push(...uv);}
    indices.push(id);
   }
  }
  flush();
 }
}
