import type {Vector3} from 'three';
import type {Rail,RailSample} from './rails';

export type NativePoint=[number,number,number];
export interface ReferenceRailFrame {origin:NativePoint;axes:NativePoint;unit:number;}
// Native 20.12 line-pair decisions, independently checked against the pinned
// source's C++ and GTE routines. See docs/mall/rail-capture.json.
const short=(n:number)=>(n<<16)>>16;
const sub=(a:NativePoint,b:NativePoint):NativePoint=>a.map((n,i)=>(n-b[i])|0) as NativePoint;
const shift=(a:NativePoint,b:number):NativePoint=>a.map(n=>n>>b) as NativePoint;
const cross=(a:NativePoint,b:NativePoint):NativePoint=>[1,2,0].map(j=>{const k=(j+1)%3;return(short(a[j])*short(b[k])-short(a[k])*short(b[j]))|0;}) as NativePoint;
const squares=(a:NativePoint):NativePoint=>a.map(n=>short(n)**2) as NativePoint;
const sum=(a:number[])=>a.reduce((n,v)=>(n+v)|0,0);
const dot=(a:NativePoint,b:NativePoint)=>sum(a.map((n,i)=>short(n)*short(b[i])));

export function nativeSquareRoot(n:number){
 n|=0;if(!n)return 0;
 const shift=n<0?0:Math.clz32(n)&~1,top=((n>>>0)<<shift)>>>20;
 // Every one of the 3072 original entries equals this midpoint expression.
 return Math.floor(Math.sqrt((top+.5)*1048576))>>>(shift/2);
}

export function nativeLinePair(a:NativePoint,b:NativePoint,c:NativePoint,d:NativePoint){
 const u=shift(sub(b,a),12),v=shift(sub(d,c),12),w=shift(sub(a,c),12);
 let axis=cross(u,v),bits=0;
 while(axis.some(n=>n>26754||n< -26754)){axis=shift(axis,1);bits++;}
 const squared=squares(axis);
 const point=(direction:NativePoint,start:NativePoint,end:NativePoint,delta:NativePoint):{t:number;p:NativePoint}=>{
  let numeratorVector=shift(cross(direction,w),bits),extra=0;
  while(numeratorVector.some(n=>n>26754||n< -26754)){numeratorVector=shift(numeratorVector,1);extra++;}
  const denominator=sum(squared)>>(extra*2),numerator=dot(shift(axis,extra),numeratorVector);
  if(numerator<0)return {t:0,p:[...start]};
  // Preserve the source parallel/degenerate-line behavior: 0 >= 0 picks end.
  if(numerator>=denominator)return {t:4096,p:[...end]};
  const t=denominator>0xfffff?Math.trunc(numerator/(denominator>>12)):Math.trunc((numerator<<12)/denominator);
  return {t,p:start.map((n,i)=>((n>>12)+Math.floor(short(delta[i])*short(t)/4096))<<12) as NativePoint};
 };
 const x=point(v,a,b,u),y=point(u,c,d,v);
 return {distance:nativeSquareRoot(sum(squares(shift(sub(x.p,y.p),12)))),t1:x.t,t2:y.t,point1:x.p,point2:y.p};
}

export function nativeRailCandidate(rails:{id:number;points:NativePoint[]}[],start:NativePoint,end:NativePoint,velocity:NativePoint,{grounded=false,excludedChain=null}:{grounded?:boolean;excludedChain?:number|null}={}){
 const radius=100*4096,lo=start.map((v,i)=>Math.min(v,end[i])-radius),hi=start.map((v,i)=>Math.max(v,end[i])+radius);
 let best:({rail:number;segment:number;direction:number}&ReturnType<typeof nativeLinePair>)|null=null,limit=100;
 // Caller supplies source CRail linked-list order (newly activated first).
 for(const rail of rails){
  if(rail.id===excludedChain)continue;
  for(let segment=0;segment<rail.points.length-1;segment++){
   const a=rail.points[segment],b=rail.points[segment+1];
   if(a.some((v,i)=>Math.max(v,b[i])<lo[i]||Math.min(v,b[i])>hi[i]))continue;
   const q=nativeLinePair(start,end,a,b);
   if(q.distance>=limit||grounded&&q.point2[1]<end[1])continue;
   const sign=velocity.reduce((n,v,i)=>n+v*(b[i]-a[i]),0)>=0?1:-1;
   const terminal=sign>0?b:a;
   if(q.point2.every((v,i)=>v===terminal[i]))continue;
   limit=q.distance;best={rail:rail.id,segment,direction:sign,...q};
  }
 }
 return best;
}


export function railPointToNative(p:Readonly<Vector3>,frame:ReferenceRailFrame):NativePoint {
 const a=[p.x,p.y,p.z];return frame.axes.map(axis=>{
  const i=Math.abs(axis)-1;return Math.round((a[i]-frame.origin[i])*Math.sign(axis)/frame.unit*4096);
 }) as NativePoint;
}

/** Query the travelled sweep, including source endpoint/ground-side rejection.
 * Other levels keep their existing point query unless a source frame is set. */
export function nearestReferenceRail(rails:Rail[],start:Vector3,end:Vector3,velocity:Vector3,frame:ReferenceRailFrame,grounded:boolean):{rail:Rail;sample:RailSample}|null {
 const nativeRails=rails.map((rail,id)=>({id,points:rail.points.map(p=>railPointToNative(p,frame)),grindable:rail.grindable})).filter(r=>r.grindable).reverse();
 const v=[velocity.x,velocity.y,velocity.z];
 const rawVelocity=frame.axes.map(axis=>v[Math.abs(axis)-1]*Math.sign(axis)) as NativePoint;
 const q=nativeRailCandidate(nativeRails,railPointToNative(start,frame),railPointToNative(end,frame),rawVelocity,{grounded});
 if(!q)return null;
 const world=[...frame.origin];
 frame.axes.forEach((axis,i)=>{const k=Math.abs(axis)-1;world[k]+=q.point2[i]/4096*Math.sign(axis)*frame.unit;});
 const rail=rails[q.rail];return {rail,sample:rail.closest(end.clone().set(world[0],world[1],world[2]))};
}
