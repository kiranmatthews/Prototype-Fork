import * as THREE from 'three';

/** Metres along a polyline. The same seeded rings own intact rock, falling
 * fragments and collision: no invisible chase plane or physics-body spawning. */
export interface CaveCollapseData {
  path: [number, number, number][];
  seed: number;
  width: number;
  height: number;
  spacing: number;
  speed: number;
  trigger: number;
  headStart: number;
  warning: number;
}
const KEYS = new Set(['path','seed','width','height','spacing','speed','trigger','headStart','warning']);
export function validCaveCollapse(value: unknown): value is CaveCollapseData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as CaveCollapseData;
  if (Object.keys(v).some(k => !KEYS.has(k))) return false;
  const limits = {seed:[0,2147483647],width:[6,30],height:[6,30],spacing:[3,12],speed:[1,30],trigger:[0,100],headStart:[8,60],warning:[.6,4]};
  for (const [key,[min,max]] of Object.entries(limits)) {
    const n = v[key as keyof typeof limits];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) return false;
  }
  if (!Number.isInteger(v.seed) || !Array.isArray(v.path) || v.path.length < 2 || v.path.length > 128) return false;
  if (v.path.some(p => !Array.isArray(p) || p.length !== 3 || p.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n)>10000))) return false;
  let length=0;
  for(let i=1;i<v.path.length;i++) {
    const a=v.path[i-1],b=v.path[i],d=Math.hypot(b[0]-a[0],b[2]-a[2]);
    if(d<1 || Math.abs(b[1]-a[1])/d>.5) return false;
    length+=d;
  }
  return length>=v.trigger+20 && Math.ceil(length/v.spacing)<=240;
}
function random(seed:number):()=>number {
  let n=seed|0;
  return ()=>{n|=0;n=n+0x6D2B79F5|0;let t=Math.imul(n^n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
interface Rock {
  ring:number; delay:number; base:THREE.Vector3; size:THREE.Vector3;
  inward:THREE.Vector3; rotation:THREE.Euler; spin:THREE.Vector3;
  landY:number; box:THREE.Box3; previous:THREE.Box3;
}
interface Ring { s:number; at:THREE.Vector3; started:number; impacted:boolean; }
export class CaveCollapse {
  readonly group = new THREE.Group();
  readonly lengths = [0];
  readonly length:number;
  readonly rings:Ring[]=[];
  readonly rocks:Rock[]=[];
  readonly rubble:THREE.InstancedMesh;
  readonly grit:THREE.InstancedMesh;
  phase:'waiting'|'warning'|'chasing'|'escaped'='waiting';
  front=0;
  progress=0;
  elapsed=0;
  collapsed=0;
  onImpact?: (at:THREE.Vector3)=>void;
  private warningTime=0;
  private warningPending=false;
  private readonly dummy=new THREE.Object3D();
  private readonly centre=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly body=new THREE.Box3();
  private readonly sweep=new THREE.Box3();
  private readonly unit=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));
  private readonly color=new THREE.Color();
  private readonly dustSeeds:number[]=[];
  constructor(readonly data:CaveCollapseData) {
    if(!validCaveCollapse(data))throw new Error('Invalid cave collapse profile');
    this.group.name='Procedural cave · seeded fracture rings';
    for(let i=1;i<data.path.length;i++)this.lengths.push(this.lengths[i-1]+Math.hypot(data.path[i][0]-data.path[i-1][0],data.path[i][2]-data.path[i-1][2]));
    this.length=this.lengths[this.lengths.length-1];
    const count=Math.ceil(this.length/data.spacing),rand=random(data.seed);
    const geo=new THREE.IcosahedronGeometry(1,1);
    const positions=geo.getAttribute('position');
    // Continuous position-based distortion keeps duplicate face vertices joined.
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const k=1+.1*Math.sin(x*17+y*23+z*31+data.seed);
      positions.setXYZ(i,x*k,y*k,z*k);
    }
    geo.computeVertexNormals();
    this.rubble=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),count*9);
    this.rubble.name='Intact arch → fractured roof → permanent rubble';
    this.rubble.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.rubble.frustumCulled=false;
    this.rubble.castShadow=true;this.rubble.receiveShadow=true;this.group.add(this.rubble);
    for(let ring=0;ring<count;ring++){
      const s=(ring+.5)*this.length/count,at=this.sample(s,new THREE.Vector3());
      this.rings.push({s,at,started:-1,impacted:false});
      this.tangent(s,this.direction);const right=new THREE.Vector3(this.direction.z,0,-this.direction.x);
      for(let j=0;j<9;j++){
        const angle=j/8*Math.PI,lateral=Math.cos(angle)*(data.width/2+1.35);
        const base=at.clone().addScaledVector(right,lateral);base.y+=1.4+Math.sin(angle)*data.height;
        const size=new THREE.Vector3(2.5+rand()*.65,2.1+rand()*.55,data.spacing*.68);
        // The crown drops straight down; wall blocks kick inward and bury the lane.
        const inward=right.clone().multiplyScalar(-lateral*(.45+rand()*.3));
        const rotation=new THREE.Euler(0,Math.atan2(this.direction.x,this.direction.z),angle-Math.PI/2);
        this.rocks.push({ring,base,size,inward,rotation,delay:rand()*.42,
          spin:new THREE.Vector3((rand()-.5)*1.8,(rand()-.5)*1.2,(rand()-.5)*2),landY:at.y+.6+rand()*1.1,
          box:new THREE.Box3(),previous:new THREE.Box3()});
        this.color.setHSL(.075+rand()*.035,.13+rand()*.12,.37+rand()*.19);
        this.rubble.setColorAt(this.rocks.length-1,this.color);
      }
    }
    this.grit=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xcbb492,transparent:true,opacity:.32,depthWrite:false}),128);
    this.grit.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.grit.frustumCulled=false;this.grit.name='Bounded dust and warning gravel';
    this.group.add(this.grit);for(let i=0;i<128;i++)this.dustSeeds.push(rand());
    this.reset();
  }
  sample(s:number,out:THREE.Vector3):THREE.Vector3 {
    s=THREE.MathUtils.clamp(s,0,this.length);
    let i=1;while(i<this.lengths.length-1&&this.lengths[i]<s)i++;
    const a=this.data.path[i-1],b=this.data.path[i],t=(s-this.lengths[i-1])/(this.lengths[i]-this.lengths[i-1]);
    return out.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);
  }
  tangent(s:number,out:THREE.Vector3):THREE.Vector3 {
    let i=1;while(i<this.lengths.length-1&&this.lengths[i]<s)i++;
    const a=this.data.path[i-1],b=this.data.path[i];return out.set(b[0]-a[0],0,b[2]-a[2]).normalize();
  }
  project(p:THREE.Vector3):{s:number;distance:number} {
    let best=Infinity,s=0;
    for(let i=1;i<this.data.path.length;i++){
      const a=this.data.path[i-1],b=this.data.path[i],dx=b[0]-a[0],dz=b[2]-a[2];
      const t=THREE.MathUtils.clamp(((p.x-a[0])*dx+(p.z-a[2])*dz)/(dx*dx+dz*dz),0,1);
      const d=(p.x-a[0]-dx*t)**2+(p.z-a[2]-dz*t)**2+(p.y-a[1]-(b[1]-a[1])*t)**2*.05;
      if(d<best){best=d;s=this.lengths[i-1]+(this.lengths[i]-this.lengths[i-1])*t;}
    }
    return {s,distance:Math.sqrt(best)};
  }
  reset(spawn?:THREE.Vector3):void {
    this.phase='waiting';this.warningPending=false;this.elapsed=0;this.warningTime=0;this.front=-this.data.headStart;this.collapsed=0;
    this.progress=spawn?this.project(spawn).s:0;
    // Debug checkpoint warps and copied levels can start beyond the first trigger.
    this.front=Math.max(0,this.progress-this.data.trigger)-this.data.headStart;
    for(const ring of this.rings){ring.started=-1;ring.impacted=false;}
    for(const rock of this.rocks){rock.box.makeEmpty();rock.previous.makeEmpty();}
    this.present();
  }
  update(dt:number,player:THREE.Vector3):void {
    if(dt<=0)return;
    dt=Math.min(dt,.1);this.elapsed+=dt;
    const projection=this.project(player);this.progress=projection.s;
    if(this.phase==='waiting'&&projection.s>=this.data.trigger&&projection.distance<this.data.width/2+1&&player.y>this.sample(projection.s,this.centre).y-2){
      this.phase='warning';this.warningTime=0;this.warningPending=true;
    }
    if(this.phase==='warning'){
      this.warningTime+=dt;
      if(this.warningTime>=1.8)this.phase='chasing';
    }
    if(this.phase==='chasing'){
      // Bounded catch-up preserves earned breathing room. Never teleports,
      // never retreats, never stops because the runner stopped or backtracked.
      const lead=this.progress-this.front;
      const speed=this.data.speed+THREE.MathUtils.clamp((lead-22)*.16,0,5);
      this.front=Math.min(this.length,this.front+speed*dt);
    }
    // Crossing the daylight mouth stops new fractures. Existing falls settle.
    const end=this.data.path[this.data.path.length-1],last=this.tangent(this.length,this.direction);
    if((player.x-end[0])*last.x+(player.z-end[2])*last.z>5&&projection.distance<this.data.width&&this.phase==='chasing')this.phase='escaped';
    for(const ring of this.rings){
      if(ring.started<0&&this.phase==='chasing'&&ring.s<=this.front+this.data.speed*this.data.warning)ring.started=this.elapsed;
      if(ring.started>=0&&!ring.impacted&&this.elapsed-ring.started>this.data.warning+1.2){ring.impacted=true;this.collapsed++;if(player.distanceToSquared(ring.at)<70*70)this.onImpact?.(ring.at);}
    }
    this.present();
  }
  private present():void {
    const d=this.dummy;
    for(let i=0;i<this.rocks.length;i++){
      const r=this.rocks[i],ring=this.rings[r.ring];
      const age=ring.started<0?-1:this.elapsed-ring.started-r.delay;
      d.position.copy(r.base);d.rotation.copy(r.rotation);d.scale.copy(r.size);
      if(age>=0){
        const falling=Math.max(0,age-this.data.warning),shake=falling?0:.075*(age/this.data.warning);
        d.position.x+=Math.sin(age*61+i)*shake;d.position.z+=Math.cos(age*53+i)*shake;
        if(falling>0){
          const t=Math.min(1,falling/1.2);d.position.addScaledVector(r.inward,t*t*(3-2*t));
          d.position.y=Math.max(r.landY,r.base.y-13*falling*falling);
          const settle=Math.min(falling,1.4);d.rotation.x+=r.spin.x*settle;d.rotation.y+=r.spin.y*settle;d.rotation.z+=r.spin.z*settle;
          // A bounded rebound settles; it cannot reopen the buried corridor.
          if(d.position.y===r.landY&&falling<1.6)d.position.y+=Math.abs(Math.sin(falling*17))*.18*(1.6-falling);
        }
      }
      d.updateMatrix();this.rubble.setMatrixAt(i,d.matrix);
      r.previous.copy(r.box);r.box.makeEmpty();
      if(age>this.data.warning){
        r.box.copy(this.unit).applyMatrix4(d.matrix);
        // Igneous pieces are rounded: conservative interior box avoids corner air hits.
        r.box.expandByScalar(-.22);

      }
    }
    this.rubble.instanceMatrix.needsUpdate=true;
    for(let i=0;i<128;i++){
      const seed=this.dustSeeds[i],s=THREE.MathUtils.clamp(this.front+(seed-.4)*18,0,this.length);
      this.sample(s,d.position);this.tangent(s,this.direction);
      const age=(this.elapsed*(.5+seed)+seed*9)%1;
      const active=this.phase==='chasing'||this.phase==='warning';
      d.position.x+=(seed-.5)*this.data.width;d.position.y+=this.phase==='warning'?this.data.height*(1-age):.4+age*6;
      d.rotation.set(seed*5,age*4,seed*8);d.scale.setScalar(active?(this.phase==='warning'?.08:1.6)*Math.sin(age*Math.PI):0);
      d.updateMatrix();this.grit.setMatrixAt(i,d.matrix);
    }
    this.grit.instanceMatrix.needsUpdate=true;
  }
  consumeWarning():boolean {const pending=this.warningPending;this.warningPending=false;return pending;}
  hitsPlayer(position:THREE.Vector3,previous=position):boolean {
    if(this.phase==='waiting'||this.phase==='warning')return false;
    this.body.min.set(Math.min(position.x,previous.x)-.3,Math.min(position.y,previous.y)+.12,Math.min(position.z,previous.z)-.3);
    this.body.max.set(Math.max(position.x,previous.x)+.3,Math.max(position.y,previous.y)+1.8,Math.max(position.z,previous.z)+.3);
    for(const r of this.rocks)if(!r.box.isEmpty()){
      this.sweep.copy(r.box);if(!r.previous.isEmpty())this.sweep.union(r.previous);
      if(this.sweep.intersectsBox(this.body))return true;
    }
    return false;
  }
  dispose():void {
    this.group.removeFromParent();
    for(const mesh of [this.rubble,this.grit]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();mesh.dispose();}
    this.group.clear();
  }
}
