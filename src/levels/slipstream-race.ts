import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';
import type { RaceKnot, RacePoint } from '../race/types';
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
  const C:CustomComponent[]=copy(base.components).filter(c=>!['checkpoint','wumpa','crystal','clock','gate','rope','ropeswing'].includes(c.t)&&!(c.t==='camnode'&&!c.cameraView));
  for(const c of C){c.p=shifted(c.p);if(c.cameraPosition)c.cameraPosition=shifted(c.cameraPosition);if(c.cameraTarget)c.cameraTarget=shifted(c.cameraTarget);if(c.to)c.to=shifted(c.to);}
  const launch=C.find(c=>c.t==='platform'&&c.grp===100&&c.p[2]>0)!;
  launch.p[2]=18;launch.s![2]=48;launch.nm='Race starting grid';
  // The instrumental section keeps its keys, crushers and optional strings,
  // but the principal route supports continuous skating by all eight racers.
  const keyZ=Array.from({length:7},(_,i)=>-2158-i*10);
  for(const c of C){
    if((c.t==='platform'||c.t==='crumble')&&c.grp===302&&keyZ.includes(c.p[2])){
      if(c.t==='crumble'){c.t='platform';c.p[1]-=.3;c.s=[16,.6,7];delete c.shake;delete c.speed;}
      else c.s![0]=16;
      c.p[0]=16;
    }
    if(c.t==='mover'&&c.grp===304){c.t='platform';c.p[1]-=.35;c.p[0]=16;c.s=[18,.7,7];delete c.axis;delete c.amp;delete c.speed;delete c.phase;c.nm='Race sliding-key deck';}
  }
  function connector(a:Point,b:Point,width:number,name:string){
    C.push({t:'mesh',p:a,vertices:[-width/2,0,0,width/2,0,0,-width/2,b[1]-a[1],b[2]-a[2],width/2,b[1]-a[1],b[2]-a[2]],
      indices:[0,1,2,2,1,3],tex:'metal',color:'#d5b371',solid:true,gravityTrack:true,grp:302,nm:name});
  }
  const top=(y:number)=>y+12+lift;
  connector([16,top(26),-2152],[16,top(26.3),-2154.5],14,'Xylophone race entry');
  for(let i=0;i<6;i++)connector([16,top(26.3+i*.4),keyZ[i]-3.5],[16,top(26.7+i*.4),keyZ[i+1]+3.5],14,'Xylophone gold key link');
  connector([16,top(28.7),-2221.5],[16,top(29),-2223],14,'Xylophone race exit');
  connector([16,top(29),-2290],[16,top(29),-2292.5],16,'Hammer race entry');
  for(let i=0;i<2;i++)connector([16,top(29),-2299.5-i*10],[16,top(29),-2302.5-i*10],16,'Hammer race key link');
  connector([16,top(29),-2319.5],[16,top(28),-2322],16,'Hammer race exit');

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
      const prev=finale[Math.max(0,k-2)],next=finale[Math.min(finale.length-1,k+2)];
      const ax=pa[0]-prev[0],az=pa[2]-prev[2],bx=next[0]-pb[0],bz=next[2]-pb[2];
      const turn=Math.atan2(ax*bz-az*bx,ax*bx+az*bz);
      const curvature=turn/(Math.hypot(pb[0]-pa[0],pb[2]-pa[2])||1);
      // Raise the outside of each bend. An inverted bank pushes riders off
      // the falling coil at speed, even when their steering follows its line.
      const bank=-THREE.MathUtils.clamp(curvature*120,-4,4);
      const endT=THREE.MathUtils.clamp((finale.length-1-k)/24,0,1),endBlend=endT*endT*(3-2*endT);
      for(const u of us){vertices.push(p[0]-a[0]-dz/n*u*22,p[1]-a[1]+(u*bank+Math.max(0,(Math.abs(u)-.6)/.4)**2*8)*endBlend,p[2]-a[2]+dx/n*u*22);uvs.push(u*2.75,k/5);}
      if(k>index)for(let j=0;j<us.length-1;j++){const q=(k-index-1)*us.length+j,m=q+us.length;indices.push(q,q+1,m,m,q+1,m+1);}
    }
    C.push({t:'mesh',p:a,vertices,indices,uvs,solid:true,gravityTrack:true,tex:'metal',color:index%60?'#328eaa':'#48acb8',grp:400,nm:'Skyfall / continuous falling coil'});
  }
  const finish=finale[finale.length-1];
  // A supported run-out belongs after the timing plane, not another warp pad.
  C.push({t:'platform',p:[finish[0],finish[1]-.6,finish[2]-18],s:[48,1.2,38],tex:'metal',color:'#d6c4a0',grp:401,nm:'Grand finish / run-out'});
  C.push({t:'gate',p:finish,yaw:0,grp:401,nm:'Grand skate-race finish line'});
  let crateIndex=0;
  for(const c of C)if(c.t==='crate'){
    if(c.kind!=='tnt'&&c.kind!=='nitro')c.kind=crateIndex++%4===0?'mystery':'empty';
    delete c.outline;
  }
  // Repeated item rows, separated from jump lips and the instrumental hazards.
  for(const s of [42,102,230,385,500,698,836]){
    const q=slipstream2Point(s);for(const x of [-4,0,4])C.push({t:'crate',kind:'mystery',p:[q[0]+16+x,q[1]+60+lift,q[2]-898],grp:210,nm:'Race item row'});
  }
  for(let i=50;i<550;i+=80){const p=finale[i];C.push({t:'crate',kind:'mystery',p:[...p],grp:400,nm:'Skyfall item box'});}
  for(const p of nav)C.push({t:'camnode',p:[p[0],p[1],p[2]],grp:402});
  C.push({t:'camnode',p:[finish[0],finish[1],finish[2]-30],grp:402});
  const jumps=[
    {takeoff:shifted([5.5,133,-735]),landing:shifted([7,126.8,-756])},
    ...SLIPSTREAM_2_GAPS.map(g=>{const a=slipstream2Point(g.a-7.5),b=slipstream2Point(g.b+8);return{takeoff:shifted([a[0]+16,a[1]+60,a[2]-898]),landing:shifted([b[0]+16,b[1]+60,b[2]-898])};}),
    {takeoff:shifted([-14,43.8,-2070.5]),landing:shifted([-14,41,-2087])},
    {takeoff:shifted([12,19.1,-2527.2]),landing:shifted([12,17,-2540])},
  ];
  const extensionLength=finale.slice(1).reduce((n,p,i)=>n+distance(p,finale[i]),0);
  const data:CustomLevelData={...base,name:'The Slipstream',spawn:[0,base.spawn[1]+lift,18],startWarpPad:false,
    killY:Math.min(finish[1]-40,-24),cameraAirLift:.8,perfectGrindBoost:true,allBalanceCrates:false,
    medalTimes:{gold:170,silver:215,bronze:280},components:C,
    groups:[...(base.groups??[]),{id:400,nm:'IV · Skyfall / steep double coil',editorOnly:true},{id:401,nm:'Grand finish',editorOnly:true},{id:402,nm:'Race navigation',editorOnly:true}],
    skateRace:{v:1,racers:8,seed:19410,stages:['Slipstream 1','Slipstream 2','Chimeworks','Skyfall'],line:nav,jumps,finishWidth:44,originalLength},
  };
  return {data,stats:{originalLength,extensionLength,baseRaceLength,ratio:(baseRaceLength+extensionLength)/originalLength,drop:start[1]-finish[1],finish,knots:nav.length}};
}
