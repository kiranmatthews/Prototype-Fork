import * as THREE from 'three';

/** Thin surface water changes lighting only. Roof maps, seam relief, geometry
 * and traction keep their authored coordinates and values. */
export function addWetRooftopLook(material:THREE.Material,time:{value:number}):void {
 if(!(material instanceof THREE.MeshPhongMaterial)||material.userData.wetRooftop)return;
 material.userData.wetRooftop=true;
 material.color.multiplyScalar(.84);material.specular.set('#6e8996');material.shininess=84;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);shader.uniforms.uRoofRainTime=time;
  shader.vertexShader='varying vec3 vRoofRainMetric;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
   // World-oriented metres, anchored to this roof. Removing translation
   // before interpolation keeps millimetre ripples stable far from origin.
   vec3 roofRainMetric=transformed;
   #ifdef USE_BATCHING
    roofRainMetric=mat3(batchingMatrix)*roofRainMetric;
   #endif
   #ifdef USE_INSTANCING
    roofRainMetric=mat3(instanceMatrix)*roofRainMetric;
   #endif
   vRoofRainMetric=mat3(modelMatrix)*roofRainMetric;
  `);
  shader.fragmentShader=`
   uniform float uRoofRainTime;
   varying vec3 vRoofRainMetric;
   float roofRainHash(vec2 cell){return fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);}
   float roofRainRing(vec2 position,float time){
    vec2 cell=floor(position),local=fract(position);
    float seed=roofRainHash(cell),clock=time*.58+seed,cycle=floor(clock),age=fract(clock);
    // A ring fades before it reaches its cell boundary. Centres change only
    // during the invisible interval, so there are no clipped grid seams.
    vec2 centre=.32+.36*vec2(roofRainHash(cell+cycle+19.7),roofRainHash(cell-cycle+53.1));
    float radius=length(local-centre),front=.025+age*.31;
    float envelope=smoothstep(0.0,.08,age)*(1.0-smoothstep(.38,.62,age));
    return sin((radius-front)*110.0)*exp(-abs(radius-front)*45.0)*envelope;
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 wetWorldDx=dFdx(vRoofRainMetric),wetWorldDy=dFdy(vRoofRainMetric);
   vec3 wetWorldNormal=normalize(cross(wetWorldDx,wetWorldDy))*faceDirection;
   float wetSlope=length(wetWorldNormal.xz);
   // Gravity projected onto the actual plane, independent of UV rotation,
   // curved-course headings, object rotation and non-uniform mesh scale.
   vec3 wetDownhill=vec3(wetWorldNormal.x*wetWorldNormal.y,-wetSlope*wetSlope,
     wetWorldNormal.z*wetWorldNormal.y)/max(wetSlope,.0001);
   vec3 wetAcross=cross(wetWorldNormal,wetDownhill);
   float wetRun=smoothstep(.055,.24,wetSlope);
   float wetTravel=uRoofRainTime*(.28+.32*wetSlope);
   float wetAlong=dot(vRoofRainMetric,wetDownhill)-wetTravel;
   float wetCross=dot(vRoofRainMetric,wetAcross);
   float wetChannels=pow(.5+.5*sin(wetCross*24.0+.35*sin(wetAlong*5.0)),5.0);
   float wetRunnels=.0017*wetChannels*sin(wetAlong*29.0);
   vec2 wetPool=vRoofRainMetric.xz*1.15;
   vec2 wetPoolSecond=mat2(.8916,.4528,-.4528,.8916)*wetPool+vec2(17.3,21.9);
   float wetRings=.0011*(roofRainRing(wetPool,uRoofRainTime)+.65*roofRainRing(wetPoolSecond,uRoofRainTime+.73));
   float wetUp=smoothstep(.2,.55,wetWorldNormal.y);
   // Filter sub-pixel water detail before it can shimmer. This never swaps
   // meshes, changes silhouettes, or removes the original seam bump.
   float wetFootprint=max(length(wetWorldDx),length(wetWorldDy));
   float wetDetail=1.0-smoothstep(.018,.065,wetFootprint);
   float waterFilm=mix(wetRings,wetRunnels,wetRun)*wetUp;
   vec3 wetQx=dFdx(-vViewPosition),wetQy=dFdy(-vViewPosition);
   vec3 wetRx=cross(wetQy,normal),wetRy=cross(normal,wetQx);
   float wetDet=dot(wetQx,wetRx)*faceDirection;
   vec3 wetGradient=sign(wetDet)*(dFdx(waterFilm)*wetRx+dFdy(waterFilm)*wetRy)/max(abs(wetDet),1e-10);
   wetGradient*=min(1.0,.18/max(length(wetGradient),.0001));
   normal=normalize(normal-wetDetail*wetGradient);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float wetFresnel=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
   outgoingLight+=vec3(.18,.25,.31)*wetFresnel*.35;
   #include <opaque_fragment>
  `);
 };
 material.customProgramCacheKey=()=>key()+'|rainwater-gravity-film-v2';material.needsUpdate=true;
}
