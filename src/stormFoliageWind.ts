import * as THREE from 'three';
import type {RainProfile} from './rainWeather';

/** Per-level wind. The original mesh and its pinned-root flex mask stay intact. */
export class StormFoliageWind {
 readonly vector={value:new THREE.Vector3()};
 readonly time={value:0};

 set(profile:RainProfile|undefined,time:number):void {
  this.time.value=time;
  if(profile)this.vector.value.set(profile.wind[0],profile.wind[1],profile.intensity);
  else this.vector.value.set(0,0,0);
 }

 /** Use the same deformation in the colour and shadow vertex shaders. */
 vertex(shader:THREE.WebGLProgramParametersWithUniforms,calm:string):string {
  shader.uniforms.uStormFoliageWind=this.vector;
  shader.uniforms.uStormFoliageTime=this.time;
  shader.vertexShader='uniform vec3 uStormFoliageWind;\nuniform float uStormFoliageTime;\n'+shader.vertexShader;
  return /* glsl */`
   vec3 stormRest=transformed;
   ${calm}
   float stormSpeed=length(uStormFoliageWind.xy);
   float stormBlend=clamp(stormSpeed/6.0,0.0,1.0)*uStormFoliageWind.z;
   if(stormBlend>0.0){
    mat4 stormModel=modelMatrix;
    #ifdef USE_INSTANCING
     stormModel=modelMatrix*instanceMatrix;
    #endif
    mat3 stormBasis=mat3(stormModel);
    vec3 stormOrigin=stormModel[3].xyz;
    vec3 stormDirection=vec3(uStormFoliageWind.x,0.0,uStormFoliageWind.y)/max(stormSpeed,.001);
    vec3 stormAcross=vec3(-stormDirection.z,0.0,stormDirection.x);
    // Inverse of the orthogonal scaled placement basis: every rotated tree
    // leans downwind in world space, including non-uniform authored sizes.
    vec3 stormScale2=vec3(dot(stormBasis[0],stormBasis[0]),dot(stormBasis[1],stormBasis[1]),dot(stormBasis[2],stormBasis[2]));
    vec3 stormAlong=normalize(vec3(dot(stormBasis[0],stormDirection),dot(stormBasis[1],stormDirection),dot(stormBasis[2],stormDirection))/max(stormScale2,vec3(.000001)));
    vec3 stormSide=normalize(vec3(dot(stormBasis[0],stormAcross),dot(stormBasis[1],stormAcross),dot(stormBasis[2],stormAcross))/max(stormScale2,vec3(.000001)));
    // The large gust is exactly the rain's gust; small leaf flutter varies
    // spatially, so neighbouring crowns do not move as a single rigid sheet.
    float stormGust=1.0+.26*sin(uStormFoliageTime*.67)+.14*sin(uStormFoliageTime*1.71);
    float stormPhase=uStormFoliageTime*2.1+stormOrigin.x*.12+stormOrigin.z*.08+position.y*5.0;
    vec3 stormOffset=stormAlong*(.036*stormGust+.008*sin(stormPhase))
      +stormSide*(.008*sin(stormPhase*1.73+position.x*3.0));
    // Maximum local displacement is .067, within the existing .085 bounds.
    transformed=mix(transformed,stormRest+stormOffset*aJungleFlex,stormBlend);
   }
  `;
 }
 get diagnostics(){return {wind:[this.vector.value.x,this.vector.value.y],intensity:this.vector.value.z,time:this.time.value};}
}
