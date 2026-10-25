import * as THREE from 'three';
import {FullScreenQuad,Pass} from 'three/examples/jsm/postprocessing/Pass.js';

/** Sparse refractive lens water, in linear scene colour before the HUD/CRT.
 * Two analytic bead sizes need no downloaded textures or extra render target. */
export class RainLensPass extends Pass {
 private readonly material=new THREE.ShaderMaterial({
  uniforms:{tScene:{value:null},uTime:{value:0},uAmount:{value:0},uAspect:{value:1}},
  depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:/* glsl */`
   uniform sampler2D tScene;
   uniform float uTime,uAmount,uAspect;
   varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   vec4 beads(vec2 uv,float scale,float seed){
    vec2 p=uv*vec2(uAspect,1.0)*scale,cell=floor(p),local=fract(p)-.5;
    float h=hash(cell+seed),age=fract(uTime*(.035+h*.025)+h*9.0);
    float exists=step(h,.09*uAmount)*smoothstep(.0,.07,age)*(1.0-smoothstep(.84,1.0,age));
    float slide=smoothstep(.3,.9,age);
    vec2 centre=vec2((hash(cell+seed+19.0)-.5)*.5,.2-slide*.43);
    centre.x+=sin(age*9.0+h*21.0)*.015*slide;
    vec2 q=local-centre;
    float radius=.055+hash(cell+seed+43.0)*.075;
    q.y/=1.0+slide*.35;
    q.x*=1.0+smoothstep(-radius,radius,q.y)*.26;
    float r=length(q)/radius,inside=1.0-smoothstep(.88,1.0,r);
    vec2 normal=q/radius;
    float dome=sqrt(max(0.0,1.0-r*r));
    vec2 bend=normal*dome*(.095/scale)*exists;
    float rim=exp(-pow((r-.85)*16.0,2.0));
    float light=(max(0.0,normal.y*.7-normal.x*.5)*.20-.055)*rim*exists;
    return vec4(bend,light,inside*exists);
   }
   void main(){
    vec4 a=beads(vUv,7.0,2.0),b=beads(vUv,17.0,31.0);
    float periphery=smoothstep(.16,.34,length((vUv-.5)*vec2(uAspect,1.0)));
    vec2 bend=(a.xy+b.xy)*periphery/vec2(uAspect,1.0);
    vec3 colour=texture2D(tScene,clamp(vUv+bend,vec2(.001),vec2(.999))).rgb;
    colour=colour*(1.0-(a.w+b.w)*.045*periphery)+(a.z+b.z)*periphery;
    gl_FragColor=vec4(max(vec3(0.0),colour),1.0);
   }
  `,
 });
 private readonly quad=new FullScreenQuad(this.material);
 constructor(){super();this.enabled=false;}
 get diagnostics(){return {enabled:this.enabled,amount:this.material.uniforms.uAmount.value,time:this.material.uniforms.uTime.value};}
 setWeather(amount:number,time:number):void {this.material.uniforms.uAmount.value=amount;this.material.uniforms.uTime.value=time;this.enabled=amount>0;}
 render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget):void {
  this.material.uniforms.tScene.value=readBuffer.texture;this.material.uniforms.uAspect.value=readBuffer.width/readBuffer.height;
  renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
 }
 dispose():void {this.material.dispose();this.quad.dispose();}
}
