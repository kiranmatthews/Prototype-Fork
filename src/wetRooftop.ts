import * as THREE from 'three';

/** Rainwater film retains the authored seam bump and UV direction. Fine
 * moving ripples affect the lighting normal only, never the support mesh. */
export function addWetRooftopLook(material:THREE.Material,time:{value:number}):void {
 if(!(material instanceof THREE.MeshPhongMaterial)||material.userData.wetRooftop)return;
 material.userData.wetRooftop=true;
 material.color.multiplyScalar(.84);material.specular.set('#6e8996');material.shininess=84;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);shader.uniforms.uRoofRainTime=time;
  shader.fragmentShader='uniform float uRoofRainTime;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   #ifdef USE_MAP
    vec2 wetUv=vMapUv*4.0;
    float waterFilm=.00045*sin(wetUv.y*7.0+.6*sin(wetUv.x*6.0+uRoofRainTime*.8)-uRoofRainTime*1.3);
    waterFilm+=.0002*sin(dot(wetUv,vec2(4.1,5.3))+uRoofRainTime*1.7);
    vec3 wetQx=dFdx(-vViewPosition),wetQy=dFdy(-vViewPosition);
    vec3 wetRx=cross(wetQy,normal),wetRy=cross(normal,wetQx);
    float wetDet=dot(wetQx,wetRx);
    normal=normalize(abs(wetDet)*normal-sign(wetDet)*(dFdx(waterFilm)*wetRx+dFdy(waterFilm)*wetRy));
   #endif
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float wetFresnel=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
   outgoingLight+=vec3(.18,.25,.31)*wetFresnel*.35;
   #include <opaque_fragment>
  `);
 };
 material.customProgramCacheKey=()=>key()+'|rainwater-film-v1';material.needsUpdate=true;
}
