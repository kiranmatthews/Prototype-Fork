import * as THREE from 'three';
import type {CustomAtmosphereData} from './levelAtmosphere';

type FogBinding={owner:HeightFog|null;camera:{value:THREE.Vector3};profile:{value:THREE.Vector3};slope:{value:THREE.Vector2};color:{value:THREE.Color};contour:{value:THREE.Vector2[]};count:{value:number}};
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
    if(!binding){binding={owner:this,camera:{value:new THREE.Vector3()},profile:{value:new THREE.Vector3()},slope:{value:new THREE.Vector2()},color:{value:new THREE.Color()},contour:{value:Array.from({length:16},()=>new THREE.Vector2())},count:{value:0}};bindings.set(material,binding);}
    this.owned.add(binding);
    binding.owner=this;binding.camera.value.copy(camera);binding.profile.value.set(profile.height,enabled?profile.density:0,profile.falloff);binding.color.value.copy(color);binding.slope.value.set(...(profile.slope??[0,0]));
    binding.count.value=profile.contour?.length??0;profile.contour?.forEach((p,i)=>binding!.contour.value[i].set(...p));
    if(installed)continue;const uniforms=binding;
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=(shader,renderer)=>{
     compile.call(material,shader,renderer);
     if(!shader.fragmentShader.includes('#include <fog_fragment>'))return;
     shader.uniforms.uHeightFogCamera=uniforms.camera;shader.uniforms.uHeightFogProfile=uniforms.profile;shader.uniforms.uHeightFogColor=uniforms.color;shader.uniforms.uHeightFogSlope=uniforms.slope;
     shader.uniforms.uHeightFogContour=uniforms.contour;shader.uniforms.uHeightFogCount=uniforms.count;
     // A shared world material also draws in fog-free HUD/fruit-flight scenes.
     // Use Three's per-pass flag, which covers both scene fog and material opt-outs.
     shader.vertexShader='#ifdef USE_FOG\nvarying vec3 vHeightFogWorld;\n#endif\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      #ifdef USE_FOG
      vec4 heightFogWorld=vec4(transformed,1.0);
      #ifdef USE_BATCHING
       heightFogWorld=batchingMatrix*heightFogWorld;
      #endif
      #ifdef USE_INSTANCING
       heightFogWorld=instanceMatrix*heightFogWorld;
      #endif
      vHeightFogWorld=(modelMatrix*heightFogWorld).xyz;
      #endif
     `);
     shader.fragmentShader=`#ifdef USE_FOG
      varying vec3 vHeightFogWorld;
      uniform vec3 uHeightFogCamera,uHeightFogProfile,uHeightFogColor;
      uniform vec2 uHeightFogSlope,uHeightFogContour[16];uniform int uHeightFogCount;
      // Exact exponential-density integral on one linear section of the fog
      // datum. Segment splitting is along the view ray, never a fog surface.
      float heightFogSection(float startHeight,float endHeight,float span){
       float exponent=clamp(-uHeightFogProfile.z*(endHeight-startHeight),-60.0,60.0);
       float average=abs(exponent)<.01?1.0+exponent*.5:(exp(exponent)-1.0)/exponent;
       return span*exp(clamp(-uHeightFogProfile.z*startHeight,-60.0,12.0))*average;
      }
      #endif
     `+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#include <fog_fragment>
      #ifdef USE_FOG
      float heightFogIntegral=0.0;
      vec3 heightFogRay=vHeightFogWorld-uHeightFogCamera;
      if(uHeightFogCount<2){
       heightFogIntegral=heightFogSection(uHeightFogCamera.y-dot(uHeightFogCamera.xz,uHeightFogSlope)-uHeightFogProfile.x,
        vHeightFogWorld.y-dot(vHeightFogWorld.xz,uHeightFogSlope)-uHeightFogProfile.x,1.0);
      }else if(uHeightFogProfile.y>0.0){
       for(int i=0;i<15;i++){
        if(i>=uHeightFogCount-1)break;
        vec2 a=uHeightFogContour[i],b=uHeightFogContour[i+1];
        float lo=i==0?-1e6:a.x,hi=i==uHeightFogCount-2?1e6:b.x;
        float t0=0.0,t1=1.0;
        if(abs(heightFogRay.z)<.0001){if(uHeightFogCamera.z<lo||uHeightFogCamera.z>=hi)continue;}
        else{
         float enter=(lo-uHeightFogCamera.z)/heightFogRay.z,leave=(hi-uHeightFogCamera.z)/heightFogRay.z;
         t0=max(0.0,min(enter,leave));t1=min(1.0,max(enter,leave));if(t1<=t0)continue;
        }
        float grade=(b.y-a.y)/(b.x-a.x);
        vec3 start=uHeightFogCamera+heightFogRay*t0,end=uHeightFogCamera+heightFogRay*t1;
        float startHeight=start.y-a.y-grade*(start.z-a.x)-uHeightFogSlope.x*start.x;
        float endHeight=end.y-a.y-grade*(end.z-a.x)-uHeightFogSlope.x*end.x;
        heightFogIntegral+=heightFogSection(startHeight,endHeight,t1-t0);
       }
      }
      float heightFogOptical=uHeightFogProfile.y*length(heightFogRay)*heightFogIntegral;
      gl_FragColor.rgb=mix(gl_FragColor.rgb,linearToOutputTexel(vec4(uHeightFogColor,1.0)).rgb,1.0-exp(-max(0.0,heightFogOptical)));
      #endif
     `);
    };
    material.customProgramCacheKey=()=>key()+'|analytic-height-fog-v5';material.needsUpdate=true;
   }
  });
 }
}
