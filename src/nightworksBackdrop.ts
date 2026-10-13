import * as THREE from 'three';

/** A small colour capture of only the three matte layers. Distant opaque
 * rocks dissolve into these actual colours, retaining their solid interiors
 * and avoiding a flat fog wall, screen-door dots or transparent triangles. */
export class NightworksBackdrop {
  readonly viewport=new THREE.Vector4(0,0,1,1);
  private readonly target=new THREE.WebGLRenderTarget(4,4,{depthBuffer:true,stencilBuffer:false});
  private readonly scene=new THREE.Scene();
  private readonly layers:{source:THREE.Mesh;copy:THREE.Mesh}[]=[];
  private busy=false;
  private readonly currentScissor=new THREE.Vector4();
  private readonly targetViewport=new THREE.Vector4();
  private readonly targetScissor=new THREE.Vector4();
  private readonly clearColor=new THREE.Color();

  constructor(){this.target.texture.colorSpace=THREE.SRGBColorSpace;this.target.texture.name='Caldera backdrop colour';}
  get texture():THREE.Texture {return this.target.texture;}
  add(source:THREE.Mesh):void {
    const copy=new THREE.Mesh(source.geometry,source.material);copy.matrixAutoUpdate=false;copy.frustumCulled=false;
    const order=this.layers.length-100;source.renderOrder=copy.renderOrder=order;
    this.layers.push({source,copy});this.scene.add(copy);
    if(this.layers.length===1)source.onBeforeRender=(renderer,scene,camera)=>this.capture(renderer,scene,camera);
  }
  private capture(renderer:THREE.WebGLRenderer,outerScene:THREE.Scene,camera:THREE.Camera):void {
    if(this.busy)return;
    this.busy=true;
    const previous=renderer.getRenderTarget(),auto=renderer.autoClear,scissorTest=renderer.getScissorTest();
    const gl=renderer.getContext(),physicalScissor=gl.getParameter(gl.SCISSOR_BOX),physicalScissorTest=gl.isEnabled(gl.SCISSOR_TEST);
    this.currentScissor.set(physicalScissor[0],physicalScissor[1],physicalScissor[2],physicalScissor[3]);
    const face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),xr=renderer.xr.enabled;
    const shadowAuto=renderer.shadowMap.autoUpdate,shadowNeeds=renderer.shadowMap.needsUpdate;
    const alpha=renderer.getClearAlpha();renderer.getClearColor(this.clearColor);
    renderer.getCurrentViewport(this.viewport);
    const width=Math.max(4,Math.ceil(this.viewport.z)),height=Math.max(4,Math.ceil(this.viewport.w));
    if(width!==this.target.width||height!==this.target.height)this.target.setSize(width,height);
    try{
      for(const {source,copy}of this.layers){source.updateWorldMatrix(true,false);copy.matrix.copy(source.matrixWorld);copy.visible=source.visible;copy.layers.mask=source.layers.mask;}
      renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
      renderer.setRenderTarget(this.target);renderer.setScissorTest(false);
      this.scene.background=outerScene.background;renderer.autoClear=true;renderer.clear();renderer.render(this.scene,camera);
    }finally{
      // Preserve both the renderer's logical viewport and the physical
      // target sub-rectangle. setViewport() would multiply the latter by DPR.
      if(previous){
        this.targetViewport.copy(previous.viewport);this.targetScissor.copy(previous.scissor);
        const oldTest=previous.scissorTest;
        previous.viewport.copy(this.viewport);previous.scissor.copy(this.currentScissor);previous.scissorTest=physicalScissorTest;
        renderer.setRenderTarget(previous,face,mip);
        previous.viewport.copy(this.targetViewport);previous.scissor.copy(this.targetScissor);previous.scissorTest=oldTest;
      }else renderer.setRenderTarget(null,face,mip);
      renderer.state.viewport(this.viewport);renderer.state.scissor(this.currentScissor);
      renderer.setScissorTest(scissorTest);renderer.state.setScissorTest(physicalScissorTest);
      renderer.setClearColor(this.clearColor,alpha);renderer.autoClear=auto;renderer.xr.enabled=xr;
      renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;this.busy=false;
    }
  }
  dispose():void {for(const {source}of this.layers)source.onBeforeRender=()=>{};this.layers.length=0;this.scene.clear();this.scene.background=null;this.target.dispose();}
}
