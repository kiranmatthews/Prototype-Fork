/** Deterministic lightweight vehicle dynamics. No renderer, solver dependency or player-tuning writes. */
export interface CartInput { throttle:number; steer:number; brake:number; handbrake:boolean; hop?:boolean }
export interface GroundSample { height:number; grip:number; drag:number; safe:boolean }
export type CartGround=(x:number,z:number)=>GroundSample;
export interface CartObstacle {x:number;z:number;radius:number;id:string;height?:number}
export interface CartSpawn {x:number;z:number;yaw:number}
export interface CartImpact {cart:number;other:number|null;x:number;y:number;z:number;strength:number;panel:0|1|2}
export interface CartState extends CartSpawn {
  y:number;vx:number;vz:number;vy:number;yawRate:number;steer:number;speed:number;travel:number;
  roll:number;pitch:number;rollV:number;pitchV:number;impact:number;damage:number[];health:number;
  wheels:number[];grounded:boolean;respawns:number;unsafeTime:number;cooldown:number;hits:number;
  supportHeight:number;supportVelocity:number;airTime:number;airborneCount:number;hopCooldown:number;hopLatch:boolean;
  tumbling:boolean;tumbleAngle:number;tumbleVelocity:number;tumbleTime:number;rollCooldown:number;rolls:number;recoveries:number;
}
export const CART_PHYSICS=Object.freeze({step:1/120,maxSteps:24,mass:340,inertia:230,topSpeed:17,reverseSpeed:6,engine:8.4,brake:17,grip:7.7,wheelbase:1.72,radius:.78,probeOffset:.72,restitution:.38,gravity:13.5,hopVelocity:5.8,hopCooldown:1.0,rollImpact:10.5});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const finite=(v:number)=>Number.isFinite(v)?v:0;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
export const NO_CART_INPUT:CartInput=Object.freeze({throttle:0,steer:0,brake:0,handbrake:false});
export function createCartState(spawn:CartSpawn,ground:CartGround):CartState {
  const height=ground(spawn.x,spawn.z).height;
  return {...spawn,y:height,vx:0,vz:0,vy:0,yawRate:0,steer:0,speed:0,travel:0,roll:0,pitch:0,rollV:0,pitchV:0,impact:0,damage:[0,0,0],health:1,wheels:[0,0,0,0],grounded:true,respawns:0,unsafeTime:0,cooldown:0,hits:0,supportHeight:height,supportVelocity:0,airTime:0,airborneCount:0,hopCooldown:0,hopLatch:false,tumbling:false,tumbleAngle:0,tumbleVelocity:0,tumbleTime:0,rollCooldown:0,rolls:0,recoveries:0};
}
function spring(value:number,velocity:number,target:number,dt:number,k=65,damping=12):[number,number]{velocity+=(target-value)*k*dt-velocity*damping*dt;return [value+velocity*dt,velocity];}
/** Constant fixed step, bounded catch-up, two-circle rounded chassis contacts. */
export class GolfCartPhysics {
  readonly carts:CartState[];readonly inputs:CartInput[];readonly impacts:CartImpact[]=[];
  time=0;steps=0;droppedTime=0;private accumulator=0;
  constructor(readonly ground:CartGround,readonly spawns:readonly CartSpawn[],readonly obstacles:readonly CartObstacle[]=[]){
    this.carts=spawns.map(s=>createCartState(s,ground));this.inputs=spawns.map(()=>({...NO_CART_INPUT}));
  }
  reset(index:number,repair=true){const old=this.carts[index],fresh=createCartState(this.spawns[index],this.ground);if(!repair){fresh.damage=[...old.damage];fresh.health=old.health;fresh.respawns=old.respawns+1;fresh.hits=old.hits;fresh.rolls=old.rolls;fresh.recoveries=old.recoveries;fresh.airborneCount=old.airborneCount;}Object.assign(old,fresh);this.inputs[index]={...NO_CART_INPUT};}
  /** Controls are sampled at simulation frequency, keeping AI reproducible across render rates. */
  advance(dt:number,control?:(world:GolfCartPhysics)=>void){
    if(!Number.isFinite(dt)||dt<=0)return;const admitted=Math.min(dt,.2);this.droppedTime+=Math.max(0,dt-admitted);this.accumulator+=admitted;let n=0;
    while(this.accumulator+1e-10>=CART_PHYSICS.step&&n<CART_PHYSICS.maxSteps){control?.(this);this.step(CART_PHYSICS.step);this.accumulator-=CART_PHYSICS.step;n++;}
  }
  private step(dt:number){
    this.time+=dt;this.steps++;
    for(let index=0;index<this.carts.length;index++){
      const c=this.carts[index],input=this.inputs[index],g=this.ground(c.x,c.z);
      c.hopCooldown=Math.max(0,c.hopCooldown-dt);c.rollCooldown=Math.max(0,c.rollCooldown-dt);
      if(input.hop&&!c.hopLatch&&c.grounded&&!c.tumbling&&c.hopCooldown===0){c.vy=CART_PHYSICS.hopVelocity+Math.min(1.4,Math.abs(c.speed)*.09);c.grounded=false;c.airborneCount++;c.hopCooldown=CART_PHYSICS.hopCooldown;c.pitchV=1.3;c.impact=.9;}
      c.hopLatch=!!input.hop;
      const throttle=clamp(finite(input.throttle),-1,1),brake=clamp(finite(input.brake),0,1);
      c.steer+=(clamp(finite(input.steer),-1,1)-c.steer)*(1-Math.exp(-9*dt));
      const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),fx=-sn,fz=-cs,rx=cs,rz=-sn;
      let forward=c.vx*fx+c.vz*fz,lateral=c.vx*rx+c.vz*rz;
      const previous=forward,grip=clamp(g.grip,.12,1.3)*(input.handbrake?.20:1);
      const damageScale=1-.35*(1-c.health),cap=(throttle>=0?CART_PHYSICS.topSpeed:CART_PHYSICS.reverseSpeed)*damageScale;
      let acceleration=throttle*CART_PHYSICS.engine*Math.max(0,1-Math.max(0,forward*Math.sign(throttle))/cap);
      // Opposite pedal brakes first, then engages reverse at walking pace.
      if(throttle*forward<-.5)acceleration=throttle*CART_PHYSICS.brake;
      if(c.grounded&&!c.tumbling)forward+=acceleration*dt;
      const resistance=(.20+Math.abs(forward)*.018+g.drag+brake*CART_PHYSICS.brake+(input.handbrake?3.8:0))*dt;
      forward=Math.sign(forward)*Math.max(0,Math.abs(forward)-resistance);
      if(c.tumbling){forward*=Math.exp(-1.1*dt);lateral*=Math.exp(-.8*dt);}
      if(c.grounded)lateral*=Math.exp(-CART_PHYSICS.grip*grip*dt);else lateral*=Math.exp(-.15*dt);
      const steerAngle=c.steer*.54/(1+Math.abs(forward)*.035);
      const targetYaw=clamp(forward*Math.tan(steerAngle)/CART_PHYSICS.wheelbase,-2.3,2.3)*(input.handbrake?1.32:1);
      c.yawRate+=(targetYaw-c.yawRate)*(1-Math.exp(-(c.grounded?6*grip:1)*dt));c.yawRate=clamp(c.yawRate,-3,3);
      c.yaw=wrap(c.yaw+c.yawRate*dt);c.vx=fx*forward+rx*lateral;c.vz=fz*forward+rz*lateral;
      const horizontal=Math.hypot(c.vx,c.vz);if(horizontal>24){c.vx*=24/horizontal;c.vz*=24/horizontal;}
      c.x+=c.vx*dt;c.z+=c.vz*dt;c.speed=forward;c.travel+=forward*dt;c.impact*=Math.exp(-6*dt);c.cooldown=Math.max(0,c.cooldown-dt);
      const heights:number[]=[];let safe=true;
      for(let i=0;i<4;i++){const localX=i%2?.74:-.74,localZ=i<2?-.86:.86,sample=this.ground(c.x+cs*localX+sn*localZ,c.z-sn*localX+cs*localZ);heights.push(sample.height);safe&&=sample.safe;}
      const floor=heights.reduce((a,b)=>a+b,0)/4;
      const wasGrounded=c.grounded,terrainVelocity=clamp((floor-c.supportHeight)/dt,-10,10);
      if(wasGrounded&&c.supportVelocity>1.2&&terrainVelocity<c.supportVelocity-.6&&Math.abs(forward)>5){c.vy=Math.min(7.5,c.supportVelocity*1.65+1.0);c.grounded=false;c.airborneCount++;}
      if(c.grounded){c.y=floor;c.vy=0;}else{
        c.vy-=CART_PHYSICS.gravity*dt;c.y+=c.vy*dt;c.airTime+=dt;
        if(c.y<=floor+.005&&c.vy<=0){
          const impact=-c.vy,longFlight=c.airTime>.30;c.y=floor;c.grounded=true;
          if(impact>2.8){if(impact>8.3)this.damage(index,impact*.65,c.x,c.z,2);c.pitchV-=Math.min(2.2,impact*.22);c.impact=Math.max(c.impact,Math.min(1.2,impact*.12));}
          if(longFlight&&Math.abs(forward)>9&&(Math.abs(lateral)>4.2||Math.abs(c.roll)>.245))this.rollover(index,Math.sign(lateral||c.roll||1),impact);
          if(!c.tumbling&&impact>4.5){c.vy=Math.min(2.6,impact*.30);c.grounded=false;}else if(!c.tumbling)c.vy=0;
          c.airTime=0;
        }
      }
      c.supportHeight=floor;c.supportVelocity=terrainVelocity;
      const front=(heights[0]+heights[1])/2,back=(heights[2]+heights[3])/2,left=(heights[0]+heights[2])/2,right=(heights[1]+heights[3])/2;
      const terrainPitch=Math.atan2(front-back,1.72),terrainRoll=Math.atan2(right-left,1.48);
      const rollTarget=clamp(terrainRoll-forward*c.yawRate*.013,-.28,.28),pitchTarget=clamp(terrainPitch+(forward-previous)/dt*.008,-.22,.24);
      [c.roll,c.rollV]=spring(c.roll,c.rollV,rollTarget,dt);[c.pitch,c.pitchV]=spring(c.pitch,c.pitchV,pitchTarget,dt);
      c.roll=clamp(c.roll,-.38,.38);c.pitch=clamp(c.pitch,-.35,.35);
      if(c.tumbling){
        c.tumbleTime+=dt;
        if(c.tumbleTime<2.4){c.tumbleVelocity+=Math.sin(c.tumbleAngle)*2.5*dt;c.tumbleVelocity*=Math.exp(-(c.grounded?.8:.16)*dt);c.tumbleAngle+=c.tumbleVelocity*dt;}
        else{const target=Math.round(c.tumbleAngle/(Math.PI*2))*Math.PI*2;[c.tumbleAngle,c.tumbleVelocity]=spring(c.tumbleAngle,c.tumbleVelocity,target,dt,24,9);}
        if(c.tumbleTime>2.8&&Math.abs(wrap(c.tumbleAngle))<.035&&Math.abs(c.tumbleVelocity)<.18||c.tumbleTime>5){c.tumbleAngle=0;c.tumbleVelocity=0;c.tumbling=false;c.recoveries++;c.impact=.5;}
      }
      for(let i=0;i<4;i++)c.wheels[i]=clamp(heights[i]-floor,-.16,.16);
      c.unsafeTime=safe?0:c.unsafeTime+dt;
      if(c.unsafeTime>1.1||c.y<floor-6||![c.x,c.z,c.y,c.yaw,c.vx,c.vz].every(Number.isFinite))this.reset(index,false);
    }
    // Stable finite contact work: five vehicles, two chassis circles, three solver passes.
    for(let iteration=0;iteration<3;iteration++){
      for(let i=0;i<this.carts.length;i++){
        const a=this.carts[i];
        for(const obstacle of this.obstacles)for(const side of [-1,1]){
          const ax=a.x+Math.sin(a.yaw)*CART_PHYSICS.probeOffset*side,az=a.z+Math.cos(a.yaw)*CART_PHYSICS.probeOffset*side;
          const dx=ax-obstacle.x,dz=az-obstacle.z,r=CART_PHYSICS.radius+obstacle.radius,d=Math.hypot(dx,dz);
          // Low obstacles can be cleared in a hop. Tall course proxies remain solid.
          if(d<r&&a.y-this.ground(obstacle.x,obstacle.z).height<(obstacle.height??6))this.resolve(i,null,d>1e-5?dx/d:1,d>1e-5?dz/d:0,r-d,ax,az,iteration===0);
        }
        for(let j=i+1;j<this.carts.length;j++){
          const b=this.carts[j];if(Math.abs(a.y-b.y)>1.4||Math.hypot(a.x-b.x,a.z-b.z)>3.1)continue;
          for(const sa of [-1,1])for(const sb of [-1,1]){
            const ax=a.x+Math.sin(a.yaw)*CART_PHYSICS.probeOffset*sa,az=a.z+Math.cos(a.yaw)*CART_PHYSICS.probeOffset*sa;
            const bx=b.x+Math.sin(b.yaw)*CART_PHYSICS.probeOffset*sb,bz=b.z+Math.cos(b.yaw)*CART_PHYSICS.probeOffset*sb,dx=ax-bx,dz=az-bz,d=Math.hypot(dx,dz),r=CART_PHYSICS.radius*2;
            if(d<r)this.resolve(i,j,d>1e-5?dx/d:1,d>1e-5?dz/d:0,r-d,(ax+bx)/2,(az+bz)/2,iteration===0);
          }
        }
      }
    }
  }
  private resolve(ia:number,ib:number|null,nx:number,nz:number,depth:number,x:number,z:number,damage:boolean){
    const a=this.carts[ia],b=ib===null?null:this.carts[ib],share=b?.5:1;
    const push=Math.max(0,depth-.001)*.82;a.x+=nx*push*share;a.z+=nz*push*share;if(b){b.x-=nx*push*share;b.z-=nz*push*share;}
    const arx=x-a.x,arz=z-a.z,brx=b?x-b.x:0,brz=b?z-b.z:0;
    const relative=(a.vx+a.yawRate*arz-(b?b.vx+b.yawRate*brz:0))*nx+(a.vz-a.yawRate*arx-(b?b.vz-b.yawRate*brx:0))*nz;
    if(relative>=0)return;
    const ca=arz*nx-arx*nz,cb=brz*nx-brx*nz,inv=1/CART_PHYSICS.mass,invI=1/CART_PHYSICS.inertia;
    const impulse=-(1+CART_PHYSICS.restitution)*relative/(inv*(b?2:1)+ca*ca*invI+(b?cb*cb*invI:0));
    a.vx+=nx*impulse*inv;a.vz+=nz*impulse*inv;a.yawRate=clamp(a.yawRate+ca*impulse*invI,-3,3);
    if(b){b.vx-=nx*impulse*inv;b.vz-=nz*impulse*inv;b.yawRate=clamp(b.yawRate-cb*impulse*invI,-3,3);}
    if(damage&&-relative>2.1){this.damage(ia,-relative,x,z,undefined,ib);if(ib!==null)this.damage(ib,-relative,x,z,undefined,ia);}
  }
  damage(index:number,strength:number,x:number,z:number,panel?:0|1|2,other:number|null=null){
    const c=this.carts[index];if(c.cooldown>0||!Number.isFinite(strength))return;
    strength=clamp(strength,0,22);const localZ=(x-c.x)*Math.sin(c.yaw)+(z-c.z)*Math.cos(c.yaw);
    const hit=panel??(localZ<-.25?0:localZ>.25?1:2),amount=clamp((strength-1.6)*.042,0,.55);if(amount<=0)return;
    c.damage[hit]=clamp(c.damage[hit]+amount,0,1);c.health=Math.max(.15,1-c.damage.reduce((a,b)=>a+b,0)*.25);c.impact=Math.min(1.4,strength*.12);c.pitchV+=localZ<0?-strength*.11:strength*.11;c.rollV+=(x-c.x)*strength*.08;c.cooldown=.18;c.hits++;
    if(this.impacts.length===64)this.impacts.shift();
    this.impacts.push({cart:index,other,x,y:c.y+.75,z,strength,panel:hit});
    const localX=(x-c.x)*Math.cos(c.yaw)-(z-c.z)*Math.sin(c.yaw);
    if(strength>CART_PHYSICS.rollImpact&&Math.abs(localX)>.5&&Math.abs(localX)>Math.abs(localZ)*1.25)this.rollover(index,-Math.sign(localX),strength);
    else if(strength>6.5&&c.grounded&&!c.tumbling){c.vy=Math.min(3.6,strength*.21);c.grounded=false;c.airborneCount++;}
  }
  private rollover(index:number,sign:number,strength:number){const c=this.carts[index];if(c.tumbling||c.rollCooldown>0)return;c.tumbling=true;c.tumbleAngle=sign*.05;c.tumbleVelocity=sign*(4.2+Math.min(strength,16)*.14);c.tumbleTime=0;c.rollCooldown=7;c.rolls++;c.vy=Math.max(c.vy,2.8);c.grounded=false;c.vx*=.85;c.vz*=.85;}
  /** Controlled external impulse for player attacks; bounded to preserve solver stability. */
  kick(index:number,vx:number,vz:number,strength:number){const c=this.carts[index];c.vx+=clamp(finite(vx),-12,12);c.vz+=clamp(finite(vz),-12,12);this.damage(index,strength,c.x-vx*.1,c.z-vz*.1);}
}

