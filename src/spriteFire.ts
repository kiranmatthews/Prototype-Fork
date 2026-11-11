import * as THREE from 'three';
import {attachFlameHeat} from './flameHeatSource';
import {writeTorchHeat} from './torchHeat';

export type FireArrangement='torch'|'bonfire'|'wall'|'ring'|'jet'|'wisp'|'vortex'|'embers';
export interface SpriteFireSpec {arrangement:FireArrangement;hue:number;seed?:number}
interface Tongue {x:number;y:number;z:number;w:number;h:number;phase:number;speed:number;angle:number;ember:boolean}
const fract=(n:number)=>n-Math.floor(n);
const random=(n:number)=>fract(Math.sin(n*127.1+311.7)*43758.5453);

const vertexShader=/* glsl */`
  attribute vec3 centre;
  attribute vec2 size;
  attribute vec4 state;
  uniform float time;
  varying vec2 spriteUV;
  varying float frame, opacity;
  void main(){
    spriteUV=uv;
    frame=mod(time*state.z+state.y,16.0);
    opacity=state.w;
    // Real camera-facing quads, anchored at the painted flame's foot.
    vec2 local=vec2((uv.x-.5)*size.x,(uv.y-.085)*size.y);
    local.x+=sin(time*4.1+state.y+uv.y*2.0)*.025*size.x*uv.y*uv.y;
    float c=cos(state.x),s=sin(state.x);
    vec4 viewed=modelViewMatrix*vec4(centre,1.0);
    viewed.xy+=mat2(c,s,-s,c)*local;
    gl_Position=projectionMatrix*viewed;
  }
`;
const fragmentShader=/* glsl */`
  uniform sampler2D atlas;
  uniform vec2 atlasSize;
  uniform float hue, blendFrames;
  varying vec2 spriteUV;
  varying float frame, opacity;
  vec4 sampleFrame(float f){
    vec2 cell=vec2(mod(f,4.0),3.0-floor(f/4.0));
    vec2 inset=.5/atlasSize;
    return texture2D(atlas,cell*.25+inset+spriteUV*(.25-2.0*inset));
  }
  vec3 rgb2hsv(vec3 c){
    vec4 K=vec4(0.,-1./3.,2./3.,-1.);
    vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
    vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
    float d=q.x-min(q.w,q.y),e=1.e-10;
    return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);
  }
  vec3 hsv2rgb(vec3 c){
    vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);
    return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);
  }
  void main(){
    vec4 a=sampleFrame(floor(frame)),b=sampleFrame(mod(floor(frame)+1.,16.));
    // Interpolate premultiplied colour so transparent texels cannot darken a rim.
    float t=fract(frame)*blendFrames;
    float alpha=mix(a.a,b.a,t);
    if(alpha<.035)discard;
    vec3 colour=mix(a.rgb*a.a,b.rgb*b.a,t)/max(alpha,.001);
    vec3 hsv=rgb2hsv(colour);hsv.x=fract(hsv.x+hue);
    gl_FragColor=vec4(hsv2rgb(hsv),smoothstep(.035,.18,alpha)*alpha*opacity);
    #include <colorspace_fragment>
  }
`;

/** A single generated atlas, one instanced draw per emitter, no mesh flames.
 * Owns its geometry/material; the caller owns and shares the atlas texture. */
