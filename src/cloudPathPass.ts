import * as THREE from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

export const CLOUD_PATH_HEIGHT = 360;
// Reserved only during this pass. Ordinary mesh/camera masks are restored.
const CLOUD_LAYER = 1 << 29;

export function cloudPathSize(width:number,height:number){
  const h=Math.max(1,Math.min(CLOUD_PATH_HEIGHT,Math.round(height)));
  return {width:Math.max(1,Math.round(width*h/Math.max(1,height))),height:h};
}

/** Low-resolution cloud colour/depth, composited against the full-resolution
 * scene depth. Opaque silhouettes stay crisp; only the cloud image is filtered.
 * The density field, geometry and ray spacing are independent of this target. */
export class CloudPathPass {
  enabled=true;
  featherEdges=true;
  private target:THREE.WebGLRenderTarget|null=null;
  private featherTarget:THREE.WebGLRenderTarget|null=null;
  private readonly clouds:THREE.Object3D[]=[];
  private readonly masks:number[]=[];
  private readonly viewport=new THREE.Vector4();
  private readonly scissor=new THREE.Vector4();
  private readonly physicalViewport=new THREE.Vector4();
  private readonly targetViewport=new THREE.Vector4();
  private readonly clearColor=new THREE.Color();
  private frames=0;
  private readonly featherMaterial=new THREE.ShaderMaterial({
    name:'Cloud edge feather · 360p',depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending,
    uniforms:{tCloud:{value:null},texel:{value:new THREE.Vector2()}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`uniform sampler2D tCloud;uniform vec2 texel;varying vec2 vUv;
void main(){
  vec4 c=texture2D(tCloud,vUv);
  vec4 l=texture2D(tCloud,vUv-vec2(texel.x,0.0)),r=texture2D(tCloud,vUv+vec2(texel.x,0.0));
  vec4 b=texture2D(tCloud,vUv-vec2(0.0,texel.y)),t=texture2D(tCloud,vUv+vec2(0.0,texel.y));
  vec4 change=max(max(abs(c-l),abs(c-r)),max(abs(c-b),abs(c-t)));
  float edge=smoothstep(.025,.14,max(max(change.r,change.g),max(change.b,change.a)));
  // One low-resolution pixel of gradient at coverage/shading discontinuities.
  // Smooth cloud interiors pass through unchanged. Colour stays premultiplied.
  gl_FragColor=mix(c,(c*4.0+l+r+b+t)/8.0,edge);
}`,
  });
  private readonly featherQuad=new FullScreenQuad(this.featherMaterial);
  private readonly material=new THREE.ShaderMaterial({
    name:'Cloud path · smooth 360p composite',glslVersion:THREE.GLSL3,
    uniforms:{tCloud:{value:null},tDepth:{value:null},depthProjection:{value:new THREE.Vector2()}},
    transparent:true,premultipliedAlpha:true,depthTest:true,depthWrite:true,
    vertexShader:`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`out vec4 cloudOutput;
#define gl_FragColor cloudOutput
uniform sampler2D tCloud,tDepth;uniform vec2 depthProjection;varying vec2 vUv;
float viewDistance(float depth){return depthProjection.y/(depth*2.0-1.0+depthProjection.x);}
float cloudDepth(){
  ivec2 size=textureSize(tDepth,0);vec2 p=vUv*vec2(size)-.5,f=fract(p);ivec2 a=ivec2(floor(p));
  vec4 d=vec4(texelFetch(tDepth,clamp(a,ivec2(0),size-1),0).r,
    texelFetch(tDepth,clamp(a+ivec2(1,0),ivec2(0),size-1),0).r,
    texelFetch(tDepth,clamp(a+ivec2(0,1),ivec2(0),size-1),0).r,
    texelFetch(tDepth,clamp(a+ivec2(1,1),ivec2(0),size-1),0).r);
  float nearDepth=min(min(d.x,d.y),min(d.z,d.w)),farDepth=max(max(d.x,d.y),max(d.z,d.w));
  float nearest=f.y<.5?(f.x<.5?d.x:d.y):(f.x<.5?d.z:d.w);
  // Interpolate continuous cloud surfaces, not empty sky or separate roads.
  // Manual filtering also works on drivers without linear depth-texture reads.
  if(farDepth>=1.0||viewDistance(farDepth)-viewDistance(nearDepth)>max(1.0,viewDistance(nearDepth)*.02))return nearest;
  return mix(mix(d.x,d.y,f.x),mix(d.z,d.w,f.x),f.y);
}
void main(){
  vec4 cloud=texture(tCloud,vUv);
  if(cloud.a<.001)discard;
  gl_FragDepth=cloudDepth();
  // Filtering premultiplied colour avoids dark fringes at the cloud outline.
  gl_FragColor=vec4(cloud.rgb/max(cloud.a,.0001),cloud.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <premultiplied_alpha_fragment>
}`,
  });
  private readonly composite=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);

  constructor(){
    this.composite.name='Cloud path · 360p layer';
    this.composite.frustumCulled=false;
    // Opaque scene geometry has already written its full-resolution depth.
    // Then clouds, then ordinary transparent effects, followed by post/UI.
    this.composite.renderOrder=-90;
    this.composite.matrixAutoUpdate=false;
    this.composite.userData.cloudPathComposite=true;
  }

  get diagnostics(){return {enabled:this.enabled,featherEdges:this.featherEdges,heightLimit:CLOUD_PATH_HEIGHT,
    width:this.target?.width??0,height:this.target?.height??0,
    clouds:this.clouds.length,frames:this.frames,
    targetBytes:this.target?this.target.width*this.target.height*(12+(this.featherTarget?8:0)):0};}

  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,target:THREE.WebGLRenderTarget|null):boolean {
    this.clouds.length=this.masks.length=0;
    if(!this.enabled){this.release();return false;}
    const cameraMask=camera.layers.mask;
    scene.traverseVisible(object=>{
      if(object.userData.cloudRoadVisual&&(object as THREE.Mesh).isMesh&&(object.layers.mask&cameraMask)!==0){
        this.clouds.push(object);this.masks.push(object.layers.mask);
      }
    });
    if(!this.clouds.length){this.release();return false;}
    const previousTarget=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    renderer.getViewport(this.viewport);renderer.getScissor(this.scissor);renderer.getCurrentViewport(this.physicalViewport);
    const scissorTest=renderer.getScissorTest(),autoClear=renderer.autoClear;
    const background=scene.background,shadowAuto=renderer.shadowMap.autoUpdate,shadowNeeds=renderer.shadowMap.needsUpdate;
    renderer.getClearColor(this.clearColor);const clearAlpha=renderer.getClearAlpha();
    const view=target&&target!==previousTarget?target.viewport:this.physicalViewport;
    const size=cloudPathSize(view.z,view.w);this.ensureTarget(size.width,size.height);
    let mainRendered=false;
    try{
      for(const mesh of this.clouds)mesh.layers.mask=CLOUD_LAYER;
      camera.layers.mask=CLOUD_LAYER;scene.background=null;
      renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
      // Let the renderer reset colour/depth write masks before clearing. The
      // preceding fullscreen/effect pass may have disabled depth writes.
      renderer.autoClear=true;renderer.setRenderTarget(this.target);renderer.setScissorTest(false);
      renderer.setClearColor(0,0);renderer.render(scene,camera);

      if(this.featherEdges){
        this.featherMaterial.uniforms.tCloud.value=this.target!.texture;
        this.featherMaterial.uniforms.texel.value.set(1/size.width,1/size.height);
        renderer.setRenderTarget(this.featherTarget);this.featherQuad.render(renderer);
      }

      for(const mesh of this.clouds)mesh.layers.mask=0;
      camera.layers.mask=cameraMask;scene.background=background;
      renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;
      renderer.setClearColor(this.clearColor,clearAlpha);
      this.bindTarget(renderer,target,target===previousTarget?face:0,target===previousTarget?mip:0,target===previousTarget?this.physicalViewport:undefined);
      if(target===null){renderer.setViewport(this.viewport);renderer.setScissor(this.scissor);renderer.setScissorTest(scissorTest);}
      this.material.uniforms.tCloud.value=(this.featherEdges?this.featherTarget!:this.target!).texture;
      this.material.uniforms.tDepth.value=this.target!.depthTexture;
      this.material.uniforms.depthProjection.value.set(camera.projectionMatrix.elements[10],camera.projectionMatrix.elements[14]);
      this.composite.layers.mask=cameraMask;scene.add(this.composite);
      renderer.render(scene,camera);mainRendered=true;this.frames++;
      return true;
    }finally{
      scene.remove(this.composite);
      for(let i=0;i<this.clouds.length;i++)this.clouds[i].layers.mask=this.masks[i];
      camera.layers.mask=cameraMask;scene.background=background;
      renderer.shadowMap.autoUpdate=shadowAuto;
      if(!mainRendered)renderer.shadowMap.needsUpdate=shadowNeeds;
      renderer.autoClear=autoClear;renderer.setClearColor(this.clearColor,clearAlpha);
      renderer.setViewport(this.viewport);renderer.setScissor(this.scissor);renderer.setScissorTest(scissorTest);
      this.bindTarget(renderer,previousTarget,face,mip,this.physicalViewport);
    }
  }

  private bindTarget(renderer:THREE.WebGLRenderer,target:THREE.WebGLRenderTarget|null,face:number,mip:number,viewport?:THREE.Vector4){
    // getViewport is the renderer's logical screen viewport; an already-bound
    // offscreen target can have a different physical viewport. Preserve both
    // without applying the screen size/DPR to an offscreen framebuffer.
    if(target&&viewport){
      this.targetViewport.copy(target.viewport);target.viewport.copy(viewport);
      try{renderer.setRenderTarget(target,face,mip);}finally{target.viewport.copy(this.targetViewport);}
    }else renderer.setRenderTarget(target,face,mip);
  }

  private ensureTarget(width:number,height:number){
    if(!this.target){
      this.target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,
        minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false});
      this.target.texture.name='Cloud path · 360p linear colour';
      this.target.depthTexture=new THREE.DepthTexture(width,height,THREE.UnsignedIntType);
      this.target.depthTexture.name='Cloud path · 360p depth';
      // Keep depth sampling portable across WebGL drivers. Only cloud colour
      // is feathered; opaque object silhouettes use the native scene depth.
      this.target.depthTexture.minFilter=this.target.depthTexture.magFilter=THREE.NearestFilter;
    }else if(this.target.width!==width||this.target.height!==height)this.target.setSize(width,height);
    if(!this.featherTarget){
      this.featherTarget=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,
        minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});
      this.featherTarget.texture.name='Cloud path · feathered 360p colour';
    }else if(this.featherTarget.width!==width||this.featherTarget.height!==height)this.featherTarget.setSize(width,height);
  }
  release(){this.target?.dispose();this.featherTarget?.dispose();this.target=this.featherTarget=null;this.material.uniforms.tCloud.value=this.material.uniforms.tDepth.value=this.featherMaterial.uniforms.tCloud.value=null;this.clouds.length=this.masks.length=0;}
  dispose(){this.release();this.composite.geometry.dispose();this.material.dispose();this.featherMaterial.dispose();this.featherQuad.dispose();}
}
