/** Jak 1 green-vent particle graph, in metres and native 300 Hz timer units.
 * collectables-part.gc 222–227, sp-orbiter, sp-process-block-2d.
 * Rendering is deliberately absent: texture and Gouraud views read the same
 * positions, sizes, rotations and RGBA. RNG is locally seeded, not game-global.
 */
export const ECO_CLOCK_STEP = 5; // 300 Hz timer, updated at the game's 60 Hz
export const ECO_PARTICLE_CAPACITY = 1536; // per vent, including long-lived trails
export type EcoSprite = 'hotdot' | 'bigpuff' | 'starflash';

export interface EcoParticle {
  alive: boolean;
  kind: EcoSprite;
  x: number; y: number; z: number;
  size: number; rotation: number;
  r: number; g: number; b: number; a: number;
  timer: number; age: number; next: number;
  vy: number; acceleration: number; shrink: number; spin: number;
  fadeR: number; fadeA: number;
}
interface EcoOrbiter {
  timer: number; age: number; born: boolean;
  x: number; y: number; z: number; vy: number;
  radius: number; omega: number; omegaVelocity: number; tilt: number;
  particle: EcoParticle;
}
const blank = (): EcoParticle => ({alive:false,kind:'hotdot',x:0,y:0,z:0,size:0,rotation:0,
  r:0,g:0,b:0,a:0,timer:0,age:0,next:0,vy:0,acceleration:0,shrink:0,spin:0,fadeR:0,fadeA:0});

export class GreenEcoMotion {
  readonly particles = Array.from({length:ECO_PARTICLE_CAPACITY}, blank);
  // The source group has exactly fifteen start-dead 223/224 bindings.
  readonly orbiters: EcoOrbiter[] = Array.from({length:15},()=>({timer:0,age:0,born:false,
    x:0,y:0,z:0,vy:0,radius:0,omega:0,omegaVelocity:0,tilt:0,particle:blank()}));
  clock = 0;
  dropped = 0;
  private randomState: number;
  private cursor = 0;
  private carrierCredit = 0;
  private smokeCredit = 0;
  private flashCredit = 0;

  constructor(seed = 1) {this.randomState = seed >>> 0 || 1;}
  private random(): number {
    let n = this.randomState;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.randomState = n >>> 0;
    return this.randomState / 4294967296;
  }
  private range(base: number, spread: number): number {return base + this.random() * spread;}
  private allocate(kind: EcoSprite): EcoParticle | null {
    for (let i=0;i<this.particles.length;i++) {
      const p = this.particles[this.cursor]; this.cursor = (this.cursor + 1) % this.particles.length;
      if (p.alive) continue;
      p.alive=true;
      p.kind=kind; p.age=0; p.next=0; p.vy=0; p.acceleration=0; p.shrink=0; p.spin=0;
      p.fadeR=0; p.fadeA=0; p.rotation=0; p.b=0;
      return p;
    }
    this.dropped++; return null;
  }

  private carrier(): void {
    const o = this.orbiters.find(o=>o.timer<=0 && !o.particle.alive);
    if (!o) return; // the source's finite binding table is full
    const radius = this.range(-1,2), yaw = this.random()*Math.PI*2;
    o.x = radius*Math.cos(yaw); o.z = -radius*Math.sin(yaw); o.y=0;
    o.vy=this.range(.006666667,.0033333334); o.timer=750; o.age=0; o.born=false;
    o.particle.timer=0;
  }
  private orbit(o: EcoOrbiter): void {
    o.born=true;
    // In an orbiter, sprite Y encodes a tilt, not a 0–16 metre spawn height.
    // 16 GOAL metres = 65536 angle units = one revolution.
    o.tilt=this.random()*Math.PI*2; o.radius=this.range(.2,.6);
    o.omega=this.random()*Math.PI*2;
    o.omegaVelocity=this.range(.053333335,.053333335)*Math.PI/8;
    const p=o.particle;
    p.alive=true; p.kind='hotdot'; p.size=this.range(.3,.3); p.rotation=0;
    p.r=128; p.g=255; p.b=0; p.a=127;
    p.age=0; p.timer=600+Math.floor(this.random()*149);
    p.next=450+Math.floor(this.random()*149); p.fadeR=-.2; p.fadeA=0;
  }
  private trail(head: EcoParticle): void {
    const p=this.allocate('hotdot'); if(!p)return;
    p.x=head.x; p.y=head.y; p.z=head.z; p.size=.2;
    p.r=255; p.g=255; p.a=96; p.shrink=-.0006060606;
    p.fadeR=-2.8333333; p.acceleration=-.00020000001;
    p.timer=30+Math.floor(this.random()*299); p.next=90;
  }
  private smoke(): void {
    const p=this.allocate('bigpuff'); if(!p)return;
    p.x=this.range(-.75,1.5); p.y=.5; p.z=this.range(-.75,1.5);
    p.size=this.range(1.9,1.9); p.rotation=this.random()*Math.PI*2;
    p.r=this.range(0,64); p.g=this.range(92,32); p.a=32;
    p.vy=this.range(.016666668,.016666668);
    p.spin=(this.random()<.5 ? -.1 : .1)*Math.PI/180;
    p.fadeA=-.10666667; p.timer=300;
  }
  private flash(): void {
    const p=this.allocate('starflash'); if(!p)return;
    p.x=this.range(-.5,1); p.y=.5; p.z=this.range(-.5,1);
    p.size=this.range(1.5,.4); p.rotation=this.random()*Math.PI*2;
    p.r=128; p.g=128; p.a=64; p.vy=this.range(.01,.01);
    p.spin=this.range(-.1,.1)*Math.PI/180; p.fadeA=-.21333334; p.timer=300;
  }

