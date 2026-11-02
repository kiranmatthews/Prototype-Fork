import type {P,SpaghettiIsland} from './spaghetti-infinite-course';

/** Authoring-only visibility graph. The resulting ordinary rail points are
 * the entire runtime cost: no navigation search runs during play. Keep the
 * complete platforms and move the connecting rail around their undersides. */
export function lanternClearancePath(a:P,b:P,islands:SpaghettiIsland[]):P[]{
 const obstacles=islands.filter(s=>s.p[1]+.2>Math.min(a[1],b[1])&&s.p[1]-4.4<Math.max(a[1],b[1])&&
  s.p[2]+s.d/2>Math.min(a[2],b[2])-34&&s.p[2]-s.d/2<Math.max(a[2],b[2])+34)
  .map(s=>({min:[s.p[0]-s.w/2-1.5,s.p[1]-4.4,s.p[2]-s.d/2-1.5],max:[s.p[0]+s.w/2+1.5,s.p[1]+.15,s.p[2]+s.d/2+1.5]}));
 const clear=(p:P,q:P)=>{
  for(const box of obstacles){
   let near=0,far=1;
   for(let k=0;k<3;k++){
    const d=q[k]-p[k];
    if(Math.abs(d)<1e-8){if(p[k]<box.min[k]||p[k]>box.max[k]){far=-1;break;}}
    else {const u=(box.min[k]-p[k])/d,v=(box.max[k]-p[k])/d;near=Math.max(near,Math.min(u,v));far=Math.min(far,Math.max(u,v));}
   }
   if(near<=far&&far>=0&&near<=1)return false;
  }
  return true;
 };
 if(clear(a,b))return [a,b];
 const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1,n=Math.max(3,Math.ceil(length/6));
 const offsets=[0,-4,4,-8,8,-12,12,-16,16,-20,20,-24,24,-28,28,-32,32];
 type Node={p:P;cost:number;previous:Node|null};
 let previous:Node[]=[{p:a,cost:0,previous:null}];
 for(let i=1;i<=n;i++){
  const next:Node[]=[],t=i/n;
  for(const offset of i===n?[0]:offsets)for(const lift of i===n?[0]:[0,-6,6,-12,12]){
   const y=Math.max(Math.min(a[1],b[1]),Math.min(Math.max(a[1],b[1]),a[1]+(b[1]-a[1])*t+lift));
   const p:P=[a[0]+dx*t-dz/length*offset,y,a[2]+dz*t+dx/length*offset];
   if(Math.abs(p[0])>46)continue;
   let best:Node|null=null,cost=Infinity;
   for(const node of previous){
    const candidate=node.cost+Math.hypot(...p.map((v,k)=>v-node.p[k]))+Math.abs(offset)*.06;
    if((p[1]-node.p[1])*(b[1]-a[1])>=-.001&&candidate<cost&&clear(node.p,p)){best=node;cost=candidate;}
   }
   if(best)next.push({p,cost,previous:best});
  }
  if(!next.length)throw new Error('No clear lantern rail at '+JSON.stringify({a,b,station:i}));
  previous=next;
 }
 const reversed:P[]=[];for(let node:Node|null=previous[0];node;node=node.previous)reversed.push(node.p);
 const path=reversed.reverse(),simplified:P[]=[a];
 for(let i=0;i<path.length-1;){let next=path.length-1;while(next>i+1&&!clear(path[i],path[next]))next--;simplified.push(path[next]);i=next;}
 return simplified;
}
