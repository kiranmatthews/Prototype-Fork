import * as THREE from 'three';
import {createRoundBoulderGeometry,createRoundBoulderMaterial} from './roundBoulder';
import {createJungleAssetScope, type JungleAssetKind, type Template} from './jungleAssets';

/** Cosmetic attachments only: the Level owns every motion curve and collider. */
export class HazardVisuals {
  private assets=createJungleAssetScope();
  private jobs:Promise<void>[]=[];
  private roots:THREE.Object3D[]=[];
  private materials=new Map<string,THREE.MeshStandardMaterial>();
  private ownedGeometries=new Set<THREE.BufferGeometry>();
  private ownedTextures=new Set<THREE.Texture>();
  private disposed=false;
  private errors:string[]=[];
  private loaded=0;
  private roundTemplate?:Promise<{geometry:THREE.BufferGeometry;map:THREE.Texture;material:THREE.MeshStandardMaterial}|null>;

  private material(kind:JungleAssetKind,template:Template,color='#ffffff'):THREE.MeshStandardMaterial {
    const key=kind+color,existing=this.materials.get(key);if(existing)return existing;
    const iron=kind.startsWith('hazardiron');
    const m=new THREE.MeshStandardMaterial({color,map:template.map,normalMap:template.normalMap,
      roughnessMap:template.roughnessMap,roughness:iron?.82:.94,metalness:iron?.62:0,
      normalScale:new THREE.Vector2().setScalar(iron?.4:.3)});
    m.name=iron?'Weathered forged iron / Meshy':'Mossy sandstone / Meshy';
    this.materials.set(key,m);return m;
  }

  private visual(template:Template,material:THREE.Material,matrices?:THREE.Matrix4[]):THREE.Mesh {
    const mesh=matrices?new THREE.InstancedMesh(template.geometry,material,matrices.length):new THREE.Mesh(template.geometry,material);
    if(mesh instanceof THREE.InstancedMesh){
      matrices!.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    }
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.hazardVisual=true;
    mesh.userData.solidSurface='none';return mesh;
  }

  private queue(owner:THREE.Object3D,work:()=>Promise<void>):void {
    this.jobs.push(work().catch(error=>{
      if(this.disposed)return;
      const message=String(error instanceof Error?error.message:error);
      this.errors.push(message);owner.userData.hazardAssetError=message;
      console.error('Hazard asset failed; retaining its visible fallback',error);
    }));
  }

  crusher(body:THREE.Mesh,size:[number,number,number],kind:JungleAssetKind='custardboulder',color?:string):void {
    body.userData.hazardAsset=kind;
    this.queue(body,async()=>{
      const template=await this.assets.load(kind);if(this.disposed)return;
      const visual=this.visual(template,this.material(kind,template,color));
      visual.name='Meshy crusher boulder';visual.position.y=-size[1]/2;visual.scale.fromArray(size);
      body.add(visual);this.roots.push(visual);
      for(const m of Array.isArray(body.material)?body.material:[body.material])m.visible=false;
      body.userData.hazardAssetReady=true;this.loaded++;
    });
  }

  rollingBoulder(body:THREE.Mesh,radius:number):void {
    body.userData.hazardAsset='round-custard-boulder';
    // Separate physical stones share one texture/material and the complete sphere geometry.
    this.roundTemplate??=(async()=>{
      const map=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+'custard-creek/sandstone-albedo.webp');
      if(this.disposed){map.dispose();return null;}
      this.ownedTextures.add(map);
      const geometry=createRoundBoulderGeometry(28);
      this.ownedGeometries.add(geometry);
      const material=createRoundBoulderMaterial(map);this.materials.set('round-custard-boulder',material);
      return{geometry,map,material};
    })();
    this.queue(body,async()=>{
      const template=await this.roundTemplate;if(!template||this.disposed)return;
      const visual=this.visual(template,template.material);
      visual.name='Round cracked mossy pursuit boulder';visual.scale.setScalar(radius);
      body.add(visual);this.roots.push(visual);
      for(const m of Array.isArray(body.material)?body.material:[body.material])m.visible=false;
      body.userData.hazardAssetReady=true;this.loaded++;
    });
  }

  pendulum(pivot:THREE.Group,len:number,fallback:THREE.Object3D[]):void {
    pivot.userData.hazardAsset='meshy-iron-pendulum';
    this.queue(pivot,async()=>{
      const [weight,link]=await Promise.all([this.assets.load('hazardironweight'),this.assets.load('hazardironlink')]);
      if(this.disposed)return;
      const root=new THREE.Group();root.name='Meshy iron ball and interlocking chain';
      const bob=this.visual(weight,this.material('hazardironweight',weight));
      bob.name='Meshy iron weight';bob.scale.set(1.9,2.25,1.8);bob.position.y=-len-.95;root.add(bob);
      // Repeated links retain their thickness and alternate by 90 degrees.
      // Fit the whole chain between its overhead anchor and the weight's eye.
      const span=Math.max(.15,len-1.08),count=Math.max(1,Math.round((span-.54)/.39)+1);
      const scale=span/(.54+(count-1)*.39),matrices:THREE.Matrix4[]=[];
      for(let i=0;i<count;i++)matrices.push(new THREE.Matrix4().compose(
        new THREE.Vector3(0,.08-(i*.39+.54)*scale,0),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(i%2)*Math.PI/2),
        new THREE.Vector3(.3,.54,.1).multiplyScalar(scale)));
      const chain=this.visual(link,this.material('hazardironlink',link),matrices);chain.name='Meshy interlocking chain';root.add(chain);
      pivot.add(root);this.roots.push(root);fallback.forEach(object=>object.visible=false);
      pivot.userData.hazardAssetReady=true;pivot.userData.chainLinks=count;this.loaded++;
    });
  }

  async ready():Promise<void>{await Promise.all(this.jobs);}
  get diagnostics(){return {requested:this.jobs.length,ready:this.loaded,errors:[...this.errors]};}
  dispose():void {
    this.disposed=true;
    for(const root of this.roots){
      root.removeFromParent();root.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});
      root.clear();
    }
    this.roots.length=0;this.jobs.length=0;
    for(const material of this.materials.values())material.dispose();this.materials.clear();
    for(const geometry of this.ownedGeometries)geometry.dispose();this.ownedGeometries.clear();
    for(const texture of this.ownedTextures)texture.dispose();this.ownedTextures.clear();
    this.assets.dispose();
  }
}
