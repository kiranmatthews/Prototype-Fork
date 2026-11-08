/** Behavioural port of OpenGOAL Jak 1 ropebridge.gc (ISC, see
 * docs/rope-bridges/OPEN_GOAL_LICENSE.txt). Distances are metres, velocities
 * metres/second. The original solver adds force/mass PER 60 Hz TICK, then
 * integrates position with 1/60. Multiplying acceleration by dt again is wrong.
 * Its spring expression uses squared length, not an ordinary Hooke spring.
 * Authored level geometry is the unloaded pose; simulate around the original
 * gravity equilibrium so existing gaps and landings keep their rest heights. */
export const JAK_BRIDGE = Object.freeze({
  hz:60, mass:.018, stiffness:.16384, friction:.97,
  gravity:-22.755556/4096, riderGravity:-56.88889/4096,
  desiredLengthSquared:4096/(4096*4096), influence:12,
  impactMin:2, impactMax:19, impactVelocity:12, impactCooldown:.2,
});
export interface BridgeLoad { distance:number; across:number; }
export interface BridgeSample { height:number; along:number; pitch:number; velocity:number; }

export class RopeBridgePhysics {
  readonly count:number;
  readonly spacing:number;
  readonly y:Float64Array;
  readonly z:Float64Array;
  readonly vy:Float64Array;
  readonly vz:Float64Array;
  readonly restY:Float64Array;
  readonly restZ:Float64Array;
  private readonly balanceY:Float64Array;
  private readonly balanceZ:Float64Array;
  private accumulator=0;
  private quiet=0;
  private bonkTime=-Infinity;
  time=0;
  awake=false;
  readonly diagnostics={ticks:0,impacts:0,maxDisplacement:0,maxSpeed:0};

