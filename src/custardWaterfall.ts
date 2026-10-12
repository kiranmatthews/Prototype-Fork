import * as THREE from 'three';
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
