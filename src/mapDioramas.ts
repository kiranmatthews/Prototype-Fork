import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAMPAIGN_ISLANDS, type CampaignLevelDefinition, type CampaignIslandDefinition } from './campaign';
import { AssetCache, disposeTextures } from './assetLifetime';
import { sceneryLoads } from './assetLoadQueue';
import { islandViewAngle } from './mapView';
import layouts from './mapLandmarkLayouts.json';
import { MAP_ISLAND_LANDFORMS } from './mapIslandLandforms';
import { prepareMapRockMaterials, takeMapSurfaceTextures } from './mapSurfaceMaterials';

export interface MapSceneryPiece {asset:string;p:number[];extent:number;yaw:number;size?:number[];foundation?:number[];}
export interface MapSceneryLayout {theme:string;footprint:number[];pieces:MapSceneryPiece[];}
export const MAP_SCENERY_LAYOUTS:Readonly<Record<string,MapSceneryLayout>>=layouts;
export const MAP_BEACON_THEMES=Object.fromEntries(Object.entries(layouts).map(([key,row])=>[key,row.theme]));

/** Each hub is the centre of its own scene, viewed from the coast toward inland. */
export function beaconDioramaPosition(level:CampaignLevelDefinition):THREE.Vector3 {
  return new THREE.Vector3(...level.mapPosition);
}
export function beaconSceneryAngle(level:CampaignLevelDefinition):number {
  return islandViewAngle(beaconDioramaPosition(level),new THREE.Vector3(...CAMPAIGN_ISLANDS.find(i=>i.id===level.islandId)!.centre));
}
export function sceneryWorldPoint(level:CampaignLevelDefinition,p:readonly number[]):THREE.Vector3 {
  return new THREE.Vector3(...p).applyAxisAngle(THREE.Object3D.DEFAULT_UP,beaconSceneryAngle(level)).add(beaconDioramaPosition(level));
}
export function sceneryTerrainSupports(level:CampaignLevelDefinition):THREE.Vector3[] {
  return (MAP_SCENERY_LAYOUTS[level.progressKey]?.pieces??[]).flatMap(piece=>{
    const points=[sceneryWorldPoint(level,[piece.p[0],0,piece.p[2]])];
    if(piece.foundation){
      const [width,depth]=piece.foundation,columns=Math.ceil(width/4),rows=Math.ceil(depth/4);
      for(let x=0;x<=columns;x++)for(let z=0;z<=rows;z++){
        const point=new THREE.Vector3(width*(x/columns-.5),0,depth*(z/rows-.5))
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP,THREE.MathUtils.degToRad(piece.yaw));
        point.x+=piece.p[0];point.z+=piece.p[2];points.push(sceneryWorldPoint(level,point.toArray()));
      }
    }
    return points;
  });
}
function releaseModel(root:THREE.Group):void {
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;geometry.add(mesh.geometry);
    for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(m);for(const t of Object.values(m))if((t as THREE.Texture)?.isTexture)textures.add(t as THREE.Texture);}});
  for(const texture of takeMapSurfaceTextures(root))textures.add(texture);
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());disposeTextures(textures);
}
const models=new AssetCache<string,THREE.Group>(async(asset,_dependency,wanted)=>{
  const gltf=await sceneryLoads.run(()=>new GLTFLoader().loadAsync(import.meta.env.BASE_URL+`map-landmarks/${asset}.glb`),wanted);
  try{await prepareMapRockMaterials(gltf.scene,asset);}catch(error){releaseModel(gltf.scene);throw error;}
  gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.visualOnly=true;mesh.geometry.userData.shared=true;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      material.userData.shared=true;
      for(const value of Object.values(material))if((value as THREE.Texture)?.isTexture){const texture=value as THREE.Texture;texture.userData.shared=true;texture.anisotropy=4;}
    }});return gltf.scene;
},releaseModel);

/** Shared original Meshy geometry/atlases; explicit readiness and lifetime. */
export class MapScenery {
  readonly root=new THREE.Group();
  private readonly scope=models.scope();
  private readonly pending:Promise<void>[]=[];
  private disposed=false;
  constructor(){this.root.name='world map level scenery';}
  addIsland(island:CampaignIslandDefinition):void {
    const spec=MAP_ISLAND_LANDFORMS[island.id];if(!spec)return;
    const group=new THREE.Group();group.name=`world map landform ${island.id}`;
    group.position.set(...island.centre);group.userData.visualOnly=true;this.root.add(group);
    const job=this.addPiece(group,spec.piece).then(async()=>{
      if(this.disposed)return;
      group.updateWorldMatrix(true,true);
      const rock=group.children[0];
      const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
      const plants:Promise<void>[]=(spec.extras??[]).map(piece=>this.addPiece(group,piece));
      // Foliage roots on the actual Meshy ledges, not on an invisible proxy hill.
      for(const [index,point] of spec.plants.entries()){
        ray.ray.origin.set(island.centre[0]+point[0],island.centre[1]+100,island.centre[2]+point[1]);
        const hit=ray.intersectObject(rock,true)[0];
        if(!hit||hit.point.y<island.centre[1]+1)continue;
        const y=hit.point.y-island.centre[1]-.45;
        plants.push(this.addPiece(group,{asset:island.id==='island-4'?'oak':index%4===0?'palm':'thicket',
          p:[point[0],y,point[1]],extent:index%4===0?10:9+(index%3)*2,yaw:index*137.5}));
      }
      await Promise.all(plants);
    });
    job.catch(()=>{});this.pending.push(job);
  }
  add(level:CampaignLevelDefinition):THREE.Group {
    const group=new THREE.Group(),layout=MAP_SCENERY_LAYOUTS[level.progressKey];
    group.name=`world map diorama ${level.progressKey}`;group.position.copy(beaconDioramaPosition(level));group.rotation.y=beaconSceneryAngle(level);group.position.y-=.43;
    group.userData={theme:layout?.theme??'Reserved course entrance',visualOnly:true,source:'Meshy',footprint:layout?.footprint??[0,0],ready:!layout};
    this.root.add(group);
    if(layout){
      const job=Promise.all(layout.pieces.map(piece=>this.addPiece(group,piece))).then(()=>{group.userData.ready=true;});
      // A level can be released before its queued models start loading.
      // Observe the aggregate too, while ready() still reports load failures.
      job.catch(()=>{});this.pending.push(job);
    }
    return group;
  }
  addPiece(parent:THREE.Group,piece:MapSceneryPiece):Promise<void> {
    const job=this.scope.load(piece.asset).then(source=>{
      if(this.disposed)return;
      const model=source.clone(true);model.name=`Meshy ${piece.asset}`;model.userData.asset=piece.asset;model.position.fromArray(piece.p);model.rotation.y=THREE.MathUtils.degToRad(piece.yaw);
      if(piece.size){const size=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());model.scale.set(piece.size[0]/size.x,piece.size[1]/size.y,piece.size[2]/size.z);}
      else model.scale.setScalar(piece.extent);
      parent.add(model);
    });
    // Observe rejection immediately; ready() remains the loading barrier.
    job.catch(()=>{});this.pending.push(job);return job;
  }
  ready():Promise<void>{return Promise.all(this.pending).then(()=>{});}
  dispose():void{this.disposed=true;this.root.removeFromParent();this.root.clear();this.scope.dispose();}
}
