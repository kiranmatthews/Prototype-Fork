import * as THREE from 'three';

// Shared CC0 ambientCG Rock030 mineral detail. Triplanar mapping keeps metre
// scale across instanced formations without stretched UVs or per-pixel fBm.
let detail:{colour:THREE.Texture;relief:THREE.Texture;users:number}|undefined;
function acquireDetail(){
  if(!detail){
    const loader=new THREE.TextureLoader(),base=import.meta.env.BASE_URL+'desert-canyon/';
    const colour=loader.load(base+'rock-grain.jpg'),relief=loader.load(base+'rock-relief.jpg');
    for(const texture of [colour,relief]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;texture.userData.shared=true;}
    colour.colorSpace=THREE.SRGBColorSpace;detail={colour,relief,users:0};
  }
  detail.users++;return detail;
}
export function createDesertMaterial(kind:'sandstone'|'trail',vertexColors=true):THREE.MeshStandardMaterial {
  const maps=acquireDetail();
  const material=new THREE.MeshStandardMaterial({color:kind==='trail'?'#dbad78':'#ffffff',roughness:.94,metalness:0,vertexColors});
  material.name=`Bryce ${kind}`;material.userData.desertMaterial=kind;
  let disposed=false;material.addEventListener('dispose',()=>{if(disposed)return;disposed=true;if(--maps.users===0){maps.colour.dispose();maps.relief.dispose();if(detail===maps)detail=undefined;}});
  material.onBeforeCompile=shader=>{
    shader.uniforms.desertColour={value:maps.colour};shader.uniforms.desertRelief={value:maps.relief};
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
      uniform sampler2D desertColour;uniform sampler2D desertRelief;
      vec3 desertWeights(){vec3 w=pow(abs(normalize(vDesertNormal)),vec3(5.0));return w/max(dot(w,vec3(1.0)),.001);}
      vec3 desertMineral(vec3 p,vec3 w){return texture2D(desertColour,p.yz).rgb*w.x+texture2D(desertColour,p.xz).rgb*w.y+texture2D(desertColour,p.xy).rgb*w.z;}
      float desertHeight(vec3 p,vec3 w){return texture2D(desertRelief,p.yz).r*w.x+texture2D(desertRelief,p.xz).r*w.y+texture2D(desertRelief,p.xy).r*w.z;}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`#include <color_fragment>
      vec3 dp=vDesertWorld,dw=desertWeights();
      float mineral=dot(desertMineral(dp*.22,dw),vec3(.333333));
      float fine=desertHeight(dp*1.8,dw);
      ${kind==='sandstone'?`
        diffuseColor.rgb*=.80+mineral*.62;
        diffuseColor.rgb*=.96+fine*.09;
        float sediment=sin(dp.y*.82+sin(dp.x*.065+dp.z*.08)*.35);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.08,1.12,1.16),smoothstep(.6,.99,sediment)*.20);
      `:`
        float shoulder=smoothstep(3.5,9.0,abs(vDesertUv.x));
        float tread=exp(-pow((abs(vDesertUv.x+.28*sin(vDesertUv.y*.037))-.72)*7.0,2.0));
        diffuseColor.rgb*=.88+mineral*.30+fine*.07-tread*.045;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.88,.90,.81),shoulder*.34);
      `}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */`#include <normal_fragment_maps>
      float relief=desertHeight(vDesertWorld*.22,desertWeights())*${kind==='sandstone'?'.19':'.035'}+desertHeight(vDesertWorld*1.8,desertWeights())*.012;
      vec3 q0=dFdx(vViewPosition),q1=dFdy(vViewPosition);
      vec3 s0=cross(q1,normal),s1=cross(normal,q0);float det=dot(q0,s0);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*s0+dFdy(relief)*s1));
    `);
  };
  material.customProgramCacheKey=()=>`bryce-mineral-v2:${kind}`;
  return material;
}
