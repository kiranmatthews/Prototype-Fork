import * as THREE from 'three';
import {CENTER,ExtendedTriangle,MeshBVH} from 'three-mesh-bvh';
const UP=new THREE.Vector3(0,1,0);

export interface SolidSurfaceOptions {
  name?:string;
  instance?:number;
  geometry?:THREE.BufferGeometry;
  dynamic?:boolean;
  active?:()=>boolean;
  owner?:unknown;
}
export interface SolidSurface extends SolidSurfaceOptions {
  id:number;
  mesh:THREE.Mesh;
  geometry:THREE.BufferGeometry;
  matrix:THREE.Matrix4;
  previous:THREE.Matrix4;
  inverse:THREE.Matrix4;
  bounds:THREE.Box3;
  previousBounds:THREE.Box3;
  keys:string[];
  global:boolean;
}
export interface SolidContact {
  surface:SolidSurface|null;
  normal:THREE.Vector3;
  point:THREE.Vector3;
  position:THREE.Vector3;
  surfaceDelta:THREE.Vector3;
  fraction:number;
  depth:number;
  top:number;
}
export function solidContact():SolidContact{return{surface:null,normal:new THREE.Vector3(),point:new THREE.Vector3(),position:new THREE.Vector3(),surfaceDelta:new THREE.Vector3(),fraction:1,depth:0,top:0};}
export interface SolidQuery {
  /** Offsets of the capsule's sphere centres from the feet/root origin. */
  low:number;
  high:number;
  radius:number;
  axis?:THREE.Vector3;
  supportNormal?:THREE.Vector3;
  supportRadius?:(normal:THREE.Vector3)=>number;
  /** Ordinary ground contact remains owned by the established ride solver. */
  ignoreGround?:boolean;
  /** Coping below a mounted board is not an obstruction to the rider. */
  soleClearance?:number;
  ignore?:(surface:SolidSurface)=>boolean;
}

/** Scene-independent hard-surface queries. Render LOD, visibility and materials
 * never decide physics. Shared local BVHs retain exact transformed triangles;
 * a spatial grid bounds candidate work before the continuous capsule sweep. */
export class WorldSolids {
  enabled=true;
  readonly surfaces=new Set<SolidSurface>();
  private nextId=1;
  private cells=new Map<string,Set<SolidSurface>>();
  private large=new Set<SolidSurface>();
  private moving=new Set<SolidSurface>();
  private trees=new Map<THREE.BufferGeometry,{tree:MeshBVH|null;refs:number}>();
  private candidates=new Set<SolidSurface>();
  private readonly size=32;
  private readonly sweep=new THREE.Box3();
  private readonly localBox=new THREE.Box3();
  private readonly matrix=new THREE.Matrix4();
  private readonly motion=new THREE.Matrix4();
  private readonly sampleMatrix=new THREE.Matrix4();
  private readonly previousPosition=new THREE.Vector3();
  private readonly currentPosition=new THREE.Vector3();
  private readonly previousRotation=new THREE.Quaternion();
  private readonly currentRotation=new THREE.Quaternion();
  private readonly sampleRotation=new THREE.Quaternion();
  private readonly previousScale=new THREE.Vector3();
  private readonly currentScale=new THREE.Vector3();
  private readonly sampleScale=new THREE.Vector3();
  private readonly samplePosition=new THREE.Vector3();
  private readonly rootTo=new THREE.Vector3();
  private readonly segmentHit=solidContact();
  private readonly segment=new THREE.Line3();
  private readonly plane=new THREE.Plane();
  private readonly tri=new ExtendedTriangle();
  private readonly fromA=new THREE.Vector3();
  private readonly fromB=new THREE.Vector3();
  private readonly toA=new THREE.Vector3();
  private readonly toB=new THREE.Vector3();
  private readonly deltaA=new THREE.Vector3();
  private readonly deltaB=new THREE.Vector3();
  private readonly trianglePoint=new THREE.Vector3();
  private readonly axisPoint=new THREE.Vector3();
  private readonly normal=new THREE.Vector3();
  private readonly separation=new THREE.Vector3();
  private readonly rootFrom=new THREE.Vector3();
  private readonly current=new THREE.Vector3();
  private readonly remaining=new THREE.Vector3();
  private readonly target=new THREE.Vector3();
  private readonly first=solidContact();
  private readonly hit=solidContact();
  private queryCount=0;
  private triangleTests=0;
  private lastTriangles=0;
  private lastCandidates=0;

