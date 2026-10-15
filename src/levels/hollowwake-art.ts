import type {CustomComponent} from '../level';
import {HOLLOWWAKE_END,HOLLOWWAKE_ROOMS,HOLLOWWAKE_FORKS,hollowPoint,hollowRadius,hollowYaw,hollowFloorRise,hollowGroup,hollowCentre,hollowTangent} from './hollowwake-route';
type Gap={s:number;len:number;branch:number};
const skylights=[[-39,-27],[42,49],[137,143],[308,315],[394,401],[452,458],[578,585],[728,736],[803,809],[960,968],[1137,1143],[1210,1216],[1384,1390],[1574,1581],[1650,1657],[1838,1845],[2019,2027],[2091,2098],[2240,2247],[2422,2431],[2474,2484]];
/** Art remains source-owned. Each section bends the approved generated bore;
 * no runtime geology primitive or repeating tile texture is used. */
export function hollowwakeArt(gaps:Gap[]):CustomComponent[]{
 const C:CustomComponent[]=[];
 const prop=(kind:NonNullable<CustomComponent['dkind']>,s:number,branch:number,u:number,lift:number,size:[number,number,number],yaw=0,name='')=>C.push({t:'decor',dkind:kind,p:hollowPoint(s,branch,u,lift),s:size,yaw:hollowYaw(s,branch)+yaw,scenerySolid:false,castShadow:false,grp:hollowGroup(s),nm:name});
 const cuts=new Set([-65,HOLLOWWAKE_END+35,...HOLLOWWAKE_ROOMS.flatMap(r=>[r.entry,r.exit]),...HOLLOWWAKE_FORKS.flatMap(f=>[f.a,f.b]),...skylights.flat(),...gaps.flatMap(g=>[g.s,g.s+g.len])]);
 for(let s=-65;s<HOLLOWWAKE_END+35;s+=24)cuts.add(s);
 const bounds=[...cuts].sort((a,b)=>a-b);
 for(let i=1;i<bounds.length;i++){
  const a=bounds[i-1],b=bounds[i],mid=(a+b)/2,f=HOLLOWWAKE_FORKS.find(f=>mid>f.a&&mid<f.b);
  for(const branch of f?[0,1]:[-1]){
   const p=hollowPoint(a,branch),pts:NonNullable<CustomComponent['pts']>=[],widths:number[]=[],n=Math.ceil((b-a)/3);
   for(let j=0;j<=n;j++){const at=a+(b-a)*j/n,q=hollowPoint(at,branch);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1],hollowYaw(at,branch)]);widths.push(hollowRadius(Math.max(a+.0001,Math.min(b-.0001,at))));}
   const opening=skylights.some(([a,b])=>mid>a&&mid<b);
   C.push({t:'decor',dkind:'hollowcavebore',p,pts,widths,len:b-a,phase:((a+65)%24)/24,vr:branch+1,seed:Math.floor((mid+65)/96),scenerySolid:false,openFloor:gaps.some(g=>g.branch===branch&&mid>g.s&&mid<g.s+g.len),arc:opening?32:0,grp:hollowGroup(mid),nm:'Curved Meshy rock bore'});
  }
 }
 prop('hollowtimberrib',-33,-1,0,-4.8,[34,32,3.2],0,'Opening timber bore around the resting boulder');
 // Large imported slate formations sit outside the circular clearance
 // envelope. They give the walls real broad sculpted planes and deep seams.
 for(let s=-49,ring=0;s<2502;s+=22,ring++){
  if(HOLLOWWAKE_ROOMS.some(r=>s>r.entry-15&&s<r.exit+17))continue;
  const f=HOLLOWWAKE_FORKS.find(f=>s>f.a&&s<f.b),branches=f?[0,1]:[-1];
  for(const branch of branches)for(const degrees of [55,98,141,181,222,265,306]){
   const angle=(degrees+(ring%3-1)*3)*Math.PI/180,r=hollowRadius(s),thickness=6.5+(ring%3),q=hollowCentre(s,branch),d=hollowTangent(s,branch),radial=r+thickness;
   const inner=hollowPoint(s,branch,Math.sin(angle)*r,r-Math.cos(angle)*r);
   if(f){const other=hollowCentre(s,1-branch);if(Math.hypot(inner[0]-other[0],inner[2]-other[2],inner[1]-other[1]-r)<r+8)continue;}
   if(degrees>135&&degrees<225&&skylights.some(([a,b])=>s>b-16&&s<a+16))continue;
   C.push({t:'decor',dkind:'hollowwallrock',p:[q[0]-d[2]*Math.sin(angle)*radial,q[1]+r-Math.cos(angle)*radial,q[2]+d[0]*Math.sin(angle)*radial],s:[18,thickness,26],yaw:hollowYaw(s,branch),amp:angle*180/Math.PI,scenerySolid:false,castShadow:false,color:ring%4===0?'#a9a2b1':'#a3aebc',grp:hollowGroup(s),nm:'Slate formation embedded outside the round bore'});
  }
 }
 // The release well, sparse natural drains, dense timber works, then a torn
 // industrial throat: six different compositions within the same rock family.
 for(let s=16,i=0;s<2440;s+=43,i++){
  if(HOLLOWWAKE_ROOMS.some(r=>s>r.entry-15&&s<r.exit+22)||gaps.some(g=>Math.abs(s-g.s)<16))continue;
  const f=HOLLOWWAKE_FORKS.find(f=>s>f.a+48&&s<f.b-40),branches=f?[0,1]:[-1];
  if(!f&&HOLLOWWAKE_FORKS.some(f=>s>f.a-15&&s<f.b+15))continue;
  for(const branch of branches){
   const u=(i%2?1:-1)*8.9,scale=.85+(i%3)*.2;
   prop('hollowglowfungus',s,branch,u,hollowFloorRise(u)-.15,[2.3*scale,2.1*scale,2.1*scale],(i*37)%360,'Rooted blue cave fungus');
   if(s>400&&((s<780&&i%2===0)||(s>1200&&s<1600)||(s>2080&&i%2===1)))
    prop('hollowtimberrib',s+6,branch,0,-4.8,[34,32,3.2],0,'Buried-foot timber support ring');
   if(i%3===0)prop('hollowwallrock',s+11,branch,-Math.sign(u)*14,-1,[14,16,17],i*29,'Merchant Wreck slate outcrop');
  }
 }
 for(const s of [536,600,664,1370,1410,1450,1490,2220,2286,2350]){
  const fork=HOLLOWWAKE_FORKS.find(f=>s>f.a+58&&s<f.b-45);if(!fork)continue;
  for(const branch of [0,1])if(!gaps.some(g=>g.branch===branch&&s>g.s-5&&s<g.s+g.len+5))
   prop('hollowtimberrib',s,branch,0,-4.8,[34,32,3.2],0,'Timber-lined circular drain');
 }
 for(const [index,room]of HOLLOWWAKE_ROOMS.entries()){
  for(const edge of [room.entry,room.exit]){
   // Massive rock shoulders close the larger bore around the small refuge.
   prop('hollowwallrock',edge,-1,-11,-2,[16,27,12],15,'Refuge left rock shoulder');
   prop('hollowwallrock',edge,-1,11,-2,[16,27,12],195,'Refuge right rock shoulder');
   prop('hollowwallrock',edge,-1,0,10,[27,17,12],85,'Refuge stone lintel');
  }
  prop('hollowwallrock',room.exit+17,-1,0,13.3,[36,19,8],90,'Overhead release chute lintel');
  prop('hollowtimberrib',room.checkpoint,-1,0,-2,[14.2,13.3,2.6],0,'Low dry-pocket support');
  prop('hollowglowfungus',room.checkpoint+7,-1,-3.8,hollowFloorRise(3.8,5.2)-.12,[1.4,1.4,1.3],index*37,'Refuge fungus');
  prop('hollowfloodgate',room.entry-17,-1,index%2?14:-14,1,[13,13,2.7],index%2?90:-90,'Abandoned side-drain floodgate');
 }
 for(const [a,b]of skylights){
  const s=(a+b)/2,f=HOLLOWWAKE_FORKS.find(f=>s>f.a&&s<f.b);
  for(const branch of f?[0,1]:[-1]){
   prop('crowncrashskylight',s,branch,0,hollowRadius(s)*2-1,[12,4,b-a+5],0,'Broken roof rim admitting daylight');
   prop('treehousetrialssunshaft',s,branch,-1.5,1,[8,hollowRadius(s)*2,1],12,'Cold light through the roof opening');
  }
 }
 for(const gap of gaps){
  const p=hollowPoint(gap.s+gap.len/2,gap.branch,0,-5.5),w=22,d=gap.len+3;
  C.push({t:'mesh',p,vertices:[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2],indices:[0,2,1,0,3,2],normals:[0,1,0,0,1,0,0,1,0,0,1,0],materialStyle:'jungle-stream',color:'#1c525b',solid:false,yaw:hollowYaw(gap.s,gap.branch),grp:hollowGroup(gap.s),nm:'Water beneath the broken bore'});
 }
 prop('crownpaintedroyalhull',2558,-1,28,-24,[36,26,134],-22,'Distant Merchant Wreck silhouette');
 prop('hollowwallrock',2512,-1,-27,-9,[45,66,65],30,'Wreck cavern left cliff');
 prop('hollowwallrock',2520,-1,39,-10,[48,58,60],210,'Wreck cavern right cliff');
 return C;
}
