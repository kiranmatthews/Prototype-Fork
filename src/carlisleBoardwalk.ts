import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import { sceneryLoads } from './assetLoadQueue';

export type DeckTriangle = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
type Kit='solid-timber'|'broad-deck';
type Request = { triangles: DeckTriangle[]; direction: THREE.Vector3; parent: THREE.Object3D;kind:Kit };
const EPS = 1e-7;
const cache = new AssetCache<Kit, GLTF>(async (key, _dependency, wanted) => {
  const gltf = await sceneryLoads.run(() => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(
    `${import.meta.env.BASE_URL}props/carlisle-decks/${key}-joined.glb`), wanted);
  gltf.scene.traverse(n => {
    const mesh = n as THREE.Mesh; if (!mesh.isMesh) return;
    mesh.geometry.userData.shared = true;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.userData.shared = true;
      for (const texture of Object.values(material)) if (texture?.isTexture) {
        texture.userData.shared = true; texture.anisotropy = 8;
      }
    }
  });return gltf;
}, gltf => {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  gltf.scene.traverse(n => { const m = n as THREE.Mesh; if (!m.isMesh) return;
    geometries.add(m.geometry); for (const a of Array.isArray(m.material) ? m.material : [m.material]) materials.add(a); });
  for (const m of materials) { for (const t of Object.values(m)) if (t?.isTexture) textures.add(t); m.dispose(); }
  geometries.forEach(g => g.dispose());disposeTextures(textures);
});

export function deckHeight(triangles: DeckTriangle[], x: number, z: number) {
  for (const [a, b, c] of triangles) {
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    if (u >= -EPS && v >= -EPS && u + v <= 1 + EPS) return a.y * u + b.y * v + c.y * (1 - u - v);
  }return NaN;
}

export function carlisleDeckBoundary(triangles: DeckTriangle[]) {
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; count: number }>();
  const key = (p: THREE.Vector3) => p.toArray().map(n => n.toFixed(4)).join(',');
  for (const t of triangles) for (let i = 0; i < 3; i++) {
    const a = t[i], b = t[(i + 1) % 3], ka = key(a), kb = key(b), k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    const e = edges.get(k);if (e) e.count++;else edges.set(k, { a, b, count: 1 });
  }
  // Berth subtraction leaves T-junctions, which are not outside deck edges.
  return [...edges.values()].filter(e => {
    if (e.count !== 1) return false;
    const mid = e.a.clone().add(e.b).multiplyScalar(.5), d = e.b.clone().sub(e.a);
    const n = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(.001);
    return !Number.isFinite(deckHeight(triangles, mid.x + n.x, mid.z + n.z)) ||
      !Number.isFinite(deckHeight(triangles, mid.x - n.x, mid.z - n.z));
  });
}

/** Bend whole generated planes to the route and cut at the original support
 * triangles. No LOD/decimation, new collision, friction or grinding policy. */
