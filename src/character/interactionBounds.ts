import * as THREE from 'three';

interface CachedMeshBounds {
  geometry: THREE.BufferGeometry;
  version: number;
  morphs: number[];
  box: THREE.Box3;
}

/** Pickup/attack silhouette, independent of the level-authoring body collider.
 * Only the rider hierarchy participates: boards, shadows and attack VFX are
 * siblings. Hidden alternate heads and comparison meshes cannot inflate it. */
export class CharacterInteractionBounds {
  private readonly cache = new WeakMap<THREE.Mesh,CachedMeshBounds>();
  private readonly point = new THREE.Vector3();
  private readonly transformed = new THREE.Box3();
  private readonly instance = new THREE.Matrix4();
  private readonly world = new THREE.Matrix4();
  meshCount = 0;

  measure(root: THREE.Object3D, out: THREE.Box3): boolean {
    root.updateWorldMatrix(true,true);
    out.makeEmpty();this.meshCount=0;
    const visit=(node:THREE.Object3D):void=>{
      // The root may be hidden by a temporary presentation effect. Visibility
      // below it still selects the actual current head, outfit and limbs.
      if(node!==root&&!node.visible)return;
      if(node instanceof THREE.Mesh){
        const materials=Array.isArray(node.material)?node.material:[node.material];
        if(materials.some(material=>material.visible&&material.opacity>0)){
          const box=this.localBounds(node);
          if(box&&!box.isEmpty()){
            if(node instanceof THREE.InstancedMesh){
              for(let i=0;i<node.count;i++){
                node.getMatrixAt(i,this.instance);this.world.multiplyMatrices(node.matrixWorld,this.instance);
                out.union(this.transformed.copy(box).applyMatrix4(this.world));
              }
            }else out.union(this.transformed.copy(box).applyMatrix4(node.matrixWorld));
            this.meshCount++;
          }
        }
      }
      for(const child of node.children)visit(child);
    };
    visit(root);
    return !out.isEmpty()&&[...out.min.toArray(),...out.max.toArray()].every(Number.isFinite);
  }

  private localBounds(mesh:THREE.Mesh):THREE.Box3|null {
    const geometry=mesh.geometry,positions=geometry.getAttribute('position');
    if(!positions)return null;
    if(mesh instanceof THREE.SkinnedMesh){
      mesh.skeleton.update();mesh.computeBoundingBox();
      return mesh.boundingBox;
    }
    const morphs=mesh.morphTargetInfluences??[];
    const version='version' in positions?positions.version:positions.data.version;
    let cached=this.cache.get(mesh);
    if(!cached||cached.geometry!==geometry||cached.version!==version||
        cached.morphs.length!==morphs.length||morphs.some((value,i)=>value!==cached!.morphs[i])){
      const box=new THREE.Box3();
      // BufferGeometry.computeBoundingBox unions every morph target, even
      // inactive ones. Read only the currently applied shape instead.
      for(let i=0;i<positions.count;i++)box.expandByPoint(mesh.getVertexPosition(i,this.point));
      cached={geometry,version,morphs:[...morphs],box};this.cache.set(mesh,cached);
    }
    return cached.box;
  }
}
