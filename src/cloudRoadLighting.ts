import * as THREE from 'three';
import { SKYSTREAM_SUN } from './skystreamSun';

const SIZE = 64;
const PERIOD = 8;
export const CLOUD_NOISE_TILE_METRES = 16;
const clamp = (n:number) => Math.max(0,Math.min(1,n));
const hash = (x:number,y:number,z:number,seed=0) => {
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^seed;
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
};
const wrap = (n:number,p:number) => ((n%p)+p)%p;
const lerp = (a:number,b:number,t:number) => a+(b-a)*t;
function noise(x:number,y:number,z:number,p:number):number {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const sx=x-ix,sy=y-iy,sz=z-iz;
  const fx=sx*sx*(3-2*sx),fy=sy*sy*(3-2*sy),fz=sz*sz*(3-2*sz);
  const at=(a:number,b:number,c:number)=>hash(wrap(a,p),wrap(b,p),wrap(c,p));
  return lerp(lerp(lerp(at(ix,iy,iz),at(ix+1,iy,iz),fx),lerp(at(ix,iy+1,iz),at(ix+1,iy+1,iz),fx),fy),
    lerp(lerp(at(ix,iy,iz+1),at(ix+1,iy,iz+1),fx),lerp(at(ix,iy+1,iz+1),at(ix+1,iy+1,iz+1),fx),fy),fz);
}

/** One periodic, packed field for the entire course. RGB hold broad billows,
 * soft medium detail and fine detail; hardware mipmaps filter all three together.
 * The texture contains no per-frame jitter or animation. */
function buildNoise():THREE.Data3DTexture {
  const data=new Uint8Array(SIZE*SIZE*SIZE*4);
  const features=new Float32Array(PERIOD**3*3);
  for(let z=0;z<PERIOD;z++)for(let y=0;y<PERIOD;y++)for(let x=0;x<PERIOD;x++){
    const i=(x+PERIOD*(y+PERIOD*z))*3;
    for(let k=0;k<3;k++)features[i+k]=.15+.7*hash(x,y,z,12345+k*7919);
  }
  for(let z=0;z<SIZE;z++)for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const px=(x+.5)/SIZE*PERIOD,py=(y+.5)/SIZE*PERIOD,pz=(z+.5)/SIZE*PERIOD;
    const ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz);let nearest=3;
    for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const a=ix+dx,b=iy+dy,c=iz+dz,i=(wrap(a,PERIOD)+PERIOD*(wrap(b,PERIOD)+PERIOD*wrap(c,PERIOD)))*3;
      nearest=Math.min(nearest,(a+features[i]-px)**2+(b+features[i+1]-py)**2+(c+features[i+2]-pz)**2);
    }
    const i=(x+SIZE*(y+SIZE*z))*4;
    data[i]=Math.round(clamp(noise(px,py,pz,8)*.55+(1-Math.sqrt(nearest)*.8)*.45)*255);
    data[i+1]=Math.round(noise(px*2,py*2,pz*2,16)*255);
    data[i+2]=Math.round(noise(px*4,py*4,pz*4,32)*255);data[i+3]=255;
  }
  const texture=new THREE.Data3DTexture(data,SIZE,SIZE,SIZE);
  texture.name='Skystream shared periodic cloud noise';
  texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;
  texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.unpackAlignment=1;texture.needsUpdate=true;
  return texture;
}
let shared:THREE.Data3DTexture|null=null,owners=0;
/** Materials own leases, so mesh lighting and translucent fringes share one
 * upload and can be disposed in either order when a level is replaced. */
export function acquireCloudNoise() {
  const texture=shared??(shared=buildNoise());owners++;let released=false;
  return {texture,release:()=>{if(released)return;released=true;if(--owners===0){shared?.dispose();shared=null;}}};
}
export function cloudRoadLightingDiagnostics() {
  return {owners,textures:shared?1:0,baseBytes:shared?SIZE**3*4:0,mipBytes:shared?1198372:0};
}

/** Cross-section optical depth from just inside the shell. Integrating the
 * complete contour includes overlapping lobes/concavities without ray marching
 * in the frame shader. Local ray length is measured in world metres; limiting
 * it to 12 m bounds the extruded-section approximation at glancing angles. */
