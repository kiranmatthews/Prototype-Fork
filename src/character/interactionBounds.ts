import * as THREE from 'three';
import { BoneEnvelopeBounds } from './boneEnvelopeBounds';
import { sharedSkinBoundsKernel, SkinBoundsKernel, type SkinBoundsVertices } from './skinBoundsKernel';
import { compactSkinBoundsVertices } from './compactSkinBounds';

interface CachedMeshBounds {
  geometry: THREE.BufferGeometry;
  attributes: (THREE.BufferAttribute|THREE.InterleavedBufferAttribute)[];
  versions: number[];
  morphs: number[];
  relative: boolean;
  vertexReader: THREE.Mesh['getVertexPosition'];
  box: THREE.Box3;
}
interface CachedSupportPoints {
  geometry: THREE.BufferGeometry;
  positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  version: number;
  points: Float64Array;
  bounds: THREE.Box3;
}
interface CachedSkinVertices extends SkinBoundsVertices {
  attributes: (THREE.BufferAttribute|THREE.InterleavedBufferAttribute)[];
  versions: number[];
  morphs: number[];
  relative: boolean;
  bind: number[];
}
const NO_MORPHS: readonly number[] = [];
const attributeVersion=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>'version' in a?a.version:a.data.version;
function hasVisibleMaterial(material: THREE.Material | THREE.Material[]): boolean {
  if (!Array.isArray(material)) return material.visible && material.opacity > 0;
  for (const entry of material) if (entry.visible && entry.opacity > 0) return true;
  return false;
}

/** Pickup/attack silhouette, independent of the level-authoring body collider.
 * Only the rider hierarchy participates: boards, shadows and attack VFX are
 * siblings. Hidden alternate heads and comparison meshes cannot inflate it. */
export class CharacterInteractionBounds {
  constructor(private readonly boundsKernel:SkinBoundsKernel|null=sharedSkinBoundsKernel) {}
  private readonly bailEnvelopes = new BoneEnvelopeBounds();
  private readonly warmedBailSkins = new WeakSet<THREE.SkinnedMesh>();
  private readonly cache = new WeakMap<THREE.Mesh,CachedMeshBounds>();
  private readonly point = new THREE.Vector3();
  private readonly transformed = new THREE.Box3();
  private readonly instance = new THREE.Matrix4();
  private readonly world = new THREE.Matrix4();
  private readonly referenceInverse = new THREE.Matrix4();
  private readonly skinPalettes = new WeakMap<THREE.Skeleton,THREE.Matrix4[]>();
  private readonly skinVertices = new WeakMap<THREE.SkinnedMesh,CachedSkinVertices>();
  private readonly skinBase = new THREE.Vector3();
  private readonly skinPoint = new THREE.Vector3();
  meshCount = 0;
  supportSamples = 0;
  private readonly supportCache = new WeakMap<THREE.BufferGeometry, Uint32Array>();
  private readonly rigidSupportCache = new WeakMap<THREE.Mesh, CachedSupportPoints>();
  private supportHint: THREE.Mesh | null = null;
  private readonly measuredSupportMeshes: THREE.Mesh[] = [];
  private measuredSupportRoot: THREE.Object3D | null = null;
  private readonly directions = Array.from({length:128},(_,i)=>{
    const y=1-2*(i+.5)/128,r=Math.sqrt(1-y*y),a=i*2.399963229728653;
    return [Math.cos(a)*r,y,Math.sin(a)*r];
  }).concat([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]);
  private readonly boneDirections = Array.from({length:32},(_,i)=>{
    const y=1-2*(i+.5)/32,r=Math.sqrt(1-y*y),a=i*2.399963229728653;
    return [Math.cos(a)*r,y,Math.sin(a)*r];
  }).concat([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]);

