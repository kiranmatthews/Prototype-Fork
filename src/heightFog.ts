import * as THREE from 'three';
import type {CustomAtmosphereData} from './levelAtmosphere';

type FogBinding={owner:HeightFog|null;camera:{value:THREE.Vector3};profile:{value:THREE.Vector3};slope:{value:THREE.Vector2};color:{value:THREE.Color}};
// Shared scenery/crate materials survive a Level. Install their shader hook
// once, and transfer its uniform ownership when a new level borrows them.
const bindings=new WeakMap<THREE.Material,FogBinding>();

/** Analytic atmospheric extinction along each view ray; no fog surfaces. */
export class HeightFog {
 private readonly owned=new Set<FogBinding>();
 disable():void {for(const binding of this.owned)if(binding.owner===this){binding.profile.value.y=0;binding.owner=null;}}
 dispose():void {this.disable();this.owned.clear();}
 update(root:THREE.Object3D,camera:THREE.Vector3,profile:NonNullable<CustomAtmosphereData['heightFog']>,color:THREE.Color,enabled:boolean):void {
  root.traverse(object=>{
   const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    let binding=bindings.get(material);const installed=!!binding;
    if(!binding){binding={owner:this,camera:{value:new THREE.Vector3()},profile:{value:new THREE.Vector3()},slope:{value:new THREE.Vector2()},color:{value:new THREE.Color()}};bindings.set(material,binding);}
    this.owned.add(binding);
    binding.owner=this;binding.camera.value.copy(camera);binding.profile.value.set(profile.height,enabled?profile.density:0,profile.falloff);binding.color.value.copy(color);binding.slope.value.set(...(profile.slope??[0,0]));
    if(installed)continue;const uniforms=binding;
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=(shader,renderer)=>{
     compile.call(material,shader,renderer);
     if(!shader.fragmentShader.includes('#include <fog_fragment>'))return;
     shader.uniforms.uHeightFogCamera=uniforms.camera;shader.uniforms.uHeightFogProfile=uniforms.profile;shader.uniforms.uHeightFogColor=uniforms.color;shader.uniforms.uHeightFogSlope=uniforms.slope;
     shader.vertexShader='varying vec3 vHeightFogWorld;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 heightFogWorld=vec4(transformed,1.0);
      #ifdef USE_BATCHING
       heightFogWorld=batchingMatrix*heightFogWorld;
      #endif
      #ifdef USE_INSTANCING
       heightFogWorld=instanceMatrix*heightFogWorld;
      #endif
      vHeightFogWorld=(modelMatrix*heightFogWorld).xyz;
     `);
     shader.fragmentShader='varying vec3 vHeightFogWorld; uniform vec3 uHeightFogCamera,uHeightFogProfile,uHeightFogColor; uniform vec2 uHeightFogSlope;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#include <fog_fragment>
      float heightFogCameraY=uHeightFogCamera.y-dot(uHeightFogCamera.xz,uHeightFogSlope);
      float heightFogWorldY=vHeightFogWorld.y-dot(vHeightFogWorld.xz,uHeightFogSlope);
      float heightFogDelta=clamp(-uHeightFogProfile.z*(heightFogWorldY-heightFogCameraY),-60.0,60.0);
      float heightFogIntegral=abs(heightFogDelta)<.01?1.0+heightFogDelta*.5:(exp(heightFogDelta)-1.0)/heightFogDelta;
      float heightFogStart=exp(clamp(-uHeightFogProfile.z*(heightFogCameraY-uHeightFogProfile.x),-60.0,12.0));
      float heightFogOptical=uHeightFogProfile.y*distance(vHeightFogWorld,uHeightFogCamera)*heightFogStart*heightFogIntegral;
      gl_FragColor.rgb=mix(gl_FragColor.rgb,linearToOutputTexel(vec4(uHeightFogColor,1.0)).rgb,1.0-exp(-max(0.0,heightFogOptical)));
     `);
    };
    material.customProgramCacheKey=()=>key()+'|analytic-height-fog-v3';material.needsUpdate=true;
   }
  });
 }
}
