import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {gouraud,loadSourceModel} from './models';
import {HudScreen} from './hudScreen';
import {ParticleMotion} from './particleMotion';
import {FuelCellHud,fuelCellJoints,type FuelCellPose} from './fuelCellHud';
import {type Catalogue,type EffectDefinition,type RenderingMode} from './types';

/** Original HUD lights, independent of the gallery's day/world lighting.
 * The alternate bakes albedo into vertices before lighting/interpolation. */
function hudMaterial(source:THREE.MeshStandardMaterial|THREE.MeshLambertMaterial,alternative:boolean):THREE.MeshBasicMaterial {
  const material=new THREE.MeshBasicMaterial({color:source.color,map:source.map,vertexColors:source.vertexColors,
    opacity:source.opacity,transparent:source.transparent,alphaTest:source.alphaTest,side:source.side,
    depthWrite:source.depthWrite,depthTest:source.depthTest,toneMapped:false});
  material.customProgramCacheKey=()=>alternative?'jak-hud-gouraud-v1':'jak-hud-original-v1';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 hudInk;')
      .replace('#include <project_vertex>',`#include <project_vertex>
        // Undo the isometric Y/depth projection before applying HUD lighting.
        vec3 hudNormal=normalize(vec3(transformedNormal.x,transformedNormal.y*.5,-transformedNormal.z));
        hudInk=vec3(.5+.5*max(hudNormal.z,0.0));
        ${alternative?'#if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)\nhudInk*=vColor.rgb;\n#endif':''}
      `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 hudInk;');
    if(alternative) {
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        #ifdef USE_MAP
          diffuseColor.a*=texture2D(map,vMapUv).a;
        #endif
      `).replace('#include <color_fragment>',`
        diffuseColor.rgb*=hudInk;
        #ifdef USE_COLOR_ALPHA
          diffuseColor.a*=vColor.a;
        #endif
      `);
    } else shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb*=hudInk;');
  };
  return material;
}

/** A real screen-space composite, displayed on two screens in the walking lab.
 * Both screens share a source simulation, but retain separate original/Gouraud
 * geometry and materials. Screen cropping only changes the inspection camera. */
export class FuelCellHudExhibit {
  readonly screen=new HudScreen([-96,96,112,0]);
  get root(){return this.screen.root;}
  get original(){return this.screen.original;}
  get alternative(){return this.screen.alternative;}
  get fullFrame(){return this.screen.fullFrame;}
  get clock(){return this.motion.clock;}
  get particles(){return this.motion.particles.length;}
  get dropped(){return this.motion.dropped;}
  readonly motion:ParticleMotion;
  readonly hud:FuelCellHud;
  readonly issues:Set<string>;
  private readonly models:THREE.Object3D[];
  private readonly mixers:THREE.AnimationMixer[];
  private readonly nodes=new Map<number,THREE.Object3D>();
  private readonly sourceMaterials=new Set<THREE.Material>();

  private constructor(readonly definition:EffectDefinition,readonly catalogue:Catalogue,
    source:THREE.Object3D,clips:THREE.AnimationClip[]) {
    const library=catalogue.fuelCellHud!;
    this.motion=new ParticleMotion(definition,new Map(catalogue.particles.map(p=>[p.id,p])),12000,definition.id+1,catalogue.callbackPrograms);
    this.issues=this.motion.issues;
    this.models=[source,clone(source)];
    // GS HUD modulation/blending operates on the authored colour bytes. Keep
    // that space through the offscreen composite and its display screen.
    source.traverse(node=>{if(node instanceof THREE.Mesh)for(const material of
      (Array.isArray(node.material)?node.material:[node.material]) as THREE.MeshStandardMaterial[])
      if(material.map)material.map.colorSpace=THREE.NoColorSpace;});
    source.traverse(node=>{if(typeof node.userData.jakSourceNode==='number')this.nodes.set(node.userData.jakSourceNode,node);});
    for(const [id,name] of [[3,'main'],[4,'piece1'],[5,'piece2'],[6,'piece3'],[7,'piece4'],[9,'orbit2']] as const)
      if(this.nodes.get(id)?.name!==name)throw new Error(`Source power-cell joint ${id}/${name} does not match export`);
    this.models.forEach((model,i)=>{
      model.traverse(node=>{
        if(!(node instanceof THREE.Mesh))return;
        for(const material of Array.isArray(node.material)?node.material:[node.material])this.sourceMaterials.add(material);
        if(i)gouraud(node);
        const before=(Array.isArray(node.material)?node.material:[node.material]) as THREE.MeshStandardMaterial[];
        const materials=before.map(material=>hudMaterial(material,!!i));
        if(i)for(const material of before)material.dispose();
        node.material=Array.isArray(node.material)?materials:materials[0];
        node.frustumCulled=false;
      });
      // draw-bones-hud uses the isometric projection. The model is authored
      // in metres; root transforms below remain in GOAL/HUD coordinates.
      const projection=new THREE.Group();projection.scale.set(1,-.5,-1);projection.add(model);
      this.screen.scenes[i].add(projection);
    });
    const clip=clips.find(clip=>clip.name===library.clip);
    if(!clip)throw new Error('Missing source power-cell idle animation');
    this.mixers=this.models.map(model=>{const mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();return mixer;});
    this.hud=new FuelCellHud(this.motion,library,(pose,joints)=>this.sample(pose,joints));
    this.motion.issues.delete('Screen-space host layout');
    this.setRendering('compare');
  }
  static async load(definition:EffectDefinition,catalogue:Catalogue):Promise<FuelCellHudExhibit> {
    const library=catalogue.fuelCellHud;
    if(!library||library.group!==definition.name)throw new Error('Source HUD metadata is unavailable');
    const model=catalogue.models.find(model=>model.name===library.model);
    if(!model)throw new Error('Source power-cell model is unavailable');
    const asset=await loadSourceModel(model);
    const exhibit=new FuelCellHudExhibit(definition,catalogue,asset.scene,asset.animations);
    try {
      await exhibit.screen.loadTextures(exhibit.motion.textureIds,catalogue);
      exhibit.update(.5);return exhibit;
    } catch(error){exhibit.dispose();throw error;}
  }
  private sample(pose:FuelCellPose,joints:Map<number,THREE.Vector3>):void {
    for(let i=0;i<2;i++) {
      const model=this.models[i];this.mixers[i].setTime(pose.seconds);
      model.position.set(pose.x,pose.y,pose.z);model.rotation.set(0,pose.yaw*Math.PI*2/65536,0);
      model.scale.setScalar(pose.scale*4096);model.updateMatrixWorld(true);
    }
    // Read unprojected cspace transforms. Applying the gallery or isometric
    // transform here would apply the HUD projection twice in the callbacks.
    fuelCellJoints(this.models[0],this.nodes,joints);
  }
  get scale():number{return 1;}
  get inspectionSize():THREE.Vector3{return this.screen.inspectionSize;}
  setNativeScale(_native:boolean):void {/* HUD units are screen pixels, not world metres. */}
  setRendering(mode:RenderingMode):void {this.screen.setRendering(mode);}
  setFormat(id:string):void {this.hud.select(id);this.screen.setFormat(this.hud.aspect);this.restart();}
  setFullFrame(value:boolean):void {this.screen.setFullFrame(value);}
  restart():void {this.hud.restart();this.update(1/60);}
  update(dt:number):void {
    const before=this.motion.clock;this.motion.update(dt);if(before===this.motion.clock)return;
    this.screen.write('power-cell',this.motion,this.hud.origin);
    for(const model of this.models)model.visible=this.hud.phase!=='hidden';
  }
  render(renderer:THREE.WebGLRenderer):void {this.screen.render(renderer);}
  get diagnostics(){return {phase:this.hud.phase,hold:this.hud.hold,offset:this.hud.offset,yaw:this.hud.yaw,
    format:this.hud.profile.id,fullFrame:this.fullFrame,clock:this.motion.clock,particles:this.motion.particles.length,
    joints:Object.fromEntries([...this.hud.joints].map(([id,p])=>[id,p.toArray()])),issues:[...this.issues]};}
  dispose():void {
    for(const mixer of this.mixers){mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());}
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set(this.sourceMaterials),textures=new Set<THREE.Texture>();
    for(const model of this.models)model.traverse(node=>{if(node instanceof THREE.Mesh){
      geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);
    }});
    for(const material of materials){for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose();}
    for(const geometry of geometries)geometry.dispose();
    const images=new Set<ImageBitmap>();
    for(const texture of textures){if(typeof texture.image?.close==='function')images.add(texture.image);texture.dispose();}
    for(const image of images)image.close();
    this.screen.dispose();
  }
}
