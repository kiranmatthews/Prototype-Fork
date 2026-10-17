import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';
import type { RaceKnot, RacePoint } from '../race/types';
import { RaceCourse } from '../race/course';
import { dressSlipstreamWaterslide } from './slipstream-waterslide';
import {WATERPARK_ISLAND_LOOK} from './slipstream-island';
import { SLIPSTREAM_2_GAPS, slipstream2Point, slipstream2Line } from './slipstream-2';

type Point = RacePoint;
const copy = <T>(v:T):T=>JSON.parse(JSON.stringify(v));
const lift = 660;
const shifted = (p:readonly number[]):Point=>[p[0],p[1]+lift,p[2]];
const distance = (a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

export function buildSlipstreamRace(base:CustomLevelData) {
  const oldGate=base.components.find(c=>c.t==='gate')!;
  const oldLine=base.components.filter(c=>c.t==='camnode'&&!c.cameraView).map(c=>c.p);
  // Trim the old line at its real finish, not the old camera run-out beyond it.
  const line:Point[]=[...oldLine.filter(p=>p[2]>oldGate.p[2]),[...oldGate.p]];
  line[0]=[base.spawn[0],line[0][1],base.spawn[2]];
  const originalLength=line.slice(1).reduce((n,p,i)=>n+distance(p,line[i]),0);
  const C:CustomComponent[]=copy(base.components).filter(c=>!['checkpoint','wumpa','crystal','clock','gate','rope','ropeswing'].includes(c.t)&&!(c.t==='camnode'&&!c.cameraView)&&!(c.t==='pit'&&c.nm?.endsWith('· open water')));
  for(const c of C){c.p=shifted(c.p);if(c.cameraPosition)c.cameraPosition=shifted(c.cameraPosition);if(c.cameraTarget)c.cameraTarget=shifted(c.cameraTarget);if(c.to)c.to=shifted(c.to);}
  const launch=C.find(c=>c.t==='platform'&&c.grp===100&&c.p[2]>0)!;
  launch.p[2]=18;launch.s![2]=48;launch.nm='Race starting grid';
  // Retain the original spaced, loose and moving platforms. The intervals
  // between them are real jump gaps, with a separate lower swimming route.
  const keyZ=Array.from({length:7},(_,i)=>-2158-i*10);
  function connector(a:Point,b:Point,width:number,name:string){
    C.push({t:'mesh',p:a,vertices:[-width/2,0,0,width/2,0,0,-width/2,b[1]-a[1],b[2]-a[2],width/2,b[1]-a[1],b[2]-a[2]],
      indices:[0,1,2,2,1,3],tex:'metal',color:'#d5b371',solid:true,vert:false,grp:302,nm:name});
  }

  // A returned rider starts at the lip, below the original long-gap kicker.
  // Extend its landing backwards so the ordinary charged jump can retry it.
  const finalGap=SLIPSTREAM_2_GAPS[SLIPSTREAM_2_GAPS.length-1];
  const landingStart=slipstream2Point(finalGap.b-8),landingEnd=slipstream2Point(finalGap.b+1);
  connector(shifted([landingStart[0]+16,landingStart[1]+60,landingStart[2]-898]),
    shifted([landingEnd[0]+16,landingEnd[1]+60,landingEnd[2]-898]),22,'Reservoir / race landing apron');
  C[C.length-1].grp=210;C[C.length-1].color='#368e9b';

  // The appended finale is one steep, banked sweep: two full falling coils,
  // then opposing turns into a broad finish straight. Scale its true 3D
  // sampled arc to exactly 33% of the original spawn-to-finish distance.
  const start=shifted(oldGate.p),raw:THREE.Vector3[]=[new THREE.Vector3(0,0,0),new THREE.Vector3(0,-5,-25)];
  for(let i=0;i<=32;i++){
    const t=i/32,angle=-t*Math.PI*4;
    raw.push(new THREE.Vector3(-52+52*Math.cos(angle),-20-540*t,-55+52*Math.sin(angle)));
  }
  raw.push(new THREE.Vector3(0,-580,-100),new THREE.Vector3(-32,-610,-175),new THREE.Vector3(32,-640,-265),new THREE.Vector3(0,-650,-340),new THREE.Vector3(0,-650,-390));
  const curve=new THREE.CatmullRomCurve3(raw,false,'centripetal');
  const sampled=curve.getSpacedPoints(600);
  const rawLength=sampled.slice(1).reduce((n,p,i)=>n+p.distanceTo(sampled[i]),0);
  const nav:RaceKnot[]=line.map(p=>[...shifted(p),16]);
  // The racing guide picks the open side of each ruined colonnade.
  for(const p of nav)if(p[2]<=-1468&&p[2]>=-1614){const q=slipstream2Line(-p[2]-930);p[0]=q[0]+16;}
  const baseRaceLength=nav.slice(1).reduce((n,p,i)=>n+distance(p,nav[i]),0);
  const factor=(originalLength*1.33-baseRaceLength)/rawLength;
  const finale:Point[]=sampled.map(p=>[start[0]+p.x*factor,start[1]+p.y*factor,start[2]+p.z*factor]);
  for(let i=1;i<finale.length;i++)nav.push([...finale[i],44]);
  for(const [index,a] of finale.entries()){
    if(index===finale.length-1)break;
    if(index%30!==0)continue;
    const end=Math.min(finale.length-1,index+30),vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
    const us=[-1,-.85,-.6,0,.6,.85,1];
    for(let k=index;k<=end;k++){
      const p=finale[k],pa=finale[Math.max(0,k-1)],pb=finale[Math.min(finale.length-1,k+1)];
      const dx=pb[0]-pa[0],dz=pb[2]-pa[2],n=Math.hypot(dx,dz)||1;
      // The racing lanes have no cross-slope. Projecting normal skating
      // onto a steep, uniformly banked helix deflects forward input sideways.
      // Raised shoulders keep the dished silhouette outside the riding lanes.
      const endT=THREE.MathUtils.clamp((finale.length-1-k)/24,0,1),endBlend=endT*endT*(3-2*endT);
      for(const u of us){vertices.push(p[0]-a[0]-dz/n*u*22,p[1]-a[1]+Math.max(0,(Math.abs(u)-.6)/.4)**2*8*endBlend,p[2]-a[2]+dx/n*u*22);uvs.push(u*2.75,k/5);}
      if(k>index)for(let j=0;j<us.length-1;j++){const q=(k-index-1)*us.length+j,m=q+us.length;indices.push(q,q+1,m,m,q+1,m+1);}
    }
    C.push({t:'mesh',p:a,vertices,indices,uvs,solid:true,vert:false,tex:'metal',color:index%60?'#328eaa':'#48acb8',grp:400,nm:'Skyfall / continuous falling coil'});
  }
  const finish=finale[finale.length-1];
  // A supported run-out belongs after the timing plane, not another warp pad.
  C.push({t:'platform',p:[finish[0],finish[1]-.6,finish[2]-18],s:[48,1.2,38],tex:'metal',color:'#d6c4a0',grp:401,nm:'Grand finish / run-out'});
  C.push({t:'gate',p:finish,yaw:0,grp:401,nm:'Grand skate-race finish line'});
  const majorJumps=[
    {takeoff:shifted([5.5,133,-735]),landing:shifted([7,126.8,-756])},
    ...SLIPSTREAM_2_GAPS.map(g=>{const a=slipstream2Point(g.a-7.5),b=slipstream2Point(g.b+8);return{takeoff:shifted([a[0]+16,a[1]+60,a[2]-898]),landing:shifted([b[0]+16,b[1]+60,b[2]-898])};}),
    {takeoff:shifted([-14,43.8,-2070.5]),landing:shifted([-14,41,-2087])},
    {takeoff:shifted([12,19.1,-2527.2]),landing:shifted([12,17,-2540])},
  ];
  const top=(y:number)=>y+12+lift;
  const platformJumps:{takeoff:Point;landing:Point}[]=[
    {takeoff:[16,top(26),-2150],landing:[16,top(26.3),-2156.5]},
    ...Array.from({length:6},(_,i)=>({takeoff:[16,top(26.3+i*.4),keyZ[i]-1.5] as Point,landing:[16,top(26.7+i*.4),keyZ[i+1]+1.5] as Point})),
    {takeoff:[16,top(28.7),-2219.5],landing:[16,top(29),-2225]},
    {takeoff:[16,top(29),-2288],landing:[16,top(29),-2294.5]},
    ...Array.from({length:2},(_,i)=>({takeoff:[16,top(29),-2297.5-i*10] as Point,landing:[16,top(29),-2304.5-i*10] as Point})),
    {takeoff:[16,top(29),-2317.5],landing:[16,top(28),-2324]},
  ];
  const route=new RaceCourse(nav);
  const jumps=[...majorJumps,...platformJumps].sort((a,b)=>route.project(new THREE.Vector3(...a.takeoff)).s-route.project(new THREE.Vector3(...b.takeoff)).s);
  const catchments:{takeoff:Point;landing:Point;surface?:number}[]=[...majorJumps,
    {takeoff:platformJumps[0].takeoff,landing:platformJumps[7].landing,surface:top(26)-1.4},
    {takeoff:platformJumps[8].takeoff,landing:platformJumps[11].landing,surface:top(28)-1.4},
  ];
  // A missed main-route jump lands in water and has a normal swimming route out.
  const pools=catchments.map((jump,i)=>{
    const group=420+i,width=i>=1&&i<=3?38:32;
    const start:Point=[jump.takeoff[0],jump.surface??jump.landing[1]-.9,jump.takeoff[2]+4];
    const end:Point=[jump.landing[0],start[1],jump.landing[2]-4];
    const dx=end[0]-start[0],dz=end[2]-start[2],length=Math.hypot(dx,dz),right=[-dz/length,dx/length];
    const floor=start[1]-3.6,exitRun=Math.min(12,length*.55),exitStart=1-exitRun/length;
    const point=(t:number,u:number,y:number):Point=>[start[0]+dx*t+right[0]*u,y,start[2]+dz*t+right[1]*u];
    const mesh=(name:string,rows:number[],heights:number[],water=false)=>{
      const vertices:number[]=[],indices:number[]=[];
      for(let row=0;row<rows.length;row++){
        for(const u of [-width/2,width/2]){const q=point(rows[row],u,heights[row]);vertices.push(q[0]-start[0],q[1]-start[1],q[2]-start[2]);}
        if(row){const a=(row-1)*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
      }
      C.push({t:'mesh',p:[...start],vertices,indices,tex:water?'solid':'stone',color:water?'#36a4b7':'#b9ae8f',solid:!water,vert:false,
        ...(water?{materialStyle:'water' as const,swimDepth:4,opacity:.84,edgeGrinding:false}:{}),grp:group,nm:name});
    };
    mesh(`Catch pool ${i+1} / water`,[0,1],[start[1],start[1]],true);
    // The bank becomes shallow before the edge, then joins the landing deck.
    mesh(`Catch pool ${i+1} / bed and downhill bank`,[0,exitStart,1],[floor,floor,jump.landing[1]]);
    const wallHeight=3.85,yaw=-Math.atan2(dx,-dz)*180/Math.PI;
    for(const side of [-1,1])C.push({t:'wall',p:point(.5,side*(width/2+.4),floor),s:[.8,wallHeight,length+.8],yaw,tex:'stone',color:'#aa9b7c',grp:group,nm:`Catch pool ${i+1} / side rim`});
    C.push({t:'wall',p:point(0,0,floor),s:[width+.8,wallHeight,.8],yaw,tex:'stone',color:'#aa9b7c',grp:group,nm:`Catch pool ${i+1} / upstream rim`});
    return {group,start,end,width,surface:start[1],floor,exitStart:point(exitStart,0,floor),landing:jump.landing,takeoff:jump.takeoff};
  });
  for(const c of C)if(c.t==='crate'){
    if(c.kind!=='tnt'&&c.kind!=='nitro')c.kind='empty';
    delete c.outline;
  }
  // Authored against the road footprint and clearance on both sides of each row.
  const itemRows=[70,195,320,570,695,820,945,1070,1195,1320,1445,1558,1699,1949,2098,2320,2445,2699,2820,2945,3195,3320,3445,3570,3695,3820,3945];
  let row=0;
  for(const authored of itemRows){
    let at=authored;const rowPoint=route.sample(at);
    if(rowPoint.z<-2152&&rowPoint.z>-2223)at=route.project(new THREE.Vector3(16,top(26),-2144)).s;
    if(rowPoint.z<-2290&&rowPoint.z>-2322)at=route.project(new THREE.Vector3(16,top(29),-2284)).s;
    row++;
    for(const [slot,offset]of [-4.2,-1.4,1.4,4.2].entries()){
      const p=route.sample(at,offset);
      C.push({t:'crate',kind:'mystery',p:p.toArray() as Point,grp:410,nm:`Item row ${row} / ${slot+1}`});
    }
  }
  for(const p of nav)C.push({t:'camnode',p:[p[0],p[1],p[2]],grp:402});
  C.push({t:'camnode',p:[finish[0],finish[1],finish[2]-30],grp:402});
  const extensionLength=finale.slice(1).reduce((n,p,i)=>n+distance(p,finale[i]),0);
  dressSlipstreamWaterslide(C,nav,pools,jumps);
  const data:CustomLevelData={...base,...WATERPARK_ISLAND_LOOK,name:'The Slipstream',spawn:[0,base.spawn[1]+lift,18],startWarpPad:false,
    killY:Math.min(finish[1]-40,-24),cameraAirLift:.8,perfectGrindBoost:true,allBalanceCrates:false,
    medalTimes:{gold:170,silver:215,bronze:280},components:C,
    groups:[...(base.groups??[]),...pools.map((pool,i)=>({id:pool.group,nm:`Catch pool ${i+1}`,editorOnly:true})),{id:400,nm:'IV · Skyfall / steep double coil',editorOnly:true},{id:401,nm:'Grand finish',editorOnly:true},{id:402,nm:'Race navigation',editorOnly:true},{id:410,nm:'Item rows',editorOnly:true},{id:430,nm:'Abandoned waterpark',editorOnly:true},{id:431,nm:'Fiberglass joints and flanges',editorOnly:true},{id:432,nm:'Tropical forest',editorOnly:true},{id:433,nm:'Island matte depth',editorOnly:true},{id:434,nm:'Enclosed flumes',editorOnly:true}],
    skateRace:{v:1,racers:8,seed:19410,stages:['Slipstream 1','Slipstream 2','Chimeworks','Skyfall'],line:nav,jumps,finishWidth:44,originalLength},
  };
  return {data,stats:{originalLength,extensionLength,baseRaceLength,ratio:(baseRaceLength+extensionLength)/originalLength,drop:start[1]-finish[1],finish,knots:nav.length,pools,platformJumps}};
}
