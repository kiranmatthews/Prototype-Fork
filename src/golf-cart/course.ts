import * as THREE from 'three';
import type { Level } from '../level';
import type { Player } from '../player';
import type { SkateRace } from '../race/runtime';
import { RaceCourse } from '../race/course';
import type { RaceKnot } from '../race/types';
import { countryClubPoint, countryClubGroundHeight, countryClubNearestRoad, countryClubDeckHeight, countryClubWidth, countryClubRacingOffset, COUNTRY_CLUB_ROUTE, COUNTRY_CLUB_GAPS, COUNTRY_CLUB_BOUNDS, COUNTRY_CLUB_PONDS } from '../levels/country-club-layout';
import { GolfCartFleet } from './fleet';
import { CartRacePursuit, COUNTRY_CLUB_CART_SCALE, type CartChaseTarget } from './pursuit';
import type { CartGround } from './physics';

/** Ten oversized course pursuers, using the existing vehicle and rider physics. */
export class CountryClubCarts {
  fleet:GolfCartFleet|null=null;
  pursuit:CartRacePursuit|null=null;
  readonly stats={contacts:0,knockdowns:0,spinHits:0};
  private attached:Level|null=null;
  private contactCooldown=new Map<Player,number>();
  private spinCooldown:number[]=[];
  private lastElapsed=0;private wasGrid=false;
  constructor(private scene:THREE.Scene){}
  attach(level:Level,id:string){
    if(this.attached===level)return;
    this.fleet?.dispose();this.fleet=null;this.pursuit=null;this.attached=level;
    this.contactCooldown.clear();this.lastElapsed=0;this.wasGrid=false;
    Object.assign(this.stats,{contacts:0,knockdowns:0,spinHits:0});
    if(id!=='country-club')return;
    const line=level.skateRace?.line??COUNTRY_CLUB_ROUTE.filter((_,i)=>i%4===0).map(q=>
      [...countryClubPoint(q.s,countryClubRacingOffset(q.s)),Math.max(5,countryClubWidth(q.s)-Math.abs(countryClubRacingOffset(q.s))*2-3)] as RaceKnot);
    const course=new RaceCourse(line);
    const jumps=level.skateRace?.jumps??COUNTRY_CLUB_GAPS.map(g=>({takeoff:countryClubPoint(g.a-5),landing:countryClubPoint(g.b+5)}));
    this.pursuit=new CartRacePursuit(course,jumps.map(g=>({start:course.project(new THREE.Vector3(...g.takeoff)).s,end:course.project(new THREE.Vector3(...g.landing)).s})));
    const spawns=this.pursuit.initial.map(s=>({...s}));
    this.spinCooldown=spawns.map(()=>0);
    const cache=new Map<string,number>();
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,40);
    const height=(x:number,z:number)=>{
      const key=`${x},${z}`;let y=cache.get(key);if(y!==undefined)return y;
      const near=countryClubNearestRoad(x,z),road=near.distance<=countryClubWidth(near.s)/2&&!COUNTRY_CLUB_GAPS.some(g=>near.s>g.a&&near.s<g.b);
      y=road?countryClubDeckHeight(near.s,near.u):countryClubGroundHeight(x,z);
      // Honour the real collision skin, including edited decks and the lower rough.
      ray.ray.origin.set(x,y+16,z);
      const hit=level.raycastGround?.(ray)[0];if(hit)y=hit.point.y;
      if(cache.size>=16384)cache.delete(cache.keys().next().value!);cache.set(key,y);return y;
    };
    const ground:CartGround=(x,z)=>{
      const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
      const y=THREE.MathUtils.lerp(THREE.MathUtils.lerp(height(ix,iz),height(ix+1,iz),fx),THREE.MathUtils.lerp(height(ix,iz+1),height(ix+1,iz+1),fx),fz);
      const water=COUNTRY_CLUB_PONDS.some(p=>{const dx=x-p.x,dz=z-p.z;return y<p.y+.35&&Math.hypot((dx*p.r[0]+dz*p.r[2])/p.rx,(dx*p.f[0]+dz*p.f[2])/p.rz)<1.08;});
      return {height:y,grip:1,drag:.08,safe:!water&&x>COUNTRY_CLUB_BOUNDS.minX&&x<COUNTRY_CLUB_BOUNDS.maxX&&z>COUNTRY_CLUB_BOUNDS.minZ&&z<COUNTRY_CLUB_BOUNDS.maxZ};
    };
    // Small physical walls/trees remain solid along the whole pursuit route.
    const obstacles=level.walls.filter(w=>w.max.y-w.min.y>.7&&Math.max(w.max.x-w.min.x,w.max.z-w.min.z)<6)
      .map((w,i)=>({x:(w.min.x+w.max.x)/2,z:(w.min.z+w.max.z)/2,radius:Math.max(w.max.x-w.min.x,w.max.z-w.min.z)/2,id:`course-wall-${i}`}))
      .filter(w=>countryClubNearestRoad(w.x,w.z).distance<22);
    this.fleet=new GolfCartFleet({ground,spawns,obstacles,physics:{scale:COUNTRY_CLUB_CART_SCALE,topSpeed:82,engine:48,speedLimit:80,crestLaunch:false}});
    this.fleet.root.userData.traffic=this.stats;this.scene.add(this.fleet.root);
  }
  setVisible(visible:boolean){if(this.fleet)this.fleet.root.visible=visible;}
  step(dt:number,player:Player,race?:SkateRace){
    const fleet=this.fleet,pursuit=this.pursuit;if(!fleet||!pursuit)return;
    const active=!!race?.active,grid=active&&(race.phase==='grid'||race.phase==='countdown');
    if(active&&(race.elapsed<this.lastElapsed||grid&&!this.wasGrid)){
      pursuit.reset(fleet.physics);this.contactCooldown.clear();this.spinCooldown.fill(0);
      Object.assign(this.stats,{contacts:0,knockdowns:0,spinHits:0});
    }
    this.lastElapsed=race?.elapsed??0;this.wasGrid=grid;
    if(grid){fleet.present(dt);return;}
    const riders=active?race.riders.slice(0,race.count).filter(r=>r.finish===null&&!r.recovery):[];
    const targets:CartChaseTarget[]=active?riders.map(r=>({id:r.id,position:r.player.pos,progress:r.progress,speed:r.player.speed})):
      [{id:0,position:player.pos,progress:pursuit.course.project(player.pos).s,speed:player.speed}];
    fleet.update(dt,world=>pursuit.drive(world,targets));
    for(const [p,t]of this.contactCooldown)this.contactCooldown.set(p,Math.max(0,t-dt));
    this.spinCooldown=this.spinCooldown.map(t=>Math.max(0,t-dt));
    for(const target of targets){
      const rider=riders.find(r=>r.id===target.id),p=rider?.player??player;
      if(p.state!=='ride'&&p.state!=='air'||p.skateCameraBailing)continue;
      for(const [i,c]of fleet.physics.carts.entries()){
        if(p.pos.y<c.y-.8||p.pos.y>c.y+4.1)continue;
        // Same scaled capsule as cart-to-cart collision, expanded by the rider.
        const fx=-Math.sin(c.yaw),fz=-Math.cos(c.yaw),along=THREE.MathUtils.clamp((p.pos.x-c.x)*fx+(p.pos.z-c.z)*fz,-fleet.physics.probeOffset,fleet.physics.probeOffset);
        const dx=p.pos.x-c.x-fx*along,dz=p.pos.z-c.z-fz*along,d=Math.hypot(dx,dz),radius=fleet.physics.radius+.6;
        if(d>radius)continue;
        const nx=d>.01?dx/d:Math.cos(c.yaw),nz=d>.01?dz/d:-Math.sin(c.yaw);
        if(p.spinning||rider&&rider.star>0){
          if(this.spinCooldown[i]===0){fleet.physics.kick(i,-nx*12,-nz*12,16);this.spinCooldown[i]=.5;this.stats.spinHits++;}
          continue;
        }
        if((this.contactCooldown.get(p)??0)>0||rider&&rider.knockGrace>0)continue;
        const velocity=p.raceHeading.multiplyScalar(p.speed),closing=-((velocity.x-c.vx)*nx+(velocity.z-c.vz)*nz);
        p.pos.x+=nx*(radius-d);p.pos.z+=nz*(radius-d);
        if(closing<=1)continue;
        this.stats.contacts++;this.contactCooldown.set(p,2.8);
        if(closing>8&&!pursuit.protectedJump(target.progress)){
          if(p.raceHooks)p.raceHooks.hazard('contact');else p.beginPvpKnockdown(2.8,nx>=0?1:-1);
          if(p.skateCameraBailing)this.stats.knockdowns++;
        }else p.speed*=.9;
        fleet.physics.kick(i,-nx*Math.min(7,closing*.3),-nz*Math.min(7,closing*.3),Math.min(16,closing));
      }
    }
  }
}
