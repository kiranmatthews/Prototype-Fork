import * as THREE from 'three';
import {distortionTopology} from './jak-lab/distortion';
import {hasDesertHeat,type DesertHeatPatch} from './desertHeatData';

const vertexShader=/* glsl */`
  attribute vec3 centre;
  attribute vec4 shape;
  uniform float time;
  uniform vec4 distanceFade;
  uniform vec2 bufferSize;
  uniform vec4 viewport;
  varying vec2 sourceUV;
  void main() {
    vec4 viewed=modelViewMatrix*vec4(centre,1.0);
    float distance=-viewed.z;
    float fade=smoothstep(distanceFade.x,distanceFade.y,distance)*
      (1.0-smoothstep(distanceFade.z,distanceFade.w,distance));
    // Jak's auxiliary strip: unchanged outer ring and centre, displaced
    // sampling ring. Flatten the footprint into a low desert heat band.
    float ring=position.z<0.5?1.0:position.z<1.5?0.55:0.0;
    viewed.xy+=position.xy*shape.xy*ring;
    gl_Position=projectionMatrix*viewed;
    vec2 uv=gl_Position.xy/gl_Position.w*0.5+0.5;
    sourceUV=(viewport.xy+uv*viewport.zw)/bufferSize;
    float inner=position.z>0.5&&position.z<1.5?1.0:0.0;
    float phase=shape.w;
    vec2 ripple=vec2(
      0.26*sin(time*3.1+phase+position.y*2.7),
      0.72*sin(time*4.3+phase+position.x*3.6)+0.28*sin(time*2.1+phase*1.7));
    sourceUV+=ripple*shape.z*inner*fade*(viewport.w/720.0)/bufferSize;
  }
`;
const fragmentShader=/* glsl */`
  uniform sampler2D sceneTexture;
  uniform vec2 bufferSize;
  uniform vec4 viewport;
  varying vec2 sourceUV;
  void main() {
    vec2 lo=(viewport.xy+0.5)/bufferSize;
    vec2 hi=(viewport.xy+viewport.zw-0.5)/bufferSize;
    gl_FragColor=texture2D(sceneTexture,clamp(sourceUV,lo,hi));
  }
`;

/** The lab's frozen-framebuffer/depth-preserving distortion technique, adapted
 * to the game's HDR post chain. No extra world render, noise texture, tint,
 * bloom, sky replacement, collision or camera changes. */
export class DesertHeatMirage {
  enabled=true;
  /** Dev review controls freeze the warp without stopping the renderer. */
  reviewTime:number|null=null;
  private readonly scene=new THREE.Scene();
  private geometry:THREE.InstancedBufferGeometry|null=null;
  private mesh:THREE.Mesh|null=null;
  private texture:THREE.FramebufferTexture|null=null;
  private patches:readonly DesertHeatPatch[]|undefined;
  private levelId='';
  private time=0;
  private lastTime=0;
  private visible=0;
  private frames=0;
  private readonly viewed=new THREE.Vector3();
  private readonly sphere=new THREE.Sphere();
  private readonly frustum=new THREE.Frustum();
  private readonly projection=new THREE.Matrix4();
  private readonly size=new THREE.Vector2();
  private readonly viewport=new THREE.Vector4();
  private readonly previousViewport=new THREE.Vector4();
  private readonly uniforms={sceneTexture:{value:null as THREE.Texture|null},time:{value:0},
    bufferSize:{value:new THREE.Vector2()},viewport:{value:new THREE.Vector4()},
    distanceFade:{value:new THREE.Vector4(22,48,650,1000)}};
  private readonly material=new THREE.ShaderMaterial({name:'Dusty Road · Jak heat mirage',
    vertexShader,fragmentShader,uniforms:this.uniforms,depthTest:true,depthWrite:false,
    side:THREE.DoubleSide,blending:THREE.NoBlending,toneMapped:false});