export function bakeCloudOptics(contour:readonly (readonly [number,number])[],points:readonly (readonly [number,number])[],sunX:number,sunY:number):number[][] {
  const values:number[][]=[];
  const n=points.length-1,step=4;
  const trace=(x:number,y:number)=>{
    const hits:number[]=[];
    for(let i=1;i<contour.length;i++){
      const a=contour[i-1],b=contour[i],ex=b[0]-a[0],ey=b[1]-a[1],den=sunX*ey-sunY*ex;
      if(Math.abs(den)<1e-8)continue;
      const ax=a[0]-x,ay=a[1]-y,t=(ax*ey-ay*ex)/den,u=(ax*sunY-ay*sunX)/den;
      if(t>1e-5&&t<12&&u>=-1e-8&&u<=1+1e-8)hits.push(t);
    }
    hits.sort((a,b)=>a-b);let inside=true,last=0,depth=0;
    for(const t of hits){if(t-last<1e-5)continue;if(inside)depth+=t-last;inside=!inside;last=t;}
    return depth+(inside?12-last:0);
  };
  for(let j=0;j<n;j+=step){
    const p=points[j],a=points[(j+n-1)%n],b=points[(j+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
    const depth=trace(p[0]+dy/len*.22,p[1]-dx/len*.22);
    values[j]=[Math.exp(-depth*.65),Math.exp(-depth*.14)];
  }
  for(let j=0;j<n;j++)if(!values[j]){
    const a=Math.floor(j/step)*step,b=(a+step)%n,t=(j-a)/step;
    values[j]=[lerp(values[a][0],values[b][0],t),lerp(values[a][1],values[b][1],t)];
  }
  values[n]=[...values[0]];return values;
}

export function createCloudRoadMaterial():THREE.MeshStandardMaterial {
  const noise=acquireCloudNoise();
  const material=new THREE.MeshStandardMaterial({color:'#f3f9ff',roughness:1,metalness:0,side:THREE.DoubleSide});
  material.name='Cloud road · baked scattering and filtered billows';
  material.addEventListener('dispose',noise.release);
  material.onBeforeCompile=shader=>{
    shader.uniforms.uCloudNoise={value:noise.texture};shader.uniforms.uCloudSun={value:SKYSTREAM_SUN};
    shader.vertexShader='attribute vec2 cloudOptics; varying vec2 vCloudOptics; varying vec3 vCloudWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCloudWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vCloudOptics=cloudOptics;');
    shader.fragmentShader='uniform highp sampler3D uCloudNoise; uniform vec3 uCloudSun; varying vec2 vCloudOptics; varying vec3 vCloudWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 cloudDetail=texture(uCloudNoise,vCloudWorld/${CLOUD_NOISE_TILE_METRES.toFixed(1)}).rgb;
diffuseColor.rgb*=mix(vec3(.89,.94,1.0),vec3(1.0,.995,.975),smoothstep(.2,.78,cloudDetail.r));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
float cloudHeight=(cloudDetail.g*.72+cloudDetail.b*.28)*.045;
vec3 cloudQx=dFdx(-vViewPosition),cloudQy=dFdy(-vViewPosition);
vec3 cloudRx=cross(cloudQy,normal),cloudRy=cross(normal,cloudQx);
float cloudDet=dot(cloudQx,cloudRx);
normal=normalize(abs(cloudDet)*normal-sign(cloudDet)*(dFdx(cloudHeight)*cloudRx+dFdy(cloudHeight)*cloudRy));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`// View-independent baked penetration plus a small sunward silver lining.
vec3 cloudLight=vec3(.34,.46,.66)*.72+vec3(1.0,.965,.9)*(vCloudOptics.x*.66+vCloudOptics.y*.34);
float cloudRim=pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0);
float cloudSunView=pow(max(0.0,dot(normalize(vCloudWorld-cameraPosition),uCloudSun)),6.0);
cloudLight*=mix(.88,1.04,smoothstep(.28,.75,cloudDetail.r));
cloudLight+=vec3(1.0,.96,.87)*cloudRim*cloudSunView*.16*vCloudOptics.y;
outgoingLight=mix(outgoingLight,diffuseColor.rgb*cloudLight,.62);
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'skystream-cloud-baked-scattering-v2';
  return material;
}
