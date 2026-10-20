import * as THREE from 'three';
import { SCULPTED_DATA } from './sculpted-data';

export type SculptedName=keyof typeof SCULPTED_DATA;
function bytes(encoded:string){const text=atob(encoded),result=new Uint8Array(text.length);for(let i=0;i<text.length;i++)result[i]=text.charCodeAt(i);return result;}
/** Synchronous, shared buffers: no model fetch or loading-time replacement pop. */
export function sculptedGeometry(name:SculptedName,group='main'){
  const data=SCULPTED_DATA[name],geometry=new THREE.BufferGeometry();
  for(const [key,encoded,size] of [['position',data.position,3],['normal',data.normal,3],['uv',data.uv,2]] as const){
    geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(bytes(encoded).buffer),size));
  }
  const indices=data.indices as Record<string,string>;
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(indices[group]).buffer),1));
  geometry.computeBoundingSphere();geometry.userData={source:'Meshy',component:name};return geometry;
}
export function sculptedTexture(name:SculptedName,neutral=false){
  const data=SCULPTED_DATA[name],pixels=bytes(data.pixels);
  if(neutral)for(let i=0;i<pixels.length;i+=4){const value=Math.max(pixels[i],pixels[i+1],pixels[i+2]);pixels[i]=pixels[i+1]=pixels[i+2]=value;}
  const texture=new THREE.DataTexture(pixels,data.textureSize,data.textureSize,THREE.RGBAFormat);
  texture.name=`Meshy-${name}${neutral?'-neutral':''}`;texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.flipY=false;texture.needsUpdate=true;return texture;
}
