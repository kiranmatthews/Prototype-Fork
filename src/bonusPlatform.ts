import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

export const BONUS_PLATFORM_HEIGHT=1.05;
export const BONUS_PLATFORM_RADIUS=1.6;
export const BONUS_LANDING_RADIUS=BONUS_PLATFORM_RADIUS;
/** Catch a capsule grazing the rim, not a player passing beside the stone. */
export const BONUS_ASSIST_RADIUS=2.2;
export const BONUS_ASSIST_ABOVE=.25;
export const BONUS_ASSIST_BELOW=.35;

export interface BonusLandingSample { x:number; z:number; height:number }

/** Sweep the descending feet through the shallow catch band. This prevents a
 * fast ollie from skipping the trigger between two fixed simulation samples. */
export function bonusLandingCatch(from:BonusLandingSample,to:BonusLandingSample):boolean {
  // The sweep forgives a small overshoot, never a fall down beside the base.
  if(to.height< -BONUS_ASSIST_BELOW-.2||Math.hypot(to.x,to.z)>BONUS_ASSIST_RADIUS)return false;
  if(to.height>from.height+.02)return false;
  const drop=from.height-to.height;
  let lo=0,hi=1;
  if(drop>.0001){
    lo=Math.max(0,(from.height-BONUS_ASSIST_ABOVE)/drop);
    hi=Math.min(1,(from.height+BONUS_ASSIST_BELOW)/drop);
  }else if(to.height> BONUS_ASSIST_ABOVE||to.height< -BONUS_ASSIST_BELOW)return false;
  if(lo>hi)return false;
  const dx=to.x-from.x,dz=to.z-from.z,length2=dx*dx+dz*dz;
  const t=length2>.0001?Math.max(lo,Math.min(hi,-(from.x*dx+from.z*dz)/length2)):lo;
  return Math.hypot(from.x+dx*t,from.z+dz*t)<=BONUS_ASSIST_RADIUS;
}

/** An actual rising jump arms one landing. Walking, falling and respawns do not. */
export class BonusJumpGate {
  private armed=false;
  private previous:BonusLandingSample|null=null;
  reset(){this.armed=false;this.previous=null;}
  step(state:{enabled:boolean;grounded:boolean;jump:boolean;rising:boolean;near:boolean;onTop:boolean;landing?:BonusLandingSample}):boolean {
    if(!state.enabled){this.reset();return false;}
    const previous=this.previous;
    this.previous=state.landing?{...state.landing}:null;
    if(!state.grounded){
      if(state.jump&&state.rising&&state.near)this.armed=true;
      // A centered jump still lands normally. Only a rim graze needs an
      // airborne catch; otherwise we'd turn every clean landing into a hop.
      const grazing=state.landing&&Math.hypot(state.landing.x,state.landing.z)>BONUS_PLATFORM_RADIUS-.1;
      if(this.armed&&!state.rising&&grazing&&state.landing&&previous&&bonusLandingCatch(previous,state.landing)){
        this.reset();return true;
      }
      return false;
    }
    const enter=this.armed&&(state.onTop||!!(state.landing&&previous&&bonusLandingCatch(previous,state.landing)));
    this.reset();return enter;
  }
}

type Template={geometry:THREE.BufferGeometry;material:THREE.MeshLambertMaterial};
let pending:Promise<Template>|undefined;
function template(){
  return pending??=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/bonus-platform/question-masonry.glb`).then(gltf=>{
    let source:THREE.Mesh|undefined;gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)source=o as THREE.Mesh;});
    if(!source)throw new Error('Bonus platform GLB contains no mesh');
    // Meshy's source faces diagonally; put the question-mark dot toward +Z,
    // where the normal negative-Z course approach sees it upright.
    const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld).rotateY(Math.PI/3);geometry.computeBoundingBox();
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
    const stone=new THREE.Mesh(geometry,ownMaterial);stone.name='Meshy masonry question mark bonus platform';stone.castShadow=stone.receiveShadow=true;
    stone.userData.bonusOpenColor=0xffffff;stone.userData.bonusOpenEmissive=0;
    if(group.userData.bonusLocked)ownMaterial.color.setScalar(.46);
    group.add(stone);group.userData.bonusStoneReady=true;
  }).catch(error=>console.warn('[bonus] GLB stone platform failed',error));
}
