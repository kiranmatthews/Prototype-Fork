import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import type {CustomComponent} from './level';
import {WAREHOUSE_CONTACTS} from './warehouseContacts.generated';
import {WAREHOUSE_ASSET_SIZE} from './warehouseAssetMetrics';
export const WAREHOUSE_BODY_KINDS=Object.keys(WAREHOUSE_CONTACTS);
const templates=new Map<string,THREE.BufferGeometry>();
const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide});material.userData.shared=true;
export function warehouseContactMesh(c:CustomComponent):THREE.Mesh|null {
 if(c.solid!==true||c.scenerySolid===false)return null;
 const kind=c.dkind??'',data=WAREHOUSE_CONTACTS[kind];if(!data)return null;
 let geometry=templates.get(kind);if(!geometry){geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3));geometry.setIndex(data.indices);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.boundsTree=new MeshBVH(geometry,{indirect:true});geometry.userData.shared=true;templates.set(kind,geometry);}
 const mesh=new THREE.Mesh(geometry,material),nominal=WAREHOUSE_ASSET_SIZE[kind as keyof typeof WAREHOUSE_ASSET_SIZE],size=c.s??nominal;
 mesh.position.fromArray(c.p);mesh.rotation.y=(c.yaw??0)*Math.PI/180;mesh.scale.set(size[0]/nominal[0],size[1]/nominal[1],size[2]/nominal[2]).multiplyScalar(c.w??1);
 mesh.updateMatrixWorld(true);mesh.raycast=acceleratedRaycast;mesh.visible=false;mesh.name='Warehouse solid / '+(c.nm??kind);
 Object.assign(mesh.userData,{warehouseContact:kind,editorGhost:true,edgeGrinding:false,carlisleScenery:true,solidSides:true,vert:false,castShadow:false});return mesh;
}
