// Unmodified published 24c16a77 material, retained only for controlled A/B review.
export function createPreviousCloudMaterial(THREE) {
  const material=new THREE.MeshStandardMaterial({color:'#f3f9ff',roughness:1,metalness:0,emissive:'#17202c',emissiveIntensity:.28,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vCloudWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCloudWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=`varying vec3 vCloudWorld;
float cloudHash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.47));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float cloudNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(cloudHash(i),cloudHash(i+vec3(1,0,0)),f.x),mix(cloudHash(i+vec3(0,1,0)),cloudHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(cloudHash(i+vec3(0,0,1)),cloudHash(i+vec3(1,0,1)),f.x),mix(cloudHash(i+vec3(0,1,1)),cloudHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float cloudDetail(vec3 p){return .62*cloudNoise(p)+.26*cloudNoise(p*2.1)+.12*cloudNoise(p*4.3);}
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float cloudDensity=cloudDetail(vCloudWorld*.62);
diffuseColor.rgb*=mix(vec3(.94,.97,1.0),vec3(1.0),smoothstep(.25,.75,cloudDensity));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
float cloudHeight=cloudDetail(vCloudWorld*1.8)*.012;
vec3 cloudQx=dFdx(-vViewPosition),cloudQy=dFdy(-vViewPosition);
vec3 cloudRx=cross(cloudQy,normal),cloudRy=cross(normal,cloudQx);
float cloudDet=dot(cloudQx,cloudRx);
normal=normalize(abs(cloudDet)*normal-sign(cloudDet)*(dFdx(cloudHeight)*cloudRx+dFdy(cloudHeight)*cloudRy));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`// Broad multiple-scattering fill keeps the shaded billows soft and milky.
outgoingLight=mix(outgoingLight,diffuseColor.rgb*vec3(.86,.92,1.0),.28);
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'skystream-cloud-volume-v1';
  return material;
}
