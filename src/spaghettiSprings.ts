import * as THREE from 'three';
import type { CustomLevelData } from './level';
import { acquireCarlisleNetHousing } from './carlisleShipyard';
import { CarlisleMarineNet, marineFrameHeight } from './carlisleMarineNet';
import { marineNetBounds, trampolineSurfacePresentations } from './trampolineSurface';

/** Carlisle's complete housing and elastic ropes on the existing spring
 * colliders. One asset lease per course; all housings share its resources. */
export class SpaghettiSprings {
  readonly ready:Promise<void>;
  readonly diagnostics={status:'loading',errors:[] as string[]};
  private readonly lease=acquireCarlisleNetHousing();
  private readonly hidden=new THREE.MeshBasicMaterial({visible:false});
  private readonly entries:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[];mount:THREE.Group;net:CarlisleMarineNet;impact:number;w:number;d:number;top:number}[]=[];
  private disposed=false;
  constructor(data:CustomLevelData,ground:THREE.Mesh[]){
    for(const c of data.components.filter(c=>c.t==='trampoline')){
      const mesh=ground.find(m=>m.name===c.nm);if(!mesh)continue;
      const [w,h,d]=c.s!,top=h/2,lip=Math.min(.15,Math.min(w,d)*.012);
      const mount=new THREE.Group();mount.name='Carlisle orange marine spring';mesh.add(mount);
      const net=new CarlisleMarineNet(w,d);net.group.position.y=top+lip;mount.add(net.group);
      mesh.userData.marineNet=net.diagnostics;
      mesh.userData.trampolineNetBounds=marineNetBounds(w,d);
      trampolineSurfacePresentations.set(mesh,net);
      this.entries.push({mesh,material:mesh.material,mount,net,impact:0,w,d,top:top+lip});
      mesh.material=this.hidden;
    }
    this.ready=this.lease.promise.then(gltf=>{
      if(this.disposed)return;
      const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const normalize=new THREE.Matrix4().makeScale(1/size.x,1/size.y,1/size.z).multiply(new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z));
      for(const entry of this.entries){
        const h=marineFrameHeight(entry.w,entry.d);
        const transform=new THREE.Matrix4().makeTranslation(0,entry.top-h*.37,0)
          .multiply(new THREE.Matrix4().makeScale(entry.w,h,entry.d)).multiply(normalize);
        gltf.scene.traverse(node=>{
          if(!(node instanceof THREE.Mesh))return;
          const part=new THREE.Mesh(node.geometry,node.material);part.name='Complete Carlisle net housing';
          part.applyMatrix4(transform.clone().multiply(node.matrixWorld));entry.mount.add(part);
        });
      }
      this.diagnostics.status='ready';
    }).catch(error=>{if(!this.disposed){
      this.diagnostics.status='error';this.diagnostics.errors.push(String(error));
      for(const entry of this.entries)entry.mesh.material=entry.material;
      console.warn('Spaghetti spring housing failed',error);
    }});
  }
  update(dt:number):void{
    for(const entry of this.entries){
      const impact=entry.mesh.userData.trampolineVisualImpact;
      if(impact&&impact.id!==entry.impact){entry.impact=impact.id;entry.net.impact(impact.x,impact.z,impact.speed);}
      entry.net.update(dt);
    }
  }
  dispose():void{
    this.disposed=true;
    for(const {mesh,material,mount,net} of this.entries){
      trampolineSurfacePresentations.delete(mesh);delete mesh.userData.marineNet;
      net.dispose();mount.removeFromParent();mesh.material=material;
    }
    this.entries.length=0;this.hidden.dispose();this.lease.release();
  }
}
