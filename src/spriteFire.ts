import * as THREE from 'three';
import {attachFlameHeat} from './flameHeatSource';
import {writeTorchHeat} from './torchHeat';
export type FireArrangement='torch'|'bonfire'|'wall'|'ring'|'jet'|'wisp'|'vortex'|'embers';
export type FireFamily='narrow'|'medium'|'broad';
export interface FireCycleData {
  id:FireFamily;width:number;height:number;fps:number;frameCount:number;
  motionId?:string;
  pages:{file:string;columns:number;rows:number;first:number;count:number;width:number;height:number}[];
  frames:{file:string;anchor:[number,number];sha256:string}[];
  // A single imagegen painting supplies the same colour treatment to every
  // native source frame. The flipbook supplies motion and intensity; one
  // material remaps its colour and opacity consistently across the cycle.
  paint?:{file:string;sha256:string;swatches:[number,number,number][]};
}
export interface FireCycle extends FireCycleData {textures:THREE.Texture[]}
export interface SpriteFireSpec {arrangement:FireArrangement;family:FireFamily;hue:number;seed?:number;phase?:number}
interface Tongue {x:number;y:number;z:number;w:number;h:number;phase:number;rate:number;angle:number}
const fract=(n:number)=>n-Math.floor(n),random=(n:number)=>fract(Math.sin(n*127.1+311.7)*43758.5453);
const vertexShader=/* glsl */`
  attribute vec3 centre;
  attribute vec2 size;
  attribute vec4 state;
  uniform float time, frameCount, fps, baseFlare;
  uniform vec2 anchors[64];
  varying vec2 spriteUV, nextOffset;
  varying float frame, opacity;
  void main(){
    spriteUV=uv;frame=mod(time*fps*state.z+state.y,frameCount);opacity=state.w;
    vec2 foot=anchors[int(floor(frame))];
    nextOffset=anchors[int(mod(floor(frame)+1.,frameCount))]-foot;
    // Register the foot using one fixed authored width/height for the whole cycle.
    // The basin uses a broad single body; ordinary tongues keep the native aspect.
    // World scale also scales the shared heat source.
    vec2 local=(uv-foot)*size*length(modelMatrix[1].xyz);
    // A fixed flare seats the single basin sheet across its fuel bed while
    // keeping the upper plume slender. It never changes with frame or time.
    local.x*=1.+baseFlare*(1.-smoothstep(.08,.6,uv.y));
    float c=cos(state.x),s=sin(state.x);
    vec4 viewed=modelViewMatrix*vec4(centre,1.0);
    viewed.xy+=mat2(c,s,-s,c)*local;gl_Position=projectionMatrix*viewed;
  }
`;
const fragmentShader=(pages:FireCycleData['pages'])=>/* glsl */`
  ${pages.map((_,i)=>'uniform sampler2D atlas'+i+';').join('\n')}
  uniform float frameCount, hue, blendFrames;
  uniform float sourcePaint, screenBlend;
  uniform vec3 paintColours[6];
  varying vec2 spriteUV, nextOffset;
  varying float frame, opacity;
  vec4 sampleFrame(float f,vec2 uv){
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec4(0.);
    ${pages.map((p,i)=>`
    if(f<${(p.first+p.count).toFixed(1)}){
      float localFrame=f-${p.first.toFixed(1)};
      vec2 grid=vec2(${p.columns.toFixed(1)},${p.rows.toFixed(1)});
      vec2 cell=vec2(mod(localFrame,grid.x),grid.y-1.-floor(localFrame/grid.x));
      vec2 inset=.5/vec2(${p.width.toFixed(1)},${p.height.toFixed(1)});
      return texture2D(atlas${i},cell/grid+inset+uv*(1./grid-2.*inset));
    }`).join('\n')}
    return vec4(0.);
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
    if(sourcePaint>.5){
      // The same lookup for every frame: no per-frame repainting, exposure
      // normalisation, warped images or new procedural flame shapes.
      // These supplied flipbooks store much of the fire's intensity in alpha.
      // Using RGB alone turns the translucent red sheets into a white ghost.
      float energy=clamp(dot(colour,vec3(.2126,.7152,.0722))*alpha,0.,1.);
      float temperature=clamp(pow(energy,.58)*5.,0.,5.);
      temperature=floor(temperature)+smoothstep(.32,.68,fract(temperature));
      colour=mix(paintColours[0],paintColours[1],clamp(temperature,0.,1.));
      for(int i=1;i<5;i++)colour=mix(colour,paintColours[i+1],clamp(temperature-float(i),0.,1.));
      alpha=smoothstep(.06,.15,alpha);
    }else{
      alpha*=mix(.82,1.,smoothstep(.05,.7,colour.g));
    }
    vec3 hsv=rgb2hsv(colour);hsv.x=fract(hsv.x+hue);
    gl_FragColor=vec4(hsv2rgb(hsv),smoothstep(.035,.18,alpha)*alpha*opacity);
    #include <colorspace_fragment>
    // Screen compositing keeps overlapping source sheets luminous without
    // adding their colour above white. Premultiply after output conversion.
    if(screenBlend>.5)gl_FragColor.rgb*=gl_FragColor.a;
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
    super();this.name='Sprite fire · '+spec.arrangement;
    const add=(x:number,y:number,z:number,h:number,angle=0,rate=1,w=h*cycle.width/cycle.height)=>{const n=this.tongues.length;this.tongues.push({x,y,z,w,h,angle,rate,phase:n===0?(spec.phase??0):random(n+(spec.seed??1)*31)*cycle.frameCount});};
    switch(spec.arrangement){
      case 'torch':add(0,0,0,3.7);break;
      // One connected source body across the basin, with no repeated feet or
      // independently timed outlines. Width is constant through all 64 frames.
      case 'bonfire':add(0,0,0,3.8,0,1,4.0);break;
      case 'wall':
        if(cycle.paint){for(let i=0;i<7;i++)add((i-3)*.48,0,(i%2)*.06,1.8+random(i+4)*.35,0,.94+random(i+19)*.12);}
        else{add(-1.08,0,0,1.9);add(1.08,0,.03,1.8,0,1.04);}break;
      case 'ring':for(let i=0;i<10;i++){const a=i*Math.PI/5;add(Math.cos(a)*1.5,0,Math.sin(a)*1.5,1.9+random(i)*.35);}break;
      case 'jet':
        if(cycle.paint){add(-1.8,1.05,0,4.1,-Math.PI/2,1.15);add(-1.8,1.05,.08,3.5,-Math.PI/2,1.03);}
        else for(let i=0;i<6;i++)add(-1.75+i*.52,1.05,0,1.8+i*.1,-Math.PI/2,1.25);break;
      case 'wisp':add(0,.18,0,3.9,0,.72);break;
      case 'vortex':for(let i=0;i<5;i++){const a=i*2.4;add(Math.cos(a)*.7,i*.35,Math.sin(a)*.7,2.15);}break;
      case 'embers':
        if(cycle.paint){for(let i=0;i<5;i++)add((i-2)*.37,0,(i%2)*.08,1.35+random(i+8)*.3,0,.8+random(i+7)*.12);}
        else add(0,0,0,1.6,0,.8);break;
    }
    const bodies=this.tongues.length;
    const quad=new THREE.PlaneGeometry(1,1,1,spec.arrangement==='bonfire'?24:1),geometry=new THREE.InstancedBufferGeometry();geometry.index=quad.index;geometry.attributes=quad.attributes;
    this.centres=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*3),3).setUsage(THREE.DynamicDrawUsage);
    this.sizes=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*2),2).setUsage(THREE.DynamicDrawUsage);
    this.states=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*4),4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('centre',this.centres);geometry.setAttribute('size',this.sizes);geometry.setAttribute('state',this.states);geometry.instanceCount=this.tongues.length;
    if(cycle.frameCount>64||cycle.pages.length>8)throw new Error('Flame cycle exceeds native atlas limits');
    const paintColours=cycle.paint?.swatches.map(c=>new THREE.Color().setRGB(c[0]/255,c[1]/255,c[2]/255,THREE.SRGBColorSpace))??Array.from({length:6},()=>new THREE.Color('white'));
    this.uniforms={atlas:{value:cycle.textures[0]},...Object.fromEntries(cycle.textures.map((texture,i)=>['atlas'+i,{value:texture}])),frameCount:{value:cycle.frameCount},fps:{value:cycle.fps},anchors:{value:Array.from({length:64},(_,i)=>new THREE.Vector2(...cycle.frames[i%cycle.frameCount].anchor))},time:{value:0},baseFlare:{value:spec.arrangement==='bonfire'?1.1:0},hue:{value:spec.hue},blendFrames:{value:0},sourcePaint:{value:cycle.paint?1:0},screenBlend:{value:cycle.paint?1:0},paintColours:{value:paintColours}};
    const material=new THREE.ShaderMaterial({name:(cycle.paint?'Sourced flame · ':'Individually drawn flame · ')+cycle.id,uniforms:this.uniforms,vertexShader,fragmentShader:fragmentShader(cycle.pages),transparent:true,blending:cycle.paint?THREE.CustomBlending:THREE.AdditiveBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcColorFactor,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.frustumCulled=false;this.add(this.mesh);
    // Existing Jak framebuffer pass and rising pocket writer, unchanged.
    attachFlameHeat(this,emit=>{
      const indices=bodies===1?[0]:[0,Math.floor(bodies/2)];
      for(const index of this.sourceOnly?[0]:indices){
        const p=this.tongues[index],scale=this.sourceOnly?1.7:Math.min(2.3,p.h*.55);
        const footprint=p.w/(p.h*cycle.width/cycle.height);
        writeTorchHeat((x,y,z,w,h,heat,phase)=>{
          if(this.sourceOnly)emit(x,y,z,w,h,heat,phase);
          else if(spec.arrangement==='jet')emit(p.x+y,p.y-x,p.z+z,w,h,heat,phase);
          else emit(p.x+x*footprint,p.y+y,p.z+z*footprint,w*Math.sqrt(footprint),h,heat,phase);
        },this.time,-.25*scale,scale,1,index+(spec.seed??1)*7);
      }
    },[this.mesh]);
  }
  update(time:number,camera:THREE.Camera){
    this.time=time;this.uniforms.time.value=time;this.uniforms.baseFlare.value=!this.sourceOnly&&this.spec.arrangement==='bonfire'?1.1:0;this.updateMatrixWorld();
    const jet=this.spec.arrangement==='jet',aspect=this.cycle.width/this.cycle.height;
    let jetAngle=-Math.PI/2;
    if(jet){this.viewDirection.set(1,0,0).transformDirection(camera.matrixWorldInverse);jetAngle=Math.atan2(this.viewDirection.y,this.viewDirection.x)-Math.PI/2;}
    const sorted=(this.sourceOnly?this.tongues.slice(0,1):this.tongues).map((p,i)=>{
      let {x,y,z,w,h,angle,rate,phase}=p,alpha=1;
      if(this.sourceOnly){x=y=z=angle=phase=0;rate=1;h=this.cycle.id==='broad'?2.4:3.7;w=h*aspect;}
      else{
        if(jet){angle=jetAngle;if(!this.cycle.paint){const age=fract(time*1.65+i/6);x=-1.9+age*3.7;y=1.05;h*=.6+age*.5;w=h*aspect;alpha=Math.min(1,age/.1,(1-age)/.2);}}
        if(this.spec.arrangement==='vortex'){const a=time*.8+i*2.4;x=Math.cos(a)*(.7-i*.05);z=Math.sin(a)*(.7-i*.05);}
      }
      const depth=this.sortPoint.set(x,y,z).applyMatrix4(this.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
      return {x,y,z,w,h,angle,alpha,depth,phase,rate};
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