  add(mesh:THREE.Mesh,options:SolidSurfaceOptions={}):SolidSurface{
    const geometry=options.geometry??mesh.geometry;
    if(!geometry.boundingBox)geometry.computeBoundingBox();
    let cached=this.trees.get(geometry);
    if(!cached){
      const count=(geometry.index?.count??geometry.getAttribute('position').count)/3;
      cached={tree:count>=128?(geometry.boundsTree instanceof MeshBVH?geometry.boundsTree:new MeshBVH(geometry,{strategy:CENTER,indirect:true,verbose:false})):null,refs:0};
      this.trees.set(geometry,cached);
    }
    cached.refs++;
    if(cached.tree&&!geometry.boundsTree)geometry.boundsTree=cached.tree;
    const surface:SolidSurface={...options,id:this.nextId++,mesh,geometry,matrix:new THREE.Matrix4(),previous:new THREE.Matrix4(),inverse:new THREE.Matrix4(),bounds:new THREE.Box3(),previousBounds:new THREE.Box3(),keys:[],global:false};
    this.readMatrix(surface);surface.previous.copy(surface.matrix);surface.previousBounds.copy(surface.bounds);
    this.surfaces.add(surface);
    if(options.dynamic)this.moving.add(surface);else this.index(surface);
    return surface;
  }
  remove(surface:SolidSurface):void{
    if(!this.surfaces.delete(surface))return;
    for(const key of surface.keys){const cell=this.cells.get(key);cell?.delete(surface);if(!cell?.size)this.cells.delete(key);}
    this.large.delete(surface);this.moving.delete(surface);
    const cached=this.trees.get(surface.geometry);if(cached&&!--cached.refs)this.trees.delete(surface.geometry);
  }
  makeDynamic(surface:SolidSurface):void{
    if(surface.dynamic)return;
    for(const key of surface.keys){const cell=this.cells.get(key);cell?.delete(surface);if(!cell?.size)this.cells.delete(key);}
    surface.keys.length=0;this.large.delete(surface);surface.dynamic=true;this.moving.add(surface);
  }
  resetMotion():void{for(const surface of this.moving){this.readMatrix(surface);surface.previous.copy(surface.matrix);surface.previousBounds.copy(surface.bounds);}}
  private readMatrix(surface:SolidSurface):void{
    surface.mesh.updateWorldMatrix(true,false);surface.matrix.copy(surface.mesh.matrixWorld);
    if(surface.instance!==undefined){(surface.mesh as THREE.InstancedMesh).getMatrixAt(surface.instance,this.matrix);surface.matrix.multiply(this.matrix);}
    surface.inverse.copy(surface.matrix).invert();
    surface.bounds.copy(surface.geometry.boundingBox!).applyMatrix4(surface.matrix);
  }
  /** Called once before the Level advances its moving geometry. Both players
   * then see the same previous/current transforms during the following tick. */
  beginStep():void{for(const surface of this.moving){this.readMatrix(surface);surface.previous.copy(surface.matrix);surface.previousBounds.copy(surface.bounds);}}
  private index(surface:SolidSurface):void{
    const b=surface.bounds,s=this.size,x0=Math.floor(b.min.x/s),x1=Math.floor(b.max.x/s),z0=Math.floor(b.min.z/s),z1=Math.floor(b.max.z/s);
    if((x1-x0+1)*(z1-z0+1)>256){surface.global=true;this.large.add(surface);return;}
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
      const key=`${x}:${z}`;let cell=this.cells.get(key);if(!cell)this.cells.set(key,cell=new Set());cell.add(surface);surface.keys.push(key);
    }
  }
  private gather(from:THREE.Vector3,to:THREE.Vector3,q:SolidQuery):void{
    this.candidates.clear();this.sweep.makeEmpty();
    this.fromA.copy(from).addScaledVector(q.axis??UP,q.low);this.fromB.copy(from).addScaledVector(q.axis??UP,q.high);
    this.toA.copy(to).addScaledVector(q.axis??UP,q.low);this.toB.copy(to).addScaledVector(q.axis??UP,q.high);
    this.sweep.expandByPoint(this.fromA).expandByPoint(this.fromB).expandByPoint(this.toA).expandByPoint(this.toB).expandByScalar(q.radius+.01);
    const b=this.sweep,s=this.size,x0=Math.floor(b.min.x/s),x1=Math.floor(b.max.x/s),z0=Math.floor(b.min.z/s),z1=Math.floor(b.max.z/s);
    // A malformed/teleported take cannot create an unbounded grid walk.
    if((x1-x0+1)*(z1-z0+1)>4096){for(const surface of this.surfaces)if(!surface.dynamic)this.candidates.add(surface);}
    else for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const surface of this.cells.get(`${x}:${z}`)??[])this.candidates.add(surface);
    for(const surface of this.large)this.candidates.add(surface);
    for(const surface of this.moving){this.readMatrix(surface);this.candidates.add(surface);}
  }
  private closest():number{
    this.tri.getPlane(this.plane);
    const crossing=this.plane.intersectLine(this.segment,this.axisPoint);
    if(crossing&&this.tri.containsPoint(crossing)){this.trianglePoint.copy(crossing);return 0;}
    return this.tri.closestPointToSegment(this.segment,this.trianglePoint,this.axisPoint);
  }
  private triangle(from:THREE.Vector3,to:THREE.Vector3,surface:SolidSurface,q:SolidQuery,result:SolidContact):void{
    this.lastTriangles++;this.tri.needsUpdate=true;
    if(this.tri.getArea()<1e-10)return;
    const top=Math.max(this.tri.a.y,this.tri.b.y,this.tri.c.y);
    if(q.soleClearance!==undefined&&top<=Math.min(from.y,to.y)+q.soleClearance)return;
    let t=0;
    for(let iteration=0;iteration<32;iteration++){
      this.segment.start.copy(this.fromA).addScaledVector(this.deltaA,t);
      this.segment.end.copy(this.fromB).addScaledVector(this.deltaB,t);
      const distance=this.closest();
      if(distance>1e-8)this.normal.copy(this.axisPoint).sub(this.trianglePoint).multiplyScalar(1/distance);
      else{
        this.tri.getNormal(this.normal);
        const side=this.normal.dot(this.separation.copy(this.fromA).sub(this.tri.a));
        if(side<0||(Math.abs(side)<1e-8&&this.normal.dot(this.deltaA)>0))this.normal.negate();
      }
      if(q.ignoreGround&&this.normal.dot(q.supportNormal??UP)>.65)return;
      const radius=q.supportRadius?.(this.normal)??q.radius;
      const closing=Math.max(-this.normal.dot(this.deltaA),-this.normal.dot(this.deltaB));
      if(distance<=radius+1e-5){
        if(closing<=1e-9&&distance>=radius-.002)return;
        if(t>result.fraction+1e-8)return;
        const depth=Math.max(0,radius-distance);
        if(Math.abs(t-result.fraction)<1e-8&&result.surface&&depth<=result.depth)return;
        result.surface=surface;result.fraction=t;result.depth=depth;result.top=top;
        result.normal.copy(this.normal);result.point.copy(this.trianglePoint);
        result.position.lerpVectors(this.rootFrom,this.rootTo,t);
        result.surfaceDelta.copy(this.trianglePoint).applyMatrix4(surface.inverse).applyMatrix4(surface.previous).sub(this.trianglePoint).negate();
        return;
      }
      if(closing<=1e-10)return;
      // A separating plane bounds how quickly either capsule endpoint can
      // reach this convex triangle. No distance-sized temporal sampling gap.
      const advance=(distance-radius)/closing;t+=Math.max(advance,1e-9);
      if(t>Math.min(1,result.fraction)+1e-8)return;
    }
    // Conservative advancement never crosses a contact. In a pathological
    // near-tangent case, retaining the last safe position prevents tunnelling.
    if(t<result.fraction){result.surface=surface;result.fraction=t;result.depth=0;result.top=top;result.normal.copy(this.normal);result.point.copy(this.trianglePoint);result.position.lerpVectors(this.rootFrom,this.rootTo,t);result.surfaceDelta.set(0,0,0);}
  }
  cast(from:THREE.Vector3,to:THREE.Vector3,q:SolidQuery,result:SolidContact,moving=true):boolean{
    result.surface=null;result.fraction=1;result.depth=0;result.surfaceDelta.set(0,0,0);
    this.lastTriangles=0;this.lastCandidates=0;this.queryCount++;
    if(!this.enabled||!Number.isFinite(q.radius)||q.radius<=0)return false;
    this.gather(from,to,q);
    for(const surface of this.candidates){
      if(q.ignore?.(surface)||Math.abs(surface.matrix.determinant())<1e-12)continue;
      this.localBox.copy(surface.bounds);
      let slices=1,rotation=0;
      const relative=moving&&surface.dynamic&&Math.abs(surface.previous.determinant())>1e-12;
      if(relative){
        surface.previous.decompose(this.previousPosition,this.previousRotation,this.previousScale);
        surface.matrix.decompose(this.currentPosition,this.currentRotation,this.currentScale);
        rotation=this.previousRotation.angleTo(this.currentRotation);
        slices=Math.max(1,Math.ceil(rotation/(Math.PI/90)));
        this.localBox.union(surface.previousBounds);
        if(rotation>1e-5){
          // Enclose the whole rotation about the mesh origin, not just the
          // two endpoint AABBs (a long rotating arm may pass outside both).
          const bounds=surface.geometry.boundingBox!;
          const radius=bounds.getSize(this.normal).length()*.5+bounds.getCenter(this.normal).length();
          const scale=Math.max(...this.previousScale.toArray().map(Math.abs),...this.currentScale.toArray().map(Math.abs));
          this.localBox.makeEmpty().expandByPoint(this.previousPosition).expandByPoint(this.currentPosition).expandByScalar(radius*scale);
        }
      }
      if(!this.sweep.intersectsBox(this.localBox)||surface.active&&!surface.active())continue;
      this.lastCandidates++;
      const relativeSample=(t:number,root:THREE.Vector3,a:THREE.Vector3,b:THREE.Vector3)=>{
        root.lerpVectors(from,to,t);a.copy(root).addScaledVector(q.axis??UP,q.low);b.copy(root).addScaledVector(q.axis??UP,q.high);
        if(relative){
          this.samplePosition.lerpVectors(this.previousPosition,this.currentPosition,t);
          this.sampleScale.lerpVectors(this.previousScale,this.currentScale,t);
          this.sampleRotation.slerpQuaternions(this.previousRotation,this.currentRotation,t);
          this.sampleMatrix.compose(this.samplePosition,this.sampleRotation,this.sampleScale);
          this.motion.copy(this.sampleMatrix).invert().premultiply(surface.matrix);
          root.applyMatrix4(this.motion);a.applyMatrix4(this.motion);b.applyMatrix4(this.motion);
        }
      };
      for(let slice=0;slice<slices&&slice/slices<=result.fraction;slice++){
        const start=slice/slices,end=(slice+1)/slices;
        relativeSample(start,this.rootFrom,this.fromA,this.fromB);
        relativeSample(end,this.rootTo,this.toA,this.toB);
        this.deltaA.copy(this.toA).sub(this.fromA);this.deltaB.copy(this.toB).sub(this.fromB);
        // Bound the arc/chord error of relative rotation. Translation stays
        // exact; rotating contacts remain conservative between sample poses.
        const error=rotation?(Math.max(this.fromA.distanceTo(this.currentPosition),this.fromB.distanceTo(this.currentPosition),this.toA.distanceTo(this.currentPosition),this.toB.distanceTo(this.currentPosition))+q.radius)*(1-Math.cos(rotation/(2*slices))):0;
        const query=error?{...q,radius:q.radius+error,supportRadius:q.supportRadius?(n:THREE.Vector3)=>q.supportRadius!(n)+error:undefined}:q;
        this.localBox.makeEmpty().expandByPoint(this.fromA).expandByPoint(this.fromB).expandByPoint(this.toA).expandByPoint(this.toB).expandByScalar(query.radius+.01).applyMatrix4(surface.inverse);
        const hit=this.segmentHit;hit.surface=null;hit.fraction=Math.min(1,(result.fraction-start)*slices);hit.depth=0;
        const visit=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>{
          this.tri.a.copy(a).applyMatrix4(surface.matrix);this.tri.b.copy(b).applyMatrix4(surface.matrix);this.tri.c.copy(c).applyMatrix4(surface.matrix);
          this.triangle(from,to,surface,query,hit);
        };
        const tree=this.trees.get(surface.geometry)!.tree;
        if(tree)tree.shapecast({intersectsBounds:box=>box.intersectsBox(this.localBox),intersectsTriangle:triangle=>{visit(triangle.a,triangle.b,triangle.c);return false;}});
        else{
          const position=surface.geometry.getAttribute('position'),index=surface.geometry.getIndex(),count=index?.count??position.count;
          for(let i=0;i<count;i+=3){
            this.tri.a.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(surface.matrix);this.tri.b.fromBufferAttribute(position,index?index.getX(i+1):i+1).applyMatrix4(surface.matrix);this.tri.c.fromBufferAttribute(position,index?index.getX(i+2):i+2).applyMatrix4(surface.matrix);
            this.triangle(from,to,surface,query,hit);
          }
        }
        if(hit.surface){hit.fraction=start+hit.fraction/slices;this.copyContact(result,hit);break;}
      }
    }
    this.triangleTests+=this.lastTriangles;return result.surface!==null;
  }
  resolve(from:THREE.Vector3,to:THREE.Vector3,q:SolidQuery,result:SolidContact):boolean{
    this.current.copy(from);this.remaining.copy(to).sub(from);let collided=false;
    for(let iteration=0;iteration<5;iteration++){
      this.target.copy(this.current).add(this.remaining);
      if(!this.cast(this.current,this.target,q,this.hit,iteration===0)){this.current.copy(this.target);break;}
      if(!collided){this.copyContact(this.first,this.hit);collided=true;}
      this.current.copy(this.hit.position).addScaledVector(this.hit.normal,this.hit.depth+.004);
      this.remaining.multiplyScalar(1-this.hit.fraction);
      const inward=this.remaining.dot(this.hit.normal);if(inward<0)this.remaining.addScaledVector(this.hit.normal,-inward);
    }
    if(collided){to.copy(this.current);this.copyContact(result,this.first);}else result.surface=null;
    return collided;
  }
  private copyContact(to:SolidContact,from:SolidContact):void{to.surface=from.surface;to.fraction=from.fraction;to.depth=from.depth;to.top=from.top;to.normal.copy(from.normal);to.point.copy(from.point);to.position.copy(from.position);to.surfaceDelta.copy(from.surfaceDelta);}
  get diagnostics(){return{surfaces:this.surfaces.size,geometries:this.trees.size,gridCells:this.cells.size,dynamic:this.moving.size,queries:this.queryCount,triangleTests:this.triangleTests,lastTriangles:this.lastTriangles,lastCandidates:this.lastCandidates};}
  dispose():void{this.surfaces.clear();this.cells.clear();this.large.clear();this.moving.clear();this.trees.clear();this.candidates.clear();}
}
