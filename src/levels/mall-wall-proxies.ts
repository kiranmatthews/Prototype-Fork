type Point = [number, number, number];
export type MallWall = {a:Point; b:Point; height:number; heights?:[number,number]; source:number};
type Range = [number, number];

/** Preserve holes in a coplanar triangle patch when making native wall paths.
 * A connected frame is not necessarily a filled rectangle. */
export function clipMallWallOpening(wall:MallWall, faces:Point[][]):MallWall[] {
 const {a,b,height}=wall,dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
 if(length<.001)return[wall];
 const ux=dx/length,uz=dz/length;
 const project=(p:Point):Range=>[(p[0]-a[0])*ux+(p[2]-a[2])*uz,p[1]];
 const triangles=faces.filter(ps=>ps.every(p=>Math.abs((p[0]-a[0])*uz-(p[2]-a[2])*ux)<.006))
  .map(ps=>ps.map(project)).filter(ps=>Math.max(...ps.map(p=>p[0]))>0&&Math.min(...ps.map(p=>p[0]))<length);
 if(!triangles.length)return[wall];
 const base=(x:number)=>a[1]+(b[1]-a[1])*x/length;
 const ranges=(x:number):Range[]=>{
  const values:Range[]=[];
  for(const ps of triangles){
   const ys:number[]=[];
   for(let i=0;i<3;i++){
    const p=ps[i],q=ps[(i+1)%3],d=q[0]-p[0];
    if(Math.abs(d)<1e-8)continue;
    const t=(x-p[0])/d;if(t>=0&&t<=1)ys.push(p[1]+(q[1]-p[1])*t);
   }
   if(ys.length<2)continue;
   const lo=Math.max(base(x),Math.min(...ys)),hi=Math.min(base(x)+height,Math.max(...ys));
   if(hi-lo>1e-7)values.push([lo,hi]);
  }
  values.sort((p,q)=>p[0]-q[0]);
  const merged:Range[]=[];
  for(const r of values){const previous=merged[merged.length-1];if(previous&&r[0]<=previous[1]+.002)previous[1]=Math.max(previous[1],r[1]);else merged.push([...r]);}
  return merged;
 };
 const cuts=[...new Set([0,length,...triangles.flatMap(ps=>ps.map(p=>p[0])).filter(x=>x>0&&x<length)])].sort((x,y)=>x-y);
 // Require positive evidence of an enclosed opening. Ordinary triangular
 // wall ends keep their established conservative collision envelope.
 if(!cuts.slice(1).some((x,i)=>ranges((x+cuts[i])/2).length>1))return[wall];
 const result:MallWall[]=[],at=(x:number,y:number):Point=>[a[0]+ux*x,y,a[2]+uz*x];
 const slice=(lo:number,hi:number,depth=0):void=>{
  if(hi-lo<.001)return;
  const r0=ranges(lo+(hi-lo)*.25),r1=ranges(lo+(hi-lo)*.75);
  if(r0.length!==r1.length){if(depth>=10)throw Error('Unresolved Mall wall opening');const mid=(lo+hi)/2;slice(lo,mid,depth+1);slice(mid,hi,depth+1);return;}
  for(let i=0;i<r0.length;i++){
   const low0=1.5*r0[i][0]-.5*r1[i][0],low1=1.5*r1[i][0]-.5*r0[i][0];
   const top0=1.5*r0[i][1]-.5*r1[i][1],top1=1.5*r1[i][1]-.5*r0[i][1];
   const heights:[number,number]=[Math.max(0,top0-low0),Math.max(0,top1-low1)];
   if(Math.max(...heights)>.01)result.push({...wall,a:at(lo,low0),b:at(hi,low1),height:Math.max(...heights),heights});
  }
 };
 for(let i=1;i<cuts.length;i++)slice(cuts[i-1],cuts[i]);
 return result;
}