  constructor(readonly length:number) {
    if(!Number.isFinite(length)||length<.1||length>2000)throw new Error('Invalid suspension span');
    this.count=Math.max(2,Math.min(35,Math.ceil(length/2)))+1;
    this.spacing=length/(this.count-1);
    this.y=new Float64Array(this.count);this.z=new Float64Array(this.count);
    this.vy=new Float64Array(this.count);this.vz=new Float64Array(this.count);
    this.restY=new Float64Array(this.count);this.restZ=new Float64Array(this.count);
    this.balanceY=new Float64Array(this.count);this.balanceZ=new Float64Array(this.count);
    for(let i=0;i<this.count;i++){
      this.restY[i]=JAK_BRIDGE.gravity/(2*JAK_BRIDGE.stiffness)*i*(this.count-1-i);
      this.restZ[i]=i*this.spacing;
    }
    this.y.set(this.restY);this.z.set(this.restZ);
    // Remove only the residual of the analytic rest pose. The original
    // nonlinear spring law, damping and moving load remain unaltered.
    for(let i=1;i<this.count-1;i++){
      const [fy,fz]=this.force(i);this.balanceY[i]=fy;this.balanceZ[i]=fz;
    }
  }
  private force(i:number):[number,number] {
    let fy=JAK_BRIDGE.gravity,fz=0;
    for(const j of [i-1,i+1]){
      const dy=this.y[j]-this.y[i],dz=this.z[j]-this.z[i],d2=dy*dy+dz*dz;
      if(d2>JAK_BRIDGE.desiredLengthSquared){
        const tension=JAK_BRIDGE.stiffness*(d2-JAK_BRIDGE.desiredLengthSquared)/d2;
        fy+=dy*tension;fz+=dz*tension;
      }
    }
    return [fy,fz];
  }
  impact(distance:number,speed:number,slam=false):boolean {
    if(!Number.isFinite(distance+speed)||distance<0||distance>this.length||
      this.time-this.bonkTime<JAK_BRIDGE.impactCooldown)return false;
    const v=slam?JAK_BRIDGE.impactMax*1.1:Math.min(JAK_BRIDGE.impactMax,Math.max(0,speed));
    if(v<JAK_BRIDGE.impactMin)return false;
    this.bonkTime=this.time;
    const impulse=(v-JAK_BRIDGE.impactMin)/(JAK_BRIDGE.impactMax-JAK_BRIDGE.impactMin)*JAK_BRIDGE.impactVelocity;
    for(let i=1;i<this.count-1;i++){
      const d=Math.abs(this.z[i]-distance);
      if(d<=JAK_BRIDGE.influence)this.vy[i]-=impulse/(1+8*d/JAK_BRIDGE.influence);
    }
    this.awake=true;this.quiet=0;this.diagnostics.impacts++;return true;
  }
  update(dt:number,loads:readonly BridgeLoad[]=[]):boolean {
    if(!Number.isFinite(dt)||dt<=0)return false;
    this.accumulator+=Math.min(dt,.25);
    let changed=false;
    while(this.accumulator+1e-10>=1/JAK_BRIDGE.hz){
      this.accumulator=Math.max(0,this.accumulator-1/JAK_BRIDGE.hz);this.time+=1/JAK_BRIDGE.hz;
      if(loads.length){this.awake=true;this.quiet=0;}
      if(!this.awake)continue;
      const riders=loads.map(load=>{
        const u=Math.max(0,Math.min(this.count-1,load.distance/this.spacing));
        const i=Math.min(this.count-2,Math.floor(u)),t=u-i;
        return {...load,y:this.y[i]*(1-t)+this.y[i+1]*t};
      });
      for(let i=1;i<this.count-1;i++){
        let [fy,fz]=this.force(i);fy-=this.balanceY[i];fz-=this.balanceZ[i];
        for(const rider of riders){
          const d=Math.hypot(rider.across,this.z[i]-rider.distance,this.y[i]-rider.y);
          if(d<=JAK_BRIDGE.influence)fy+=JAK_BRIDGE.riderGravity/(1+8*d/JAK_BRIDGE.influence);
        }
        this.vy[i]=(this.vy[i]+fy/JAK_BRIDGE.mass)*JAK_BRIDGE.friction;
        this.vz[i]=(this.vz[i]+fz/JAK_BRIDGE.mass)*JAK_BRIDGE.friction;
      }
      let displacement=0,speed=0;
      for(let i=1;i<this.count-1;i++){
        this.y[i]+=this.vy[i]/JAK_BRIDGE.hz;this.z[i]+=this.vz[i]/JAK_BRIDGE.hz;
        displacement=Math.max(displacement,Math.abs(this.y[i]-this.restY[i]),Math.abs(this.z[i]-this.restZ[i]));
        speed=Math.max(speed,Math.abs(this.vy[i]),Math.abs(this.vz[i]));
      }
      this.diagnostics.ticks++;this.diagnostics.maxDisplacement=displacement;this.diagnostics.maxSpeed=speed;
      if(!loads.length&&displacement<.0001&&speed<.0001){if(++this.quiet>=30)this.reset();}else this.quiet=0;
      changed=true;
    }
    return changed;
  }
  sample(distance:number,out:BridgeSample={height:0,along:0,pitch:0,velocity:0}):BridgeSample {
    const u=Math.max(0,Math.min(this.count-1,distance/this.spacing));
    const i=Math.min(this.count-2,Math.floor(u)),t=u-i;
    const a=this.y[i]-this.restY[i],b=this.y[i+1]-this.restY[i+1];
    const za=this.z[i]-this.restZ[i],zb=this.z[i+1]-this.restZ[i+1];
    out.height=a*(1-t)+b*t;out.along=za*(1-t)+zb*t;
    out.pitch=Math.atan2(b-a,this.spacing+zb-za);out.velocity=this.vy[i]*(1-t)+this.vy[i+1]*t;
    return out;
  }
  reset():void {
    this.y.set(this.restY);this.z.set(this.restZ);this.vy.fill(0);this.vz.fill(0);
    this.awake=false;this.quiet=0;this.accumulator=0;this.bonkTime=-Infinity;
    this.diagnostics.maxDisplacement=this.diagnostics.maxSpeed=0;
  }
}
