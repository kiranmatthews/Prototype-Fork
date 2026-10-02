import * as THREE from 'three';
import { chiefAssets, bossAssetUrl } from './meshyAssets';

/** Only the new Meshy thematic props live here. Ocean, shores, rocks and
 * foliage use the existing project systems authored in the level data. */
export class ReefScenery {
  readonly root = new THREE.Group();
  readonly ready: Promise<void>;
  private readonly scope = chiefAssets.scope();
  private disposed = false;
  constructor() {
    this.root.name = 'Meshy reef throne and conch braziers';
    this.ready = Promise.all([
      this.install('reef-pavilion.glb', [{p:[0,0,-59],height:7.5,yaw:0}]),
      this.install('reef-brazier.glb', [-1,1].flatMap(side => [3,-7,-19,-31].map(z => ({p:[side*23.5,0,z],height:2.8,yaw:-side*.3})))),
    ]).then(() => {});
    void this.ready.catch(() => {}); // prepareAssets owns failure reporting.
  }
  private async install(file:string, placements:{p:number[];height:number;yaw:number}[]):Promise<void> {
    const source = await this.scope.load(bossAssetUrl(file)); if(this.disposed)return;
    const box = new THREE.Box3().setFromObject(source.scene), size = box.getSize(new THREE.Vector3());
    for(const placement of placements) {
      const model=source.scene.clone(true), holder=new THREE.Group();
      const fit=placement.height/Math.max(.01,size.y); model.scale.multiplyScalar(fit);
      model.position.set(-(box.min.x+box.max.x)*.5*fit,-box.min.y*fit,-(box.min.z+box.max.z)*.5*fit);
      model.traverse(node=>{const mesh=node as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
      holder.add(model);holder.position.fromArray(placement.p);holder.rotation.y=placement.yaw;this.root.add(holder);
    }
  }
  update(_time:number,_storm:number):void { /* Native plants/water own animation. */ }
  dispose():void {this.disposed=true;this.root.clear();this.root.removeFromParent();this.scope.dispose();}
}