  /** Cache a small surface hull while the live character is already being
   * measured. Skin-weight hulls preserve bent limbs without scanning a skin
   * again during its fatal animation. Topology, not pose, owns these indices. */
  private supportIndices(geometry: THREE.BufferGeometry): Uint32Array {
    let cached=this.supportCache.get(geometry);if(cached)return cached;
    const p=geometry.getAttribute('position');
    if(!p)return new Uint32Array();
    if(p.count<=70){cached=Uint32Array.from({length:p.count},(_,i)=>i);}
    else {
      const best=new Float64Array(this.directions.length).fill(-Infinity),indices=new Uint32Array(this.directions.length);
      const skinGroups=new Map<string,{best:Float64Array;indices:Uint32Array}>();
      const skin=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        for(let d=0;d<this.directions.length;d++){
          const n=this.directions[d],v=x*n[0]+y*n[1]+z*n[2];if(v>best[d]){best[d]=v;indices[d]=i;}
        }
        if(skin&&weights){
          let group='';
          for(let c=0;c<4;c++){
            const weight=weights.getComponent(i,c);
            if(weight>0)group+=`${skin.getComponent(i,c)}:${Math.round(weight*8)};`;
          }
          let envelope=skinGroups.get(group);
          if(!envelope){envelope={best:new Float64Array(this.boneDirections.length).fill(-Infinity),indices:new Uint32Array(this.boneDirections.length)};skinGroups.set(group,envelope);}
          // A rotated thigh/hip can expose a curved clothing surface that
          // was interior to the whole bind-pose hull. Six axial endpoints
          // miss those diagonal supports. Weight bands also separate cloth
          // that follows the pelvis from cloth following a bent thigh. Cache
          // their small hulls once; posed contact still skins sparse vertices.
          for(let d=0;d<this.boneDirections.length;d++){
            const n=this.boneDirections[d],v=x*n[0]+y*n[1]+z*n[2];
            if(v>envelope.best[d]){envelope.best[d]=v;envelope.indices[d]=i;}
          }
        }
      }
      cached=Uint32Array.from(new Set([...indices,...Array.from({length:32},(_,i)=>Math.floor(i*(p.count-1)/31)),...[...skinGroups.values()].flatMap(b=>Array.from(b.indices))]));
    }
    this.supportCache.set(geometry,cached);return cached;
  }

  /** Rigid surface hulls change with geometry, not the current root
   * orientation. Cache local points and pull the query plane into that frame;
   * contact then needs dot products, not thousands of vertex reads/transforms. */
  private rigidSupportPoints(mesh: THREE.Mesh, indices: Uint32Array): CachedSupportPoints {
    const geometry = mesh.geometry, positions = geometry.getAttribute('position');
    const version = attributeVersion(positions);
    let cached = this.rigidSupportCache.get(mesh);
    if (!cached || cached.geometry !== geometry || cached.positions !== positions || cached.version !== version) {
      const points = cached?.points.length === indices.length * 3
        ? cached.points : new Float64Array(indices.length * 3);
      const bounds = cached?.bounds ?? new THREE.Box3();
      bounds.makeEmpty();
      for (let i = 0; i < indices.length; i++) {
        mesh.getVertexPosition(indices[i], this.point);
        points[i * 3] = this.point.x;points[i * 3 + 1] = this.point.y;points[i * 3 + 2] = this.point.z;
        bounds.expandByPoint(this.point);
      }
      cached = { geometry, positions, version, points, bounds };
      this.rigidSupportCache.set(mesh, cached);
    }
    return cached!;
  }

  /** Sparse kinematic pose support for a death or intact supported bail.
   * Caller updates world/bind matrices once; live pickup/attack bounds retain
   * their complete mesh measurement. No world collision or CPU full-skin scan. */
  sampledPlaneDistance(root: THREE.Object3D, normal: Readonly<THREE.Vector3>, point: Readonly<THREE.Vector3>, contact?: THREE.Vector3, bounds?: THREE.Box3, measured = false): number {
    let minimum=Infinity;this.supportSamples=0;bounds?.makeEmpty();
    let nearest: THREE.Mesh | null = null;
    // The last supporting glove, shoe or shoulder is a useful first bound.
    // Re-evaluate its current pose, never its old distance, then prune higher
    // meshes as usual. Point/bounds callers keep original traversal tie order.
    let hint = !contact && !bounds ? this.supportHint : null;
    if (hint) {
      let ancestor: THREE.Object3D | null = hint;
      while (ancestor && ancestor !== root && ancestor.visible) ancestor = ancestor.parent;
      if (ancestor !== root) hint = null;
    }
    const sampleMesh=(node:THREE.Mesh):void=>{
        if(hasVisibleMaterial(node.material)){
          const indices=this.supportIndices(node.geometry),count=node instanceof THREE.InstancedMesh?node.count:1;
          for(let instance=0;instance<count;instance++){
            this.world.copy(node.matrixWorld);
            if(node instanceof THREE.InstancedMesh){node.getMatrixAt(instance,this.instance);this.world.multiply(this.instance);}
            const measuredBox = !bounds && measured ? node instanceof THREE.SkinnedMesh
              ? node.boundingBox : node.getVertexPosition === THREE.Mesh.prototype.getVertexPosition
                ? this.cache.get(node)?.box : null : null;
            if (measuredBox) {
              // The immediately preceding bounds pass measured this pose.
              // Its local box includes the current morph/skin pose, so
              // reject higher sections before probing them again. This also
              // avoids resampling each stretched shaft above the contact.
              const m = this.world.elements, box = measuredBox;
              if (m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1) {
                const nx = normal.x*m[0]+normal.y*m[1]+normal.z*m[2];
                const ny = normal.x*m[4]+normal.y*m[5]+normal.z*m[6];
                const nz = normal.x*m[8]+normal.y*m[9]+normal.z*m[10];
                const bound = nx*(nx>=0?box.min.x:box.max.x)+ny*(ny>=0?box.min.y:box.max.y)+
                  nz*(nz>=0?box.min.z:box.max.z)+normal.x*(m[12]-point.x)+normal.y*(m[13]-point.y)+normal.z*(m[14]-point.z);
                if (bound >= minimum) continue;
              }
            }
            if (!bounds && !(node instanceof THREE.SkinnedMesh) &&
              !(node.geometry.morphAttributes.position?.length) &&
              this.world.elements[3] === 0 && this.world.elements[7] === 0 &&
              this.world.elements[11] === 0 && this.world.elements[15] === 1 &&
              node.getVertexPosition === THREE.Mesh.prototype.getVertexPosition) {
              const hull = this.rigidSupportPoints(node, indices), m = this.world.elements;
              const nx = normal.x * m[0] + normal.y * m[1] + normal.z * m[2];
              const ny = normal.x * m[4] + normal.y * m[5] + normal.z * m[6];
              const nz = normal.x * m[8] + normal.y * m[9] + normal.z * m[10];
              const offset = normal.x * (m[12] - point.x) + normal.y * (m[13] - point.y) + normal.z * (m[14] - point.z);
              // An AABB encloses every cached hull sample. If even its
              // nearest possible plane distance cannot beat the current
              // contact, all of this mesh's point dots are provably needless.
              const lo = hull.bounds.min, hi = hull.bounds.max;
              const bound = nx * (nx >= 0 ? lo.x : hi.x) + ny * (ny >= 0 ? lo.y : hi.y) +
                nz * (nz >= 0 ? lo.z : hi.z) + offset;
              if (bound >= minimum) continue;
              const points = hull.points;
              let localMinimum = Infinity, best = 0;
              for (let i = 0; i < points.length; i += 3) {
                const distance = nx * points[i] + ny * points[i + 1] + nz * points[i + 2];
                if (distance < localMinimum) { localMinimum = distance; best = i; }
              }
              this.supportSamples += indices.length;
              const distance = localMinimum + offset;
              if (distance < minimum) {
                minimum = distance; nearest = node;
                if (contact) contact.set(points[best], points[best + 1], points[best + 2]).applyMatrix4(this.world);
              }
              continue;
            }
            // A sparse contact hull still used Three's full bone world ×
            // inverse multiplication for every weight of every sample. These
            // matrices are constant within this query. Reuse the existing
            // exact-bounds palette storage, refreshing from the live bones.
            const skin = node instanceof THREE.SkinnedMesh &&
              node.getVertexPosition === THREE.SkinnedMesh.prototype.getVertexPosition &&
              node.applyBoneTransform === THREE.SkinnedMesh.prototype.applyBoneTransform &&
              indices.length >= node.skeleton.bones.length ? node : null;
            let palette: THREE.Matrix4[] | null = null;
            if (skin) {
              const skeleton = skin.skeleton;
              palette = this.skinPalettes.get(skeleton) ?? null;
              if (!palette) { palette = []; this.skinPalettes.set(skeleton, palette); }
              palette.length = skeleton.bones.length;
              for (let bone = 0; bone < skeleton.bones.length; bone++) {
                // Preserve native behavior for unusual/incomplete skeletons,
                // including unused absent bones that a sparse hull skips.
                if (!skeleton.bones[bone]?.matrixWorld || !skeleton.boneInverses[bone]) { palette = null; break; }
                (palette[bone] ??= new THREE.Matrix4()).multiplyMatrices(skeleton.bones[bone].matrixWorld, skeleton.boneInverses[bone]);
              }
            }
            for(const i of indices){
              if (skin && palette) {
                THREE.Mesh.prototype.getVertexPosition.call(skin, i, this.skinBase).applyMatrix4(skin.bindMatrix);
                this.point.set(0, 0, 0);
                const weights = skin.geometry.attributes.skinWeight, bones = skin.geometry.attributes.skinIndex;
                for (let channel = 0; channel < 4; channel++) {
                  const weight = weights.getComponent(i, channel);
                  if (weight !== 0) this.point.addScaledVector(this.skinPoint.copy(this.skinBase)
                    .applyMatrix4(palette[bones.getComponent(i, channel)]), weight);
                }
                this.point.applyMatrix4(skin.bindMatrixInverse);
              } else node.getVertexPosition(i, this.point);
              this.point.applyMatrix4(this.world);this.supportSamples++;bounds?.expandByPoint(this.point);
              const distance=normal.x*(this.point.x-point.x)+normal.y*(this.point.y-point.y)+normal.z*(this.point.z-point.z);
              if(distance<minimum){minimum=distance;nearest=node;contact?.copy(this.point);}
            }
          }
        }
    };
    if (hint) sampleMesh(hint);
    const visit=(node:THREE.Object3D):void=>{
      if(node!==root&&!node.visible)return;
      if(node instanceof THREE.Mesh && node !== hint) sampleMesh(node);
      for(const child of node.children)visit(child);
    };
    if (measured && this.measuredSupportRoot === root) {
      // The immediately preceding bounds pass already resolved the
      // visible hierarchy. Reuse that ordered mesh list instead of walking
      // hundreds of bones/sockets a second time. Unmeasured queries still
      // discover current visibility, additions and removals normally.
      for (const mesh of this.measuredSupportMeshes) if (mesh !== hint) sampleMesh(mesh);
    } else visit(root);
    this.supportHint=nearest;return minimum;
  }

  private transformBounds(box: THREE.Box3, matrix: THREE.Matrix4): THREE.Box3 {
    const m = matrix.elements;
    if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1)
      return this.transformed.copy(box).applyMatrix4(matrix);
    const a = box.min, b = box.max;
    // The extrema of each affine axis choose each local interval endpoint
    // independently. This is the exact transformed box, with no hull/proxy
    // approximation, using 18 products instead of eight transformed corners.
    this.transformed.min.set(
      m[12] + m[0] * (m[0] >= 0 ? a.x : b.x) + m[4] * (m[4] >= 0 ? a.y : b.y) + m[8] * (m[8] >= 0 ? a.z : b.z),
      m[13] + m[1] * (m[1] >= 0 ? a.x : b.x) + m[5] * (m[5] >= 0 ? a.y : b.y) + m[9] * (m[9] >= 0 ? a.z : b.z),
      m[14] + m[2] * (m[2] >= 0 ? a.x : b.x) + m[6] * (m[6] >= 0 ? a.y : b.y) + m[10] * (m[10] >= 0 ? a.z : b.z),
    );
    this.transformed.max.set(
      m[12] + m[0] * (m[0] >= 0 ? b.x : a.x) + m[4] * (m[4] >= 0 ? b.y : a.y) + m[8] * (m[8] >= 0 ? b.z : a.z),
      m[13] + m[1] * (m[1] >= 0 ? b.x : a.x) + m[5] * (m[5] >= 0 ? b.y : a.y) + m[9] * (m[9] >= 0 ? b.z : a.z),
      m[14] + m[2] * (m[2] >= 0 ? b.x : a.x) + m[6] * (m[6] >= 0 ? b.y : a.y) + m[10] * (m[10] >= 0 ? b.z : a.z),
    );
    return this.transformed;
  }

  measure(root: THREE.Object3D, out: THREE.Box3, worldMatricesReady = false, intactBail = false, collectSupport = intactBail): boolean {
    if (!worldMatricesReady) {
      root.updateWorldMatrix(true,true);
      if (intactBail) root.updateMatrixWorld(true);
    }
    out.makeEmpty();this.meshCount=0;
    // An exact live silhouette can share its visible mesh list with the
    // immediately following support query too. This does not enable envelopes
    // after control returns; bounds accuracy and hierarchy reuse are separate.
    this.measuredSupportRoot = collectSupport ? root : null;
    let supportCount = 0;
    const visit=(node:THREE.Object3D):void=>{
      // The root may be hidden by a temporary presentation effect. Visibility
      // below it still selects the actual current head, outfit and limbs.
      if(node!==root&&!node.visible)return;
      if(node instanceof THREE.Mesh){
        if(hasVisibleMaterial(node.material)){
          if (collectSupport) this.measuredSupportMeshes[supportCount++] = node;
          this.supportIndices(node.geometry);
          const box=intactBail && node instanceof THREE.SkinnedMesh
            ? this.bailEnvelopes.measure(node) ?? this.localBounds(node) : this.localBounds(node);
          if(box&&!box.isEmpty()){
            if(node instanceof THREE.InstancedMesh){
              for(let i=0;i<node.count;i++){
                node.getMatrixAt(i,this.instance);this.world.multiplyMatrices(node.matrixWorld,this.instance);
                out.union(this.transformBounds(box,this.world));
              }
            }else out.union(this.transformBounds(box,node.matrixWorld));
            this.meshCount++;
          }
        }
      }
      for(const child of node.children)visit(child);
    };
    visit(root);
    this.measuredSupportMeshes.length = supportCount;
    return !out.isEmpty() && Number.isFinite(out.min.x) && Number.isFinite(out.min.y) &&
      Number.isFinite(out.min.z) && Number.isFinite(out.max.x) && Number.isFinite(out.max.y) && Number.isFinite(out.max.z);
  }

  /** Rare presentation snapshot in a moving local frame. Read posed vertices:
   * rotated mesh-box corners overestimate the height of a crouched/tilted head.
   * Keep the cached world-box path above for ordinary per-tick interactions. */
  measureRelative(root: THREE.Object3D, reference: THREE.Object3D, out: THREE.Box3): boolean {
    root.updateWorldMatrix(true, true);
    // Attached skins refresh their bind inverse here, not in updateWorldMatrix.
    root.updateMatrixWorld(true);
    this.referenceInverse.copy(reference.matrixWorld).invert();
    out.makeEmpty();
    const visit = (node: THREE.Object3D): void => {
      if (node !== root && !node.visible) return;
      if (node instanceof THREE.Mesh && !node.userData.characterRenderProxy && hasVisibleMaterial(node.material)) {
        const positions = node.geometry.getAttribute('position');
        if (positions) {
          if (node instanceof THREE.SkinnedMesh) node.skeleton.update();
          const count = node instanceof THREE.InstancedMesh ? node.count : 1;
          for (let i = 0; i < count; i++) {
            this.world.multiplyMatrices(this.referenceInverse, node.matrixWorld);
            if (node instanceof THREE.InstancedMesh) {
              node.getMatrixAt(i, this.instance); this.world.multiply(this.instance);
            }
            for (let v = 0; v < positions.count; v++)
              out.expandByPoint(node.getVertexPosition(v, this.point).applyMatrix4(this.world));
          }
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(root);
    return !out.isEmpty() && [...out.min.toArray(), ...out.max.toArray()].every(Number.isFinite);
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
    const morphs=mesh.morphTargetInfluences??NO_MORPHS;
    const targets=geometry.morphAttributes.position;
    const nativeVertex=mesh.getVertexPosition===THREE.Mesh.prototype.getVertexPosition;
    let cached=this.cache.get(mesh);
    let stale=!nativeVertex||!cached||cached.vertexReader!==mesh.getVertexPosition||
      cached.geometry!==geometry||cached.relative!==geometry.morphTargetsRelative||
      cached.attributes.length!==1+(targets?.length??0)||cached.morphs.length!==morphs.length;
    if(cached&&!stale){
      for(let i=0;i<cached.attributes.length;i++){
        const attribute=i===0?positions:targets![i-1];
        if(attribute!==cached.attributes[i]||attributeVersion(attribute)!==cached.versions[i]){stale=true;break;}
      }
      for(let i=0;!stale&&i<morphs.length;i++)if(morphs[i]!==cached.morphs[i])stale=true;
    }
    if(stale){
      if(!cached){
        cached={geometry,attributes:[],versions:[],morphs:[],relative:geometry.morphTargetsRelative,
          vertexReader:mesh.getVertexPosition,box:new THREE.Box3()};
        this.cache.set(mesh,cached);
      }
      const box=cached.box;box.makeEmpty();
      // BufferGeometry.computeBoundingBox unions every morph target, even
      // inactive ones. Read only the currently applied shape instead.
      if(nativeVertex){
        // Match Mesh.getVertexPosition's arithmetic, including normalized and
        // interleaved attribute getters, but keep the vertex and extrema in
        // scalars. Animated shafts need this full measurement every pose;
        // publishing two vectors once avoids mutating scratch vectors for
        // every vertex and every morph contribution.
        let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
        const relative=geometry.morphTargetsRelative,blend=targets&&mesh.morphTargetInfluences;
        for(let i=0;i<positions.count;i++){
          const px=positions.getX(i),py=positions.getY(i),pz=positions.getZ(i);
          let x=px,y=py,z=pz;
          if(blend){
            let dx=0,dy=0,dz=0;
            for(let m=0;m<targets!.length;m++){
              const influence=blend[m];if(influence===0)continue;
              const target=targets![m],tx=target.getX(i),ty=target.getY(i),tz=target.getZ(i);
              dx+=(relative?tx:tx-px)*influence;
              dy+=(relative?ty:ty-py)*influence;
              dz+=(relative?tz:tz-pz)*influence;
            }
            x+=dx;y+=dy;z+=dz;
          }
          minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);
          maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);
        }
        box.min.set(minX,minY,minZ);box.max.set(maxX,maxY,maxZ);
      }else for(let i=0;i<positions.count;i++)box.expandByPoint(mesh.getVertexPosition(i,this.point));
      // Fresh bounds are also used to reject support work. Attribute swaps,
      // morph edits and relative/absolute target changes must invalidate them,
      // even when the new attribute has the same version as the old one.
      cached.geometry=geometry;cached.relative=geometry.morphTargetsRelative;cached.vertexReader=mesh.getVertexPosition;
      cached.attributes.length=cached.versions.length=1+(targets?.length??0);
      for(let i=0;i<cached.attributes.length;i++){
        const attribute=i===0?positions:targets![i-1];
        cached.attributes[i]=attribute;cached.versions[i]=attributeVersion(attribute);
      }
      cached.morphs.length=morphs.length;
      for(let i=0;i<morphs.length;i++)cached.morphs[i]=morphs[i];
    }
    return cached!.box;
  }

  /** Same full vertex/morph/skin measurement as SkinnedMesh.computeBoundingBox.
   * Three's per-vertex getter multiplies bone world × inverse for every weight
   * of every vertex. Each bone has one transform for this pose: calculate it
   * once, then reuse it across all vertices without approximating the bounds. */
  private skinnedBounds(mesh:THREE.SkinnedMesh):THREE.Box3 {
    // Pay the topology cache cost with the character's first normal bounds
    // measurement, never on the first crash frame. Later shape edits still
    // invalidate the envelope through attribute versions and bind transforms.
    if (!this.warmedBailSkins.has(mesh)) {
      this.bailEnvelopes.measure(mesh);
      this.warmedBailSkins.add(mesh);
    }
    const skeleton=mesh.skeleton;
    skeleton.update();
    if(mesh.getVertexPosition!==THREE.SkinnedMesh.prototype.getVertexPosition){mesh.computeBoundingBox();return mesh.boundingBox!;}
    let palette=this.skinPalettes.get(skeleton);
    if(!palette){palette=[];this.skinPalettes.set(skeleton,palette);}
    let affineSkin=true,constantSkin=true;
    for(let i=0;i<skeleton.bones.length;i++){
      (palette[i]??=new THREE.Matrix4()).multiplyMatrices(skeleton.bones[i].matrixWorld,skeleton.boneInverses[i]);
      const m=palette[i].elements;
      affineSkin&&=m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1;
      constantSkin&&=m[3]===0&&m[7]===0&&m[11]===0&&m[15]!==0;
    }
    const geometry=mesh.geometry,positions=geometry.getAttribute('position');
    const indices=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
    const targets=geometry.morphAttributes.position;
    const attributeCount=3+(targets?.length??0);
    const morphs=mesh.morphTargetInfluences??NO_MORPHS;
    const bind=mesh.bindMatrix.elements,linearBind=bind[3]===0&&bind[7]===0&&bind[11]===0&&bind[15]===1;
    let cached=this.skinVertices.get(mesh);
    let stale=!cached||attributeCount!==cached.attributes.length||geometry.morphTargetsRelative!==cached.relative||
      (!linearBind&&morphs.length!==cached.morphs.length);
    // Geometry and bind-space input usually survive thousands of poses.
    // Compare the live sources directly instead of allocating an attribute
    // array and predicate closures for every exact skin measurement.
    if(cached&&!stale){
      for(let i=0;i<attributeCount;i++){
        const attribute=i===0?positions:i===1?indices:i===2?weights:targets![i-3];
        if(attribute!==cached.attributes[i]||attributeVersion(attribute)!==cached.versions[i]){stale=true;break;}
      }
      for(let i=0;!stale&&i<16;i++)if(bind[i]!==cached.bind[i])stale=true;
      if(!linearBind)for(let i=0;!stale&&i<morphs.length;i++)if(morphs[i]!==cached.morphs[i])stale=true;
    }
    if(!cached||stale){
      const attributes=[positions,indices,weights,...(targets??[])];
      cached={attributes,versions:attributes.map(attributeVersion),morphs:[...morphs],relative:geometry.morphTargetsRelative,bind:[...mesh.bindMatrix.elements],
        positions:new Float64Array(positions.count*3),morphDeltas:linearBind?(geometry.morphAttributes.position??[]).map(()=>new Float64Array(positions.count*3)):[],indices:new Uint32Array(positions.count*4),weights:new Float64Array(positions.count*4),kernelInputsFinite:true,highestWeightedIndex:-1};
      for(let i=0;i<positions.count;i++){
        // Morph and bind-space vertices only change on geometry/shape edits,
        // not when a bone moves. Keep double precision, matching Vector3.
        if(linearBind)this.skinBase.fromBufferAttribute(positions,i).applyMatrix4(mesh.bindMatrix);
        else THREE.Mesh.prototype.getVertexPosition.call(mesh,i,this.skinBase).applyMatrix4(mesh.bindMatrix);
        this.skinBase.toArray(cached.positions,i*3);
        cached.kernelInputsFinite&&=Number.isFinite(this.skinBase.x)&&Number.isFinite(this.skinBase.y)&&Number.isFinite(this.skinBase.z);
        for(let m=0;m<cached.morphDeltas.length;m++){
          const target=geometry.morphAttributes.position[m],relative=geometry.morphTargetsRelative;
          const x=target.getX(i)-(relative?0:positions.getX(i)),y=target.getY(i)-(relative?0:positions.getY(i)),z=target.getZ(i)-(relative?0:positions.getZ(i));
          const delta=cached.morphDeltas[m];delta[i*3]=bind[0]*x+bind[4]*y+bind[8]*z;delta[i*3+1]=bind[1]*x+bind[5]*y+bind[9]*z;delta[i*3+2]=bind[2]*x+bind[6]*y+bind[10]*z;
          cached.kernelInputsFinite&&=Number.isFinite(delta[i*3])&&Number.isFinite(delta[i*3+1])&&Number.isFinite(delta[i*3+2]);
        }
        for(let c=0;c<4;c++){
          const offset=i*4+c;cached.indices[offset]=indices.getComponent(i,c);cached.weights[offset]=weights.getComponent(i,c);
          cached.kernelInputsFinite&&=Number.isFinite(cached.weights[offset]);
          if(cached.weights[offset]!==0)cached.highestWeightedIndex=Math.max(cached.highestWeightedIndex,cached.indices[offset]);
        }
      }
      compactSkinBoundsVertices(cached);
      this.skinVertices.set(mesh,cached);
    }
    const box=mesh.boundingBox??=new THREE.Box3();box.makeEmpty();
    const base=cached.positions,skinIndices=cached.indices,skinWeights=cached.weights,inv=mesh.bindMatrixInverse.elements;
    const affineInverse=inv[3]===0&&inv[7]===0&&inv[11]===0&&inv[15]===1;
    const constantInverse=inv[3]===0&&inv[7]===0&&inv[11]===0&&inv[15]!==0;
    // Derived arrays are immutable: every source/version/bind edit above
    // replaces the entire bundle, including its native residency identity.
    if(this.boundsKernel?.measure(cached,morphs,palette,inv,box,linearBind&&constantSkin&&constantInverse,true))return box;
    for(let i=0;i<base.length/3;i++){
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
