import * as THREE from 'three';
import type { RooVectorGlyph } from '../../src/roo-type/geometry';
import type { ColorLayer } from './color-projection';

// Measure each model pass's front-color baseline. The renderer retains local
// light/dark variation while putting all glyphs on the same reference palette.
export function modelFrontTexture(layer:ColorLayer,glyph:RooVectorGlyph){
  const c=document.createElement('canvas');c.width=layer.image.width;c.height=layer.image.height;
  const ctx=c.getContext('2d')!;ctx.drawImage(layer.image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  const out=new Uint8Array(64*4),[x,y,w,h]=layer.colorBounds,b=glyph.bounds;
  const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
  for(let i=0;i<64;i++){
    const gy=i/63,cy=y+(1-THREE.MathUtils.clamp((gy-b[1])/(b[3]-b[1]),0,1))*h;
    const samples:Array<[number,number,number,number]>=[];
    for(let yy=Math.max(0,Math.floor(cy-3));yy<Math.min(c.height,cy+4);yy++)for(let xx=x;xx<x+w;xx++){
      const q=(yy*c.width+xx)*4,r=pixels[q],g=pixels[q+1],bl=pixels[q+2],v=Math.max(r,g,bl);
      if(v<65||(r>50&&bl>50&&g<Math.min(r,bl)*.7))continue;
      samples.push([r,g,bl,v]);
    }
    samples.sort((a,b)=>a[3]-b[3]);
    const core=samples.slice(Math.floor(samples.length*.28),Math.max(1,Math.ceil(samples.length*.7)));
    for(let channel=0;channel<3;channel++)out[i*4+channel]=core.length?median(core.map(s=>s[channel])):i>0?out[(i-1)*4+channel]:180;
    out[i*4+3]=255;
  }
  const texture=new THREE.DataTexture(out,64,1,THREE.RGBAFormat);texture.needsUpdate=true;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;return texture;
}

// Front-face colors sampled from the provided B and warm counters, in sRGB.
// This is only used for unseen glyphs and the second colorway. Direct matching
// glyphs retain the reference's full two-dimensional color/light field.
export const PALETTE_GLSL=`
vec3 frontColor(float h,float bonus){
  if(bonus>.5){
    vec3 c=mix(vec3(0.,73.,203.),vec3(0.,87.,221.),smoothstep(.10,.17,h));
    c=mix(c,vec3(0.,168.,77.),smoothstep(.17,.40,h));
    c=mix(c,vec3(9.,186.,22.),smoothstep(.40,.49,h));
    c=mix(c,vec3(33.,202.,7.),smoothstep(.49,.65,h));
    c=mix(c,vec3(48.,197.,21.),smoothstep(.65,.81,h));return c/255.;
  }
  vec3 c=mix(vec3(178.,30.,5.),vec3(198.,42.,6.),smoothstep(0.,.16,h));
  c=mix(c,vec3(238.,79.,7.),smoothstep(.16,.43,h));
  c=mix(c,vec3(255.,148.,9.),smoothstep(.43,.66,h));
  c=mix(c,vec3(249.,207.,5.),smoothstep(.66,.90,h));
  return mix(c,vec3(252.,228.,13.),smoothstep(.90,1.,h))/255.;
}
vec3 toHSV(vec3 c){
  float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),d=mx-mn,h=0.;
  if(d>.00001){if(mx==c.r)h=mod((c.g-c.b)/d,6.);else if(mx==c.g)h=(c.b-c.r)/d+2.;else h=(c.r-c.g)/d+4.;h=fract(h/6.+1.);}
  return vec3(h,mx>.00001?d/mx:0.,mx);
}
vec3 fromHSV(vec3 hsv){
  float h=fract(hsv.x)*6.,c=hsv.z*hsv.y,x=c*(1.-abs(mod(h,2.)-1.)),m=hsv.z-c;vec3 rgb;
  if(h<1.)rgb=vec3(c,x,0.);else if(h<2.)rgb=vec3(x,c,0.);else if(h<3.)rgb=vec3(0.,c,x);
  else if(h<4.)rgb=vec3(0.,x,c);else if(h<5.)rgb=vec3(x,0.,c);else rgb=vec3(c,0.,x);return rgb+m;
}
float hueDelta(float a,float b){return mod(a-b+.5,1.)-.5;}
vec3 normalizeFront(vec3 c,vec3 modelBase,vec3 referenceBase){
  vec3 hsv=toHSV(c),a=toHSV(modelBase),b=toHSV(referenceBase);
  return fromHSV(vec3(b.x+hueDelta(hsv.x,a.x),clamp(hsv.y*b.y/max(.05,a.y),0.,1.),clamp(hsv.z*b.z/max(.05,a.z),0.,1.)));
}
vec3 highlightColor(float h,float bonus){
  if(bonus>.5){
    vec3 c=mix(vec3(50.,127.,235.),vec3(57.,207.,253.),smoothstep(0.,.2,h));
    c=mix(c,vec3(44.,241.,211.),smoothstep(.2,.4,h));
    c=mix(c,vec3(100.,255.,150.),smoothstep(.4,.6,h));
    return mix(c,vec3(182.,255.,88.),smoothstep(.6,1.,h))/255.;
  }
  vec3 c=mix(vec3(220.,102.,75.),vec3(246.,143.,114.),smoothstep(0.,.2,h));
  c=mix(c,vec3(255.,184.,125.),smoothstep(.2,.4,h));
  c=mix(c,vec3(255.,215.,109.),smoothstep(.4,.6,h));
  return mix(c,vec3(255.,251.,170.),smoothstep(.6,1.,h))/255.;
}
vec3 alternatePalette(vec3 c,float h,float sourceBonus,float targetBonus){
  vec3 hsv=toHSV(c),a=toHSV(frontColor(h,sourceBonus)),b=toHSV(frontColor(h,targetBonus));
  vec3 ah=toHSV(highlightColor(h,sourceBonus)),bh=toHSV(highlightColor(h,targetBonus));
  vec3 luma=vec3(.2126,.7152,.0722);
  float sourceL=dot(frontColor(h,sourceBonus),luma),pixelL=dot(c,luma),highL=dot(highlightColor(h,sourceBonus),luma);
  float strength=(pixelL-sourceL)/max(.025,highL-sourceL);
  float spec=clamp(max(strength,(a.y-hsv.y)/max(.1,a.y-ah.y)),0.,1.);
  float hue=b.x+hueDelta(bh.x,b.x)*spec;
  float saturation=mix(b.y,bh.y,spec);if(hsv.y<.12)saturation=min(saturation,hsv.y);
  float value=strength<0.?b.z*pixelL/max(.025,sourceL):mix(b.z,bh.z,spec);
  return fromHSV(vec3(hue,clamp(saturation,0.,1.),clamp(value,0.,1.)));
}
`;