export function fitCarlisleDeck(source: THREE.BufferGeometry, triangles: DeckTriangle[], direction: THREE.Vector3, intact?: (matrix:THREE.Matrix4)=>void) {
  const forward = direction.clone().setY(0).normalize(), right = new THREE.Vector3(forward.z, 0, -forward.x), origin = triangles[0][0].clone();
  const local = triangles.map(t => t.map(p => { const d = p.clone().sub(origin);return new THREE.Vector3(d.dot(right), d.y, d.dot(forward)); }) as DeckTriangle)
    .filter(t=>Math.abs((t[1].x-t[0].x)*(t[2].z-t[0].z)-(t[1].z-t[0].z)*(t[2].x-t[0].x))>1e-8);
  const points = local.flat(), lo = Math.min(...points.map(p => p.z)), hi = Math.max(...points.map(p => p.z));
  source.computeBoundingBox();const bounds = source.boundingBox!, size = bounds.getSize(new THREE.Vector3());
  // One physical scale in all three axes. Wide docks receive adjacent solid
  // modules, never widened planks; short ends are trimmed, never compressed.
  const scale=(source.userData.moduleLength??12)/size.x,length=size.x*scale,width=size.z*scale;
  const left=Math.min(...points.map(p=>p.x)),rightEdge=Math.max(...points.map(p=>p.x));
  const count=Math.max(1,Math.ceil((hi-lo-1e-4)/length)),columns=Math.max(1,Math.ceil((rightEdge-left-1e-4)/width));
  if(source.userData.deckTop===undefined){
    const position=source.getAttribute('position'),normal=source.getAttribute('normal'),heights:number[]=[];
    for(let i=0;i<position.count;i++)if(normal.getY(i)>.7&&position.getY(i)>bounds.min.y+size.y*.5)heights.push(position.getY(i));
    heights.sort((a,b)=>a-b);source.userData.deckTop=heights[Math.floor(heights.length*.7)];
  }
  const top=source.userData.deckTop as number;
  const flat=points.every(p=>Math.abs(p.y-points[0].y)<1e-5);
  const sp = source.getAttribute('position'), sn = source.getAttribute('normal'), su = source.getAttribute('uv'), si = source.index!;
  const profile = (z: number):{left:{x:number;y:number};right:{x:number;y:number}} => {
    z = THREE.MathUtils.clamp(z, lo + 1e-5, hi - 1e-5);const cuts: { x: number; y: number }[] = [];
    for (const t of local) for (let i = 0; i < 3; i++) {
      const a = t[i], b = t[(i + 1) % 3];
      if (a.z <= z && b.z > z || b.z <= z && a.z > z) {
        const u = (z - a.z) / (b.z - a.z);cuts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
      }
    }
    if(!cuts.length){
      // A berth may sever an entire strip. Sample the nearest supported shore;
      // the empty interval will be removed by the footprint clipping below.
      const nearest=local.map(t=>THREE.MathUtils.clamp(z,Math.min(...t.map(p=>p.z))+1e-6,Math.max(...t.map(p=>p.z))-1e-6))
        .sort((a,b)=>Math.abs(a-z)-Math.abs(b-z))[0];
      return profile(nearest);
    }
    cuts.sort((a, b) => a.x - b.x);return { left: cuts[0], right: cuts[cuts.length - 1] };
  };
  // Follow the complete outer envelope; exact cuts below remove the net berths.
  const stations = [...new Set([lo, hi, ...points.map(p => p.z)])].sort((a, b) => a - b), profiles = stations.map(profile);
  const at = (z: number) => {
    let a = 0, b = stations.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1;if (stations[m] <= z) a = m;else b = m; }
    const t = THREE.MathUtils.clamp((z - stations[a]) / (stations[b] - stations[a]), 0, 1), p = profiles[a], q = profiles[b];
    return { lx: THREE.MathUtils.lerp(p.left.x, q.left.x, t), rx: THREE.MathUtils.lerp(p.right.x, q.right.x, t),
      ly: THREE.MathUtils.lerp(p.left.y, q.left.y, t), ry: THREE.MathUtils.lerp(p.right.y, q.right.y, t) };
  };
  const grid = new Map<string, number[]>(), cell = 3;
  local.forEach((t, i) => {
    for (let x = Math.floor(Math.min(...t.map(p => p.x)) / cell);x <= Math.floor(Math.max(...t.map(p => p.x)) / cell);x++)
      for (let z = Math.floor(Math.min(...t.map(p => p.z)) / cell);z <= Math.floor(Math.max(...t.map(p => p.z)) / cell);z++) {
        const key = x + ':' + z, list = grid.get(key) ?? [];list.push(i);grid.set(key, list);
      }
  });
  const planes = local.map(t => {
    const sign = Math.sign((t[1].x - t[0].x) * (t[2].z - t[0].z) - (t[1].z - t[0].z) * (t[2].x - t[0].x));
    return t.map((a, i) => { const b = t[(i + 1) % 3], length=Math.hypot(b.x-a.x,b.z-a.z),x = -(b.z - a.z) * sign/length, z = (b.x - a.x) * sign/length;return { x, z, c: -x * a.x - z * a.z }; });
  });
  const boundary=carlisleDeckBoundary(local).map(({a,b})=>({minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minZ:Math.min(a.z,b.z),maxZ:Math.max(a.z,b.z)}));
  const touches=(minX:number,maxX:number,minZ:number,maxZ:number)=>boundary.some(e=>e.minX<=maxX+EPS&&e.maxX>=minX-EPS&&e.minZ<=maxZ+EPS&&e.maxZ>=minZ-EPS);
  const result: THREE.BufferGeometry[] = [];
  for (let segment = 0;segment < count;segment++) for(let column=0;column<columns;column++) {
    const start = lo + segment * length, positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = [];
    const acrossStart=left+column*width;
    if(!local.some(t=>Math.max(...t.map(p=>p.x))>=acrossStart&&Math.min(...t.map(p=>p.x))<=acrossStart+width&&Math.max(...t.map(p=>p.z))>=start&&Math.min(...t.map(p=>p.z))<=start+length))continue;
    if(flat&&(source.userData.wholeModules||!touches(acrossStart,acrossStart+width,start,start+length)&&Number.isFinite(deckHeight(local,acrossStart+width/2,start+length/2)))){
      const x=acrossStart+bounds.max.z*scale,z=start-bounds.min.x*scale;
      const transform=new THREE.Matrix4().makeBasis(forward.clone().multiplyScalar(scale),new THREE.Vector3(0,scale,0),right.clone().multiplyScalar(-scale));
      transform.setPosition(origin.clone().addScaledVector(right,x).addScaledVector(forward,z).add(new THREE.Vector3(0,points[0].y-top*scale,0)));
      if(intact)intact(transform);else result.push(source.clone().applyMatrix4(transform));continue;
    }
    const normal = new THREE.Vector3(), matrix = new THREE.Matrix4(), nm = new THREE.Matrix3();
    for (let i = 0;i < sp.count;i++) {
      const z=start+(sp.getX(i)-bounds.min.x)*scale,x=acrossStart+(bounds.max.z-sp.getZ(i))*scale;
      const p=at(z),u=(x-p.lx)/Math.max(1e-6,p.rx-p.lx),height=p.ly+u*(p.ry-p.ly);
      positions.push(x,height+(sp.getY(i)-top)*scale,z);
      const next = at(Math.min(hi, z + .01)), prev = at(Math.max(lo, z - .01)), dz = Math.max(1e-5, Math.min(hi, z + .01) - Math.max(lo, z - .01));
      const nh=next.ly+(x-next.lx)/Math.max(1e-6,next.rx-next.lx)*(next.ry-next.ly),ph=prev.ly+(x-prev.lx)/Math.max(1e-6,prev.rx-prev.lx)*(prev.ry-prev.ly);
      const dy=(nh-ph)/dz,slopeX=(p.ry-p.ly)/Math.max(1e-6,p.rx-p.lx);
      matrix.set(0,0,-scale,0,dy*scale,scale,-scale*slopeX,0,scale,0,0,0,0,0,0,1);
      nm.getNormalMatrix(matrix);normal.fromBufferAttribute(sn, i).applyMatrix3(nm).normalize();
      normals.push(normal.x, normal.y, normal.z);uv.push(su.getX(i), su.getY(i));
    }
    const distance = (i: number, plane: { x: number; z: number; c: number }) => plane.x * positions[i * 3] + plane.z * positions[i * 3 + 2] + plane.c;
    const interpolate = (a: number, b: number, t: number) => {
      if (t < 1e-8) return a;if (t > 1 - 1e-8) return b;const id = positions.length / 3;
      for (let k = 0;k < 3;k++) { positions.push(THREE.MathUtils.lerp(positions[a * 3 + k], positions[b * 3 + k], t));normals.push(THREE.MathUtils.lerp(normals[a * 3 + k], normals[b * 3 + k], t)); }
      for (let k = 0;k < 2;k++) uv.push(THREE.MathUtils.lerp(uv[a * 2 + k], uv[b * 2 + k], t));return id;
    };
    for (let i = 0;i < si.count;i += 3) {
      const original = [si.getX(i), si.getX(i + 1), si.getX(i + 2)], candidates = new Set<number>();
      for (let x = Math.floor(Math.min(...original.map(v => positions[v * 3])) / cell);x <= Math.floor(Math.max(...original.map(v => positions[v * 3])) / cell);x++)
        for (let z = Math.floor(Math.min(...original.map(v => positions[v * 3 + 2])) / cell);z <= Math.floor(Math.max(...original.map(v => positions[v * 3 + 2])) / cell);z++)
          for (const t of grid.get(x + ':' + z) ?? []) candidates.add(t);
      // Internal contact tessellation must not re-tessellate the sculpt. Only
      // triangles close to the actual outside boundary need clipping.
      const minX=Math.min(...original.map(v=>positions[v*3])),maxX=Math.max(...original.map(v=>positions[v*3]));
      const minZ=Math.min(...original.map(v=>positions[v*3+2])),maxZ=Math.max(...original.map(v=>positions[v*3+2]));
      if(!touches(minX,maxX,minZ,maxZ)&&original.every(v=>[...candidates].some(t=>planes[t].every(p=>distance(v,p)>=-EPS)))){indices.push(...original);continue;}
      if ([...candidates].some(t => original.every(v => planes[t].every(p => distance(v, p) >= -EPS)))) { indices.push(...original);continue; }
      for (const t of candidates) {
        let polygon = original;
        for (const plane of planes[t]) {
          const next: number[] = [];
          for (let j = 0;j < polygon.length;j++) {
            const a = polygon[j], b = polygon[(j + 1) % polygon.length], da = distance(a, plane), db = distance(b, plane);
            if (da >= -EPS) next.push(a);
            if (da > EPS && db < -EPS || da < -EPS && db > EPS) next.push(interpolate(a, b, da / (da - db)));
          }
          polygon = next;if (!polygon.length) break;
        }
        for (let j = 1;j + 1 < polygon.length;j++) indices.push(polygon[0], polygon[j], polygon[j + 1]);
      }
    }
    const compact = new Map<number, number>(), outP: number[] = [], outN: number[] = [], outUV: number[] = [], outIndex: number[] = [];
    for (const i of indices) {
      let mapped = compact.get(i);
      if (mapped === undefined) {
        mapped = compact.size;compact.set(i, mapped);
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
        outP.push(origin.x + right.x * x + forward.x * z, origin.y + y, origin.z + right.z * x + forward.z * z);
        normal.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).normalize();
        outN.push(right.x * normal.x + forward.x * normal.z, normal.y, right.z * normal.x + forward.z * normal.z);
        outUV.push(uv[i * 2], uv[i * 2 + 1]);
      }outIndex.push(mapped);
    }
    if (!outIndex.length) continue;
    const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outN, 3));geometry.setAttribute('uv', new THREE.Float32BufferAttribute(outUV, 2));geometry.setIndex(outIndex);
    geometry.computeBoundingSphere();geometry.computeBoundingBox();result.push(geometry);
  }return result;
}

