import * as THREE from "three";
import ClipperLib from 'clipper-lib';

export const SYSTEMIC_EDGE_TOP_NORMAL_Y = 0.72;
export const SYSTEMIC_EDGE_MIN_LENGTH = 0.001;
const WELD_QUANTIZATION = 10_000; // Unity parity: 0.1 mm topology weld

export type SurfaceBoundaryEdge = readonly [
  start: THREE.Vector3,
  end: THREE.Vector3,
];

/** Join smooth boundary segments so mesh tessellation cannot end a grind.
 * Sharp corners and ambiguous junctions remain separate catchable edges.
 * Only topology changes; every authored boundary vertex is retained. */
export function joinSurfaceBoundaryEdges(edges: readonly SurfaceBoundaryEdge[]): THREE.Vector3[][] {
  const key = (p: THREE.Vector3) => `${Math.round(p.x * WELD_QUANTIZATION)},${Math.round(p.y * WELD_QUANTIZATION)},${Math.round(p.z * WELD_QUANTIZATION)}`;
  const adjacent = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    for (const p of edge) {
      const k = key(p), indices = adjacent.get(k) ?? [];
      indices.push(index); adjacent.set(k, indices);
    }
  });
  const used = new Set<number>(), paths: THREE.Vector3[][] = [];
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3();
  const extend = (points: THREE.Vector3[]) => {
    for (;;) {
      const end = points[points.length - 1], k = key(end), candidates = adjacent.get(k)!;
      if (candidates.length !== 2) return;
      const next = candidates.find(index => !used.has(index));
      if (next === undefined) return;
      const edge = edges[next], other = key(edge[0]) === k ? edge[1] : edge[0];
      incoming.subVectors(end, points[points.length - 2]).normalize();
      outgoing.subVectors(other, end).normalize();
      if (incoming.dot(outgoing) < Math.SQRT1_2) return;
      used.add(next); points.push(other.clone());
    }
  };
  edges.forEach(([a, b], index) => {
    if (used.has(index)) return;
    used.add(index);
    const points = [a.clone(), b.clone()];
    extend(points); points.reverse(); extend(points); points.reverse();
    paths.push(points);
  });
  return paths;
}

const weldKey = (position: THREE.BufferAttribute, index: number): string =>
  `${Math.round(position.getX(index) * WELD_QUANTIZATION)},` +
  `${Math.round(position.getY(index) * WELD_QUANTIZATION)},` +
  `${Math.round(position.getZ(index) * WELD_QUANTIZATION)}`;

/** A sculpted deck may have overlapping cap triangles at its UV/bevel joins.
 * Union only the explicitly identified top in XZ, then recover each boundary
 * vertex's actual surface height. Internal seams never become grind paths. */
function measuredTopBoundary(mesh: THREE.Mesh, indices: number[]): SurfaceBoundaryEdge[] {
  const position=mesh.geometry.getAttribute('position');
  const vertices=new Map<number,THREE.Vector3>();
  const vertex=(i:number)=>{
    let p=vertices.get(i);
    if(!p){p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);vertices.set(i,p);}
    return p;
  };
  const triangles:{a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;den:number}[]=[],paths:ClipperLib.Paths=[];
  for(let i=0;i<indices.length;i+=3){
    const a=vertex(indices[i]),b=vertex(indices[i+1]),c=vertex(indices[i+2]);
    const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
    // The designated cap includes its bevel. Applying a slope cutoff inside
    // it would create artificial boundaries between cap and shoulder faces.
    if(Math.abs(den)<1e-12)continue;
    const path=[a,b,c].map(p=>({X:Math.round(p.x*WELD_QUANTIZATION),Y:Math.round(p.z*WELD_QUANTIZATION)}));
    if(ClipperLib.Clipper.Area(path)<0)path.reverse();
    triangles.push({a,b,c,den});paths.push(path);
  }
  if(!paths.length)return [];
  const clipper=new ClipperLib.Clipper(),out:ClipperLib.Paths=[];
  clipper.PreserveCollinear=true;clipper.StrictlySimple=true;
  clipper.AddPaths(paths,ClipperLib.PolyType.ptSubject,true);
  clipper.Execute(ClipperLib.ClipType.ctUnion,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  // Quantized triangle intersections can leave sub-weld cracks at T-joints.
  // Close one grid unit, then restore the outline at the same 0.1 mm scale.
  const expand=new ClipperLib.ClipperOffset(),expanded:ClipperLib.Paths=[];
  expand.AddPaths(out,ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);expand.Execute(expanded,1);
  const contract=new ClipperLib.ClipperOffset();contract.AddPaths(expanded,ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);
  out.length=0;contract.Execute(out,-1);
  const pointCache=new Map<string,THREE.Vector3>();
  const at=(q:ClipperLib.IntPoint)=>{
    const key=`${q.X}:${q.Y}`,cached=pointCache.get(key);if(cached)return cached;
    const x=q.X/WELD_QUANTIZATION,z=q.Y/WELD_QUANTIZATION;
    let height=-Infinity,nearest=Infinity,nearY=0;
    for(const {a,b,c,den}of triangles){
      const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den;
      const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den,w=1-u-v;
      if(Math.min(u,v,w)>=-.0001)height=Math.max(height,u*a.y+v*b.y+w*c.y);
      for(const [p,r]of [[a,b],[b,c],[c,a]]){
        const dx=r.x-p.x,dz=r.z-p.z,d=dx*dx+dz*dz;
        const t=d?THREE.MathUtils.clamp(((x-p.x)*dx+(z-p.z)*dz)/d,0,1):0;
        const error=(x-p.x-t*dx)**2+(z-p.z-t*dz)**2;
        if(error<nearest){nearest=error;nearY=p.y+(r.y-p.y)*t;}
      }
    }
    const point=new THREE.Vector3(x,Number.isFinite(height)?height:nearY,z);pointCache.set(key,point);return point;
  };
  return out.flatMap(path=>{
    // Restore collinear authored samples too: a straight XZ edge may still
    // rise and fall in Y, which polygon cleanup alone cannot represent.
    const points=path.flatMap((q,i)=>{
      const next=path[(i+1)%path.length],dx=next.X-q.X,dz=next.Y-q.Y,den=dx*dx+dz*dz;
      const interior=[...vertices.values()].flatMap(p=>{
        const x=p.x*WELD_QUANTIZATION-q.X,z=p.z*WELD_QUANTIZATION-q.Y,t=(x*dx+z*dz)/den;
        return t>1e-6&&t<1-1e-6&&(x-t*dx)**2+(z-t*dz)**2<=4.1?[{t,q:{X:Math.round(q.X+t*dx),Y:Math.round(q.Y+t*dz)}}]:[];
      }).sort((a,b)=>a.t-b.t);
      return [at(q),...interior.map(p=>at(p.q))];
    });
    for(let i=points.length-1;i>=0&&points.length>2;i--)
      if(points[i].distanceToSquared(points[(i+1)%points.length])<SYSTEMIC_EDGE_MIN_LENGTH**2)points.splice(i,1);
    return points.length>2?points.map((p,i)=>[p,points[(i+1)%points.length]] as const):[];
  });
}

