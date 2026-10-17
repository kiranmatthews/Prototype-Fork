import * as THREE from 'three';
import type { Level } from '../level';
import type { Player } from '../player';
import { countryClubPoint, countryClubFrame, countryClubGroundHeight, countryClubNearestRoad, countryClubDeckHeight, countryClubWidth, COUNTRY_CLUB_GAPS, COUNTRY_CLUB_BOUNDS, COUNTRY_CLUB_PONDS } from '../levels/country-club-layout';
import { GolfCartFleet } from './fleet';
import type { CartGround, CartRoute, CartSpawn } from './physics';

/** Source-owned traffic around five dry cart-path bays. No changes to the movement model. */
export class CountryClubCarts {
  fleet:GolfCartFleet|null=null;private attached:Level|null=null;private spinCooldown=0;
  constructor(private scene:THREE.Scene){}
  attach(level:Level,id:string){
    if(this.attached===level)return;
    this.fleet?.dispose();this.fleet=null;this.attached=level;
    if(id!=='country-club')return;
    // Five carts share one instanced kit; two inhabit the opening so the new traffic is immediately visible.
    const stations=[26,62,380,1120,2040];
    const routes:CartRoute[]=stations.map((station,i)=>({speed:4.2+i*.35,points:Array.from({length:24},(_,j)=>{
      const angle=j/24*Math.PI*2,s=station+Math.sin(angle)*14,u=(i%2?-1:1)*(4.5+Math.cos(angle)*3.0),p=countryClubPoint(s,u);return [p[0],p[2]] as const;
    })}));
    const spawns:CartSpawn[]=routes.map(r=>{const a=r.points[0],b=r.points[1];return {x:a[0],z:a[1],yaw:Math.atan2(-(b[0]-a[0]),-(b[1]-a[1]))};});
    const cache=new Map<string,number>();
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,40);
    const height=(x:number,z:number)=>{
      const key=`${x},${z}`;let y=cache.get(key);if(y!==undefined)return y;
      const near=countryClubNearestRoad(x,z),road=near.distance<=countryClubWidth(near.s)/2&&!COUNTRY_CLUB_GAPS.some(g=>near.s>g.a&&near.s<g.b);
      y=road?countryClubDeckHeight(near.s,near.u):countryClubGroundHeight(x,z);
      // The rough landscape is deliberately .85 m below the road. Query the real
      // collision skin, including edited road/deck geometry, instead of burying tyres.
      ray.ray.origin.set(x,y+16,z);
      const hit=level.raycastGround?.(ray)[0];if(hit)y=hit.point.y;
      if(cache.size>=8192)cache.delete(cache.keys().next().value!);cache.set(key,y);return y;
    };
    const ground:CartGround=(x,z)=>{
      const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
      const y=THREE.MathUtils.lerp(THREE.MathUtils.lerp(height(ix,iz),height(ix+1,iz),fx),THREE.MathUtils.lerp(height(ix,iz+1),height(ix+1,iz+1),fx),fz);
      const water=COUNTRY_CLUB_PONDS.some(p=>{const dx=x-p.x,dz=z-p.z;return y<p.y+.35&&Math.hypot((dx*p.r[0]+dz*p.r[2])/p.rx,(dx*p.f[0]+dz*p.f[2])/p.rz)<1.08;});
      return {height:y,grip:1,drag:.08,safe:!water&&x>COUNTRY_CLUB_BOUNDS.minX&&x<COUNTRY_CLUB_BOUNDS.maxX&&z>COUNTRY_CLUB_BOUNDS.minZ&&z<COUNTRY_CLUB_BOUNDS.maxZ};
    };
    // Physical trees/walls near patrols are represented by bounded circular proxies.
    const obstacles=level.walls.filter(w=>w.max.y-w.min.y>.7&&routes.some(r=>r.points.some(p=>p[0]>w.min.x-3&&p[0]<w.max.x+3&&p[1]>w.min.z-3&&p[1]<w.max.z+3)))
      .filter(w=>Math.max(w.max.x-w.min.x,w.max.z-w.min.z)<6).map((w,i)=>({x:(w.min.x+w.max.x)/2,z:(w.min.z+w.max.z)/2,radius:Math.max(w.max.x-w.min.x,w.max.z-w.min.z)/2,id:`course-wall-${i}`}));
    this.fleet=new GolfCartFleet({ground,spawns,routes,obstacles});this.scene.add(this.fleet.root);
    // Keep this referenced to document the coordinate contract for route authors.
    this.fleet.root.userData.courseForward=countryClubFrame(stations[0]).f;
  }
  setVisible(visible:boolean){if(this.fleet)this.fleet.root.visible=visible;}
  step(dt:number,player:Player){
    const fleet=this.fleet;if(!fleet)return;fleet.update(dt);this.spinCooldown=Math.max(0,this.spinCooldown-dt);
    if(player.state!=='ride'&&player.state!=='air')return;
    for(let i=0;i<fleet.physics.carts.length;i++){
      const c=fleet.physics.carts[i];if(Math.abs(player.pos.y-c.y)>.95)continue;
      const dx=player.pos.x-c.x,dz=player.pos.z-c.z,d=Math.hypot(dx,dz),radius=1.28;
      if(d>radius)continue;const nx=d>.01?dx/d:1,nz=d>.01?dz/d:0;
      if(player.spinning){if(this.spinCooldown===0){fleet.physics.kick(i,-nx*7,-nz*7,10);this.spinCooldown=.25;}continue;}
      const velocity=player.raceHeading.multiplyScalar(player.speed);
      const relative=(velocity.x-c.vx)*nx+(velocity.z-c.vz)*nz;
      player.pos.x+=nx*(radius-d);player.pos.z+=nz*(radius-d);
      if(relative<0){const impulse=Math.min(7,-relative*.65);if(-relative>7)player.beginPvpKnockdown(2.8,nx>=0?1:-1);else player.speed*=.82;fleet.physics.kick(i,-nx*impulse*.35,-nz*impulse*.35,Math.min(16,-relative));}
    }
  }
}
