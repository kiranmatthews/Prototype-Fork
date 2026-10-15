import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';

type Point = [number, number, number];
// A normal level, deliberately independent of the race runtime. Metres, Y up.
// The last coordinate is road width; the route crosses itself at two heights.
const knots = [
  [0,4,34,18], [0,4,0,18], [0,4,-58,16], [-22,5,-96,16],
  [-64,6,-108,15], [-102,8,-86,14], [-120,10,-42,14],
  [-148,10,-20,14], [-178,10,-44,14], [-182,8,-98,14],
  [-160,6,-146,12], [-115,6,-178,10], [-65,6,-190,10], [-22,8,-190,14],
  [28,12,-186,14], [68,17,-164,13], [84,20,-125,12],
  [65,20,-91,12], [29,19,-70,11], [0,18,-66,10], [-32,18,-65,10],
  [-48,16,-36,12], [-30,13,6,14], [9,9,39,16], [52,6,45,16],
  [86,6,21,14], [109,6,-14,14], [137,6,-49,14],
  [174,8,-61,14], [204,12,-34,13], [210,12,5,13],
  [184,9,46,14], [146,6,79,15], [108,4,104,16], [69,4,108,18], [42,4,108,18],
];
const curve = new THREE.CatmullRomCurve3(knots.map(p=>new THREE.Vector3(p[0],p[1],p[2])),false,'centripetal');
const samples = 2400;
let length = 0;
export const COUNTRY_CLUB_ROUTE = Array.from({length:samples+1},(_,i)=>{
  const p=curve.getPoint(i/samples),prior=i?curve.getPoint((i-1)/samples):p;
  length+=p.distanceTo(prior);
  const k=i/samples*(knots.length-1),a=Math.floor(k),b=Math.min(knots.length-1,a+1);
  return {s:length,p:p.toArray() as Point,width:THREE.MathUtils.lerp(knots[a][3],knots[b][3],k-a)};
});
export const COUNTRY_CLUB_LENGTH=length;
const atKnot=(i:number)=>COUNTRY_CLUB_ROUTE[Math.round(i/(knots.length-1)*samples)].s;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function row(s:number){
  s=clamp(s,0,length);let lo=0,hi=samples;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(COUNTRY_CLUB_ROUTE[mid].s<s)lo=mid;else hi=mid;}
  const a=COUNTRY_CLUB_ROUTE[lo],b=COUNTRY_CLUB_ROUTE[hi],t=(s-a.s)/(b.s-a.s||1);
  return {p:a.p.map((v,i)=>v+(b.p[i]-v)*t) as Point,width:a.width+(b.width-a.width)*t};
}
export function countryClubPoint(s:number,offset=0,lift=0):Point{
  const p=row(s).p,a=row(s-.4).p,b=row(s+.4).p,dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1;
  return [p[0]-dz/n*offset,p[1]+lift,p[2]+dx/n*offset];
}
export function countryClubProgress(p:{x:number;y:number;z:number},previous=0){
  let best=Infinity,s=previous;
  // Local continuity plus height keeps the flyover from taking the lower lane.
  for(const q of COUNTRY_CLUB_ROUTE){
    if(q.s<previous-18||q.s>previous+65)continue;
    const d=(q.p[0]-p.x)**2+(q.p[1]-p.y)**2+(q.p[2]-p.z)**2;
    if(d<best){best=d;s=q.s;}
  }
  return s;
}
const yaw=(s:number)=>{const a=countryClubPoint(s-.4),b=countryClubPoint(s+.4);return -Math.atan2(b[0]-a[0],a[2]-b[2])*180/Math.PI;};
export const COUNTRY_CLUB_SECTIONS=[
  {name:'Clubhouse approach',s:0}, {name:'Bunker slalom',s:atKnot(3)},
  {name:'Pond causeway',s:atKnot(9)}, {name:'Ridge climb',s:atKnot(13)},
  {name:'Fairway flyover',s:atKnot(18)}, {name:'Drainage double',s:atKnot(24)},
  {name:'Garden hairpin',s:atKnot(28)}, {name:'Clubhouse return',s:atKnot(32)},
];
export const COUNTRY_CLUB_GAPS=[
  {name:'Irrigation cut',a:atKnot(25)+8,b:atKnot(25)+13},
  {name:'Drainage cut',a:atKnot(26)+11,b:atKnot(26)+17},
];
export const COUNTRY_CLUB_SLALOM=[
  {s:atKnot(4)-10,side:-1}, {s:atKnot(5)-3,side:1}, {s:atKnot(6)+6,side:-1},
];
export const COUNTRY_CLUB_CHECKPOINTS=[atKnot(3)-13,atKnot(9)-15,atKnot(13)+10,atKnot(18)+6,atKnot(24)-8,atKnot(28)+12,atKnot(32)+9];
const C:CustomComponent[]=[];
const palette={road:'#969d9b',alternate:'#a4aaa7',edge:'#e0e2da',bank:'#6c756e',hedge:'#58625b',water:'#4e6267',sand:'#b7b6a6',dark:'#3e4746'};
function mesh(name:string,vertices:number[],indices:number[],color:string,solid=false,grp=1){
  C.push({t:'mesh',p:[0,0,0],vertices,indices,color,tex:'solid',solid,vert:false,...(solid?{}:{edgeGrinding:false}),grp,nm:name});
}
function box(name:string,p:Point,s:Point,color:string,rotation=0,grp=1){
  C.push({t:'platform',p,s,yaw:rotation,tex:'solid',color,grp,nm:name});
}
// Seam-matched road tops with vertical massing, built entirely as editor data.
function ribbon(name:string,a:number,b:number,point:(s:number,u:number,h?:number)=>Point,width:(s:number)=>number,color:string,grp:number){
  for(let from=a;from<b-.001;from+=30){
    const to=Math.min(b,from+30),count=Math.ceil((to-from)/1.5),v:number[]=[],ind:number[]=[];
    for(let i=0;i<=count;i++){
      const s=from+(to-from)*i/count,w=width(s)/2;
      for(const [u,h] of [[-w,-1.4],[-w,0],[w,0],[w,-1.4]])v.push(...point(s,u,h));
      if(i){
        for(let j=0;j<3;j++){const n=(i-1)*4+j;ind.push(n,n+1,n+4,n+4,n+1,n+5);}
        const n=(i-1)*4;ind.push(n+3,n,n+7,n+7,n,n+4);
      }
    }
    const end=count*4;ind.push(0,3,1,1,3,2,end,end+1,end+3,end+3,end+1,end+2);
    mesh(name,v,ind,color,true,grp);
    // Thin light shoulders expose edge and grade; the central road stays flat.
    for(const side of [-1,1]){
      const ev:number[]=[],ei:number[]=[];
      for(let i=0;i<=count;i++){
        const s=from+(to-from)*i/count,w=width(s)/2;
        for(const u of [side*w-side*.25,side*w])ev.push(...point(s,u,.025));
        if(i){const n=(i-1)*2;ei.push(n,n+1,n+2,n+2,n+1,n+3);}
      }
      mesh(`${name} / edge`,ev,ei,palette.edge,false,grp);
    }
  }
}
const width=(s:number)=>row(s).width;
const boundaries=[0,...COUNTRY_CLUB_GAPS.flatMap(g=>[g.a,g.b]),length];
for(let i=0;i<boundaries.length-1;i+=2)ribbon('Cart road',boundaries[i],boundaries[i+1],countryClubPoint,width,palette.road,1);

