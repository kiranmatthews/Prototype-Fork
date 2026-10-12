import * as THREE from 'three';

/** Lighting adjustment only. All base-color, normal, roughness/metal maps
 * and original UVs remain the generated Meshy component's own assets. */
export function lightBlockworksMaterial(material:THREE.Material,kind:string):void{
  if(material.userData.blockworksLight)return;
  material.userData.blockworksLight=true;
  const mat=material as THREE.MeshStandardMaterial;
  if(!mat.isMeshStandardMaterial)return;
  const metal=kind.includes('metal')||kind.includes('aqueduct')||kind.includes('winch');
  mat.metalness=metal?.28:.05;
  mat.normalScale.setScalar(kind.includes('ice')?.25:.5);
  const warm=['turret','lantern','wall-bay','wheel'].some(name=>kind.includes(name));
  const previous=mat.onBeforeCompile;
  mat.onBeforeCompile=(shader,renderer)=>{
    previous.call(mat,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,'+(kind.includes('ice')?'.16':metal?'.52':'.76')+');');
    if(warm)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float amberPane=smoothstep(.38,.72,diffuseColor.r)*smoothstep(.16,.43,diffuseColor.g)*(1.-smoothstep(.12,.35,diffuseColor.b));
       totalEmissiveRadiance+=vec3(1.,.39,.07)*amberPane*.85;`);
  };
  mat.customProgramCacheKey=()=> 'blockworks-meshy-light-v1:'+kind;
}
