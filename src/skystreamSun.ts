import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

export const SKYSTREAM_SUN = new THREE.Vector3(-.34,.38,-.86).normalize();

/** GPU-occluded optical ghosts. The sun's HDR disk and bloom live in the
 * directional sky shader; these elements track that same immutable direction. */
export function createSkystreamSun(): Lensflare {
  const flare=new Lensflare();flare.name='Skystream sun · occluded lens flare';flare.visible=false;
  const texture=(ring:boolean)=>{
    const size=128,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const dx=(x+.5-size/2)/(size/2),dy=(y+.5-size/2)/(size/2),r=Math.hypot(dx,dy);
      const a=ring?Math.exp(-(((r-.66)/.075)**2))*.18+Math.max(0,1-r)*.025:Math.exp(-r*r*7)*.32;
      const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*a);
    }
    const tex=new THREE.DataTexture(data,size,size);tex.needsUpdate=true;tex.minFilter=tex.magFilter=THREE.LinearFilter;return tex;
  };
  const glow=texture(false),ring=texture(true);
  flare.addElement(new LensflareElement(glow,300,0,new THREE.Color(1,.86,.64)));
  flare.addElement(new LensflareElement(ring,60,.42,new THREE.Color(.35,.65,1)));
  flare.addElement(new LensflareElement(glow,38,.7,new THREE.Color(.35,.85,.65)));
  flare.addElement(new LensflareElement(ring,110,1.12,new THREE.Color(1,.68,.35)));
  const render=flare.onBeforeRender;
  flare.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
    const e=camera.matrixWorld.elements,d=('far' in camera?Number(camera.far):400)*.92;
    this.matrixWorld.makeTranslation(e[12]+SKYSTREAM_SUN.x*d,e[13]+SKYSTREAM_SUN.y*d,e[14]+SKYSTREAM_SUN.z*d);
    render.call(this,renderer,scene,camera,geometry,material,group);
  };
  return flare;
}
