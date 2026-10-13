import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import type { CustomComponent } from './level';
import { TempleBreath, templeTikiPhase, type TikiPhase } from './templeBreath';
export { templeTikiPhase, type TikiPhase } from './templeBreath';

const assets=new AssetCache<string,THREE.Group>(async()=>{
  const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}temple-night/tiki-head.glb`);
  const root=gltf.scene,box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const wrapper=new THREE.Group();root.position.sub(new THREE.Vector3(center.x,box.min.y,center.z));wrapper.add(root);
  wrapper.scale.set(2.8/size.x,3/size.y,2.4/size.z);
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
  return wrapper;
},root=>{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();disposeTextures(textures);
});
/** Environment hazard, sharing the game's ordinary contact/mask rules.
 * Flames and contact volumes follow the heading at emission, then cool in flight. */
export class TempleFireTiki {
  readonly group=new THREE.Group();
  readonly head=new THREE.Group();
  readonly breath:TempleBreath;
  get boxes():THREE.Box3[] {return this.breath.boxes;}
  readonly ready:Promise<void>;
  state:TikiPhase={yaw:0,warning:0,fire:0,phase:'cool'};
  private disposed=false;
  private model:THREE.Object3D|null=null;
  private lease=assets.acquire('head');
  private glow=new THREE.MeshBasicMaterial({color:0xff6418,vertexColors:true,transparent:true,depthWrite:false,opacity:.1});
  private mouth:THREE.Mesh;
  constructor(readonly spec:CustomComponent){
    this.group.position.set(...spec.p);this.group.rotation.y=THREE.MathUtils.degToRad(spec.yaw??0);
    this.group.name=spec.nm??'Turning flame tiki';this.group.add(this.head);
    this.head.scale.setScalar(spec.w??1);
    const mouthGeometry=new THREE.CircleGeometry(.53,10),mouthColors=new Float32Array(mouthGeometry.attributes.position.count*4);
    for(let i=0;i<mouthGeometry.attributes.position.count;i++)mouthColors.set([1,1,1,i===0?1:0],i*4);
    mouthGeometry.setAttribute('color',new THREE.Float32BufferAttribute(mouthColors,4));
    this.mouth=new THREE.Mesh(mouthGeometry,this.glow);this.mouth.position.set(0,1.03,1.06);this.mouth.scale.set(1,.6,1);this.head.add(this.mouth);
    this.breath=new TempleBreath(spec.range??7.1,spec.cycle??7.8,spec.phase??0,spec.amp??28);
    this.breath.scale.setScalar(spec.w??1);this.group.add(this.breath);
    this.ready=this.lease.promise.then(template=>{if(this.disposed)return;this.model=template.clone(true);this.head.add(this.model);});
    // Asset loading is awaited by prepareJungleAssets; avoid an unhandled
    // rejection in headless geometry tests that intentionally have no fetch.
    void this.ready.catch(()=>{});
  }
  update(time:number,player:THREE.Vector3):void {
    this.state=templeTikiPhase(time,this.spec.cycle??7.8,this.spec.phase??0,this.spec.amp??28);
    this.head.rotation.y=this.state.yaw;this.group.updateMatrixWorld(true);
    const visible=this.group.position.distanceToSquared(player)<100*100;
    this.glow.opacity=.05+this.state.warning*.5+this.state.fire*(.68+.12*Math.sin(time*29));
    this.breath.update(time,this.state,visible);
  }

  dispose():void {this.disposed=true;this.model?.removeFromParent();this.lease.release();}
}
