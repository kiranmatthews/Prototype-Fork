import * as THREE from 'three';
import type {CustomComponent} from '../level';
import type {RaceKnot,RacePoint} from '../race/types';
import {RaceCourse} from '../race/course';
import {WATERPARK_TUNNELS} from './slipstream-island';
import gardens from './slipstream-midground-gardens.json';

const up=new THREE.Vector3(0,1,0);
const round=(n:number)=>Math.round(n*10000)/10000;
const tuple=(p:THREE.Vector3)=>p.toArray().map(round) as RacePoint;
const noise=(n:number)=>{const x=Math.sin(n*73.71+9.12)*43758.5453;return x-Math.floor(x);};

/** Real Meshy geology surrounds the ride. Full rotated bounds are checked
 * against every stacked leg; none of these visual additions owns collision. */
export function buildSlipstreamMidground(line:RaceKnot[],terrain:CustomComponent[]):CustomComponent[]{
 const course=new RaceCourse(line),C:CustomComponent[]=[];
 const samples=Array.from({length:Math.ceil(course.length/4)+1},(_,i)=>({p:course.sample(i*4),w:course.width(i*4)}));
 const floors=terrain.filter(c=>c.nm==='Tropical forest / sculpted understory floor');
 const ground=(x:number,z:number)=>{
  const c=floors.find(c=>z<=c.p[2]&&z>=c.p[2]-160&&x>=-240&&x<=240);if(!c)return null;
  const u=(x+240)/20,v=(c.p[2]-z)/16,i=Math.min(23,Math.floor(u)),j=Math.min(9,Math.floor(v));
  const a=j*25+i,b=a+1,d=a+25,e=d+1,tx=u-i,tz=v-j,y=(k:number)=>c.vertices![k*3+1]+c.p[1];
  return tx+tz<=1?y(a)+(y(b)-y(a))*tx+(y(d)-y(a))*tz:y(e)+(y(d)-y(e))*(1-tx)+(y(b)-y(e))*(1-tz);
 };
 const clear=(p:THREE.Vector3,size:RacePoint,yaw:number)=>{
  const a=-yaw*Math.PI/180;
  return samples.every(({p:q,w})=>{
   if(q.y+26<p.y||q.y-5>p.y+size[1])return true;
   const local=q.clone().sub(p).applyAxisAngle(up,a);
   const dx=Math.max(0,Math.abs(local.x)-size[0]/2),dz=Math.max(0,Math.abs(local.z)-size[2]/2);
   return Math.hypot(dx,dz)>w/2+6;
  });
 };
 const prop=(kind:CustomComponent['dkind'],p:THREE.Vector3,size:RacePoint,yaw:number,name:string)=>{
  p=p.clone();size=[...size];
  // The high forest ends here; a shelf beyond its edge would float above
  // the descending coils. Sea-rooted towers own the lower transition.
  if(p.z < -2370 && p.y > 500 && !name.includes('crown'))return false;
  if(p.y>650){
   const top=p.y+size[1],roots=[new THREE.Vector3(0,0,0),new THREE.Vector3(-.35,0,-.35),new THREE.Vector3(.35,0,.35),new THREE.Vector3(-.35,0,.35),new THREE.Vector3(.35,0,-.35)];
   for(const q of roots){q.multiply(new THREE.Vector3(size[0],1,size[2])).applyAxisAngle(up,yaw*Math.PI/180).add(p);const h=ground(q.x,q.z);if(h!==null)p.y=Math.min(p.y,h-4);}
   size[1]=top-p.y;
  }
  if(!clear(p,size,yaw))return false;
  C.push({t:'decor',dkind:kind,p:tuple(p),s:size.map(round) as RacePoint,yaw:round(yaw),scenerySolid:false,
   castShadow:size[1]<100,color:kind==='waterslideislandheadland'?'#fff4df':'#cddac9',grp:437,nm:'Island midground / '+name});return true;
 };
 // Interlocking shelves, rather than a row of identical columns. Their
 // faces rise above the slide, and their low roots overlap the forest floor.
 for(let s=20,i=0;s<3090;s+=43,i++)for(const side of [-1,1]){
  const at=course.sample(s+side*7),f=course.tangent(s).setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x);
  const height=30+noise(i+side*79)*16,width=45+noise(i+31)*24,depth=28+noise(i+17)*13;
  const yaw=Math.atan2(-side*right.x,-side*right.z)*180/Math.PI+(noise(i+side*11)-.5)*24;
  const size:RacePoint=[width,height,depth],kind=i%3===0?'waterslideislandcliff':'waterslideislandheadland';
  for(let d=course.width(s)/2+depth/2+11;d<110;d+=8){
   const p=at.clone().addScaledVector(right,side*d);p.y-=height*.83;
   if(prop(kind,p,size,yaw,'overlapping jungle escarpment'))break;
  }
  // An upper, offset ridge gives the palm silhouettes a second depth plane.
  if(i%3===1){const size:RacePoint=[95+noise(i)*35,65+noise(i+1)*35,60];
   for(let d=85;d<190;d+=12){const p=at.clone().addScaledVector(right,side*d).addScaledVector(f,18);p.y-=42;
    if(prop('waterslideislandheadland',p,size,yaw+side*18,'layered headland behind the gorge'))break;
   }
  }
 }
 // Small planted ledges sit beside the open flume, below the tall ridge line.
 // Their stone roots reach the same terrain as the larger cliff masses.
 for(let s=65;s<3070;s+=88){
  if(WATERPARK_TUNNELS.some(([a,b])=>s>a-12&&s<b+12))continue;
  const p=course.sample(s),f=course.tangent(s).setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x);
  for(const side of [-1,1]){
   const q=p.clone().addScaledVector(right,side*(course.width(s)/2+15));q.y-=23;
   prop('waterslideislandcliff',q,[14,27,11],Math.atan2(-side*right.x,-side*right.z)*180/Math.PI,'planted flume-side ledge');
  }
 }
 // The spiral opens onto a real archipelago of near rock towers. These span
 // sea level to their crown; no floating skirts or flat vertical paintings.
 const towers: Array<[number,number,number,number,number,number,number]>=[
  [160,-2405,116,185,600,160,-15],
  [-260,-2580,116,205,430,180,38], [170,-2680,116,150,270,130,-48],
  [-195,-2770,116,180,260,150,28], [275,-2500,116,245,545,205,-65],
  [-420,-2630,116,260,410,210,56], [315,-2810,116,200,280,170,-35],
  [-135,-2900,116,110,145,95,15], [155,-2940,116,145,120,120,-38],
  [-300,-2920,116,200,215,165,76], [435,-2585,116,230,360,185,-38],
  [-96,-2805,116,85,180,75,29], [113,-2800,116,82,155,72,-12],
  [-90,-2945,116,95,125,85,38],
  [200,-2930,116,180,430,150,-28], [-125,-2830,116,130,420,110,32],
  [40,-3050,116,150,330,130,-12],
 ];
 for(const [i,[x,z,y,w,h,d,yaw]]of towers.entries()){
  const p=new THREE.Vector3(x,y,z);
  if(!prop('waterslideislandspire',p,[w,h,d],yaw,'lagoon sea-cliff tower'))continue;
  // A broad, jagged headland crowns the tall rock's existing upper ledges.
  const crown=p.clone().add(new THREE.Vector3(i%2?7:-6,h*.68,0));
  prop('waterslideislandheadland',crown,[w*1.16,h*.34,d*1.12],yaw+27,'lagoon headland crown');
 }
 // Foothills read during the final low approach and conceal the tower bases.
 for(const [i,[s,side]]of [[3820,-1],[3885,1],[3950,-1],[4020,1],[4110,-1]].entries()){
  const p=course.sample(s),f=course.tangent(s).setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x),size:RacePoint=[68,65-i*5,52];
  for(let d=67;d<150;d+=9){const q=p.clone().addScaledVector(right,side*d);q.y=120;
   if(prop('waterslideislandheadland',q,size,side*70+i*19,'finish lagoon foothill'))break;
  }
 }
 // Root flowering drapes on the authored outer lip, outside the riding
 // lanes. The seven-column coil mesh supplies exact anchors, even on banks.
 for(const c of terrain.filter(c=>c.nm==='Skyfall / continuous falling coil'&&c.vertices)){
  const rows=c.vertices!.length/21;
  for(let row=5;row<rows;row+=10)for(const side of [-1,1]){
   const k=(row*7+(side<0?0:6))*3,edge=new THREE.Vector3().fromArray(c.vertices!,k).add(new THREE.Vector3(...c.p));
   const s=course.project(edge).s;if(s>3970||WATERPARK_TUNNELS.some(([a,b])=>s>a-7&&s<b+7))continue;
   const f=course.tangent(s).setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x),at=edge.clone().addScaledVector(right,side*.7);
   if(samples.some(({p:q,w},i)=>Math.abs(i*4-s)>45&&Math.abs(q.y-at.y)<12&&Math.hypot(q.x-at.x,q.z-at.z)<w/2+3))continue;
   const yaw=Math.atan2(-side*right.x,-side*right.z)*180/Math.PI;
   C.push({t:'decor',dkind:'bayvine',p:tuple(at.clone().add(new THREE.Vector3(0,-5.6,0))),s:[4.2,5.7,1],yaw:round(yaw),scenerySolid:false,grp:438,nm:'Island midground garden / flowering drape rooted on flume lip'});
   if(row===15)C.push({t:'decor',dkind:'trialsv2ferna',p:tuple(edge.clone().add(new THREE.Vector3(0,.03,0))),w:.6,yaw:round(yaw+35),scenerySolid:false,grp:438,nm:'Island midground garden / fern in coping crack'});
  }
 }
 return [...C,...structuredClone(gardens) as CustomComponent[]];
}
