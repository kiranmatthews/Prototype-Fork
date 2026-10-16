import type {CustomComponent,CustomLevelData} from '../level';
import {hollowwakeArt} from './hollowwake-art';
import {hollowwakeEnemies,hollowEnemyClearance} from './hollowwake-enemies';
export {HOLLOWWAKE_ENCOUNTERS} from './hollowwake-enemies';
import {HOLLOWWAKE_END,HOLLOWWAKE_BOULDER_RADIUS,HOLLOWWAKE_ACTS,HOLLOWWAKE_ROOMS,HOLLOWWAKE_FORKS,hollowCentre,hollowPoint,hollowTangent,hollowYaw,hollowGroup,hollowRadius,hollowFloorRise,hollowGapApplies,type HollowPoint} from './hollowwake-route';
export * from './hollowwake-route';
export const HOLLOWWAKE_ID='hollowwake-descent';
const C:CustomComponent[]=[];
export const HOLLOWWAKE_GAPS=[
 {s:164,len:8,branch:-1},{s:228,len:8,branch:0},{s:272,len:8,branch:1},
 {s:474,len:9,branch:-1},{s:552,len:9,branch:0},{s:622,len:9,branch:1},{s:638,len:9,branch:0},
 {s:870,len:9,branch:-1},{s:936,len:10,branch:0},{s:1024,len:9,branch:1},{s:1040,len:10,branch:0},
 {s:1288,len:10,branch:-1},{s:1372,len:10,branch:1},{s:1430,len:10,branch:0},{s:1466,len:10,branch:1},
 {s:1748,len:10,branch:-1},{s:1816,len:10,branch:0},{s:1874,len:10,branch:1},{s:1924,len:10,branch:0},
 {s:2164,len:10,branch:-1},{s:2238,len:10,branch:0},{s:2266,len:10,branch:1},{s:2314,len:10,branch:0},{s:2324,len:10,branch:1},{s:2436,len:30,branch:-1},
];
export const HOLLOWWAKE_TUNNELS:{a:number;b:number;branch:number;radius:number}[]=[];
function otherBoreDistance(point:HollowPoint,s:number,branch:number):number{
 if(branch<0)return Infinity;
 let at=s;for(let i=0;i<3;i++){const q=hollowCentre(at,1-branch),d=hollowTangent(at,1-branch);at+=(point[0]-q[0])*d[0]+(point[2]-q[2])*d[2];}
 const f=HOLLOWWAKE_FORKS.find(f=>at>=f.a&&at<=f.b);if(!f)return Infinity;
 const q=hollowCentre(at,1-branch),d=hollowTangent(at,1-branch),x=(point[0]-q[0])*-d[2]+(point[2]-q[2])*d[0],y=point[1]-q[1]-hollowRadius(at);
 // Retain overlap for the chord error of the faceted collision skins.
 // Without it both bores discard the same thin strip down their joined floor.
 return Math.hypot(x,y)-hollowRadius(at)+.18;
}
function tube(a:number,b:number,branch=-1):void{
 const p=hollowPoint(a,branch),vertices:number[]=[],normals:number[]=[],indices:number[]=[],stations:number[]=[],angles=48,rows=Math.ceil((b-a)/4.5);
 const world:HollowPoint[]=[];
 for(let j=0;j<=rows;j++){
  const s=a+(b-a)*j/rows,q=hollowPoint(s,branch),d=hollowTangent(s,branch),r=hollowRadius(s);stations.push(s);
  for(let i=0;i<angles;i++){const t=i*Math.PI*2/angles,u=r*Math.sin(t),y=r*(1-Math.cos(t)),v:HollowPoint=[q[0]-d[2]*u,q[1]+y,q[2]+d[0]*u];world.push(v);vertices.push(...v.map((n,k)=>Math.round((n-p[k])*1e5)/1e5));normals.push(...[d[2]*Math.sin(t),Math.cos(t),-d[0]*Math.sin(t)].map(n=>Math.round(n*1e6)/1e6));}
 }
 const triangle=(ids:number[],s:number,angle:number)=>{
  if(HOLLOWWAKE_GAPS.some(g=>hollowGapApplies(g,branch)&&s>=g.s&&s<=g.s+g.len)&&Math.cos(angle)>.55)return;
  const distances=ids.map(id=>otherBoreDistance(world[id],s,branch));
  if(distances.every(d=>d>=0)){indices.push(...ids);return;}
  if(distances.every(d=>d<0))return;
  const polygon:number[]=[];
  for(let i=0;i<3;i++){
   const a=ids[i],b=ids[(i+1)%3],da=distances[i],db=distances[(i+1)%3];if(da>=0)polygon.push(a);
   if((da>=0)!==(db>=0)){
    let lo=0,hi=1;for(let j=0;j<12;j++){const t=(lo+hi)/2,v=world[a].map((n,k)=>n+(world[b][k]-n)*t) as HollowPoint;if((otherBoreDistance(v,s,branch)>=0)===(da>=0))lo=t;else hi=t;}
    const t=(lo+hi)/2,v=world[a].map((n,k)=>n+(world[b][k]-n)*t) as HollowPoint,id=world.length;world.push(v);vertices.push(...v.map((n,k)=>Math.round((n-p[k])*1e5)/1e5));
    const normal=[0,1,2].map(k=>normals[a*3+k]+(normals[b*3+k]-normals[a*3+k])*t),length=Math.hypot(...normal);normals.push(...normal.map(n=>Math.round(n/length*1e6)/1e6));polygon.push(id);
   }
  }
  for(let i=1;i<polygon.length-1;i++)indices.push(polygon[0],polygon[i],polygon[i+1]);
 };
 for(let j=0;j<rows;j++)for(let i=0;i<angles;i++){
  const n=(i+1)%angles,lo=j*angles,hi=(j+1)*angles,s=(stations[j]+stations[j+1])/2,t=(i+.5)*Math.PI*2/angles;
  triangle([lo+i,lo+n,hi+i],s,t);triangle([lo+n,hi+n,hi+i],s,t);
 }
 C.push({t:'mesh',p,vertices,normals,indices,solid:true,solidSides:true,vert:true,doubleSided:true,invisible:true,
  edgeGrinding:false,grp:hollowGroup((a+b)/2),nm:'Seamless circular tunnel collision · no exposed coping'});
 HOLLOWWAKE_TUNNELS.push({a,b,branch,radius:hollowRadius((a+b)/2)});
}
const cuts=new Set([-65,HOLLOWWAKE_END+35,...HOLLOWWAKE_ROOMS.flatMap(r=>[r.entry,r.exit]),...HOLLOWWAKE_FORKS.flatMap(f=>[f.a,f.b])]);
for(let s=-65;s<HOLLOWWAKE_END+35;s+=70)cuts.add(s);
for(const g of HOLLOWWAKE_GAPS){cuts.add(g.s);cuts.add(g.s+g.len);}
const bounds=[...cuts].sort((a,b)=>a-b);
for(let i=1;i<bounds.length;i++){const a=bounds[i-1],b=bounds[i],mid=(a+b)/2,fork=HOLLOWWAKE_FORKS.find(f=>mid>f.a&&mid<f.b);if(fork){tube(a,b,0);tube(a,b,1);}else tube(a,b);}
export const HOLLOWWAKE_OBSTACLES:{s:number;branch:number;u:number;kind:string}[]=[];
function box(s:number,branch=-1,u=0,kind:CustomComponent['kind']='wood'){
 if(hollowEnemyClearance(s,branch))return;
 C.push({t:'crate',p:hollowPoint(s,branch,u,hollowFloorRise(u,hollowRadius(s))),kind,grp:hollowGroup(s),nm:'Abandoned tunnel supplies'});
 if(kind==='metal'||kind==='nitro')HOLLOWWAKE_OBSTACLES.push({s,branch,u,kind});
}
function fruit(a:number,b:number,branch=-1,u=0){for(let s=a;s<=b;s+=11)C.push({t:'wumpa',p:hollowPoint(s,branch,u,hollowFloorRise(u,hollowRadius(s))+1),grp:hollowGroup(s),nm:'Escape line'});}
box(32,-1,3,'mask');box(58,-1,-3);box(61,-1,-3);fruit(12,82);
// Six authored acts progressively combine jumps, alternating crate gates,
// broken-footing choices and sweeping grind routes. Their scenery is separate.
for(const [index,act]of HOLLOWWAKE_ACTS.entries()){
 const count=Math.min(2+index*2,Math.floor((act.b-act.a-100)/29));
 for(let k=0;k<count;k++){
  const s=act.a+65+(act.b-act.a-100)*k/count;if(s<0)continue;
  const f=HOLLOWWAKE_FORKS.find(f=>s>=f.a&&s<=f.b);
  if(f&&(s<f.a+55||s>f.b-55))continue; // leave the shared split/merge throat clear
  const branches=f?[0,1]:[-1];
  for(const branch of branches){
   if(hollowEnemyClearance(s,branch))continue;
   if(HOLLOWWAKE_GAPS.some(g=>hollowGapApplies(g,branch)&&s>g.s-18&&s<g.s+g.len+(g.branch<0?48:26)))continue;
   const side=(k+branch+index)%2?1:-1;box(s,branch,side*3.5,index>2&&k%3===0?'nitro':'metal');
   if(index>0)box(s,branch,0,'metal');
   if(index>1){box(s+2.2,branch,side*5.5,'metal');box(s+5,branch,-side*3,'wood');}
  }
 }
}
for(const f of HOLLOWWAKE_FORKS)for(const branch of [0,1]){
 fruit(f.a+18,f.b-14,branch);
 const side=branch===0?-1:1,u=side*6.3,lo=f.a+48,hi=f.b-38,p=hollowPoint(lo,branch,u,hollowFloorRise(u)+.7),pts:NonNullable<CustomComponent['pts']>=[];
 for(let s=lo;s<=hi;s+=3){const q=hollowPoint(s,branch,u,hollowFloorRise(u)+.7);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
 C.push({t:'rail',p,pts,dkind:'bw-grind-rail',grp:hollowGroup(lo),nm:f.name+' · old drain rail'});
}
for(const [i,room]of HOLLOWWAKE_ROOMS.entries()){
 C.push({t:'checkpoint',p:hollowPoint(room.checkpoint),grp:30+i,nm:room.name+' checkpoint'});
 C.push({t:'tumblezone',checkpointTrip:true,p:hollowPoint(room.entry+.3,-1,0,5),s:[10.4,12,1.1],yaw:hollowYaw(room.entry),grp:30+i,nm:room.name+' stone threshold'});
 box(room.checkpoint+4,-1,-2.5);box(room.checkpoint-3,-1,2.5,'mystery');
 C.push({t:'pit',p:hollowPoint((room.entry+room.exit)/2,-1,0,-10),s:[60,1,40],invisible:true,grp:30+i,nm:'Refuge undersurface recovery'});
}
for(const g of HOLLOWWAKE_GAPS)C.push({t:'pit',p:hollowPoint(g.s+g.len/2,g.branch,0,-7),s:[g.branch<0?52:18,1,g.len+2],yaw:hollowYaw(g.s,g.branch),invisible:true,grp:hollowGroup(g.s),nm:'Open tunnel-floor break'});
// The last stone drops into a real flooded break. A narrow decayed timber
// catwalk carries the runner over it and sheds its boards behind them.
for(let s=2437.5;s<2466;s+=3)C.push({t:'crumble',p:hollowPoint(s,-1,0,.12),s:[4.5,.12,3.4],yaw:hollowYaw(s),shake:.08,speed:36,tex:'bridge-timber',grp:16,nm:'Wreck throat collapsing catwalk'});
C.push({t:'clock',p:hollowPoint(3,-1,4,hollowFloorRise(4)),nm:'Hollowwake time trial'});
C.push({t:'gate',p:hollowPoint(HOLLOWWAKE_END),yaw:hollowYaw(HOLLOWWAKE_END),nm:'Passage toward the Merchant Wreck'});
for(let s=HOLLOWWAKE_END+40;s>=-65;s-=6)C.push({t:'camnode',p:hollowPoint(s),grp:1,nm:'Stable reverse chase lane'});
const boulderPoint=(s:number,branch=-1):HollowPoint=>{
 const p=hollowPoint(s,branch),R=HOLLOWWAKE_BOULDER_RADIUS;let support=-Infinity;
 // A sphere contacts the uphill part of a slope and both lips of a gap.
 // Measure that envelope instead of adding its radius straight above a point.
 const samples=Array.from({length:53},(_,i)=>s-R+(2*R)*i/52);
 for(const g of HOLLOWWAKE_GAPS)if(hollowGapApplies(g,branch)&&Math.abs(g.s-s)<R+g.len)samples.push(g.s,g.s+g.len);
 for(const at of samples){
  if(HOLLOWWAKE_GAPS.some(g=>hollowGapApplies(g,branch)&&at>g.s+.001&&at<g.s+g.len-.001))continue;
  const q=hollowPoint(at,branch),d=Math.hypot(p[0]-q[0],p[2]-q[2]);if(d<R)support=Math.max(support,q[1]+Math.sqrt(R*R-d*d)-R);
 }
 if(Number.isFinite(support))p[1]=support+.035;return p;
};
function boulderPath(a:number,b:number,branch=-1,step=3):HollowPoint[]{
 const stations=new Set([a,b]);for(let s=a;s<b;s+=step)stations.add(s);
 for(const g of HOLLOWWAKE_GAPS)if(hollowGapApplies(g,branch)&&g.s<b&&g.s+g.len>a)for(let s=Math.max(a,g.s);s<=Math.min(b,g.s+g.len);s+=.5)stations.add(s);
 return [...stations].sort((a,b)=>a-b).map(s=>boulderPoint(s,branch));
}
C.push(...hollowwakeEnemies(),...hollowwakeArt(HOLLOWWAKE_GAPS));
export const HOLLOWWAKE_LEVEL:CustomLevelData={v:1,name:'Hollowwake Descent',spawn:hollowPoint(0,-1,0,.15),killY:-110,startWarpPad:false,sky:'carlisle',keepPlayFog:true,
 atmosphere:{backdrop:'fog',fogEnabled:true,fogNear:30,fogFar:125,fogColor:'#101920',ambientSky:'#7c9cae',ambientGround:'#292d35',ambientIntensity:.85,sunColor:'#cbdde5',sunIntensity:.65,fillColor:'#4c9da8',fillIntensity:.4,drawDistance:170,shadowStrength:.85},
 medalTimes:{gold:135,silver:165,bronze:205},cameraAirLift:.6,
 boulderChase:{cameraMode:'tunnel',cameraPath:Array.from({length:862},(_,i)=>hollowPoint(-62+i*3)),path:boulderPath(-62,2441),radius:HOLLOWWAKE_BOULDER_RADIUS,speed:25,paces:[24,25,26,26,27,28],headStart:28,openingDrop:false,
  shelters:HOLLOWWAKE_ROOMS.map(r=>({entry:hollowPoint(r.entry),exit:hollowPoint(r.exit)})),
  forks:HOLLOWWAKE_FORKS.map(f=>({paths:[0,1].map(branch=>boulderPath(f.a,f.b,branch,2))}))},
 groups:[{id:1,nm:'Camera/input lane',editorOnly:true},{id:16,nm:'Wreck threshold',editorOnly:true},...HOLLOWWAKE_ACTS.map(a=>({id:a.group,nm:a.name,editorOnly:true})),...HOLLOWWAKE_ROOMS.map((r,i)=>({id:30+i,nm:r.name,editorOnly:true}))],components:C};
export const HOLLOWWAKE_LENGTH=Array.from({length:2480},(_,i)=>{const a=hollowPoint(i),b=hollowPoint(i+1);return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);}).reduce((a,b)=>a+b,0);
