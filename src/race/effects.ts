import * as THREE from 'three';
import { RACE_ITEMS, type RaceItem } from './types';

/** A feathered vertex-colour band, not a transparent disc covering the road. */
export function raceTargetRing(color:number):THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial> {
  const geometry=new THREE.RingGeometry(.91,1.09,32,2),position=geometry.getAttribute('position'),rgba=new Float32Array(position.count*4);
  for(let i=0;i<position.count;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=1;rgba[i*4+3]=Math.max(0,1-Math.abs(Math.hypot(position.getX(i),position.getY(i))-1)/.09);}
  geometry.setAttribute('color',new THREE.BufferAttribute(rgba,4));
  const material=new THREE.MeshBasicMaterial({color,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});material.forceSinglePass=true;
  const ring=new THREE.Mesh(geometry,material);ring.rotation.x=-Math.PI/2;return ring;
}

type Shape='ring'|'spark'|'ribbon';
interface Particle { active:boolean; shape:Shape; age:number; life:number; size:number; radius:number; gravity:number; alpha:number; p:THREE.Vector3; end:THREE.Vector3; velocity:THREE.Vector3; color:THREE.Color }
const CAPACITY=192,VERTICES=12288,TAU=Math.PI*2;
const circleCos=Float32Array.from({length:25},(_,i)=>Math.cos(i/24*TAU));
const circleSin=Float32Array.from({length:25},(_,i)=>Math.sin(i/24*TAU));
const sparkCos=Float32Array.from({length:9},(_,i)=>Math.cos(i/8*TAU)*(i%2?.25:1));
const sparkSin=Float32Array.from({length:9},(_,i)=>Math.sin(i/8*TAU)*(i%2?.25:1));
const rainbow=[0xffd749,0xff88c5,0x79eeff] as const;
const attributes=['position','color'] as const;
/** One bounded draw for every race's coloured wakes, impact shards and pressure
 * waves. Softness is interpolated RGBA at triangle vertices (Gouraud), with no
 * textures, lights, blur, bloom, per-effect meshes or geometry allocations during play.
 * This is not smoke: smoke/dust remains owned by the shared PuffSystem. */
