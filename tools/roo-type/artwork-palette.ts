/** A pointwise hue grade only: no geometry, normals, height masks or relighting.
 * Value, saturation, alpha and every painted detail remain supplied by the art.
 */
export function goldToBonus(source:HTMLCanvasElement){
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const ctx=canvas.getContext('2d')!,pixels=source.getContext('2d')!.getImageData(0,0,source.width,source.height),d=pixels.data;
 const x=[0,8,16,24,36,60],y=[235,230,212,170,128,115],slopes:number[]=[];
 const secants=x.slice(1).map((v,i)=>(y[i+1]-y[i])/(v-x[i]));
 slopes.push(secants[0]);for(let i=1;i<x.length-1;i++){
  const a=x[i]-x[i-1],b=x[i+1]-x[i],w1=2*b+a,w2=b+2*a;
  slopes.push((w1+w2)/(w1/secants[i-1]+w2/secants[i]));
 }slopes.push(secants.at(-1)!);
 function hueGrade(value:number){
  value=Math.max(0,Math.min(60,value));let i=0;while(i<x.length-2&&value>x[i+1])i++;
  const h=x[i+1]-x[i],t=(value-x[i])/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*y[i]+(t3-2*t2+t)*h*slopes[i]+(-2*t3+3*t2)*y[i+1]+(t3-t2)*h*slopes[i+1];
 }
 for(let p=0;p<d.length;p+=4){
  if(!d[p+3])continue;const r=d[p]/255,g=d[p+1]/255,b=d[p+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),delta=mx-mn;
  if(delta<1e-6)continue;
  let hue=(mx===r?(g-b)/delta:mx===g?(b-r)/delta+2:(r-g)/delta+4)*60;if(hue>300)hue-=360;
  const h=hueGrade(hue)/60,s=delta/Math.max(1e-6,mx),c=mx*s,z=c*(1-Math.abs(h%2-1)),m=mx-c;
  const rgb=h<1?[c,z,0]:h<2?[z,c,0]:h<3?[0,c,z]:h<4?[0,z,c]:h<5?[z,0,c]:[c,0,z];
  for(let k=0;k<3;k++)d[p+k]=Math.round((rgb[k]+m)*255);
 }
 ctx.putImageData(pixels,0,0);return canvas;
}

/** V7: derive lightness from the approved gold, with quieter chroma and contrast.
 * Oklab matrices: https://bottosson.github.io/posts/oklab/ (public domain).
 * This is a pointwise color grade; geometry, texture and alpha are untouched.
 */
export function goldToBonusBalanced(source:HTMLCanvasElement){
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const ctx=canvas.getContext('2d')!,pixels=source.getContext('2d')!.getImageData(0,0,source.width,source.height),d=pixels.data;
 const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 const srgb=(v:number)=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
 const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 const hues=[0,8,16,24,36,60],target=[268,265,257,215,151,139];
 const secants=hues.slice(1).map((h,i)=>(target[i+1]-target[i])/(h-hues[i])),slopes=[secants[0]];
 for(let i=1;i<hues.length-1;i++){
  const a=hues[i]-hues[i-1],b=hues[i+1]-hues[i],w1=2*b+a,w2=b+2*a;
  slopes.push((w1+w2)/(w1/secants[i-1]+w2/secants[i]));
 }slopes.push(secants.at(-1)!);
 const cache=new Map<number,number>();
 const rgbFromLab=(L:number,a:number,b:number)=>{
  const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
  return[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
 };
 for(let p=0;p<d.length;p+=4){
  if(!d[p+3])continue;const key=(d[p]<<16)|(d[p+1]<<8)|d[p+2];let graded=cache.get(key);
  if(graded===undefined){
   const r=d[p]/255,g=d[p+1]/255,b=d[p+2]/255,max=Math.max(r,g,b),delta=max-Math.min(r,g,b);
   if(delta<1e-6){cache.set(key,key);continue;}
   let hue=(max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4)*60;if(hue>300)hue-=360;
   hue=Math.max(0,Math.min(60,hue));let i=0;while(i<hues.length-2&&hue>hues[i+1])i++;
   const span=hues[i+1]-hues[i],t=(hue-hues[i])/span,t2=t*t,t3=t2*t;
   const angle=((2*t3-3*t2+1)*target[i]+(t3-2*t2+t)*span*slopes[i]+(-2*t3+3*t2)*target[i+1]+(t3-t2)*span*slopes[i+1])*Math.PI/180;
   const R=linear(r),G=linear(g),B=linear(b);
   const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B),m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B),s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);
   const L=.2104542553*l+.793617785*m-.0040720468*s,a=1.9779984951*l-2.428592205*m+.4505937099*s,b2=.0259040371*l+.7827717662*m-.808675766*s,C=Math.hypot(a,b2);
   const glint=smooth(.8,.97,L)*(1-smooth(.03,.11,C)),lightness=(.12+.76*L)*(1-glint)+L*glint;
   const chroma=C*.8,ca=Math.cos(angle),cb=Math.sin(angle);let rgb=rgbFromLab(lightness,chroma*ca,chroma*cb);
   // Reduce chroma before encoding instead of clipping individual RGB channels.
   if(rgb.some(v=>v<0||v>1)){
    let low=0,high=chroma;for(let step=0;step<10;step++){const c=(low+high)/2,test=rgbFromLab(lightness,c*ca,c*cb);if(test.every(v=>v>=0&&v<=1))low=c;else high=c;}
    rgb=rgbFromLab(lightness,low*ca,low*cb);
   }
   const bytes=rgb.map(v=>Math.round(Math.max(0,Math.min(1,srgb(v)))*255));graded=(bytes[0]<<16)|(bytes[1]<<8)|bytes[2];cache.set(key,graded);
  }
  d[p]=graded>>16;d[p+1]=(graded>>8)&255;d[p+2]=graded&255;
 }
 ctx.putImageData(pixels,0,0);return canvas;
}

