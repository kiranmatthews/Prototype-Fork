import {RallyMudTracks} from './mudTracks';
import {RallyGroundClods} from './groundClods';
import * as THREE from 'three';
import type { CartState } from './physics';
import { cartRallyFrame, rallyMudWetness } from '../levels/cart-stadium-layout';

export interface MudSplat {x:number;y:number;radius:number;age:number;life:number;seed:number;}
export interface MudLensState {time:number;splats:readonly MudSplat[];}
interface Clod {x:number;y:number;z:number;vx:number;vy:number;vz:number;floor:number;radius:number;age:number;life:number;}
const clamp=THREE.MathUtils.clamp;

/** Small, bounded presentation pools. Wheel spray and lens hits advance with
 * race simulation, so pausing or rendering another view cannot create mud. */
export class CartMud {
  readonly root=new THREE.Group();
  readonly groundClods=new RallyGroundClods();
  readonly tracks=new RallyMudTracks();
  readonly lens:MudLensState={time:0,splats:Array.from({length:12},()=>({x:0,y:0,radius:0,age:10,life:0,seed:0}))};
  private readonly clods:Clod[]=Array.from({length:192},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,floor:0,radius:0,age:2,life:0}));
  private readonly geometry=new THREE.IcosahedronGeometry(1,0);
  private readonly material=new THREE.MeshLambertMaterial({color:'#89512b'});
  private readonly mesh=new THREE.InstancedMesh(this.geometry,this.material,this.clods.length);
  private readonly dummy=new THREE.Object3D();
  private readonly emission:number[]=[];
  private readonly wasGrounded:boolean[]=[];
  private readonly lastVy:number[]=[];
  private seed=0x156dc92;
  private clodIndex=0;private splatIndex=0;private cooldown=0;
  private bursts=0;private emitted=0;
  constructor(readonly deposits:number[]=[]){
    this.root.name='Rally wheel mud';this.mesh.name='Pooled mud roost';this.mesh.count=0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;
    this.root.add(this.mesh,this.groundClods.root,this.tracks.root);
  }
  private random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;return (x>>>0)/4294967296;}
  private wetness(c:CartState){
    let s=-c.z,u=0;
    for(let i=0;i<3;i++){const f=cartRallyFrame(s);u=(c.x-f.x)*f.n;s=-c.z+u*f.nz;}
    return rallyMudWetness(s,u);
  }
  private clod(c:CartState,side:number,impact=0){
    const p=this.clods[this.clodIndex++%this.clods.length],sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),speed=Math.abs(c.speed);
    Object.assign(p,{x:c.x+sn*1.1+cs*side*1.05,y:c.y+.22,z:c.z+cs*1.1-sn*side*1.05,
      vx:c.vx*.12+sn*(1+speed*.21)+cs*side*(.8+this.random()*2+impact),
      vy:1.4+this.random()*2.8+impact,vz:c.vz*.12+cs*(1+speed*.21)-sn*side*(.8+this.random()*2+impact),
      floor:c.y-.1,radius:.035+this.random()*.085,age:0,life:.45+this.random()*.6});
    this.emitted++;
  }
  private splash(strength:number,bias=0){
    if(this.cooldown>0)return;
    this.bursts++;this.cooldown=2.3+this.random()*1.2;
    const side=bias?Math.sign(bias):this.random()>.5?1:-1;
    for(let i=0;i<3;i++){
      const p=this.lens.splats[this.splatIndex++%this.lens.splats.length];
      const x=side>0?.74+this.random()*.22:.04+this.random()*.22;
      Object.assign(p,{x,y:.12+this.random()*.79,radius:(i===0?.115:.035)+this.random()*.035*strength,
        age:0,life:4.2+this.random()*2.4,seed:this.random()*23});
    }
  }
  update(dt:number,carts:readonly CartState[],owners:readonly number[],humanCart:number,listener:THREE.Vector3){
    this.lens.time+=dt;this.tracks.update(this.lens.time,carts,owners);this.cooldown=Math.max(0,this.cooldown-dt);
    for(const p of this.lens.splats)p.age=Math.min(p.life+1,p.age+dt);
    for(let i=0;i<carts.length;i++){
      const c=carts[i],speed=Math.abs(c.speed),near=(c.x-listener.x)**2+(c.z-listener.z)**2<3600;
      const landed=this.wasGrounded[i]===false&&c.grounded&&(this.lastVy[i]??0)<-3.5;
      this.wasGrounded[i]=c.grounded;this.lastVy[i]=c.vy;
      // Accumulation follows every occupied moving cart, even outside the
      // particle visibility radius. Dirt persists when a racer exits/steals it.
      const moving=owners[i]>=0&&c.health>0&&c.grounded&&speed>5,wet=moving?this.wetness(c):0;
      if(moving){
        this.deposits[i]=Math.min(1,(this.deposits[i]??0)+dt*(.009+wet*.029)*Math.min(1.5,speed/20));
      }
      if(!near||owners[i]<0||c.health<=0||!c.grounded||speed<5){this.emission[i]=0;continue;}
      this.emission[i]=(this.emission[i]??0)+dt*(10+speed*.45)*(.45+wet);
      for(let n=0;n<3&&this.emission[i]>=1;n++,this.emission[i]--)this.clod(c,this.random()>.5?1:-1);
      if(landed){for(let n=0;n<10;n++)this.clod(c,n%2?1:-1,2);if(i===humanCart&&speed>9)this.splash(1.2);}
      if(i===humanCart){
        // A wet wheel occasionally flicks the lens; standing still stays clean.
        if(wet>.65&&speed>13&&this.random()<dt*.26)this.splash(.7);
      }else{
        const dx=listener.x-c.x,dz=listener.z-c.z,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);
        const behind=dx*sn+dz*cs,across=dx*cs-dz*sn;
        if(behind>2&&behind<13&&Math.abs(across)<3.4&&Math.abs(listener.y-c.y)<3&&speed>10&&wet>.3&&this.random()<dt*1.6)
          this.splash(1,across);
      }
    }
    let visible=0;
    for(const p of this.clods){
      p.age+=dt;if(p.age>=p.life)continue;
      p.vy-=17*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      if(p.y<p.floor){p.age=p.life;continue;}
      const size=p.radius*clamp((p.life-p.age)*8,0,1);
      this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.age*4,p.x,p.z);
      this.dummy.scale.set(size,size*1.55,size*.8);this.dummy.updateMatrix();this.mesh.setMatrixAt(visible++,this.dummy.matrix);
    }
    this.mesh.count=visible;this.mesh.instanceMatrix.needsUpdate=true;
  }
  get diagnostics(){return {time:this.lens.time,tracks:this.tracks.diagnostics,bursts:this.bursts,emitted:this.emitted,groundClods:this.groundClods.count,deposits:[...this.deposits],clods:this.mesh.count,splats:this.lens.splats.filter(p=>p.age<p.life).length};}
  dispose(){this.tracks.dispose();this.groundClods.dispose();this.root.removeFromParent();this.geometry.dispose();this.material.dispose();this.mesh.dispose();}
}
