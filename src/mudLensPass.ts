import {RALLY_SUN} from './rallyMaterials';
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import type { MudLensState } from './golf-cart/cartMud';

/** Rally-only colour and soft mud on the camera glass, before the HUD/CRT.
 * Analytic silhouettes share the existing composer buffers; no image assets. */
export class MudLensPass extends Pass {
  private readonly material=new THREE.ShaderMaterial({
    uniforms:{tScene:{value:null},uAspect:{value:1},uSun:{value:new THREE.Vector4(-10,-10,0,0)},uSplat:{value:Array.from({length:12},()=>new THREE.Vector4())},uLife:{value:Array.from({length:12},()=>new THREE.Vector4())}},
    depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:/* glsl */`
      uniform sampler2D tScene;
      uniform float uAspect;uniform vec4 uSun;
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
          float rim=.87+.13*sin(angle*3.0+seed)+.08*sin(angle*5.0-seed);
          float mainBody=1.0-smoothstep(rim*.40,rim*1.40,r);
          vec2 tail=q-vec2(.32*sin(seed),-.73);
          float run=1.0-smoothstep(.22,.91,length(tail*vec2(1.7,.68)));
          float body=max(mainBody,run*.64)*fade;
          // Broad feathering makes these out-of-focus lens smears, not decals.
          mask=1.0-(1.0-mask)*(1.0-body*.67);
          edge+=exp(-pow((r-rim)*6.0,2.0))*fade*.09;
          bend+=q*body*.0018;
        }
        float centreClear=smoothstep(.19,.36,length((vUv-.5)*vec2(uAspect,1.0)));
        mask*=centreClear;edge*=centreClear;bend*=centreClear;
        vec2 uv=clamp(vUv+bend,vec2(.002),vec2(.998));
        vec3 original=texture2D(tScene,uv).rgb;
        vec2 blur=vec2(.007/uAspect,.007)*mask;
        vec3 softened=(texture2D(tScene,uv+blur).rgb+texture2D(tScene,uv-blur).rgb+texture2D(tScene,uv+vec2(blur.x,-blur.y)).rgb+texture2D(tScene,uv+vec2(-blur.x,blur.y)).rgb)*.25;
        vec3 colour=mix(original,softened,mask*.7);
        float luma=dot(colour,vec3(.2126,.7152,.0722));
        colour=mix(vec3(luma),colour,1.12)*vec3(1.025,1.01,.98);
        colour+=vec3(.018,.010,.002)*smoothstep(.15,.9,luma);
        float vignette=smoothstep(.3,.95,length((vUv-.5)*vec2(1.0,.85)));
        colour*=1.0-vignette*.13;
        vec3 mud=vec3(.072,.047,.023)+vec3(.035,.027,.015)*edge;
        colour=mix(colour,mud,mask)+edge*centreClear*vec3(.028,.017,.005);
        // Three weak lens ghosts reuse this pass. Sampling the rendered sun
        // suppresses the flare behind stands/canopies; no occlusion readback or
        // separate flare render target. Offscreen/behind-camera sun is zero.
        if(uSun.z>0.0){
          vec2 sun=clamp(uSun.xy,vec2(.002),vec2(.998));
          vec3 hot=texture2D(tScene,sun).rgb;
          float seen=smoothstep(.88,1.12,dot(hot,vec3(.2126,.7152,.0722)))*uSun.z;
          vec2 axis=vec2(.5)-sun;
          float ghosts=0.0;
          for(int j=0;j<3;j++){
            float f=float(j),size=.027+f*.022;
            vec2 at=sun+axis*(1.35+f*.52),d=(vUv-at)*vec2(uAspect,1.0);
            float rr=length(d)/size;
            ghosts+=(1.0-smoothstep(.65,1.0,rr))*(.024-f*.005);
          }
          vec2 d=(vUv-sun)*vec2(uAspect,1.0);
          float veil=exp(-dot(d,d)*11.0)*.045;
          colour+=seen*(ghosts*vec3(.65,.80,.51)+veil*vec3(1.0,.62,.24))*(1.0-mask*.85);
        }
        gl_FragColor=vec4(max(vec3(0.0),colour),1.0);
      }
    `,
  });
  private readonly quad=new FullScreenQuad(this.material);
  private activeSplats=0;
  private readonly sunPoint=new THREE.Vector3();
  private readonly sunDirection=new THREE.Vector3(...RALLY_SUN).normalize();
  private readonly cameraDirection=new THREE.Vector3();
  setSun(camera?:THREE.Camera){
    const sun=this.material.uniforms.uSun.value;
    if(!camera||!this.enabled){sun.z=0;return;}
    camera.getWorldDirection(this.cameraDirection);
    this.sunPoint.copy(this.sunDirection).multiplyScalar(10000).add(camera.position).project(camera);
    const x=this.sunPoint.x*.5+.5,y=this.sunPoint.y*.5+.5;
    const visible=this.cameraDirection.dot(this.sunDirection)>0&&x>0&&x<1&&y>0&&y<1;
    const fade=visible?THREE.MathUtils.smoothstep(Math.min(x,1-x,y,1-y),0,.06):0;
    sun.set(x,y,fade,0);
  }
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
  get diagnostics(){return {enabled:this.enabled,splats:this.activeSplats,sun:this.material.uniforms.uSun.value.toArray()};}
  render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget){
    this.material.uniforms.tScene.value=readBuffer.texture;this.material.uniforms.uAspect.value=readBuffer.width/readBuffer.height;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
  }
  dispose(){this.material.dispose();this.quad.dispose();}
}
