import * as THREE from 'three';
import type {MotuHeatLook} from './motuLighting';

const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
/** Full-resolution variants of the existing coastal cloud painting. Sharing
 * the resulting texture with the ocean keeps the horizon/reflection exact. */
export class MotuSky {
  private source='';
  private readonly variants=new Map<string,THREE.CanvasTexture>();
  texture(source:THREE.Texture,look:MotuHeatLook):THREE.Texture {
    if(!look.skyPalette)return source;
    if(this.source!==source.uuid){this.dispose();this.source=source.uuid;}
    const cached=this.variants.get(look.name);if(cached)return cached;
    const image=source.image as HTMLCanvasElement,canvas=document.createElement('canvas');
    canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
    // The shared sea loader already crops the source to the exact waterline.
    const palette=look.skyPalette,top=rgb(palette.top),bottom=rgb(palette.bottom),cloud=rgb(palette.cloud),horizon=canvas.height;
    for(let y=0;y<canvas.height;y++){
      const altitude=Math.pow(Math.max(0,1-y/horizon),.63);
      for(let x=0;x<canvas.width;x++){
        const k=(y*canvas.width+x)*4,luma=(data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722)/255;
        const cover=THREE.MathUtils.smoothstep(luma,.56,.93)*(palette.stars?.42:.83);
        for(let c=0;c<3;c++)data[k+c]=(bottom[c]+(top[c]-bottom[c])*altitude)*(1-cover)+cloud[c]*cover;
      }
    }
    ctx.putImageData(pixels,0,0);
    if(palette.stars)for(let i=0;i<420;i++){
      const x=((i*.61803398875)%1)*canvas.width,y=((i*.41421356237)%1)*horizon*.83;
      const k=(Math.floor(y)*canvas.width+Math.floor(x))*4;
      if(data[k+2]>99)continue;
      ctx.fillStyle=`rgba(221,235,255,${.3+(i%5)*.12})`;ctx.beginPath();ctx.arc(x,y,.48+(i%3)*.24,0,Math.PI*2);ctx.fill();
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=source.colorSpace;texture.wrapS=source.wrapS;texture.wrapT=source.wrapT;
    texture.repeat.copy(source.repeat);texture.offset.copy(source.offset);texture.center.copy(source.center);texture.rotation=source.rotation;
    texture.minFilter=source.minFilter;texture.magFilter=source.magFilter;texture.anisotropy=source.anisotropy;
    this.variants.set(look.name,texture);return texture;
  }
  get count(){return this.variants.size;}
  dispose(){for(const texture of this.variants.values())texture.dispose();this.variants.clear();}
}
