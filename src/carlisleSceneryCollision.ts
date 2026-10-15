import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import type {CustomComponent} from './level';
import {CARLISLE_CONTACTS} from './carlisleContacts.generated';
import {WorldSolids,solidContact} from './worldSolids';

// Ten immutable, process-bounded geometry/BVH templates, shared by every
// placement and level. No texture, LOD swap or camera cutaway owns collision.
const templates=new Map<string,THREE.BufferGeometry>();
const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide});
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
 Object.assign(mesh.userData,{editorGhost:true,edgeGrinding:false,carlisleScenery:true,cameraCutaway:c.cameraCutaway===true,vert:false,castShadow:false});return mesh;
}
/** Exact visual top for rooting authored props, not an AABB top estimate. */
export function carlisleSceneryFloor(c:CustomComponent,x:number,z:number):number|null {
 const mesh=contactMesh(c);if(!mesh)return null;
 const box=mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
 const ray=new THREE.Raycaster(new THREE.Vector3(x,box.max.y+1,z),new THREE.Vector3(0,-1,0),0,box.max.y-box.min.y+2);
 return ray.intersectObject(mesh,false)[0]?.point.y??null;
}

/** Exact support rays and continuous solid contacts share the accepted LOD0
 * mesh. Outward-facing ground rays never turn a rock underside into a floor. */
export class CarlisleSceneryCollision {
 readonly meshes:THREE.Mesh[]=[];
 private readonly solids=new WorldSolids();
 private readonly contact=solidContact();
 private readonly resolved=new THREE.Vector3();
 private readonly cameraContact=solidContact();
 add(c:CustomComponent):THREE.Mesh|null {
  if(c.solid!==true)return null;
  const mesh=contactMesh(c);if(!mesh)return null;
  this.meshes.push(mesh);this.solids.add(mesh);return mesh;
 }
 /** Other source-owned kits may reuse this exact contact/camera owner. */
 addMesh(mesh:THREE.Mesh):void {this.meshes.push(mesh);this.solids.add(mesh);}
 /** Keep ordinary floor following; sweep walls and ceilings continuously so
  * a step across overlapping cliff faces cannot tunnel into the rock body. */
 resolve(from:THREE.Vector3,to:THREE.Vector3,radius:number,height:number,grounded=false):
  {x:number;y:number;z:number;normal:THREE.Vector3;box:THREE.Box3}|null {
  if(!this.meshes.length)return null;
  this.resolved.copy(to);
  if(!this.solids.resolve(from,this.resolved,{low:radius+.06,high:Math.max(radius+.06,height-radius),radius,
   ignoreGround:true,groundStep:grounded ? .8 : 0},this.contact))return null;
  if(this.resolved.distanceToSquared(to)<1e-10)return null;
  return {x:this.resolved.x,y:this.resolved.y,z:this.resolved.z,normal:this.contact.normal,box:this.contact.surface!.bounds};
 }
 /** First obstruction along the desired camera arm, including ceilings.
  * Foreground pieces hidden by the existing side-view cutaway stay ignored. */
 cameraFraction(anchor:THREE.Vector3,eye:THREE.Vector3,radius:number,sideScroll=false):number {
  if(!this.solids.cast(anchor,eye,{low:0,high:0,radius,
   ignore:surface=>sideScroll&&surface.mesh.userData.cameraCutaway===true},this.cameraContact))return 1;
  return Math.max(0,this.cameraContact.fraction-.03/Math.max(.03,anchor.distanceTo(eye)));
 }
 dispose():void {this.solids.dispose();this.meshes.length=0;}
}

/** Presentation overlay: retract the camera before a cliff, then ease back
 * out. Restore the authored rig first so clearance never feeds back into its
 * damping, input heading, or replay simulation. */
export class CarlisleSceneryCamera {
 private applied=false;
 private fraction=1;
 private readonly position=new THREE.Vector3();
 private readonly orientation=new THREE.Quaternion();
 private readonly anchor=new THREE.Vector3();
 private readonly aim=new THREE.Vector3();
 restore(camera:THREE.PerspectiveCamera):void {
  if(!this.applied)return;
  camera.position.copy(this.position);camera.quaternion.copy(this.orientation);this.applied=false;
 }
 apply(camera:THREE.PerspectiveCamera,scenery:CarlisleSceneryCollision|null,
  subject:THREE.Vector3,dt:number,snap=false,sideScroll=false):void {
  if(!scenery?.meshes.length){this.fraction=1;return;}
  // The lower-body origin stays within the collision capsule, even beneath
  // an overhang above the forgiving gameplay body. Aim at the visible torso.
  this.anchor.copy(subject).y+=.58;this.aim.copy(subject).y+=1.3;
  const radius=Math.max(.22,camera.near*Math.hypot(1,Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
  const target=scenery.cameraFraction(this.anchor,camera.position,radius,sideScroll);
  this.fraction=snap||target<this.fraction?target:THREE.MathUtils.lerp(this.fraction,target,1-Math.exp(-8*Math.max(0,dt)));
  if(this.fraction>.9999){this.fraction=1;return;}
  this.position.copy(camera.position);this.orientation.copy(camera.quaternion);this.applied=true;
  camera.position.lerpVectors(this.anchor,this.position,this.fraction);camera.lookAt(this.aim);
 }
}
