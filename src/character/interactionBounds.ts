import * as THREE from 'three';

interface CachedMeshBounds {
  geometry: THREE.BufferGeometry;
  version: number;
  morphs: number[];
  box: THREE.Box3;
}
interface CachedSkinVertices {
  attributes: (THREE.BufferAttribute|THREE.InterleavedBufferAttribute)[];
  versions: number[];
  morphs: number[];
  relative: boolean;
  bind: number[];
  positions: Float64Array;
  morphDeltas: Float64Array[];
  indices: Uint32Array;
  weights: Float64Array;
}
const attributeVersion=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>'version' in a?a.version:a.data.version;

/** Pickup/attack silhouette, independent of the level-authoring body collider.
 * Only the rider hierarchy participates: boards, shadows and attack VFX are
 * siblings. Hidden alternate heads and comparison meshes cannot inflate it. */
export class CharacterInteractionBounds {
  private readonly cache = new WeakMap<THREE.Mesh,CachedMeshBounds>();
  private readonly point = new THREE.Vector3();
  private readonly transformed = new THREE.Box3();
  private readonly instance = new THREE.Matrix4();
  private readonly world = new THREE.Matrix4();
  private readonly skinPalettes = new WeakMap<THREE.Skeleton,THREE.Matrix4[]>();
  private readonly skinVertices = new WeakMap<THREE.SkinnedMesh,CachedSkinVertices>();
  private readonly skinBase = new THREE.Vector3();
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
      return this.skinnedBounds(mesh);
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

  /** Same full vertex/morph/skin measurement as SkinnedMesh.computeBoundingBox.
   * Three's per-vertex getter multiplies bone world × inverse for every weight
   * of every vertex. Each bone has one transform for this pose: calculate it
   * once, then reuse it across all vertices without approximating the bounds. */
  private skinnedBounds(mesh:THREE.SkinnedMesh):THREE.Box3 {
    const skeleton=mesh.skeleton;
    skeleton.update();
    if(mesh.getVertexPosition!==THREE.SkinnedMesh.prototype.getVertexPosition){mesh.computeBoundingBox();return mesh.boundingBox!;}
    let palette=this.skinPalettes.get(skeleton);
    if(!palette){palette=[];this.skinPalettes.set(skeleton,palette);}
    let affineSkin=true;
    for(let i=0;i<skeleton.bones.length;i++){
      (palette[i]??=new THREE.Matrix4()).multiplyMatrices(skeleton.bones[i].matrixWorld,skeleton.boneInverses[i]);
      const m=palette[i].elements;
      affineSkin&&=m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1;
    }
    const geometry=mesh.geometry,positions=geometry.getAttribute('position');
    const indices=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
    const attributes=[positions,indices,weights,...(geometry.morphAttributes.position??[])];
    const morphs=mesh.morphTargetInfluences??[];
    const bind=mesh.bindMatrix.elements,linearBind=bind[3]===0&&bind[7]===0&&bind[11]===0&&bind[15]===1;
    let cached=this.skinVertices.get(mesh);
    if(!cached||attributes.length!==cached.attributes.length||attributes.some((a,i)=>a!==cached!.attributes[i]||attributeVersion(a)!==cached!.versions[i])||
      geometry.morphTargetsRelative!==cached.relative||(!linearBind&&(morphs.length!==cached.morphs.length||morphs.some((v,i)=>v!==cached!.morphs[i])))||bind.some((v,i)=>v!==cached!.bind[i])){
      cached={attributes,versions:attributes.map(attributeVersion),morphs:[...morphs],relative:geometry.morphTargetsRelative,bind:[...mesh.bindMatrix.elements],
        positions:new Float64Array(positions.count*3),morphDeltas:linearBind?(geometry.morphAttributes.position??[]).map(()=>new Float64Array(positions.count*3)):[],indices:new Uint32Array(positions.count*4),weights:new Float64Array(positions.count*4)};
      for(let i=0;i<positions.count;i++){
        // Morph and bind-space vertices only change on geometry/shape edits,
        // not when a bone moves. Keep double precision, matching Vector3.
        if(linearBind)this.skinBase.fromBufferAttribute(positions,i).applyMatrix4(mesh.bindMatrix);
        else THREE.Mesh.prototype.getVertexPosition.call(mesh,i,this.skinBase).applyMatrix4(mesh.bindMatrix);
        this.skinBase.toArray(cached.positions,i*3);
        for(let m=0;m<cached.morphDeltas.length;m++){
          const target=geometry.morphAttributes.position[m],relative=geometry.morphTargetsRelative;
          const x=target.getX(i)-(relative?0:positions.getX(i)),y=target.getY(i)-(relative?0:positions.getY(i)),z=target.getZ(i)-(relative?0:positions.getZ(i));
          const delta=cached.morphDeltas[m];delta[i*3]=bind[0]*x+bind[4]*y+bind[8]*z;delta[i*3+1]=bind[1]*x+bind[5]*y+bind[9]*z;delta[i*3+2]=bind[2]*x+bind[6]*y+bind[10]*z;
        }
        for(let c=0;c<4;c++){cached.indices[i*4+c]=indices.getComponent(i,c);cached.weights[i*4+c]=weights.getComponent(i,c);}
      }
      this.skinVertices.set(mesh,cached);
    }
    const box=mesh.boundingBox??=new THREE.Box3();box.makeEmpty();
    const base=cached.positions,skinIndices=cached.indices,skinWeights=cached.weights,inv=mesh.bindMatrixInverse.elements;
    const affineInverse=inv[3]===0&&inv[7]===0&&inv[11]===0&&inv[15]===1;
    for(let i=0;i<positions.count;i++){
      let x=base[i*3],y=base[i*3+1],z=base[i*3+2],sx=0,sy=0,sz=0;
      for(let m=0;m<cached.morphDeltas.length;m++){
        const influence=morphs[m]??0;if(influence===0)continue;
        const delta=cached.morphDeltas[m];x+=delta[i*3]*influence;y+=delta[i*3+1]*influence;z+=delta[i*3+2]*influence;
      }
      const affineVertex=affineSkin&&Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z);
      for(let c=0;c<4;c++){
        const offset=i*4+c,weight=skinWeights[offset];if(weight===0)continue;
        // Ordinary bone matrices have a homogeneous divisor of exactly one
        // for finite inputs. Preserve custom projective/invalid-data behavior.
        const m=palette[skinIndices[offset]].elements,w=affineVertex?1:1/(m[3]*x+m[7]*y+m[11]*z+m[15]);
        sx+=(m[0]*x+m[4]*y+m[8]*z+m[12])*w*weight;
        sy+=(m[1]*x+m[5]*y+m[9]*z+m[13])*w*weight;
        sz+=(m[2]*x+m[6]*y+m[10]*z+m[14])*w*weight;
      }
      const w=affineInverse&&Number.isFinite(sx)&&Number.isFinite(sy)&&Number.isFinite(sz)?1:1/(inv[3]*sx+inv[7]*sy+inv[11]*sz+inv[15]);
      const px=(inv[0]*sx+inv[4]*sy+inv[8]*sz+inv[12])*w,py=(inv[1]*sx+inv[5]*sy+inv[9]*sz+inv[13])*w,pz=(inv[2]*sx+inv[6]*sy+inv[10]*sz+inv[14])*w;
      box.min.x=Math.min(box.min.x,px);box.min.y=Math.min(box.min.y,py);box.min.z=Math.min(box.min.z,pz);
      box.max.x=Math.max(box.max.x,px);box.max.y=Math.max(box.max.y,py);box.max.z=Math.max(box.max.z,pz);
    }
    return box;
  }
}
