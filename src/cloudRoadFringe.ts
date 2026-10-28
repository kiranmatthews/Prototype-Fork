import * as THREE from 'three';
import { acquireCloudNoise, CLOUD_NOISE_TILE_METRES } from './cloudRoadLighting';

export interface CloudFringe {
  matrix: THREE.Matrix4;
  optics: readonly number[];
}

/** Sparse ellipsoidal wisps outside the opaque road. Eight fixed samples cover
 * only these small domains, sharing the road's filtered density field. Back
 * faces depth-test against the complete opaque shell: covered volume fragments
 * are rejected before shading, conservatively restricting wisps to silhouettes.
 * No depth writes, temporal jitter, per-frame allocation, or distance LOD. */
export function createCloudRoadFringe(wisps:CloudFringe[]):THREE.InstancedMesh {
  const noise=acquireCloudNoise();
  const material=new THREE.ShaderMaterial({
    name:'Cloud shoulder wisps · bounded eight-sample volume',glslVersion:THREE.GLSL3,
    transparent:true,depthWrite:false,side:THREE.BackSide,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uCloudNoise:{value:noise.texture}},
    vertexShader:`attribute vec2 fringeOptics;
varying vec3 vOrigin;varying vec3 vPoint;
varying vec3 vAxisX;varying vec3 vAxisY;varying vec3 vAxisZ;varying vec3 vCentre;
varying vec2 vOptics;
#include <fog_pars_vertex>
void main(){
  vec3 relative=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz-instanceMatrix[3].xyz;
  vOrigin=vec3(dot(relative,instanceMatrix[0].xyz)/dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),
    dot(relative,instanceMatrix[1].xyz)/dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),
    dot(relative,instanceMatrix[2].xyz)/dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
  mat4 world=modelMatrix*instanceMatrix;
  vAxisX=world[0].xyz;vAxisY=world[1].xyz;vAxisZ=world[2].xyz;vCentre=world[3].xyz;
  vPoint=position;vOptics=fringeOptics;
  vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader:`precision highp sampler3D;
out vec4 cloudOutput;
#define gl_FragColor cloudOutput
uniform sampler3D uCloudNoise;
varying vec3 vOrigin;varying vec3 vPoint;
varying vec3 vAxisX;varying vec3 vAxisY;varying vec3 vAxisZ;varying vec3 vCentre;
varying vec2 vOptics;
#include <fog_pars_fragment>
void main(){
  vec3 ray=normalize(vPoint-vOrigin);
  float b=dot(vOrigin,ray),h=b*b-dot(vOrigin,vOrigin)+1.0;
  if(h<=0.0)discard;
  float start=max(0.0,-b-sqrt(h)),end=-b+sqrt(h);
  if(end<=start)discard;
  float ds=(end-start)/8.0;
  vec3 worldRay=vAxisX*ray.x+vAxisY*ray.y+vAxisZ*ray.z;
  float optical=0.0;
  for(int i=0;i<8;i++){
    vec3 p=vOrigin+ray*(start+(float(i)+.5)*ds);
    vec3 world=vCentre+vAxisX*p.x+vAxisY*p.y+vAxisZ*p.z;
    vec3 detail=texture(uCloudNoise,world/${CLOUD_NOISE_TILE_METRES.toFixed(1)}).rgb;
    float density=(1.0-smoothstep(.15,1.0,dot(p,p)))*smoothstep(.22,.72,detail.r*.65+detail.g*.35);
    optical+=density*ds;
  }
  float alpha=(1.0-exp(-optical*length(worldRay)*1.1))*.35;
  vec3 light=vec3(.34,.46,.66)*.72+vec3(1.0,.965,.9)*(vOptics.x*.66+vOptics.y*.34);
  gl_FragColor=vec4(light,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  material.addEventListener('dispose',noise.release);
  const geometry=new THREE.BoxGeometry(2,2,2);
  geometry.setAttribute('fringeOptics',new THREE.InstancedBufferAttribute(new Uint8Array(wisps.flatMap(w=>w.optics.map(v=>Math.round(v*255)))),2,true));
  const mesh=new THREE.InstancedMesh(geometry,material,wisps.length);
  // Level disposal owns geometry/materials. The unique proxy geometry also
  // owns this batch's instance buffer, which Three releases on mesh.dispose().
  let disposed=false;
  geometry.addEventListener('dispose',()=>{if(!disposed){disposed=true;mesh.dispose();}});
  wisps.forEach((w,i)=>mesh.setMatrixAt(i,w.matrix));mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name='Selective volumetric cloud fringes';
  mesh.userData.visualOnly=true;mesh.userData.cloudRoadFringe=true;mesh.userData.edgeGrinding=false;
  mesh.userData.castShadow=false;mesh.userData.raySamples=8;
  return mesh;
}
