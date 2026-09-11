/** Authoring-only bitmap treatment. Finished model artwork owns its contour. */
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};

function morphology(mask:Uint8Array,w:number,h:number,dilate:boolean){
 const out=new Uint8Array(mask.length);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  let value=dilate?0:1;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)value=dilate?value|mask[(y+dy)*w+x+dx]:value&mask[(y+dy)*w+x+dx];
  out[y*w+x]=value;
 }
 return out;
}

/** Remove a model's matte/islands, retaining its own complete colored bevels.
 * This never reads or clips against the original Roo vector silhouette.
 */
export function modelCutout(image:HTMLImageElement){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d')!;
 ctx.drawImage(image,0,0);const raw=ctx.getImageData(0,0,canvas.width,canvas.height),d=raw.data,w=canvas.width,h=canvas.height,n=w*h;
 const transparent=[0,w-1,(h-1)*w,n-1].some(p=>d[p*4+3]<16);
 const magenta=!transparent&&[0,w-1,(h-1)*w,n-1].filter(p=>d[p*4]>150&&d[p*4+1]<80&&d[p*4+2]>150).length>=3;
 if(!transparent&&!magenta)throw new Error('A clean alpha or flat magenta master is required; gray mattes can erase white bevel glints');
 const eligible=new Uint8Array(n);let count=0;
 for(let p=0;p<n;p++){
  const r=d[p*4],g=d[p*4+1],b=d[p*4+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);
  const color=magenta?!(r>80&&b>80&&g<Math.min(r,b)*.74)&&hi>35:hi-lo>16&&hi>35;
  eligible[p]=transparent?Number(d[p*4+3]>32):Number(color);count+=eligible[p];
 }
 const seen=new Uint8Array(n),kept=new Uint8Array(n),queue=new Int32Array(n),components:number[]=[];
 for(let seed=0;seed<n;seed++)if(eligible[seed]&&!seen[seed]){
  let end=1;queue[0]=seed;seen[seed]=1;
  for(let head=0;head<end;head++){
   const p=queue[head],x=p%w,y=Math.floor(p/w);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy,q=yy*w+xx;
    if(xx>=0&&xx<w&&yy>=0&&yy<h&&eligible[q]&&!seen[q]){seen[q]=1;queue[end++]=q;}
   }
  }
  if(end>=Math.max(12,count*.0008)){components.push(end);for(let i=0;i<end;i++)kept[queue[i]]=1;}
 }
 if(!components.length)throw new Error('Model has no usable colored glyph');
 const closed=morphology(morphology(kept,w,h,true),w,h,false);
 const core=morphology(morphology(closed,w,h,false),w,h,false);
 const nearest=new Int32Array(n);nearest.fill(-1);const distance=new Uint8Array(n);let end=0;
 for(let p=0;p<n;p++)if(core[p]){nearest[p]=p;queue[end++]=p;}
 if(!end)throw new Error('Model glyph has no solid interior');
 for(let head=0;head<end;head++){
  const p=queue[head];if(distance[p]>=4)continue;const x=p%w,y=Math.floor(p/w);
  for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&nearest[q]<0){nearest[q]=nearest[p];distance[q]=distance[p]+1;queue[end++]=q;}
 }
 const result=new ImageData(w,h),out=result.data;let left=w,top=h,right=0,bottom=0,opaque=0;
 for(let p=0;p<n;p++){
  const donor=nearest[p];if(donor<0)continue;let a=0;
  if(transparent)a=(kept[p]||distance[p]<=3)?d[p*4+3]/255:0;
  else if(core[p])a=1;
  else if(magenta){
   let dot=0,length=0;
   for(let k=0;k<3;k++){const bg=k===1?0:255,v=d[donor*4+k]-bg;dot+=(d[p*4+k]-bg)*v;length+=v*v;}
   a=clamp(dot/Math.max(1,length));
  }
  if(a<.018)continue;
  const q=p*4;out[q+3]=Math.round(a*255);
  for(let k=0;k<3;k++)out[q+k]=a>.985?d[q+k]:d[donor*4+k];
  const x=p%w,y=Math.floor(p/w);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);if(a>.98)opaque++;
 }
 ctx.putImageData(result,0,0);
 return{canvas,bounds:[left,top,right-left,bottom-top] as const,background:transparent?'alpha':'magenta matte',components:components.length,opaque};
}
