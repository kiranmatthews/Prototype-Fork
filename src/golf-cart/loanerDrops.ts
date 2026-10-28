import * as THREE from 'three';
import type { GolfCartPhysics } from './physics';
import type { GolfCartFleet, FleetPose } from './fleet';

export const LOANER_DROP=Object.freeze({height:32,fallSpeed:6.2,canopyHeight:6.1,canopyRadius:3.35,releaseSeconds:1.65});
interface Drop {
  index:number;age:number;released:number;root:THREE.Group;cloth:THREE.Group;
  canopy:THREE.Mesh;seams:THREE.LineSegments;cords:THREE.InstancedMesh;
  material:THREE.MeshStandardMaterial;lineMaterial:THREE.LineBasicMaterial;cordMaterial:THREE.MeshStandardMaterial;
}
const PANELS=16,STEPS=8,SLICES=4;
function canopyGeometry(){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],seams:THREE.Vector3[]=[];
  const point=(angle:number,t:number)=>{
    const theta=.055+t*(Math.PI/2-.055),radius=LOANER_DROP.canopyRadius*Math.sin(theta);
    const scallop=.14*Math.sin(angle*PANELS/2)**2*Math.pow(t,7);
    return new THREE.Vector3(Math.cos(angle)*radius,1.55*Math.cos(theta)-scallop,Math.sin(angle)*radius);
  };
  for(let panel=0;panel<PANELS;panel++){
    const color=new THREE.Color(panel%4<2?'#95e65a':'#f2e7ca'),base=positions.length/3;
    for(let row=0;row<=STEPS;row++)for(let column=0;column<=SLICES;column++){
      const p=point((panel+column/SLICES)*Math.PI*2/PANELS,row/STEPS);positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b);
    }
    for(let row=0;row<STEPS;row++)for(let column=0;column<SLICES;column++){
      const a=base+row*(SLICES+1)+column,b=a+SLICES+1;indices.push(a,a+1,b,b,a+1,b+1);
    }
    for(let row=0;row<STEPS;row++)seams.push(point(panel*Math.PI*2/PANELS,row/STEPS),point(panel*Math.PI*2/PANELS,(row+1)/STEPS));
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return {geometry,seams:new THREE.BufferGeometry().setFromPoints(seams)};
}

