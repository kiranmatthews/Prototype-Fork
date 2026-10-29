import type {CustomComponent,CustomLevelData} from '../level';
export type P=[number,number,number];
export type SourceTransform={pivot:P;target:P;scale?:P;yaw?:number};
type Vertex={p:P;uv?:number[];color?:number[];normal?:number[]};
const lerp=(a:number[],b:number[],t:number)=>a.map((v,i)=>v+(b[i]-v)*t);
export function transformPoint(p:P,t:SourceTransform):P {const s=t.scale??[1,1,1],a=(t.yaw??0)*Math.PI/180,x=(p[0]-t.pivot[0])*s[0],y=(p[1]-t.pivot[1])*s[1],z=(p[2]-t.pivot[2])*s[2];return[t.target[0]+x*Math.cos(a)+z*Math.sin(a),t.target[1]+y,t.target[2]-x*Math.sin(a)+z*Math.cos(a)];}
function worldPoint(c:CustomComponent,p:P):P {const a=(c.yaw??0)*Math.PI/180,s=c.t==='mesh'?(c.s??[1,1,1]):[1,1,1],x=p[0]*s[0],z=p[2]*s[2];return[c.p[0]+x*Math.cos(a)+z*Math.sin(a),c.p[1]+p[1]*s[1],c.p[2]-x*Math.sin(a)+z*Math.cos(a)];}
function clip(poly:Vertex[],z:number,sign:number):Vertex[]{const out:Vertex[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[2]-z)*sign,db=(b.p[2]-z)*sign;if(da>=-1e-8)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push({p:lerp(a.p,b.p,t) as P,...(a.uv&&b.uv?{uv:lerp(a.uv,b.uv,t)}:{}),...(a.color&&b.color?{color:lerp(a.color,b.color,t)}:{}),...(a.normal&&b.normal?{normal:lerp(a.normal,b.normal,t)}:{})});}}return out;}
/** Re-author whole source assemblies. Mesh cuts happen only at the selected room's two door planes. */
export function sourceAssembly(level:CustomLevelData,pick:(c:CustomComponent)=>boolean,t:SourceTransform,label:string,grp:number,strip?:[number,number]):CustomComponent[]{
 const out:CustomComponent[]=[],s=t.scale??[1,1,1];
 const prepare=(c:CustomComponent)=>{c.grp=grp;c.nm=`${label} / ${c.nm??c.t}`;delete c.sourceBox;delete c.breakable;delete c.breakGroup;if(c.t==='platform'||c.t==='ramp')delete c.edgeGrinding;return c;};
 for(const original of level.components){if(!pick(original)||['gate','checkpoint','camnode','zone','pit','clock','comboorb'].includes(original.t))continue;
  const c=structuredClone(original);
  if(c.t==='mesh'&&c.vertices){
   const v=c.vertices,ids=c.indices??Array.from({length:v.length/3},(_,i)=>i),points:Vertex[]=Array.from({length:v.length/3},(_,i)=>({p:worldPoint(c,v.slice(i*3,i*3+3) as P),...(c.uvs?{uv:c.uvs.slice(i*2,i*2+2)}:{}),...(c.colors?{color:c.colors.slice(i*3,i*3+3)}:{}),...(c.normals?{normal:c.normals.slice(i*3,i*3+3)}:{})}));
   let batch:Vertex[]=[];
   const flush=()=>{if(!batch.length)return;
    // Index identical corners instead of duplicating triangle data. Every source
    // triangle remains; micrometre precision keeps editor exports compact.
    const map=new Map<string,number>(),vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[],normals:number[]=[];
    const round=(n:number)=>Math.round(n*1e6)/1e6;
    for(const v of batch){const point=transformPoint(v.p,t).map(round),uv=v.uv?.map(round),color=v.color?.map(round);let normal:number[]|undefined;
     if(v.normal){const a=((t.yaw??0)+(c.yaw??0))*Math.PI/180,n=v.normal,x=n[0]/s[0],y=n[1]/s[1],z=n[2]/s[2],d=Math.hypot(x,y,z)||1;normal=[(x*Math.cos(a)+z*Math.sin(a))/d,y/d,(-x*Math.sin(a)+z*Math.cos(a))/d].map(round);}
     const key=[...point,...uv??[],...color??[],...normal??[]].join(',');let id=map.get(key);if(id===undefined){id=map.size;map.set(key,id);vertices.push(...point);if(uv)uvs.push(...uv);if(color)colors.push(...color);if(normal)normals.push(...normal);}indices.push(id);
    }
    const part=prepare({...c,p:[0,0,0],vertices,indices});delete part.s;delete part.yaw;
    if(c.uvs)part.uvs=uvs;if(c.colors)part.colors=colors;if(c.normals)part.normals=normals;
    out.push(part);batch=[];};
   for(let i=0;i<ids.length;i+=3){let poly=ids.slice(i,i+3).map(j=>points[j]);if(strip){poly=clip(poly,-strip[0],-1);poly=clip(poly,-strip[1],1);}for(let j=1;j<poly.length-1;j++){batch.push(poly[0],poly[j],poly[j+1]);if(batch.length>=3600)flush();}}flush();continue;
  }
  if(strip&&c.pts&&(c.t==='rail'||c.t==='wallpath')){
   const points=c.pts.map(q=>worldPoint(c,[q[0],q[3]??0,q[1]])),n=points.length+(c.closed?1:0);
   // Preserve each exact source segment, including its changing base elevation.
   for(let i=1;i<n;i++){let a=points[i-1],b=points[i%points.length];let lo=0,hi=1;
    for(const [z,sign]of [[-strip[0],-1],[-strip[1],1]]){const da=(a[2]-z)*sign,db=(b[2]-z)*sign;if(da<0&&db<0){hi=-1;break;}if(da<0)lo=Math.max(lo,da/(da-db));if(db<0)hi=Math.min(hi,da/(da-db));}
    if(hi<=lo)continue;const pa=transformPoint(lerp(a,b,lo) as P,t),pb=transformPoint(lerp(a,b,hi) as P,t),part=prepare({...c,p:pa,pts:[[0,0,0,0],[pb[0]-pa[0],pb[2]-pa[2],0,pb[1]-pa[1]]],closed:false});delete part.yaw;
    if(part.rise!==undefined)part.rise*=s[1];if(part.collisionHeight!==undefined)part.collisionHeight*=s[1];if(part.wallHeights)part.wallHeights=part.wallHeights.map(n=>n*s[1]) as [number,number];out.push(part);
   }continue;
  }
  if(strip&&(-c.p[2]<strip[0]||-c.p[2]>strip[1]))continue;
  c.p=transformPoint(c.p,t);
  // Non-mesh source pieces use uniform scale; room anisotropy is mesh/path only.
  if(c.s)c.s=c.s.map((n,i)=>n*s[i]) as P;
  c.yaw=(c.yaw??0)+(t.yaw??0);
  if(c.pts)c.pts=c.pts.map(q=>{const p=transformPoint([q[0],q[3]??0,q[1]],{pivot:[0,0,0],target:[0,0,0],scale:s,yaw:c.t==='rail'||c.t==='wallpath'?(t.yaw??0):0});return[p[0],p[2],(q[2]??0)*s[0],p[1],...(q.length>4?[q[4]!]:[])] as typeof q;});
  if(c.pts&&(c.t==='rail'||c.t==='wallpath'))delete c.yaw;
  for(const key of ['rise','lipRise','collisionHeight']as const)if(c[key]!==undefined)c[key]*=s[1];
  for(const key of ['w','deck','outerBank','radius']as const)if(c[key]!==undefined)c[key]*=s[0];
  if(c.t==='wallpath'&&c.w!==undefined)c.w=Math.max(.1,c.w);
  if(c.len!==undefined)c.len*=s[2];if(c.wallHeights)c.wallHeights=c.wallHeights.map(n=>n*s[1]) as [number,number];out.push(prepare(c));
 }
 return out;
}
