import * as THREE from 'three';
import { puffs } from '../puffs';
import type { GolfCartFleet } from './fleet';

/** Bounded fire geometry; the shared puff pool owns all smoke. No asset swaps. */
export class CartMayhemEffects {
  private flames:THREE.InstancedMesh;
  private dummy=new THREE.Object3D();
  private smoke=0;
  private burnAge:number[]=[];
  readonly target=new THREE.Mesh(new THREE.TorusGeometry(1.9,.07,8,40),new THREE.MeshBasicMaterial({color:0xaaff67,toneMapped:false}));
  constructor(private fleet:GolfCartFleet){
    this.burnAge=fleet.models.map(()=>0);
    this.flames=new THREE.InstancedMesh(new THREE.LatheGeometry([[0,0],[.4,.12],[.55,.5],[.3,1],[.12,1.4],[0,2]].map(([x,y])=>new THREE.Vector2(x,y)),12),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),fleet.models.length*7);
    this.flames.name='Rally engine flames';this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.flames.frustumCulled=false;
    for(let i=0;i<this.flames.count;i++)this.flames.setColorAt(i,new THREE.Color([0xff4b12,0xffa322,0xffe989][i%3]));
    this.flames.count=0;this.flames.visible=false;fleet.root.add(this.flames,this.target);this.target.rotation.x=-Math.PI/2;this.target.visible=false;
  }
  update(dt:number,burning:readonly boolean[]){
    for(let i=0;i<burning.length;i++)this.burnAge[i]=burning[i]?this.burnAge[i]+dt:0;
    this.smoke-=dt;if(this.smoke>0)return;this.smoke=.16;
    if(!this.fleet.root.visible)return;
    this.fleet.physics.carts.forEach((c,i)=>{
      if(c.health<.5&&this.burnAge[i]<16&&this.fleet.isPresented(i))puffs.burst('smokeDark',c.x+Math.sin(c.yaw)*.9,c.y+1.2,c.z+Math.cos(c.yaw)*.9,{count:burning[i]?2:1,strength:burning[i]?2.8:2.2,ambient:true});
    });
  }
  /** Use interpolated chassis positions so flames and the selection ring stay attached. */
  present(burning:readonly boolean[],target:number){
    const time=this.fleet.physics.time;let count=0;
    for(let i=0;i<burning.length;i++){
      if(!burning[i]||this.burnAge[i]>=12||!this.fleet.isPresented(i))continue;
      const position=this.fleet.models[i].root.position;
      for(let j=0;j<7;j++){
        const age=(time*(1.3+j*.08)+j*.17)%1,angle=j*2.399;
        this.dummy.position.set(position.x+Math.cos(angle)*.6,position.y+.7+age*2.1,position.z+Math.sin(angle)*.8);
        this.dummy.rotation.set(.12*Math.sin(time*7+j),angle,.2*Math.cos(time*9+j));
        const size=(1-age)*.95*Math.min(1,(12-this.burnAge[i])/3);this.dummy.scale.set(size,size*(1.6+age),size);this.dummy.updateMatrix();
        this.flames.setMatrixAt(count++,this.dummy.matrix);
      }
    }
    this.flames.count=count;this.flames.visible=count>0;if(count)this.flames.instanceMatrix.needsUpdate=true;
    this.target.visible=target>=0&&this.fleet.isPresented(target);
    if(this.target.visible){const position=this.fleet.models[target].root.position;this.target.position.copy(position);this.target.position.y+=.12;this.target.scale.setScalar(1+Math.sin(time*6)*.06);}
  }
  dispose(){this.flames.geometry.dispose();(this.flames.material as THREE.Material).dispose();this.flames.dispose();this.flames.removeFromParent();this.target.geometry.dispose();this.target.material.dispose();this.target.removeFromParent();}
}
