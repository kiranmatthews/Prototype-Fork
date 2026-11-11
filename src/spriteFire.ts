import * as THREE from 'three';
import {attachFlameHeat} from './flameHeatSource';
import {writeTorchHeat} from './torchHeat';
export type FireArrangement='torch'|'bonfire'|'wall'|'ring'|'jet'|'wisp'|'vortex'|'embers';
export type FireFamily='narrow'|'medium'|'broad';
export interface FireCycleData {
  id:FireFamily;width:number;height:number;fps:number;frameCount:number;
  pages:{file:string;columns:number;rows:number;first:number;count:number;width:number;height:number}[];
  frames:{file:string;anchor:[number,number];sha256:string}[];
}
export interface FireCycle extends FireCycleData {textures:THREE.Texture[]}
export interface SpriteFireSpec {arrangement:FireArrangement;family:FireFamily;hue:number;seed?:number}
interface Tongue {x:number;y:number;z:number;h:number;phase:number;rate:number;angle:number;ember:boolean}
const fract=(n:number)=>n-Math.floor(n),random=(n:number)=>fract(Math.sin(n*127.1+311.7)*43758.5453);
const vertexShader=/* glsl */`
  attribute vec3 centre;
  attribute vec2 size;
  attribute vec4 state;
  uniform float time, frameCount, fps;
  uniform vec2 anchors[16];
  varying vec2 spriteUV, nextOffset;
  varying float frame, opacity;
  void main(){
    spriteUV=uv;frame=mod(time*fps*state.z+state.y,frameCount);opacity=state.w;
    vec2 foot=anchors[int(floor(frame))];
    nextOffset=anchors[int(mod(floor(frame)+1.,frameCount))]-foot;
    // Register the foot without stretching or procedurally wobbling the drawing.
    vec2 local=(uv-foot)*size;
    float c=cos(state.x),s=sin(state.x);
    vec4 viewed=modelViewMatrix*vec4(centre,1.0);
    viewed.xy+=mat2(c,s,-s,c)*local;gl_Position=projectionMatrix*viewed;
  }
`;
const fragmentShader=/* glsl */`
  uniform sampler2D atlas, atlasNext;
  uniform vec2 grid, nextGrid, atlasSize, nextAtlasSize;
  uniform float firstPageCount, frameCount, hue, blendFrames;
  varying vec2 spriteUV, nextOffset;
  varying float frame, opacity;
  vec4 sampleFrame(float f,vec2 uv){
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec4(0.);
    if(f<firstPageCount){
      vec2 cell=vec2(mod(f,grid.x),grid.y-1.-floor(f/grid.x)),inset=.5/atlasSize;
      return texture2D(atlas,cell/grid+inset+uv*(1./grid-2.*inset));
    }
    f-=firstPageCount;
    vec2 cell=vec2(mod(f,nextGrid.x),nextGrid.y-1.-floor(f/nextGrid.x)),inset=.5/nextAtlasSize;
    return texture2D(atlasNext,cell/nextGrid+inset+uv*(1./nextGrid-2.*inset));
  }
  vec3 rgb2hsv(vec3 c){
    vec4 K=vec4(0.,-1./3.,2./3.,-1.),p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
    vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
    float d=q.x-min(q.w,q.y),e=1.e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);
  }
  vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
  void main(){
    vec4 a=sampleFrame(floor(frame),spriteUV),b=sampleFrame(mod(floor(frame)+1.,frameCount),spriteUV+nextOffset);
    float t=fract(frame)*blendFrames,alpha=mix(a.a,b.a,t);if(alpha<.035)discard;
    vec3 colour=mix(a.rgb*a.a,b.rgb*b.a,t)/max(alpha,.001);
    // Translucent red upper masses above a full, luminous core, as in the reference.
    alpha*=mix(.82,1.,smoothstep(.05,.7,colour.g));
    vec3 hsv=rgb2hsv(colour);hsv.x=fract(hsv.x+hue);
    gl_FragColor=vec4(hsv2rgb(hsv),smoothstep(.035,.18,alpha)*alpha*opacity);
    #include <colorspace_fragment>
  }
`;
/** Owns geometry/material. The caller owns native-resolution shared texture pages. */
export class SpriteFire extends THREE.Group {
  readonly mesh:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
  readonly uniforms;
  sourceOnly=false;
  private readonly tongues:Tongue[]=[];
  private readonly centres:THREE.InstancedBufferAttribute;
  private readonly sizes:THREE.InstancedBufferAttribute;
  private readonly states:THREE.InstancedBufferAttribute;
  private readonly sortPoint=new THREE.Vector3();
  private readonly viewDirection=new THREE.Vector3();
  private time=0;
  constructor(readonly cycle:FireCycle,readonly spec:SpriteFireSpec){
    super();this.name='Drawn fire · '+spec.arrangement;
    const add=(x:number,y:number,z:number,h:number,angle=0,rate=1)=>{const n=this.tongues.length;this.tongues.push({x,y,z,h,angle,rate,phase:n===0?0:random(n+(spec.seed??1)*31)*cycle.frameCount,ember:false});};
    switch(spec.arrangement){
      case 'torch':add(0,0,0,3.7);break;
      case 'bonfire':add(0,0,.25,3.8);add(-.65,0,-.25,2.7,0,.93);add(.65,0,-.15,2.55,0,1.07);break;
      case 'wall':add(-1.08,0,0,1.9);add(1.08,0,.03,1.8,0,1.04);break;
      case 'ring':for(let i=0;i<10;i++){const a=i*Math.PI/5;add(Math.cos(a)*1.5,0,Math.sin(a)*1.5,1.9+random(i)*.35);}break;
      case 'jet':for(let i=0;i<6;i++)add(-1.75+i*.52,1.05,0,1.8+i*.1,-Math.PI/2,1.25);break;
      case 'wisp':add(0,.18,0,3.9,0,.72);break;
      case 'vortex':for(let i=0;i<5;i++){const a=i*2.4;add(Math.cos(a)*.7,i*.35,Math.sin(a)*.7,2.15);}break;
      case 'embers':add(0,0,0,1.6,0,.8);break;
    }
    const bodies=this.tongues.length,emberCount=spec.arrangement==='embers'?24:spec.arrangement==='jet'?10:6;
    for(let i=0;i<emberCount;i++)this.tongues.push({x:0,y:0,z:0,h:.18,phase:random(i+91)*cycle.frameCount,rate:1,angle:0,ember:true});
    const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=quad.index;geometry.attributes=quad.attributes;
    this.centres=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*3),3).setUsage(THREE.DynamicDrawUsage);
    this.sizes=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*2),2).setUsage(THREE.DynamicDrawUsage);
    this.states=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*4),4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('centre',this.centres);geometry.setAttribute('size',this.sizes);geometry.setAttribute('state',this.states);geometry.instanceCount=this.tongues.length;
    const [a,b=a]=cycle.pages;
    this.uniforms={atlas:{value:cycle.textures[0]},atlasNext:{value:cycle.textures[1]??cycle.textures[0]},atlasSize:{value:new THREE.Vector2(a.width,a.height)},nextAtlasSize:{value:new THREE.Vector2(b.width,b.height)},grid:{value:new THREE.Vector2(a.columns,a.rows)},nextGrid:{value:new THREE.Vector2(b.columns,b.rows)},firstPageCount:{value:a.count},frameCount:{value:cycle.frameCount},fps:{value:cycle.fps},anchors:{value:Array.from({length:16},(_,i)=>new THREE.Vector2(...cycle.frames[i%cycle.frameCount].anchor))},time:{value:0},hue:{value:spec.hue},blendFrames:{value:0}};
    const material=new THREE.ShaderMaterial({name:'Individually drawn flame · '+cycle.id,uniforms:this.uniforms,vertexShader,fragmentShader,transparent:true,blending:THREE.AdditiveBlending,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.frustumCulled=false;this.add(this.mesh);
    // Existing Jak framebuffer pass and rising pocket writer, unchanged.
    attachFlameHeat(this,emit=>{
      const indices=bodies===1?[0]:[0,Math.floor(bodies/2)];
      for(const index of this.sourceOnly?[0]:indices){
        const p=this.tongues[index],scale=this.sourceOnly?1.7:Math.min(2.3,p.h*.55);
        writeTorchHeat((x,y,z,w,h,heat,phase)=>{
          if(this.sourceOnly)emit(x,y,z,w,h,heat,phase);
          else if(spec.arrangement==='jet')emit(p.x+y,p.y-x,p.z+z,w,h,heat,phase);
          else emit(p.x+x,p.y+y,p.z+z,w,h,heat,phase);
        },this.time,-.25*scale,scale,1,index+(spec.seed??1)*7);
      }
    },[this.mesh]);
  }
  update(time:number,camera:THREE.Camera){
    this.time=time;this.uniforms.time.value=time;this.updateMatrixWorld();
    const jet=this.spec.arrangement==='jet',aspect=this.cycle.width/this.cycle.height;
    let jetAngle=-Math.PI/2;
    if(jet){this.viewDirection.set(1,0,0).transformDirection(camera.matrixWorldInverse);jetAngle=Math.atan2(this.viewDirection.y,this.viewDirection.x)-Math.PI/2;}
    const sorted=(this.sourceOnly?this.tongues.slice(0,1):this.tongues).map((p,i)=>{
      let {x,y,z,h,angle,rate,phase}=p,alpha=1;
      if(this.sourceOnly){x=y=z=angle=phase=0;rate=1;h=this.cycle.id==='broad'?2.4:3.7;}
      else if(p.ember){
        const age=fract(time*(this.spec.arrangement==='embers'?.28:.42)+p.phase),a=p.phase*7,spread=this.spec.arrangement==='wall'?2:.75;
        x=Math.sin(a)*spread+Math.sin(time*1.1+a)*age*.4;z=Math.cos(a)*.6;y=age*(this.spec.arrangement==='embers'?4.5:3.9)+.25;
        h=.035+random(i)*.045;alpha=Math.sin(age*Math.PI)*.7;
        if(jet){x=-1.4+age*5.2;y=1.05+Math.sin(a)*age*.7;angle=jetAngle;}
      }else{
        if(jet){const age=fract(time*1.65+i/6);angle=jetAngle;x=-1.9+age*3.7;y=1.05;h*=.6+age*.5;alpha=Math.min(1,age/.1,(1-age)/.2);}
        if(this.spec.arrangement==='vortex'){const a=time*.8+i*2.4;x=Math.cos(a)*(.7-i*.05);z=Math.sin(a)*(.7-i*.05);}
      }
      const depth=this.sortPoint.set(x,y,z).applyMatrix4(this.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
      return {x,y,z,w:h*aspect,h,angle,alpha,depth,phase,rate};
    }).sort((a,b)=>a.depth-b.depth);
    this.mesh.geometry.instanceCount=sorted.length;
    sorted.forEach((v,i)=>{this.centres.setXYZ(i,v.x,v.y,v.z);this.sizes.setXY(i,v.w,v.h);this.states.setXYZW(i,v.angle,v.phase,v.rate,v.alpha);});
    this.centres.needsUpdate=this.sizes.needsUpdate=this.states.needsUpdate=true;
  }
  get drawingFrame(){return Math.floor(this.time*this.drawingRate)%this.cycle.frameCount;}
  get drawingRate(){return this.cycle.fps*(this.sourceOnly?1:this.tongues[0].rate);}
  dispose(){this.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
  get spriteCount(){return this.tongues.length;}
}
