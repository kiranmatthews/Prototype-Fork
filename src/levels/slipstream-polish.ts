import * as THREE from 'three';
import type {CustomComponent} from '../level';
import type {RaceKnot,RacePoint} from '../race/types';
import {RaceCourse} from '../race/course';
import gardens from './slipstream-polish-gardens.json';

const up=new THREE.Vector3(0,1,0);
const tuple=(p:THREE.Vector3)=>p.toArray().map(n=>Math.round(n*10000)/10000) as RacePoint;

/** Rooted gardens reuse existing Meshy assets, without changing the route. */
export function polishSlipstream(C:CustomComponent[],line:RaceKnot[]):void {
 C.push(...structuredClone(gardens) as CustomComponent[]);
 const course=new RaceCourse(line),samples=Array.from({length:Math.ceil(course.length/4)},(_,i)=>{
  const s=i*4;return {p:course.sample(s),w:course.width(s)};
 });
 const clear=(p:THREE.Vector3,r:number,h:number)=>samples.every(({p:q,w})=>
  p.y+h<q.y-2||p.y>q.y+8||Math.hypot(p.x-q.x,p.z-q.z)>w/2+r+1.5);
 const add=(kind:CustomComponent['dkind'],p:THREE.Vector3,scale:number,yaw:number,name:string,r:number,h:number,check=true)=>{
  if(check&&!clear(p,r*scale,h*scale))return;
  C.push({t:'decor',dkind:kind,p:tuple(p),w:scale,yaw,scenerySolid:false,grp:436,nm:'Island garden / '+name});
 };
 // The masonry's visual palette changes; its exact collision boxes remain.
 for(const c of C)if(c.dkind==='ruinblock'||(c.t==='wall'&&c.tex==='stone'&&!c.nm?.startsWith('Catch pool'))){
  c.tex='custard-sandstone';c.color='#fff1dc';
 }
 // Outer terrace corners leave the inner deck and downhill swim exits open.
 for(const [i,deck] of C.filter(c=>c.nm?.includes('maintenance apron')&&c.s).entries()){
  const centre=new THREE.Vector3(...deck.p),yaw=(deck.yaw??0)*Math.PI/180;
  const route=course.sample(course.project(centre).s);
  const local=route.clone().sub(centre).applyAxisAngle(up,-yaw),outside=local.x>0?-1:1;
  const at=(x:number,z:number)=>new THREE.Vector3(x,deck.s![1]/2,z).applyAxisAngle(up,yaw).add(centre);
  const edge=outside*(deck.s![0]/2-1.6);
  add('sunnyhibiscus',at(edge,-5.8),.85,(i*71)%360,'hibiscus through terrace cracks',1.3,1.32);
  add('trialsv2ferna',at(edge-1.1*outside,6.1),.9,32+i*47,'terrace fern bed',1.5,2);
  add('jungleleaf',at(edge,-1.8),.65,i*97,'broadleaf beside machinery',2.1,2.6);
  if(i%2===0)add('crowntropicalpalm',at(edge-1.2*outside,3),.66,40+i*61,'terrace palm',5.5,17);
 }
 const start=course.sample(0),finish=course.sample(course.length);
 for(const [x,z,size,yaw] of [[-24,-21,.86,23],[-25,10,.72,155]] as const){
  const p=start.clone().add(new THREE.Vector3(x,0,z));
  add('crowntropicalpalm',p,size,yaw,'ticket garden palm',5.5,17);
  add('sunnyhibiscus',p.clone().add(new THREE.Vector3(1.2,0,1.5)),1.15,yaw+60,'ticket garden flowers',1.3,1.32);
 }
 // Existing arch pedestals support the planting. High foliage frames the
 // opening, while compact flowers remain outside its clear racing aperture.
 for(const arch of C.filter(c=>c.dkind==='waterslideentrancearch'))for(const side of [-1,1]){
  const scale=arch.w??1,foot=new THREE.Vector3(...arch.p).add(new THREE.Vector3(side*5.65*scale,.15,-.15));
  add('sunnyhibiscus',foot,.55*scale,side*50,'flowers at arch footing',1.3,1.32,false);
  add('bayvine',foot.clone().add(new THREE.Vector3(side*.35,3.7*scale,.4)),.8*scale,side>0?90:-90,'arch climbing flowers',1.2,4.2,false);
 }
 for(const side of [-1,1]){
  const p=finish.clone().add(new THREE.Vector3(side*19,0,-28));
  add('crowntropicalpalm',p,.83,side>0?155:24,'finish garden palm',5.5,17);
  add('sunnyhibiscus',p.clone().add(new THREE.Vector3(-side*2.5,0,3)),1.15,side*55,'finish garden hibiscus',1.3,1.32);
  add('trialsv2fernb',p.clone().add(new THREE.Vector3(side,0,-3)),1.05,side*30,'finish garden fern',1.5,2);
 }
 for(const [i,pier] of C.filter(c=>c.dkind==='ruinblock'&&c.s&&c.s[1]>5).entries()){
  const [w,h,d]=pier.s!,a=(pier.yaw??0)*Math.PI/180;
  const p=new THREE.Vector3(w*.35,h-3.6,d*.48).applyAxisAngle(up,a).add(new THREE.Vector3(...pier.p));
  add('bayvine',p,.85,(pier.yaw??0)+180,'ruin face vine',1.2,4.2);
  const top=new THREE.Vector3(-w*.2,h+.03,-d*.15).applyAxisAngle(up,a).add(new THREE.Vector3(...pier.p));
  add('sunnyhibiscus',top,Math.min(.85,w/3),i*83,'ruin crown flowers',1.3,1.32);
 }
}