// Short rough strips announce the two real jump cuts, with forgiving landings.
for(const gap of COUNTRY_CLUB_GAPS){
  for(let d=1;d<=4;d++){
    const s=gap.a-d*1.25,w=(width(s)-.6)/2;
    mesh(`${gap.name} / takeoff stripe`,[countryClubPoint(s-.11,-w,.03),countryClubPoint(s-.11,w,.03),
      countryClubPoint(s+.11,-w,.03),countryClubPoint(s+.11,w,.03)].flat(),[0,1,2,2,1,3],palette.edge,false,6);
  }
  const mid=(gap.a+gap.b)/2;
  C.push({t:'pit',p:countryClubPoint(mid,0,-3.5),s:[20,.2,gap.b-gap.a+4],yaw:yaw(mid),tex:'solid',color:palette.dark,grp:6,nm:`${gap.name} / trench`});
}
// Three alternating bunker intrusions make line selection matter. Their lower
// sand shelves catch a conservative player; the high hedge is a jumpable block.
for(const [i,o] of COUNTRY_CLUB_SLALOM.entries()){
  const w=width(o.s),obstacleWidth=w*.6,u=o.side*(w-obstacleWidth)/2;
  box(`Bunker ${i+1} / hedge nose`,countryClubPoint(o.s,u,.65),[obstacleWidth,1.3,9],palette.hedge,yaw(o.s),2);
  box(`Bunker ${i+1} / sand shelf`,countryClubPoint(o.s,o.side*(w/2+3),-.7),[8,1.2,15],palette.sand,yaw(o.s),2);
}

