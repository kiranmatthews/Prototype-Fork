import type {CustomComponent, CustomGroup, CustomLevelData} from '../../src/level';

type Point=[number,number,number];
type Scalar=number|((s:number)=>number);
const C:CustomComponent[]=[],groups:CustomGroup[]=[];
const round=(v:number)=>Math.round(v*4096)/4096;
const mix=(a:number,b:number,t:number)=>a+(b-a)*Math.max(0,Math.min(1,t));
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const value=(v:Scalar,s:number)=>typeof v==='function'?v(s):v;
export const CUSTARD_CREEK_END=2430;
// An independently authored folded river: three broad reversals, a high
// outward millrace and a low return. Stations are metres along the curve.
// No course geometry or encounter sequence is borrowed from Carlisle.
const knots:[number,number][]=[[0,0],[-45,-180],[-30,-400],[60,-560],[240,-600],
 [380,-500],[410,-310],[350,-150],[200,-70],[150,90],[270,220],[460,220],
 [620,100],[680,-80],[650,-270],[750,-400],[950,-390],[1040,-240],[1000,-60]];
const raw:Point[]=[];
for(let i=0;i<knots.length-1;i++)for(let j=0;j<100;j++){
 const t=j/100,p0=knots[Math.max(0,i-1)],p1=knots[i],p2=knots[i+1],p3=knots[Math.min(knots.length-1,i+2)];
 const at=(k:number)=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t);
 raw.push([at(0),0,at(1)]);
}
raw.push([knots[knots.length-1][0],0,knots[knots.length-1][1]]);
const lengths=[0];for(let i=1;i<raw.length;i++)lengths.push(lengths[i-1]+Math.hypot(raw[i][0]-raw[i-1][0],raw[i][2]-raw[i-1][2]));
const scale=CUSTARD_CREEK_END/lengths[lengths.length-1];
const spine=raw.map((p,i)=>({s:lengths[i]*scale,p:p.map(v=>v*scale) as Point}));
function centre(s:number):Point {
 if(s<0){const a=spine[0],b=spine[1],t=s/(b.s-a.s);return [a.p[0]+(b.p[0]-a.p[0])*t,0,a.p[2]+(b.p[2]-a.p[2])*t];}
 if(s>CUSTARD_CREEK_END){const a=spine[spine.length-2],b=spine[spine.length-1],t=(s-b.s)/(b.s-a.s);return [b.p[0]+(b.p[0]-a.p[0])*t,0,b.p[2]+(b.p[2]-a.p[2])*t];}
 let lo=0,hi=spine.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(spine[mid].s>s)hi=mid;else lo=mid;}
 const a=spine[lo],b=spine[hi],t=(s-a.s)/(b.s-a.s);return[a.p[0]+(b.p[0]-a.p[0])*t,0,a.p[2]+(b.p[2]-a.p[2])*t];
}
export function custardTangent(s:number):Point {const a=centre(s-.2),b=centre(s+.2),n=Math.hypot(b[0]-a[0],b[2]-a[2]);return[(b[0]-a[0])/n,0,(b[2]-a[2])/n];}
export const custardYaw=(s:number)=>Math.atan2(-custardTangent(s)[0],-custardTangent(s)[2])*180/Math.PI;
const heights:[number,number][]=[[-20,0],[80,0],[240,3],[300,3],[560,9],[650,12],[740,12],[850,18],
 [1160,4],[1210,4],[1360,1],[1510,-2],[1740,-2],[1820,0],[1960,-8],[2100,-10],[2200,-10],[2280,-6],[2460,-6]];
