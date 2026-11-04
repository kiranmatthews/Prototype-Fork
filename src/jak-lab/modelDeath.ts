import * as THREE from 'three';
import {ParticleMotion,PARTICLE_STEP} from './particleMotion';
import {ParticleLighting} from './particleLighting';
import {SpriteBatch} from './particles';
import {assetURL,type Catalogue,type MeshDeathData,type MeshDeathProfile,type MeshDeathReference} from './types';

/** effect-control's authored skip and overload rules; the lab defaults to NTSC
 * at normal frame load, rather than varying fidelity with the inspector's FPS. */
export function deathVertexSkip(profile:MeshDeathProfile,pal=false,previousRunTime=0):number {
  let skip=profile.vertexSkip;
  if(pal&&skip>1)skip=Math.trunc(50*skip/60);
  if(previousRunTime>9000)skip*=4;else if(previousRunTime>7000)skip*=2;
  return skip;
}

/** generic-merc-execute-asm carries the skip residual across fragments, then
 * bones.gc resets the initial offset for each effect at each drawn frame. */
export function deathVertexIndices(data:MeshDeathData,profile:MeshDeathProfile,age:number):number[] {
  const frames=Math.max(2,profile.frames),skip=deathVertexSkip(profile),indices:number[]=[];
  if(age<0||age>=frames||skip===0)return indices;
  const start=Math.trunc(skip*age/(frames+1));
  for(const effect of data.effects) {
    let index=start;
    for(const fragment of effect) {
      const length=fragment.count+fragment.copies.length;
      for(;index<length;index+=skip)
        indices.push(index<fragment.count?fragment.start+index:fragment.copies[index-fragment.count]);
      index-=length;
    }
  }
  return indices;
}

