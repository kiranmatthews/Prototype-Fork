import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import castleTrack from '../tools/blockworks-art/castle-track-vertices.json';
import {sceneryTextureLoader} from './sceneryTextureLoader';

let compressedLoader:KTX2Loader|undefined;
export function configureBlockworksAssetRenderer(renderer:THREE.WebGLRenderer):void{
  compressedLoader=sceneryTextureLoader(renderer);
}

/** Load the original Meshy asset at every viewing distance. */
export async function loadBlockworksModel(kind:string):Promise<THREE.Group>{
  const name=kind.replace(/^bw-/,''),base=import.meta.env.BASE_URL+'blockworks-art/'+name;
  const loader=new GLTFLoader();if(compressedLoader)loader.setKTX2Loader(compressedLoader);
  const high=await loader.loadAsync(base+'.glb');
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
  scene.updateMatrixWorld(true);
  scene.traverse(o=>{if((o as THREE.Mesh).isMesh)o.userData.bwLod=0;});
  return scene;
}

export function blockworksSourceBox(scene:THREE.Group):THREE.Box3{
  scene.updateMatrixWorld(true);const box=new THREE.Box3();
  scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||(mesh.userData.bwLod??0)!==0)return;
    mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
  });return box;
}
