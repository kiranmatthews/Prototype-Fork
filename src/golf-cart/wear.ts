import * as THREE from 'three';
import {RALLY_NOISE} from '../rallyMaterials';
/** One small attribute per instance, shared batched geometry and shader.
 * Wear belongs to the cart, so changing its driver never cleans the body. */
export function installCartWear(mesh:THREE.InstancedMesh,tyre=false){
 const wear=new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*4),4);
 wear.setUsage(THREE.DynamicDrawUsage);mesh.geometry.setAttribute('rallyWear',wear);
 const material=mesh.material as THREE.MeshStandardMaterial;
 material.onBeforeCompile=s=>{
  s.vertexShader='attribute vec4 rallyWear;varying vec4 vCartWear;varying vec3 vCartLocal;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCartWear=rallyWear;vCartLocal=position;');
  s.fragmentShader='varying vec4 vCartWear;varying vec3 vCartLocal;\n'+RALLY_NOISE+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',/* glsl */`
   #include <color_fragment>
   vec3 p=vCartLocal;float dirt=vCartWear.x,damage=vCartWear.y,burnt=vCartWear.z;
   vec2 patchUv=vec2(p.x+p.z*.73,p.y)+vCartWear.w*11.0;
   float patches=rallyNoise(patchUv*8.0)*.78+rallyNoise(patchUv*27.0)*.22;
   float lower=${tyre?'1.0':'1.0-smoothstep(.55,1.55,p.y)'};
   float mudMask=smoothstep(.74-dirt*(.26+lower*.42),.91-dirt*(.26+lower*.42),patches)*dirt;
   float scratches=pow(.5+.5*sin((p.y+p.z*.12)*175.0),32.0)*smoothstep(.49,.66,rallyNoise(vec2(p.z*9.0,p.x*29.0)));
   float chips=smoothstep(.71,.83,rallyNoise(patchUv*24.0))*damage*.5;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.28,.24),clamp(scratches*damage*.8+chips,0.0,.75)*(1.0-burnt));
   vec3 mudColour=mix(vec3(.09,.043,.018),vec3(.32,.18,.068),patches);
   diffuseColor.rgb=mix(diffuseColor.rgb,mudColour,mudMask*(1.0-burnt));
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.9,mudMask);');
 };
 material.customProgramCacheKey=()=>`cart-wear-v2-${tyre}`;
 return wear;
}
