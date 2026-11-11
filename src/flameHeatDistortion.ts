import * as THREE from 'three';
import {distortionTopology} from './jak-lab/distortion';
import {getFlameHeatSource,type WriteFlameHeat} from './flameHeatSource';

// Reserved only inside this pass; ordinary and reflection masks stay intact.
const FLAME_LAYER=1<<30;
export const FLAME_HEAT_LIMIT=512;
interface Pocket {centre:THREE.Vector3;width:number;height:number;heat:number;phase:number;distance:number}
const vertexShader=/* glsl */`
  attribute vec3 centre;
  attribute vec4 shape;
  uniform float time, strength;
  uniform vec2 bufferSize;
  uniform vec4 viewport;
  varying vec2 sourceUV;
  void main(){
    vec4 viewed=modelViewMatrix*vec4(centre,1.0);
    float ring=position.z<.5?1.0:position.z<1.5?.55:0.0;
    viewed.xy+=position.xy*shape.xy*ring;
    gl_Position=projectionMatrix*viewed;
    vec2 uv=gl_Position.xy/gl_Position.w*.5+.5;
    sourceUV=(viewport.xy+uv*viewport.zw)/bufferSize;
    // Jak's eleven-slice auxiliary strip: outer ring and centre sample the
    // unchanged framebuffer. Only its inner sampling ring expands/contracts.
    float inner=position.z>.5&&position.z<1.5?1.0:0.0;
    float wave=sin(time*7.3+shape.w+position.y*2.4);
    vec2 warp=position.xy*(.62*wave+.24*sin(time*11.1+shape.w*1.7));
    warp.y+=.32*sin(time*5.7+shape.w+position.x*2.1);
    // Bend a fraction of the visible flame, rather than the same ~one pixel
    // for a candle, a nearby brazier and a distant jet. The cap is in 720-line
    // presentation pixels: native resolution and split views keep the same
    // apparent motion, while small/far pockets naturally become quieter.
    vec2 projectedHalf=abs(vec2(projectionMatrix[0][0],projectionMatrix[1][1]))
      *shape.xy*viewport.zw*.5/gl_Position.w;
    vec2 displacement=min(projectedHalf*vec2(.07,.05)*shape.z*strength,
      vec2(8.0)*(viewport.w/720.0));
    sourceUV+=warp*inner*displacement/bufferSize;
  }
`;
const fragmentShader=/* glsl */`
  uniform sampler2D sceneTexture;
  uniform vec2 bufferSize;
  uniform vec4 viewport;
  varying vec2 sourceUV;
  void main(){
    vec2 lo=(viewport.xy+.5)/bufferSize,hi=(viewport.xy+viewport.zw-.5)/bufferSize;
    gl_FragColor=texture2D(sceneTexture,clamp(sourceUV,lo,hi));
  }
`;

/** World → frozen colour copy → hot air → original flames. The existing depth
 * buffer protects foreground geometry. No extra world render or colour grade. */
