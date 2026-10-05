import {Vector3,type Material,type Texture,type MeshLambertMaterial} from 'three';
import type {Halfpipe} from './halfpipe';

/** Match the carved rock's metre scale across the analytic bank. Compensate
 * the shared sampler's repeat instead of allocating a duplicate GPU texture.
 * Only UVs change: the ride surface and its analytical contacts stay intact. */
export function applyCarlisleChannelUV(pipe:Halfpipe):void{
 const tile=3.1,point=new Vector3(),origin=Math.min(pipe.l0,pipe.l1);
 for(const mesh of pipe.walls){
  const map=(mesh.material as MeshLambertMaterial).map;
  const repeatX=map?.repeat.x||1,repeatY=map?.repeat.y||1;
  const position=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
  mesh.updateMatrix();
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrix);
   const arc=pipe.pointToU(point.x,point.z),along=pipe.alongCoord(point.x,point.z);
   // The albedo's bedding runs along U: keep it horizontal along the trough.
   uv.setXY(i,(along-origin)/(tile*repeatX),(arc+pipe.uLip)/(tile*repeatY));
  }
  uv.needsUpdate=true;
  mesh.userData.carlisleMetricUV=tile;
  // Only the flat floor coincides with the grassy native support. A slope
  // offset on the banks would push their skin behind the stone foundation.
  if(mesh.name==='halfpipe floor'){
   const material=(mesh.material as Material).clone();
   material.polygonOffset=true;material.polygonOffsetFactor=material.polygonOffsetUnits=1;
   mesh.material=material;mesh.userData.carlisleFloorDepthBias=true;
  }
 }
}

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

/** Real carved terrain uses one draw: vertex pigment locates living turf on
 * the top, while a separate sharp stone albedo follows its 3D strata/rim. */
export function addCarlisleTerrainLook(material:Material,turf:Texture):void{
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.uniforms.uCarlisleTurf={value:turf};
  shader.fragmentShader='uniform sampler2D uCarlisleTurf;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
   `#include <map_fragment>
    #ifdef USE_COLOR
     float turfPigment=smoothstep(1.02,1.18,vColor.g/max(vColor.r,0.008));
     vec3 livingTurf=texture2D(uCarlisleTurf,vMapUv).rgb;
     diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*livingTurf,turfPigment);
    #endif
   `);
 };
 material.customProgramCacheKey=()=>key()+'|carlisle-geological-terrain-v1';
}

/** Fine opaque blades retain their authored olive light response. World-space
 * shrink fades subpixel distant hairs into the turf without alpha overdraw. */
export function addCarlisleGrassLook(material:Material):void{
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 grassRoot=vec4(0.0,0.0,0.0,1.0);
   #ifdef USE_INSTANCING
    grassRoot=instanceMatrix*grassRoot;
   #endif
   grassRoot=modelMatrix*grassRoot;
   float grassDistance=length(cameraPosition-grassRoot.xyz);
   transformed*=1.0-smoothstep(20.0,48.0,grassDistance);
   #include <project_vertex>
  `);
 };
 material.customProgramCacheKey=()=>key()+'|carlisle-fine-grass-v1';
}
