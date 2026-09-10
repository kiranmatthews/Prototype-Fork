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
  supportSamples = 0;
  private readonly supportCache = new WeakMap<THREE.BufferGeometry, Uint32Array>();
  private readonly directions = Array.from({length:128},(_,i)=>{
    const y=1-2*(i+.5)/128,r=Math.sqrt(1-y*y),a=i*2.399963229728653;
    return [Math.cos(a)*r,y,Math.sin(a)*r];
  }).concat([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]);

  /** Cache a small surface hull while the live character is already being
   * measured. Per-bone extrema preserve bent limbs without scanning a skin
   * again during its fatal animation. Topology, not pose, owns these indices. */
  private supportIndices(geometry: THREE.BufferGeometry): Uint32Array {
    let cached=this.supportCache.get(geometry);if(cached)return cached;
    const p=geometry.getAttribute('position');
    if(!p)return new Uint32Array();
    if(p.count<=70){cached=Uint32Array.from({length:p.count},(_,i)=>i);}
    else {
      const best=new Float64Array(this.directions.length).fill(-Infinity),indices=new Uint32Array(this.directions.length);
      const bones=new Map<number,{min:number[];max:number[];indices:number[]}>();
      const skin=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        for(let d=0;d<this.directions.length;d++){
          const n=this.directions[d],v=x*n[0]+y*n[1]+z*n[2];if(v>best[d]){best[d]=v;indices[d]=i;}
        }
        if(skin&&weights){
          let channel=0;for(let c=1;c<4;c++)if(weights.getComponent(i,c)>weights.getComponent(i,channel))channel=c;
          const bone=skin.getComponent(i,channel);let envelope=bones.get(bone);
          if(!envelope){envelope={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],indices:Array(6).fill(i)};bones.set(bone,envelope);}
          for(let axis=0;axis<3;axis++){const v=axis===0?x:axis===1?y:z;
            if(v<envelope.min[axis]){envelope.min[axis]=v;envelope.indices[axis*2]=i;}
            if(v>envelope.max[axis]){envelope.max[axis]=v;envelope.indices[axis*2+1]=i;}
          }
        }
      }
      cached=Uint32Array.from(new Set([...indices,...Array.from({length:32},(_,i)=>Math.floor(i*(p.count-1)/31)),...[...bones.values()].flatMap(b=>b.indices)]));
    }
    this.supportCache.set(geometry,cached);return cached;
  }

  /** Sparse kinematic pose support, only for a non-interactive dead rider.
   * Caller updates world/bind matrices once; live pickup/attack bounds retain
   * their complete mesh measurement. No world collision or CPU full-skin scan. */
  sampledPlaneDistance(root: THREE.Object3D, normal: Readonly<THREE.Vector3>, point: Readonly<THREE.Vector3>, contact?: THREE.Vector3, bounds?: THREE.Box3): number {
    let minimum=Infinity;this.supportSamples=0;bounds?.makeEmpty();
    const visit=(node:THREE.Object3D):void=>{
      if(node!==root&&!node.visible)return;
      if(node instanceof THREE.Mesh){
        const materials=Array.isArray(node.material)?node.material:[node.material];
        if(materials.some(m=>m.visible&&m.opacity>0)){
          const indices=this.supportIndices(node.geometry),count=node instanceof THREE.InstancedMesh?node.count:1;
          for(let instance=0;instance<count;instance++){
            this.world.copy(node.matrixWorld);
            if(node instanceof THREE.InstancedMesh){node.getMatrixAt(instance,this.instance);this.world.multiply(this.instance);}
            for(const i of indices){
              node.getVertexPosition(i,this.point).applyMatrix4(this.world);this.supportSamples++;bounds?.expandByPoint(this.point);
              const distance=normal.x*(this.point.x-point.x)+normal.y*(this.point.y-point.y)+normal.z*(this.point.z-point.z);
              if(distance<minimum){minimum=distance;contact?.copy(this.point);}
            }
          }
        }
      }
      for(const child of node.children)visit(child);
    };
    visit(root);return minimum;
  }

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
          this.supportIndices(node.geometry);
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

  /** Exact rendered-vertex support for a rare settled pose. A transformed
   * local AABB can put an empty corner far below a rotated head or limb. */
  minimumPlaneDistance(root: THREE.Object3D, normal: Readonly<THREE.Vector3>, point: Readonly<THREE.Vector3>, contact?: THREE.Vector3): number {
    root.updateWorldMatrix(true, true);
    // Attached SkinnedMesh updates its bind inverse in updateMatrixWorld,
    // which updateWorldMatrix alone does not invoke after a root adjustment.
    root.updateMatrixWorld(true);
    let minimum = Infinity;
    const visit = (node: THREE.Object3D): void => {
      if (node !== root && !node.visible) return;
      if (node instanceof THREE.Mesh) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        const vertices = node.geometry.getAttribute('position');
        if (vertices && materials.some(material => material.visible && material.opacity > 0)) {
          if (node instanceof THREE.SkinnedMesh) node.skeleton.update();
          const count = node instanceof THREE.InstancedMesh ? node.count : 1;
          for (let instance = 0; instance < count; instance++) {
            this.world.copy(node.matrixWorld);
            if (node instanceof THREE.InstancedMesh) { node.getMatrixAt(instance, this.instance); this.world.multiply(this.instance); }
            for (let i = 0; i < vertices.count; i++) {
              node.getVertexPosition(i, this.point).applyMatrix4(this.world);
              const distance = normal.x * (this.point.x - point.x) + normal.y * (this.point.y - point.y) + normal.z * (this.point.z - point.z);
              if (distance < minimum) { minimum = distance; contact?.copy(this.point); }
            }
          }
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(root);
    return minimum;
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
