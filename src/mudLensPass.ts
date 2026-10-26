import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import type { MudLensState } from './golf-cart/cartMud';

/** Rally-only colour and soft mud on the camera glass, before the HUD/CRT.
 * Analytic silhouettes share the existing composer buffers; no image assets. */
export class MudLensPass extends Pass {
  private readonly material=new THREE.ShaderMaterial({
    uniforms:{tScene:{value:null},uAspect:{value:1},uSplat:{value:Array.from({length:12},()=>new THREE.Vector4())},uLife:{value:Array.from({length:12},()=>new THREE.Vector4())}},
    depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:/* glsl */`
      uniform sampler2D tScene;
      uniform float uAspect;
      uniform vec4 uSplat[12],uLife[12];
      varying vec2 vUv;
      void main(){
        float mask=0.0,edge=0.0;vec2 bend=vec2(0.0);
        for(int i=0;i<12;i++){
          vec4 p=uSplat[i],life=uLife[i];
          float age=life.x,duration=life.y,seed=life.z;
          if(duration<=0.0||age>=duration)continue;
          float fade=smoothstep(0.0,.09,age)*(1.0-smoothstep(max(.1,duration-1.7),max(.2,duration),age));
          vec2 centre=p.xy-vec2(sin(seed+age)*.003,age*age*.0011);
          vec2 q=(vUv-centre)*vec2(uAspect,1.0)/max(.001,p.z);
          q.y/=1.0+age*.055;
          float angle=atan(q.y,q.x),r=length(q);
          float rim=1.0+.10*sin(angle*2.0+seed)+.065*sin(angle*3.0-seed);
          float body=(1.0-smoothstep(rim*.48,rim*1.38,r))*fade;
          // Broad feathering makes these out-of-focus lens smears, not decals.
          mask=1.0-(1.0-mask)*(1.0-body*.86);
          edge+=exp(-pow((r-rim)*6.0,2.0))*fade*.09;
          bend+=q*body*.0018;
        }
        float centreClear=smoothstep(.21,.42,length((vUv-.5)*vec2(uAspect,1.0)));
        mask*=centreClear;edge*=centreClear;bend*=centreClear;
        vec2 uv=clamp(vUv+bend,vec2(.002),vec2(.998));
        vec3 original=texture2D(tScene,uv).rgb;
        vec2 blur=vec2(.004/uAspect,.004)*mask;
        vec3 softened=(texture2D(tScene,uv+blur).rgb+texture2D(tScene,uv-blur).rgb+texture2D(tScene,uv+vec2(blur.x,-blur.y)).rgb+texture2D(tScene,uv+vec2(-blur.x,blur.y)).rgb)*.25;
        vec3 colour=mix(original,softened,mask*.7);
        float luma=dot(colour,vec3(.2126,.7152,.0722));
        colour=mix(colour,vec3(luma),.10)*vec3(1.06,1.015,.88);
        colour+=vec3(.018,.010,.002)*smoothstep(.15,.9,luma);
        float vignette=smoothstep(.3,.95,length((vUv-.5)*vec2(1.0,.85)));
        colour*=1.0-vignette*.18;
        vec3 mud=vec3(.052,.029,.012)+vec3(.033,.020,.006)*edge;
        colour=mix(colour,mud,mask)+edge*centreClear*vec3(.028,.017,.005);
        gl_FragColor=vec4(max(vec3(0.0),colour),1.0);
      }
    `,
  });
  private readonly quad=new FullScreenQuad(this.material);
  private activeSplats=0;
  constructor(){super();this.enabled=false;}
  setMud(state:MudLensState|null){
    this.enabled=state!==null;this.activeSplats=0;
    for(let i=0;i<12;i++){
      const p=state?.splats[i];
      this.material.uniforms.uSplat.value[i].set(p?.x??0,p?.y??0,p?.radius??0,0);
      this.material.uniforms.uLife.value[i].set(p?.age??1,p?.life??0,p?.seed??0,0);
      if(p&&p.age<p.life)this.activeSplats++;
    }
  }
  get diagnostics(){return {enabled:this.enabled,splats:this.activeSplats};}
  render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget){
    this.material.uniforms.tScene.value=readBuffer.texture;this.material.uniforms.uAspect.value=readBuffer.width/readBuffer.height;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
  }
  dispose(){this.material.dispose();this.quad.dispose();}
}
