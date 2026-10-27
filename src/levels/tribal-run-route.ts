import {CatmullRomCurve3, Vector3} from 'three';
import type {CustomComponent} from '../level';

export type TribalPoint=[number,number,number];
export type TribalScalar=number|((s:number)=>number);
export const TRIBAL_RUN_LENGTH=2320;
const knots=[[0,0],[0,-140],[-70,-250],[-135,-340],[-115,-455],[15,-500],
 [165,-440],[245,-310],[345,-325],[395,-455],[355,-620],[220,-720],
 [100,-775],[85,-920],[215,-1030],[385,-1040],[470,-1160],[455,-1320],[330,-1420]];
const raw=new CatmullRomCurve3(knots.map(([x,z])=>new Vector3(x,0,z)),false,'centripetal');
raw.arcLengthDivisions=4096;
const scale=TRIBAL_RUN_LENGTH/raw.getLength();
const curve=new CatmullRomCurve3(knots.map(([x,z])=>new Vector3(x*scale,0,z*scale)),false,'centripetal');
curve.arcLengthDivisions=4096;
const grid=(n:number)=>Math.round(n*4096)/4096;
export const tribalValue=(v:TribalScalar,s:number)=>typeof v==='function'?v(s):v;
export const tribalMix=(a:number,b:number,t:number)=>a+(b-a)*Math.max(0,Math.min(1,t));
export const tribalSmooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function tribalTangent(s:number):TribalPoint {
 const d=curve.getTangentAt(Math.max(0,Math.min(1,s/TRIBAL_RUN_LENGTH)));
 return[d.x,0,d.z];
}
export function tribalPoint(s:number,y=0,u=0):TribalPoint {
 const t=Math.max(0,Math.min(1,s/TRIBAL_RUN_LENGTH)),p=curve.getPointAt(t),d=tribalTangent(s);
 const excess=s<0?s:s>TRIBAL_RUN_LENGTH?s-TRIBAL_RUN_LENGTH:0;
 return[p.x+d[0]*excess-d[2]*u,y,p.z+d[2]*excess+d[0]*u].map(grid) as TribalPoint;
}
export const tribalYaw=(s:number)=>Math.atan2(-tribalTangent(s)[0],-tribalTangent(s)[2])*180/Math.PI;
const samples=Array.from({length:1161},(_,i)=>({s:i*2,p:tribalPoint(i*2)}));
export function tribalProgress(q:TribalPoint|{x:number;z:number}):number {
 const x=Array.isArray(q)?q[0]:q.x,z=Array.isArray(q)?q[2]:q.z;let best=Infinity,result=0;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2];
  const t=Math.max(0,Math.min(1,((x-a.p[0])*dx+(z-a.p[2])*dz)/(dx*dx+dz*dz)));
  const d=(x-a.p[0]-dx*t)**2+(z-a.p[2]-dz*t)**2;
  if(d<best){best=d;result=a.s+2*t;}
 }return result;
}

/** Closed, metre-authored greybox surfaces. All later art retains these exact
 * native top faces, collision and ordinary grindable edges. */
export function tribalRibbon(a:number,b:number,top:TribalScalar,width:TribalScalar,offset:TribalScalar,
 grp:number,nm:string,color='#afb6ba',depth=5):CustomComponent[] {
 const out:CustomComponent[]=[],count=Math.ceil((b-a)/56);
 for(let k=0;k<count;k++){
  const lo=a+(b-a)*k/count,hi=a+(b-a)*(k+1)/count,n=Math.ceil((hi-lo)/(typeof width==='function'?.6:1.6));
  const origin=tribalPoint(lo,0),vertices:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[];
  const topPoints:TribalPoint[][]=[];
  for(let i=0;i<=n;i++){
   const s=lo+(hi-lo)*i/n,y=tribalValue(top,s),w=tribalValue(width,s),u=tribalValue(offset,s);
   const row:TribalPoint[]=[];
   for(const side of [-1,1]){
    const p=tribalPoint(s,y,u+side*w/2);vertices.push(p[0]-origin[0],p[1],p[2]-origin[2]);row.push(p);
    uvs.push((side+1)*w/8,(s-a)/4);
    const before=Math.max(a,s-.04),after=Math.min(b,s+.04),f=tribalTangent(s);
    const p0=tribalPoint(before,tribalValue(top,before),tribalValue(offset,before)+side*tribalValue(width,before)/2);
    const p1=tribalPoint(after,tribalValue(top,after),tribalValue(offset,after)+side*tribalValue(width,after)/2);
    const along=new Vector3(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]);
    normals.push(...new Vector3(-f[2],0,f[0]).cross(along).normalize().toArray());
   }
   topPoints.push(row);
  }
  for(let i=0;i<n;i++){const p=i*2,q=p+2;indices.push(p,p+1,q+1,p,q+1,q);}
  const grindTopTriangles=indices.length/3;
  const lowered=(p:TribalPoint):TribalPoint=>[p[0],p[1]-depth,p[2]];
  const face=(points:TribalPoint[],faceUV?:number[][])=>{
   const base=vertices.length/3,a=new Vector3(...points[0]),normal=new Vector3(...points[1]).sub(a).cross(new Vector3(...points[2]).sub(a)).normalize();
   for(let j=0;j<4;j++){const p=points[j];vertices.push(p[0]-origin[0],p[1],p[2]-origin[2]);normals.push(...normal.toArray());
    uvs.push(...(faceUV?.[j]??[(Math.abs(normal.x)>.5?p[2]:p[0])/4,p[1]/4]));}
   indices.push(base,base+1,base+2,base,base+2,base+3);
  };
  for(let i=0;i<n;i++){
   const [left,right]=topPoints[i],[nextLeft,nextRight]=topPoints[i+1];
   const u=(lo+(hi-lo)*i/n)/4,v=(lo+(hi-lo)*(i+1)/n)/4;
   face([left,nextLeft,lowered(nextLeft),lowered(left)],[[u,left[1]/4],[v,nextLeft[1]/4],[v,(nextLeft[1]-depth)/4],[u,(left[1]-depth)/4]]);
   face([right,lowered(right),lowered(nextRight),nextRight],[[u,right[1]/4],[u,(right[1]-depth)/4],[v,(nextRight[1]-depth)/4],[v,nextRight[1]/4]]);
   const bottom=[lowered(left),lowered(nextLeft),lowered(nextRight),lowered(right)];
   face(bottom,bottom.map(p=>[p[0]/4,p[2]/4]));
  }
  const first=topPoints[0],last=topPoints[n];
  face([first[0],lowered(first[0]),lowered(first[1]),first[1]]);
  face([last[0],last[1],lowered(last[1]),lowered(last[0])]);
  out.push({t:'mesh',p:origin,vertices,indices,normals,uvs,grindTopTriangles,solidSides:true,smoothCollision:true,tex:'solid',color,grp,nm});
 }return out;
}