export class SpriteFire extends THREE.Group {
  readonly mesh:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
  readonly uniforms;
  private readonly tongues:Tongue[]=[];
  private readonly centres:THREE.InstancedBufferAttribute;
  private readonly sizes:THREE.InstancedBufferAttribute;
  private readonly states:THREE.InstancedBufferAttribute;
  private readonly sortPoint=new THREE.Vector3();
  private readonly viewDirection=new THREE.Vector3();
  private time=0;
  constructor(atlas:THREE.Texture,readonly spec:SpriteFireSpec){
    super();this.name=`Sprite fire · ${spec.arrangement}`;
    const add=(x:number,y:number,z:number,w:number,h:number,angle=0,speed=13)=>{
      const n=this.tongues.length+(spec.seed??1)*31;
      this.tongues.push({x,y,z,w,h,angle,speed,phase:random(n)*16,ember:false});
    };
    switch(spec.arrangement){
      case 'torch':add(0,0,0,2.0,3.2);add(-.32,0,.08,1.05,2.25,.12,16);add(.3,0,.16,1.0,2.1,-.15,15);break;
      case 'bonfire':
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;add(Math.cos(a)*.7,0,Math.sin(a)*.65,1.7,2.5+random(i)*1.3,(random(i+1)-.5)*.3,11+i*.7);}add(0,0,0,2.3,4.3);break;
      case 'wall':for(let i=0;i<7;i++)add((i-3)*.62,0,0,1.45,2.4+random(i)*.85,0,12+random(i+2)*5);break;
      case 'ring':for(let i=0;i<12;i++){const a=i*Math.PI/6;add(Math.cos(a)*1.5,0,Math.sin(a)*1.5,1.0,1.9+random(i)*.6,0,12+i*.3);}break;
      case 'jet':for(let i=0;i<7;i++)add(-1.75+i*.52,1.05,0,1.0+i*.045,1.6+i*.10,-Math.PI/2,18+i*.7);break;
      case 'wisp':add(0,.15,0,1.65,3.8,0,9);add(-.38,.5,.12,.8,2.5,.28,11);add(.38,.3,.2,.9,2.8,-.23,10);break;
      case 'vortex':for(let i=0;i<9;i++){const a=i*2.4;add(Math.cos(a)*.9,i*.28,Math.sin(a)*.9,1.1,2.0,0,14+i*.25);}break;
      case 'embers':for(let i=0;i<6;i++){const a=i*2.4;add(Math.cos(a)*.65,0,Math.sin(a)*.65,.8,1.2,0,9+i*.5);}break;
    }
    const bodies=this.tongues.length;
    const emberCount=spec.arrangement==='embers'?30:spec.arrangement==='jet'?12:10;
    for(let i=0;i<emberCount;i++)this.tongues.push({x:0,y:0,z:0,w:.08,h:.18,phase:random(i+91)*16,speed:10,angle:0,ember:true});
    const quad=new THREE.PlaneGeometry(1,1);
    const geometry=new THREE.InstancedBufferGeometry();geometry.index=quad.index;geometry.attributes=quad.attributes;
    this.centres=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*3),3).setUsage(THREE.DynamicDrawUsage);
    this.sizes=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*2),2).setUsage(THREE.DynamicDrawUsage);
    this.states=new THREE.InstancedBufferAttribute(new Float32Array(this.tongues.length*4),4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('centre',this.centres);geometry.setAttribute('size',this.sizes);geometry.setAttribute('state',this.states);
    geometry.instanceCount=this.tongues.length;
    this.uniforms={atlas:{value:atlas},atlasSize:{value:new THREE.Vector2(atlas.image.width,atlas.image.height)},
      time:{value:0},hue:{value:spec.hue},blendFrames:{value:1}};
    const material=new THREE.ShaderMaterial({name:'Painted flame atlas · hue transform',uniforms:this.uniforms,vertexShader,fragmentShader,
      transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.frustumCulled=false;this.add(this.mesh);
    // Reuse the game's small rising Jak heat pockets, with the same pass and
    // source proportions. Two representative streams keep all eight displays
    // below its shared 512-pocket budget; flames and heat stay independently visible.
    attachFlameHeat(this,emit=>{
      for(const index of [0,Math.max(1,Math.floor(bodies/2))]){
        const p=this.tongues[index],scale=p.w*.65/.6;
        writeTorchHeat((x,y,z,w,h,heat,phase)=>{
          if(spec.arrangement==='jet')emit(p.x+y,p.y-x,p.z+z,w,h,heat,phase);
          else emit(p.x+x,p.y+y,p.z+z,w,h,heat,phase);
        },this.time,-.25*scale,scale,1,index+(spec.seed??1)*7);
      }
    },[this.mesh]);
  }
  update(time:number,camera:THREE.Camera){
    this.time=time;this.uniforms.time.value=time;
    this.updateMatrixWorld();
    const jet=this.spec.arrangement==='jet';
    let jetAngle=-Math.PI/2;
    if(jet){this.viewDirection.set(1,0,0).transformDirection(camera.matrixWorldInverse);jetAngle=Math.atan2(this.viewDirection.y,this.viewDirection.x)-Math.PI/2;}
    const sorted=this.tongues.map((p,i)=>{
      let {x,y,z,w,h,angle}=p,alpha=1;
      if(p.ember){
        const age=fract(time*(this.spec.arrangement==='embers'?.28:.42)+p.phase),a=p.phase*7;
        const spread=this.spec.arrangement==='wall'?2.0:.75;
        x=Math.sin(a)*spread+Math.sin(time*1.1+a)*age*.4;z=Math.cos(a)*.6;y=age*(this.spec.arrangement==='embers'?4.5:3.9)+.25;
        w=.055+random(i)*.08;h=w*2.2;alpha=Math.sin(age*Math.PI)*.9;
        if(jet){x=-1.4+age*5.2;y=1.05+Math.sin(a)*age*.7;angle=jetAngle;}
      }else{
        const pulse=1+Math.sin(time*5+p.phase)*.035;h*=pulse;
        if(jet){
          const age=fract(time*1.65+i/7);angle=jetAngle;
          x=-1.9+age*3.7;y=1.05+Math.sin(time*8+p.phase)*.06*age;
          w*=.45+age*.55;h*=.65+age*.55;
          alpha=Math.min(1,age/.1,(1-age)/.2);
        }
        if(this.spec.arrangement==='wisp')y+=Math.sin(time*1.6+p.phase)*.12;
        if(this.spec.arrangement==='vortex'){const a=time*.8+i*2.4;x=Math.cos(a)*(.9-i*.05);z=Math.sin(a)*(.9-i*.05);}
      }
      const depth=this.sortPoint.set(x,y,z).applyMatrix4(this.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
      return {p,x,y,z,w,h,angle,alpha,depth};
    }).sort((a,b)=>a.depth-b.depth);
    sorted.forEach((v,i)=>{this.centres.setXYZ(i,v.x,v.y,v.z);this.sizes.setXY(i,v.w,v.h);this.states.setXYZW(i,v.angle,v.p.phase,v.p.speed,v.alpha);});
    this.centres.needsUpdate=this.sizes.needsUpdate=this.states.needsUpdate=true;
  }
  dispose(){this.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
  get spriteCount(){return this.tongues.length;}
}
