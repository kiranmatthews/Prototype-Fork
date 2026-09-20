import * as THREE from 'three';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {CopyShader} from 'three/examples/jsm/shaders/CopyShader.js';

/** Retain a scene only while its owner explicitly guarantees a frozen world.
 * Post effects and UI keep rendering at their normal resolution and cadence. */
export class FrozenScenePass extends RenderPass {
  private key:string|null=null;
  private captured:string|null=null;
  private snapshot:THREE.WebGLRenderTarget|null=null;
  private readonly copyMaterial=new THREE.ShaderMaterial({
    name:'Frozen scene copy',uniforms:THREE.UniformsUtils.clone(CopyShader.uniforms),
    vertexShader:CopyShader.vertexShader,fragmentShader:CopyShader.fragmentShader,
    depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
  });
  private readonly quad=new FullScreenQuad(this.copyMaterial);
  setFrozen(key:string|null):void {
    this.key=key;
    if(key===null)this.release();
  }
  release():void {this.snapshot?.dispose();this.snapshot=null;this.captured=null;}
  render(renderer:THREE.WebGLRenderer,write:THREE.WebGLRenderTarget,read:THREE.WebGLRenderTarget,delta=0,mask=false):void {
    if(this.key===null){super.render(renderer,write,read,delta,mask);return;}
    if(this.snapshot&&(this.snapshot.width!==read.width||this.snapshot.height!==read.height||this.snapshot.texture.type!==read.texture.type))this.release();
    if(this.snapshot&&this.captured===this.key){this.copy(renderer,this.snapshot.texture,read);return;}
    super.render(renderer,write,read,delta,mask);
    this.snapshot??=read.clone();
    this.snapshot.depthBuffer=false;this.snapshot.stencilBuffer=false;this.snapshot.depthTexture=null;
    this.copy(renderer,read.texture,this.snapshot);this.captured=this.key;
  }
  private copy(renderer:THREE.WebGLRenderer,texture:THREE.Texture,target:THREE.WebGLRenderTarget):void {
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    try{
      renderer.autoClear=false;renderer.setRenderTarget(target);
      this.copyMaterial.uniforms.tDiffuse.value=texture;this.quad.render(renderer);
    }finally{this.copyMaterial.uniforms.tDiffuse.value=null;renderer.setRenderTarget(previous);renderer.autoClear=autoClear;}
  }
  dispose():void {this.release();this.copyMaterial.dispose();this.quad.dispose();super.dispose();}
}
