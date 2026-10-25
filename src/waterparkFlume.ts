import * as THREE from 'three';
import type {CustomComponent} from './level';

/** Reuse the painted fiberglass at two scales: readable chips close to the
 * rider and broad mineral variation along the old flume. No additional map. */
export function addWaterparkFlumeLook(material:THREE.MeshPhongMaterial|THREE.MeshStandardMaterial):void {
 if(!material.map)return;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 if(material instanceof THREE.MeshPhongMaterial){material.specular.set('#577b76');material.shininess=42;}
 else material.roughness=.34;
 // The enclosed liner's authored bounce light must retain its chipped paint.
 if(material.emissive.getHex()!==0)material.emissiveMap=material.map;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   #ifdef USE_MAP
    vec3 flumeWear=texture2D(map,vMapUv*.173+vec2(.31,.73)).rgb;
    float flumeLuma=dot(flumeWear,vec3(.2126,.7152,.0722));
    diffuseColor.rgb*=mix(vec3(.84,.94,.87),vec3(1.06,1.04,.99),smoothstep(.12,.52,flumeLuma));
   #endif
  `);
 };
 material.customProgramCacheKey=()=>key+'|weathered-waterpark-fiberglass-v3';material.needsUpdate=true;
}

/** UV.x stores metres to the existing floor below each horizontal pocket.
 * Ripples affect shading only: their edge cannot bob through the slide, and
 * these centimetre-deep puddles never become swimming or collision volumes.
 * Uses the same quiet ripple/caustic language as the existing Custard pools. */
export function createShallowSlideWater(clock:{value:number},c:CustomComponent):THREE.MeshStandardMaterial {
 const material=new THREE.MeshStandardMaterial({color:c.color??'#278f99',emissive:c.emissive??'#000000',
  roughness:.19,metalness:.02,opacity:c.opacity??.84,transparent:true,depthWrite:false,
  fog:c.fog!==false,side:c.doubleSided===false?THREE.FrontSide:THREE.DoubleSide,vertexColors:!!c.colors});
 material.forceSinglePass=true;
 Object.assign(material.userData,{waterSurface:true,noWaterShore:true,texKind:'waterslide-shallows'});
 material.onBeforeCompile=shader=>{
  shader.uniforms.uShallowTime=clock;
  shader.vertexShader='varying vec3 vShallowWorld; varying float vShallowDepth;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vShallowWorld=(modelMatrix*vec4(position,1.)).xyz;vShallowDepth=uv.x;`);
  shader.fragmentShader='uniform float uShallowTime; varying vec3 vShallowWorld; varying float vShallowDepth;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 shallowP=vShallowWorld.xz;float shallowT=uShallowTime;
   float shallowEdge=smoothstep(.003,.04,vShallowDepth);
   vec2 shallowSlope=vec2(.025*cos(shallowP.x*.72+shallowP.y*.31-shallowT*.56),.019*cos(shallowP.y*.93-shallowP.x*.18+shallowT*.37));
   shallowSlope+=vec2(.007*sin(shallowP.y*2.3+shallowP.x*1.2+shallowT*.7),.006*cos(shallowP.x*2.4-shallowP.y*.8-shallowT*.5));
   vec3 shallowNormal=normalize(vec3(-shallowSlope.x*shallowEdge,1.,-shallowSlope.y*shallowEdge));
   float shallowFacing=clamp(dot(shallowNormal,normalize(cameraPosition-vShallowWorld)),0.,1.);
   float shallowFresnel=pow(1.-shallowFacing,4.);
   float shallowCaustic=sin(shallowP.x*1.5+shallowT*.25+sin(shallowP.y*.9-shallowT*.16))*sin(shallowP.y*1.3-shallowT*.21+sin(shallowP.x*.84));
   float shallowThread=pow(1.-abs(shallowCaustic),18.);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.40,.67,.72),shallowFresnel*.6);
   diffuseColor.rgb+=vec3(.12,.20,.14)*shallowThread*shallowEdge;
   diffuseColor.a*=shallowEdge*mix(.4,.9,smoothstep(0.,.23,vShallowDepth))+.2*shallowFresnel*shallowEdge;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize(mat3(viewMatrix)*shallowNormal);`);
 };
 material.customProgramCacheKey=()=> 'waterpark-shallow-pool-v1';return material;
}
