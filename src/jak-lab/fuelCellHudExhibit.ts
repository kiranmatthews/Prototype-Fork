import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {gouraud,loadSourceModel} from './models';
import {SpriteBatch} from './particles';
import {ParticleMotion} from './particleMotion';
import {FuelCellHud,fuelCellJoints,type FuelCellPose} from './fuelCellHud';
import {assetURL,type Catalogue,type EffectDefinition,type RenderingMode} from './types';

const hudVertex=/* glsl */`
  uniform vec3 hudOrigin;
  uniform float hudRatio;
  attribute vec4 profile;
  attribute vec3 centre;
  attribute vec2 size;
  attribute vec4 rgba;
  attribute vec3 rotationMode;
  varying vec4 ink;
  varying vec2 sourceUV;
  void main() {
    vec3 source=centre*4096.0;
    vec2 xy=vec2(source.x/60.0,source.y/60.0*hudRatio);
    xy+=vec2(sign(hudOrigin.x)*floor(abs(hudOrigin.x)),-sign(hudOrigin.y)*floor(abs(hudOrigin.y)));
    vec2 offset=(position.xy+vec2(rotationMode.z,0.0))*size*4096.0/(60.0*1.9996);
    float c=cos(rotationMode.x),s=sin(rotationMode.x);
    offset=mat2(c,s,-s,c)*offset;offset.y*=hudRatio;
    float depth=16777215.0-(8380365.5-1024.0*hudOrigin.z+(500000000.0-source.z)/60.0);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(xy+offset,-depth,1.0);
    ink=rgba*profile*vec4(2.0/255.0,2.0/255.0,2.0/255.0,4.0/255.0);
    sourceUV=uv;
  }
`;

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
  readonly root=new THREE.Group();
  readonly original=new THREE.Group();
  readonly alternative=new THREE.Group();
  readonly motion:ParticleMotion;
  readonly hud:FuelCellHud;
  readonly issues:Set<string>;
  readonly scenes=[new THREE.Scene(),new THREE.Scene()];
  private readonly camera=new THREE.OrthographicCamera(-96,96,112,0,.01,1000000);
  private readonly targets=[new THREE.WebGLRenderTarget(512,512),new THREE.WebGLRenderTarget(512,512)];
  private readonly screens:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
  private readonly models:THREE.Object3D[];
  private readonly mixers:THREE.AnimationMixer[];
  private readonly nodes=new Map<number,THREE.Object3D>();
  private readonly batches=new Map<string,SpriteBatch>();
  private readonly textures=new Map<string,THREE.Texture>();
  private readonly sourceMaterials=new Set<THREE.Material>();
  private mode:RenderingMode='compare';
  private dirty=true;
  fullFrame=false;
  private width=4;
  private height=4;
  private readonly targetSize=new THREE.Vector2();

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
      this.scenes[i].add(projection);this.scenes[i].background=new THREE.Color().setRGB(16/255,25/255,35/255);
      const material=new THREE.MeshBasicMaterial({map:this.targets[i].texture,toneMapped:false,fog:false,side:THREE.DoubleSide});
      material.customProgramCacheKey=()=>'jak-hud-screen-native-colour-v1';
      material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','');};
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);this.screens.push(screen);
      (i?this.alternative:this.original).add(screen);
    });
    const clip=clips.find(clip=>clip.name===library.clip);
    if(!clip)throw new Error('Missing source power-cell idle animation');
    this.mixers=this.models.map(model=>{const mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();return mixer;});
    this.camera.layers.enableAll();
    this.hud=new FuelCellHud(this.motion,library,(pose,joints)=>this.sample(pose,joints));
    this.motion.issues.delete('Screen-space host layout');
    this.root.add(this.original,this.alternative);this.setRendering('compare');
  }
  static async load(definition:EffectDefinition,catalogue:Catalogue):Promise<FuelCellHudExhibit> {
    const library=catalogue.fuelCellHud;
    if(!library||library.group!==definition.name)throw new Error('Source HUD metadata is unavailable');
    const model=catalogue.models.find(model=>model.name===library.model);
    if(!model)throw new Error('Source power-cell model is unavailable');
    const asset=await loadSourceModel(model);
    const exhibit=new FuelCellHudExhibit(definition,catalogue,asset.scene,asset.animations);
    try {
      const loader=new THREE.TextureLoader();
      for(const id of exhibit.motion.textureIds) {
        const reference=catalogue.textures.find(texture=>texture.id===id);
        if(!reference)throw new Error(`Missing HUD texture ${id}`);
        const texture=await loader.loadAsync(assetURL(reference.path));texture.colorSpace=THREE.NoColorSpace;
        exhibit.textures.set(id,texture);
      }
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
  get inspectionSize():THREE.Vector3{return new THREE.Vector3(this.mode==='compare'?2*this.width+1.2:this.width,this.height+.3,.4);}
  setNativeScale(_native:boolean):void {/* HUD units are screen pixels, not world metres. */}
  setRendering(mode:RenderingMode):void {
    this.mode=mode;this.original.visible=mode!=='gouraud';this.alternative.visible=mode!=='original';this.layout();
  }
  setFormat(id:string):void {this.hud.select(id);this.layout();this.restart();}
  setFullFrame(value:boolean):void {this.fullFrame=value;this.layout();}
  private layout():void {
    const aspect=this.hud.aspect;
    this.camera.left=this.fullFrame?-256:-96;this.camera.right=-this.camera.left;
    this.camera.top=112;this.camera.bottom=this.fullFrame?-112:0;this.camera.updateProjectionMatrix();
    const screenAspect=(this.camera.right-this.camera.left)/(this.camera.top-this.camera.bottom)*aspect*224/512;
    this.width=4*screenAspect;this.height=4;
    this.screens.forEach(screen=>{screen.scale.set(this.width,this.height,1);screen.position.y=this.height/2+.2;});
    const offset=this.mode==='compare'?(this.width+1.2)/2:0;
    this.original.position.x=-offset;this.alternative.position.x=offset;this.dirty=true;
  }
  restart():void {this.hud.restart();this.update(1/60);}
  update(dt:number):void {
    const before=this.motion.clock;this.motion.update(dt);if(before===this.motion.clock)return;
    const groups=new Map<string,typeof this.motion.particles>();
    for(const particle of this.motion.particles) {
      const key=`${particle.texture}:${particle.blend}:${particle.depthWrite}`;
      if(!this.batches.has(key)) {
        const texture=this.textures.get(particle.texture);if(!texture)continue;
        const batch=new SpriteBatch(texture,particle.blend,particle.depthWrite);this.batches.set(key,batch);
        [batch.original,batch.gouraud].forEach((mesh,i)=>{
          mesh.material.vertexShader=hudVertex;
          mesh.material.uniforms.hudOrigin={value:this.hud.origin};mesh.material.uniforms.hudRatio={value:112/256*this.hud.aspect};
          this.scenes[i].add(mesh);
        });
      }
      const list=groups.get(key)??[];list.push(particle);groups.set(key,list);
    }
    for(const [key,batch] of this.batches) {
      batch.write(groups.get(key)??[]);
      for(const mesh of [batch.original,batch.gouraud])mesh.material.uniforms.hudRatio.value=112/256*this.hud.aspect;
    }
    for(const model of this.models)model.visible=this.hud.phase!=='hidden';
    this.dirty=true;
  }
  render(renderer:THREE.WebGLRenderer):void {
    if(!this.root.visible)return;
    renderer.getDrawingBufferSize(this.targetSize);
    const width=Math.max(512,Math.ceil(this.targetSize.x/(this.mode==='compare'?2:1)));
    const height=Math.ceil(width*this.height/this.width);
    for(const target of this.targets)if(target.width!==width||target.height!==height){target.setSize(width,height);this.dirty=true;}
    if(!this.dirty)return;
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    renderer.autoClear=true;
    try {
      [this.original,this.alternative].forEach((view,i)=>{
        if(!view.visible)return;
        renderer.setRenderTarget(this.targets[i]);renderer.render(this.scenes[i],this.camera);
      });
    } finally {renderer.setRenderTarget(previous);renderer.autoClear=autoClear;}
    this.dirty=false;
  }
  get diagnostics(){return {phase:this.hud.phase,hold:this.hud.hold,offset:this.hud.offset,yaw:this.hud.yaw,
    format:this.hud.profile.id,fullFrame:this.fullFrame,clock:this.motion.clock,particles:this.motion.particles.length,
    joints:Object.fromEntries([...this.hud.joints].map(([id,p])=>[id,p.toArray()])),issues:[...this.issues]};}
  dispose():void {
    for(const mixer of this.mixers){mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());}
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set(this.sourceMaterials),textures=new Set(this.textures.values());
    for(const model of this.models)model.traverse(node=>{if(node instanceof THREE.Mesh){
      geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);
    }});
    for(const material of materials){for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose();}
    for(const geometry of geometries)geometry.dispose();
    const images=new Set<ImageBitmap>();
    for(const texture of textures){if(typeof texture.image?.close==='function')images.add(texture.image);texture.dispose();}
    for(const image of images)image.close();
    for(const batch of this.batches.values())batch.dispose();
    for(const target of this.targets)target.dispose();
    for(const screen of this.screens){screen.geometry.dispose();screen.material.dispose();}
    this.root.removeFromParent();
  }
}
