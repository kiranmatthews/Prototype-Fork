import * as THREE from 'three';

/** Lighting adjustment only. All base-color, normal, roughness/metal maps
 * and original UVs remain the generated Meshy component's own assets. */
export function lightBlockworksMaterial(material:THREE.Material,kind:string):void{
  if(material.userData.blockworksLight)return;
  material.userData.blockworksLight=true;
  const mat=material as THREE.MeshStandardMaterial;
  if(!mat.isMeshStandardMaterial)return;
  mat.alphaHash=true;
  const metal=['metal','aqueduct','winch','steel','rivet','grind'].some(name=>kind.includes(name));
  mat.metalness=metal?.28:.05;
  if(kind.includes('grind')||kind.includes('coping'))mat.roughness=.65;
  mat.normalScale.setScalar(kind.includes('ice')?.25:kind.includes('aqueduct')?.18:kind.includes('flagstone')?.35:.5);
  const warm=['turret','spire','lantern','wall-bay','wheel','viaduct'].some(name=>kind.includes(name));
  const previous=mat.onBeforeCompile;
  mat.onBeforeCompile=(shader,renderer)=>{
    previous.call(mat,shader,renderer);
    // One world-space low mist layer ties every placed component to the same
    // turquoise abyss. It never changes with the storyboard or camera pose.
    shader.vertexShader='varying vec3 vBlockworksWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 bwWorld=vec4(transformed,1.);
      #ifdef USE_INSTANCING
      bwWorld=instanceMatrix*bwWorld;
      #endif
      vBlockworksWorld=(modelMatrix*bwWorld).xyz;`);
    shader.fragmentShader='varying vec3 vBlockworksWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>',
      'diffuseColor.a*=1.-smoothstep(165.,220.,length(vBlockworksWorld-cameraPosition));\n#include <alphahash_fragment>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,'+(kind.includes('ice')?'.16':metal?'.52':'.76')+');');
    if(warm)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float amberPane=smoothstep(.16,.55,diffuseColor.r)*smoothstep(.035,.2,diffuseColor.g)*(1.-smoothstep(.065,.18,diffuseColor.b))*smoothstep(1.35,2.,diffuseColor.r/(diffuseColor.g+.001));
       totalEmissiveRadiance+=vec3(1.,.39,.07)*amberPane*.85;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#include <fog_fragment>
      float lowMist=(1.-smoothstep(-28.,-3.,vBlockworksWorld.y))*(1.-exp(-length(vBlockworksWorld-cameraPosition)*.022));
      gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.28,.56,.63),lowMist*.82);`);
  };
  mat.customProgramCacheKey=()=> 'blockworks-meshy-light-v2:'+kind;
}
