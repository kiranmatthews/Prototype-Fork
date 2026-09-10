import * as THREE from 'three';
import type { RooVectorGlyph } from '../../src/roo-type/geometry';
import type { ColorLayer } from './color-projection';

// Measure each model pass's front-color baseline. The renderer retains local
// light/dark variation while putting all glyphs on the same reference palette.
export function modelFrontTexture(layer:ColorLayer,glyph:RooVectorGlyph){
  const c=document.createElement('canvas');c.width=layer.image.width;c.height=layer.image.height;
  const ctx=c.getContext('2d')!;ctx.drawImage(layer.image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  const rows:number[][]=[],[x,y,w,h]=layer.colorBounds,b=glyph.bounds;
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
    rows.push([0,1,2].map(channel=>core.length?median(core.map(s=>s[channel])):i>0?rows[i-1][channel]:180));
  }
  // The old 64-row, 8-bit median followed each hole and bevel. Dividing by
  // that profile painted horizontal bands into an otherwise smooth model.
  // A broad, continuous floating-point profile describes only the material
  // gradient; local lighting remains in the model image.
  const out=new Float32Array(256*4);
  for(let i=0;i<256;i++){
    const row=i/255*63;let weight=0;
    for(let j=0;j<64;j++){
      const k=Math.exp(-.5*((j-row)/5.5)**2);weight+=k;
      for(let channel=0;channel<3;channel++)out[i*4+channel]+=rows[j][channel]/255*k;
    }
    for(let channel=0;channel<3;channel++)out[i*4+channel]/=weight;
    out[i*4+3]=1;
  }
  const texture=new THREE.DataTexture(out,256,1,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;return texture;
}

// Front-face colors sampled from the provided B and warm counters, in sRGB.
// This is only used for unseen glyphs and the second colorway. Direct matching
// glyphs retain the reference's full two-dimensional color/light field.
export const PALETTE_GLSL=`
vec3 curve(vec3 a,vec3 b,vec3 c,vec3 d,float t){
  return clamp(.5*((2.*b)+(-a+c)*t+(2.*a-5.*b+4.*c-d)*t*t+(-a+3.*b-3.*c+d)*t*t*t),0.,255.);
}
vec3 frontColor(float h,float bonus){
  vec3 a=mix(vec3(178.,30.,5.),vec3(0.,73.,203.),bonus);
  vec3 b=mix(vec3(210.,53.,7.),vec3(0.,90.,220.),bonus);
  vec3 c=mix(vec3(234.,76.,8.),vec3(0.,170.,75.),bonus);
  vec3 d=mix(vec3(254.,130.,9.),vec3(27.,199.,10.),bonus);
  vec3 e=mix(vec3(252.,191.,6.),vec3(48.,198.,20.),bonus);
  vec3 f=mix(vec3(252.,228.,13.),vec3(48.,197.,21.),bonus);
  float u=clamp(h,0.,1.)*5.;
  if(u<1.)return curve(a,a,b,c,u)/255.;
  if(u<2.)return curve(a,b,c,d,u-1.)/255.;
  if(u<3.)return curve(b,c,d,e,u-2.)/255.;
  if(u<4.)return curve(c,d,e,f,u-3.)/255.;
  return curve(d,e,f,f,u-4.)/255.;
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
  vec3 base=frontColor(h,sourceBonus),target=frontColor(h,targetBonus);
  vec3 luma=vec3(.2126,.7152,.0722);
  float delta=(dot(c,luma)-dot(base,luma))/max(.08,dot(base,luma));
  float desaturate=max(0.,toHSV(base).y-toHSV(c).y);
  float glint=clamp(max(delta*1.8,desaturate*1.4),0.,1.);
  return mix(target*clamp(1.+min(0.,delta)*.65,.62,1.),highlightColor(h,targetBonus),glint);
}
vec3 normalizeFront(vec3 c,vec3 modelBase,float h,float targetBonus){
  vec3 luma=vec3(.2126,.7152,.0722),target=frontColor(h,targetBonus);
  float delta=(dot(c,luma)-dot(modelBase,luma))/max(.08,dot(modelBase,luma));
  float desaturate=max(0.,toHSV(modelBase).y-toHSV(c).y);
  float glint=clamp(max(delta*2.,desaturate*1.5),0.,1.);
  return mix(target*clamp(1.+min(0.,delta)*.65,.62,1.),highlightColor(h,targetBonus),glint);
}
`;