  step(emit = true): void {
    const previous=this.clock; this.clock+=ECO_CLOCK_STEP;
    if(emit) {
      // Integrate the actual 48-tick period / 5-tick launch window, including
      // the fractional birth credit when a frame straddles the window edge.
      let overlap=0;
      for(let tick=previous;tick<this.clock;tick++) if(tick%48<5) overlap++;
      this.carrierCredit+=overlap*.2;
      if(this.carrierCredit>=1-1e-8) {this.carrierCredit-=1;this.carrier();}
      this.smokeCredit+=this.range(.6,.6);
      while(this.smokeCredit>=1) {this.smokeCredit--;this.smoke();}
      this.flashCredit+=this.range(.1,.3);
      while(this.flashCredit>=1) {this.flashCredit--;this.flash();}
    }
    for(const o of this.orbiters) {
      const p=o.particle;
      if(o.timer<=0 && !p.alive)continue;
      // Children launch on the following group pass, before particle update.
      // Trails therefore remain at the preceding head position, as in Jak.
      if(emit && p.alive && p.age>0) this.trail(p);
      if(emit && !o.born && o.timer>0 && o.age>0)this.orbit(o);
      if(o.timer>0) {o.timer=Math.max(0,o.timer-5);o.age+=5;o.y+=o.vy*5;}
      if(!p.alive)continue;
      // Native processing retires an already-zero timer, then decrements it.
      // A particle still renders on the frame that first reaches zero.
      if(p.timer<=0) {p.alive=false;continue;}
      p.timer=Math.max(0,p.timer-5); p.age+=5;
      p.next-=5;
      if(p.next<=0 && p.fadeA===0) {p.timer=150;p.fadeR=0;p.fadeA=-.8466667;}
      o.omega+=o.omegaVelocity*5;
      const z=Math.cos(o.omega)*o.radius;
      p.x=o.x+Math.sin(o.omega)*o.radius;
      p.y=o.y-z*Math.sin(o.tilt); p.z=o.z+z*Math.cos(o.tilt);
      p.r=Math.max(0,p.r+p.fadeR*5); p.a=Math.max(0,p.a+p.fadeA*5);
      if(p.a<=0)p.alive=false; // source bit2 retires zero-alpha particles immediately
    }
    for(const p of this.particles) {
      if(!p.alive)continue;
      if(p.timer<=0) {p.alive=false;continue;}
      p.timer=Math.max(0,p.timer-5); p.age+=5;
      if(p.next>0) {p.next-=5;if(p.next<=0)p.fadeR=0;}
      // The source multiplies acceleration by frame-time.z (=1), then
      // velocity, colour/scale fades and spin by frame-time.y (=5).
      p.vy+=p.acceleration; p.y+=p.vy*5;
      p.size=Math.max(0,p.size+p.shrink*5); p.rotation+=p.spin*5;
      p.r=Math.max(0,p.r+p.fadeR*5); p.a=Math.max(0,p.a+p.fadeA*5);
      if(p.a<=0)p.alive=false;
    }
  }
  clear(): void {
    for(const p of this.particles){p.timer=0;p.alive=false;}
    for(const o of this.orbiters){o.timer=0;o.particle.timer=0;o.particle.alive=false;}
    this.carrierCredit=this.smokeCredit=this.flashCredit=0;
  }
}
