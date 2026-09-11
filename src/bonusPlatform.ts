import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

export const BONUS_PLATFORM_HEIGHT=1.05;
export const BONUS_PLATFORM_RADIUS=1.6;
export const BONUS_LANDING_RADIUS=1.25;

/** An actual rising jump arms one landing. Walking, falling and respawns do not. */
export class BonusJumpGate {
  private armed=false;
  reset(){this.armed=false;}
  step(state:{enabled:boolean;grounded:boolean;jump:boolean;rising:boolean;near:boolean;onTop:boolean}):boolean {
    if(!state.enabled){this.reset();return false;}
    if(!state.grounded){
      if(state.jump&&state.rising&&state.near)this.armed=true;
      return false;
    }
    const enter=this.armed&&state.onTop;
    this.reset();return enter;
  }
}

type Template={geometry:THREE.BufferGeometry;material:THREE.MeshLambertMaterial};
let pending:Promise<Template>|undefined;
function template(){
  return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/bonus-platform/stone-circle.glb`).then(gltf=>{
    let source:THREE.Mesh|undefined;gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)source=o as THREE.Mesh;});
    if(!source)throw new Error('Bonus platform GLB contains no mesh');
    const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();
    const box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(2*BONUS_PLATFORM_RADIUS/size.x,BONUS_PLATFORM_HEIGHT/size.y,2*BONUS_PLATFORM_RADIUS/size.z);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.shared=true;
    const original=source.material as THREE.MeshStandardMaterial,map=original.map;
    if(map){map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;map.userData.shared=true;}
    const material=new THREE.MeshLambertMaterial({map,color:0xffffff});material.userData.shared=true;
    source.geometry.dispose();original.dispose();return{geometry,material};
  });
}

/** Artwork is Meshy's mesh; collision stays a level-owned flat circular deck. */
export function attachBonusStone(group:THREE.Group):void {
  group.userData.bonusStoneReady=false;
  const fallback=new THREE.Mesh(new THREE.CylinderGeometry(BONUS_PLATFORM_RADIUS,BONUS_PLATFORM_RADIUS,BONUS_PLATFORM_HEIGHT,20),new THREE.MeshLambertMaterial({color:0x8c8575}));
  fallback.position.y=BONUS_PLATFORM_HEIGHT/2;fallback.name='Bonus stone loading';group.add(fallback);
  void template().then(({geometry,material})=>{
    if(group.userData.bonusStoneDisposed)return;
    group.remove(fallback);fallback.geometry.dispose();fallback.material.dispose();
    const ownMaterial=material.clone();ownMaterial.userData.shared=false;
    const stone=new THREE.Mesh(geometry,ownMaterial);stone.name='Meshy stone circle bonus platform';stone.castShadow=stone.receiveShadow=true;
    stone.userData.bonusOpenColor=0xffffff;stone.userData.bonusOpenEmissive=0;
    if(group.userData.bonusLocked)ownMaterial.color.setScalar(.46);
    group.add(stone);group.userData.bonusStoneReady=true;
  }).catch(error=>console.warn('[bonus] GLB stone platform failed',error));
}