/** Real carts descend in the existing solver. Only the cloth and cords are cosmetic. */
export class LoanerDrops {
  readonly root=new THREE.Group();
  private drops=new Map<number,Drop>();
  private kit=canopyGeometry();
  private cordGeometry=new THREE.CylinderGeometry(.017,.017,1,5);
  private dummy=new THREE.Object3D();private a=new THREE.Vector3();private b=new THREE.Vector3();private delta=new THREE.Vector3();private direction=new THREE.Vector3();private up=new THREE.Vector3(0,1,0);
  constructor(){this.root.name='Parachuting loaners';}
  isDescending(index:number){return this.drops.get(index)?.released===-1;}
  get activeCount(){return this.drops.size;}
  nearest(position:THREE.Vector3,world:GolfCartPhysics,range=80){
    let found=-1,best=range*range;
    for(const [index,drop]of this.drops)if(drop.released<0){const c=world.carts[index],distance=(c.x-position.x)**2+(c.z-position.z)**2;if(distance<best){found=index;best=distance;}}
    return found;
  }
  start(index:number,world:GolfCartPhysics){
    this.remove(index);
    const c=world.carts[index];c.y+=LOANER_DROP.height;c.vy=-2;c.grounded=false;c.airTime=0;
    const root=new THREE.Group(),cloth=new THREE.Group();root.name=`Loaner parachute ${index}`;root.add(cloth);this.root.add(root);
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,side:THREE.DoubleSide,transparent:true});
    const lineMaterial=new THREE.LineBasicMaterial({color:'#477332',transparent:true});
    const cordMaterial=new THREE.MeshStandardMaterial({color:'#e7ddc3',roughness:.85,transparent:true});
    const canopy=new THREE.Mesh(this.kit.geometry,material),seams=new THREE.LineSegments(this.kit.seams,lineMaterial);
    canopy.name='Paneled vented canopy';canopy.castShadow=true;canopy.receiveShadow=true;cloth.add(canopy,seams);
    const cords=new THREE.InstancedMesh(this.cordGeometry,cordMaterial,PANELS);cords.name='Suspension lines';cords.instanceMatrix.setUsage(THREE.DynamicDrawUsage);cords.frustumCulled=false;root.add(cords);
    root.position.set(c.x,c.y,c.z);root.rotation.y=c.yaw;
    this.drops.set(index,{index,age:0,released:-1,root,cloth,canopy,seams,cords,material,lineMaterial,cordMaterial});
  }
  /** Sampled at the cart solver's 120 Hz, never by rendering. */
  control(world:GolfCartPhysics){
    for(const [index,drop]of this.drops)if(drop.released<0){const c=world.carts[index];if(c.health>0&&!c.grounded)c.vy=Math.max(c.vy,-LOANER_DROP.fallSpeed);}
  }
  update(dt:number,world:GolfCartPhysics){
    const landed:number[]=[];
    for(const [index,drop]of this.drops){
      const c=world.carts[index];drop.age+=dt;
      if(drop.released<0&&(c.grounded||c.health<=0)){
        drop.released=0;drop.root.position.set(c.x,c.y,c.z);drop.root.rotation.y=c.yaw;
        if(c.grounded&&c.health>0)landed.push(index);
      }else if(drop.released>=0){drop.released+=dt;if(drop.released>=LOANER_DROP.releaseSeconds)this.remove(index);}
    }
    return landed;
  }
  updateView(fleet:GolfCartFleet){for(const [index,drop]of this.drops)drop.root.visible=fleet.isPresented(index);}
  present(fleet:GolfCartFleet,poses:readonly FleetPose[]){
    this.updateView(fleet);
    for(const [index,d]of this.drops){
      if(!d.root.visible)continue;
      const p=poses[index],phase=d.age*2.4+index*.71,release=Math.max(0,d.released),t=release/LOANER_DROP.releaseSeconds,side=index%2?1:-1;
      if(d.released<0){d.root.position.set(p.x,p.y,p.z);d.root.rotation.y=p.yaw;}
      d.cloth.position.set(Math.sin(phase)*.20+side*t*5.5,LOANER_DROP.canopyHeight+Math.sin(phase*.8)*.09-t*3.8,Math.cos(phase*.7)*.15+t*1.2);
      d.cloth.rotation.set(Math.sin(phase*.8)*.055+t*.5,Math.sin(phase*.55)*.04,Math.cos(phase)*.07+side*t*.7);
      d.cloth.scale.set(1-t*.48,1-t*.90,1-t*.48);
      const fade=Math.min(1,(1-t)*3);d.material.opacity=fade;d.lineMaterial.opacity=fade*.65;d.cordMaterial.opacity=Math.max(0,1-release*4);
      d.cords.visible=release<.25;d.root.updateWorldMatrix(true,true);
      if(!d.cords.visible)continue;
      const roof=fleet.models[index].modules.roof;
      for(let i=0;i<PANELS;i++){
        const angle=i*Math.PI*2/PANELS;
        this.a.set(Math.sign(Math.cos(angle))*.66,2.12+fleet.kit.cabinRise,Math.sign(Math.sin(angle))*.67);roof.localToWorld(this.a);d.root.worldToLocal(this.a);
        this.b.set(Math.cos(angle)*LOANER_DROP.canopyRadius,0,Math.sin(angle)*LOANER_DROP.canopyRadius).applyMatrix4(d.cloth.matrix);
        this.delta.copy(this.b).sub(this.a);this.dummy.position.copy(this.a).add(this.b).multiplyScalar(.5);this.dummy.quaternion.setFromUnitVectors(this.up,this.direction.copy(this.delta).normalize());this.dummy.scale.set(1,this.delta.length(),1);this.dummy.updateMatrix();d.cords.setMatrixAt(i,this.dummy.matrix);
      }
      d.cords.instanceMatrix.needsUpdate=true;
    }
  }
  private remove(index:number){
    const d=this.drops.get(index);if(!d)return;d.root.removeFromParent();d.cords.dispose();d.material.dispose();d.lineMaterial.dispose();d.cordMaterial.dispose();this.drops.delete(index);
  }
  dispose(){for(const index of this.drops.keys())this.remove(index);this.kit.geometry.dispose();this.kit.seams.dispose();this.cordGeometry.dispose();this.root.removeFromParent();}
}
