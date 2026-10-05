import type {Material} from 'three';

/** A scoped, texture-aware tint gives reused coastal rocks and forest plants
 * Carlisle's moss/ochre palette. It adds no material copies or render passes. */
export function addCarlisleMaterialLook(material:Material):void{
 if(material.userData.carlisleLook)return;
 material.userData.carlisleLook=true;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
   `#include <color_fragment>
    float coastGreen = smoothstep(0.98,1.16,diffuseColor.g/max(diffuseColor.r,0.008))
      * smoothstep(1.1,1.45,diffuseColor.g/max(diffuseColor.b,0.008));
    diffuseColor.rgb *= mix(vec3(0.94,0.94,0.88),vec3(0.57,0.77,0.53),coastGreen);
   `);
 };
 material.customProgramCacheKey=()=>key()+'|carlisle-moss-ochre-v1';
}
