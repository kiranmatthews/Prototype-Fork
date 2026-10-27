import { roundCorners } from '../pathNodes';
import type { SpaghettiPoint as P, SpaghettiRun } from './spaghetti-rails';

/** Turn a continuous sketch into distinct editable rails with real air gaps.
 * Each gap has a straight departure and a long, parallel receiving window.
 * Height gained during the jump replaces part of a momentum-draining climb. */
export function splitSpaghettiRun(run:SpaghettiRun,fractions:readonly number[]):SpaghettiRun[] {
  if(!fractions.length)return [run];
  const p=run.nodes[0],points=roundCorners(run.nodes.map(q=>[q[0]-p[0],q[2]-p[2],run.radius,q[1]-p[1]]),false)
    .map(q=>[p[0]+q.x,p[1]+q.y,p[2]+q.z] as P);
  const arc=[0];
  for(let i=1;i<points.length;i++)arc.push(arc[i-1]+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));
  const length=arc[arc.length-1];
  const sample=(s:number):P=>{
    s=Math.max(0,Math.min(length,s));let i=0;while(i<arc.length-2&&arc[i+1]<s)i++;
    const t=(s-arc[i])/(arc[i+1]-arc[i]||1);
    return points[i].map((v,k)=>v+(points[i+1][k]-v)*t) as P;
  };
  const cuts=fractions.map(t=>{
    const at=length*t,a=sample(at),lo=sample(at-.2),hi=sample(at+.2),n=Math.hypot(hi[0]-lo[0],hi[2]-lo[2]);
    const f=[(hi[0]-lo[0])/n,(hi[2]-lo[2])/n];
    const point=(d:number,y:number):P=>[a[0]+f[0]*d,y,a[2]+f[1]*d];
    const receivingY=Math.min(a[1]+.8,sample(at+40)[1]);
    return {at,before:point(-22,a[1]),end:a,start:point(10,receivingY),after:point(39,receivingY)};
  });
  return Array.from({length:cuts.length+1},(_,i)=>{
    const previous=cuts[i-1],next=cuts[i],nodes:P[]=[];
    if(previous)nodes.push(previous.start,previous.after);
    const from=previous?previous.at+55:0,to=next?next.at-35:length;
    // Keep a real span before the final sample. A sub-metre remainder makes
    // the parallel strand's offset bisector fold back into a tiny cusp.
    for(let s=from;s<to-4;s+=12)nodes.push(sample(s));
    nodes.push(sample(to));
    if(next)nodes.push(next.before,next.end);
    const rounded=nodes.map(q=>q.map(v=>Math.round(v*1000)/1000) as P)
      .filter((q,j,list)=>!j||Math.hypot(...q.map((v,k)=>v-list[j-1][k]))>.02);
    return {...run,name:`${run.name} / thread ${i+1}`,radius:Math.min(9,run.radius),nodes:rounded,
      dock:i===0?run.dock:undefined,jumpEntry:i>0||run.jumpEntry};
  });
}