export class ModelDeathPlayback {
  readonly motion:ParticleMotion;
  readonly lighting:ParticleLighting|null;
  readonly profiles:MeshDeathProfile[];
  private readonly batch:SpriteBatch;
  private readonly sampler:THREE.SkinnedMesh;
  private readonly sourceMesh:THREE.SkinnedMesh;
  private readonly point=new THREE.Vector3();
  private frame=0;
  private carry=0;
  private startFrame=0;
  private profile:MeshDeathProfile|null=null;
  launched=0;
  get active():boolean{return this.profile!==null;}
  get profileId():string{return this.profile?.id??'';}
  get time():number{return this.frame*PARTICLE_STEP;}
  get age():number{return this.frame-this.startFrame;}
  get duration():number{return this.startFrame*PARTICLE_STEP+(this.profile?.frames??0)/60+2;}
  get phase():string {return !this.profile?'off':this.age<0?'animation':this.age<this.profile.frames?'emitting':this.motion.particles.length?'settling':'finished';}
  private constructor(readonly reference:MeshDeathReference,readonly data:MeshDeathData,readonly catalogue:Catalogue,
    private readonly source:THREE.Object3D,private readonly derived:THREE.Object3D,
    private readonly original:THREE.Group,alternative:THREE.Group,private readonly texture:THREE.Texture) {
    this.profiles=catalogue.meshDeaths!.profiles;
    let sourceNode:THREE.Object3D|undefined;
    source.traverse(node=>{if(node.userData.jakSourceNode===data.meshNode)sourceNode=node;});
    let mesh:THREE.SkinnedMesh|undefined;
    sourceNode?.traverse(node=>{if(!mesh&&node instanceof THREE.SkinnedMesh)mesh=node;});
    if(!mesh)throw new Error('Model-death source skeleton is missing');
    this.sourceMesh=mesh;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.joints,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.weights,4));
    geometry.morphTargetsRelative=true;
    geometry.morphAttributes.position=data.morphPositions.map(positions=>new THREE.Float32BufferAttribute(positions,3));
    this.sampler=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
    this.sampler.skeleton=mesh.skeleton;
    this.sampler.morphTargetInfluences=mesh.morphTargetInfluences;
    const definition={id:31000,name:'merc-death',source:{file:'engine/gfx/merc/merc-death.gc',line:34},
      items:[{particle:41,flags:['start-dead']}]};
    this.motion=new ParticleMotion(definition,new Map(catalogue.particles.map(p=>[p.id,p])),12000,41,catalogue.callbackPrograms);
    this.lighting=catalogue.particleLighting?new ParticleLighting(catalogue.particleLighting,`levels/${reference.model.split('/')[0]}/model`):null;
    if(this.lighting)this.motion.host.particleColor.fromArray(this.lighting.sample(12));
    this.batch=new SpriteBatch(texture,'additive',false);
    original.add(this.batch.original);alternative.add(this.batch.gouraud);
  }
  static async load(reference:MeshDeathReference,catalogue:Catalogue,source:THREE.Object3D,derived:THREE.Object3D,
    original:THREE.Group,alternative:THREE.Group):Promise<ModelDeathPlayback> {
    const response=await fetch(assetURL(reference.path));
    if(!response.ok||!response.body)throw new Error('Model-death data unavailable');
    const decoded=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if(decoded.byteLength!==reference.decodedBytes)throw new Error('Incomplete model-death data');
    const data=JSON.parse(new TextDecoder().decode(decoded)) as MeshDeathData;
    if(data.version!==1||data.sourceVertices!==reference.sourceVertices||data.positions.length!==data.sourceVertices*3||
      data.joints.length!==data.sourceVertices*4||data.weights.length!==data.sourceVertices*4)
      throw new Error('Invalid model-death vertex data');
    const textureReference=catalogue.textures.find(texture=>texture.id===catalogue.meshDeaths!.texture);
    if(!textureReference)throw new Error('Model-death texture unavailable');
    const texture=await new THREE.TextureLoader().loadAsync(assetURL(textureReference.path));
    texture.colorSpace=THREE.NoColorSpace;
    try{return new ModelDeathPlayback(reference,data,catalogue,source,derived,original,alternative,texture);}
    catch(error){texture.dispose();throw error;}
  }
  configure(profileId:string,startSeconds=0):void {
    this.profile=this.profiles.find(p=>p.id===profileId)??null;
    // Authored markers can be infinitesimally below a frame after float32
    // artist-base/step conversion. Their first crossed source frame is exact.
    this.startFrame=Math.max(0,Math.ceil(startSeconds*60-1e-5));
    if(!this.profile){
      this.frame=0;this.carry=0;this.launched=0;
      this.source.visible=this.derived.visible=true;this.motion.reset();this.batch.write([]);
    }
  }
  private drawFrame(samplePose:(time:number)=>void):void {
    samplePose(this.time);
    if(!this.profile)return;
    this.source.visible=this.derived.visible=this.age<0||this.age<this.profile.overlap;
    this.sampler.bindMatrix.copy(this.sourceMesh.bindMatrix);
    this.sampler.bindMatrixInverse.copy(this.sourceMesh.bindMatrixInverse);
    for(const index of deathVertexIndices(this.data,this.profile,this.age)) {
      this.sampler.getVertexPosition(index,this.point).applyMatrix4(this.sourceMesh.matrixWorld);
      this.original.worldToLocal(this.point).multiplyScalar(4096);
      this.motion.emitDeath(this.profile.particle,this.point,this.catalogue.meshDeaths!.texture);this.launched++;
    }
    this.batch.write(this.motion.particles);
  }
  seek(time:number,samplePose:(time:number)=>void):void {
    this.frame=0;this.carry=0;this.launched=0;this.motion.reset();this.drawFrame(samplePose);
    this.update(Math.max(0,time),samplePose);
  }
  update(dt:number,samplePose:(time:number)=>void):void {
    if(!this.profile)return;
    const lastFrame=this.startFrame+Math.max(2,this.profile.frames)+120;
    if(this.frame>=lastFrame){this.carry=0;return;}
    this.carry+=dt;
    while(this.frame<lastFrame&&this.carry+1e-10>=PARTICLE_STEP) {
      this.carry-=PARTICLE_STEP;this.frame++;this.motion.update(PARTICLE_STEP);this.drawFrame(samplePose);
    }
    if(this.frame===lastFrame)this.carry=0;
  }
  dispose():void {
    this.batch.original.removeFromParent();this.batch.gouraud.removeFromParent();this.batch.dispose();this.texture.dispose();
    this.sampler.geometry.dispose();(this.sampler.material as THREE.Material).dispose();
  }
}
