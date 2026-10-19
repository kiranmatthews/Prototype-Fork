import * as THREE from 'three';
import { RaceCourse } from '../race/course';
import { COUNTRY_CLUB_PONDS } from '../levels/country-club-layout';
import { CART_PHYSICS, type CartGround, type CartObstacle, type CartSpawn, type GolfCartPhysics } from './physics';

export const COUNTRY_CLUB_CART_COUNT=10;
export const COUNTRY_CLUB_CART_SCALE=2;
export interface CartJump {start:number;end:number}
interface Point {x:number;z:number}
interface Node extends Point {y:number;side:number;offroad:boolean;links:number[]}
interface Patch {nodes:Node[];home:THREE.Vector3;right:THREE.Vector3}
interface Driver {seed:number;path:number[];next:number;speed:number;wait:number;clearUntil:number;stuck:number;reverse:number;anchorAt:number;respawns:number;trips:number}
const clamp=THREE.MathUtils.clamp,spacing=16,radius=6;

/** Independent, seeded fairway traffic. Drivers have local territories and no
 * racer targets, finish destination or progress-based catch-up acceleration. */
export class CartFieldRoaming {
  readonly progress:number[]=[];
  readonly initial:CartSpawn[]=[];
  readonly patches:Patch[]=[];
  readonly drivers:Driver[]=[];
  private position=new THREE.Vector3();
  private projectionAt=0;
  private safeCache=new Map<string,boolean>();
  constructor(readonly course:RaceCourse,readonly jumps:readonly CartJump[],private ground:CartGround,private obstacles:readonly CartObstacle[]){
    for(const fraction of [.045,.14,.24,.33,.43,.53,.63,.73,.83,.91]){
      let station=fraction*course.length;
      for(const gap of jumps)if(station>gap.start-60&&station<gap.end+60)station=gap.end+65;
      const home=course.sample(station),tangent=course.tangent(station),right=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
      const nodes:Node[]=[],grid=new Map<string,number>();
      for(let z=-radius;z<=radius;z++)for(let x=-radius;x<=radius;x++){
        if(x*x+z*z>radius*radius)continue;
        const px=home.x+x*spacing,pz=home.z+z*spacing;if(!this.safe(px,pz))continue;
        const y=ground(px,pz).height,near=course.project(this.position.set(px,y,pz));
        grid.set(`${x},${z}`,nodes.length);
        nodes.push({x:px,z:pz,y,side:x*spacing*right.x+z*spacing*right.z,offroad:near.distance>course.width(near.s)/2+12,links:[]});
      }
      for(const [key,index]of grid){
        const [x,z]=key.split(',').map(Number),a=nodes[index];
        for(const [dx,dz]of [[1,0],[0,1],[1,1],[-1,1]]){
          const next=grid.get(`${x+dx},${z+dz}`);if(next===undefined)continue;
          if(this.clearSegment(a,nodes[next])){a.links.push(next);nodes[next].links.push(index);}
        }
      }
      // Isolated pockets cannot form a patrol. Retain the largest connected area.
      const seen=new Set<number>();let largest:number[]=[];
      for(let n=0;n<nodes.length;n++){
        if(seen.has(n))continue;const group=[n];seen.add(n);
        for(let j=0;j<group.length;j++)for(const next of nodes[group[j]].links)if(!seen.has(next)){seen.add(next);group.push(next);}
        if(group.length>largest.length)largest=group;
      }
      const remap=new Map(largest.map((n,i)=>[n,i]));
      const connected=largest.map(n=>({...nodes[n],links:nodes[n].links.map(v=>remap.get(v)!)}));
      if(!connected.length)throw new Error('Country Club cart territory has no supported ground');
      this.patches.push({home,right,nodes:connected});
      this.drivers.push({seed:1,path:[],next:0,speed:16,wait:0,clearUntil:0,stuck:0,reverse:0,anchorAt:0,respawns:0,trips:0});
      this.progress.push(station);
    }
    this.seedSpawns(1);
    this.safeCache.clear();
  }
  protectedJump(s:number){return this.jumps.some(g=>s>g.start-35&&s<g.end+22);}
  private random(d:Driver){d.seed=(Math.imul(d.seed,1664525)+1013904223)>>>0;return d.seed/4294967296;}
  private safe(x:number,z:number){
    // Navigation is computed only when a driver chooses a trip, never per tick.
    const key=`${Math.round(x*2)},${Math.round(z*2)}`,cached=this.safeCache.get(key);if(cached!==undefined)return cached;
    const floor=this.ground(x,z),p=this.position.set(x,floor.height,z),near=this.course.project(p);
    // Keep complete turning circles off water, including raised islands and
    // skater jump decks that are supported but are not a viable cart crossing.
    const pond=COUNTRY_CLUB_PONDS.some(w=>{const dx=x-w.x,dz=z-w.z;return Math.hypot((dx*w.r[0]+dz*w.r[2])/(w.rx+14),(dx*w.f[0]+dz*w.f[2])/(w.rz+14))<1.16;});
    let safe=floor.safe&&!pond&&!((near.s<50||near.s>this.course.length-85||this.protectedJump(near.s))&&near.distance<this.course.width(near.s)/2+14);
    if(safe)for(const [dx,dz]of [[9,0],[-9,0],[0,9],[0,-9],[6,6],[-6,6],[6,-6],[-6,-6]]){
      const edge=this.ground(x+dx,z+dz);if(!edge.safe||Math.abs(edge.height-floor.height)>Math.hypot(dx,dz)*.42){safe=false;break;}
    }
    if(safe)safe=!this.obstacles.some(o=>(x-o.x)**2+(z-o.z)**2<(o.radius+7)**2);
    if(this.safeCache.size>12000)this.safeCache.clear();this.safeCache.set(key,safe);return safe;
  }
  private clearSegment(a:Point,b:Point){
    const length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/5);let y=this.ground(a.x,a.z).height;
    for(let j=1;j<=steps;j++){
      const x=a.x+(b.x-a.x)*j/steps,z=a.z+(b.z-a.z)*j/steps;if(!this.safe(x,z))return false;
      const next=this.ground(x,z).height;if(Math.abs(next-y)>length/steps*.42)return false;y=next;
    }
    return true;
  }
  private seedSpawns(seed:number){
    this.initial.length=0;
    for(const [i,patch]of this.patches.entries()){
      const d=this.drivers[i];Object.assign(d,{seed:(seed^Math.imul(i+1,0x9e3779b9))>>>0,path:[],next:0,wait:0,clearUntil:0,stuck:0,reverse:0,anchorAt:0,respawns:0,trips:0});
      const candidates=patch.nodes.filter(n=>n.offroad&&Math.abs(n.side)>25),pool=candidates.length?candidates:patch.nodes;
      const spawn=pool[Math.floor(this.random(d)*pool.length)];
      this.initial.push({x:spawn.x,z:spawn.z,yaw:Math.atan2(spawn.x-patch.home.x,spawn.z-patch.home.z)+(this.random(d)-.5)*.7});
      d.wait=this.random(d)*2.5;d.speed=13+this.random(d)*10;
    }
  }
  reset(world:GolfCartPhysics,seed=1){
    this.seedSpawns(seed);this.projectionAt=0;
    for(let i=0;i<world.carts.length;i++){Object.assign(world.spawns[i],this.initial[i]);world.reset(i);}
    world.time=0;
  }
  /** Complete the current crossing, then stay on that side while the pack passes. */
  clearAfterContact(index:number,world:GolfCartPhysics){this.drivers[index].clearUntil=world.time+9;}
  private plan(index:number,world:GolfCartPhysics){
    const c=world.carts[index],d=this.drivers[index],patch=this.patches[index],nodes=patch.nodes;
    let start=0,best=Infinity;
    for(const [i,n]of nodes.entries()){const distance=(n.x-c.x)**2+(n.z-c.z)**2;if(distance<best){best=distance;start=i;}}
    const side=(c.x-patch.home.x)*patch.right.x+(c.z-patch.home.z)*patch.right.z;
    const crossing=world.time>=d.clearUntil&&this.random(d)<.72;
    let goals=nodes.map((_,i)=>i).filter(i=>nodes[i].offroad&&Math.hypot(nodes[i].x-c.x,nodes[i].z-c.z)>55&&(crossing?nodes[i].side*side< -300:nodes[i].side*side>200));
    if(!goals.length&&!crossing)goals=nodes.map((_,i)=>i).filter(i=>nodes[i].offroad&&nodes[i].side*side>=0&&i!==start);
    if(!goals.length)goals=nodes.map((_,i)=>i).filter(i=>nodes[i].offroad&&i!==start);
    if(!goals.length)goals=nodes.map((_,i)=>i);
    const goal=goals[Math.floor(this.random(d)*goals.length)],cost=new Float64Array(nodes.length).fill(Infinity),previous=new Int16Array(nodes.length).fill(-1),open=new Set([start]);cost[start]=0;
    while(open.size){
      let current=start,score=Infinity;
      for(const n of open){const s=cost[n]+Math.hypot(nodes[n].x-nodes[goal].x,nodes[n].z-nodes[goal].z);if(s<score){score=s;current=n;}}
      open.delete(current);if(current===goal)break;
      for(const next of nodes[current].links){
        // Prefer grass over driving lengthwise along the race corridor.
        const distance=Math.hypot(nodes[next].x-nodes[current].x,nodes[next].z-nodes[current].z);
        const nextCost=cost[current]+distance*(nodes[current].offroad||nodes[next].offroad?1:2.2);
        if(nextCost<cost[next]){cost[next]=nextCost;previous[next]=current;open.add(next);}
      }
    }
    const path=[goal];while(path[0]!==start&&previous[path[0]]>=0)path.unshift(previous[path[0]]);
    const smooth=[path[0]];
    for(let k=0;k<path.length-1;){let next=k+1;for(let j=k+2;j<path.length&&j<=k+5;j++)if(this.clearSegment(nodes[path[k]],nodes[path[j]]))next=j;k=next;smooth.push(path[k]);}
    d.path=smooth;d.next=smooth.length>1?1:0;d.speed=13+this.random(d)*10;d.trips++;
  }
  drive(world:GolfCartPhysics){
    const dt=CART_PHYSICS.step,project=world.time>=this.projectionAt;if(project)this.projectionAt=world.time+.25;
    for(const [i,c]of world.carts.entries()){
      const d=this.drivers[i],nodes=this.patches[i].nodes;
      if(project)this.progress[i]=this.course.project(this.position.set(c.x,c.y,c.z)).s;
      if(c.respawns!==d.respawns){d.path=[];d.respawns=c.respawns;d.stuck=0;}
      if(!d.path.length)this.plan(i,world);
      let aim=nodes[d.path[d.next]],distance=Math.hypot(aim.x-c.x,aim.z-c.z);
      if(distance<5){
        if(d.next<d.path.length-1)d.next++;
        else{d.wait=world.time<d.clearUntil?2+this.random(d)*2:this.random(d)*1.6;this.plan(i,world);}
        aim=nodes[d.path[d.next]];distance=Math.hypot(aim.x-c.x,aim.z-c.z);
      }
      const dx=aim.x-c.x,dz=aim.z-c.z;
      const bearing=Math.atan2(-dx,-dz)-c.yaw,angle=Math.atan2(Math.sin(bearing),Math.cos(bearing));
      const steer=clamp(angle*1.6,-1,1);
      let desired=Math.min(d.speed/(1+Math.abs(angle)*1.5),Math.max(6,distance*.8));
      if(d.next<d.path.length-1&&distance<22){
        const after=nodes[d.path[d.next+1]],turn=Math.atan2(-(after.x-aim.x),-(after.z-aim.z))-Math.atan2(-dx,-dz);
        if(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))>.45)desired=Math.min(desired,7+distance*.15);
      }
      if(d.wait>0){d.wait-=dt;desired=0;}
      const error=desired-c.speed;
      world.inputs[i]={throttle:desired>0?clamp(error*.28+.18,0,1):0,steer,brake:clamp(-error*.18,0,1),handbrake:false};
      d.stuck=desired>3&&Math.abs(c.speed)<1.5&&!c.tumbling?d.stuck+dt:0;
      if(d.stuck>2.5&&d.reverse<=0){d.reverse=1.4;d.stuck=0;}
      if(d.reverse>0){d.reverse-=dt;world.inputs[i]={throttle:-.8,steer:-steer,brake:0,handbrake:false};if(d.reverse<=0)d.path=[];}
      // Reuse a supported off-road anchor after an exceptional collision/reset.
      if(world.time>d.anchorAt+6&&c.grounded&&!c.tumbling&&Math.abs(c.speed)>3){
        d.anchorAt=world.time;
        const near=this.course.project(this.position.set(c.x,c.y,c.z));
        if(near.distance>this.course.width(near.s)/2+12&&Math.hypot(c.x-this.patches[i].home.x,c.z-this.patches[i].home.z)<100&&this.safe(c.x,c.z)){
          let anchor=nodes[0],distance=Infinity;
          for(const n of nodes){const delta=(n.x-c.x)**2+(n.z-c.z)**2;if(n.offroad&&delta<distance){distance=delta;anchor=n;}}
          if(distance<400)Object.assign(world.spawns[i],{x:anchor.x,z:anchor.z,yaw:c.yaw});
        }
      }
    }
  }
}
