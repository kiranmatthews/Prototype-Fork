import * as THREE from 'three';
import { puffs, type PuffPreset } from './puffs';

export interface TikiPhase { yaw:number; warning:number; fire:number; phase:'cool'|'warn'|'fire'; }
export function templeTikiPhase(time:number,cycle=7.8,phase=0,arc=28):TikiPhase {
  const t=((time+phase)%cycle+cycle)%cycle/cycle;
  const warning=t>=.54&&t<.70?(t-.54)/.16:0;
  const firing=t>=.70&&t<.93,u=(t-.70)/.23;
  // Fuel catches quickly, then stops at the mouth. Previously emitted flames
  // finish travelling and cooling; the effect never shrinks back into the head.
  const fire=firing?Math.min(1,u/.055,Math.max(0,(.77-u)/.055)):0;
  const turn=t<.54?Math.sin(t/.54*Math.PI*2):t<.70?0:firing?Math.sin(u*Math.PI*2)*.65:0;
  return {yaw:THREE.MathUtils.degToRad(arc)*turn,warning,fire,phase:firing?'fire':warning>0?'warn':'cool'};
}

const COUNT=24, SIDES=8, FAN_VERTS=2+SIDES*2, FANS=2, SPARKS=24;
const STEP=.037;
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const smooth=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);
const SMOKE:PuffPreset={
  blend:'alpha',orient:'billboard',ring:[7,8],multiCentre:0,halo:.42,haloAlpha:.55,
  size:[.28,.44],aspect:[.7,1.1],grow:[2.1,3.1],growY:[2.6,3.5],growCurve:.65,
  wobble:[.15,.28],swirl:[.07,.16],wobbleRate:[1.5,2.8],neighbour:.65,centreDrift:.1,
  spin:[-.25,.35],speed:[.4,1.1],spread:.22,up:[1.0,1.5],buoyancy:[.8,1.4],
  drag:[1,1.6],wind:.3,turbulence:[.14,.28],turbRate:[1.1,1.9],life:[1.0,1.65],
  centre:0xb69a89,inner:0x676773,outer:0x303441,fadeTo:0x626778,
  alpha:[.28,.38],fadeIn:.06,outerAlpha:0,bright:1,
};
const SPARK_VERTICES=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const SPARK_INDICES=[0,2,4,2,1,4,1,3,4,3,0,4,2,0,5,1,2,5,3,1,5,0,3,5];

/** Bounded, untextured Gouraud geometry. Each tongue has two heat centres,
 * a coloured inner ring and a fully transparent ragged rim. Emitted packets
 * keep their birth heading while the head turns. Absolute-time sampling makes
 * seeks, reset and 30/60/120Hz updates agree without per-frame randomness. */
