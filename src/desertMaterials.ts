import * as THREE from 'three';

// Imagegen-painted albedo, projected in metres across every native formation.
// Broad colour masses and shallow brush relief replace photographic grit.
// The course's sky, light rig, fog and collision remain separately authored.
let detail:{colour:THREE.Texture;strata:THREE.Texture;users:number}|undefined;
function acquireDetail(){
  if(!detail){
    const loader=new THREE.TextureLoader(),base=import.meta.env.BASE_URL+'desert-canyon/';
    const colour=loader.load(base+'painted-clay.png'),strata=loader.load(base+'painted-sandstone.png');
    for(const texture of [colour,strata]){
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
      texture.colorSpace=THREE.SRGBColorSpace;texture.userData.shared=true;
    }
    detail={colour,strata,users:0};
  }
  detail.users++;return detail;
}
export function createDesertMaterial(kind:'sandstone'|'trail',vertexColors=true):THREE.MeshStandardMaterial {
  const maps=acquireDetail();
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.91,metalness:0,vertexColors});
  material.name=`Bryce painted ${kind}`;material.userData.desertMaterial=kind;
  let disposed=false;material.addEventListener('dispose',()=>{
    if(disposed)return;disposed=true;
    if(--maps.users===0){maps.colour.dispose();maps.strata.dispose();if(detail===maps)detail=undefined;}
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.desertColour={value:maps.colour};shader.uniforms.desertStrata={value:maps.strata};
    shader.uniforms.desertRust={value:new THREE.Color('#c97444')};
    shader.uniforms.desertPeach={value:new THREE.Color('#e8b47e')};
    shader.uniforms.desertClay={value:new THREE.Color('#d69a66')};
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
      uniform sampler2D desertColour; uniform sampler2D desertStrata;
      uniform vec3 desertRust; uniform vec3 desertPeach; uniform vec3 desertClay;
      vec3 desertWeights(){vec3 w=pow(abs(normalize(vDesertNormal)),vec3(4.0));return w/max(dot(w,vec3(1.0)),.001);}
      vec3 desertPaint(sampler2D tex,vec3 p,vec3 w){
        return texture2D(tex,p.zy).rgb*w.x+texture2D(tex,p.xz).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`#include <color_fragment>
      vec3 dp=vDesertWorld,dw=desertWeights();
      float up=normalize(vDesertNormal).y;
      float cliff=1.0-smoothstep(.48,.86,up);
      float bend=sin(dp.x*.018+sin(dp.z*.021))*.95+sin(dp.z*.013)*.65;
      float bed=dp.y*.12+bend;
      float band=.5+.36*sin(bed)+.14*sin(bed*.43+1.8);
      float shelf=smoothstep(.84,.97,band);
      vec3 clay=desertPaint(desertColour,dp*.10,dw);
      // Bedding stays horizontal on both projections. Projecting the rock
      // bands through XZ on a sloping face made the distant mesas look plaid.
      vec3 stone=(texture2D(desertStrata,vec2(dp.z*.017,dp.y*.018+bend*.12)).rgb*dw.x
        +texture2D(desertStrata,vec2(dp.x*.017,dp.y*.018+bend*.12)).rgb*dw.z)/max(dw.x+dw.z,.001);
      stone=mix(stone,clay,smoothstep(.88,.99,dw.y));
      vec3 sourceColour=diffuseColor.rgb;
      ${kind==='sandstone'?`
        vec3 palette=mix(desertRust,desertPeach,smoothstep(.25,.95,band)*.42);
        palette=mix(palette,desertPeach,shelf*.18);
        vec3 rockPaint=mix(palette,stone,.28);
        vec3 soilPaint=mix(desertClay,clay,.64);
        diffuseColor.rgb=mix(soilPaint,rockPaint,cliff);
        float authored=clamp(dot(sourceColour,vec3(.25,.55,.20)),.08,.85);
        diffuseColor.rgb*=.94+authored*.18;
      `:`
        vec3 soilPaint=mix(desertClay,clay,.70);
        vec3 rockPaint=mix(mix(desertRust,desertPeach,band*.42),stone,.30);
        diffuseColor.rgb=mix(soilPaint,rockPaint,cliff*.90);
        diffuseColor.rgb*=.97+.03*sin(dp.x*.25+sin(dp.z*.19));
      `}
      float ridingLine=${kind==='sandstone'?'step(3000.0,vDesertUv.y)':'1.0'}*(1.0-smoothstep(3.0,5.0,abs(vDesertUv.x)));
      float tread=exp(-pow((abs(vDesertUv.x+.12*sin(vDesertUv.y*.037))-.72)*4.0,2.0));
      diffuseColor.rgb*=1.0-ridingLine*tread*.022;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */`#include <normal_fragment_maps>
      // Large sculpted bedding and restrained paint strokes; no sand-grain
      // normal map. This leaves clean silhouettes and stable distant shading.
      float relief=dot(mix(clay,stone,cliff),vec3(.2126,.7152,.0722))*.035;
      relief+=shelf*cliff*.075;
      vec3 q0=dFdx(vViewPosition),q1=dFdy(vViewPosition);
      vec3 s0=cross(q1,normal),s1=cross(normal,q0);float det=dot(q0,s0);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*s0+dFdy(relief)*s1));
    `);
  };
  material.customProgramCacheKey=()=>`bryce-painted-v3:${kind}`;
  return material;
}