export class FlameHeatDistortion {
  enabled=true;
  reviewTime:number|null=null;
  strength=1;
  private readonly scene=new THREE.Scene();
  private readonly geometry=new THREE.InstancedBufferGeometry();
  private readonly sprites:THREE.Object3D[]=[];
  private readonly masks:number[]=[];
  private readonly spriteSet=new Set<THREE.Object3D>();
  private readonly pool:Pocket[]=[];
  private readonly active:Pocket[]=[];
  private readonly world=new THREE.Vector3();
  private readonly viewed=new THREE.Vector3();
  private readonly sphere=new THREE.Sphere();
  private readonly frustum=new THREE.Frustum();
  private readonly projection=new THREE.Matrix4();
  private readonly size=new THREE.Vector2();
  private readonly viewport=new THREE.Vector4();
  private readonly previousViewport=new THREE.Vector4();
  private readonly previousPhysicalViewport=new THREE.Vector4();
  private readonly previousScissor=new THREE.Vector4();
  private readonly targetViewport=new THREE.Vector4();
  private texture:THREE.FramebufferTexture|null=null;
  private time=0;private lastTime=0;private frames=0;private visible=0;private sources=0;private dropped=0;
  private readonly uniforms={sceneTexture:{value:null as THREE.Texture|null},time:{value:0},strength:{value:1},
    bufferSize:{value:new THREE.Vector2()},viewport:{value:new THREE.Vector4()}};
  private readonly material=new THREE.ShaderMaterial({name:'Flames · Jak auxiliary heat distortion',
    vertexShader,fragmentShader,uniforms:this.uniforms,depthTest:true,depthWrite:false,
    side:THREE.DoubleSide,blending:THREE.NoBlending,toneMapped:false});
  private readonly mesh=new THREE.Mesh(this.geometry,this.material);
  constructor(){
    const topology=distortionTopology(11);
    this.geometry.setAttribute('position',new THREE.BufferAttribute(topology.vertices,3));
    this.geometry.setIndex(new THREE.BufferAttribute(topology.indices,1));
    this.geometry.setAttribute('centre',new THREE.InstancedBufferAttribute(new Float32Array(FLAME_HEAT_LIMIT*3),3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('shape',new THREE.InstancedBufferAttribute(new Float32Array(FLAME_HEAT_LIMIT*4),4).setUsage(THREE.DynamicDrawUsage));
    this.geometry.instanceCount=0;this.mesh.frustumCulled=false;this.scene.add(this.mesh);
  }
  private prepare(scene:THREE.Scene,camera:THREE.Camera):boolean {
    this.visible=this.sources=this.dropped=0;this.active.length=this.sprites.length=this.masks.length=0;this.spriteSet.clear();
    if(!this.enabled)return false;
    this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);
    let object:THREE.Object3D,scale=1,used=0;
    const emit:WriteFlameHeat=(x,y,z,width,height,heat,phase)=>{
      if(heat<=.001||width<=0||height<=0)return;
      this.world.set(x,y,z).applyMatrix4(object.matrixWorld);this.viewed.copy(this.world).applyMatrix4(camera.matrixWorldInverse);
      const distance=-this.viewed.z;if(distance<=.2||distance>=180)return;
      this.sphere.center.copy(this.world);this.sphere.radius=Math.hypot(width,height)*scale;
      if(!this.frustum.intersectsSphere(this.sphere))return;
      let fade=THREE.MathUtils.smoothstep(distance,.2,1.3)*(1-THREE.MathUtils.smoothstep(distance,100,180));
      if(scene.fog instanceof THREE.Fog)fade*=1-THREE.MathUtils.smoothstep(distance,scene.fog.near,scene.fog.far);
      else if(scene.fog instanceof THREE.FogExp2)fade*=Math.exp(-((distance*scene.fog.density)**2));
      if(heat*fade<.01)return;
      const p=this.pool[used]??(this.pool[used]={centre:new THREE.Vector3(),width:0,height:0,heat:0,phase:0,distance:0});used++;
      p.centre.copy(this.world);p.width=width*scale;p.height=height*scale;p.heat=Math.min(3,heat)*fade;p.phase=phase;p.distance=distance;
      this.active.push(p);
    };
    scene.traverseVisible(o=>{
      const source=getFlameHeatSource(o);if(!source)return;
      const sprites=source.sprites.filter(s=>s.visible&&(s.layers.mask&camera.layers.mask)!==0);
      if(!sprites.length)return;
      object=o;scale=o.matrixWorld.getMaxScaleOnAxis();const before=used;source.write(emit);
      if(used>before)this.sources++;
      for(const sprite of sprites)if(!this.spriteSet.has(sprite)){
        this.spriteSet.add(sprite);this.sprites.push(sprite);this.masks.push(sprite.layers.mask);
      }
    });
    // Particle detail is bounded like the lab's auxiliary list. Retain the
    // nearest pockets under an unusually large simultaneous chain explosion.
    this.active.sort((a,b)=>a.distance-b.distance);
    this.visible=Math.min(FLAME_HEAT_LIMIT,this.active.length);this.dropped=this.active.length-this.visible;
    this.geometry.instanceCount=this.visible;if(!this.visible)return false;
    const centres=this.geometry.getAttribute('centre') as THREE.InstancedBufferAttribute,shapes=this.geometry.getAttribute('shape') as THREE.InstancedBufferAttribute;
    for(let i=0;i<this.visible;i++){const p=this.active[i];centres.setXYZ(i,p.centre.x,p.centre.y,p.centre.z);shapes.setXYZW(i,p.width,p.height,p.heat,p.phase);}
    for(const a of [centres,shapes]){a.clearUpdateRanges();a.addUpdateRange(0,this.visible*a.itemSize);a.needsUpdate=true;}
    return true;
  }
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,target:THREE.WebGLRenderTarget|null,
    drawWorld?:()=>boolean,animate=true):boolean {
    const now=performance.now()/1000;if(animate&&this.lastTime)this.time+=Math.min(.1,Math.max(0,now-this.lastTime));this.lastTime=now;
    if(!this.prepare(scene,camera)){this.releaseTexture();return false;}
    const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    const autoClear=renderer.autoClear,background=scene.background,mask=camera.layers.mask,shadowAuto=renderer.shadowMap.autoUpdate;
    let shadowNeeds=renderer.shadowMap.needsUpdate;
    renderer.getViewport(this.previousViewport);renderer.getCurrentViewport(this.previousPhysicalViewport);renderer.getScissor(this.previousScissor);
    const scissorTest=renderer.getScissorTest();
    try{
      if(target!==previous)renderer.setRenderTarget(target);
      for(const sprite of this.sprites)sprite.layers.mask=FLAME_LAYER;
      camera.layers.mask=mask&~FLAME_LAYER;
      if(!drawWorld?.())renderer.render(scene,camera);
      shadowNeeds=renderer.shadowMap.needsUpdate;
      if(target)this.size.set(target.width,target.height);else renderer.getDrawingBufferSize(this.size);
      // Native resolution can use fractional DPR. WebGL allocates integral
      // texels/viewports, so sample that actual grid rather than float sizes.
      this.size.floor();renderer.getCurrentViewport(this.viewport).floor();
      const type=target?.texture.type??THREE.UnsignedByteType;
      if(!this.texture||this.texture.image.width!==this.size.x||this.texture.image.height!==this.size.y||this.texture.type!==type){
        this.releaseTexture();this.texture=new THREE.FramebufferTexture(this.size.x,this.size.y);
        this.texture.type=type;this.texture.format=target?.texture.format??THREE.RGBAFormat;
        this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.colorSpace=THREE.NoColorSpace;
        this.uniforms.sceneTexture.value=this.texture;
      }
      renderer.copyFramebufferToTexture(this.texture);
      this.uniforms.bufferSize.value.copy(this.size);this.uniforms.viewport.value.copy(this.viewport);
      this.uniforms.time.value=this.reviewTime??this.time;this.uniforms.strength.value=this.strength;
      renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;scene.background=null;
      this.mesh.layers.mask=camera.layers.mask;renderer.render(this.scene,camera);
      camera.layers.mask=FLAME_LAYER;renderer.render(scene,camera);this.frames++;return true;
    }finally{
      for(let i=0;i<this.sprites.length;i++)this.sprites[i].layers.mask=this.masks[i];
      camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;
      renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;
      renderer.setViewport(this.previousViewport);renderer.setScissor(this.previousScissor);renderer.setScissorTest(scissorTest);
      // Preserve an offscreen target's physical viewport as well as the
      // renderer's logical screen viewport (DPR, post chain and split-screen).
      if(previous){this.targetViewport.copy(previous.viewport);previous.viewport.copy(this.previousPhysicalViewport);
        try{renderer.setRenderTarget(previous,face,mip);}finally{previous.viewport.copy(this.targetViewport);}}
      else renderer.setRenderTarget(null,face,mip);
      // Binding a target resets its GL scissor, even when its viewport was
      // preserved. Reapply the caller's explicit split-screen scissor last.
      renderer.setScissor(this.previousScissor);renderer.setScissorTest(scissorTest);
    }
  }
  private releaseTexture(){this.texture?.dispose();this.texture=null;this.uniforms.sceneTexture.value=null;}
  release(){this.releaseTexture();this.visible=this.sources=this.dropped=0;this.geometry.instanceCount=0;this.sprites.length=this.masks.length=this.active.length=0;this.spriteSet.clear();this.pool.length=0;this.lastTime=0;}
  dispose(){this.release();this.geometry.dispose();this.material.dispose();}
  get diagnostics(){return {enabled:this.enabled,sources:this.sources,visible:this.visible,dropped:this.dropped,frames:this.frames,
    copySize:this.texture?[this.texture.image.width,this.texture.image.height]:null,textureType:this.texture?.type??null,extraDraws:this.visible?1:0};}
}
