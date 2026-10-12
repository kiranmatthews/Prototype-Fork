import * as THREE from 'three';
import {MeshBVH,ExtendedTriangle,acceleratedRaycast} from 'three-mesh-bvh';
import type {CustomComponent} from './level';
import {CARLISLE_CONTACTS} from './carlisleContacts.generated';

// Ten immutable, process-bounded geometry/BVH templates, shared by every
// placement and level. No texture, LOD swap or camera cutaway owns collision.
const templates=new Map<string,THREE.BufferGeometry>();
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
material.userData.shared=true;
function geometry(kind:string):THREE.BufferGeometry|null {
 const source=CARLISLE_CONTACTS[kind];if(!source)return null;
 let g=templates.get(kind);if(g)return g;
 g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(source.vertices,3));g.setIndex(source.indices);
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.boundsTree=new MeshBVH(g,{indirect:true});g.userData.shared=true;templates.set(kind,g);return g;
}
function contactMesh(c:CustomComponent):THREE.Mesh|null {
 const g=geometry(c.dkind??'');if(!g)return null;
 const mesh=new THREE.Mesh(g,material);
 mesh.position.set(...c.p);mesh.rotation.set(0,THREE.MathUtils.degToRad(c.yaw??0),THREE.MathUtils.degToRad(c.amp??0),'YXZ');
 mesh.scale.set(...(c.s??[1,1,1])).multiplyScalar(c.w??1);mesh.updateMatrixWorld(true);
 mesh.raycast=acceleratedRaycast;mesh.visible=false;mesh.name=`Solid ${c.nm??c.dkind}`;
 Object.assign(mesh.userData,{editorGhost:true,edgeGrinding:false,carlisleScenery:true,vert:false,castShadow:false});return mesh;
}
/** Exact visual top for rooting authored props, not an AABB top estimate. */
export function carlisleSceneryFloor(c:CustomComponent,x:number,z:number):number|null {
 const mesh=contactMesh(c);if(!mesh)return null;
 const box=mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
 const ray=new THREE.Raycaster(new THREE.Vector3(x,box.max.y+1,z),new THREE.Vector3(0,-1,0),0,box.max.y-box.min.y+2);
 return ray.intersectObject(mesh,false)[0]?.point.y??null;
}

interface Entry {mesh:THREE.Mesh;box:THREE.Box3;inverse:THREE.Matrix4}
export class CarlisleSceneryCollision {
 readonly meshes:THREE.Mesh[]=[];
 private cells=new Map<string,Entry[]>();
 add(c:CustomComponent):THREE.Mesh|null {
  if(c.solid!==true)return null;
  const mesh=contactMesh(c);if(!mesh)return null;
  const box=mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  const entry={mesh,box,inverse:mesh.matrixWorld.clone().invert()};this.meshes.push(mesh);
  for(let x=Math.floor(box.min.x/32);x<=Math.floor(box.max.x/32);x++)for(let z=Math.floor(box.min.z/32);z<=Math.floor(box.max.z/32);z++){
   const key=`${x}:${z}`,cell=this.cells.get(key)??[];cell.push(entry);this.cells.set(key,cell);
  }
  return mesh;
 }
 /** Swept capsule against exact LOD0 faces. Tops retain the existing ground
  * solver; this supplies only missing side separation and normal wall impact.
  * World-space triangle distances handle non-uniform authored scales. */
 resolve(from:THREE.Vector3,to:THREE.Vector3,radius:number,height:number):{x:number;z:number;box:THREE.Box3}|null {
  if(!this.meshes.length)return null;
  const sweep=new THREE.Box3().setFromPoints([from,to]);sweep.min.addScalar(-radius);sweep.max.add(new THREE.Vector3(radius,height,radius));
  const entries=new Set<Entry>();
  for(let x=Math.floor(sweep.min.x/32);x<=Math.floor(sweep.max.x/32);x++)for(let z=Math.floor(sweep.min.z/32);z<=Math.floor(sweep.max.z/32);z++)
   for(const e of this.cells.get(`${x}:${z}`)??[])if(e.box.intersectsBox(sweep))entries.add(e);
  if(!entries.size)return null;
  const feet=new THREE.Vector3(),segment=new THREE.Line3(),localBox=new THREE.Box3(),worldBox=new THREE.Box3();
  const triangle=new ExtendedTriangle(),normal=new THREE.Vector3(),surface=new THREE.Vector3(),capsule=new THREE.Vector3(),delta=new THREE.Vector3();
  const steps=Math.max(1,Math.min(32,Math.ceil(from.distanceTo(to)/(radius*.65))));
  let dx=0,dz=0,hit:THREE.Box3|null=null;
  for(let step=1;step<=steps;step++){
   feet.lerpVectors(from,to,step/steps);feet.x+=dx;feet.z+=dz;
   for(let pass=0;pass<3;pass++)for(const e of entries){
    segment.start.copy(feet).y+=radius+.06;segment.end.copy(feet).y+=Math.max(radius+.06,height-radius);
    worldBox.setFromPoints([segment.start,segment.end]).expandByScalar(radius+.01);
    if(!e.box.intersectsBox(worldBox))continue;
    localBox.copy(worldBox).applyMatrix4(e.inverse);
    e.mesh.geometry.boundsTree!.shapecast({
     intersectsBounds:bounds=>bounds.intersectsBox(localBox),
     intersectsTriangle:tri=>{
      triangle.a.copy(tri.a).applyMatrix4(e.mesh.matrixWorld);triangle.b.copy(tri.b).applyMatrix4(e.mesh.matrixWorld);triangle.c.copy(tri.c).applyMatrix4(e.mesh.matrixWorld);triangle.needsUpdate=true;
      triangle.getNormal(normal);if(Math.abs(normal.y)>.65)return false;
      const distance=triangle.closestPointToSegment(segment,surface,capsule);if(distance>=radius)return false;
      delta.subVectors(capsule,surface);const horizontal=Math.hypot(delta.x,delta.z);if(horizontal<1e-7)return false;
      // Ignore a face behind the capsule: separating through a thin wall is
      // forbidden, but another face's back side cannot pull the body inward.
      if(delta.dot(normal)<-.0001)return false;
      const push=(radius-distance+.002)/horizontal,px=delta.x*push,pz=delta.z*push;
      feet.x+=px;feet.z+=pz;segment.start.x+=px;segment.end.x+=px;segment.start.z+=pz;segment.end.z+=pz;hit=e.box;
      return false;
     },
    });
   }
   dx=feet.x-THREE.MathUtils.lerp(from.x,to.x,step/steps);dz=feet.z-THREE.MathUtils.lerp(from.z,to.z,step/steps);
  }
  return hit&&Math.hypot(dx,dz)>.00001?{x:to.x+dx,z:to.z+dz,box:hit}:null;
 }
}
