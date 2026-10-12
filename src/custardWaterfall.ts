import * as THREE from 'three';

/** Advected billows, not a photograph of spray. The shared scenery clock
 * drives every layer; its world origin gives each sheet a different phase. */
export function custardMistMaterial(clock:{value:number}):THREE.MeshBasicMaterial {
 const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,
  side:THREE.FrontSide,fog:true,toneMapped:false});
 material.userData.waterfallMist=true;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uMistTime=clock;
  shader.vertexShader='varying vec2 vMistUv; varying float vMistPhase;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vMistUv=uv;
    vec4 mistOrigin=vec4(0.0,0.0,0.0,1.0);
    #ifdef USE_INSTANCING
      mistOrigin=instanceMatrix*mistOrigin;
    #endif
    vMistPhase=dot((modelMatrix*mistOrigin).xyz,vec3(.031,.067,.019));`);
  shader.fragmentShader=`uniform float uMistTime;
    varying vec2 vMistUv; varying float vMistPhase;
    float mistHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float mistNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(mistHash(i),mistHash(i+vec2(1,0)),f.x),
        mix(mistHash(i+vec2(0,1)),mistHash(i+vec2(1,1)),f.x),f.y);}
    float mistFbm(vec2 p){return .57*mistNoise(p)+.28*mistNoise(p*2.07+7.3)+.15*mistNoise(p*4.13+13.1);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float t=uMistTime+vMistPhase;
    vec2 uv=vMistUv;
    vec2 q=uv*vec2(14.0,4.0)-vec2(t*.24,t*.58);
    vec2 curl=vec2(mistFbm(q*.67+vec2(t*.12,3.7)),mistFbm(q*.72+vec2(9.1,-t*.13)))-.5;
    float billow=mistFbm(q+curl*2.1);
    float fine=mistNoise(q*5.7+vec2(-t*.31,t*.16));
    float threshold=mix(.45,.70,pow(uv.y,1.35));
    float density=smoothstep(threshold-.07,threshold+.13,billow);
    float edge=smoothstep(0.0,.075,uv.x)*smoothstep(0.0,.075,1.0-uv.x)
      *smoothstep(0.0,.10,uv.y)*smoothstep(0.0,.13,1.0-uv.y);
    diffuseColor.rgb*=mix(vec3(.57,.69,.70),vec3(1.0,.92,.76),billow*.7+fine*.16);
    diffuseColor.a*=density*edge*(.26+.10*fine);
  `);
 };
 material.customProgramCacheKey=()=> 'custard-moving-mist-v1';return material;
}

/** Flowing striations follow the authored crest mesh and its original normals. */
export function custardWaterfallMaterial(clock:{value:number},color:string):THREE.MeshStandardMaterial {
 const material=new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.02,side:THREE.DoubleSide,transparent:true,depthWrite:false});
 material.userData.waterSurface=true;material.userData.noWaterShore=true;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uCascadeTime=clock;
  shader.vertexShader='varying vec2 vCascadeUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCascadeUv=uv;');
  shader.fragmentShader='varying vec2 vCascadeUv; uniform float uCascadeTime;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float bands=sin(vCascadeUv.x*41.0+sin(vCascadeUv.x*19.0)*2.0+vCascadeUv.y*.6);
    bands=(bands+sin(vCascadeUv.x*73.0+vCascadeUv.y*1.2)*.4+sin(vCascadeUv.x*139.0-vCascadeUv.y*.3)*.2)/1.6;
    float travel=sin(vCascadeUv.y*34.0-uCascadeTime*12.0+vCascadeUv.x*7.0);
    float foam=smoothstep(.1,.95,bands)*(.62+.24*travel);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.94,.98,.87),clamp(foam+.16,0.,.94));
    diffuseColor.a*=smoothstep(0.,.45,vCascadeUv.y);`);
 };
 material.customProgramCacheKey=()=> 'custard-cascade-v1';return material;
}
