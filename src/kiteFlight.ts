import * as THREE from 'three';
import type { SolidSurface, WorldSolids } from './worldSolids';

export const KITE_FLIGHT = Object.freeze({height:22,lead:104,canopyScale:3,windSway:1.6,minX:-2.4,maxX:4.2,clearance:.8,lookAhead:.7});

/** Presentation only. The foil clears roof/scenery envelopes; lines can cross
 * scenery and neither the tow motion nor the rider's contacts are changed. */
export class KiteFlight {
  readonly position=new THREE.Vector3();
  readonly rotation=new THREE.Euler();
  readonly canopyBounds=new THREE.Box3(new THREE.Vector3(-4.7,-2.55,-.667),new THREE.Vector3(4.7,2.25,3.067));
  private readonly rotated=new THREE.Box3();
  private readonly query=new THREE.Box3();
  private readonly matrix=new THREE.Matrix4();
  private readonly previous=new THREE.Vector3();
  private readonly forecast=new THREE.Vector3();
  private readonly candidates=new Set<SolidSurface>();
  private height=NaN;
  private lead=NaN;
  private initialized=false;
  obstructionCount=0;

  reset():void{this.initialized=false;this.height=this.lead=NaN;this.obstructionCount=0;}

  private floor(x:number,z:number,base:number,solids:WorldSolids|undefined,ahead:boolean,returnZ=z):number{
    if(!solids)return base;
    const b=this.rotated,q=this.query;
    q.min.set(x+b.min.x-.65,base+b.min.y-.1,z+b.min.z-.65);
    q.max.set(x+b.max.x+.65,base+24,z+b.max.z+.65);
    if(ahead){
      // Keep altitude until the shorter, resting tether has passed the roof
      // too; otherwise descending pulls the canopy back through that roof.
      q.max.z=Math.max(q.max.z,returnZ+b.max.z+.65);
      q.min.x+=Math.min(0,this.forecast.x);q.max.x+=Math.max(0,this.forecast.x);
      // Include the extra forward travel while the foil climbs, not only the
      // rider's velocity. Otherwise its extending lines can overtake the rise.
      q.min.z+=Math.min(0,this.forecast.z)-40;q.max.z+=Math.max(0,this.forecast.z);
    }
    solids.collectBoxSurfaces(q,this.candidates);
    let floor=base;
    for(const surface of this.candidates){
      // Invisible course containment and physical-only proxies have no artwork
      // for the canopy to intersect. Camera culling never excludes real scenery.
      const materials=Array.isArray(surface.mesh.material)?surface.mesh.material:[surface.mesh.material];
      if(surface.mesh.userData.editorGhost||materials.every(m=>!m.visible)
        ||(surface.owner as {invisible?:boolean}|undefined)?.invisible)continue;
      floor=Math.max(floor,surface.bounds.max.y-b.min.y+KITE_FLIGHT.clearance);
    }
    this.obstructionCount=this.candidates.size;
    return floor;
  }

  step(pos:THREE.Vector3,time:number,steer:number,lift:number,wind:number,aspect:number,dt:number,solids?:WorldSolids):void{
    const delta=THREE.MathUtils.clamp(dt,0,.1);
    if(this.initialized&&dt>0&&pos.distanceToSquared(this.previous)<400){
      this.forecast.copy(pos).sub(this.previous).multiplyScalar(KITE_FLIGHT.lookAhead/Math.max(dt,1/240));
      this.forecast.x=THREE.MathUtils.clamp(this.forecast.x,-6,6);
      this.forecast.z=THREE.MathUtils.clamp(this.forecast.z,-30,8);
    }else this.forecast.set(0,0,0);
    if(this.initialized&&pos.distanceToSquared(this.previous)>=400)this.reset();
    this.previous.copy(pos);
    const base=pos.y-lift*.95+KITE_FLIGHT.height+Math.sin(time*1.8)*.10;
    const baseLead=KITE_FLIGHT.lead*Math.max(1,1.6/Math.max(.35,aspect));
    // Beach Street runs along -Z. Keep the full-width foil over the open street
    // when the rider hugs a facade; the flexible lines may cross the scenery.
    const x=THREE.MathUtils.clamp(pos.x+1.2+steer*.35+wind*KITE_FLIGHT.windSway+Math.sin(time*1.4)*.10,
      KITE_FLIGHT.minX,KITE_FLIGHT.maxX);
    // Modest banking keeps the low wingtip above the roof line in gusts.
    this.rotation.set(.22+wind*.02,-.04*steer,-.035*steer-wind*.09);
    this.rotated.copy(this.canopyBounds).applyMatrix4(this.matrix.makeRotationFromEuler(this.rotation));
    this.rotated.min.multiplyScalar(KITE_FLIGHT.canopyScale);this.rotated.max.multiplyScalar(KITE_FLIGHT.canopyScale);
    if(!this.initialized){this.height=base;this.lead=baseLead;}
    let required=base;
    // A higher sail also flies farther forward to retain its readable framing.
    // Query the final distance as well as the nominal one, including on reset.
    for(let pass=0;pass<3;pass++){
      required=this.floor(x,pos.z-this.lead,base,solids,true,pos.z-baseLead);
      const rise=required>this.height;
      const blend=this.initialized?1-Math.exp(-delta*(rise?3:.8)/3):1;
      this.height=THREE.MathUtils.lerp(this.height,required,blend);
      const lead=baseLead+Math.max(0,this.height-base)*4.5;
      this.lead=THREE.MathUtils.lerp(this.lead,lead,this.initialized?1-Math.exp(-delta):1);
    }
    // Anticipation handles normal travel; this last guard handles sudden turns,
    // asset arrival or a respawn beside a roof without easing through masonry.
    // The predictive target has 80 cm of room; a 15 cm contact skin allows the
    // last few centimetres of that approach to settle without a visible snap.
    this.height=Math.max(this.height,this.floor(x,pos.z-this.lead,base,solids,false)-(KITE_FLIGHT.clearance-.15));
    this.position.set(x-pos.x,this.height-pos.y,-this.lead);
    this.initialized=true;
  }
}
