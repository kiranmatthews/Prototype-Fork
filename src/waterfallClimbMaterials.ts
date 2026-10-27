import * as THREE from 'three';

/** A level-scoped painted flow. Two drifting samples break up obvious tiling;
 * all motion stays in the material and never moves the authored collision. */
export function createWaterfallClimbCurtain(clock:{value:number},map:THREE.Texture,color:string):THREE.MeshStandardMaterial {
 const m=new THREE.MeshStandardMaterial({map,color,roughness:.32,metalness:0,
  emissive:'#092a27',emissiveIntensity:.2,side:THREE.DoubleSide,transparent:true,opacity:.96,depthWrite:false});
 m.forceSinglePass=true;m.userData.waterSurface=true;m.userData.noWaterShore=true;m.userData.jungleDapple=true;
 m.onBeforeCompile=shader=>{
  shader.uniforms.uWaterfallClimbTime=clock;
  shader.fragmentShader='uniform float uWaterfallClimbTime;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    float flowTime=uWaterfallClimbTime;
    vec2 flowUv=vMapUv+vec2(.025*sin(vMapUv.y*2.1-flowTime*.55),-flowTime*.37);
    vec3 flowA=texture2D(map,flowUv).rgb;
    vec3 flowB=texture2D(map,flowUv*vec2(1.67,1.19)+vec2(.43,-flowTime*.26)).rgb;
    diffuseColor.rgb*=mix(flowA,flowB,.28);
   #endif
  `);
 };
 m.customProgramCacheKey=()=> 'waterfall-climb-painted-flow-v1';return m;
}
