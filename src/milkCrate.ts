import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Nine bottles, two removed on each surviving hit; hit five breaks the crate. */
export function milkCrateBottleCount(hitsRemaining: number): number {
  return Math.max(0, Math.min(9, Math.ceil(hitsRemaining) * 2 - 1));
}
export interface MilkCrate {
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  visual: THREE.Group;
  bottles: THREE.InstancedMesh;
  ready: Promise<void>;
  hitsRemaining: number;
  pending: boolean;
  runDress: boolean;
  disposed: boolean;
  assetsLoaded: boolean;
}
interface Template { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }
const templates = new Map<string, Promise<Template>>();
const CRATE_HEIGHT = .82, BOTTLE_WIDTH = .27, BOTTLE_HEIGHT = .91, BOTTLE_FLOOR = -.41;
// The centre survives longest; opposite pairs disappear without unbalancing the grid.
export const MILK_BOTTLE_CELLS = [[0,0],[-1,1],[1,-1],[1,1],[-1,-1],[0,1],[0,-1],[-1,0],[1,0]] as const;

function shared<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T): T {
  resource.userData.shared = true;
  resource.userData.levelDepthFade = false;
  return resource;
}
function normalized(geometry: THREE.BufferGeometry, width: number, height: number, depth: number): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3());
  geometry.translate(-(bounds.min.x+bounds.max.x)/2, -bounds.min.y, -(bounds.min.z+bounds.max.z)/2);
  geometry.scale(width/size.x,height/size.y,depth/size.z);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return shared(geometry);
}
function loadTemplate(name: 'blue-crate' | 'milk-bottle'): Promise<Template> {
  let promise = templates.get(name);
  if (!promise) {
    promise = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/milk-crate/${name}.glb`).then(gltf => {
      let source: THREE.Mesh | undefined;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(object => { if ((object as THREE.Mesh).isMesh) source = object as THREE.Mesh; });
      if (!source) throw new Error(`${name} has no mesh`);
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
      const material = source.material as THREE.MeshStandardMaterial;
      material.metalness = 0; material.roughness = .85; material.normalScale.setScalar(.45);
      shared(material);
      for (const texture of [material.map,material.normalMap,material.roughnessMap,material.metalnessMap]) if (texture) { shared(texture);texture.anisotropy=4; }
      const crate = name === 'blue-crate';
      normalized(geometry,crate ? 1 : BOTTLE_WIDTH,crate ? CRATE_HEIGHT : BOTTLE_HEIGHT,crate ? 1 : BOTTLE_WIDTH);
      if (crate) geometry.translate(0,-.5,0);
      source.geometry.dispose();
      return {geometry,material};
    });
    templates.set(name,promise);
  }
  return promise;
}

let fallback: {crate: Template; bottle: Template} | undefined;
function fallbackTemplates(): NonNullable<typeof fallback> {
  if (fallback) return fallback;
  const parts = [new THREE.BoxGeometry(1,.08,1).translate(0,-.46,0)];
  for (const side of [-1,1]) {
    parts.push(new THREE.BoxGeometry(1,CRATE_HEIGHT-.08,.07).translate(0,(CRATE_HEIGHT+.08)/2-.5,side*.465));
    parts.push(new THREE.BoxGeometry(.07,CRATE_HEIGHT-.08,.86).translate(side*.465,(CRATE_HEIGHT+.08)/2-.5,0));
  }
  const crate = shared(mergeGeometries(parts)!);parts.forEach(part=>part.dispose());
  const body = new THREE.CylinderGeometry(.075,.124,.78,10).translate(0,.39,0);
  const cap = new THREE.CylinderGeometry(.076,.076,.13,10).translate(0,.845,0);
  for (const [geometry,color] of [[body,0xf4f0e4],[cap,0xdb3429]] as const) {
    const colors = new Float32Array(geometry.attributes.position.count*3), tint = new THREE.Color(color);
    for (let i=0;i<colors.length;i+=3) tint.toArray(colors,i);
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  }
  const bottle = normalized(mergeGeometries([body,cap])!,BOTTLE_WIDTH,BOTTLE_HEIGHT,BOTTLE_WIDTH);body.dispose();cap.dispose();
  fallback = {
    crate: {geometry:crate,material:shared(new THREE.MeshStandardMaterial({color:0x216dd1,roughness:.75}))},
    bottle: {geometry:bottle,material:shared(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6}))},
  };
  return fallback;
}
function bottleInstances(template: Template): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(template.geometry,template.material,9);
  mesh.name = 'Milk bottles — 3 × 3';mesh.castShadow=mesh.receiveShadow=true;
  const transform = new THREE.Matrix4();
  MILK_BOTTLE_CELLS.forEach(([x,z],index)=>mesh.setMatrixAt(index,transform.makeTranslation(x*.282,BOTTLE_FLOOR,z*.282)));
  mesh.instanceMatrix.needsUpdate=true;
  return mesh;
}
export function setMilkCrateState(crate: MilkCrate, hitsRemaining: number, pending = false, runDress = false): void {
  crate.hitsRemaining=hitsRemaining;crate.pending=pending;crate.runDress=runDress;
  crate.bottles.count=milkCrateBottleCount(hitsRemaining);
  crate.bottles.computeBoundingBox();crate.bottles.computeBoundingSphere();
  crate.visual.visible=!pending&&!runDress;
  // The original cube is only the ghost/run-mode face. It still owns picking,
  // contact, stacking and special-mode number printing at exactly 0.96 m.
  crate.body.material.visible=pending||runDress;
}
export function createMilkCrate(size = .96): MilkCrate {
  const initial=fallbackTemplates();
  const body=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),new THREE.MeshLambertMaterial({color:0xffffff,visible:false}));
  body.name='Five-bounce milk crate';
  const visual=new THREE.Group();visual.name='Blue milk crate and nine bottles';visual.scale.setScalar(size);body.add(visual);
  const shell=new THREE.Mesh(initial.crate.geometry,initial.crate.material);shell.castShadow=shell.receiveShadow=true;
  const bottles=bottleInstances(initial.bottle);visual.add(shell,bottles);
  const crate:MilkCrate={body,visual,bottles,ready:Promise.resolve(),hitsRemaining:5,pending:false,runDress:false,disposed:false,assetsLoaded:false};
  setMilkCrateState(crate,5);
  crate.ready=Promise.all([loadTemplate('blue-crate'),loadTemplate('milk-bottle')]).then(([frame,bottle])=>{
    if (crate.disposed) return;
    shell.geometry=frame.geometry;shell.material=frame.material;
    bottles.removeFromParent();bottles.dispose();
    crate.bottles=bottleInstances(bottle);visual.add(crate.bottles);crate.assetsLoaded=true;
    setMilkCrateState(crate,crate.hitsRemaining,crate.pending,crate.runDress);
  }).catch(error=>{ if(!crate.disposed) console.warn('Milk crate GLB load failed; retaining playable fallback',error); });
  return crate;
}
export function disposeMilkCrate(crate: MilkCrate): void {
  crate.disposed=true;crate.bottles.dispose();
}
