import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

/** A compact, seeded density volume with baked sun transmittance. The box is
 * only the ray-march domain; it is never a visible slab or a contact surface.
 * All views use the same density field and sampling budget, including captures.
 * Conceptual references: Guerrilla's 2015 cloud presentation and GPU Gems 39.
 * Implementation is original; SimplexNoise is the existing MIT Three.js addon. */
export function createCloudPlatform(width: number, depth: number, seed: number, landing = true): THREE.Mesh {
  let state=seed|0;
  const random=()=>{state=Math.imul(state,1664525)+1013904223|0;return (state>>>0)/4294967296;};
  const noise=new SimplexNoise({random});
  const min=new THREE.Vector3(-width/2-.5,-6.2,-depth/2-1.3);
  const size=new THREE.Vector3(width+1,8.6,depth+2.6);
  const nx=Math.ceil(size.x/.16),ny=56,nz=Math.ceil(size.z/.16);
  const count=nx*ny*nz,data=new Uint8Array(count*4),density=new Float32Array(count);
  const smoothMin=(a:number,b:number,k:number)=>{
    const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;
  };
  const lobes:{x:number;y:number;z:number;rx:number;ry:number;rz:number}[]=[];
  const columns=Math.max(3,Math.ceil(width/2.2));
  for(let i=0;i<columns;i++)for(let row=-1;row<=1;row++){
    const x=(i/(columns-1)-.5)*(width-2.7)+(random()-.5)*.55;
    const z=row*depth*.34+(random()-.5)*.7;
    const y=-2+(random()-.5)*.8;
    const rx=1.6+random()*.9,ry=1.8+random()*.85,rz=1.45+random()*.8;
    lobes.push({x,y,z,rx,ry,rz});
    // Smaller curls merge into the large billows instead of separate spheres.
    for(let j=0;j<2;j++){
      const a=random()*Math.PI*2,r=.65+random()*.5;
      lobes.push({x:x+Math.cos(a)*rx*.65,y:y-.25+(random()-.5)*ry,
        z:z+Math.sin(a)*rz*.8,rx:r,ry:r*.9,rz:r});
    }
  }
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const px=min.x+x/(nx-1)*size.x,pz=min.z+z/(nz-1)*size.z;
    // Cull contributors outside this column's entire iso-surface influence.
    // This changes construction cost only, never the density/render fidelity.
    const nearby=lobes.map(b=>({...b,xz:((px-b.x)/b.rx)**2+((pz-b.z)/b.rz)**2,m:Math.min(b.rx,b.ry,b.rz)}))
      .filter(b=>b.xz<(1+1.5/b.m)**2);
    for(let y=0;y<ny;y++){
      const py=min.y+y/(ny-1)*size.y;
      let d=(Math.sqrt((px/(width*.47))**2+((py+2)/1.7)**2+(pz/(depth*.29))**2)-1)*1.7;
      for(const b of nearby){
        const e=(Math.sqrt(b.xz+((py-b.y)/b.ry)**2)-1)*b.m;
        d=smoothMin(d,e,.52);
      }
      if(d>.85)continue;
      const detail=noise.noise3d(px*.78,py*.78,pz*.78)*.32+
        noise.noise3d(px*1.9,py*1.9,pz*1.9)*.14+noise.noise3d(px*4.7,py*4.7,pz*4.7)*.055;
      d+=detail;
      // The broad crown reads as cloud but meets the separate landing plane.
      // Keep the travelling corridor clear; taller curls live along the shoulders.
      const shoulder=THREE.MathUtils.smoothstep(Math.abs(pz),1.25,depth*.43);
      const cap=.09+shoulder*.95+noise.noise3d(px*.65,2,pz*.65)*.055;
      if(landing)d=Math.max(d,py-cap);
      // Visible top ends at the authored edge; the underside may softly overhang.
      if(landing)d=Math.max(d,Math.abs(px)-width/2-Math.max(0,-py)*.13);
      density[x+nx*(y+ny*z)]=THREE.MathUtils.smoothstep(-d,-.14,.32);
    }
  }
  const sample=(x:number,y:number,z:number)=>{
    if(x<0||y<0||z<0||x>=nx-1||y>=ny-1||z>=nz-1)return 0;
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz;
    const at=(a:number,b:number,c:number)=>density[a+nx*(b+ny*c)];
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix,iy,iz),at(ix+1,iy,iz),fx),THREE.MathUtils.lerp(at(ix,iy+1,iz),at(ix+1,iy+1,iz),fx),fy),
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix,iy,iz+1),at(ix+1,iy,iz+1),fx),THREE.MathUtils.lerp(at(ix,iy+1,iz+1),at(ix+1,iy+1,iz+1),fx),fy),fz);
  };
  const sun=new THREE.Vector3(-.34,.38,-.86).normalize();
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const i=x+nx*(y+ny*z),v=density[i];if(v===0)continue;
    let opticalDepth=0;
    for(let s=.24;s<8;s+=.48)opticalDepth+=sample(x+sun.x*s/size.x*(nx-1),y+sun.y*s/size.y*(ny-1),z+sun.z*s/size.z*(nz-1))*.48;
    data[i*4]=Math.round(v*255);
    data[i*4+1]=Math.round(Math.exp(-opticalDepth*.72)*255);
    data[i*4+2]=Math.round(Math.exp(-opticalDepth*.16)*255);
    data[i*4+3]=255;
  }
  const texture=new THREE.Data3DTexture(data,nx,ny,nz);
  texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
  const material=new THREE.ShaderMaterial({
    name:'Cumulus density · sun extinction and multiple scattering',glslVersion:THREE.GLSL3,
    transparent:true,depthWrite:true,side:THREE.BackSide,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uVolume:{value:texture},uMin:{value:min},uSize:{value:size}},
    vertexShader:`varying vec3 vOrigin;varying vec3 vDirection;
void main(){
  vOrigin=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz;
  vDirection=position-vOrigin;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`,
    fragmentShader:`precision highp sampler3D;
out vec4 cloudOutput;
#define gl_FragColor cloudOutput
uniform sampler3D uVolume;uniform vec3 uMin;uniform vec3 uSize;
uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;
varying vec3 vOrigin;varying vec3 vDirection;
#include <fog_pars_fragment>
void main(){
  vec3 ray=normalize(vDirection),inv=1.0/ray;
  vec3 a=(uMin-vOrigin)*inv,b=(uMin+uSize-vOrigin)*inv;
  vec3 near=min(a,b),far=max(a,b);
  float start=max(0.0,max(max(near.x,near.y),near.z));
  float end=min(min(far.x,far.y),far.z);
  if(end<=start)discard;
  float ds=(end-start)/80.0;
  float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
  vec4 sum=vec4(0.0);float first=end;bool hit=false;
  for(int i=0;i<80;i++){
    float t=start+(float(i)+jitter)*ds;
    vec3 point=vOrigin+ray*t;
    vec3 uv=(point-uMin)/uSize;
    vec3 cloud=texture(uVolume,uv).rgb;
    if(cloud.r<.006)continue;
    float alpha=1.0-exp(-cloud.r*ds*2.5);
    vec3 light=vec3(.30,.40,.56)*.65+vec3(1.0,.97,.91)*(cloud.g*.49+cloud.b*.27);
    // A low-density sunward fringe has a soft silver lining, without specular.
    light+=vec3(.09,.10,.12)*(1.0-cloud.r)*cloud.g;
    float weight=(1.0-sum.a)*alpha;
    sum.rgb+=weight*light;sum.a+=weight;
    if(!hit&&sum.a>.08){first=t;hit=true;}
    if(sum.a>.995)break;
  }
  if(sum.a<.015)discard;
  vec4 view=modelViewMatrix*vec4(vOrigin+ray*first,1.0);
  vec4 clip=projectionMatrix*view;
  gl_FragDepth=clip.z/clip.w*.5+.5;
  gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
  #ifdef USE_FOG
    float cloudFog=smoothstep(fogNear,fogFar,-view.z);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,cloudFog);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  material.addEventListener('dispose',()=>texture.dispose());
  const geometry=new THREE.BoxGeometry(size.x,size.y,size.z);
  geometry.translate(min.x+size.x/2,min.y+size.y/2,min.z+size.z/2);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Volumetric cumulus platform';
  mesh.userData.visualOnly=true;mesh.userData.cloudPlatformVisual=true;mesh.userData.cloudRoadVisual=true;
  mesh.userData.castShadow=false;mesh.userData.edgeGrinding=false;
  mesh.userData.densityResolution=[nx,ny,nz];mesh.userData.densityBytes=data.byteLength;
  return mesh;
}