// The safe pond line follows the long shoreline. The diagonal tee bridge saves
// a corner, but narrows to 4.2m and has a genuine four-metre break.
const shortStart=atKnot(9)+12,shortEnd=atKnot(12)-12;
const sa=countryClubPoint(shortStart),sb=countryClubPoint(shortEnd);
const sd=Math.hypot(sb[0]-sa[0],sb[2]-sa[2]),sx=(sb[0]-sa[0])/sd,sz=(sb[2]-sa[2])/sd;
const shortcutPoint=(s:number,u=0,h=0):Point=>[sa[0]+sx*s-sz*u,sa[1]+(sb[1]-sa[1])*s/sd+h,sa[2]+sz*s+sx*u];
export const COUNTRY_CLUB_SHORTCUT={start:shortStart,end:shortEnd,length:sd,a:sd*.49,b:sd*.49+4,point:shortcutPoint};
ribbon('Pond shortcut / narrow tee bridge',0,sd*.49,shortcutPoint,()=>4.2,palette.alternate,3);
ribbon('Pond shortcut / far landing',sd*.49+4,sd,shortcutPoint,()=>4.2,palette.alternate,3);
const pond:Point=[-122,0,-141];
C.push({t:'pit',p:pond,s:[138,.2,104],invisible:true,grp:3,nm:'Pond / miss returns to the banked checkpoint'});
mesh('Pond / grey water blockout',[-191,.04,-193,-53,.04,-193,-191,.04,-89,-53,.04,-89],[0,2,1,1,2,3],palette.water,false,3);

// A narrow grindable parapet across the ridge bend is a second optional line.
const railStart=atKnot(16)-13,railEnd=atKnot(18)+7;
export const COUNTRY_CLUB_RIDGE={start:railStart,end:railEnd};
// Feed the end back into the road before the flyover parapet. A constant
// outside offset would launch a rider tangentially into that narrowing wall.
const railPoints=Array.from({length:30},(_,i)=>{
  const s=railStart+(railEnd-railStart)*i/29,t=clamp((railEnd-s)/26,0,1),blend=t*t*(3-2*t);
  return countryClubPoint(s,-4.1*blend,.12+.3*blend);
});
C.push({t:'rail',p:railPoints[0],pts:railPoints.map(p=>[p[0]-railPoints[0][0],p[2]-railPoints[0][2],0,p[1]-railPoints[0][1]]),color:palette.edge,grp:4,nm:'Ridge / inside parapet grind'});
C.push({t:'crystal',p:countryClubPoint((railStart+railEnd)/2,-4.1,1.1),grp:4,nm:'Optional ridge crystal'});

// Continuous outer parapets on the elevated crossing and the outside hairpin.
for(const [a,b,side] of [[atKnot(18),atKnot(21),-1],[atKnot(18),atKnot(21),1],[atKnot(28),atKnot(31),-1]]){
  const count=Math.ceil((b-a)/4);
  const pts=Array.from({length:count+1},(_,i)=>countryClubPoint(a+(b-a)*i/count,side*(width(a+(b-a)*i/count)/2+.3)));
  const p=pts[0];C.push({t:'wallpath',p,pts:pts.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),w:.6,rise:1.1,collisionHeight:1.1,curve:'corner',tex:'solid',color:palette.bank,grp:5,nm:'Raised road / safety parapet'});
}
for(const s of [atKnot(18),atKnot(20)+9]){
  const p=countryClubPoint(s);for(const side of [-1,1])box('Flyover / pier',countryClubPoint(s,side*3,-(p[1]+2)/2),[1.3,p[1]+2,1.3],palette.bank,0,5);
}