export function custardHeight(s:number):number {for(let i=1;i<heights.length;i++)if(s<=heights[i][0]){const a=heights[i-1],b=heights[i];return a[1]+(b[1]-a[1])*smooth((s-a[0])/(b[0]-a[0]));}return heights[heights.length-1][1];}
export function custardPoint(s:number,y=custardHeight(s),u=0):Point {const p=centre(s),d=custardTangent(s);return[p[0]-d[2]*u,y,p[2]+d[0]*u].map(round) as Point;}
export function custardProgress(q:Point|{x:number;z:number}):number {
 const x=Array.isArray(q)?q[0]:q.x,z=Array.isArray(q)?q[2]:q.z;let best=Infinity,station=0;
 for(let i=1;i<spine.length;i++){const a=spine[i-1],b=spine[i],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],t=Math.max(0,Math.min(1,((x-a.p[0])*dx+(z-a.p[2])*dz)/(dx*dx+dz*dz))),d=(x-a.p[0]-dx*t)**2+(z-a.p[2]-dz*t)**2;if(d<best){best=d;station=a.s+(b.s-a.s)*t;}}
 return station;
}
export const CUSTARD_CREEK_SECTIONS=[
 {name:'Lockyard chicane',a:0,b:240,mechanic:'crusher timing'},
 {name:'Split millrace',a:240,b:560,mechanic:'two banks and broken spans'},
 {name:'High mill crown',a:560,b:850,mechanic:'ascending rail bridge'},
 {name:'Return-bend spillway',a:850,b:1210,mechanic:'downhill halfpipe'},
 {name:'Sluice stepping stones',a:1210,b:1510,mechanic:'offset jumps and crumbling arc'},
 {name:'Ferry reedbeds',a:1510,b:1820,mechanic:'moving ferry and island routes'},
 {name:'Boulder run',a:1820,b:2100,mechanic:'downhill carving and rolling hazards'},
 {name:'Backwater crown',a:2100,b:2450,mechanic:'pendulum approach and final rail bridge'},
].map((r,i)=>({...r,grp:20+i}));
for(const r of CUSTARD_CREEK_SECTIONS)groups.push({id:r.grp,nm:r.name,editorOnly:true});
const section=(s:number)=>CUSTARD_CREEK_SECTIONS.find(r=>s>=r.a&&s<r.b)??CUSTARD_CREEK_SECTIONS[CUSTARD_CREEK_SECTIONS.length-1];
const add=(c:CustomComponent)=>C.push(c);
export const CUSTARD_CREEK_ROADS:{a:number;b:number;width:Scalar;offset:Scalar;name:string}[]=[];
export const CUSTARD_CREEK_GAPS:{a:number;b:number;u:number;name:string}[]=[];
// Closed swept solids and below-deck side shells use the existing mesh and
// wallpath toolkit. Gap footprints never receive a hidden supporting floor.
function ribbon(a:number,b:number,width:Scalar=12,offset:Scalar=0,name='Creek bank',color='#d7ba76',top:Scalar=custardHeight,solid=true){
 if(solid)CUSTARD_CREEK_ROADS.push({a,b,width,offset,name});
 for(let start=a;start<b;start+=48){
  const end=Math.min(b,start+48),rows=Math.ceil((end-start)/2),p=custardPoint(start,0),vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  const left:Point[]=[],right:Point[]=[];
  for(let lower=0;lower<2;lower++)for(let i=0;i<=rows;i++){
   const s=start+(end-start)*i/rows,w=value(width,s),u=value(offset,s),y=value(top,s)-(lower?6:0);
   for(const side of [-1,0,1]){const q=custardPoint(s,y,u+side*w/2);vertices.push(round(q[0]-p[0]),q[1],round(q[2]-p[2]));uvs.push((u+side*w/2)/4,s/4);if(!lower&&side!==0)(side<0?left:right).push(custardPoint(s,y,u+side*(w/2-.06)));}
  }
  const n=(rows+1)*3,quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,c,b,d);
  for(let i=0;i<rows;i++)for(let j=0;j<2;j++){const v=i*3+j;quad(v,v+1,v+3,v+4);if(solid)quad(v+n,v+n+3,v+n+1,v+n+4);}
  if(solid){for(let i=0;i<rows;i++){const v=i*3;quad(v+3,v,v+3+n,v+n);quad(v+2,v+5,v+2+n,v+5+n);}for(const i of [0,rows])for(let j=0;j<2;j++){const v=i*3+j;quad(v,v+n,v+1,v+1+n);}}
  add({t:'mesh',p,vertices,indices,uvs,color,tex:solid?'sand':'solid',solid,edgeGrinding:false,doubleSided:!solid,grp:section(start).grp,nm:name});
  if(solid){const shell=(qs:Point[],suffix:string)=>{const anchor=qs[0];add({t:'wallpath',p:[anchor[0],anchor[1]-6,anchor[2]],pts:qs.map(q=>[q[0]-anchor[0],q[2]-anchor[2],0,q[1]-anchor[1]]),w:.12,rise:5.95,collisionHeight:5.95,invisible:true,edgeGrinding:false,grp:section(start).grp,nm:`${name} · ${suffix}`});};shell(left,'left mass');shell(right,'right mass');if(start===a)shell([left[0],right[0]],'entry mass');if(end===b)shell([left[left.length-1],right[right.length-1]],'exit mass');}
 }
}
function gap(a:number,b:number,u=0,width=24,name='Open creek crossing'){
 CUSTARD_CREEK_GAPS.push({a,b,u,name});const p=custardPoint(a,custardHeight(a)-3,u),pts:NonNullable<CustomComponent['pts']>=[];
 for(const side of [-1,1]){const qs=[];for(let s=a;s<b;s+=2)qs.push(custardPoint(s,p[1],u+side*width/2));qs.push(custardPoint(b,p[1],u+side*width/2));if(side>0)qs.reverse();pts.push(...qs.map(q=>[q[0]-p[0],q[2]-p[2]] as [number,number]));}
 add({t:'pit',p,pts,color:'#547f79',grp:section(a).grp,nm:name});
}
function rail(a:number,b:number,u:Scalar=0,lift=.72,name='Creek grind line'){
 const p=custardPoint(a,custardHeight(a)+lift,value(u,a)),pts:NonNullable<CustomComponent['pts']>=[],steps=Math.ceil((b-a)/3);
 for(let i=0;i<=steps;i++){const s=a+(b-a)*i/steps,q=custardPoint(s,custardHeight(s)+lift,value(u,s));pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
 add({t:'rail',p,pts,grp:section(a).grp,nm:name});
}
const crate=(s:number,u=0,kind:CustomComponent['kind']='wood',lift=0)=>add({t:'crate',p:custardPoint(s,custardHeight(s)+lift,u),kind,grp:section(s).grp,nm:`${section(s).name} · ${kind} reward`});
const enemy=(s:number,u:number,foe:NonNullable<CustomComponent['foe']>,range=0,speed=0)=>add({t:'enemy',p:custardPoint(s,custardHeight(s),u),foe,range,speed,grp:section(s).grp,nm:`${section(s).name} · ${foe}`});
function rewardLine(a:number,b:number,u:Scalar=0,spacing=10){for(let s=a,i=0;s<=b;s+=spacing,i++)crate(s,value(u,s),i%7===6?'mystery':'wood');}
function cp(s:number,u=0){add({t:'checkpoint',p:custardPoint(s,custardHeight(s),u),grp:section(s).grp,nm:`${section(s).name} · safe restart`});}
function pad(s:number,w:number,d:number,u=0,top=custardHeight(s),name='Mill stone island'){
 add({t:'platform',p:custardPoint(s,top-1,u),s:[w,2,d],yaw:custardYaw(s),color:'#bda56f',tex:'stone',edgeGrinding:false,grp:section(s).grp,nm:name});
}
// 1. Start at creek level. Twin locks and alternating stone noses teach
// route reading before any long rail or drop; the outside line stays open.
ribbon(-16,240,14,0,'Lockyard towpath');
for(const [s,u,phase] of [[90,-2,0],[148,2,.5]]){add({t:'crusher',p:custardPoint(s,custardHeight(s),u),s:[5,3,5],cycle:3.4,phase,grp:20,nm:'Early lock stamping block'});pad(s,4,10,u<0?5.5:-5.5,custardHeight(s)+1.8,'Chicane stone nose');}
rewardLine(24,65,s=>2.5*Math.sin(s/22));crate(74,-5,'mask');rewardLine(165,225,s=>3*Math.sin(s/25));enemy(201,0,'turtle',1,.8);cp(226,3.5);
// 2. Two actual banks flank an empty millrace. Left is faster with two
// charged gaps; right trades speed for a collapsing plank crossing.
ribbon(240,270,s=>mix(14,20,(s-240)/30));
const offset=(side:number)=>(s:number)=>side*6*(1-smooth((s-500)/60));
for(const [a,b] of [[270,340],[350.8,427],[437.8,560]])ribbon(a,b,5.6,offset(-1),'Inner millrace bank');
for(const [a,b] of [[270,390],[416,560]])ribbon(a,b,5.6,offset(1),'Outer millrace bank');
gap(340,350.8,-6,8,'Inner bank hop one');gap(427,437.8,-6,8,'Inner bank hop two');gap(390,416,6,8,'Outer collapsing plank span');
for(let s=392;s<=416;s+=4){add({t:'crumble',p:custardPoint(s,custardHeight(s),6),s:[5.6,1,4.12],yaw:custardYaw(s),shake:.65,speed:30,grp:21,nm:'Millrace falling timber'});}
rewardLine(280,330,-6);rewardLine(364,421,-6);rewardLine(285,378,6,12);rewardLine(430,490,6);crate(481,5,'life');enemy(460,-6,'spiker');enemy(370,6,'hopper');
rail(278,326,-8.1,.8,'Outside bank coping');cp(548,2.5);
// 3. Climb around the mill crown, cross a long broken aqueduct on a single
// curved rail, then sweep onto the highest terrace. No straight rail ladder.
ribbon(560,660,12,0,'Ascending mill crown');gap(660,720,0,28,'Broken crown aqueduct');ribbon(720,850,13,0,'Upper mill terrace');
rail(642,738,s=>1.5*Math.sin((s-642)*Math.PI/96),.72,'Crown aqueduct crossing');
rewardLine(575,628,s=>-3*Math.sin((s-575)/35));enemy(618,3,'charger',2,1.2);rewardLine(755,821,3);crate(786,-3,'bouncy');crate(786,-3,'mystery',.96);cp(752,-3.5);cp(841,4);
// An optional elevator leads to a compact mill roof reward, beside the
// continuous main ascent. Its silhouette gives the crown a vertical centre.
pad(791,9,16,-18,custardHeight(791)+5,'Mill reward roof');const liftP=custardPoint(791,custardHeight(791)+2.5,-11);add({t:'mover',p:liftP,s:[5,.8,6],axis:'y',amp:2.5,speed:.65,phase:-Math.PI/2,grp:22,nm:'Optional mill roof lift'});crate(791,-18,'life',5);
// 4. The first major direction reversal is a long descending halfpipe,
// after the high rail chapter. Open floor rewards carving wall to wall.
{
 const a=850,b=1160,p=custardPoint(a),pts:NonNullable<CustomComponent['pts']>=[];
 for(let s=a;s<=b;s+=5){const q=custardPoint(s);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}const q=custardPoint(b);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);
 add({t:'vertramp',p,pts,vkind:'half',curve:'corner',w:4.5,rise:3,arc:80,arcSteps:20,deck:1.5,rails:false,bank:0,tex:'stone',color:'#d2bd88',grp:23,nm:'Descending return-bend spillway'});
}
ribbon(1160,1210,14,0,'Spillway runout');rewardLine(876,1128,s=>2.7*Math.sin((s-876)/39),14);rail(943,1020,-6.7,3,'High spillway coping');enemy(1180,-3,'turtle',1,.8);cp(1198,3.5);
// 5. Three separate sluice basins break the floor. Short flights alternate
// sides before a crumbling crescent: a stepping sequence, not a box corridor.
ribbon(1210,1240,13);gap(1240,1251.2,0,26,'First sluice jump');ribbon(1251.2,1336,9,s=>2.5*Math.sin((s-1251)/32),'Offset sluice island');
gap(1336,1347.2,0,26,'Second sluice jump');ribbon(1347.2,1440,10,s=>-2*Math.sin((s-1347)/32),'Returning sluice island');gap(1440,1480,0,24,'Falling sluice crescent');
for(let s=1442;s<1480;s+=4.8)add({t:'crumble',p:custardPoint(s,custardHeight(s),1.2*Math.sin((s-1440)/12)),s:[7,1,4.92],yaw:custardYaw(s),shake:.6,speed:30,grp:24,nm:'Sluice collapsing crescent'});
ribbon(1480,1510,12);rewardLine(1270,1317,2);rewardLine(1368,1428,-2);enemy(1298,-1,'hopper');enemy(1390,2,'sentry');cp(1324,-1);cp(1498,3);
// 6. A moving ferry occupies the missing centre span. Approach and receiver
// are generous islands, but there is no static floor or rail below the ferry.
ribbon(1510,1622,14,0,'Reedbed ferry approach');gap(1622,1662,0,30,'Moving ferry channel');ribbon(1662,1740,16,0,'Ferry receiver island');
const ferryP=custardPoint(1642),ferryDir=custardTangent(1642),ferryAxis=Math.abs(ferryDir[0])>Math.abs(ferryDir[2])?'x':'z';
add({t:'mover',p:ferryP,s:[10,.8,10],axis:ferryAxis,amp:15,speed:.6,grp:25,nm:'Reedbed ferry'});
ribbon(1740,1820,6,-5,'Left reedbank');ribbon(1740,1820,6,5,'Right reedbank');rewardLine(1535,1605,3);enemy(1576,-3,'spinner');rewardLine(1690,1730,-3);
rail(1726,1812,5,.8,'Reedbank fast rail');rewardLine(1750,1800,-5);crate(1792,-5,'mask');cp(1674,4);cp(1810,-5);
// 7. A wide descending quarry run gives skating room after the ferry. The
// boulders sweep across flat supported courts, while crate arcs pull wide.
ribbon(1820,2100,18,0,'Boulder-run carving bank');
for(const s of [1862,1950,2030]){const p=custardPoint(s),d=custardTangent(s),axis=Math.abs(d[0])>Math.abs(d[2])?'z':'x';pad(s,22,22,0,custardHeight(s),'Rolling-stone court');add({t:'stone',p,axis,range:7,speed:5.2,radius:1.15,grp:26,nm:'Cross-run rolling stone'});}
rewardLine(1840,2076,s=>5*Math.sin((s-1840)/38),12);enemy(1898,-4,'charger',2,1.2);enemy(1988,4,'spiker');enemy(2068,-3,'grunt',1.3,1);rail(1920,2012,7,.8,'Quarry outside carve rail');cp(2092,4.5);
// 8. Last reversal: pendulums guard the rising approach, then one exposed
// rail carries the final crescent to the finish island. It ends on high stone.
ribbon(2100,2288,14,0,'Backwater crown approach');
for(const [s,u,phase] of [[2174,-1,0],[2233,1,1.4]])add({t:'pendulum',p:custardPoint(s,custardHeight(s)+6,u),len:5,amp:.85,speed:1.5,phase,yaw:custardYaw(s),grp:27,nm:'Crown waterwheel pendulum'});
rewardLine(2120,2160,3);rewardLine(2193,2250,-3);crate(2265,4,'nitro');crate(2278,4,'nitro');cp(2272,-3.5);
gap(2288,2370,0,28,'Final backwater rail crescent');rail(2270,2388,0,.75,'Final crown rail');ribbon(2370,2450,18,0,'Custard finish island');rewardLine(2394,2420,0,6);crate(2408,-5,'nitrobang');
// Water remains visibly below all supported banks. A broad reset plane
// catches a missed bank; individual pits make the challenge spans immediate.
for(let a=-16;a<2450;a+=120)ribbon(a,Math.min(2450,a+120),34,0,'Low flowing custard water','#64958d',s=>custardHeight(s)-6,false);
// Low planted shoulders give the folded reaches a riverbank silhouette.
// They are scenery below the challenge decks, never a bypass collision floor.
for(let a=-16;a<2450;a+=64)for(const side of [-1,1]){
 const b=Math.min(2450,a+64),n=Math.ceil((b-a)/4),p=custardPoint(a,0),vertices:number[]=[],indices:number[]=[];
 const offsets=[15,18,30,35],ys=[-6,-3,-3,-6];
 for(let i=0;i<=n;i++){const s=a+(b-a)*i/n;for(let j=0;j<4;j++){const q=custardPoint(s,custardHeight(s)+ys[j],offsets[j]*side);vertices.push(q[0]-p[0],q[1],q[2]-p[2]);}if(i)for(let j=0;j<3;j++){const v=(i-1)*4+j;indices.push(v,v+1,v+4,v+4,v+1,v+5);}}
 add({t:'mesh',p,vertices,indices,solid:false,doubleSided:true,color:side<0?'#8f9b62':'#a3ab70',tex:'grass',edgeGrinding:false,grp:section(a).grp,nm:'Planted low creek shoulder'});
}
add({t:'pit',p:[420,-25,-150],s:[1400,1,1200],invisible:true,nm:'Creek fall reset'});
for(let s=15;s<2448;s+=8)add({t:'camnode',p:custardPoint(s,custardHeight(s)+.8),radius:0,nm:'Ordered folded creek camera'});
add({t:'camnode',p:custardPoint(-16,.8),radius:0,nm:'Creek entry camera'});
// Put the near-end camera first; camnodes are a travelled chain, not a set.
const camera=C.filter(c=>c.t==='camnode');C.splice(0,C.length,...C.filter(c=>c.t!=='camnode'),camera[camera.length-1],...camera.slice(0,-1));
for(let s=20;s<2420;s+=24){const road=CUSTARD_CREEK_ROADS.find(r=>s>=r.a&&s<=r.b);if(road)add({t:'wumpa',p:custardPoint(s,custardHeight(s)+1.3,value(road.offset,s)),grp:section(s).grp,nm:'Onward creek fruit'});}
for(let s=25,i=0;s<2420;s+=33,i++)for(const side of [-1,1]){add({t:'decor',dkind:i%3?'pine':'palm',p:custardPoint(s,custardHeight(s)-3,side*(22+i%3*3)),w:1.3+(i%3)*.15,rise:6+i%4,yaw:i*47,grp:section(s).grp,nm:'Folded creek trees'});if(i%4===0)add({t:'rock',p:custardPoint(s+8,custardHeight(s+8)-1.8,side*18),s:[3,3,4],seed:i+21,color:'#b9a77e',grp:section(s).grp,nm:'Creek bank stone'});}
add({t:'clock',p:custardPoint(8,0,-4),nm:'Creek time trial'});add({t:'crystal',p:custardPoint(833,custardHeight(833)+1.4),nm:'Mill crown crystal'});
add({t:'gate',p:custardPoint(CUSTARD_CREEK_END),yaw:custardYaw(CUSTARD_CREEK_END),nm:'Custard Creek finish'});
export const CUSTARD_CREEK_CAMERA=C.filter(c=>c.t==='camnode').map(c=>c.p);
export const CUSTARD_CREEK_GAMEPLAY=Object.fromEntries(['enemy','stone','crusher','pendulum','mover','crumble','rail','vertramp','checkpoint','crate','gate'].map(t=>[t,C.filter(c=>c.t===t).length]));
export const CUSTARD_CREEK_LEVEL:CustomLevelData={v:1,name:'Custard Creek',sky:'coast',spawn:custardPoint(0,.12),killY:-34,medalTimes:{gold:180,silver:210,bronze:255},groups,components:C};