export interface CartRoute {points:readonly (readonly [number,number])[];speed:number}
/** Look-ahead steering with obstacle braking and reverse recovery; route state belongs to one controller. */
export class CartAutopilot {
  private target=1;private stuck=0;private reversing=0;private initialized=false;
  constructor(readonly route:CartRoute){}
  sample(c:CartState,dt:number):CartInput {
    const points=this.route.points;if(points.length<2)return {...NO_CART_INPUT};
    if(!this.initialized){this.initialized=true;let nearest=Infinity;for(let i=0;i<points.length;i++){const p=points[i],d=Math.hypot(p[0]-c.x,p[1]-c.z);if(d<nearest){nearest=d;this.target=(i+1)%points.length;}}}
    let p=points[this.target];if(Math.hypot(p[0]-c.x,p[1]-c.z)<3.5){this.target=(this.target+1)%points.length;p=points[this.target];}
    const angle=wrap(Math.atan2(-(p[0]-c.x),-(p[1]-c.z))-c.yaw),steer=clamp(angle*1.6,-1,1);
    const desired=this.route.speed*(1-Math.min(.7,Math.abs(angle)*.45));
    this.stuck=Math.abs(c.speed)<.55?this.stuck+dt:0;
    if(this.stuck>2.8){this.reversing=1.3;this.stuck=0;}
    if(this.reversing>0){this.reversing-=dt;return {throttle:-.7,steer:-steer,brake:0,handbrake:false};}
    return {throttle:c.speed<desired?.85:0,steer,brake:c.speed>desired+1?.4:0,handbrake:false};
  }
}
