import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import castleTrack from '../tools/blockworks-art/castle-track-vertices.json';
import {sceneryTextureLoader} from './sceneryTextureLoader';

let compressedLoader:KTX2Loader|undefined;
export function configureBlockworksAssetRenderer(renderer:THREE.WebGLRenderer):void{
  compressedLoader=sceneryTextureLoader(renderer);
}

const DISTANCE_MODELS=new Set(['turret','wall-bay','buttress','palm','foliage','lantern','wheel','winch','rubble','cliff','parapet-v2','spire-v2','viaduct-v2','jungle-shelf-v2','coaster-v2','hanging-vines','flagstone-deck-v4','aqueduct-v3','rivet-deck-v2','grind-rail','aqueduct-coping','stone-wedge','metal-wedge','ice-deck']);

/** Near geometry is the original Meshy asset. Distance geometry shares its
 * painted materials and UVs, with no duplicate texture downloads. */
export async function loadBlockworksModel(kind:string):Promise<THREE.Group>{
  const name=kind.replace(/^bw-/,''),base=import.meta.env.BASE_URL+'blockworks-art/'+name;
  const loader=new GLTFLoader();if(compressedLoader)loader.setKTX2Loader(compressedLoader);
  const [high,low]=await Promise.all([
    loader.loadAsync(base+'.glb'),
    DISTANCE_MODELS.has(name)?new GLTFLoader().loadAsync(base+'-lod.glb'):Promise.resolve(null),
  ]);
  const scene=high.scene;
  // Two fan faces in the generated liquid had inverted vertex normals.
  // Recompute normals from the unchanged triangles; keep original painted UVs.
  if(name==='toxic-basin')scene.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)mesh.geometry.computeVertexNormals();});
  // The generated track includes raised sleepers. Remove only its measured
  // disconnected islands; fitted Meshy rail components meet the native floor.
  if(name==='ghost-train-castle')scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
    const rail=new Set(castleTrack.indices),index=mesh.geometry.index;if(!index)return;
    const keep:number[]=[];for(let i=0;i<index.count;i+=3)if(!rail.has(index.getX(i))&&!rail.has(index.getX(i+1))&&!rail.has(index.getX(i+2)))keep.push(index.getX(i),index.getX(i+1),index.getX(i+2));
    mesh.geometry.setIndex(keep);mesh.geometry.computeVertexNormals();
  });
  scene.updateMatrixWorld(true);const sourceBox=new THREE.Box3().setFromObject(scene);
  let material:THREE.Material|THREE.Material[]|undefined;
  scene.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.userData.bwLod=0;material=mesh.material;}});
  if(low&&material){
    low.scene.updateMatrixWorld(true);
    const meshes:THREE.Mesh[]=[];low.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
    for(const mesh of meshes){
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();
      mesh.geometry.applyMatrix4(mesh.matrixWorld);
      // Decimation may overshoot a thin slab's bounds. It must never change
      // the dimensions used to seat the untouched near model on native ground.
      const p=mesh.geometry.getAttribute('position');
      for(let i=0;i<p.count;i++)p.setXYZ(i,THREE.MathUtils.clamp(p.getX(i),sourceBox.min.x,sourceBox.max.x),THREE.MathUtils.clamp(p.getY(i),sourceBox.min.y,sourceBox.max.y),THREE.MathUtils.clamp(p.getZ(i),sourceBox.min.z,sourceBox.max.z));
      mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
      mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);mesh.updateMatrix();
      mesh.material=material;scene.add(mesh);
    }
  }
  return scene;
}

/** Use conservative distance from the object bounds so large nearby forms
 * retain their detail. The native collision mesh is never involved. */
export function blockworksDetail(distance:number):number{return distance<38?0:distance<100?1:2;}

export function blockworksSourceBox(scene:THREE.Group):THREE.Box3{
  scene.updateMatrixWorld(true);const box=new THREE.Box3();
  scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||(mesh.userData.bwLod??0)!==0)return;
    mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
  });return box;
}