/** V8 follows the original reference's lime/green and azure/cobalt pigment.
 * No height masks: retain every painted surface and white specular glint.
 */
export function goldToBonusReference(source:HTMLCanvasElement){
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const ctx=canvas.getContext('2d')!,pixels=source.getContext('2d')!.getImageData(0,0,source.width,source.height),d=pixels.data;
 const x=[0,8,14,20,30,45,60],hues=[221,218,215,150,115,111,108];
 const slopes:number[]=[],secants=x.slice(1).map((v,i)=>(hues[i+1]-hues[i])/(v-x[i]));
 slopes.push(secants[0]);for(let i=1;i<x.length-1;i++){const a=x[i]-x[i-1],b=x[i+1]-x[i],w1=2*b+a,w2=b+2*a;slopes.push((w1+w2)/(w1/secants[i-1]+w2/secants[i]));}slopes.push(secants.at(-1)!);
 const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 for(let p=0;p<d.length;p+=4){
  if(!d[p+3])continue;const r=d[p]/255,g=d[p+1]/255,b=d[p+2]/255,v=Math.max(r,g,b),delta=v-Math.min(r,g,b);if(delta<1e-6)continue;
  let hue=(v===r?(g-b)/delta:v===g?(b-r)/delta+2:(r-g)/delta+4)*60;if(hue>300)hue-=360;hue=Math.max(0,Math.min(60,hue));
  let i=0;while(i<x.length-2&&hue>x[i+1])i++;const span=x[i+1]-x[i],t=(hue-x[i])/span,t2=t*t,t3=t2*t;
  const h=((2*t3-3*t2+1)*hues[i]+(t3-2*t2+t)*span*slopes[i]+(-2*t3+3*t2)*hues[i+1]+(t3-t2)*span*slopes[i+1])/60;
  const green=smooth(15,30,hue),s0=delta/v,pigment=smooth(.12,.7,s0),s=s0*(.99-.08*green),value=v*(1-pigment*(.14+.08*green));
  const c=value*s,z=c*(1-Math.abs(h%2-1)),m=value-c,rgb=h<1?[c,z,0]:h<2?[z,c,0]:h<3?[0,c,z]:h<4?[0,z,c]:h<5?[z,0,c]:[c,0,z];
  for(let k=0;k<3;k++)d[p+k]=Math.round((rgb[k]+m)*255);
 }
 ctx.putImageData(pixels,0,0);return canvas;
}

/** Strengthen only newly lit specular pixels from the image-model edit. */
export function enhanceModelGlisten(source:HTMLCanvasElement,neutral:HTMLCanvasElement){
 const ctx=source.getContext('2d')!,pixels=ctx.getImageData(0,0,source.width,source.height),d=pixels.data,n=neutral.getContext('2d')!.getImageData(0,0,source.width,source.height).data;
 const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 for(let p=0;p<d.length;p+=4){if(!d[p+3])continue;
  const white=Math.min(d[p],d[p+1],d[p+2])-Math.min(n[p],n[p+1],n[p+2]);
  const gain=.88*smooth(12,75,white)*smooth(185,245,Math.max(d[p],d[p+1],d[p+2]));
  for(let k=0;k<3;k++)d[p+k]=Math.round(d[p+k]+(255-d[p+k])*gain);
 }
 ctx.putImageData(pixels,0,0);return source;
}
