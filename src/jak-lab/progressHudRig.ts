import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {loadSourceModel} from './models';
import {fuelCellJoints} from './fuelCellHud';
import type {ProgressIconPose} from './progressHud';
import type {Catalogue} from './types';

/** Four source skeletons supply cspace deltas. The original set-frame-num event
 * freezes icons 1–3; icon 0 alone keeps playing. No static model is exhibited. */
export class ProgressHudRig {
  private models:THREE.Object3D[];
  private mixers:THREE.AnimationMixer[];
  private nodes:Map<number,THREE.Object3D>[];
  private frameTimes:ArrayLike<number>;
  private constructor(source:THREE.Object3D,clip:THREE.AnimationClip) {
    this.models=[source,...Array.from({length:3},()=>clone(source))];
    this.frameTimes=clip.tracks.reduce<ArrayLike<number>>((longest,track)=>track.times.length>longest.length?track.times:longest,[]);
    if(this.frameTimes.length<17)throw new Error('Progress HUD source animation is missing authored frames');
    this.mixers=this.models.map(model=>{const mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();return mixer;});
    this.nodes=this.models.map(model=>{
      const nodes=new Map<number,THREE.Object3D>();
      model.traverse(node=>{if(typeof node.userData.jakSourceNode==='number')nodes.set(node.userData.jakSourceNode,node);});
      for(const [id,name] of [[3,'main'],[4,'piece1'],[5,'piece2'],[6,'piece3'],[7,'piece4'],[9,'orbit2']] as const)
        if(nodes.get(id)?.name!==name)throw new Error(`Progress HUD joint ${id}/${name} does not match source`);
      return nodes;
    });
  }
  static async load(catalogue:Catalogue):Promise<ProgressHudRig> {
    const definition=catalogue.progressHud!;
    const model=catalogue.models.find(model=>model.name===definition.model);
    if(!model)throw new Error('Progress HUD source rig is unavailable');
    const asset=await loadSourceModel(model),clip=asset.animations.find(clip=>clip.name===definition.clip);
    if(!clip)throw new Error('Progress HUD source animation is unavailable');
    return new ProgressHudRig(asset.scene,clip);
  }
  sample(pose:ProgressIconPose,joints:Map<number,THREE.Vector3>):void {
    let time=pose.seconds;
    if(pose.frame!==null) {
      const frame=Math.floor(pose.frame),fraction=pose.frame-frame;
      if(frame<0||frame+1>=this.frameTimes.length)throw new Error('Progress HUD held frame is outside source animation');
      time=this.frameTimes[frame]+fraction*(this.frameTimes[frame+1]-this.frameTimes[frame]);
    }
    this.mixers[pose.index].setTime(time);
    const model=this.models[pose.index];model.position.set(0,0,pose.z);
    model.rotation.set(0,pose.yaw*Math.PI*2/65536,0);model.scale.set(pose.scaleX*4096,pose.scaleY*4096,pose.scaleX*4096);
    fuelCellJoints(model,this.nodes[pose.index],joints);
  }
  dispose():void {
    for(const mixer of this.mixers){mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());}
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    for(const model of this.models)model.traverse(node=>{if(node instanceof THREE.Mesh){
      geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);
    }});
    const images=new Set<ImageBitmap>();
    for(const material of materials){for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose();}
    for(const geometry of geometries)geometry.dispose();
    for(const texture of textures){if(typeof texture.image?.close==='function')images.add(texture.image);texture.dispose();}
    for(const image of images)image.close();
  }
}