export class CarlisleBoardwalk {
  readonly diagnostics = { decks: 0, sections: 0, intactModules:0, instanceBatches:0, sourceTriangles: 0, sceneryTriangles:0, fittedTriangles: 0, slipperyOverlays:0,errors: [] as string[] };
  private readonly assets = cache.scope();
  private readonly requests: Request[] = [];
  private readonly nodes: THREE.Mesh[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;
  add(triangles: DeckTriangle[], direction: THREE.Vector3, parent: THREE.Object3D,scenery=false) {
    this.requests.push({ triangles, direction,parent,kind:scenery?'broad-deck':'solid-timber' });this.diagnostics.decks++;
  }
  async load() {
    const kinds:Kit[]=['solid-timber','broad-deck'],gltfs=await Promise.all(kinds.map(kind=>this.assets.load(kind)));if(this.disposed)return;
    const sources=new Map<Kit,{source:THREE.Mesh;material:THREE.MeshStandardMaterial}>();
    gltfs.forEach((gltf,i)=>{
      const source=gltf.scene.children.find(n=>(n as THREE.Mesh).isMesh) as THREE.Mesh;
      if(!source)throw new Error('Generated Carlisle deck has no mesh');
      const material=(source.material as THREE.MeshStandardMaterial).clone();material.userData={};material.roughness=.88;this.materials.push(material);
      source.geometry.userData.moduleLength=i?24:12;source.geometry.userData.wholeModules=!!i;
      sources.set(kinds[i],{source,material});
      if(i)this.diagnostics.sceneryTriangles=source.geometry.index!.count/3;else this.diagnostics.sourceTriangles=source.geometry.index!.count/3;
    });
    const batches=new Map<string,{parent:THREE.Object3D;source:THREE.Mesh;material:THREE.Material;matrices:THREE.Matrix4[]}>();
    for (let i = 0;i < this.requests.length;i++) {
      if (this.disposed) return;const r = this.requests[i];
      const {source,material}=sources.get(r.kind)!;
      const intact=(matrix:THREE.Matrix4)=>{
        // A whole 180m scenery section can span several distant quays. Small
        // local cells let each camera/shadow frustum reject unseen modules;
        // source geometry, transforms, materials and draw distance stay intact.
        const e=matrix.elements,cell=[e[12],e[13],e[14]].map(n=>Math.floor(n/48)).join(':');
        const key=r.parent.uuid+':'+r.kind+':'+cell,entry=batches.get(key)??{parent:r.parent,source,material,matrices:[]};
        entry.matrices.push(matrix);batches.set(key,entry);this.diagnostics.intactModules++;this.diagnostics.sections++;
        this.diagnostics.fittedTriangles+=source.geometry.index!.count/3;
      };
      for (const geometry of fitCarlisleDeck(source.geometry, r.triangles, r.direction,intact)) {
        const mesh = new THREE.Mesh(geometry,material);mesh.name = 'Whole Tripo timber deck';
        mesh.userData.visualOnly = true;mesh.castShadow = true;mesh.receiveShadow = true;r.parent.add(mesh);this.nodes.push(mesh);
        this.diagnostics.sections++;this.diagnostics.fittedTriangles += geometry.index!.count / 3;
      }
      if (i % 3 === 2) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    for(const batch of batches.values()){
      const mesh=new THREE.InstancedMesh(batch.source.geometry,batch.material,batch.matrices.length);
      batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.name='Solid timber modules';mesh.userData.visualOnly=true;
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();batch.parent.add(mesh);this.nodes.push(mesh);
      this.diagnostics.instanceBatches++;
    }
  }
  dispose() {
    this.disposed = true;this.nodes.forEach(m => { m.removeFromParent();if(!m.geometry.userData.shared)m.geometry.dispose();if((m as THREE.InstancedMesh).isInstancedMesh)(m as THREE.InstancedMesh).dispose(); });this.nodes.length = 0;
    this.materials.forEach(m => m.dispose());this.assets.dispose();
  }
}