export class TempleBreath extends THREE.Group {
  readonly boxes=Array.from({length:COUNT},()=>new THREE.Box3().makeEmpty());
  readonly flames:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  readonly embers:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  private hot=new THREE.Color('#ffe895');
  private gold=new THREE.Color('#ff9d22');
  private orange=new THREE.Color('#ec4b0d');
  private red=new THREE.Color('#792413');
  private color=new THREE.Color();
  private point=new THREE.Vector3();
  private half=new THREE.Vector3();
  private smokePoint=new THREE.Vector3();
  private viewPoint=new THREE.Vector3(-12,7,5);
  private smokeDirection=new THREE.Vector3();
  private lastTime=-Infinity;
  private lastSmoke=-1;
  readonly diagnostics={flames:0,embers:0,smokeEmissions:0,hotContacts:0};
  constructor(readonly range:number,readonly cycle:number,readonly phase:number,readonly arc:number){
    super();this.name='Advected tiki flames and cooling embers';
    const geometry=new THREE.BufferGeometry(),indices:number[]=[];
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(COUNT*FANS*FAN_VERTS*3),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(COUNT*FANS*FAN_VERTS*4),4).setUsage(THREE.DynamicDrawUsage));
    for(let n=0;n<COUNT*FANS;n++){
      const base=n*FAN_VERTS;
      for(let s=0;s<SIDES;s++){
        const next=(s+1)%SIDES,owner=s<4?0:1,nextOwner=next<4?0:1;
        indices.push(base+owner,base+2+s,base+2+next);
        if(owner!==nextOwner)indices.push(base+owner,base+nextOwner,base+2+next);
        indices.push(base+2+s,base+2+SIDES+s,base+2+SIDES+next,base+2+s,base+2+SIDES+next,base+2+next);
      }
    }
    geometry.setIndex(indices);
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1,range*.5),range*.6+3);
    this.flames=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false}));
    this.flames.name='Gouraud flame tongues: hot centres / orange body / transparent torn rim';
    this.flames.renderOrder=5;this.add(this.flames);
    // Cache the previous rendered view in local space. The two loose layers
    // face that view instead of exposing an obvious cross-shaped card.
    this.flames.onBeforeRender=(_renderer,_scene,camera)=>{
      this.viewPoint.setFromMatrixPosition(camera.matrixWorld);this.worldToLocal(this.viewPoint);
    };
    const sparks=new THREE.BufferGeometry(),sparkIndices:number[]=[];
    sparks.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(SPARKS*6*3),3).setUsage(THREE.DynamicDrawUsage));
    sparks.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(SPARKS*6*4),4).setUsage(THREE.DynamicDrawUsage));
    for(let i=0;i<SPARKS;i++)for(const index of SPARK_INDICES)sparkIndices.push(i*6+index);
    sparks.setIndex(sparkIndices);sparks.boundingSphere=geometry.boundingSphere.clone();
    this.embers=new THREE.Mesh(sparks,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false}));
    this.embers.name='Tiki embers cooling from gold to red';this.embers.renderOrder=6;this.add(this.embers);
  }
  update(time:number,state:TikiPhase,visible:boolean):void {
    this.updateWorldMatrix(true,false);
    const ageInCycle=((time+this.phase)%this.cycle+this.cycle)%this.cycle;
    let start=time-ageInCycle+this.cycle*.70;
    if(time<start)start-=this.cycle;
    const duration=this.cycle*.23*.77,elapsed=time-start;
    const last=Math.floor(elapsed/STEP),positions=this.flames.geometry.getAttribute('position'),colors=this.flames.geometry.getAttribute('color');
    colors.array.fill(0);this.diagnostics.flames=0;this.diagnostics.hotContacts=0;
    for(let slot=0;slot<COUNT;slot++){
      this.boxes[slot].makeEmpty();
      const ordinal=last-slot,seed=ordinal+Math.floor(start/this.cycle)*131+this.phase*17;
      const born=ordinal*STEP+(hash(seed+8)-.5)*STEP*.44,age=elapsed-born;
      if(born<0||born>duration||age<0||hash(seed+41)<.12)continue;
      const life=.37+hash(seed+3)*.16;if(age>=life)continue;
      const distance=age*this.range/.46*(.87+hash(seed+4)*.2);
      const heat=smooth(0,.035,age)*(1-smooth(.48,1,age/life))*(1-smooth(this.range-1.1,this.range,distance));
      if(heat<=.006)continue;
      const yaw=templeTikiPhase(start+born,this.cycle,this.phase,this.arc).yaw+(hash(seed+15)-.5)*.035;
      const sn=Math.sin(yaw),cs=Math.cos(yaw),wave=age*22+seed*2.4;
      const radius=(.22+.55*Math.sin(Math.min(1,age/life)*Math.PI))*(.8+hash(seed+6)*.4);
      const length=Math.min(.5+hash(seed+7)*.4+age*.55,Math.max(.08,(this.range-distance)*.78));
      const x=Math.sin(wave*.67)*age*.28,y=1.03+age*age*1.25+Math.sin(wave)*age*.14,z=1.12+distance;
      this.diagnostics.flames++;
      for(let fan=0;fan<FANS;fan++){
        const viewX=this.viewPoint.x*cs-this.viewPoint.z*sn-x,viewY=this.viewPoint.y-y;
        const phi=Math.atan2(viewX,-viewY)+(fan-.5)*.34+(hash(seed+20)-.5)*.3;
        const rx=Math.cos(phi),ry=Math.sin(phi),layer=fan===0?1:.7,base=(slot*FANS+fan)*FAN_VERTS;
        for(let v=0;v<FAN_VERTS;v++){
          let along:number,radial:number,alpha:number;
          if(v<2){along=(v===0?-.12:.18)*length;radial=(v===0?.09:-.075)*radius;
            this.color.copy(v===0?this.hot:this.gold).lerp(this.orange,age/life*.55);alpha=heat*(v===0?.6:.38);
          }else{
            const ring=v>=2+SIDES?1:0,j=(v-2)%SIDES,angle=j/SIDES*Math.PI*2+(hash(seed+j+90)-.5)*.21;
            const ragged=1+.23*Math.sin(wave+j*2.6)+.12*Math.sin(wave*1.7-j);
            const fraction=ring?1:.4;
            along=Math.cos(angle)*length*fraction*(Math.cos(angle)>0?1:.65);
            radial=Math.sin(angle)*radius*fraction*ragged;
            this.color.copy(ring?this.red:this.orange).lerp(this.red,age/life*.5);
            alpha=ring?0:heat*.4;
          }
          const curl=smooth(.08,.27,age)*(.24+hash(seed+30)*.27);
          const px=x+radial*rx*layer,py=y+radial*ry*layer+Math.max(0,along)/length*curl+fan*age*.3,pz=z+along*layer;
          positions.setXYZ(base+v,px*cs+pz*sn,py,pz*cs-px*sn);
          colors.setXYZW(base+v,this.color.r,this.color.g,this.color.b,alpha);
        }
      }
      if(state.phase==='fire'&&heat>.22&&age>.035){
        this.point.set(x*cs+z*sn,y,z*cs-x*sn);this.localToWorld(this.point);
        const worldYaw=(this.parent?.rotation.y??0)+yaw,c=Math.abs(Math.cos(worldYaw)),s=Math.abs(Math.sin(worldYaw));
        const w=this.scale.x,along=Math.min(.35,length*.34),cross=Math.min(.37,radius)*.38;
        this.half.set((cross*c+along*s)*w,Math.min(.37,radius)*.46*w,(cross*s+along*c)*w);
        this.boxes[slot].min.copy(this.point).sub(this.half);this.boxes[slot].max.copy(this.point).add(this.half);this.diagnostics.hotContacts++;
      }
    }
    positions.needsUpdate=colors.needsUpdate=true;this.flames.visible=visible&&this.diagnostics.flames>0;
    this.updateEmbers(elapsed,start,duration,visible);
    // Smoke belongs to the shared Gouraud puff system. It is cosmetic and
    // may yield to gameplay particles; the owned flame/contact budget cannot.
    const smokeSlot=Math.floor(time/.105);
    if(time<this.lastTime){this.lastSmoke=smokeSlot;}
    if(visible&&smokeSlot!==this.lastSmoke&&elapsed>.3&&elapsed<duration+.75){
      const birth=Math.max(0,Math.min(duration,elapsed-.36));
      const yaw=templeTikiPhase(start+birth,this.cycle,this.phase,this.arc).yaw;
      const distance=this.range*(.63+hash(smokeSlot+this.phase)*.25);
      this.smokePoint.set(Math.sin(yaw)*(1.12+distance),1.3+hash(smokeSlot)*.3,Math.cos(yaw)*(1.12+distance));
      this.localToWorld(this.smokePoint);this.smokeDirection.set(Math.sin(yaw),.35,Math.cos(yaw)).transformDirection(this.matrixWorld);
      const smoke=puffs.spawn(SMOKE,this.smokePoint.x,this.smokePoint.y,this.smokePoint.z,{dir:this.smokeDirection,seed:smokeSlot+Math.floor(this.phase*131),ambient:true});
      if(smoke)this.diagnostics.smokeEmissions++;
    }
    this.lastSmoke=smokeSlot;this.lastTime=time;
  }
  private updateEmbers(elapsed:number,start:number,duration:number,visible:boolean):void {
    const positions=this.embers.geometry.getAttribute('position'),colors=this.embers.geometry.getAttribute('color');
    colors.array.fill(0);this.diagnostics.embers=0;
    const interval=.071,last=Math.floor(elapsed/interval);
    for(let i=0;i<SPARKS;i++){
      const ordinal=last-i,seed=ordinal+this.phase*33+Math.floor(start/this.cycle)*57,born=ordinal*interval,age=elapsed-born;
      const life=.65+hash(seed+2)*.55;
      if(born<0||born>duration||age<0||age>=life)continue;
      const yaw=templeTikiPhase(start+born,this.cycle,this.phase,this.arc).yaw+(hash(seed+9)-.5)*.16;
      const distance=(1-Math.exp(-age*2))*this.range*.74,x=Math.sin(seed+age*5)*age*.22;
      const y=1.03+age*(1.4+hash(seed)*1.8)-age*age*1.8,z=1.12+distance;
      const size=(.026+hash(seed+7)*.025)*(1-age/life),sn=Math.sin(yaw),cs=Math.cos(yaw),alpha=(1-age/life)*.9;
      this.color.copy(this.hot).lerp(this.orange,Math.min(1,age/life*1.5));this.diagnostics.embers++;
      for(let v=0;v<6;v++){
        const p=SPARK_VERTICES[v],px=x+p[0]*size,py=y+p[1]*size,pz=z+p[2]*size*(2+hash(seed+4)*2);
        positions.setXYZ(i*6+v,px*cs+pz*sn,py,pz*cs-px*sn);colors.setXYZW(i*6+v,this.color.r,this.color.g,this.color.b,alpha);
      }
    }
    positions.needsUpdate=colors.needsUpdate=true;this.embers.visible=visible&&this.diagnostics.embers>0;
  }
}
