import * as THREE from 'three';
import { puffs } from '../puffs';
import type { GolfCartFleet } from './fleet';

/** Bounded fire geometry; the shared puff pool owns all smoke. No asset swaps. */
export class CartMayhemEffects {
  private flames:THREE.InstancedMesh;
  private dummy=new THREE.Object3D();
  private smoke=0;
  readonly target=new THREE.Mesh(new THREE.TorusGeometry(1.9,.07,8,40),new THREE.MeshBasicMaterial({color:0xaaff67,toneMapped:false}));
  constructor(private fleet:GolfCartFleet){
    this.flames=new THREE.InstancedMesh(new THREE.LatheGeometry([[0,0],[.4,.12],[.55,.5],[.3,1],[.12,1.4],[0,2]].map(([x,y])=>new THREE.Vector2(x,y)),12),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),fleet.models.length*7);
    this.flames.name='Rally engine flames';this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.flames.frustumCulled=false;
    for(let i=0;i<this.flames.count;i++)this.flames.setColorAt(i,new THREE.Color([0xff4b12,0xffa322,0xffe989][i%3]));
    fleet.root.add(this.flames,this.target);this.target.rotation.x=-Math.PI/2;this.target.visible=false;
  }
  update(dt:number,burning:readonly boolean[],target:number){
    this.smoke-=dt;const emit=this.smoke<=0;if(emit)this.smoke=.16;
    const time=this.fleet.physics.time;
    this.fleet.physics.carts.forEach((c,i)=>{
      const model=this.fleet.models[i];
      for(let j=0;j<7;j++){
        const age=(time*(1.3+j*.08)+j*.17)%1,angle=j*2.399;
        this.dummy.position.set(model.root.position.x+Math.cos(angle)*.6,model.root.position.y+.7+age*2.1,model.root.position.z+Math.sin(angle)*.8);
        this.dummy.rotation.set(.12*Math.sin(time*7+j),angle,.2*Math.cos(time*9+j));
        const size=burning[i]?(1-age)*.95:0;this.dummy.scale.set(size,size*(1.6+age),size);this.dummy.updateMatrix();
        this.flames.setMatrixAt(i*7+j,this.dummy.matrix);
      }
      if(emit&&c.health<.5&&this.fleet.root.visible)puffs.burst('smokeDark',c.x,c.y+1.2,c.z,{count:burning[i]?2:1,strength:burning[i]?2.8:1.3,ambient:true});
    });
    this.flames.instanceMatrix.needsUpdate=true;this.flames.visible=burning.some(Boolean);
    this.target.visible=target>=0;
    if(target>=0){const c=this.fleet.physics.carts[target];this.target.position.set(c.x,c.y+.12,c.z);this.target.scale.setScalar(1+Math.sin(time*6)*.06);}
  }
  dispose(){this.flames.geometry.dispose();(this.flames.material as THREE.Material).dispose();this.flames.dispose();this.flames.removeFromParent();this.target.geometry.dispose();this.target.material.dispose();this.target.removeFromParent();}
}
