import * as THREE from 'three';

// Generated mineral albedo plus CC0 ambientCG Rock030 relief. Triplanar
// mapping keeps metre scale across native formations without stretched UVs.
let detail:{colour:THREE.Texture;relief:THREE.Texture;strata:THREE.Texture;users:number}|undefined;
function acquireDetail(){
  if(!detail){
    const loader=new THREE.TextureLoader(),base=import.meta.env.BASE_URL+'desert-canyon/';
    const colour=loader.load(base+'trail-gravel.png'),relief=loader.load(base+'rock-relief.jpg'),strata=loader.load(base+'sandstone-strata.png');
    for(const texture of [colour,relief,strata]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;texture.userData.shared=true;}
    colour.colorSpace=strata.colorSpace=THREE.SRGBColorSpace;detail={colour,relief,strata,users:0};
  }
  detail.users++;return detail;
}
export function createDesertMaterial(kind:'sandstone'|'trail',vertexColors=true):THREE.MeshStandardMaterial {
  const maps=acquireDetail();
  const material=new THREE.MeshStandardMaterial({color:kind==='trail'?'#ca955e':'#ffffff',roughness:.94,metalness:0,vertexColors});
  material.name=`Bryce ${kind}`;material.userData.desertMaterial=kind;
  let disposed=false;material.addEventListener('dispose',()=>{if(disposed)return;disposed=true;if(--maps.users===0){maps.colour.dispose();maps.relief.dispose();maps.strata.dispose();if(detail===maps)detail=undefined;}});
  material.onBeforeCompile=shader=>{
    shader.uniforms.desertColour={value:maps.colour};shader.uniforms.desertRelief={value:maps.relief};shader.uniforms.desertStrata={value:maps.strata};
    shader.vertexShader='varying vec3 vDesertWorld; varying vec3 vDesertNormal; varying vec2 vDesertUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 desertPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        desertPosition=instanceMatrix*desertPosition;
      #endif
      vDesertWorld=(modelMatrix*desertPosition).xyz;
      vDesertNormal=inverseTransformDirection(transformedNormal,viewMatrix);
      vDesertUv=uv;
    `);
    shader.fragmentShader=/* glsl */`
      varying vec3 vDesertWorld; varying vec3 vDesertNormal; varying vec2 vDesertUv;
      uniform sampler2D desertColour;uniform sampler2D desertRelief;uniform sampler2D desertStrata;
      vec3 desertWeights(){vec3 w=pow(abs(normalize(vDesertNormal)),vec3(5.0));return w/max(dot(w,vec3(1.0)),.001);}
      vec3 desertMineral(vec3 p,vec3 w){return texture2D(desertColour,p.yz).rgb*w.x+texture2D(desertColour,p.xz).rgb*w.y+texture2D(desertColour,p.xy).rgb*w.z;}
      float desertHeight(vec3 p,vec3 w){return texture2D(desertRelief,p.yz).r*w.x+texture2D(desertRelief,p.xz).r*w.y+texture2D(desertRelief,p.xy).r*w.z;}
      float sandstoneStrata(vec3 p,vec3 w){vec3 c=texture2D(desertStrata,p.zy).rgb*w.x+texture2D(desertStrata,p.xz).rgb*w.y+texture2D(desertStrata,p.xy).rgb*w.z;return dot(c,vec3(.2126,.7152,.0722));}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`#include <color_fragment>
      vec3 dp=vDesertWorld,dw=desertWeights();
      float mineral=dot(desertMineral(dp*.333333,dw),vec3(.333333));
      float fine=desertHeight(dp*2.7,dw);
      ${kind==='sandstone'?`
        float cliff=1.0-smoothstep(.62,.94,normalize(vDesertNormal).y);
        float stone=sandstoneStrata(dp*.2,dw);
        diffuseColor.rgb*=mix(.55+mineral*1.8,.45+stone*2.8,cliff);
        diffuseColor.rgb*=.96+fine*.09;
        float ridingLine=step(3000.0,vDesertUv.y)*(1.0-smoothstep(3.0,5.0,abs(vDesertUv.x)));
        float track=exp(-pow((abs(vDesertUv.x+.12*sin(vDesertUv.y*.037))-.72)*7.0,2.0));
        diffuseColor.rgb*=1.0-ridingLine*track*.045;
        float sediment=sin(dp.y*.82+sin(dp.x*.065+dp.z*.08)*.35);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.08,1.12,1.16),smoothstep(.6,.99,sediment)*.20);
      `:`
        float shoulder=smoothstep(3.5,9.0,abs(vDesertUv.x));
        float tread=exp(-pow((abs(vDesertUv.x+.28*sin(vDesertUv.y*.037))-.72)*7.0,2.0));
        diffuseColor.rgb*=.60+mineral*1.4+fine*.06-tread*.055;
        float cliff=(1.0-smoothstep(.55,.90,normalize(vDesertNormal).y))*shoulder;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.18,.72,.44),cliff*.65);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.91,.86,.77),shoulder*.19);
      `}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */`#include <normal_fragment_maps>
      float relief=desertHeight(vDesertWorld*.45,desertWeights())*${kind==='sandstone'?'mix(.065,.018,desertWeights().y)':'.014'}+desertHeight(vDesertWorld*2.7,desertWeights())*.006;
      relief+=mineral*.028*desertWeights().y;
      ${kind==='sandstone'?'relief+=sandstoneStrata(vDesertWorld*.2,desertWeights())*.11*(1.0-smoothstep(.62,.94,normalize(vDesertNormal).y));':''}
      vec3 q0=dFdx(vViewPosition),q1=dFdy(vViewPosition);
      vec3 s0=cross(q1,normal),s1=cross(normal,q0);float det=dot(q0,s0);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*s0+dFdy(relief)*s1));
    `);
  };
  material.customProgramCacheKey=()=>`bryce-mineral-v6:${kind}`;
  return material;
}
