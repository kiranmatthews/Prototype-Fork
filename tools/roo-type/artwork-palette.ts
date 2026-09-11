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
