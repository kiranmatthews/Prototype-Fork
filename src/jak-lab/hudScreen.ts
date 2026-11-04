import * as THREE from 'three';
import {SpriteBatch} from './particles';
import type {ParticleMotion} from './particleMotion';
import {assetURL,type Catalogue,type RenderingMode} from './types';

export type HudCrop=readonly [left:number,right:number,top:number,bottom:number];
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

/** Native GS/HUD coordinates composited before the gallery camera is applied.
 * Layer keys retain each source launch-control's independent HVDF origin. */
export class HudScreen {
  readonly root=new THREE.Group();
  readonly original=new THREE.Group();
  readonly alternative=new THREE.Group();
  readonly scenes=[new THREE.Scene(),new THREE.Scene()];
  private readonly camera=new THREE.OrthographicCamera(-96,96,112,0,.01,1000000);
  private readonly targets=[new THREE.WebGLRenderTarget(512,512),new THREE.WebGLRenderTarget(512,512)];
  private readonly screens:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
  private readonly batches=new Map<string,{layer:string;batch:SpriteBatch}>();
  private readonly textures=new Map<string,THREE.Texture>();
  private readonly targetSize=new THREE.Vector2();
  private mode:RenderingMode='compare';
  private dirty=true;
  private width=4;
  private height=4;
  private aspect=4/3;
  fullFrame=false;
  constructor(private crop:HudCrop) {
    this.scenes.forEach((scene,i)=>{
      scene.background=new THREE.Color().setRGB(16/255,25/255,35/255);
      const material=new THREE.MeshBasicMaterial({map:this.targets[i].texture,toneMapped:false,fog:false,side:THREE.DoubleSide});
      material.customProgramCacheKey=()=>'jak-hud-screen-native-colour-v1';
      material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','');};
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);this.screens.push(screen);
      (i?this.alternative:this.original).add(screen);
    });
    this.camera.layers.enableAll();this.root.add(this.original,this.alternative);this.layout();
  }
  async loadTextures(ids:Iterable<string>,catalogue:Catalogue):Promise<void> {
    const loader=new THREE.TextureLoader();
    for(const id of ids) {
      if(this.textures.has(id))continue;
      const reference=catalogue.textures.find(texture=>texture.id===id);
      if(!reference)throw new Error(`Missing HUD texture ${id}`);
      const texture=await loader.loadAsync(assetURL(reference.path));texture.colorSpace=THREE.NoColorSpace;
      this.textures.set(id,texture);
    }
  }
  get inspectionSize():THREE.Vector3{return new THREE.Vector3(this.mode==='compare'?2*this.width+1.2:this.width,this.height+.3,.4);}
  setRendering(mode:RenderingMode):void {
    this.mode=mode;this.original.visible=mode!=='gouraud';this.alternative.visible=mode!=='original';this.layout();
  }
  setFormat(aspect:number,crop=this.crop):void {this.aspect=aspect;this.crop=crop;this.layout();}
  setFullFrame(value:boolean):void {this.fullFrame=value;this.layout();}
  private layout():void {
    [this.camera.left,this.camera.right,this.camera.top,this.camera.bottom]=this.fullFrame?[-256,256,112,-112]:this.crop;
    this.camera.updateProjectionMatrix();
    this.width=4*(this.camera.right-this.camera.left)/(this.camera.top-this.camera.bottom)*this.aspect*224/512;
    this.screens.forEach(screen=>{screen.scale.set(this.width,this.height,1);screen.position.y=this.height/2+.2;});
    const offset=this.mode==='compare'?(this.width+1.2)/2:0;
    this.original.position.x=-offset;this.alternative.position.x=offset;
    for(const {batch} of this.batches.values())for(const mesh of [batch.original,batch.gouraud])
      mesh.material.uniforms.hudRatio.value=112/256*this.aspect;
    this.dirty=true;
  }
  write(layer:string,motion:ParticleMotion,origin:THREE.Vector3):void {
    const groups=new Map<string,typeof motion.particles>();
    for(const particle of motion.particles) {
      const key=`${layer}|${particle.texture}:${particle.blend}:${particle.depthWrite}`;
      if(!this.batches.has(key)) {
        const texture=this.textures.get(particle.texture);if(!texture)continue;
        const batch=new SpriteBatch(texture,particle.blend,particle.depthWrite);this.batches.set(key,{layer,batch});
        [batch.original,batch.gouraud].forEach((mesh,i)=>{
          mesh.material.vertexShader=hudVertex;
          mesh.material.uniforms.hudOrigin={value:origin};mesh.material.uniforms.hudRatio={value:112/256*this.aspect};
          this.scenes[i].add(mesh);
        });
      }
      const list=groups.get(key)??[];list.push(particle);groups.set(key,list);
    }
    for(const [key,entry] of this.batches)if(entry.layer===layer)entry.batch.write(groups.get(key)??[]);
    this.dirty=true;
  }
  render(renderer:THREE.WebGLRenderer):void {
    if(!this.root.visible)return;
    renderer.getDrawingBufferSize(this.targetSize);
    const width=Math.max(512,Math.ceil(this.targetSize.x/(this.mode==='compare'?2:1)));
    const height=Math.ceil(width*this.height/this.width);
    for(const target of this.targets)if(target.width!==width||target.height!==height){target.setSize(width,height);this.dirty=true;}
    if(!this.dirty)return;
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;renderer.autoClear=true;
    try {
      [this.original,this.alternative].forEach((view,i)=>{
        if(!view.visible)return;renderer.setRenderTarget(this.targets[i]);renderer.render(this.scenes[i],this.camera);
      });
    } finally {renderer.setRenderTarget(previous);renderer.autoClear=autoClear;}
    this.dirty=false;
  }
  dispose():void {
    for(const {batch} of this.batches.values())batch.dispose();
    for(const texture of this.textures.values())texture.dispose();
    for(const target of this.targets)target.dispose();
    for(const screen of this.screens){screen.geometry.dispose();screen.material.dispose();}
    this.root.removeFromParent();
  }
}