/**
 * Unity-compatible systemic grind boundaries for one gameplay surface.
 *
 * Boxes expose their four transformed top edges. Other meshes weld coincident
 * split vertices for topology only, retain sufficiently horizontal triangles,
 * and expose only edges owned by exactly one retained triangle. Render and
 * collision geometry remain untouched.
 */
export function surfaceBoundaryEdges(
  mesh: THREE.Mesh,
  topNormalY = SYSTEMIC_EDGE_TOP_NORMAL_Y,
): SurfaceBoundaryEdge[] {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const position = geometry.getAttribute("position") as
    | THREE.BufferAttribute
    | undefined;
  if (!position || position.count < 3) return [];
  mesh.updateWorldMatrix(true, false);

  const measuredTop=geometry.userData.grindIndices as number[]|undefined;
  if(measuredTop)return measuredTopBoundary(mesh,measuredTop);

  if (geometry.type === "BoxGeometry") {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return [];
    const points = [
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    ].map((point) => point.applyMatrix4(mesh.matrixWorld));
    return points.map((point, index) => [
      point,
      points[(index + 1) & 3].clone(),
    ] as const).filter(
      ([start, end]) =>
        start.distanceToSquared(end) >=
        SYSTEMIC_EDGE_MIN_LENGTH * SYSTEMIC_EDGE_MIN_LENGTH,
    );
  }

  const weldedByPosition = new Map<string, number>();
  const weldedIndices = new Array<number>(position.count);
  const representatives: number[] = [];
  for (let index = 0; index < position.count; index++) {
    const key = weldKey(position, index);
    let welded = weldedByPosition.get(key);
    if (welded === undefined) {
      welded = representatives.length;
      weldedByPosition.set(key, welded);
      representatives.push(index);
    }
    weldedIndices[index] = welded;
  }

  const counts = new Map<string, { a: number; b: number; count: number }>();
  const addEdge = (first: number, second: number): void => {
    const a = Math.min(first, second);
    const b = Math.max(first, second);
    if (a === b) return;
    const key = `${a}:${b}`;
    const current = counts.get(key);
    if (current) current.count++;
    else counts.set(key, { a, b, count: 1 });
  };
  const index = geometry.getIndex();
  const grindIndices = geometry.userData.grindIndices as number[] | undefined;
  const triangleIndex = (offset: number): number =>
    grindIndices ? grindIndices[offset] : index ? index.getX(offset) : offset;
  const triangleCount = grindIndices ? grindIndices.length : index ? index.count : position.count;
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const winding = mesh.matrixWorld.determinant() < 0 ? -1 : 1;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (let offset = 0; offset + 2 < triangleCount; offset += 3) {
    const ia = triangleIndex(offset);
    const ib = triangleIndex(offset + 1);
    const ic = triangleIndex(offset + 2);
    const capY = geometry.userData.grindTopY as number | undefined;
    if (capY !== undefined && [ia, ib, ic].some(i => Math.abs(position.getY(i) - capY) > .0001)) continue;
    a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const normal = ab.cross(ac);
    const length = normal.length();
    const y = normal.y / length * winding;
    const top = material.side === THREE.DoubleSide ? Math.abs(y) : material.side === THREE.BackSide ? -y : y;
    if (length <= 0.000001 || top < topNormalY)
      continue;
    addEdge(weldedIndices[ia], weldedIndices[ib]);
    addEdge(weldedIndices[ib], weldedIndices[ic]);
    addEdge(weldedIndices[ic], weldedIndices[ia]);
  }

  return [...counts.values()]
    .filter((edge) => edge.count === 1)
    .sort((left, right) => left.a - right.a || left.b - right.b)
    .map(({ a: wa, b: wb }) => [
      new THREE.Vector3()
        .fromBufferAttribute(position, representatives[wa])
        .applyMatrix4(mesh.matrixWorld),
      new THREE.Vector3()
        .fromBufferAttribute(position, representatives[wb])
        .applyMatrix4(mesh.matrixWorld),
    ] as const)
    .filter(
      ([start, end]) =>
        start.distanceToSquared(end) >=
        SYSTEMIC_EDGE_MIN_LENGTH * SYSTEMIC_EDGE_MIN_LENGTH,
    );
}
