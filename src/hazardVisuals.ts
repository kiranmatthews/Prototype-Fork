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

  private material(kind:JungleAssetKind,template:Template,color='#ffffff'):THREE.MeshStandardMaterial {
    const key=kind+color,existing=this.materials.get(key);if(existing)return existing;
    const iron=kind.startsWith('hazardiron');
    const m=new THREE.MeshStandardMaterial({color,map:template.map,normalMap:template.normalMap,
      roughnessMap:template.roughnessMap,roughness:iron?.82:.94,metalness:iron?.62:0,
      normalScale:new THREE.Vector2().setScalar(iron?.4:.3)});
    m.name=iron?'Weathered forged iron / Meshy':'Mossy sandstone / Meshy';
    this.materials.set(key,m);return m;
  }

  private lod(template:Template,material:THREE.Material,matrices?:THREE.Matrix4[]):THREE.LOD {
    const lod=new THREE.LOD();
    for(const [index,geometry] of [template.geometry,template.lodGeometry??template.geometry].entries()){
      const mesh=matrices?new THREE.InstancedMesh(geometry,material,matrices.length):new THREE.Mesh(geometry,material);
      if(mesh instanceof THREE.InstancedMesh){
        matrices!.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
      }
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.hazardVisual=true;
      mesh.userData.solidSurface='none';
      lod.addLevel(mesh,index?38:0,.15);
    }
    // One draw per part, with automatic camera-distance switching in every view.
    lod.levels[1].object.visible=false;return lod;
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
      const visual=this.lod(template,this.material(kind,template,color));
      visual.name='Meshy crusher boulder';visual.position.y=-size[1]/2;visual.scale.fromArray(size);
      body.add(visual);this.roots.push(visual);
      for(const m of Array.isArray(body.material)?body.material:[body.material])m.visible=false;
      body.userData.hazardAssetReady=true;this.loaded++;
    });
  }

  rollingBoulder(body:THREE.Mesh,radius:number):void {
    body.userData.hazardAsset='round-custard-boulder';
    this.queue(body,async()=>{
      const texture=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+'custard-creek/sandstone-albedo.webp');
      if(this.disposed){texture.dispose();return;}
      this.ownedTextures.add(texture);
      const geometry=createRoundBoulderGeometry(28),lodGeometry=createRoundBoulderGeometry(14);
      this.ownedGeometries.add(geometry);this.ownedGeometries.add(lodGeometry);
      const material=createRoundBoulderMaterial(texture);this.materials.set('round-custard-boulder',material);
      const visual=this.lod({geometry,lodGeometry,map:texture},material);
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
      const bob=this.lod(weight,this.material('hazardironweight',weight));
      bob.name='Meshy iron weight';bob.scale.set(1.9,2.25,1.8);bob.position.y=-len-.95;root.add(bob);
      // Repeated links retain their thickness and alternate by 90 degrees.
      // Fit the whole chain between its overhead anchor and the weight's eye.
      const span=Math.max(.15,len-1.08),count=Math.max(1,Math.round((span-.54)/.39)+1);
      const scale=span/(.54+(count-1)*.39),matrices:THREE.Matrix4[]=[];
      for(let i=0;i<count;i++)matrices.push(new THREE.Matrix4().compose(
        new THREE.Vector3(0,.08-(i*.39+.54)*scale,0),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(i%2)*Math.PI/2),
        new THREE.Vector3(.3,.54,.1).multiplyScalar(scale)));
      const chain=this.lod(link,this.material('hazardironlink',link),matrices);chain.name='Meshy interlocking chain';root.add(chain);
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
