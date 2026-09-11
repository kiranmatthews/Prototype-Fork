/** Reversible menu inks applied only to a cached word, never to font assets. */
export type RooInk = 'tan' | 'white';
const luma=[.2126,.7152,.0722];
export function rooInkMatrix(ink:RooInk):number[]{
  const scale=ink==='tan'?[.50,.42,.30]:[.45,.45,.45];
  const bias=ink==='tan'?[.26,.17,.08]:[.55,.55,.55];
  return [...scale.flatMap((s,i)=>[...luma.map(v=>v*s),0,bias[i]]),0,0,0,1,0];
}
export function applyRooInk(ctx:CanvasRenderingContext2D,ink:RooInk):void {
  const pixels=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height),d=pixels.data,m=rooInkMatrix(ink);
  for(let p=0;p<d.length;p+=4){
    if(!d[p+3])continue;
    const r=d[p],g=d[p+1],b=d[p+2];
    for(let c=0;c<3;c++){const i=c*5;d[p+c]=Math.round(m[i]*r+m[i+1]*g+m[i+2]*b+m[i+4]*255);}
  }
  ctx.putImageData(pixels,0,0);
}