export class RaceItemEffects {
  private readonly pool:Particle[]=Array.from({length:CAPACITY},()=>({active:false,shape:'spark',age:0,life:1,size:1,radius:1,gravity:0,alpha:1,p:new THREE.Vector3(),end:new THREE.Vector3(),velocity:new THREE.Vector3(),color:new THREE.Color()}));
  private readonly geometry=new THREE.BufferGeometry();
  private readonly positions=new Float32Array(VERTICES*3);
  private readonly colors=new Float32Array(VERTICES*4);
  private readonly mesh:THREE.Mesh;
  private readonly right=new THREE.Vector3(1,0,0);
  private readonly up=new THREE.Vector3(0,1,0);
  private readonly side=new THREE.Vector3();
  private readonly origin=new THREE.Vector3();
  private readonly end=new THREE.Vector3();
  private readonly strikeMarker=new THREE.Group();
  private strikeLife=0;private cursor=0;private serial=0;private written=0;
  constructor(private readonly root:THREE.Group){
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,4).setUsage(THREE.DynamicDrawUsage));this.geometry.setDrawRange(0,0);
    const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});material.forceSinglePass=true;material.name='Race effects / interpolated vertex RGBA';
    this.mesh=new THREE.Mesh(this.geometry,material);this.mesh.name='Pooled Gouraud power-up effects';this.mesh.frustumCulled=false;this.mesh.visible=false;root.add(this.mesh);
    this.strikeMarker.name='lightning strike';
  }
  private spawn(shape:Shape,at:THREE.Vector3,color:number|string,life:number,size:number):Particle {
    // Ring buffer replaces the oldest visual when saturated; gameplay never
    // waits for particles and geometry/material memory cannot grow with hits.
    const p=this.pool[this.cursor];this.cursor=(this.cursor+1)%CAPACITY;
    p.active=true;p.shape=shape;p.age=0;p.life=life;p.size=size;p.radius=0;p.gravity=0;p.alpha=.85;p.p.copy(at);p.end.copy(at);p.velocity.set(0,0,0);p.color.set(color);return p;
  }
  private glints(at:THREE.Vector3,color:number|string,count:number,speed:number,water=false):void {
    for(let i=0;i<count;i++){
      const n=++this.serial,a=n*2.3999632297,height=.35+(n%7)*.11;
      const p=this.spawn('spark',at,color,.32+(n%5)*.065,water?.22:.17);
      p.velocity.set(Math.cos(a)*speed,height*speed,Math.sin(a)*speed);p.gravity=water?12:2;
    }
  }
  pulse(at:THREE.Vector3,color:number|string,radius=3):void {
    const p=this.spawn('ring',at,color,.48,.16);p.p.y+=.14;p.radius=radius;
    this.glints(at,color,4,Math.min(4,radius));
  }
  burst(kind:RaceItem,at:THREE.Vector3):void {
    const color=RACE_ITEMS[kind].color;
    if(kind==='horn'){
      for(let i=0;i<3;i++){const p=this.spawn('ring',at,color,.48+i*.12,.12);p.p.y+=.25+i*.38;p.radius=8-i*.8;}
      this.glints(at,0xffefc3,9,7);
    }else if(kind==='water-bomb'||kind==='tidal-wave'){
      for(let i=0;i<2;i++){const p=this.spawn('ring',at,i?0xd2ffff:0x25cadd,.6+i*.12,.2);p.p.y+=.15+i*.13;p.radius=kind==='tidal-wave'?4:5;}
      this.glints(at,0x8bf7ff,16,8,true);
    }else if(kind==='star'){
      this.pulse(at,0xffdb57,3);
      for(const c of [0xffd94c,0xff83b6,0x8aeeff])this.glints(at,c,5,4);
    }else if(kind==='shield'){
      this.pulse(at,0x70dfff,2.5);this.glints(at,0xd3fbff,14,4);
    }else if(kind==='mushroom'){
      this.pulse(at,0xff9c37,1.5);this.glints(at,0xffda78,8,3);
    }else{
      this.pulse(at,color,kind==='blue-shell'?3.2:2);
      this.glints(at,color,10,5);
    }
  }
  /** A short tapered strip stores its birth position, leaving a real wake. */
  wake(kind:RaceItem,at:THREE.Vector3,direction:THREE.Vector3,time:number,id=0):void {
    if(kind==='banana'||kind==='shock-shell')return;
    const boost=kind==='mushroom',star=kind==='star',water=kind==='water-bomb'||kind==='tidal-wave';
    const color=star?rainbow[Math.floor(time*12+id)%3]:boost?0xffb04a:RACE_ITEMS[kind].color;
    this.side.set(direction.z,0,-direction.x).normalize();
    const lanes=boost||star||kind==='tidal-wave'?2:1;
    for(let lane=0;lane<lanes;lane++){
      const offset=lanes===2?(lane?1:-1)*(kind==='tidal-wave'?1.7:.42):0;
      this.origin.copy(at).addScaledVector(this.side,offset);this.origin.y+=boost||star?.28:.05;
      const p=this.spawn('ribbon',this.origin,color,boost?.28:.22,water?.27:.14);
      p.end.copy(this.origin).addScaledVector(direction,boost?-3.5:kind==='boomerang'?-2.5:-1.8);p.end.y+=water?.1:0;
      if(star||water||boost){const s=this.spawn('spark',this.origin,water?0xdcffff:color,.3,.13);s.velocity.set(this.side.x*offset,water?1.8:.4,this.side.z*offset);}
    }
  }
  lightning(at:THREE.Vector3):void {
    this.strikeLife=.55;this.root.add(this.strikeMarker);
    const heights=[20,15,11,8,4,.12],xs=[1.3,-.8,.65,-.55,.4,0];
    for(let i=0;i<heights.length-1;i++){
      this.origin.copy(at).add(new THREE.Vector3(xs[i],heights[i],i%2*.3));this.end.copy(at).add(new THREE.Vector3(xs[i+1],heights[i+1],(i+1)%2*.3));
      const fringe=this.spawn('ribbon',this.origin,0x659bff,.4,.38);fringe.end.copy(this.end);
      const core=this.spawn('ribbon',this.origin,0xf0ffff,.22,.1);core.end.copy(this.end);core.alpha=1;
    }
    this.pulse(at,0xffe568,4.5);this.glints(at,0xe6faff,10,7);
  }
  updateView(camera:THREE.Camera):void {
    this.right.setFromMatrixColumn(camera.matrixWorld,0).normalize();this.up.setFromMatrixColumn(camera.matrixWorld,1).normalize();
  }
  private vertex(x:number,y:number,z:number,p:Particle,alpha:number,white=0):void {
    const v=this.written++,i=v*3,j=v*4;this.positions[i]=x;this.positions[i+1]=y;this.positions[i+2]=z;
    this.colors[j]=p.color.r+(1-p.color.r)*white;this.colors[j+1]=p.color.g+(1-p.color.g)*white;this.colors[j+2]=p.color.b+(1-p.color.b)*white;this.colors[j+3]=alpha;
  }
  update(dt:number):void {
    this.written=0;this.strikeLife=Math.max(0,this.strikeLife-dt);if(!this.strikeLife)this.strikeMarker.removeFromParent();
    for(const p of this.pool){
      if(!p.active)continue;p.age+=dt;if(p.age>=p.life){p.active=false;continue;}
      // At most 4,096 triangles, even when all 192 slots contain large rings.
      if(this.written+288>VERTICES)continue;
      const t=p.age/p.life,fade=(1-t)*(1-t)*p.alpha,x=p.p.x+p.velocity.x*p.age,y=p.p.y+p.velocity.y*p.age-p.gravity*p.age*p.age*.5,z=p.p.z+p.velocity.z*p.age;
      if(p.shape==='ring'){
        const r=.25+p.radius*(1-(1-t)**2),w=p.size*(.7+t);
        for(let i=0;i<24;i++)for(let band=0;band<2;band++){
          const ca=circleCos[i],sa=circleSin[i],cb=circleCos[i+1],sb=circleSin[i+1],inner=r+w*(band-1),outer=inner+w,ia=band?fade:0,oa=band?0:fade;
          this.vertex(x+ca*inner,y,z+sa*inner,p,ia);this.vertex(x+cb*inner,y,z+sb*inner,p,ia);this.vertex(x+cb*outer,y,z+sb*outer,p,oa);
          this.vertex(x+ca*inner,y,z+sa*inner,p,ia);this.vertex(x+cb*outer,y,z+sb*outer,p,oa);this.vertex(x+ca*outer,y,z+sa*outer,p,oa);
        }
      }else if(p.shape==='spark'){
        const size=p.size*(1+t*.8);
        for(let i=0;i<8;i++){
          const ca=sparkCos[i],sa=sparkSin[i],cb=sparkCos[i+1],sb=sparkSin[i+1];
          this.vertex(x,y,z,p,fade,.8);
          this.vertex(x+(this.right.x*ca+this.up.x*sa)*size,y+(this.right.y*ca+this.up.y*sa)*size,z+(this.right.z*ca+this.up.z*sa)*size,p,0);
          this.vertex(x+(this.right.x*cb+this.up.x*sb)*size,y+(this.right.y*cb+this.up.y*sb)*size,z+(this.right.z*cb+this.up.z*sb)*size,p,0);
        }
      }else{
        // Billboard a strip about its own axis; both outer edges fade to zero.
        this.end.copy(p.end).sub(p.p);this.side.copy(this.right).multiplyScalar(this.end.dot(this.up)).addScaledVector(this.up,-this.end.dot(this.right)).normalize().multiplyScalar(p.size);
        const sx=this.side.x,sy=this.side.y,sz=this.side.z;
        for(let sign=-1;sign<=1;sign+=2){
          this.vertex(x,y,z,p,fade,.65);this.vertex(x+sx*sign,y+sy*sign,z+sz*sign,p,0);this.vertex(p.end.x+sx*sign*.35,p.end.y+sy*sign*.35,p.end.z+sz*sign*.35,p,0);
          this.vertex(x,y,z,p,fade,.65);this.vertex(p.end.x+sx*sign*.35,p.end.y+sy*sign*.35,p.end.z+sz*sign*.35,p,0);this.vertex(p.end.x,p.end.y,p.end.z,p,fade*.15);
        }
      }
    }
    this.geometry.setDrawRange(0,this.written);this.mesh.visible=this.written>0;
    if(this.written)for(const key of attributes){const a=this.geometry.getAttribute(key) as THREE.BufferAttribute;a.clearUpdateRanges();a.addUpdateRange(0,this.written*a.itemSize);a.needsUpdate=true;}
  }
  get stats():{active:number;capacity:number;draws:number;triangles:number;maxTriangles:number} {
    return {active:this.pool.reduce((n,p)=>n+Number(p.active),0),capacity:CAPACITY,draws:Number(this.mesh.visible),triangles:this.written/3,maxTriangles:VERTICES/3};
  }
  clear():void {for(const p of this.pool)p.active=false;this.cursor=this.serial=this.written=this.strikeLife=0;this.geometry.setDrawRange(0,0);this.mesh.visible=false;this.strikeMarker.removeFromParent();}
}
