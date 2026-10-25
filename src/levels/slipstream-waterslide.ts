import * as THREE from 'three';
import type {CustomComponent} from '../level';
import type {RaceKnot,RacePoint} from '../race/types';
import {RaceCourse} from '../race/course';
import {WATERSLIDE_ASSETS} from '../waterslideAssets';
import trim from './slipstream-waterslide-trim.json';
import shallowPools from './slipstream-shallow-pools.json';
import {dressTropicalWaterpark} from './slipstream-island';
import {polishSlipstream} from './slipstream-polish';
import {buildSlipstreamMidground} from './slipstream-midground';

type Pool={start:RacePoint;end:RacePoint;width:number;surface:number;floor:number;landing:RacePoint;takeoff:RacePoint};
type Asset=keyof typeof WATERSLIDE_ASSETS;
const point=(v:THREE.Vector3):RacePoint=>v.toArray() as RacePoint;

/** Source-owned scenery and support geometry. The racing surfaces remain the
 * original colliders, including the restored breaks and swimming volumes. */
export function dressSlipstreamWaterslide(components:CustomComponent[],line:RaceKnot[],pools:Pool[],jumps:{takeoff:RacePoint;landing:RacePoint}[]):void {
  const course=new RaceCourse(line),finish=course.sample(course.length),floor=finish.y-40;
  for(let i=components.length-1;i>=0;i--){const c=components[i];
    if(c.t==='decor'&&c.grp===306){components.splice(i,1);continue;}
    if(['platform','mesh','terrain','vertramp','ramp','crumble','mover'].includes(c.t)&&c.solid!==false&&!c.materialStyle){c.tex='waterslide-fiberglass';c.color='#ffffff';}
    if(c.t==='rail')c.color='#b8a57d';
    if(c.t==='crusher'){c.tex='metal';c.color='#c99262';}
    if(c.t==='wall'&&c.nm?.startsWith('Catch pool')){c.tex='waterslide-fiberglass';c.color='#eee7cd';}
  }
  const add=(c:CustomComponent)=>components.push({...c,grp:430});
  const prop=(kind:Asset,p:RacePoint,w=1,yaw=0,solid=true)=>add({t:'decor',dkind:kind,p,w,yaw,scenerySolid:solid,nm:WATERSLIDE_ASSETS[kind].label});
  const deck=(p:RacePoint,w:number,d:number,yaw=0,name='Abandoned service deck')=>add({t:'platform',p:[p[0],p[1]-.45,p[2]],s:[w,.9,d],yaw,tex:'pavement',color:'#b8b09a',nm:name});
  const post=(x:number,z:number,bottom:number,top:number,w=1.4)=>{if(top>bottom)add({t:'decor',dkind:'block',p:[x,(bottom+top)/2,z],s:[w,top-bottom,w],tex:'metal',color:'#799591',scenerySolid:false,nm:'Weathered structural column'});};
  const routeYaw=(s:number)=>{const f=course.tangent(s);return Math.atan2(f.x,f.z)*180/Math.PI;};
  const groundEnd=Math.min(2500,course.length*.63),rows=36,cross=[-1,-.65,-.3,0,.3,.65,1],vertices:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
  for(let i=0;i<=rows;i++){
    const s=groundEnd*i/rows,p=course.sample(s);
    for(const u of cross){vertices.push(p.x+u*180,p.y-34-Math.abs(u)**1.5*38+Math.sin(s*.009+u*4)*3,p.z);uvs.push(u*10,s/35);const color=new THREE.Color().setRGB(.55+Math.abs(u)*.12,.61+Math.abs(u)*.04,.43+Math.abs(u)*.07);colors.push(color.r,color.g,color.b);}
    if(i)for(let j=0;j<cross.length-1;j++){const a=(i-1)*cross.length+j,b=a+cross.length;indices.push(a,a+1,b,b,a+1,b+1);}
  }
  // Outside the race, the hillside is a normal return surface. Catch pools sit
  // above it and retain their complete safe swimming exits.
  add({t:'mesh',p:[0,0,0],vertices,indices,uvs,colors,tex:'coast-bedrock',solid:true,outOfBounds:true,edgeGrinding:false,doubleSided:true,nm:'Waterpark hillside / outside the race'});
  const start=course.sample(0),last=course.sample(groundEnd);
  for(const side of [-1,1]){
    const wall:number[]=[],faces:number[]=[];
    for(let i=0;i<=rows;i++){const p=course.sample(groundEnd*i/rows);wall.push(p.x+side*180,p.y-72,p.z,p.x+side*230,floor,p.z);if(i){const a=(i-1)*2;faces.push(a,a+2,a+1,a+1,a+2,a+3);}}
    add({t:'mesh',p:[0,0,0],vertices:wall,indices:faces,tex:'coast-bedrock',color:'#a4a08b',solid:false,doubleSided:true,nm:'Waterpark hillside / distant rock face'});
  }
  add({t:'mesh',p:[0,0,0],vertices:[last.x-180,last.y-34,last.z,last.x+180,last.y-34,last.z,last.x-230,floor,last.z,last.x+230,floor,last.z],indices:[0,2,1,1,2,3],tex:'coast-bedrock',color:'#9d9e86',solid:false,doubleSided:true,nm:'Waterpark gorge / exposed cliff'});
  add({t:'mesh',p:[0,floor,0],vertices:[-375,0,start.z+250,375,0,start.z+250,-375,0,finish.z-250,375,0,finish.z-250],indices:[0,1,2,2,1,3],uvs:[0,0,30,0,0,100,30,100],solid:true,tex:'coast-bedrock',color:'#8f9b79',outOfBounds:true,edgeGrinding:false,nm:'Waterpark valley / outside the race'});
  const inGap=(s:number)=>jumps.some(j=>{const a=course.project(new THREE.Vector3(...j.takeoff)).s,b=course.project(new THREE.Vector3(...j.landing)).s;return s>a-8&&s<b+8;});
  for(let s=35;s<course.length-45;s+=135){
    if(inGap(s))continue;
    const p=course.sample(s),f=course.tangent(s),side=new THREE.Vector3(-f.z,0,f.x).normalize(),scale=Math.max(1.6,course.width(s)/8.5),base=p.y-12*scale-Math.abs(f.y)*4*scale-.4;
    if(Math.abs(f.y)<.3)prop('waterslideflumesupport',[p.x,base,p.z],scale,routeYaw(s),false);
    const lower=s<groundEnd?p.y-36:floor;
    // Centres measured from the four bottom contact patches in the packed GLB.
    const flatForward=f.clone().setY(0).normalize();
    for(const hand of [-1,1])for(const along of [-1,1]){const q=p.clone().addScaledVector(side,hand*3.625*scale).addScaledVector(flatForward,along*2.072*scale);post(q.x,q.z,lower,Math.abs(f.y)<.3?base+.25:p.y-3,Math.max(1.2,scale*.5));}
  }
  deck([start.x-18,start.y,start.z-6],18,48,0,'Closed ticket forecourt');
  for(const x of [-25,-11])for(const z of [-27,15])post(start.x+x,start.z+z,start.y-45,start.y-.9);
  prop('waterslideentrancearch',[start.x,start.y,start.z-14],1.25,180);
  prop('waterslideticketbooth',[start.x-17,start.y,start.z-14],1,90);
  prop('waterslidefloatpile',[start.x-17,start.y,start.z-3],1,20);
  prop('waterslidesafetybarrier',[start.x-25,start.y,start.z+4],1,90);
  add({t:'decor',dkind:'coastcarpet',p:[start.x-23,start.y,start.z-5],w:.6,scenerySolid:false,nm:'Forecourt weeds'});
  for(const [i,pool] of pools.entries()){
    const a=new THREE.Vector3(...pool.start),b=new THREE.Vector3(...pool.end),forward=b.clone().sub(a).normalize(),right=new THREE.Vector3(-forward.z,0,forward.x),mid=a.clone().lerp(b,.5),length=a.distanceTo(b),yaw=-Math.atan2(forward.x,-forward.z)*180/Math.PI;
    add({t:'platform',p:[mid.x,pool.floor-.6,mid.z],s:[pool.width+1.6,1.2,length+.8],yaw,tex:'waterslide-fiberglass',color:'#ded7c1',edgeGrinding:false,nm:`Catch pool ${i+1} / concrete underside`});
    const shore=new THREE.Vector3(...pool.landing).addScaledVector(forward,9),side=i%2?-1:1,offset=(8+pool.width/2+12)/2;
    const apron=shore.clone().addScaledVector(right,side*offset);deck(point(apron),pool.width/2+4,18,yaw,`Catch pool ${i+1} / maintenance apron`);
    const along=course.project(apron).s;
    for(const u of [-1,1])for(const v of [-1,1]){const foot=apron.clone().addScaledVector(right,u*(pool.width/4)).addScaledVector(forward,v*7);post(foot.x,foot.z,along<groundEnd?apron.y-45:floor,apron.y-.9);}
    prop(i%3===0?'waterslidepumpstation':'waterslidelifeguardtower',point(apron),i%3===0?1:.9,yaw+side*90);
    const outer=apron.clone().addScaledVector(right,side*(pool.width/4+1.4));
    for(const t of [-4.5,4.5])prop('waterslidesafetybarrier',point(outer.clone().addScaledVector(forward,t)),1,yaw+90);
    for(const t of [-7,7])add({t:'decor',dkind:'coastfern',p:point(outer.clone().addScaledVector(right,-side).addScaledVector(forward,t)),w:.55,yaw:i*43+t,scenerySolid:false,nm:'Ferns through the cracked pool apron'});
    const clutter=apron.clone().addScaledVector(forward,5).addScaledVector(right,side*5);prop('waterslidefloatpile',point(clutter),.8,yaw-20);
    if(i%2===0){const broken=apron.clone().addScaledVector(forward,-3).addScaledVector(right,side*5);prop('waterslidebrokenflume',point(broken),.8,yaw+20);}
    for(const hand of [-1,1])for(const t of [.27,.7]){
      const rail=a.clone().lerp(b,t).addScaledVector(right,hand*(pool.width/2+.4));rail.y=pool.floor+3.85;
      prop('waterslidesafetybarrier',point(rail),1,yaw+90);
    }
    add({t:'decor',dkind:'coastcarpet',p:point(apron.clone().addScaledVector(right,-side*5)),w:.55,scenerySolid:false,nm:'Maintenance apron weeds'});
  }
  prop('waterslideentrancearch',point(finish),2.6,180);
  prop('waterslideticketbooth',[finish.x+18,finish.y,finish.z-24],1,-90);
  prop('waterslidefloatpile',[finish.x-18,finish.y,finish.z-24],1.1,20);
  prop('waterslidelifeguardtower',[finish.x-18,finish.y,finish.z-10],1,70);
  for(const side of [-1,1])for(const z of [-8,-20,-30])prop('waterslidesafetybarrier',[finish.x+side*22,finish.y,finish.z+z],1,90);
  components.push(...trim as CustomComponent[]);
  dressTropicalWaterpark(components,line);
  polishSlipstream(components,line);
 components.push(...buildSlipstreamMidground(line,components));
  // Measured horizontal rainwater pockets; the ride and its eight swim-out
  // catch pools retain their original collision and traction.
  components.push(...structuredClone(shallowPools) as CustomComponent[]);
}
