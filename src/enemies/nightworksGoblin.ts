import * as THREE from 'three';
import type { Enemy } from '../level';
import { goblinShambleSpeed } from './goblinStumble';

/** Nightworks owns a biped behaviour, independent of the catalog's old grunt/hopper labels. */
export const GOBLIN = { artworkScale: 4, height: 2.65, width: 1.75, staggerTime: 1.1 } as const;
interface Droplet { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number }
interface Goblin {
  seed: number; initialSeed: number; hp: number; remaining: number; lastHit?: object;
  direction: THREE.Vector3; home: THREE.Vector3; clock: number; sprayClock: number;
  spray?: THREE.InstancedMesh; drops: Droplet[]; cursor: number; bursts: number;
}
const brains = new WeakMap<Enemy, Goblin>();
const next = new THREE.Vector3(), away = new THREE.Vector3(), mouth = new THREE.Vector3();
const dummy = new THREE.Object3D(), tint = new THREE.Color();
export const isNightworksGoblin = (e: Enemy): boolean => e.visual.diagnostics.appearance === 'nightworks';
function random(b: Goblin): number {
  b.seed ^= b.seed << 13; b.seed ^= b.seed >>> 17; b.seed ^= b.seed << 5;
  return (b.seed >>> 0) / 4294967296;
}
function brain(e: Enemy): Goblin {
  let b = brains.get(e);
  if (!b) {
    const p = e.group.position, seed = ((p.x * 17389 + p.z * 7919 + p.y * 104729) | 0) ^ 0x51c0ffee;
    b = { seed, initialSeed: seed, hp: 2, remaining: 2, direction: new THREE.Vector3(1,0,0),
      home: p.clone(), clock: 0, sprayClock: 0, drops: [], cursor: 0, bursts: 0 };
    brains.set(e, b);
    b.remaining = 1.4 + random(b) * 2.4;
    const angle = random(b) * Math.PI * 2;
    b.direction.set(Math.sin(angle),0,Math.cos(angle));
    e.state = 'shamble'; e.stateT = 0;
  }
  return b;
}
function spray(e: Enemy, b: Goblin, count: number): void {
  if (!b.spray) {
    b.spray = new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),
      new THREE.MeshStandardMaterial({color:0xb4cc38,roughness:.23,metalness:.04,emissive:0x293800,emissiveIntensity:.38}),64);
    b.spray.name = 'Nightworks flying snot and wet splats'; b.spray.frustumCulled = false;
    b.spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    e.group.parent?.add(b.spray);
    b.drops = Array.from({length:64},()=>({p:new THREE.Vector3(),v:new THREE.Vector3(),life:0,max:1,size:.1}));
    for (let i=0;i<64;i++) { tint.setHSL(.18+random(b)*.05,.65,.26+random(b)*.22); b.spray.setColorAt(i,tint); }
  }
  const yaw = e.group.rotation.y;
  if(!e.visual.getMouthPosition?.(mouth))mouth.copy(e.group.position).add(new THREE.Vector3(Math.sin(yaw)*.52,2.18,Math.cos(yaw)*.52));
  for (let i=0;i<count;i++) {
    const d=b.drops[b.cursor++%64], angle=yaw+(random(b)-.5)*2.8, speed=1.7+random(b)*4;
    d.p.copy(mouth);
    d.v.set(Math.sin(angle)*speed, .9+random(b)*3.2, Math.cos(angle)*speed);
    d.max=d.life=1.3+random(b)*.8; d.size=.06+random(b)*.095;
  }
  b.bursts++;
}
/** Returns false for the first hit and protected contacts; true for a lethal second hit. */
export function hitNightworksGoblin(e: Enemy, source: THREE.Vector3, token?: object): boolean {
  const b=brain(e);
  if(e.state==='stagger'||(token!==undefined&&b.lastHit===token))return false;
  b.lastHit=token;
  if(--b.hp<=0){spray(e,b,24);return true;}
  away.copy(e.group.position).sub(source).setY(0);
  if(away.lengthSq()<.01)away.set(-Math.sin(e.group.rotation.y),0,-Math.cos(e.group.rotation.y));
  b.direction.copy(away.normalize());
  // Recoil immediately; the body turns toward the attacker over the next
  // catch steps instead of snapping its complete skeleton through 180°.
  e.state='stagger';e.stateT=0;b.remaining=GOBLIN.staggerTime;
  e.touchHurt=false;spray(e,b,19);
  return false;
}
export function resetNightworksGoblin(e: Enemy): void {
  const b=brains.get(e); if(!b)return;
  b.seed=b.initialSeed;b.hp=2;b.lastHit=undefined;b.clock=b.sprayClock=0;
  b.remaining=1.4+random(b)*2.4;const angle=random(b)*Math.PI*2;
  b.direction.set(Math.sin(angle),0,Math.cos(angle));
  e.group.position.copy(b.home);e.state='shamble';e.stateT=0;
  for(const d of b.drops)d.life=0;if(b.spray)b.spray.visible=false;
}
/** Every candidate footprint must remain on its original island, including recoil. */
export function stepNightworksGoblin(e: Enemy, dt: number, supported:(x:number,z:number,y:number)=>boolean): void {
  const b=brain(e);b.clock+=dt;
  if(e.alive){
    e.stateT+=dt;b.remaining-=dt;
    if(b.remaining<=0){
      e.stateT=0;
      if(e.state==='shamble') {e.state='windup';b.remaining=.26+random(b)*.19;}
      else if(e.state==='windup') {
        e.state='lurch';b.remaining=.32+random(b)*.22;
        const angle=random(b)*Math.PI*2;b.direction.set(Math.sin(angle),0,Math.cos(angle));spray(e,b,16);
      } else if(e.state==='lurch'){
        e.state='recover';b.remaining=.65+random(b)*.23;
      } else {
        e.state='shamble';b.remaining=2.1+random(b)*3.5;
        const angle=random(b)*Math.PI*2;b.direction.set(Math.sin(angle),0,Math.cos(angle));
      }
    }
    const speed=e.state==='lurch'?5.4:e.state==='stagger'?3.6*Math.max(0,1-e.stateT/GOBLIN.staggerTime)
      :e.state==='windup'?0:e.state==='recover'?.18:goblinShambleSpeed(b.clock);
    next.copy(e.group.position).addScaledVector(b.direction,speed*dt);
    const along=e.axis==='z'?'z':'x',cross=e.axis==='z'?'x':'z';
    next[along]=THREE.MathUtils.clamp(next[along],e.x0,e.x1);
    next[cross]=THREE.MathUtils.clamp(next[cross],b.home[cross]-1.35,b.home[cross]+1.35);
    let safe=true;
    for(const [x,z] of [[0,0],[-.65,-.45],[.65,-.45],[-.65,.45],[.65,.45]])
      if(!supported(next.x+x,next.z+z,e.baseY)){safe=false;break;}
    if(safe)e.group.position.copy(next);
    if(!safe||next[along]===e.x0||next[along]===e.x1||Math.abs(next[cross]-b.home[cross])>=1.35)b.direction.negate();
    if(e.state!=='windup'){
      const sign=e.state==='stagger'?-1:1;
      const target=Math.atan2(b.direction.x*sign,b.direction.z*sign);
      const delta=Math.atan2(Math.sin(target-e.group.rotation.y),Math.cos(target-e.group.rotation.y));
      const fast=e.state==='lurch'||e.state==='stagger',limit=dt*(fast?6.5:2.2);
      e.group.rotation.y+=THREE.MathUtils.clamp(delta*(1-Math.exp(-dt*(fast?10:2.4))),-limit,limit);
    }
    e.touchHurt=e.state!=='stagger';e.vy=0;
    b.sprayClock-=dt;
    if(b.sprayClock<=0){b.sprayClock=e.state==='lurch'?.085:.65+random(b)*.7;spray(e,b,e.state==='lurch'?5:1);}
  }
  let live=0;
  for(let i=0;i<b.drops.length;i++){
    const d=b.drops[i];d.life=Math.max(0,d.life-dt);
    if(d.life>0){
      d.v.y-=13*dt;d.p.addScaledVector(d.v,dt);
      const floor=e.baseY+.025;
      const splat=d.p.y<=floor&&supported(d.p.x,d.p.z,e.baseY);
      if(splat){d.p.y=floor;d.v.set(0,0,0);}
      dummy.position.copy(d.p);const s=d.size*Math.min(1,d.life*3);
      dummy.scale.set(s*(splat?2:1),s*(splat?.18:1.6),s*(splat?2:1));live++;
    }else dummy.scale.setScalar(0);
    dummy.updateMatrix();b.spray!.setMatrixAt(i,dummy.matrix);
  }
  if(b.spray){b.spray.visible=live>0;b.spray.instanceMatrix.needsUpdate=true;}
  e.group.userData.goblinMotion={clock:b.clock};
  e.group.userData.goblin={hp:b.hp,state:e.state,sprayBursts:b.bursts,liveDroplets:live};
}