  configure(id:string,patches:readonly DesertHeatPatch[]|undefined):void {
    if(!hasDesertHeat(id))patches=undefined;
    if(id===this.levelId&&patches===this.patches)return;
    this.release();this.levelId=id;this.patches=patches;
    if(!patches?.length)return;
    const topology=distortionTopology(11),geometry=new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(topology.vertices,3));
    geometry.setIndex(new THREE.BufferAttribute(topology.indices,1));
    geometry.setAttribute('centre',new THREE.InstancedBufferAttribute(new Float32Array(patches.length*3),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('shape',new THREE.InstancedBufferAttribute(new Float32Array(patches.length*4),4).setUsage(THREE.DynamicDrawUsage));
    geometry.instanceCount=0;this.geometry=geometry;
    this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.frustumCulled=false;
    this.scene.add(this.mesh);
    // Canyon bends often hide the road beyond 90 m. Let the next sunlit band
    // read before that turn, while still fading out of the player's foreground.
    this.uniforms.distanceFade.value.set(...(id==='bryce-canyon'?[22,48,650,1000]:[22,42,180,300]) as [number,number,number,number]);
  }

  private prepare(camera:THREE.Camera):boolean {
    this.visible=0;
    if(!this.enabled||!this.geometry||!this.patches)return false;
    this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    const centres=this.geometry.getAttribute('centre') as THREE.InstancedBufferAttribute;
    const shapes=this.geometry.getAttribute('shape') as THREE.InstancedBufferAttribute;
    const range=this.uniforms.distanceFade.value;
    for(let i=0;i<this.patches.length;i++){
      const p=this.patches[i];this.viewed.fromArray(p.p).applyMatrix4(camera.matrixWorldInverse);
      if(-this.viewed.z<=range.x||-this.viewed.z>=range.w)continue;
      this.sphere.center.fromArray(p.p);this.sphere.radius=Math.hypot(...p.size);
      if(!this.frustum.intersectsSphere(this.sphere))continue;
      centres.setXYZ(this.visible,...p.p);shapes.setXYZW(this.visible,...p.size,p.strength,i*2.39996323);
      this.visible++;
    }
    this.geometry.instanceCount=this.visible;
    if(!this.visible)return false;
    for(const attribute of [centres,shapes]){
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,this.visible*attribute.itemSize);attribute.needsUpdate=true;
    }
    return true;
  }

  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,
    target:THREE.WebGLRenderTarget|null,animate=true):boolean {
    const now=performance.now()/1000;
    if(animate&&this.lastTime)this.time+=Math.min(.1,Math.max(0,now-this.lastTime));
    this.lastTime=now;
    if(!this.prepare(camera))return false;
    const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    const autoClear=renderer.autoClear;
    renderer.getViewport(this.previousViewport);
    try {
      renderer.setRenderTarget(target);
      renderer.autoClear=true;renderer.render(scene,camera);
      if(target)this.size.set(target.width,target.height);else renderer.getDrawingBufferSize(this.size);
      renderer.getCurrentViewport(this.viewport);
      const type=target?.texture.type??THREE.UnsignedByteType;
      if(!this.texture||this.texture.image.width!==this.size.x||this.texture.image.height!==this.size.y||this.texture.type!==type){
        this.texture?.dispose();this.texture=new THREE.FramebufferTexture(this.size.x,this.size.y);
        this.texture.type=type;this.texture.format=target?.texture.format??THREE.RGBAFormat;
        this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;
        this.texture.colorSpace=THREE.NoColorSpace;this.uniforms.sceneTexture.value=this.texture;
      }
      renderer.copyFramebufferToTexture(this.texture);
      this.uniforms.bufferSize.value.copy(this.size);this.uniforms.viewport.value.copy(this.viewport);
      this.uniforms.time.value=this.reviewTime??this.time;
      this.mesh!.layers.mask=camera.layers.mask;
      // Same framebuffer, same depth: nearby player, cacti and rocks occlude
      // distant hot air. HUD/menus and colour grading happen after this draw.
      renderer.autoClear=false;renderer.render(this.scene,camera);this.frames++;
      return true;
    } finally {
      renderer.autoClear=autoClear;renderer.setRenderTarget(previous,face,mip);renderer.setViewport(this.previousViewport);
    }
  }

  get diagnostics(){return {level:this.levelId,enabled:this.enabled,patches:this.patches?.length??0,
    visible:this.visible,frames:this.frames,time:this.uniforms.time.value,
    copySize:this.texture?[this.texture.image.width,this.texture.image.height]:null,
    textureType:this.texture?.type??null,extraDraws:this.visible&&this.enabled?1:0};}
  release():void {
    if(this.mesh)this.scene.remove(this.mesh);this.mesh=null;
    this.geometry?.dispose();this.geometry=null;this.texture?.dispose();this.texture=null;
    this.uniforms.sceneTexture.value=null;this.patches=undefined;this.visible=0;
  }
  dispose():void {this.release();this.material.dispose();}
}
