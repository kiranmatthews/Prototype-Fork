import * as THREE from 'three';
import { SIDE_NOZZLE } from './sideNozzle';
import { puffs } from '../puffs';
import type { GolfCartFleet } from './fleet';
import { CartGouraudFire } from './gouraudFire';
import { CartTempleJets } from './templeJets';
import { TEMPLE_FLAME_STEP } from '../templeFlame';

const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const FIRE_SOURCES=[[-.48,.76,.62],[.48,.76,.62],[-.5,.85,-.38],[.5,.85,-.38],[0,.9,.9]];
const UP=new THREE.Vector3(0,1,0);

/** Bounded fire geometry; the shared puff pool owns all smoke. No asset swaps. */
export class CartMayhemEffects {
  private flames:CartGouraudFire;
  private jets:CartTempleJets;
  private embers:CartGouraudFire;
  private inverse=new THREE.Matrix4();
  private point=new THREE.Vector3();private direction=new THREE.Vector3();
  private velocity=new THREE.Vector3();private inherited=new THREE.Vector3();
  private nextFire:number[];private nextJet:number[];
  private time=0;
  private smoke=0;
  private burnAge:number[]=[];
  readonly target=new THREE.Mesh(new THREE.TorusGeometry(1.9,.07,8,40),new THREE.MeshBasicMaterial({color:0xaaff67,toneMapped:false}));
  constructor(private fleet:GolfCartFleet){
    this.burnAge=fleet.models.map(()=>0);
    this.nextFire=fleet.models.map(()=>0);this.nextJet=fleet.models.map(()=>0);
    this.flames=new CartGouraudFire(fleet.models.length*120,'Rally wreck · rising Gouraud fire');
    this.jets=new CartTempleJets(fleet.models.length*6*24);
    this.embers=new CartGouraudFire(fleet.models.length*24,'Rally cooling embers');
    fleet.root.add(this.flames,this.jets,this.embers,this.target);
    this.target.rotation.x=-Math.PI/2;this.target.visible=false;
  }
  get burnAges():readonly number[]{return this.burnAge;}
  update(dt:number,burning:readonly boolean[]){
    this.time+=dt;
    for(let i=0;i<burning.length;i++)this.burnAge[i]=burning[i]?this.burnAge[i]+dt:0;
    this.smoke-=dt;if(this.smoke>0)return;this.smoke=.16;
    if(!this.fleet.root.visible)return;
    this.fleet.physics.carts.forEach((c,i)=>{
      if(c.health<.5&&this.burnAge[i]<16&&this.fleet.isPresented(i))puffs.burst('smokeDark',c.x+Math.sin(c.yaw)*.9*this.fleet.physics.scale,c.y+1.2*this.fleet.physics.scale,c.z+Math.cos(c.yaw)*.9*this.fleet.physics.scale,{count:burning[i]?2:1,strength:burning[i]?2.8:2.2,ambient:true});
    });
  }
  /** Emit from the interpolated mouths, retaining each packet's birth position.
   * present may run twice per frame; absolute emission clocks avoid duplicates. */
  present(burning:readonly boolean[],target:number,owners:readonly number[]=[],thrust:readonly number[]=[]){
    const time=this.time,scale=this.fleet.physics.scale;
    this.inverse.copy(this.fleet.root.matrixWorld).invert();
    for(let i=0;i<this.fleet.models.length;i++){
      const shown=this.fleet.root.visible&&this.fleet.isPresented(i),cart=this.fleet.physics.carts[i];
      const matrix=this.fleet.models[i].body.matrixWorld;
      this.inherited.set(cart.vx,cart.vy,cart.vz);
      if(shown&&burning[i]&&this.burnAge[i]<11.15){
        this.nextFire[i]=Math.max(this.nextFire[i],time-.05);
        while(this.nextFire[i]<=time){
          const born=this.nextFire[i],tick=Math.round(born*24),strength=Math.min(1,(11.15-this.burnAge[i])/2.1);
          for(let j=0;j<FIRE_SOURCES.length;j++){
            const seed=tick*13+i*71+j*19,source=FIRE_SOURCES[j];
            this.point.set(source[0]+(hash(seed)-.5)*.16,source[1],source[2]).applyMatrix4(matrix).applyMatrix4(this.inverse);
            this.point.addScaledVector(this.inherited,-(time-born));
            this.velocity.copy(this.inherited).multiplyScalar(.7);this.velocity.y+=1.65+hash(seed+2)*.65;
            this.flames.emit(born,this.point,this.velocity,UP,(.20+hash(seed+3)*.06)*scale,
              (.32+hash(seed+4)*.12)*scale,.62+hash(seed+5)*.20,seed,'fire',strength*.86);
            if(j===tick%5&&tick%2===0){
              this.velocity.x+=(hash(seed+8)-.5)*1.5;this.velocity.z+=(hash(seed+9)-.5)*1.5;this.velocity.y+=2.1;
              this.embers.emit(born,this.point,this.velocity,UP,.018*scale,.07*scale,.6+hash(seed+10)*.3,seed,'ember',strength);
            }
          }
          this.nextFire[i]+=1/24;
        }
      }else this.nextFire[i]=time;
      const owner=owners[i];
      if(shown&&owner>=0&&thrust[owner]>0&&!burning[i]){
        this.nextJet[i]=Math.max(this.nextJet[i],time-.05);
        while(this.nextJet[i]<=time){
          const born=this.nextJet[i],tick=Math.round(born/TEMPLE_FLAME_STEP);
          for(const side of [-1,1])for(const mouth of [-1,0,1]){
            const seed=tick*11+i*83+mouth*17+side*29;
            this.point.set(side*SIDE_NOZZLE.x,SIDE_NOZZLE.y,SIDE_NOZZLE.z+mouth*SIDE_NOZZLE.spacing)
              .applyMatrix4(matrix).applyMatrix4(this.inverse).addScaledVector(this.inherited,-(time-born));
            this.direction.set(side,0,0).transformDirection(matrix).transformDirection(this.inverse);
            const speed=13.5+hash(seed)*4;
            this.velocity.copy(this.direction).multiplyScalar(speed).add(this.inherited);
            this.jets.emit(born,this.point,this.inherited,this.direction,scale,seed);
            if(mouth===0&&tick%7===0){
              this.embers.emit(born,this.point,this.velocity,this.direction,.016*scale,.065*scale,.36,seed,'ember',.8);
            }
          }
          this.nextJet[i]+=TEMPLE_FLAME_STEP;
        }
      }else this.nextJet[i]=time;
    }
    this.flames.present(time);this.jets.present(time);this.embers.present(time);
    this.target.visible=target>=0&&this.fleet.isPresented(target);
    if(this.target.visible){const position=this.fleet.models[target].root.position;this.target.position.copy(position);this.target.position.y+=.12;this.target.scale.setScalar(this.fleet.physics.scale*(1+Math.sin(time*6)*.06));}
  }
  dispose(){this.jets.destroy();this.flames.destroy();this.embers.destroy();this.target.geometry.dispose();this.target.material.dispose();this.target.removeFromParent();}
}