// Country-club landmarks remain untextured masses: one clubhouse, fairway
// islands, tee flags and parked cart-sized blocks. No enemies or race logic.
box('Clubhouse / main mass',[8,10,77],[38,12,20],palette.alternate,0,8);
box('Clubhouse / flat roof',[8,16.5,77],[43,1,25],palette.edge,0,8);
box('Clubhouse / wing',[-19,7,78],[16,6,18],palette.road,0,8);
for(const x of [-7,3,13,23])box('Clubhouse / veranda pillar',[x,7.5,64],[1,7,1],palette.edge,0,8);
box('Clubhouse / veranda canopy',[8,11.2,63],[40,.7,7],palette.road,0,8);
for(let i=0;i<4;i++)box('Parking / cart scale block',[25+i*5,5.1,68],[2.3,2.2,3.6],palette.bank,0,8);
for(const [x,z,rx,rz] of [[-67,-43,30,26],[-124,-85,17,21],[25,-130,28,23],[148,-7,26,34],[61,80,12,9]]){
  const v:number[]=[x,-1,z],ind:number[]=[];
  for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;v.push(x+Math.cos(a)*rx,-1,z+Math.sin(a)*rz);if(i)ind.push(0,i+1,i);}
  mesh('Fairway / blockout green',v,ind,palette.bank,false,8);
  box('Tee / flag pole',[x,2,z],[.18,6,.18],palette.edge,0,8);
  box('Tee / flag',[x+1.1,4.4,z],[2.2,1.2,.12],palette.edge,0,8);
}

// Direction is readable from gameplay height and above. Arrows are non-solid.
for(let s=18;s<length-10;s+=27){
  if(COUNTRY_CLUB_GAPS.some(g=>s>g.a-3&&s<g.b+3))continue;
  const v=[countryClubPoint(s+2,0,.04),countryClubPoint(s-1.5,-1,.04),countryClubPoint(s-1.5,1,.04)].flat();
  mesh('Road / forward arrow',v,[0,1,2],palette.edge,false,9);
}
for(const [i,s] of COUNTRY_CLUB_CHECKPOINTS.entries())C.push({t:'checkpoint',p:countryClubPoint(s),grp:9,nm:`Checkpoint ${i+1} / ${COUNTRY_CLUB_SECTIONS[Math.min(i+1,7)].name}`});
for(const s of [45,atKnot(4)+9,atKnot(8)+12,atKnot(13)+25,atKnot(22),atKnot(27)+12,atKnot(31)+12]){
  for(const u of [-2,2])C.push({t:'crate',kind:'wood',p:countryClubPoint(s,u),grp:9,nm:'Optional roadside box'});
}
for(let s=15;s<length-20;s+=9){
  if(COUNTRY_CLUB_GAPS.some(g=>s>g.a-2&&s<g.b+2))continue;
  const o=COUNTRY_CLUB_SLALOM.find(o=>Math.abs(o.s-s)<15),u=o?-o.side*2.8:0;
  C.push({t:'wumpa',p:countryClubPoint(s,u,1.1),grp:9,nm:'Route breadcrumb'});
}
for(let s=0;s<length;s+=6)C.push({t:'camnode',p:countryClubPoint(s),radius:0,grp:9});
C.push({t:'camnode',p:countryClubPoint(length),radius:0,grp:9});
const end=countryClubPoint(length),finishS=length-14;
box('Finish / supported run-out',[end[0]-7,end[1]-.7,end[2]],[19,1.4,19],palette.alternate,0,8);
C.push({t:'gate',p:countryClubPoint(finishS),yaw:yaw(finishS),grp:9,nm:'Clubhouse / normal level finish'});

export const COUNTRY_CLUB_LEVEL:CustomLevelData={
  v:1,name:'Country Club Circuit',spawn:countryClubPoint(7,0,.1),startWarpPad:false,killY:-9,
  sky:'day',cameraAirLift:.7,cameraLookAhead:7,
  atmosphere:{fogEnabled:true,fogNear:150,fogFar:580,fogColor:'#bdc7c5',ambientSky:'#d6dfdc',ambientGround:'#707773'},
  components:C,groups:[
    {id:1,nm:'01 / continuous cart road',editorOnly:true},{id:2,nm:'02 / bunker slalom',editorOnly:true},
    {id:3,nm:'03 / pond and shortcut',editorOnly:true},{id:4,nm:'04 / ridge parapet',editorOnly:true},
    {id:5,nm:'05 / elevated crossing',editorOnly:true},{id:6,nm:'06 / drainage double',editorOnly:true},
    {id:8,nm:'08 / country club masses',editorOnly:true},{id:9,nm:'09 / normal level flow and route',editorOnly:true},
  ],
};
